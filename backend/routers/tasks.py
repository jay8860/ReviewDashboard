from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, case
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
import re

from database import get_db
import models

router = APIRouter()


class TaskCreate(BaseModel):
    task_number: Optional[str] = None
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    allocated_date: Optional[date] = None
    time_given: Optional[str] = None
    deadline_date: Optional[date] = None
    completion_date: Optional[str] = None
    status: Optional[str] = "Pending"
    priority: Optional[str] = "Normal"
    is_pinned: Optional[bool] = False
    is_today: Optional[bool] = False
    steno_comment: Optional[str] = None
    remarks: Optional[str] = None
    department_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None


class TaskUpdate(BaseModel):
    task_number: Optional[str] = None
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    allocated_date: Optional[date] = None
    time_given: Optional[str] = None
    deadline_date: Optional[date] = None
    completion_date: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_today: Optional[bool] = None
    steno_comment: Optional[str] = None
    remarks: Optional[str] = None
    department_id: Optional[int] = None
    assigned_employee_id: Optional[int] = None


class BulkUpdateRequest(BaseModel):
    updates: List[dict]


def _normalize_task_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"in progress", "in_progress", "progress"}:
        return "Pending"
    if text in {"completed", "done"}:
        return "Completed"
    if text in {"overdue"}:
        return "Overdue"
    if text in {"pending", ""}:
        return "Pending"
    return "Pending"


def _coerce_date_field(value, field_name: str) -> Optional[date]:
    if value in (None, "", "null", "None"):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None

    # Try common formats first.
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    # Fallback for ISO-like datetime strings.
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name} value: {value}")


def _coerce_int_field(value):
    if value in (None, "", "null", "None"):
        return None
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid numeric value: {value}")


def _canonical_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = " ".join(str(value).strip().split())
    return text or None


def _effective_agency_expr():
    return func.coalesce(
        func.nullif(func.trim(models.Task.assigned_agency), ""),
        func.nullif(func.trim(models.Employee.display_username), ""),
        func.nullif(func.trim(models.Employee.name), ""),
        "Unassigned",
    )


def generate_task_number(db: Session, assigned_agency: Optional[str], department_id: Optional[int]) -> str:
    prefix = "TSK"
    if assigned_agency:
        letters = re.sub(r'[^A-Za-z]', '', assigned_agency)
        if len(letters) >= 3:
            prefix = letters[:3].upper()
        elif len(letters) > 0:
            prefix = letters.upper().ljust(3, 'X')
    elif department_id:
        dept = db.query(models.Department).filter(models.Department.id == department_id).first()
        if dept:
            short = dept.short_name or dept.name
            letters = re.sub(r'[^A-Za-z]', '', short)
            if len(letters) >= 3:
                prefix = letters[:3].upper()

    existing = db.query(models.Task).filter(
        models.Task.task_number.like(f"{prefix}-%")
    ).all()
    used_nums = set()
    for t in existing:
        m = re.match(rf'^{re.escape(prefix)}-(\d+)$', t.task_number or '')
        if m:
            used_nums.add(int(m.group(1)))
    seq = 1
    while seq in used_nums and seq <= 999:
        seq += 1
    return f"{prefix}-{str(seq).zfill(3)}"


def task_to_dict(t: models.Task) -> dict:
    return {
        "id": t.id,
        "task_number": t.task_number,
        "description": t.description,
        "assigned_agency": t.assigned_agency,
        "allocated_date": str(t.allocated_date) if t.allocated_date else None,
        "time_given": t.time_given,
        "deadline_date": str(t.deadline_date) if t.deadline_date else None,
        "completion_date": t.completion_date,
        "status": t.status,
        "priority": t.priority,
        "is_pinned": t.is_pinned or False,
        "is_today": t.is_today or False,
        "steno_comment": t.steno_comment,
        "remarks": t.remarks,
        "department_id": t.department_id,
        "source": t.source,
        "assigned_employee_id": t.assigned_employee_id,
        "assigned_employee_name": t.assigned_employee.name if t.assigned_employee else None,
        "assigned_employee_display_username": t.assigned_employee.display_username if t.assigned_employee else None,
        "created_at": str(t.created_at)
    }


