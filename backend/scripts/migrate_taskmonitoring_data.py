#!/usr/bin/env python3
"""
Migrate employees and tasks from the legacy Task Monitoring Dashboard
to the current ReviewDashboard instance.

Default source:
  https://taskmonitoringdashboard-production.up.railway.app
Default target:
  https://reviewdashboard-production.up.railway.app
"""

import argparse
import json
import re
import ssl
import sys
from datetime import date
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_SOURCE = "https://taskmonitoringdashboard-production.up.railway.app"
DEFAULT_TARGET = "https://reviewdashboard-production.up.railway.app"
SSL_CONTEXT: Optional[ssl.SSLContext] = None


def http_json(method: str, url: str, payload: Optional[Dict[str, Any]] = None, timeout: int = 60) -> Any:
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = Request(url=url, data=body, method=method.upper(), headers=headers)
    try:
        with urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{method} {url} failed: {exc.code} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {url} failed: {exc}") from exc


def normalize_mobile(value: Any) -> str:
    digits = re.sub(r"\D+", "", str(value or ""))
    if not digits:
        return ""
    if len(digits) == 10:
        return f"91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"91{digits[-10:]}"
    return digits


def normalize_label(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def clean_display_username(value: Any) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s\-\.]", "", text)
    return text[:60].strip() or "user"


