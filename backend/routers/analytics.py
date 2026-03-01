from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

import models
from database import get_db

router = APIRouter()


def _parse_date_maybe(value: Optional[str]) -> Optional[date]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    # Accept common date formats from migrated data
    for fmt in (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d-%m-%y",
        "%d/%m/%y",
    ):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except Exception:
            continue
    return None


def _effective_agency(task: models.Task) -> str:
    if task.assigned_agency and task.assigned_agency.strip():
        return task.assigned_agency.strip()
    if task.assigned_employee:
        if task.assigned_employee.display_username and task.assigned_employee.display_username.strip():
            return task.assigned_employee.display_username.strip()
        if task.assigned_employee.name and task.assigned_employee.name.strip():
            return task.assigned_employee.name.strip()
    return "Unassigned"


def _task_bucket(task: models.Task, today: date) -> str:
    raw_status = (task.status or "").strip().lower()
    completion_text = (task.completion_date or "").strip()

    if raw_status in {"completed", "done", "closed"} or completion_text:
        return "Completed"

    if raw_status == "overdue":
        return "Overdue"

    if task.deadline_date and task.deadline_date < today:
        return "Overdue"

    if raw_status in {"in progress", "in_progress", "progress"}:
        return "In Progress"

    return "Pending"


@router.get("/tasks")
def get_task_analytics(db: Session = Depends(get_db)):
    today = date.today()
    tasks = (
        db.query(models.Task)
        .options(joinedload(models.Task.assigned_employee))
        .all()
    )

    summary = {"total": 0, "completed": 0, "pending": 0, "in_progress": 0, "overdue": 0}
    bottlenecks = defaultdict(int)
    workload = defaultdict(int)
    oldest_pending = []

    agency_perf = defaultdict(lambda: {
        "agency": "",
        "total": 0,
        "completed": 0,
        "pending": 0,
        "in_progress": 0,
        "overdue": 0,
        "speed_sum": 0,
        "speed_count": 0,
    })

    for task in tasks:
        bucket = _task_bucket(task, today)
        agency = _effective_agency(task)

        summary["total"] += 1
        if bucket == "Completed":
            summary["completed"] += 1
        elif bucket == "Overdue":
            summary["overdue"] += 1
        elif bucket == "In Progress":
            summary["in_progress"] += 1
        else:
            summary["pending"] += 1

        perf = agency_perf[agency]
        perf["agency"] = agency
        perf["total"] += 1
        if bucket == "Completed":
            perf["completed"] += 1
        elif bucket == "Overdue":
            perf["overdue"] += 1
        elif bucket == "In Progress":
            perf["in_progress"] += 1
        else:
            perf["pending"] += 1

        if bucket == "Overdue":
            bottlenecks[agency] += 1

        if bucket in {"Pending", "In Progress", "Overdue"}:
            workload[agency] += 1

            start_date = task.allocated_date or (task.created_at.date() if task.created_at else today)
            days_open = max((today - start_date).days, 0)
            oldest_pending.append({
                "id": task.id,
                "task_number": task.task_number,
                "description": task.description or "No description",
                "agency": agency,
                "status": bucket,
                "days_open": days_open,
                "deadline_date": str(task.deadline_date) if task.deadline_date else None,
            })

        if bucket == "Completed":
            start_date = task.allocated_date or (task.created_at.date() if task.created_at else None)
            completion_date = _parse_date_maybe(task.completion_date)
            if not completion_date and task.updated_at:
                completion_date = task.updated_at.date()
            if start_date and completion_date and completion_date >= start_date:
                perf["speed_sum"] += (completion_date - start_date).days
                perf["speed_count"] += 1

    health = [
        {"name": "Completed", "value": summary["completed"], "color": "#10b981", "status_filter": "Completed"},
        {"name": "Overdue", "value": summary["overdue"], "color": "#ef4444", "status_filter": "Overdue"},
        {"name": "Pending", "value": summary["pending"], "color": "#f59e0b", "status_filter": "Pending"},
        {"name": "In Progress", "value": summary["in_progress"], "color": "#6366f1", "status_filter": "In Progress"},
    ]

    critical_bottlenecks = [
        {"agency": agency, "count": count}
        for agency, count in sorted(bottlenecks.items(), key=lambda x: (-x[1], x[0]))[:10]
    ]

    highest_workload = [
        {"agency": agency, "count": count}
        for agency, count in sorted(workload.items(), key=lambda x: (-x[1], x[0]))[:10]
    ]

    oldest_pending = sorted(oldest_pending, key=lambda x: (-x["days_open"], x["id"]))[:10]

    agency_performance = []
    for row in agency_perf.values():
        avg_speed = None
        if row["speed_count"] > 0:
            avg_speed = round(row["speed_sum"] / row["speed_count"], 1)
        agency_performance.append({
            "agency": row["agency"],
            "total": row["total"],
            "completed": row["completed"],
            "pending": row["pending"],
            "in_progress": row["in_progress"],
            "overdue": row["overdue"],
            "avg_speed_days": avg_speed,
        })

    agency_performance.sort(key=lambda x: (-x["overdue"], -x["pending"], -x["total"], x["agency"]))

    return {
        "summary": summary,
        "health": health,
        "critical_bottlenecks": critical_bottlenecks,
        "highest_workload": highest_workload,
        "oldest_pending": oldest_pending,
        "agency_performance": agency_performance,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }
