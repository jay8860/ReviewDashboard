"""
Real-time iCloud Calendar sync via CalDAV.

This module pushes Planner events directly into the user's iCloud calendar
using Apple's CalDAV endpoint (https://caldav.icloud.com/) authenticated with
an app-specific password. Once written, Apple's own push infrastructure
propagates the event to all the user's devices almost instantly -- this is
the same mechanism used when creating an event natively on one Apple device
and seeing it appear on another.

The whole feature is OPTIONAL: if the three env vars below are not set, every
public function here no-ops (logs and returns None/False/an error dict) so the
rest of the dashboard is completely unaffected. No function in this module may
raise -- all exceptions from the `caldav` library (or anything else) are
caught, logged, and converted into the documented return value.

Env vars:
    ICLOUD_APPLE_ID       -- Apple ID email address
    ICLOUD_APP_PASSWORD   -- app-specific password generated at appleid.apple.com
                             (NOT the real Apple ID password)
    ICLOUD_CALENDAR_NAME  -- calendar display name to sync into
                             (default: "Review Dashboard")
"""

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

import models

logger = logging.getLogger("icloud_caldav")

ICLOUD_CALDAV_URL = "https://caldav.icloud.com/"
DEFAULT_CALENDAR_NAME = "Review Dashboard"

# Process-local caches so we don't re-authenticate / re-discover on every call.
_client = None
_calendar = None


def _apple_id() -> str:
    return (os.getenv("ICLOUD_APPLE_ID") or "").strip()


def _app_password() -> str:
    return (os.getenv("ICLOUD_APP_PASSWORD") or "").strip()


def _calendar_name() -> str:
    return (os.getenv("ICLOUD_CALENDAR_NAME") or "").strip() or DEFAULT_CALENDAR_NAME


def is_configured() -> bool:
    """True only if both the Apple ID and app-specific password are set."""
    return bool(_apple_id() and _app_password())


def _reset_cache():
    global _client, _calendar
    _client = None
    _calendar = None


def get_client():
    """
    Build (or reuse) a caldav.DAVClient authenticated against iCloud via
    HTTP Basic Auth. Returns None (logged) if not configured or if the
    caldav library isn't importable, or on any connection error.
    """
    global _client
    if not is_configured():
        logger.info("icloud_caldav: not configured (ICLOUD_APPLE_ID / ICLOUD_APP_PASSWORD unset); skipping.")
        return None

    if _client is not None:
        return _client

    try:
        import caldav
    except Exception as exc:  # pragma: no cover - library missing
        logger.error("icloud_caldav: caldav library not available: %s", exc)
        return None

    try:
        _client = caldav.DAVClient(
            url=ICLOUD_CALDAV_URL,
            username=_apple_id(),
            password=_app_password(),
        )
        return _client
    except Exception as exc:
        logger.error("icloud_caldav: failed to build DAVClient (bad/expired app password?): %s", exc)
        _client = None
        return None


def get_or_create_calendar():
    """
    Discover the principal -> calendar-home-set -> named calendar, creating
    it on iCloud if it doesn't already exist. Cached per-process. Returns
    None (logged) on any failure.
    """
    global _calendar
    if _calendar is not None:
        return _calendar

    client = get_client()
    if client is None:
        return None

    target_name = _calendar_name()
    try:
        principal = client.principal()
        calendars = principal.calendars()
        for cal in calendars:
            try:
                name = cal.name
            except Exception:
                name = None
            if name == target_name:
                _calendar = cal
                return _calendar

        # Not found -- create it.
        _calendar = principal.make_calendar(name=target_name)
        logger.info("icloud_caldav: created new iCloud calendar '%s'", target_name)
        return _calendar
    except Exception as exc:
        logger.error("icloud_caldav: failed to discover/create calendar '%s': %s", target_name, exc)
        _calendar = None
        return None


def _normalize_time(value: Optional[str], fallback: str = "10:00") -> str:
    text = (value or "").strip()
    try:
        h, m = text.split(":")
        hi, mi = int(h), int(m)
        if 0 <= hi <= 23 and 0 <= mi <= 59:
            return f"{hi:02d}:{mi:02d}"
    except Exception:
        pass
    return fallback


def _event_window(event: "models.PlannerEvent") -> tuple[datetime, datetime]:
    """
    Same time-combining logic as planner.py's _build_event_ics_lines:
    combine event.date + event.time_slot (falling back to "10:00") with
    duration_minutes to get naive local start/end datetimes.
    """
    time_text = _normalize_time(event.time_slot, "10:00")
    hh, mm = time_text.split(":")
    start_dt = datetime(event.date.year, event.date.month, event.date.day, int(hh), int(mm))
    duration = max(15, int(event.duration_minutes or 30))
    end_dt = start_dt + timedelta(minutes=duration)
    return start_dt, end_dt


def _escape_ics_text(value: Optional[str]) -> str:
    text = str(value or "")
    text = text.replace("\\", "\\\\")
    text = text.replace(";", "\\;").replace(",", "\\,")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.replace("\n", "\\n")


