from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import json
import os
import re
import uuid
from pathlib import Path

from database import get_db
import models
from services.document_ai import (
    SUPPORTED_EXTENSIONS,
    extract_text_from_document,
    analyze_with_gemini,
    generate_task_suggestions_with_gemini,
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


def _normalize_meeting_time_for_planner(value: Optional[str]) -> str:
    text = (value or "").strip()
    if re.fullmatch(r"\d{1,2}:\d{2}", text):
        h, m = text.split(":")
        hi = int(h)
        mi = int(m)
        if 0 <= hi <= 23 and 0 <= mi <= 59:
            return f"{hi:02d}:{mi:02d}"
    return "10:00"


def _planner_status_from_meeting_status(status: Optional[str]) -> str:
    val = (status or "").strip().lower()
    if val in {"cancelled", "canceled"}:
        return "Cancelled"
    return "Confirmed"


def _sync_planner_event_from_department_meeting(
    db: Session,
    meeting: models.DepartmentMeeting,
    department_name: Optional[str],
    department_color: Optional[str],
):
    event = db.query(models.PlannerEvent).filter(
        models.PlannerEvent.department_meeting_id == meeting.id
    ).first()

    title = f"{department_name or 'Department'} Meeting"
    payload = {
        "title": title,
        "date": meeting.scheduled_date,
        "time_slot": _normalize_meeting_time_for_planner(meeting.scheduled_time),
        "duration_minutes": 60,
        "event_type": "meeting",
        "status": _planner_status_from_meeting_status(meeting.status),
        "color": (department_color or "indigo"),
        "description": meeting.notes,
        "venue": meeting.venue,
        "attendees": meeting.attendees,
        "department_id": meeting.department_id,
        "department_meeting_id": meeting.id,
        "source": "department_meeting",
    }

    if event:
        if event.is_locked:
            return
        for key, value in payload.items():
            setattr(event, key, value)
        return

    db.add(models.PlannerEvent(**payload))


def _normalize_task_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (value or "").lower())).strip()


def _normalize_priority(value: Optional[str]) -> str:
    val = (value or "").strip().lower()
    if val in {"critical", "crit", "p0"}:
        return "Critical"
    if val in {"high", "p1"}:
        return "High"
    if val in {"low", "p3"}:
        return "Low"
    return "Normal"


def _normalize_department_priority(value: Optional[str]) -> str:
    val = (value or "").strip().lower()
    if val in {"critical", "crit", "p0"}:
        return "Critical"
    if val in {"high", "p1"}:
        return "High"
    if val in {"low", "p3"}:
        return "Low"
    return "Normal"


def _sanitize_category_name(value: Optional[str]) -> str:
    name = (value or "").strip()
    return name or "General"


def _task_to_dict(task: models.Task) -> dict:
    return {
        "id": task.id,
        "task_number": task.task_number,
        "description": task.description,
        "assigned_agency": task.assigned_agency,
        "allocated_date": str(task.allocated_date) if task.allocated_date else None,
        "time_given": task.time_given,
        "deadline_date": str(task.deadline_date) if task.deadline_date else None,
        "completion_date": task.completion_date,
        "status": task.status,
        "priority": task.priority,
        "is_pinned": task.is_pinned or False,
        "is_today": task.is_today or False,
        "steno_comment": task.steno_comment,
        "remarks": task.remarks,
        "department_id": task.department_id,
        "source": task.source,
        "assigned_employee_id": task.assigned_employee_id,
        "assigned_employee_name": task.assigned_employee.name if task.assigned_employee else None,
        "created_at": str(task.created_at) if task.created_at else None,
    }


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

    existing = db.query(models.Task).filter(models.Task.task_number.like(f"{prefix}-%")).all()
    used_nums = set()
    for item in existing:
        match = re.match(rf"^{re.escape(prefix)}-(\d+)$", item.task_number or "")
        if match:
            used_nums.add(int(match.group(1)))
    seq = 1
    while seq in used_nums and seq <= 999:
        seq += 1
    return f"{prefix}-{str(seq).zfill(3)}"