def _sync_task_statuses(db: Session) -> None:
    today = date.today()
    changed = False

    in_progress_count = db.query(models.Task).filter(
        models.Task.status == "In Progress"
    ).update({"status": "Pending"}, synchronize_session=False)
    if in_progress_count:
        changed = True

    pending_to_overdue = db.query(models.Task).filter(
        models.Task.deadline_date < today,
        models.Task.status == "Pending",
        models.Task.completion_date == None
    ).update({"status": "Overdue"}, synchronize_session=False)
    if pending_to_overdue:
        changed = True

    overdue_to_pending = db.query(models.Task).filter(
        models.Task.status == "Overdue",
        models.Task.completion_date == None,
        or_(models.Task.deadline_date == None, models.Task.deadline_date >= today)
    ).update({"status": "Pending"}, synchronize_session=False)
    if overdue_to_pending:
        changed = True

    if changed:
        db.commit()


@router.get("/")
def get_tasks(
    department_id: Optional[int] = None,
    agency: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    is_today: Optional[bool] = None,
    is_pinned: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "deadline_date",
    sort_dir: Optional[str] = "asc",
    db: Session = Depends(get_db)
):
    _sync_task_statuses(db)

    agency_expr = _effective_agency_expr()
    q = (
        db.query(models.Task)
        .outerjoin(models.Employee, models.Task.assigned_employee_id == models.Employee.id)
        .options(joinedload(models.Task.assigned_employee))
    )
    if department_id:
        q = q.filter(models.Task.department_id == department_id)
    if agency:
        canonical_agency = _canonical_text(agency)
        if canonical_agency:
            q = q.filter(func.lower(agency_expr) == canonical_agency.lower())
    if status:
        raw_statuses = [s.strip() for s in status.split(',') if s.strip()]
        statuses = [_normalize_task_status(s) for s in raw_statuses]
        statuses = [s for s in statuses if s]
        if statuses:
            q = q.filter(models.Task.status.in_(statuses))
    if priority:
        q = q.filter(models.Task.priority == priority)
    if is_today is not None:
        q = q.filter(models.Task.is_today == is_today)
    if is_pinned is not None:
        q = q.filter(models.Task.is_pinned == is_pinned)
    if search:
        search_term = _canonical_text(search) or search
        q = q.filter(or_(
            models.Task.task_number.ilike(f"%{search_term}%"),
            models.Task.description.ilike(f"%{search_term}%"),
            models.Task.assigned_agency.ilike(f"%{search_term}%"),
            models.Task.steno_comment.ilike(f"%{search_term}%"),
            models.Employee.name.ilike(f"%{search_term}%"),
            models.Employee.display_username.ilike(f"%{search_term}%"),
            agency_expr.ilike(f"%{search_term}%"),
        ))

    direction = (sort_dir or "asc").strip().lower()
    is_desc = direction == "desc"

    if sort_by == "priority":
        priority_order = case(
            (models.Task.priority == "Critical", 0),
            (models.Task.priority == "High", 1),
            (models.Task.priority == "Normal", 2),
            (models.Task.priority == "Low", 3),
            else_=4
        )
        q = q.order_by(priority_order.desc() if is_desc else priority_order.asc())
    elif sort_by == "task_number":
        q = q.order_by(models.Task.task_number.desc().nullslast() if is_desc else models.Task.task_number.asc().nullslast())
    elif sort_by == "description":
        q = q.order_by(models.Task.description.desc().nullslast() if is_desc else models.Task.description.asc().nullslast())
    elif sort_by == "assigned_agency":
        q = q.order_by(agency_expr.desc() if is_desc else agency_expr.asc())
    elif sort_by == "allocated_date":
        q = q.order_by(models.Task.allocated_date.desc().nullslast() if is_desc else models.Task.allocated_date.asc().nullslast())
    elif sort_by == "created_at":
        q = q.order_by(models.Task.created_at.desc() if is_desc else models.Task.created_at.asc())
    else:  # deadline_date
        q = q.order_by(models.Task.deadline_date.desc().nullslast() if is_desc else models.Task.deadline_date.asc().nullslast())

    return [task_to_dict(t) for t in q.all()]


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    _sync_task_statuses(db)
    agency_expr = _effective_agency_expr()
    total = db.query(func.count(models.Task.id)).scalar()
    completed = db.query(func.count(models.Task.id)).filter(
        or_(models.Task.status == "Completed", models.Task.completion_date != None)
    ).scalar()
    pending = db.query(func.count(models.Task.id)).filter(
        models.Task.completion_date == None,
        or_(models.Task.status == None, models.Task.status != "Completed")
    ).scalar()
    overdue = db.query(func.count(models.Task.id)).filter(
        models.Task.status == "Overdue", models.Task.completion_date == None
    ).scalar()
    important = db.query(func.count(models.Task.id)).filter(
        models.Task.priority.in_(["High", "Critical"]), models.Task.completion_date == None
    ).scalar()
    by_agency = (
        db.query(agency_expr.label("agency"), func.count(models.Task.id))
        .outerjoin(models.Employee, models.Task.assigned_employee_id == models.Employee.id)
        .group_by(agency_expr)
        .all()
    )
    return {
        "total": total, "completed": completed, "pending": pending,
        "overdue": overdue, "important": important,
        "by_agency": [{"agency": (r[0] or "Unassigned"), "count": r[1]} for r in by_agency],
    }


