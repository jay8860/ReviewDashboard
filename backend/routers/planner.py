from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json
import re

from database import get_db
import models

router = APIRouter()

DEFAULT_RECURRING_BLOCKS = [
    {"name": "Filework Time", "days": [1, 2, 3, 4, 5], "start": "17:00", "end": "18:00", "color": "violet"},
]
VALID_STATUSES = {"Draft", "Confirmed", "Cancelled"}
VALID_EVENT_TYPES = {"meeting", "review", "task", "reminder", "field-visit", "other"}


class RecurringBlock(BaseModel):
    name: str
    days: List[int] = []
    start: str
    end: str
    color: Optional[str] = "violet"


class PlannerSettingsUpdate(BaseModel):
    slot_minutes: Optional[int] = None
    slot_gap_minutes: Optional[int] = None
    day_start: Optional[str] = None
    day_end: Optional[str] = None
    lunch_start: Optional[str] = None
    lunch_end: Optional[str] = None
    timezone: Optional[str] = None
    apple_ics_url: Optional[str] = None
    recurring_blocks: Optional[List[RecurringBlock]] = None


class EventCreate(BaseModel):
    title: str
    date: date
    time_slot: Optional[str] = None
    duration_minutes: Optional[int] = 30
    event_type: Optional[str] = "meeting"
    status: Optional[str] = "Draft"
    color: Optional[str] = "indigo"
    description: Optional[str] = None
    venue: Optional[str] = None
    attendees: Optional[str] = None
    department_id: Optional[int] = None
    department_meeting_id: Optional[int] = None
    review_session_id: Optional[int] = None
    source: Optional[str] = "manual"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[date] = None
    time_slot: Optional[str] = None
    duration_minutes: Optional[int] = None
    event_type: Optional[str] = None
    status: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    venue: Optional[str] = None
    attendees: Optional[str] = None
    department_id: Optional[int] = None
    department_meeting_id: Optional[int] = None
    source: Optional[str] = None


