from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from database import get_db
import models

router = APIRouter()


class TaskCreate(BaseModel):
    task_number: Optional[str] = None
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    deadline_date: Optional[date] = None
    status: Optional[str] = "Pending"
    priority: Optional[str] = "Normal"
    remarks: Optional[str] = None
    department_id: Optional[int] = None


class TaskUpdate(BaseModel):
    description: Optional[str] = None
    assigned_agency: Optional[str] = None
    deadline_date: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None
    department_id: Optional[int] = None


class BulkUpdateRequest(BaseModel):
    updates: List[dict]


@router.get("/")
def get_tasks(
    department_id: Optional[int] = None,
    agency: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "deadline_date",
    db: Session = Depends(get_db)
):
    # Auto-refresh overdue
    today = date.today()
    db.query(models.Task).filter(
        models.Task.deadline_date < today,
        models.Task.status.in_(["Pending", "In Progress"])
    ).update({"status": "Overdue"}, synchronize_session=False)
    db.commit()

    q = db.query(models.Task)
    if department_id:
        q = q.filter(models.Task.department_id == department_id)
    if agency:
        q = q.filter(models.Task.assigned_agency == agency)
    if status:
        q = q.filter(models.Task.status == status)
    if search:
        q = q.filter(or_(
            models.Task.task_number.ilike(f"%{search}%"),
            models.Task.description.ilike(f"%{search}%"),
            models.Task.assigned_agency.ilike(f"%{search}%")
        ))
    if sort_by == "deadline_date":
        q = q.order_by(models.Task.deadline_date.asc().nullslast())
    elif sort_by == "priority":
        from sqlalchemy import case
        priority_order = case(
            {"Critical": 0, "High": 1, "Normal": 2, "Low": 3},
            value=models.Task.priority
        )
        q = q.order_by(priority_order)
    elif sort_by == "created_at":
        q = q.order_by(models.Task.created_at.desc())

    tasks = q.all()
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "task_number": t.task_number,
            "description": t.description,
            "assigned_agency": t.assigned_agency,
            "deadline_date": str(t.deadline_date) if t.deadline_date else None,
            "status": t.status,
            "priority": t.priority,
            "remarks": t.remarks,
            "department_id": t.department_id,
            "source": t.source,
            "created_at": str(t.created_at)
        })
    return result


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    total = db.query(func.count(models.Task.id)).scalar()
    completed = db.query(func.count(models.Task.id)).filter(models.Task.status == "Completed").scalar()
    pending = db.query(func.count(models.Task.id)).filter(models.Task.status == "Pending").scalar()
    overdue = db.query(func.count(models.Task.id)).filter(models.Task.status == "Overdue").scalar()
    in_progress = db.query(func.count(models.Task.id)).filter(models.Task.status == "In Progress").scalar()

    by_agency = db.query(
        models.Task.assigned_agency, func.count(models.Task.id)
    ).group_by(models.Task.assigned_agency).all()

    by_department = db.query(
        models.Department.name, func.count(models.Task.id)
    ).join(models.Task, models.Task.department_id == models.Department.id, isouter=True)\
     .group_by(models.Department.name).all()

    return {
        "total": total,
        "completed": completed,
        "pending": pending,
        "overdue": overdue,
        "in_progress": in_progress,
        "by_agency": [{"agency": r[0] or "Unassigned", "count": r[1]} for r in by_agency],
        "by_department": [{"department": r[0], "count": r[1]} for r in by_department]
    }


@router.post("/")
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task_data = data.dict()
    if not task_data.get("task_number"):
        task_data["task_number"] = f"T-{int(datetime.utcnow().timestamp())}"
    task = models.Task(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/bulk/update")
def bulk_update(data: BulkUpdateRequest, db: Session = Depends(get_db)):
    updated = []
    for item in data.updates:
        task_id = item.get("id")
        task = db.query(models.Task).filter(models.Task.id == task_id).first()
        if task:
            for k, v in item.items():
                if k != "id" and hasattr(task, k):
                    setattr(task, k, v)
            updated.append(task_id)
    db.commit()
    return {"updated": updated}


@router.put("/{task_id}")
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Deleted"}
