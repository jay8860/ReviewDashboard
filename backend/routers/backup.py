import json
from datetime import date, datetime
from typing import Any, Dict, List, Type

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

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


def _serialize_rows(
    rows: List[Any],
    *,
    strip_document_text: bool = False,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows:
        payload: Dict[str, Any] = {}
        for col in row.__table__.columns:
            payload[col.name] = _serialize_value(getattr(row, col.name))
        if strip_document_text and getattr(row, "__tablename__", "") == "document_attachments":
            if payload.get("extracted_text"):
                payload["extracted_text_length"] = len(payload["extracted_text"])
            if payload.get("analysis_output"):
                payload["analysis_output_length"] = len(payload["analysis_output"])
            payload["extracted_text"] = None
            payload["analysis_output"] = None
        out.append(payload)
    return out


@router.get('/export')
def export_dashboard_backup(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
    include_document_text: bool = Query(
        default=False,
        description="Include heavy document extracted_text/analysis_output fields",
    ),
):
    tables: Dict[str, List[Dict[str, Any]]] = {}
    counts: Dict[str, int] = {}
    errors: Dict[str, str] = {}

    for model in BACKUP_MODELS:
        key = model.__tablename__
        try:
            query = db.query(model)
            if hasattr(model, 'id'):
                query = query.order_by(model.id.asc())
            rows = query.all()
            serialized = _serialize_rows(
                rows,
                strip_document_text=not include_document_text,
            )
            tables[key] = serialized
            counts[key] = len(serialized)
        except SQLAlchemyError as exc:
            # Keep backup downloadable even if one table has schema drift.
            tables[key] = []
            counts[key] = 0
            errors[key] = str(exc.__class__.__name__)

    payload = {
        'version': 'reviewdashboard-backup-v2',
        'exported_at': datetime.utcnow().isoformat() + 'Z',
        'include_document_text': include_document_text,
        'counts': counts,
        'tables': tables,
        'errors': errors,
    }

    filename = f"reviewdashboard_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=json.dumps(payload, ensure_ascii=False, default=str, separators=(",", ":")),
        media_type='application/json',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Cache-Control': 'no-store',
        },
    )
