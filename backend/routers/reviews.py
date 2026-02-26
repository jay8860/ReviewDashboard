from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from database import get_db
import models

router = APIRouter()


# ─── Programs ─────────────────────────────────────────────────────────────────

class ProgramCreate(BaseModel):
    department_id: int
    name: str
    description: Optional[str] = None
    review_frequency_days: Optional[int] = 15


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    review_frequency_days: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/programs")
def get_programs(department_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.ReviewProgram)
    if department_id:
        q = q.filter(models.ReviewProgram.department_id == department_id)
    return q.filter(models.ReviewProgram.is_active == True).all()


@router.post("/programs")
def create_program(data: ProgramCreate, db: Session = Depends(get_db)):
    prog = models.ReviewProgram(**data.dict())
    db.add(prog)
    db.commit()
    db.refresh(prog)
    return prog


@router.put("/programs/{prog_id}")
def update_program(prog_id: int, data: ProgramUpdate, db: Session = Depends(get_db)):
    prog = db.query(models.ReviewProgram).filter(models.ReviewProgram.id == prog_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(prog, k, v)
    db.commit()
    db.refresh(prog)
    return prog


@router.delete("/programs/{prog_id}")
def delete_program(prog_id: int, db: Session = Depends(get_db)):
    prog = db.query(models.ReviewProgram).filter(models.ReviewProgram.id == prog_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    db.delete(prog)
    db.commit()
    return {"message": "Deleted"}


# ─── Sessions ─────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    program_id: int
    scheduled_date: date
    venue: Optional[str] = None
    attendees: Optional[str] = None
    notes: Optional[str] = None


class SessionUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    actual_date: Optional[date] = None
    status: Optional[str] = None
    venue: Optional[str] = None
    attendees: Optional[str] = None
    notes: Optional[str] = None
    summary: Optional[str] = None


@router.get("/sessions")
def get_sessions(program_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(models.ReviewSession).options(
        joinedload(models.ReviewSession.action_points),
        joinedload(models.ReviewSession.program).joinedload(models.ReviewProgram.department)
    )
    if program_id:
        q = q.filter(models.ReviewSession.program_id == program_id)
    sessions = q.order_by(models.ReviewSession.scheduled_date.desc()).all()
    result = []
    for s in sessions:
        result.append({
            "id": s.id,
            "program_id": s.program_id,
            "program_name": s.program.name if s.program else None,
            "department_name": s.program.department.name if s.program and s.program.department else None,
            "department_color": s.program.department.color if s.program and s.program.department else "indigo",
            "scheduled_date": str(s.scheduled_date),
            "actual_date": str(s.actual_date) if s.actual_date else None,
            "status": s.status,
            "venue": s.venue,
            "attendees": s.attendees,
            "notes": s.notes,
            "summary": s.summary,
            "action_points_count": len(s.action_points),
            "open_action_points": len([a for a in s.action_points if a.status == "Open"]),
            "created_at": str(s.created_at)
        })
    return result


@router.post("/sessions")
def create_session(data: SessionCreate, db: Session = Depends(get_db)):
    session = models.ReviewSession(**data.dict())
    db.add(session)
    db.commit()
    db.refresh(session)
    # Auto-create checklist responses from templates
    program = db.query(models.ReviewProgram).filter(models.ReviewProgram.id == data.program_id).first()
    if program:
        for tmpl in program.checklist_templates:
            if tmpl.is_active:
                resp = models.ChecklistResponse(
                    session_id=session.id,
                    template_id=tmpl.id,
                    is_checked=False
                )
                db.add(resp)
        db.commit()
    return session


@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.ReviewSession).options(
        joinedload(models.ReviewSession.action_points),
        joinedload(models.ReviewSession.checklist_responses).joinedload(models.ChecklistResponse.template_item),
        joinedload(models.ReviewSession.program).joinedload(models.ReviewProgram.department)
    ).filter(models.ReviewSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    checklist = []
    for resp in sorted(s.checklist_responses, key=lambda r: r.template_item.order_index if r.template_item else 0):
        checklist.append({
            "id": resp.id,
            "template_id": resp.template_id,
            "title": resp.template_item.title if resp.template_item else "",
            "description": resp.template_item.description if resp.template_item else "",
            "is_checked": resp.is_checked,
            "remarks": resp.remarks
        })

    action_points = []
    for ap in s.action_points:
        action_points.append({
            "id": ap.id,
            "description": ap.description,
            "assigned_to": ap.assigned_to,
            "due_date": str(ap.due_date) if ap.due_date else None,
            "status": ap.status,
            "priority": ap.priority,
            "linked_task_id": ap.linked_task_id,
            "remarks": ap.remarks
        })

    return {
        "id": s.id,
        "program_id": s.program_id,
        "program_name": s.program.name if s.program else None,
        "department_id": s.program.department_id if s.program else None,
        "department_name": s.program.department.name if s.program and s.program.department else None,
        "department_color": s.program.department.color if s.program and s.program.department else "indigo",
        "scheduled_date": str(s.scheduled_date),
        "actual_date": str(s.actual_date) if s.actual_date else None,
        "status": s.status,
        "venue": s.venue,
        "attendees": s.attendees,
        "notes": s.notes,
        "summary": s.summary,
        "checklist": checklist,
        "action_points": action_points,
        "created_at": str(s.created_at)
    }


@router.put("/sessions/{session_id}")
def update_session(session_id: int, data: SessionUpdate, db: Session = Depends(get_db)):
    s = db.query(models.ReviewSession).filter(models.ReviewSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    s = db.query(models.ReviewSession).filter(models.ReviewSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()
    return {"message": "Deleted"}


# ─── Action Points ────────────────────────────────────────────────────────────

class ActionPointCreate(BaseModel):
    session_id: int
    description: str
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    priority: Optional[str] = "Normal"
    remarks: Optional[str] = None


class ActionPointUpdate(BaseModel):
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    linked_task_id: Optional[int] = None
    remarks: Optional[str] = None


@router.post("/action-points")
def create_action_point(data: ActionPointCreate, db: Session = Depends(get_db)):
    ap = models.ActionPoint(**data.dict())
    db.add(ap)
    db.commit()
    db.refresh(ap)
    return ap


@router.put("/action-points/{ap_id}")
def update_action_point(ap_id: int, data: ActionPointUpdate, db: Session = Depends(get_db)):
    ap = db.query(models.ActionPoint).filter(models.ActionPoint.id == ap_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Action point not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(ap, k, v)
    db.commit()
    db.refresh(ap)
    return ap


@router.post("/action-points/{ap_id}/create-task")
def create_task_from_action_point(ap_id: int, db: Session = Depends(get_db)):
    """One-click: convert an action point into a Task."""
    ap = db.query(models.ActionPoint).options(
        joinedload(models.ActionPoint.session).joinedload(models.ReviewSession.program).joinedload(models.ReviewProgram.department)
    ).filter(models.ActionPoint.id == ap_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Action point not found")
    if ap.linked_task_id:
        raise HTTPException(status_code=400, detail="Task already created for this action point")

    dept_id = ap.session.program.department_id if ap.session and ap.session.program else None
    task = models.Task(
        task_number=f"AP-{ap_id}-{int(datetime.utcnow().timestamp())}",
        description=ap.description,
        assigned_agency=ap.assigned_to,
        deadline_date=ap.due_date,
        priority=ap.priority,
        status="Pending",
        department_id=dept_id,
        source="action_point"
    )
    db.add(task)
    db.flush()
    ap.linked_task_id = task.id
    ap.status = "In Progress"
    db.commit()
    db.refresh(task)
    return {"task_id": task.id, "task_number": task.task_number, "message": "Task created successfully"}


@router.delete("/action-points/{ap_id}")
def delete_action_point(ap_id: int, db: Session = Depends(get_db)):
    ap = db.query(models.ActionPoint).filter(models.ActionPoint.id == ap_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Action point not found")
    db.delete(ap)
    db.commit()
    return {"message": "Deleted"}


# ─── Checklist ────────────────────────────────────────────────────────────────

class ChecklistTemplateCreate(BaseModel):
    program_id: int
    title: str
    description: Optional[str] = None
    order_index: Optional[int] = 0


class ChecklistResponseUpdate(BaseModel):
    is_checked: bool
    remarks: Optional[str] = None


@router.get("/checklist-templates/{program_id}")
def get_checklist_templates(program_id: int, db: Session = Depends(get_db)):
    return db.query(models.ChecklistTemplate).filter(
        models.ChecklistTemplate.program_id == program_id,
        models.ChecklistTemplate.is_active == True
    ).order_by(models.ChecklistTemplate.order_index).all()


@router.post("/checklist-templates")
def create_checklist_template(data: ChecklistTemplateCreate, db: Session = Depends(get_db)):
    tmpl = models.ChecklistTemplate(**data.dict())
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


@router.delete("/checklist-templates/{tmpl_id}")
def delete_checklist_template(tmpl_id: int, db: Session = Depends(get_db)):
    tmpl = db.query(models.ChecklistTemplate).filter(models.ChecklistTemplate.id == tmpl_id).first()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(tmpl)
    db.commit()
    return {"message": "Deleted"}


@router.put("/checklist-responses/{resp_id}")
def update_checklist_response(resp_id: int, data: ChecklistResponseUpdate, db: Session = Depends(get_db)):
    resp = db.query(models.ChecklistResponse).filter(models.ChecklistResponse.id == resp_id).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    resp.is_checked = data.is_checked
    resp.remarks = data.remarks
    db.commit()
    db.refresh(resp)
    return resp
