import json
from datetime import datetime, date, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_user, require_admin

router = APIRouter()


def _row_to_dict(row: models.AuditLog) -> dict:
    return {
        "id": row.id,
        "actor_user_id": row.actor_user_id,
        "actor_username": row.actor_username,
        "actor_role": row.actor_role,
        "target_type": row.target_type,
        "target_id": row.target_id,
        "action": row.action,
        "summary": row.summary,
        "changes": json.loads(row.changes_json) if row.changes_json else None,
        "created_at": str(row.created_at) if row.created_at else None,
    }


@router.get("/admin")
def list_audit_admin(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    query = db.query(models.AuditLog)

    if start_date:
        try:
            d = datetime.fromisoformat(start_date).date()
            query = query.filter(models.AuditLog.created_at >= datetime.combine(d, datetime.min.time()))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid start_date")
    if end_date:
        try:
            d = datetime.fromisoformat(end_date).date()
            query = query.filter(models.AuditLog.created_at < datetime.combine(d + timedelta(days=1), datetime.min.time()))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid end_date")

    if action:
        query = query.filter(models.AuditLog.action == action)
    if actor:
        query = query.filter(models.AuditLog.actor_username.ilike(f"%{actor}%"))
    if q:
        query = query.filter(models.AuditLog.summary.ilike(f"%{q}%"))

    rows = query.order_by(models.AuditLog.created_at.desc(), models.AuditLog.id.desc()).limit(limit).all()
    return [_row_to_dict(r) for r in rows]


@router.get("/me")
def list_audit_me(
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.actor_user_id == current_user.id)
        .order_by(models.AuditLog.created_at.desc(), models.AuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return [_row_to_dict(r) for r in rows]