def _build_vevent_ics(event: "models.PlannerEvent", uid: str, timezone_name: str) -> str:
    """Build a minimal standalone VCALENDAR/VEVENT block for this event."""
    start_dt, end_dt = _event_window(event)
    dtstamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    summary = _escape_ics_text(event.title or "Planner Event")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ReviewDashboard//iCloudSync//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{dtstamp}",
        f"DTSTART;TZID={timezone_name}:{start_dt.strftime('%Y%m%dT%H%M%S')}",
        f"DTEND;TZID={timezone_name}:{end_dt.strftime('%Y%m%dT%H%M%S')}",
        f"SUMMARY:{summary}",
    ]
    if event.description:
        lines.append(f"DESCRIPTION:{_escape_ics_text(event.description)}")
    if event.venue:
        lines.append(f"LOCATION:{_escape_ics_text(event.venue)}")
    lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _timezone_name() -> str:
    # Kept as a small indirection point in case we want to source this from
    # PlannerSettings in the future; default matches the dashboard's default.
    return os.getenv("ICLOUD_TIMEZONE") or "Asia/Kolkata"


def push_event(event: "models.PlannerEvent") -> Optional[str]:
    """
    Create a new VEVENT on the iCloud calendar for this planner event.
    Returns the iCloud event's UID on success, or None (logged) on any
    failure. Never raises.
    """
    if not is_configured():
        return None

    calendar = get_or_create_calendar()
    if calendar is None:
        return None

    uid = f"planner-event-{event.id}-{uuid.uuid4().hex[:8]}@reviewdashboard"
    ics_text = _build_vevent_ics(event, uid, _timezone_name())

    try:
        calendar.save_event(ics_text)
        logger.info("icloud_caldav: pushed planner event %s as iCloud uid=%s", event.id, uid)
        return uid
    except Exception as exc:
        logger.error("icloud_caldav: failed to push event %s to iCloud: %s", event.id, exc)
        return None


def _find_event_by_uid(icloud_uid: str):
    calendar = get_or_create_calendar()
    if calendar is None:
        return None
    try:
        return calendar.event_by_uid(icloud_uid)
    except Exception as exc:
        logger.info("icloud_caldav: event with uid=%s not found on iCloud (%s)", icloud_uid, exc)
        return None


def update_event(icloud_uid: str, event: "models.PlannerEvent") -> bool:
    """
    Find the existing iCloud event by UID and update it in place.
    Returns False (logged) on any failure, including "not found" -- the
    caller is responsible for falling back to push_event() to recreate it.
    Never raises.
    """
    if not is_configured():
        return False

    ical_event = _find_event_by_uid(icloud_uid)
    if ical_event is None:
        logger.info("icloud_caldav: update_event could not locate uid=%s", icloud_uid)
        return False

    try:
        ics_text = _build_vevent_ics(event, icloud_uid, _timezone_name())
        ical_event.data = ics_text
        ical_event.save()
        logger.info("icloud_caldav: updated iCloud event uid=%s", icloud_uid)
        return True
    except Exception as exc:
        logger.error("icloud_caldav: failed to update iCloud event uid=%s: %s", icloud_uid, exc)
        return False


def delete_event(icloud_uid: str) -> bool:
    """
    Delete the iCloud event by UID. Idempotent -- returns True even if the
    event is already gone. Returns False only on a genuine connection/auth
    error. Never raises.
    """
    if not is_configured():
        return True

    if not icloud_uid:
        return True

    ical_event = _find_event_by_uid(icloud_uid)
    if ical_event is None:
        # Already gone (or never existed) -- treat as success.
        return True

    try:
        ical_event.delete()
        logger.info("icloud_caldav: deleted iCloud event uid=%s", icloud_uid)
        return True
    except Exception as exc:
        # A 404-equivalent here is still success; only genuine connection/auth
        # errors should be treated as failure. We can't always distinguish
        # cleanly across caldav server implementations, so we log clearly and
        # report False only when we got this far but the delete call itself
        # raised (most commonly a real connection/auth problem, since a
        # "not found" was already handled above via _find_event_by_uid).
        logger.error("icloud_caldav: failed to delete iCloud event uid=%s: %s", icloud_uid, exc)
        return False


def test_connection() -> dict:
    """
    Attempt to connect and confirm the target calendar is reachable.
    Returns {"ok": bool, "detail": str}. `detail` never includes the
    password and is safe to return over an API response.
    """
    if not is_configured():
        return {"ok": False, "detail": "Not configured: set ICLOUD_APPLE_ID and ICLOUD_APP_PASSWORD."}

    client = get_client()
    if client is None:
        return {"ok": False, "detail": "Failed to authenticate with iCloud CalDAV (check Apple ID / app-specific password)."}

    try:
        principal = client.principal()
        calendars = principal.calendars()
        names = []
        for cal in calendars:
            try:
                names.append(cal.name)
            except Exception:
                continue
        target = _calendar_name()
        if target in names:
            return {
                "ok": True,
                "detail": f"Connected to iCloud CalDAV. Found target calendar '{target}' ({len(names)} calendar(s) total).",
            }
        return {
            "ok": True,
            "detail": (
                f"Connected to iCloud CalDAV, but calendar '{target}' does not exist yet "
                f"(will be created automatically on first sync). {len(names)} existing calendar(s) found."
            ),
        }
    except Exception as exc:
        return {"ok": False, "detail": f"Connected but failed to list calendars: {exc}"}
