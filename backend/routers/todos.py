from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import re

from database import get_db
import models

router = APIRouter()


def _normalize_priority(value: Optional[str]) -> str:
    val = (value or "").strip().lower()
    if val in {"critical", "crit", "p0"}:
        return "Critical"
    if val in {"high", "p1"}:
        return "High"
    if val in {"low", "p3"}:
        return "Low"
    return "Normal"


def _normalize_status(value: Optional[str]) -> str:
    val = (value or "").strip().lower()
    if val in {"archived", "archive"}:
        return "Archived"
    if val in {"done", "completed", "complete"}:
        return "Done"
    return "Open"


def _serialize_todo(todo: models.TodoItem) -> dict:
    return {
        "id": todo.id,
        "title": todo.title,
        "details": todo.details,
        "due_date": str(todo.due_date) if todo.due_date else None,
        "reminder_at": todo.reminder_at.isoformat() if todo.reminder_at else None,
        "status": _normalize_status(todo.status),
        "priority": _normalize_priority(todo.priority),
        "order_index": todo.order_index if todo.order_index is not None else 0,
        "source": todo.source or "manual",
        "department_id": todo.department_id,
        "department_name": todo.department.name if todo.department else None,
        "assigned_employee_id": todo.assigned_employee_id,
        "assigned_employee_name": todo.assigned_employee.name if todo.assigned_employee else None,
        "linked_task_id": todo.linked_task_id,
        "linked_task_number": todo.linked_task.task_number if todo.linked_task else None,
        "created_at": todo.created_at.isoformat() if todo.created_at else None,
        "updated_at": todo.updated_at.isoformat() if todo.updated_at else None,
    }


def _get_todo_or_404(db: Session, todo_id: int) -> models.TodoItem:
    row = db.query(models.TodoItem).options(
        joinedload(models.TodoItem.department),
        joinedload(models.TodoItem.assigned_employee),
        joinedload(models.TodoItem.linked_task),
    ).filter(models.TodoItem.id == todo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="To-do item not found")
    return row


def _generate_task_number(db: Session, assigned_agency: Optional[str], department_id: Optional[int]) -> str:
    prefix = "TSK"
    if assigned_agency:
        letters = re.sub(r"[^A-Za-z]", "", assigned_agency)
        if len(letters) >= 3:
            prefix = letters[:3].upper()
        elif letters:
            prefix = letters.upper().ljust(3, "X")
    elif department_id:
        dept = db.query(models.Department).filter(models.Department.id == department_id).first()
        if dept:
            short = dept.short_name or dept.name
            letters = re.sub(r"[^A-Za-z]", "", short or "")
            if len(letters) >= 3:
                prefix = letters[:3].upper()
    existing = db.query(models.Task.task_number).filter(
        models.Task.task_number.like(f"{prefix}-%")
    ).all()
    used = set()
    for (task_number,) in existing:
        match = re.match(rf"^{re.escape(prefix)}-(\d+)$", task_number or "")
        if match:
            used.add(int(match.group(1)))
    seq = 1
    while seq in used and seq <= 999:
        seq += 1
    return f"{prefix}-{str(seq).zfill(3)}"


def _parse_notes_lines(raw_text: str) -> List[str]:
    lines = []
    for raw in (raw_text or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"^[-*•\u2022]\s*", "", line)
        line = re.sub(r"^\d+[\).\-\s]+", "", line)
        line = re.sub(r"^\[[xX ]\]\s*", "", line)
        clean = line.strip()
        if clean:
            lines.append(clean)
    return lines


class TodoCreate(BaseModel):
    title: str
    details: Optional[str] = None
    due_date: Optional[date] = None
    reminder_at: Optional[datetime] = None
    status: Optional[str] = "Open"
    priority: Optional[str] = "Normal"
    department_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    order_index: Optional[int] = None
    source: Optional[str] = "manual"


class TodoUpdate(BaseModel):
    title: Optional[str] = None
    details: Optional[str] = None
    due_date: Optional[date] = None
    reminder_at: Optional[datetime] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    department_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    order_index: Optional[int] = None
    source: Optional[str] = None


class TodoImportFromText(BaseModel):
    text: str
    department_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None
    priority: Optional[str] = "Normal"
    due_date: Optional[date] = None


