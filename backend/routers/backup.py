import json
from datetime import date, datetime
from typing import Any, Dict, List, Type

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

import models
from database import get_db
from routers.auth import get_current_user

router = APIRouter()

BACKUP_MODELS: List[Type] = [
    models.Department,
    models.Employee,
    models.AgendaPoint,
    models.DepartmentMeeting,
    models.DeptDataGrid,
    models.Task,
    models.TodoItem,
    models.ReviewProgram,
    models.ReviewSession,
    models.ActionPoint,
    models.ChecklistTemplate,
    models.ChecklistResponse,
    models.PlannerEvent,
    models.PlannerSettings,
    models.FieldVisitDraft,
    models.FieldVisitPlanningNote,
    models.DocumentAttachment,
]


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _serialize_rows(rows: List[Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows:
        payload: Dict[str, Any] = {}
        for col in row.__table__.columns:
            payload[col.name] = _serialize_value(getattr(row, col.name))
        out.append(payload)
    return out


@router.get('/export')
def export_dashboard_backup(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    tables: Dict[str, List[Dict[str, Any]]] = {}
    counts: Dict[str, int] = {}

    for model in BACKUP_MODELS:
        query = db.query(model)
        if hasattr(model, 'id'):
            query = query.order_by(model.id.asc())
        rows = query.all()
        key = model.__tablename__
        serialized = _serialize_rows(rows)
        tables[key] = serialized
        counts[key] = len(serialized)

    payload = {
        'version': 'reviewdashboard-backup-v1',
        'exported_at': datetime.utcnow().isoformat() + 'Z',
        'counts': counts,
        'tables': tables,
    }

    filename = f"reviewdashboard_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type='application/json',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Cache-Control': 'no-store',
        },
    )