def normalize_date_str(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    if not text or text.lower() in {"none", "null", "-", "na", "n/a"}:
        return None
    text = text[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return text
    return None


def normalize_status(status: Any, completion_date: Any) -> str:
    raw = str(status or "").strip().lower()
    if completion_date and str(completion_date).strip():
        return "Completed"
    if raw in {"completed", "done", "close", "closed"}:
        return "Completed"
    if raw in {"in progress", "in-progress", "progress"}:
        return "In Progress"
    if raw in {"overdue"}:
        return "Overdue"
    if raw in {"pending"}:
        return "Pending"
    return "Pending"


def normalize_priority(priority: Any) -> str:
    raw = str(priority or "").strip().lower()
    if raw == "critical":
        return "Critical"
    if raw == "high":
        return "High"
    if raw == "low":
        return "Low"
    return "Normal"


def as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "y"}


def task_fingerprint(task: Dict[str, Any]) -> str:
    parts = [
        str(task.get("description") or "").strip().lower(),
        str(task.get("steno_comment") or "").strip().lower(),
        str(task.get("assigned_agency") or "").strip().lower(),
        str(task.get("allocated_date") or "").strip(),
        str(task.get("deadline_date") or "").strip(),
        str(task.get("status") or "").strip().lower(),
    ]
    return "|".join(parts)


def unique_task_number(base: str, used: Set[str]) -> str:
    candidate = (base or "").strip() or "MIG"
    candidate = re.sub(r"\s+", " ", candidate)
    if candidate not in used:
        used.add(candidate)
        return candidate

    idx = 1
    while True:
        next_candidate = f"{candidate}-MIG{idx}"
        if next_candidate not in used:
            used.add(next_candidate)
            return next_candidate
        idx += 1


def unique_display_username(base: str, used_lower: Set[str]) -> str:
    candidate = clean_display_username(base)
    if candidate.lower() not in used_lower:
        used_lower.add(candidate.lower())
        return candidate

    idx = 1
    while True:
        next_candidate = f"{candidate}-{idx}"
        if next_candidate.lower() not in used_lower:
            used_lower.add(next_candidate.lower())
            return next_candidate
        idx += 1


def build_employee_lookup(target_employees: List[Dict[str, Any]]) -> Dict[str, int]:
    lookup: Dict[str, int] = {}
    for emp in target_employees:
        emp_id = emp.get("id")
        if not emp_id:
            continue
        for key in (emp.get("display_username"), emp.get("name")):
            label = normalize_label(key)
            if label:
                lookup[label] = emp_id
    return lookup


def find_assigned_employee_id(assigned_agency: Any, lookup: Dict[str, int]) -> Optional[int]:
    label = normalize_label(assigned_agency)
    if not label:
        return None
    if label in lookup:
        return lookup[label]
    simple = re.sub(r"[^\w\s]", "", label)
    if simple in lookup:
        return lookup[simple]
    return None


def fetch_source_data(source_base: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    source_base = source_base.rstrip("/")
    employees = http_json("GET", f"{source_base}/api/employees/")
    tasks = http_json("GET", f"{source_base}/api/tasks/")
    if not isinstance(employees, list):
        raise RuntimeError("Source employees response is not a list")
    if not isinstance(tasks, list):
        raise RuntimeError("Source tasks response is not a list")
    return employees, tasks


def fetch_target_data(target_base: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    target_base = target_base.rstrip("/")
    employees = http_json("GET", f"{target_base}/api/employees/")
    tasks = http_json("GET", f"{target_base}/api/tasks/")
    if not isinstance(employees, list):
        raise RuntimeError("Target employees response is not a list")
    if not isinstance(tasks, list):
        raise RuntimeError("Target tasks response is not a list")
    return employees, tasks


def migrate_employees(source_employees: List[Dict[str, Any]], target_base: str) -> Dict[str, int]:
    target_employees, _ = fetch_target_data(target_base)
    by_mobile = {normalize_mobile(e.get("mobile_number")): e for e in target_employees if normalize_mobile(e.get("mobile_number"))}
    by_username = {normalize_label(e.get("display_username")): e for e in target_employees if normalize_label(e.get("display_username"))}
    used_usernames = {normalize_label(e.get("display_username")) for e in target_employees}

    stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
    target_base = target_base.rstrip("/")

    for src in source_employees:
        name = str(src.get("name") or "").strip() or "Unknown"
        mobile = normalize_mobile(src.get("mobile"))
        base_username = clean_display_username(src.get("display_name") or name)
        username_key = normalize_label(base_username)

        existing = None
        if mobile and mobile in by_mobile:
            existing = by_mobile[mobile]
        elif username_key and username_key in by_username:
            existing = by_username[username_key]

        if existing:
            payload = {
                "name": name,
                "mobile_number": mobile or existing.get("mobile_number") or "",
                "display_username": existing.get("display_username") or base_username,
                "is_active": True,
            }
            try:
                http_json("PUT", f"{target_base}/api/employees/{existing['id']}", payload)
                stats["updated"] += 1
            except Exception:
                stats["failed"] += 1
            continue

        username = unique_display_username(base_username, used_usernames)
        if not mobile:
            stats["skipped"] += 1
            continue

        payload = {
            "name": name,
            "mobile_number": mobile,
            "display_username": username,
            "is_active": True,
        }
        try:
            created = http_json("POST", f"{target_base}/api/employees/", payload)
            stats["created"] += 1
            created_mobile = normalize_mobile(created.get("mobile_number")) if isinstance(created, dict) else mobile
            if created_mobile:
                by_mobile[created_mobile] = created if isinstance(created, dict) else payload
            by_username[normalize_label(username)] = created if isinstance(created, dict) else payload
        except Exception:
            stats["failed"] += 1

    print(f"Employees migrated: created={stats['created']} updated={stats['updated']} skipped={stats['skipped']} failed={stats['failed']}")
    return stats


def migrate_tasks(source_tasks: List[Dict[str, Any]], target_base: str) -> Dict[str, int]:
    target_employees, target_tasks = fetch_target_data(target_base)
    employee_lookup = build_employee_lookup(target_employees)

    used_task_numbers: Set[str] = {str(t.get("task_number") or "").strip() for t in target_tasks if str(t.get("task_number") or "").strip()}
    existing_fingerprints: Set[str] = {task_fingerprint(t) for t in target_tasks}

    stats = {"created": 0, "skipped_existing": 0, "failed": 0}
    target_base = target_base.rstrip("/")
    migrate_date = str(date.today())

    for src in source_tasks:
        description = str(src.get("description") or "").strip()
        title = str(src.get("task_number") or "").strip()
        assigned_agency = str(src.get("assigned_agency") or "").strip()
        completion_date_raw = str(src.get("completion_date") or "").strip() or None
        status = normalize_status(src.get("status"), completion_date_raw)
        priority = normalize_priority(src.get("priority"))
        allocated_date = normalize_date_str(src.get("allocated_date"))
        deadline_date = normalize_date_str(src.get("deadline_date"))
        completion_date = completion_date_raw if completion_date_raw else (migrate_date if status == "Completed" else None)

        task_number = unique_task_number("MIG", used_task_numbers)

        assigned_employee_id = find_assigned_employee_id(assigned_agency, employee_lookup)

        payload = {
            "task_number": task_number,
            "description": title or description or "Migrated task",
            "assigned_agency": assigned_agency or None,
            "allocated_date": allocated_date,
            "time_given": str(src.get("time_given") or "").strip() or None,
            "deadline_date": deadline_date,
            "completion_date": completion_date,
            "status": status,
            "priority": priority,
            "is_pinned": as_bool(src.get("is_pinned")),
            "is_today": as_bool(src.get("is_today")),
            "steno_comment": description or str(src.get("steno_comment") or "").strip() or None,
            "remarks": str(src.get("remarks") or "").strip() or None,
            "department_id": None,
            "assigned_employee_id": assigned_employee_id,
        }

        fp = task_fingerprint(payload)
        if fp in existing_fingerprints:
            stats["skipped_existing"] += 1
            continue

        try:
            http_json("POST", f"{target_base}/api/tasks/", payload)
            stats["created"] += 1
            existing_fingerprints.add(fp)
        except Exception:
            stats["failed"] += 1

    print(
        "Tasks migrated: "
        f"created={stats['created']} skipped_existing={stats['skipped_existing']} failed={stats['failed']}"
    )
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate employees and tasks from Task Monitoring Dashboard.")
    parser.add_argument("--source-base", default=DEFAULT_SOURCE, help="Source dashboard base URL")
    parser.add_argument("--target-base", default=DEFAULT_TARGET, help="Target dashboard base URL")
    parser.add_argument("--insecure", action="store_true", help="Disable SSL cert verification (for Railway edge cert issues)")
    args = parser.parse_args()

    source_base = args.source_base.rstrip("/")
    target_base = args.target_base.rstrip("/")
    global SSL_CONTEXT
    if args.insecure:
        SSL_CONTEXT = ssl._create_unverified_context()

    print(f"Source: {source_base}")
    print(f"Target: {target_base}")
    if args.insecure:
        print("SSL verification: disabled")

    try:
        source_employees, source_tasks = fetch_source_data(source_base)
    except Exception as exc:
        print(f"Failed to fetch source data: {exc}")
        return 1

    print(f"Fetched source records: employees={len(source_employees)} tasks={len(source_tasks)}")

    try:
        migrate_employees(source_employees, target_base)
        migrate_tasks(source_tasks, target_base)
    except Exception as exc:
        print(f"Migration failed: {exc}")
        return 1

    print("Migration complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