@router.get("/agencies")
def get_agencies(db: Session = Depends(get_db)):
    agency_expr = _effective_agency_expr()
    rows = (
        db.query(agency_expr)
        .outerjoin(models.Employee, models.Task.assigned_employee_id == models.Employee.id)
        .all()
    )
    unique = {}
    for (value,) in rows:
        cleaned = _canonical_text(value)
        if not cleaned:
            continue
        key = cleaned.casefold()
        if key not in unique:
            unique[key] = cleaned
    return sorted(unique.values(), key=lambda v: v.casefold())


@router.post("/")
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task_data = data.dict()
    task_data["status"] = _normalize_task_status(task_data.get("status"))
    if not task_data.get("task_number"):
        task_data["task_number"] = generate_task_number(db, task_data.get("assigned_agency"), task_data.get("department_id"))
    if not task_data.get("allocated_date"):
        task_data["allocated_date"] = date.today()
    if task_data.get("completion_date"):
        task_data["status"] = "Completed"
    task = models.Task(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@router.put("/bulk/update")
def bulk_update(data: BulkUpdateRequest, db: Session = Depends(get_db)):
    updated = []
    try:
        for item in data.updates:
            task_id = item.get("id")
            task = db.query(models.Task).filter(models.Task.id == task_id).first()
            if not task:
                continue

            for k, v in item.items():
                if k == "id" or not hasattr(task, k):
                    continue

                if k == "status":
                    v = _normalize_task_status(v)
                elif k in {"allocated_date", "deadline_date"}:
                    v = _coerce_date_field(v, k)
                elif k == "completion_date":
                    # completion_date is stored as string in this schema.
                    parsed = _coerce_date_field(v, k)
                    v = parsed.isoformat() if parsed else None
                elif k in {"department_id", "assigned_employee_id"}:
                    v = _coerce_int_field(v)

                setattr(task, k, v)

            # Keep completion and status consistent.
            if item.get("completion_date") not in (None, "", "null", "None"):
                task.status = "Completed"
            elif item.get("status") in {"Pending", "Overdue"}:
                task.completion_date = None

            updated.append(task_id)

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk update failed: {exc}")

    return {"updated": updated}


@router.put("/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    payload = data.dict(exclude_unset=True)
    if "status" in payload:
        payload["status"] = _normalize_task_status(payload.get("status"))

    if "completion_date" in payload:
        if payload["completion_date"] in ("", None):
            payload["completion_date"] = None

    for k, v in payload.items():
        setattr(task, k, v)

    # Keep completion_date and status consistent in both directions.
    if payload.get("status") == "Completed":
        if not task.completion_date:
            task.completion_date = str(date.today())
    elif "status" in payload and payload.get("status") in {"Pending", "Overdue"}:
        task.completion_date = None
    elif "completion_date" in payload and payload.get("completion_date") is None and task.status == "Completed":
        task.status = "Pending"

    db.commit()
    db.refresh(task)
    return task_to_dict(task)


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Deleted"}