class TodoReorder(BaseModel):
    ordered_ids: List[int]


class TodoConvertToTaskRequest(BaseModel):
    department_id: Optional[int] = None
    assigned_agency: Optional[str] = None
    assigned_employee_id: Optional[int] = None
    deadline_date: Optional[date] = None
    status: Optional[str] = "Pending"
    keep_todo_open: Optional[bool] = False


@router.get("/")
def get_todos(
    status: Optional[str] = Query(default=None, description="Open|Done or comma separated"),
    db: Session = Depends(get_db),
):
    query = db.query(models.TodoItem).options(
        joinedload(models.TodoItem.department),
        joinedload(models.TodoItem.assigned_employee),
        joinedload(models.TodoItem.linked_task),
    )
    if status:
        statuses = [_normalize_status(item.strip()) for item in status.split(",") if item.strip()]
        query = query.filter(models.TodoItem.status.in_(statuses))
    rows = query.order_by(models.TodoItem.order_index.asc(), models.TodoItem.created_at.asc()).all()
    return [_serialize_todo(row) for row in rows]


@router.post("/")
def create_todo(data: TodoCreate, db: Session = Depends(get_db)):
    payload = data.dict()
    title = (payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    dept_id = payload.get("department_id")
    if dept_id is not None:
        exists = db.query(models.Department.id).filter(
            models.Department.id == dept_id,
            models.Department.is_active == True
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Department not found")
    assigned_employee_id = payload.get("assigned_employee_id")
    if assigned_employee_id is not None:
        employee_exists = db.query(models.Employee.id).filter(
            models.Employee.id == assigned_employee_id,
            models.Employee.is_active == True
        ).first()
        if not employee_exists:
            raise HTTPException(status_code=404, detail="Assigned employee not found")
    order_index = payload.get("order_index")
    if order_index is None:
        max_order = db.query(func.max(models.TodoItem.order_index)).scalar()
        order_index = (max_order or 0) + 1
    row = models.TodoItem(
        title=title,
        details=payload.get("details"),
        due_date=payload.get("due_date"),
        reminder_at=payload.get("reminder_at"),
        status=_normalize_status(payload.get("status")),
        priority=_normalize_priority(payload.get("priority")),
        department_id=dept_id,
        assigned_employee_id=assigned_employee_id,
        order_index=max(0, int(order_index)),
        source=(payload.get("source") or "manual"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_todo(_get_todo_or_404(db, row.id))


@router.post("/import-text")
def import_todos_from_text(data: TodoImportFromText, db: Session = Depends(get_db)):
    lines = _parse_notes_lines(data.text)
    if not lines:
        return {"created": 0, "items": []}
    dept_id = data.department_id
    if dept_id is not None:
        exists = db.query(models.Department.id).filter(
            models.Department.id == dept_id,
            models.Department.is_active == True
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Department not found")
    if data.assigned_employee_id is not None:
        employee_exists = db.query(models.Employee.id).filter(
            models.Employee.id == data.assigned_employee_id,
            models.Employee.is_active == True
        ).first()
        if not employee_exists:
            raise HTTPException(status_code=404, detail="Assigned employee not found")

    max_order = db.query(func.max(models.TodoItem.order_index)).scalar() or 0
    created_ids = []
    for idx, line in enumerate(lines, start=1):
        row = models.TodoItem(
            title=line,
            due_date=data.due_date,
            status="Open",
            priority=_normalize_priority(data.priority),
            department_id=dept_id,
            assigned_employee_id=data.assigned_employee_id,
            source="imported_notes",
            order_index=max_order + idx,
        )
        db.add(row)
        db.flush()
        created_ids.append(row.id)

    db.commit()
    rows = db.query(models.TodoItem).options(
        joinedload(models.TodoItem.department),
        joinedload(models.TodoItem.assigned_employee),
        joinedload(models.TodoItem.linked_task),
    ).filter(models.TodoItem.id.in_(created_ids)).order_by(models.TodoItem.order_index.asc()).all()
    return {"created": len(rows), "items": [_serialize_todo(row) for row in rows]}


@router.put("/{todo_id}")
def update_todo(todo_id: int, data: TodoUpdate, db: Session = Depends(get_db)):
    row = _get_todo_or_404(db, todo_id)
    payload = data.dict(exclude_unset=True)
    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="title cannot be empty")
        row.title = title
    if "details" in payload:
        row.details = payload.get("details")
    if "due_date" in payload:
        row.due_date = payload.get("due_date")
    if "reminder_at" in payload:
        row.reminder_at = payload.get("reminder_at")
    if "status" in payload:
        row.status = _normalize_status(payload.get("status"))
    if "priority" in payload:
        row.priority = _normalize_priority(payload.get("priority"))
    if "source" in payload and payload.get("source"):
        row.source = payload.get("source")
    if "order_index" in payload:
        row.order_index = max(0, int(payload.get("order_index") or 0))
    if "department_id" in payload:
        dept_id = payload.get("department_id")
        if dept_id is None:
            row.department_id = None
        else:
            exists = db.query(models.Department.id).filter(
                models.Department.id == dept_id,
                models.Department.is_active == True
            ).first()
            if not exists:
                raise HTTPException(status_code=404, detail="Department not found")
            row.department_id = dept_id
    if "assigned_employee_id" in payload:
        employee_id = payload.get("assigned_employee_id")
        if employee_id is None:
            row.assigned_employee_id = None
        else:
            employee_exists = db.query(models.Employee.id).filter(
                models.Employee.id == employee_id,
                models.Employee.is_active == True
            ).first()
            if not employee_exists:
                raise HTTPException(status_code=404, detail="Assigned employee not found")
            row.assigned_employee_id = employee_id

    db.commit()
    db.refresh(row)
    return _serialize_todo(_get_todo_or_404(db, row.id))


@router.post("/reorder")
def reorder_todos(data: TodoReorder, db: Session = Depends(get_db)):
    ordered_ids = [int(x) for x in (data.ordered_ids or [])]
    if not ordered_ids:
        return {"updated": 0}
    rows = db.query(models.TodoItem).filter(models.TodoItem.id.in_(ordered_ids)).all()
    by_id = {row.id: row for row in rows}
    updated = 0
    for index, todo_id in enumerate(ordered_ids):
        row = by_id.get(todo_id)
        if not row:
            continue
        row.order_index = index
        updated += 1
    db.commit()
    return {"updated": updated}


@router.post("/{todo_id}/convert-to-task")
def convert_todo_to_task(todo_id: int, data: TodoConvertToTaskRequest, db: Session = Depends(get_db)):
    row = _get_todo_or_404(db, todo_id)
    dept_id = data.department_id if data.department_id is not None else row.department_id
    if dept_id is not None:
        exists = db.query(models.Department.id).filter(
            models.Department.id == dept_id,
            models.Department.is_active == True
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Department not found")

    assigned_employee_id = data.assigned_employee_id if data.assigned_employee_id is not None else row.assigned_employee_id
    employee = None
    if assigned_employee_id is not None:
        employee = db.query(models.Employee).filter(
            models.Employee.id == assigned_employee_id,
            models.Employee.is_active == True
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Assigned employee not found")

    assigned_agency = data.assigned_agency
    if not assigned_agency and employee:
        assigned_agency = employee.display_username or employee.name

    resolved_deadline = data.deadline_date or row.due_date
    resolved_time_given = None
    if resolved_deadline is None:
        resolved_deadline = date.today() + timedelta(days=7)
        resolved_time_given = "7 days"

    task = models.Task(
        task_number=_generate_task_number(db, assigned_agency, dept_id),
        description=row.title,
        assigned_agency=assigned_agency,
        assigned_employee_id=assigned_employee_id,
        allocated_date=date.today(),
        time_given=resolved_time_given,
        deadline_date=resolved_deadline,
        status=(data.status or "Pending"),
        priority=_normalize_priority(row.priority),
        remarks=row.details,
        department_id=dept_id,
        source="todo",
    )
    db.add(task)
    db.flush()

    row.linked_task_id = task.id
    row.source = "converted_to_task"
    if data.keep_todo_open:
        row.status = "Open"
    else:
        row.status = "Done"

    db.commit()
    db.refresh(task)
    return {
        "todo": _serialize_todo(_get_todo_or_404(db, row.id)),
        "task_id": task.id,
        "task_number": task.task_number,
    }


@router.delete("/{todo_id}")
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    row = db.query(models.TodoItem).filter(models.TodoItem.id == todo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="To-do item not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
