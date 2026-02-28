from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import json

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
        # Compute days_since_last_review for overview display
        all_completed = []
        for prog in dept.review_programs:
            if prog.is_active:
                for s in prog.review_sessions:
                    if s.status == "Completed" and s.actual_date:
                        all_completed.append(s.actual_date)
        if all_completed:
            last_date = max(all_completed)
            health["days_since_last_review"] = (today - last_date).days
            health["next_scheduled"] = None
            # Find next scheduled session
            upcoming = []
            for prog in dept.review_programs:
                for s in prog.review_sessions:
                    if s.status == "Scheduled" and s.scheduled_date >= today:
                        upcoming.append(s.scheduled_date)
            if upcoming:
                health["next_scheduled"] = str(min(upcoming))
        else:
            health["days_since_last_review"] = None
            health["next_scheduled"] = None
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
            "target_value": prog.target_value,
            "achieved_value": prog.achieved_value,
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


# ─── Agenda Points ─────────────────────────────────────────────────────────────

class AgendaPointCreate(BaseModel):
    title: str
    details: Optional[str] = None
    status: Optional[str] = "Open"
    order_index: Optional[int] = 0


class AgendaPointUpdate(BaseModel):
    title: Optional[str] = None
    details: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None


@router.get("/{dept_id}/agenda")
def get_agenda(dept_id: int, db: Session = Depends(get_db)):
    return db.query(models.AgendaPoint).filter(
        models.AgendaPoint.department_id == dept_id
    ).order_by(models.AgendaPoint.order_index, models.AgendaPoint.created_at).all()


@router.post("/{dept_id}/agenda")
def create_agenda_point(dept_id: int, data: AgendaPointCreate, db: Session = Depends(get_db)):
    ap = models.AgendaPoint(department_id=dept_id, **data.dict())
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.put("/{dept_id}/agenda/{ap_id}")
def update_agenda_point(dept_id: int, ap_id: int, data: AgendaPointUpdate, db: Session = Depends(get_db)):
    ap = db.query(models.AgendaPoint).filter(
        models.AgendaPoint.id == ap_id,
        models.AgendaPoint.department_id == dept_id
    ).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Agenda point not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(ap, k, v)
    db.commit()
    db.refresh(ap)
    return ap


@router.delete("/{dept_id}/agenda/{ap_id}")
def delete_agenda_point(dept_id: int, ap_id: int, db: Session = Depends(get_db)):
    ap = db.query(models.AgendaPoint).filter(
        models.AgendaPoint.id == ap_id,
        models.AgendaPoint.department_id == dept_id
    ).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Agenda point not found")
    db.delete(ap)
    db.commit()
    return {"message": "Deleted"}


# ─── Department Meetings ───────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    scheduled_date: date
    venue: Optional[str] = None
    attendees: Optional[str] = None
    notes: Optional[str] = None
    officer_phone: Optional[str] = None
    # Will auto-snapshot open agenda points if not provided
    agenda_snapshot: Optional[str] = None


class MeetingUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    venue: Optional[str] = None
    attendees: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    officer_phone: Optional[str] = None


@router.get("/{dept_id}/meetings")
def get_meetings(dept_id: int, db: Session = Depends(get_db)):
    meetings = db.query(models.DepartmentMeeting).filter(
        models.DepartmentMeeting.department_id == dept_id
    ).order_by(models.DepartmentMeeting.scheduled_date.desc()).all()

    result = []
    for m in meetings:
        snapshot = []
        if m.agenda_snapshot:
            try:
                snapshot = json.loads(m.agenda_snapshot)
            except Exception:
                snapshot = []
        result.append({
            "id": m.id,
            "department_id": m.department_id,
            "scheduled_date": str(m.scheduled_date),
            "venue": m.venue,
            "attendees": m.attendees,
            "notes": m.notes,
            "status": m.status,
            "officer_phone": m.officer_phone,
            "agenda_snapshot": snapshot,
            "created_at": m.created_at,
        })
    return result