def _clip_text(parts: List[str], limit: int = 24000) -> str:
    out = []
    total = 0
    for part in parts:
        chunk = (part or "").strip()
        if not chunk:
            continue
        chunk_len = len(chunk)
        if total + chunk_len > limit:
            remaining = max(0, limit - total)
            if remaining > 0:
                out.append(chunk[:remaining])
            break
        out.append(chunk)
        total += chunk_len + 2
    return "\n\n".join(out)


def _annotate_duplicates(dept_id: int, suggestions: List[dict], db: Session) -> List[dict]:
    open_tasks = db.query(models.Task).filter(
        models.Task.department_id == dept_id,
        models.Task.status != "Completed"
    ).all()

    task_index = []
    for task in open_tasks:
        norm = _normalize_task_text(task.description or "")
        if not norm:
            continue
        task_index.append((task.id, norm, task.description or ""))

    enriched = []
    for suggestion in suggestions:
        desc = suggestion.get("description") or ""
        norm_desc = _normalize_task_text(desc)
        duplicate_id = None
        duplicate_reason = None

        if norm_desc:
            for task_id, norm_task, raw_task in task_index:
                if norm_desc == norm_task:
                    duplicate_id = task_id
                    duplicate_reason = f"Exact match with open task: {raw_task}"
                    break
                if len(norm_desc) >= 24 and (norm_desc in norm_task or norm_task in norm_desc):
                    duplicate_id = task_id
                    duplicate_reason = f"Potential overlap with open task: {raw_task}"
                    break

        enriched.append({
            **suggestion,
            "duplicate_of_task_id": duplicate_id,
            "duplicate_reason": duplicate_reason,
        })
    return enriched


def _build_document_task_source(doc: models.DocumentAttachment) -> str:
    chunks = [f"Document: {doc.original_filename}"]
    if doc.analysis_output:
        chunks.append("AI analysis output:\n" + doc.analysis_output[:18000])
    else:
        extracted = (doc.extracted_text or "").strip()
        if not extracted and doc.file_path and doc.file_extension:
            extracted, _ = extract_text_from_document(doc.file_path, doc.file_extension)
        chunks.append("Extracted content:\n" + (extracted or "")[:18000])
    return _clip_text(chunks, limit=22000)


def _build_meeting_task_source(meeting: models.DepartmentMeeting) -> str:
    chunks = []

    if meeting.notes:
        chunks.append("Meeting notes:\n" + meeting.notes[:12000])

    columns = _safe_json_list(meeting.action_table_columns, DEFAULT_MEETING_TABLE_COLUMNS)
    rows = _safe_json_list(meeting.action_table_rows, [])
    if rows:
        table_lines = []
        for row_idx, row in enumerate(rows, start=1):
            pairs = []
            for col_idx, col in enumerate(columns):
                value = row[col_idx] if col_idx < len(row) else ""
                if str(value).strip():
                    pairs.append(f"{col}: {value}")
            if pairs:
                table_lines.append(f"Row {row_idx}: " + " | ".join(pairs))
        if table_lines:
            chunks.append("Action table entries:\n" + "\n".join(table_lines[:160]))

    if not chunks:
        chunks.append("Meeting notes and action table are currently empty.")

    return _clip_text(chunks, limit=22000)