class IcsSyncRequest(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    ics_url: Optional[str] = None


def _safe_json_list(value: Optional[str], fallback: list) -> list:
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else fallback
    except Exception:
        return fallback


def _normalize_status(value: Optional[str]) -> str:
    val = (value or "").strip().lower()
    if val in {"confirmed", "confirm", "done"}:
        return "Confirmed"
    if val in {"cancelled", "canceled"}:
        return "Cancelled"
    return "Draft"


def _normalize_event_type(value: Optional[str]) -> str:
    val = (value or "meeting").strip().lower()
    return val if val in VALID_EVENT_TYPES else "other"


def _normalize_time(value: Optional[str], fallback: str = "10:00") -> str:
    text = (value or "").strip()
    if re.fullmatch(r"\d{2}:\d{2}", text):
        h, m = text.split(":")
        hi = int(h)
        mi = int(m)
        if 0 <= hi <= 23 and 0 <= mi <= 59:
            return f"{hi:02d}:{mi:02d}"
    return fallback


def _get_or_create_settings(db: Session) -> models.PlannerSettings:
    settings = db.query(models.PlannerSettings).first()
    if settings:
        changed = False
        if not settings.recurring_blocks:
            settings.recurring_blocks = json.dumps(DEFAULT_RECURRING_BLOCKS)
            changed = True
        if settings.slot_minutes is None:
            settings.slot_minutes = 30
            changed = True
        if settings.slot_gap_minutes is None:
            settings.slot_gap_minutes = 15
            changed = True
        if not settings.day_start:
            settings.day_start = "10:00"
            changed = True
        if not settings.day_end:
            settings.day_end = "18:00"
            changed = True
        if not settings.lunch_start:
            settings.lunch_start = "13:30"
            changed = True
        if not settings.lunch_end:
            settings.lunch_end = "14:30"
            changed = True
        if changed:
            db.commit()
            db.refresh(settings)
        return settings

    settings = models.PlannerSettings(
        slot_minutes=30,
        slot_gap_minutes=15,
        day_start="10:00",
        day_end="18:00",
        lunch_start="13:30",
        lunch_end="14:30",
        timezone="Asia/Kolkata",
        recurring_blocks=json.dumps(DEFAULT_RECURRING_BLOCKS),
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _serialize_settings(settings: models.PlannerSettings) -> dict:
    return {
        "id": settings.id,
        "slot_minutes": settings.slot_minutes or 30,
        "slot_gap_minutes": settings.slot_gap_minutes if settings.slot_gap_minutes is not None else 15,
        "day_start": settings.day_start or "10:00",
        "day_end": settings.day_end or "18:00",
        "lunch_start": settings.lunch_start or "13:30",
        "lunch_end": settings.lunch_end or "14:30",
        "timezone": settings.timezone or "Asia/Kolkata",
        "apple_ics_url": settings.apple_ics_url,
        "recurring_blocks": _safe_json_list(settings.recurring_blocks, DEFAULT_RECURRING_BLOCKS),
        "last_ics_sync_at": settings.last_ics_sync_at.isoformat() if settings.last_ics_sync_at else None,
    }


def _serialize_event(event: models.PlannerEvent, dept_name: Optional[str] = None) -> dict:
    return {
        "id": event.id,
        "title": event.title,
        "date": str(event.date),
        "time_slot": event.time_slot,
        "duration_minutes": event.duration_minutes,
        "event_type": event.event_type,
        "status": _normalize_status(event.status),
        "color": event.color,
        "description": event.description,
        "venue": event.venue,
        "attendees": event.attendees,
        "department_id": event.department_id,
        "department_name": dept_name,
        "department_meeting_id": event.department_meeting_id,
        "review_session_id": event.review_session_id,
        "source": event.source,
        "external_uid": event.external_uid,
        "external_calendar": event.external_calendar,
        "is_locked": bool(event.is_locked),
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "updated_at": event.updated_at.isoformat() if event.updated_at else None,
    }


def _build_agenda_snapshot(db: Session, department_id: int) -> str:
    open_points = db.query(models.AgendaPoint).filter(
        models.AgendaPoint.department_id == department_id,
        models.AgendaPoint.status == "Open"
    ).order_by(models.AgendaPoint.order_index).all()
    return json.dumps([{"title": ap.title, "details": ap.details} for ap in open_points])


def _sync_department_meeting_from_event(event: models.PlannerEvent, db: Session):
    is_meeting = _normalize_event_type(event.event_type) == "meeting"
    planner_status = _normalize_status(event.status)
    if not (is_meeting and event.department_id):
        return

    meeting = None
    if event.department_meeting_id:
        meeting = db.query(models.DepartmentMeeting).filter(
            models.DepartmentMeeting.id == event.department_meeting_id,
            models.DepartmentMeeting.department_id == event.department_id
        ).first()
        if not meeting:
            event.department_meeting_id = None

    if not meeting:
        meeting = models.DepartmentMeeting(
            department_id=event.department_id,
            scheduled_date=event.date,
            scheduled_time=event.time_slot,
            venue=event.venue,
            attendees=event.attendees,
            notes=event.description,
            status="Cancelled" if planner_status == "Cancelled" else "Scheduled",
            agenda_snapshot=_build_agenda_snapshot(db, event.department_id),
            action_table_columns='["Action Point","Owner","Timeline","Status","Remarks"]',
            action_table_rows="[]",
        )
        db.add(meeting)
        db.flush()
        event.department_meeting_id = meeting.id
    else:
        meeting.scheduled_date = event.date
        meeting.scheduled_time = event.time_slot
        meeting.venue = event.venue
        meeting.attendees = event.attendees
        if event.description and not meeting.notes:
            meeting.notes = event.description
        if planner_status == "Cancelled":
            meeting.status = "Cancelled"
        elif meeting.status != "Done":
            meeting.status = "Scheduled"

    if (event.source or "") != "external_calendar":
        event.source = "department_meeting"


def _unfold_ics_lines(raw_text: str) -> List[str]:
    lines = raw_text.splitlines()
    unfolded: List[str] = []
    for line in lines:
        if not unfolded:
            unfolded.append(line.rstrip("\r"))
            continue
        if line.startswith(" ") or line.startswith("\t"):
            unfolded[-1] += line[1:].rstrip("\r")
        else:
            unfolded.append(line.rstrip("\r"))
    return unfolded


def _parse_ics_dt(value: str) -> Optional[datetime]:
    text = (value or "").strip()
    if not text:
        return None
    try:
        if re.fullmatch(r"\d{8}$", text):
            return datetime.strptime(text, "%Y%m%d")
        if text.endswith("Z"):
            return datetime.strptime(text, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).astimezone().replace(tzinfo=None)
        if re.fullmatch(r"\d{8}T\d{6}$", text):
            return datetime.strptime(text, "%Y%m%dT%H%M%S")
        if re.fullmatch(r"\d{8}T\d{4}$", text):
            return datetime.strptime(text, "%Y%m%dT%H%M")
    except Exception:
        return None
    return None


def _fetch_ics_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "GovernanceDashboard/1.0"})
    with urlopen(request, timeout=20) as resp:
        raw = resp.read()
    for enc in ("utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", errors="ignore")


