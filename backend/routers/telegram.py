import os
import re
import uuid
import logging
import httpx
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models

router = APIRouter()
logger = logging.getLogger(__name__)

TASK_ATTACHMENT_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "task_attachments")
os.makedirs(TASK_ATTACHMENT_ROOT, exist_ok=True)

TASK_NUMBER_RE = re.compile(r'\b([A-Z]{2,5}-\d{2,})\b')

# Map Telegram file extensions to the same file_type values used by main's task attachment system
EXT_TO_TYPE = {
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image", ".gif": "image",
    ".pdf": "pdf",
    ".xlsx": "excel", ".xls": "excel", ".csv": "excel",
    ".docx": "word", ".doc": "word",
    ".pptx": "ppt", ".ppt": "ppt",
}


def _get_bot_token() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Telegram bot not configured (TELEGRAM_BOT_TOKEN not set)")
    return token


async def _download_telegram_file(bot_token: str, file_id: str) -> tuple[bytes, str]:
    tg_base = f"https://api.telegram.org/bot{bot_token}"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(f"{tg_base}/getFile", params={"file_id": file_id})
        r.raise_for_status()
        file_path = r.json()["result"]["file_path"]
        dl = await client.get(f"https://api.telegram.org/file/bot{bot_token}/{file_path}")
        dl.raise_for_status()
        return dl.content, file_path


@router.post("/webhook")
async def telegram_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    message = update.get("message") or update.get("channel_post") or {}
    if not message:
        return {"ok": True}

    caption = message.get("caption") or message.get("text") or ""

    # Extract task number from caption (e.g. TSK-001, EDU-042)
    match = TASK_NUMBER_RE.search(caption.upper())
    if not match:
        logger.info("Telegram webhook: no task number in caption %r", caption[:120])
        return {"ok": True}

    task_number = match.group(1)
    task = db.query(models.Task).filter(models.Task.task_number == task_number).first()
    if not task:
        logger.info("Telegram webhook: task %s not found", task_number)
        return {"ok": True}

    # Determine file info from the update
    file_id = None
    original_filename = None
    ext = ".bin"

    if message.get("photo"):
        photos = message["photo"]
        best = max(photos, key=lambda p: p.get("file_size", 0))
        file_id = best["file_id"]
        original_filename = f"photo_{best['file_unique_id']}.jpg"
        ext = ".jpg"
    elif message.get("document"):
        doc = message["document"]
        file_id = doc["file_id"]
        original_filename = doc.get("file_name") or f"document_{doc['file_unique_id']}"
        ext = os.path.splitext(original_filename)[1].lower() or ".bin"
    elif message.get("video"):
        vid = message["video"]
        file_id = vid["file_id"]
        original_filename = vid.get("file_name") or f"video_{vid['file_unique_id']}.mp4"
        ext = os.path.splitext(original_filename)[1].lower() or ".mp4"

    if not file_id:
        return {"ok": True}

    # Download the file from Telegram
    try:
        bot_token = _get_bot_token()
        content, _ = await _download_telegram_file(bot_token, file_id)
    except Exception as exc:
        logger.warning("Telegram webhook: failed to download file for task %s: %s", task_number, exc)
        return {"ok": True}

    stored_name = f"task_{task.id}_{uuid.uuid4().hex}{ext}"
    dest = os.path.join(TASK_ATTACHMENT_ROOT, stored_name)
    try:
        with open(dest, "wb") as f:
            f.write(content)
    except OSError as exc:
        logger.error("Telegram webhook: could not save file: %s", exc)
        return {"ok": True}

    file_type = EXT_TO_TYPE.get(ext, "other")
    att = models.TaskAttachment(
        task_id=task.id,
        file_url=f"/uploads/task-attachments/{stored_name}",
        original_filename=original_filename,
        file_type=file_type,
        file_extension=ext,
        file_size=len(content),
        source="telegram",
        telegram_file_id=file_id,
        caption=caption or None,
    )
    db.add(att)
    db.commit()
    logger.info("Telegram webhook: saved attachment for task %s (id=%s)", task_number, att.id)
    return {"ok": True}