class DepartmentCreate(BaseModel):
    name: str
    short_name: Optional[str] = None
    description: Optional[str] = None
    category_name: Optional[str] = "General"
    category_order: Optional[int] = None
    display_order: Optional[int] = None
    priority_level: Optional[str] = "Normal"
    head_name: Optional[str] = None
    head_designation: Optional[str] = None
    color: Optional[str] = "indigo"
    icon: Optional[str] = "Building2"


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    description: Optional[str] = None
    category_name: Optional[str] = None
    category_order: Optional[int] = None
    display_order: Optional[int] = None
    priority_level: Optional[str] = None
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
    ).filter(models.Department.is_active == True).order_by(
        models.Department.category_order.asc(),
        models.Department.display_order.asc(),
        models.Department.created_at.asc()
    ).all()

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
            "category_name": dept.category_name or "General",
            "category_order": dept.category_order if dept.category_order is not None else 0,
            "display_order": dept.display_order if dept.display_order is not None else 0,
            "priority_level": _normalize_department_priority(dept.priority_level),
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
    category_name = _sanitize_category_name(data.category_name)

    if data.category_order is None:
        existing_category_order = db.query(func.min(models.Department.category_order)).filter(
            models.Department.category_name == category_name
        ).scalar()
        if existing_category_order is None:
            max_category_order = db.query(func.max(models.Department.category_order)).scalar()
            category_order = (max_category_order if max_category_order is not None else -1) + 1
        else:
            category_order = existing_category_order
    else:
        category_order = data.category_order

    if data.display_order is None:
        max_display_order = db.query(func.max(models.Department.display_order)).filter(
            models.Department.category_name == category_name
        ).scalar()
        display_order = (max_display_order if max_display_order is not None else -1) + 1
    else:
        display_order = data.display_order

    dept = models.Department(
        name=data.name,
        short_name=data.short_name,
        description=data.description,
        category_name=category_name,
        category_order=category_order,
        display_order=display_order,
        priority_level=_normalize_department_priority(data.priority_level),
        head_name=data.head_name,
        head_designation=data.head_designation,
        color=data.color,
        icon=data.icon,
    )
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
        "category_name": dept.category_name or "General",
        "category_order": dept.category_order if dept.category_order is not None else 0,
        "display_order": dept.display_order if dept.display_order is not None else 0,
        "priority_level": _normalize_department_priority(dept.priority_level),
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
    payload = data.dict(exclude_none=True)
    if "category_name" in payload:
        payload["category_name"] = _sanitize_category_name(payload.get("category_name"))
    if "priority_level" in payload:
        payload["priority_level"] = _normalize_department_priority(payload.get("priority_level"))
    for k, v in payload.items():
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


class AgendaPointBulkItem(BaseModel):
    id: int
    title: Optional[str] = None
    details: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None


class AgendaPointBulkUpdate(BaseModel):
    items: List[AgendaPointBulkItem]


class AgendaPointBulkDelete(BaseModel):
    ids: List[int]


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


@router.post("/{dept_id}/agenda/bulk-update")
def bulk_update_agenda_points(dept_id: int, data: AgendaPointBulkUpdate, db: Session = Depends(get_db)):
    items = data.items or []
    if not items:
        raise HTTPException(status_code=400, detail="No agenda items provided")

    ids = [item.id for item in items]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Duplicate agenda ids in payload")

    agenda_points = db.query(models.AgendaPoint).filter(
        models.AgendaPoint.department_id == dept_id,
        models.AgendaPoint.id.in_(ids)
    ).all()
    by_id = {ap.id: ap for ap in agenda_points}

    missing_ids = [ap_id for ap_id in ids if ap_id not in by_id]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Agenda point(s) not found: {missing_ids}")

    for item in items:
        ap = by_id[item.id]
        payload = item.dict(exclude_none=True, exclude={"id"})
        if "title" in payload:
            payload["title"] = (payload["title"] or "").strip()
            if not payload["title"]:
                raise HTTPException(status_code=400, detail=f"Title cannot be empty for agenda id {item.id}")
        if "details" in payload and payload["details"] is not None:
            payload["details"] = payload["details"].strip()
        for key, value in payload.items():
            setattr(ap, key, value)

    db.commit()
    return [by_id[item.id] for item in items]


