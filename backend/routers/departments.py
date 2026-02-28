from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import json
import os
import uuid
from pathlib import Path

from database import get_db
import models
from services.document_ai import (
    SUPPORTED_EXTENSIONS,
    extract_text_from_document,
    analyze_with_gemini,
)

router = APIRouter()

DEFAULT_MEETING_TABLE_COLUMNS = ["Action Point", "Owner", "Timeline", "Status", "Remarks"]
MAX_DOC_UPLOAD_BYTES = int(os.getenv("MAX_DOC_UPLOAD_BYTES", str(25 * 1024 * 1024)))
UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads")


def _safe_json_list(value: Optional[str], fallback: list) -> list:
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else fallback
    except Exception:
        return fallback


def _serialize_attachment(doc: models.DocumentAttachment) -> dict:
    return {
        "id": doc.id,
        "department_id": doc.department_id,
        "meeting_id": doc.meeting_id,
        "scope": doc.scope,
        "original_filename": doc.original_filename,
        "stored_filename": doc.stored_filename,
        "mime_type": doc.mime_type,
        "file_extension": doc.file_extension,
        "file_size": doc.file_size,
        "extraction_truncated": bool(doc.extraction_truncated),
        "analysis_mode": doc.analysis_mode,
        "analysis_prompt": doc.analysis_prompt,
        "analysis_output": doc.analysis_output,
        "analysis_status": doc.analysis_status,
        "analysis_error": doc.analysis_error,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


def _validate_document_extension(filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext or 'unknown'}. Supported: {supported}")
    return ext


def _store_uploaded_document(file: UploadFile, dept_id: int, meeting_id: Optional[int] = None) -> tuple[str, str, int, str]:
    ext = _validate_document_extension(file.filename or "")
    scope_dir = os.path.join(UPLOAD_ROOT, f"department_{dept_id}", f"meeting_{meeting_id}" if meeting_id else "department")
    os.makedirs(scope_dir, exist_ok=True)

    stored_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(scope_dir, stored_filename)
    total_bytes = 0

    try:
        with open(file_path, "wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_DOC_UPLOAD_BYTES:
                    out.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail=f"File too large. Max allowed: {MAX_DOC_UPLOAD_BYTES // (1024 * 1024)} MB")
                out.write(chunk)
    finally:
        file.file.close()

    return file_path, stored_filename, total_bytes, ext


def _get_meeting_or_404(db: Session, dept_id: int, meeting_id: int) -> models.DepartmentMeeting:
    meeting = db.query(models.DepartmentMeeting).filter(
        models.DepartmentMeeting.id == meeting_id,
        models.DepartmentMeeting.department_id == dept_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


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
    action_table_columns: Optional[List[str]] = None
    action_table_rows: Optional[List[List[str]]] = None


class MeetingUpdate(BaseModel):
    scheduled_date: Optional[date] = None
    venue: Optional[str] = None
    attendees: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    officer_phone: Optional[str] = None
    action_table_columns: Optional[List[str]] = None
    action_table_rows: Optional[List[List[str]]] = None


@router.get("/{dept_id}/meetings")
def get_meetings(dept_id: int, db: Session = Depends(get_db)):
    meetings = db.query(models.DepartmentMeeting).filter(
        models.DepartmentMeeting.department_id == dept_id
    ).order_by(models.DepartmentMeeting.scheduled_date.desc()).all()

    result = []
    for m in meetings:
        snapshot = _safe_json_list(m.agenda_snapshot, [])
        table_columns = _safe_json_list(m.action_table_columns, DEFAULT_MEETING_TABLE_COLUMNS)
        table_rows = _safe_json_list(m.action_table_rows, [])
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
            "action_table_columns": table_columns,
            "action_table_rows": table_rows,
            "created_at": m.created_at,
            "updated_at": m.updated_at,
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

    table_columns = data.action_table_columns or DEFAULT_MEETING_TABLE_COLUMNS
    table_rows = data.action_table_rows or []

    meeting = models.DepartmentMeeting(
        department_id=dept_id,
        scheduled_date=data.scheduled_date,
        venue=data.venue,
        attendees=data.attendees,
        notes=data.notes,
        officer_phone=data.officer_phone,
        agenda_snapshot=snapshot,
        action_table_columns=json.dumps(table_columns),
        action_table_rows=json.dumps(table_rows),
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Parse snapshot for response
    parsed_snapshot = _safe_json_list(snapshot, [])
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
        "action_table_columns": _safe_json_list(meeting.action_table_columns, DEFAULT_MEETING_TABLE_COLUMNS),
        "action_table_rows": _safe_json_list(meeting.action_table_rows, []),
        "created_at": meeting.created_at,
        "updated_at": meeting.updated_at,
    }


@router.put("/{dept_id}/meetings/{meeting_id}")
def update_meeting(dept_id: int, meeting_id: int, data: MeetingUpdate, db: Session = Depends(get_db)):
    meeting = db.query(models.DepartmentMeeting).filter(
        models.DepartmentMeeting.id == meeting_id,
        models.DepartmentMeeting.department_id == dept_id
    ).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    payload = data.dict(exclude_none=True)
    if "action_table_columns" in payload:
        meeting.action_table_columns = json.dumps(payload.pop("action_table_columns") or DEFAULT_MEETING_TABLE_COLUMNS)
    if "action_table_rows" in payload:
        meeting.action_table_rows = json.dumps(payload.pop("action_table_rows") or [])
    for k, v in payload.items():
        setattr(meeting, k, v)
    db.commit()
    db.refresh(meeting)
    return {
        "id": meeting.id,
        "department_id": meeting.department_id,
        "scheduled_date": str(meeting.scheduled_date),
        "venue": meeting.venue,
        "attendees": meeting.attendees,
        "notes": meeting.notes,
        "status": meeting.status,
        "officer_phone": meeting.officer_phone,
        "agenda_snapshot": _safe_json_list(meeting.agenda_snapshot, []),
        "action_table_columns": _safe_json_list(meeting.action_table_columns, DEFAULT_MEETING_TABLE_COLUMNS),
        "action_table_rows": _safe_json_list(meeting.action_table_rows, []),
        "created_at": meeting.created_at,
        "updated_at": meeting.updated_at,
    }


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


# ─── Documents + AI Analysis ───────────────────────────────────────────────────

class DocumentAnalyzeRequest(BaseModel):
    mode: Optional[str] = "default"   # default | custom
    prompt: Optional[str] = None      # required for custom


@router.get("/{dept_id}/documents")
def list_department_documents(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    docs = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id.is_(None)
    ).order_by(models.DocumentAttachment.created_at.desc()).all()
    return [_serialize_attachment(d) for d in docs]


@router.post("/{dept_id}/documents")
def upload_department_document(dept_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    file_path, stored_filename, file_size, ext = _store_uploaded_document(file, dept_id=dept_id, meeting_id=None)
    doc = models.DocumentAttachment(
        department_id=dept_id,
        meeting_id=None,
        scope="department",
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        mime_type=file.content_type,
        file_extension=ext,
        file_size=file_size,
        analysis_status="Not Analyzed",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize_attachment(doc)


@router.post("/{dept_id}/documents/{doc_id}/analyze")
def analyze_department_document(dept_id: int, doc_id: int, data: DocumentAnalyzeRequest, db: Session = Depends(get_db)):
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id.is_(None)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.analysis_status = "Processing"
    doc.analysis_error = None
    db.commit()

    try:
        extracted_text, was_truncated = extract_text_from_document(doc.file_path, doc.file_extension or "")
        mode = (data.mode or "default").strip().lower()
        prompt = (data.prompt or "").strip() if data.prompt else None
        analysis = analyze_with_gemini(doc.original_filename, extracted_text, mode=mode, custom_prompt=prompt)

        doc.extracted_text = extracted_text
        doc.extraction_truncated = was_truncated
        doc.analysis_mode = mode
        doc.analysis_prompt = prompt if mode == "custom" else None
        doc.analysis_output = analysis
        doc.analysis_status = "Completed"
        doc.analysis_error = None
    except Exception as exc:
        doc.analysis_status = "Failed"
        doc.analysis_error = str(exc)
        db.commit()
        db.refresh(doc)
        raise HTTPException(status_code=500, detail=f"Document analysis failed: {exc}")

    db.commit()
    db.refresh(doc)
    return _serialize_attachment(doc)


@router.get("/{dept_id}/documents/{doc_id}/download")
def download_department_document(dept_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id.is_(None)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Stored file not found")
    return FileResponse(path=doc.file_path, filename=doc.original_filename, media_type=doc.mime_type or "application/octet-stream")


@router.delete("/{dept_id}/documents/{doc_id}")
def delete_department_document(dept_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id.is_(None)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"message": "Deleted"}


@router.get("/{dept_id}/meetings/{meeting_id}/documents")
def list_meeting_documents(dept_id: int, meeting_id: int, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, dept_id, meeting_id)
    docs = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id == meeting_id
    ).order_by(models.DocumentAttachment.created_at.desc()).all()
    return [_serialize_attachment(d) for d in docs]


@router.post("/{dept_id}/meetings/{meeting_id}/documents")
def upload_meeting_document(dept_id: int, meeting_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    _get_meeting_or_404(db, dept_id, meeting_id)
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is missing")

    file_path, stored_filename, file_size, ext = _store_uploaded_document(file, dept_id=dept_id, meeting_id=meeting_id)
    doc = models.DocumentAttachment(
        department_id=dept_id,
        meeting_id=meeting_id,
        scope="meeting",
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        mime_type=file.content_type,
        file_extension=ext,
        file_size=file_size,
        analysis_status="Not Analyzed",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize_attachment(doc)


@router.post("/{dept_id}/meetings/{meeting_id}/documents/{doc_id}/analyze")
def analyze_meeting_document(dept_id: int, meeting_id: int, doc_id: int, data: DocumentAnalyzeRequest, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, dept_id, meeting_id)
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id == meeting_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.analysis_status = "Processing"
    doc.analysis_error = None
    db.commit()

    try:
        extracted_text, was_truncated = extract_text_from_document(doc.file_path, doc.file_extension or "")
        mode = (data.mode or "default").strip().lower()
        prompt = (data.prompt or "").strip() if data.prompt else None
        analysis = analyze_with_gemini(doc.original_filename, extracted_text, mode=mode, custom_prompt=prompt)

        doc.extracted_text = extracted_text
        doc.extraction_truncated = was_truncated
        doc.analysis_mode = mode
        doc.analysis_prompt = prompt if mode == "custom" else None
        doc.analysis_output = analysis
        doc.analysis_status = "Completed"
        doc.analysis_error = None
    except Exception as exc:
        doc.analysis_status = "Failed"
        doc.analysis_error = str(exc)
        db.commit()
        db.refresh(doc)
        raise HTTPException(status_code=500, detail=f"Document analysis failed: {exc}")

    db.commit()
    db.refresh(doc)
    return _serialize_attachment(doc)


@router.get("/{dept_id}/meetings/{meeting_id}/documents/{doc_id}/download")
def download_meeting_document(dept_id: int, meeting_id: int, doc_id: int, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, dept_id, meeting_id)
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id == meeting_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Stored file not found")
    return FileResponse(path=doc.file_path, filename=doc.original_filename, media_type=doc.mime_type or "application/octet-stream")


@router.delete("/{dept_id}/meetings/{meeting_id}/documents/{doc_id}")
def delete_meeting_document(dept_id: int, meeting_id: int, doc_id: int, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, dept_id, meeting_id)
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id == meeting_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return {"message": "Deleted"}
