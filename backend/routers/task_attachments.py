import os
import uuid
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
import models

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "task_attachments")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.get("/{task_id}/attachments")
def list_attachments(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return [_att_to_dict(a) for a in task.attachments]


@router.post("/{task_id}/attachments")
async def upload_attachment(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 25 MB)")

    ext = os.path.splitext(file.filename or "")[1].lower() or ""
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, stored_name)
    with open(dest, "wb") as f:
        f.write(content)

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    att = models.TaskAttachment(
        task_id=task_id,
        original_filename=file.filename or stored_name,
        stored_filename=stored_name,
        file_path=dest,
        mime_type=mime,
        file_extension=ext.lstrip(".") if ext else None,
        file_size=len(content),
        source="portal",
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    return _att_to_dict(att)


@router.get("/{task_id}/attachments/{att_id}/download")
def download_attachment(task_id: int, att_id: int, db: Session = Depends(get_db)):
    att = db.query(models.TaskAttachment).filter(
        models.TaskAttachment.id == att_id,
        models.TaskAttachment.task_id == task_id,
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail="File missing on disk")
    return FileResponse(
        att.file_path,
        media_type=att.mime_type or "application/octet-stream",
        filename=att.original_filename,
    )


@router.delete("/{task_id}/attachments/{att_id}")
def delete_attachment(task_id: int, att_id: int, db: Session = Depends(get_db)):
    att = db.query(models.TaskAttachment).filter(
        models.TaskAttachment.id == att_id,
        models.TaskAttachment.task_id == task_id,
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    try:
        if os.path.exists(att.file_path):
            os.remove(att.file_path)
    except OSError:
        pass
    db.delete(att)
    db.commit()
    return {"message": "Deleted"}


def _att_to_dict(a: models.TaskAttachment) -> dict:
    return {
        "id": a.id,
        "task_id": a.task_id,
        "original_filename": a.original_filename,
        "mime_type": a.mime_type,
        "file_extension": a.file_extension,
        "file_size": a.file_size,
        "source": a.source,
        "caption": a.caption,
        "created_at": str(a.created_at),
    }