@router.post("/{dept_id}/agenda/bulk-delete")
def bulk_delete_agenda_points(dept_id: int, data: AgendaPointBulkDelete, db: Session = Depends(get_db)):
    ids = data.ids or []
    if not ids:
        raise HTTPException(status_code=400, detail="No agenda ids provided")

    unique_ids = list(dict.fromkeys(ids))
    agenda_points = db.query(models.AgendaPoint).filter(
        models.AgendaPoint.department_id == dept_id,
        models.AgendaPoint.id.in_(unique_ids)
    ).all()
    found_ids = {ap.id for ap in agenda_points}
    missing_ids = [ap_id for ap_id in unique_ids if ap_id not in found_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Agenda point(s) not found: {missing_ids}")

    for ap in agenda_points:
        db.delete(ap)
    db.commit()
    return {"deleted_ids": unique_ids, "deleted_count": len(unique_ids)}


# ─── Department Meetings ───────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    scheduled_date: date
    scheduled_time: Optional[str] = None
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
    scheduled_time: Optional[str] = None
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
    ).order_by(models.DepartmentMeeting.scheduled_date.desc(), models.DepartmentMeeting.scheduled_time.desc()).all()

    result = []
    for m in meetings:
        snapshot = _safe_json_list(m.agenda_snapshot, [])
        table_columns = _safe_json_list(m.action_table_columns, DEFAULT_MEETING_TABLE_COLUMNS)
        table_rows = _safe_json_list(m.action_table_rows, [])
        result.append({
            "id": m.id,
            "department_id": m.department_id,
            "scheduled_date": str(m.scheduled_date),
            "scheduled_time": m.scheduled_time,
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
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

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
        scheduled_time=data.scheduled_time,
        venue=data.venue,
        attendees=data.attendees,
        notes=data.notes,
        officer_phone=data.officer_phone,
        agenda_snapshot=snapshot,
        action_table_columns=json.dumps(table_columns),
        action_table_rows=json.dumps(table_rows),
    )
    db.add(meeting)
    db.flush()
    _sync_planner_event_from_department_meeting(
        db,
        meeting,
        department_name=dept.name,
        department_color=dept.color,
    )
    db.commit()
    db.refresh(meeting)

    # Parse snapshot for response
    parsed_snapshot = _safe_json_list(snapshot, [])
    return {
        "id": meeting.id,
        "department_id": meeting.department_id,
        "scheduled_date": str(meeting.scheduled_date),
        "scheduled_time": meeting.scheduled_time,
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
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

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
    _sync_planner_event_from_department_meeting(
        db,
        meeting,
        department_name=dept.name,
        department_color=dept.color,
    )
    db.commit()
    db.refresh(meeting)
    return {
        "id": meeting.id,
        "department_id": meeting.department_id,
        "scheduled_date": str(meeting.scheduled_date),
        "scheduled_time": meeting.scheduled_time,
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
    linked_events = db.query(models.PlannerEvent).filter(
        models.PlannerEvent.department_meeting_id == meeting.id
    ).all()
    for event in linked_events:
        db.delete(event)
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


class TaskSuggestionGenerateRequest(BaseModel):
    focus_prompt: Optional[str] = None
    max_suggestions: Optional[int] = 12


class TaskSuggestionItem(BaseModel):
    description: str
    assigned_agency: Optional[str] = None
    deadline_date: Optional[date] = None
    priority: Optional[str] = "Normal"
    time_given: Optional[str] = None
    remarks: Optional[str] = None
    source_snippet: Optional[str] = None
    selected: Optional[bool] = True


class TaskSuggestionConfirmRequest(BaseModel):
    suggestions: List[TaskSuggestionItem]


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


@router.get("/{dept_id}/documents/{doc_id}")
def get_department_document(dept_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id.is_(None)
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
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


@router.post("/{dept_id}/documents/{doc_id}/task-suggestions")
def suggest_tasks_from_department_document(
    dept_id: int,
    doc_id: int,
    data: TaskSuggestionGenerateRequest,
    db: Session = Depends(get_db),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id.is_(None),
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        source_text = _build_document_task_source(doc)
        suggestions = generate_task_suggestions_with_gemini(
            source_name=f"Document: {doc.original_filename}",
            source_text=source_text,
            department_name=dept.name,
            focus_prompt=data.focus_prompt,
        )
        max_items = max(1, min(int(data.max_suggestions or 12), 25))
        suggestions = _annotate_duplicates(dept_id, suggestions[:max_items], db)
        return {
            "source_type": "document",
            "source_name": doc.original_filename,
            "suggestions": suggestions,
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Task suggestion generation failed: {exc}")


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


@router.get("/{dept_id}/meetings/{meeting_id}/documents/{doc_id}")
def get_meeting_document(dept_id: int, meeting_id: int, doc_id: int, db: Session = Depends(get_db)):
    _get_meeting_or_404(db, dept_id, meeting_id)
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id == meeting_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
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


@router.post("/{dept_id}/meetings/{meeting_id}/documents/{doc_id}/task-suggestions")
def suggest_tasks_from_meeting_document(
    dept_id: int,
    meeting_id: int,
    doc_id: int,
    data: TaskSuggestionGenerateRequest,
    db: Session = Depends(get_db),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    _get_meeting_or_404(db, dept_id, meeting_id)
    doc = db.query(models.DocumentAttachment).filter(
        models.DocumentAttachment.id == doc_id,
        models.DocumentAttachment.department_id == dept_id,
        models.DocumentAttachment.meeting_id == meeting_id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        source_text = _build_document_task_source(doc)
        suggestions = generate_task_suggestions_with_gemini(
            source_name=f"Meeting document: {doc.original_filename}",
            source_text=source_text,
            department_name=dept.name,
            focus_prompt=data.focus_prompt,
        )
        max_items = max(1, min(int(data.max_suggestions or 12), 25))
        suggestions = _annotate_duplicates(dept_id, suggestions[:max_items], db)
        return {
            "source_type": "meeting_document",
            "source_name": doc.original_filename,
            "suggestions": suggestions,
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Task suggestion generation failed: {exc}")


@router.post("/{dept_id}/meetings/{meeting_id}/task-suggestions")
def suggest_tasks_from_meeting_workspace(
    dept_id: int,
    meeting_id: int,
    data: TaskSuggestionGenerateRequest,
    db: Session = Depends(get_db),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    meeting = _get_meeting_or_404(db, dept_id, meeting_id)

    try:
        source_text = _build_meeting_task_source(meeting)
        suggestions = generate_task_suggestions_with_gemini(
            source_name=f"Meeting workspace ({meeting.scheduled_date})",
            source_text=source_text,
            department_name=dept.name,
            focus_prompt=data.focus_prompt,
        )
        max_items = max(1, min(int(data.max_suggestions or 12), 25))
        suggestions = _annotate_duplicates(dept_id, suggestions[:max_items], db)
        return {
            "source_type": "meeting",
            "source_name": f"{dept.name} meeting on {meeting.scheduled_date}",
            "suggestions": suggestions,
            "generated_at": datetime.utcnow().isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Task suggestion generation failed: {exc}")


@router.post("/{dept_id}/task-suggestions/confirm")
def confirm_task_suggestions(
    dept_id: int,
    data: TaskSuggestionConfirmRequest,
    db: Session = Depends(get_db),
):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    created = []
    skipped = []
    for idx, item in enumerate(data.suggestions):
        if item.selected is False:
            skipped.append({"index": idx, "reason": "Not selected"})
            continue
        description = (item.description or "").strip()
        if len(description) < 6:
            skipped.append({"index": idx, "reason": "Description too short"})
            continue

        task = models.Task(
            task_number=_generate_task_number(db, item.assigned_agency, dept_id),
            description=description,
            assigned_agency=(item.assigned_agency or None),
            allocated_date=date.today(),
            time_given=(item.time_given or None),
            deadline_date=item.deadline_date,
            status="Pending",
            priority=_normalize_priority(item.priority),
            remarks=(item.remarks or None),
            steno_comment=(item.source_snippet or None),
            department_id=dept_id,
            source="ai_suggestion",
        )
        db.add(task)
        db.flush()
        created.append(task)

    db.commit()
    for task in created:
        db.refresh(task)

    return {
        "created_count": len(created),
        "skipped_count": len(skipped),
        "created": [_task_to_dict(t) for t in created],
        "skipped": skipped,
    }
