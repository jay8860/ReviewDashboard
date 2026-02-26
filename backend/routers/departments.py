from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta

from database import get_db
import models

router = APIRouter()


class DepartmentCreate(BaseModel):
    name: str
    short_name: Optional[str] = None
    description: Optional[str] = None
    head_name: Optional[str] = None
    head_designation: Optional[str] = None
    color: Optional[str] = "indigo"
    icon: Optional[str] = "Building2"


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    head_name: Optional[str] = None
    head_designation: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


def compute_review_health(dept: models.Department, today: date) -> dict:
    """Compute health score for a department based on review cadence."""
    programs = dept.review_programs
    if not programs:
        return {"score": 0, "status": "no_programs", "overdue_reviews": 0, "total_programs": 0}

    overdue = 0
    alert = 0
    for prog in programs:
        if not prog.is_active:
            continue
        # Find last completed review
        completed = [s for s in prog.review_sessions if s.status == "Completed" and s.actual_date]
        if not completed:
            # Never reviewed — count as overdue if program is > frequency_days old
            created_days_ago = (today - prog.created_at.date()).days if prog.created_at else 999
            if created_days_ago > prog.review_frequency_days:
                overdue += 1
            continue
        last_review = max(completed, key=lambda s: s.actual_date).actual_date
        days_since = (today - last_review).days
        if days_since > prog.review_frequency_days:
            overdue += 1
        elif days_since > prog.review_frequency_days - 5:
            alert += 1

    active_count = sum(1 for p in programs if p.is_active)
    if active_count == 0:
        return {"score": 100, "status": "ok", "overdue_reviews": 0, "total_programs": 0}

    score = max(0, 100 - (overdue * 30) - (alert * 10))
    if overdue > 0:
        status = "critical"
    elif alert > 0:
        status = "warning"
    else:
        status = "ok"

    return {
        "score": score,
        "status": status,
        "overdue_reviews": overdue,
        "alert_reviews": alert,
        "total_programs": active_count
    }


@router.get("/")
def get_departments(db: Session = Depends(get_db)):
    today = date.today()
    departments = db.query(models.Department).options(
        joinedload(models.Department.review_programs).joinedload(models.ReviewProgram.review_sessions)
    ).filter(models.Department.is_active == True).all()

    result = []
    for dept in departments:
        health = compute_review_health(dept, today)
        # Count open tasks
        open_tasks = db.query(func.count(models.Task.id)).filter(
            models.Task.department_id == dept.id,
            models.Task.status != "Completed"
        ).scalar()
        result.append({
            "id": dept.id,
            "name": dept.name,
            "short_name": dept.short_name,
            "description": dept.description,
            "head_name": dept.head_name,
            "head_designation": dept.head_designation,
            "color": dept.color,
            "icon": dept.icon,
            "is_active": dept.is_active,
            "created_at": dept.created_at,
            "review_health": health,
            "open_tasks": open_tasks,
            "program_count": len([p for p in dept.review_programs if p.is_active])
        })
    return result


@router.post("/")
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    dept = models.Department(**data.dict())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.get("/{dept_id}")
def get_department(dept_id: int, db: Session = Depends(get_db)):
    today = date.today()
    dept = db.query(models.Department).options(
        joinedload(models.Department.review_programs).joinedload(models.ReviewProgram.review_sessions)
    ).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    programs_data = []
    for prog in dept.review_programs:
        if not prog.is_active:
            continue
        completed = [s for s in prog.review_sessions if s.status == "Completed" and s.actual_date]
        last_review = None
        days_since = None
        next_due = None
        debt_status = "ok"
        if completed:
            last = max(completed, key=lambda s: s.actual_date)
            last_review = str(last.actual_date)
            days_since = (today - last.actual_date).days
            next_due = str(last.actual_date + timedelta(days=prog.review_frequency_days))
            if days_since > prog.review_frequency_days:
                debt_status = "overdue"
            elif days_since > prog.review_frequency_days - 5:
                debt_status = "warning"
        else:
            debt_status = "never_reviewed"

        # Upcoming scheduled session
        upcoming = [s for s in prog.review_sessions if s.status == "Scheduled" and s.scheduled_date >= today]
        next_scheduled = str(min(upcoming, key=lambda s: s.scheduled_date).scheduled_date) if upcoming else None

        programs_data.append({
            "id": prog.id,
            "name": prog.name,
            "description": prog.description,
            "review_frequency_days": prog.review_frequency_days,
            "last_review": last_review,
            "days_since_last_review": days_since,
            "next_due": next_due,
            "next_scheduled": next_scheduled,
            "debt_status": debt_status,
            "session_count": len(prog.review_sessions)
        })

    return {
        "id": dept.id,
        "name": dept.name,
        "short_name": dept.short_name,
        "description": dept.description,
        "head_name": dept.head_name,
        "head_designation": dept.head_designation,
        "color": dept.color,
        "icon": dept.icon,
        "review_health": compute_review_health(dept, today),
        "programs": programs_data
    }


@router.put("/{dept_id}")
def update_department(dept_id: int, data: DepartmentUpdate, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(dept, k, v)
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"message": "Deleted"}