def _parse_ics_events(raw_text: str, start_date: date, end_date: date, default_day_start: str) -> List[dict]:
    lines = _unfold_ics_lines(raw_text)
    in_event = False
    current: dict = {}
    parsed: List[dict] = []

    for line in lines:
        if line == "BEGIN:VEVENT":
            in_event = True
            current = {}
            continue
        if line == "END:VEVENT":
            in_event = False
            uid = (current.get("UID") or "").strip() or f"event-{len(parsed) + 1}"
            summary = (current.get("SUMMARY") or "").strip() or "Busy"
            description = (current.get("DESCRIPTION") or "").replace("\\n", "\n").strip() or None
            location = (current.get("LOCATION") or "").strip() or None

            dt_start = _parse_ics_dt(current.get("DTSTART") or "")
            dt_end = _parse_ics_dt(current.get("DTEND") or "")
            if not dt_start:
                continue
            if not dt_end:
                dt_end = dt_start + timedelta(minutes=30)

            event_date = dt_start.date()
            if event_date < start_date or event_date > end_date:
                continue

            time_slot = dt_start.strftime("%H:%M") if dt_start.time() != datetime.min.time() else default_day_start
            duration = max(30, int((dt_end - dt_start).total_seconds() // 60 or 30))
            occurrence_uid = f"{uid}::{dt_start.isoformat()}"

            parsed.append({
                "title": summary,
                "date": event_date,
                "time_slot": time_slot,
                "duration_minutes": duration,
                "event_type": "other",
                "status": "Confirmed",
                "color": "sky",
                "description": description,
                "venue": location,
                "attendees": None,
                "source": "external_calendar",
                "external_uid": occurrence_uid,
                "external_calendar": "Apple Calendar",
                "is_locked": True,
            })
            current = {}
            continue

        if not in_event or ":" not in line:
            continue

        key_part, value = line.split(":", 1)
        prop_name = key_part.split(";", 1)[0].upper()
        if prop_name in {"UID", "SUMMARY", "DESCRIPTION", "DTSTART", "DTEND", "LOCATION"}:
            current[prop_name] = value

    return parsed


@router.get("/settings")
def get_planner_settings(db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    return _serialize_settings(settings)


@router.put("/settings")
def update_planner_settings(data: PlannerSettingsUpdate, db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    payload = data.dict(exclude_none=True)

    if "slot_minutes" in payload:
        payload["slot_minutes"] = max(15, int(payload["slot_minutes"]))
    if "slot_gap_minutes" in payload:
        payload["slot_gap_minutes"] = max(0, int(payload["slot_gap_minutes"]))
    if "day_start" in payload:
        payload["day_start"] = _normalize_time(payload["day_start"], "10:00")
    if "day_end" in payload:
        payload["day_end"] = _normalize_time(payload["day_end"], "18:00")
    if "lunch_start" in payload:
        payload["lunch_start"] = _normalize_time(payload["lunch_start"], "13:30")
    if "lunch_end" in payload:
        payload["lunch_end"] = _normalize_time(payload["lunch_end"], "14:30")
    if "recurring_blocks" in payload:
        payload["recurring_blocks"] = json.dumps(payload["recurring_blocks"] or DEFAULT_RECURRING_BLOCKS)

    for k, v in payload.items():
        setattr(settings, k, v)
    db.commit()
    db.refresh(settings)
    return _serialize_settings(settings)


@router.post("/sync-ics")
def sync_ics_events(data: IcsSyncRequest, db: Session = Depends(get_db)):
    settings = _get_or_create_settings(db)
    ics_url = (data.ics_url or settings.apple_ics_url or "").strip()
    if not ics_url:
        raise HTTPException(status_code=400, detail="Apple ICS URL is not configured")

    start = data.start_date or date.today()
    end = data.end_date or (start + timedelta(days=21))
    if end < start:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")

    try:
        raw_ics = _fetch_ics_text(ics_url)
    except HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"ICS fetch failed: HTTP {exc.code}") from exc
    except URLError as exc:
        raise HTTPException(status_code=400, detail=f"ICS fetch failed: {exc.reason}") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ICS fetch failed: {str(exc)}") from exc

    incoming = _parse_ics_events(raw_ics, start, end, settings.day_start or "10:00")
    existing = db.query(models.PlannerEvent).filter(
        models.PlannerEvent.source == "external_calendar",
        models.PlannerEvent.date >= start,
        models.PlannerEvent.date <= end
    ).all()
    by_uid = {row.external_uid: row for row in existing if row.external_uid}
    seen_uids = set()
    created = 0
    updated = 0

    for item in incoming:
        uid = item["external_uid"]
        seen_uids.add(uid)
        row = by_uid.get(uid)
        if row:
            row.title = item["title"]
            row.date = item["date"]
            row.time_slot = item["time_slot"]
            row.duration_minutes = item["duration_minutes"]
            row.event_type = item["event_type"]
            row.status = item["status"]
            row.color = item["color"]
            row.description = item["description"]
            row.venue = item["venue"]
            row.attendees = item["attendees"]
            row.external_calendar = item["external_calendar"]
            row.is_locked = True
            updated += 1
            continue

        db.add(models.PlannerEvent(**item))
        created += 1

    deleted = 0
    for row in existing:
        if row.external_uid and row.external_uid not in seen_uids:
            db.delete(row)
            deleted += 1

    if data.ics_url and data.ics_url != settings.apple_ics_url:
        settings.apple_ics_url = data.ics_url
    settings.last_ics_sync_at = datetime.utcnow()

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "deleted": deleted,
        "in_range": len(incoming),
        "start_date": str(start),
        "end_date": str(end),
    }


@router.get("/")
def get_events(start_date: Optional[date] = None, end_date: Optional[date] = None, db: Session = Depends(get_db)):
    q = db.query(models.PlannerEvent)
    if start_date:
        q = q.filter(models.PlannerEvent.date >= start_date)
    if end_date:
        q = q.filter(models.PlannerEvent.date <= end_date)
    rows = q.order_by(models.PlannerEvent.date, models.PlannerEvent.time_slot, models.PlannerEvent.created_at).all()

    dept_ids = sorted({row.department_id for row in rows if row.department_id})
    dept_names = {}
    if dept_ids:
        depts = db.query(models.Department).filter(models.Department.id.in_(dept_ids)).all()
        dept_names = {d.id: d.name for d in depts}

    return [_serialize_event(row, dept_names.get(row.department_id)) for row in rows]


@router.post("/")
def create_event(data: EventCreate, db: Session = Depends(get_db)):
    payload = data.dict()
    payload["event_type"] = _normalize_event_type(payload.get("event_type"))
    payload["status"] = _normalize_status(payload.get("status"))
    payload["time_slot"] = _normalize_time(payload.get("time_slot"), "10:00")
    payload["duration_minutes"] = max(15, int(payload.get("duration_minutes") or 30))

    event = models.PlannerEvent(**payload)
    db.add(event)
    db.flush()
    _sync_department_meeting_from_event(event, db)
    db.commit()
    db.refresh(event)
    dept_name = None
    if event.department_id:
        dept = db.query(models.Department).filter(models.Department.id == event.department_id).first()
        dept_name = dept.name if dept else None
    return _serialize_event(event, dept_name)


@router.put("/{event_id}")
def update_event(event_id: int, data: EventUpdate, db: Session = Depends(get_db)):
    event = db.query(models.PlannerEvent).filter(models.PlannerEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.is_locked:
        raise HTTPException(status_code=400, detail="External calendar events are read-only")

    payload = data.dict(exclude_unset=True)
    if "event_type" in payload and payload["event_type"] is not None:
        payload["event_type"] = _normalize_event_type(payload["event_type"])
    if "status" in payload and payload["status"] is not None:
        payload["status"] = _normalize_status(payload["status"])
    if "time_slot" in payload and payload["time_slot"] is not None:
        payload["time_slot"] = _normalize_time(payload["time_slot"], event.time_slot or "10:00")
    if "duration_minutes" in payload and payload["duration_minutes"] is not None:
        payload["duration_minutes"] = max(15, int(payload["duration_minutes"]))

    for k, v in payload.items():
        setattr(event, k, v)

    if (_normalize_event_type(event.event_type) != "meeting" or not event.department_id) and event.department_meeting_id:
        event.department_meeting_id = None

    _sync_department_meeting_from_event(event, db)
    db.commit()
    db.refresh(event)

    dept_name = None
    if event.department_id:
        dept = db.query(models.Department).filter(models.Department.id == event.department_id).first()
        dept_name = dept.name if dept else None
    return _serialize_event(event, dept_name)


@router.delete("/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.PlannerEvent).filter(models.PlannerEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.is_locked:
        raise HTTPException(status_code=400, detail="External calendar events are read-only")

    if event.department_meeting_id:
        linked = db.query(models.DepartmentMeeting).filter(
            models.DepartmentMeeting.id == event.department_meeting_id
        ).first()
        if linked:
            db.delete(linked)

    db.delete(event)
    db.commit()
    return {"message": "Deleted"}