@router.post("/{dept_id}/meetings")
def create_meeting(dept_id: int, data: MeetingCreate, db: Session = Depends(get_db)):
    # Auto-snapshot current open agenda points
    if not data.agenda_snapshot:
        open_points = db.query(models.AgendaPoint).filter(
            models.AgendaPoint.department_id == dept_id,
            models.AgendaPoint.status == "Open"
        ).order_by(models.AgendaPoint.order_index).all()
        snapshot = json.dumps([{"title": ap.title, "details": ap.details} for ap in open_points])
    else:
        snapshot = data.agenda_snapshot

    meeting = models.DepartmentMeeting(
        department_id=dept_id,
        scheduled_date=data.scheduled_date,
        venue=data.venue,
        attendees=data.attendees,
        notes=data.notes,
        officer_phone=data.officer_phone,
        agenda_snapshot=snapshot,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Parse snapshot for response
    parsed_snapshot = json.loads(snapshot) if snapshot else []
    return {
        "id": meeting.id,
        "department_id": meeting.department_id,
        "scheduled_date": str(meeting.scheduled_date),
        "venue": meeting.venue,
        "attendees": meeting.attendees,
        "notes": meeting.notes,
        "status": meeting.status,
        "officer_phone": meeting.officer_phone,
        "agenda_snapshot": parsed_snapshot,
        "created_at": meeting.created_at,
    }


@router.put("/{dept_id}/meetings/{meeting_id}")
def update_meeting(dept_id: int, meeting_id: int, data: MeetingUpdate, db: Session = Depends(get_db)):
    meeting = db.query(models.DepartmentMeeting).filter(
        models.DepartmentMeeting.id == meeting_id,
        models.DepartmentMeeting.department_id == dept_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(meeting, k, v)
    db.commit()
    db.refresh(meeting)
    return {"message": "Updated"}


@router.delete("/{dept_id}/meetings/{meeting_id}")
def delete_meeting(dept_id: int, meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(models.DepartmentMeeting).filter(
        models.DepartmentMeeting.id == meeting_id,
        models.DepartmentMeeting.department_id == dept_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    db.delete(meeting)
    db.commit()
    return {"message": "Deleted"}


# ─── Department Data Grid ───────────────────────────────────────────────────────

class DataGridUpdate(BaseModel):
    columns: Optional[List[str]] = None
    rows: Optional[List[List[str]]] = None


@router.get("/{dept_id}/datagrid")
def get_datagrid(dept_id: int, db: Session = Depends(get_db)):
    grid = db.query(models.DeptDataGrid).filter(
        models.DeptDataGrid.department_id == dept_id
    ).first()
    if not grid:
        # Auto-create default grid
        grid = models.DeptDataGrid(
            department_id=dept_id,
            columns=json.dumps(["Item", "Target", "Achieved", "Remarks"]),
            rows=json.dumps([])
        )
        db.add(grid)
        db.commit()
        db.refresh(grid)
    return {
        "id": grid.id,
        "department_id": grid.department_id,
        "columns": json.loads(grid.columns),
        "rows": json.loads(grid.rows),
        "updated_at": grid.updated_at,
    }


@router.put("/{dept_id}/datagrid")
def update_datagrid(dept_id: int, data: DataGridUpdate, db: Session = Depends(get_db)):
    grid = db.query(models.DeptDataGrid).filter(
        models.DeptDataGrid.department_id == dept_id
    ).first()
    if not grid:
        grid = models.DeptDataGrid(
            department_id=dept_id,
            columns=json.dumps(data.columns or ["Item", "Target", "Achieved", "Remarks"]),
            rows=json.dumps(data.rows or [])
        )
        db.add(grid)
    else:
        if data.columns is not None:
            grid.columns = json.dumps(data.columns)
        if data.rows is not None:
            grid.rows = json.dumps(data.rows)
    db.commit()
    db.refresh(grid)
    return {
        "id": grid.id,
        "department_id": grid.department_id,
        "columns": json.loads(grid.columns),
        "rows": json.loads(grid.rows),
        "updated_at": grid.updated_at,
    }
