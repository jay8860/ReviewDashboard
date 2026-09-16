import os
import re
import uuid
import logging
import mimetypes
import httpx
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "task_attachments")
os.makedirs(UPLOAD_DIR, exist_ok=True)

TASK_NUMBER_RE = re.compile(r'\b([A-Z]{2,5}-\d{2,})\b')


def _get_bot_token() -> str:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="Telegram bot not configured")
    return token


async def _download_telegram_file(bot_token: str, file_id: str) -> tuple[bytes, str]:
    tg_base = f"https://api.telegram.org/bot{bot_token}"
    async with httpx.AsyncClient(timeout=30) as client:
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

    # Determine file info
    file_id = None
    original_filename = None
    mime_type = None

    if message.get("photo"):
        # Telegram sends multiple sizes; pick the largest
        photos = message["photo"]
        best = max(photos, key=lambda p: p.get("file_size", 0))
        file_id = best["file_id"]
        original_filename = f"photo_{best['file_unique_id']}.jpg"
        mime_type = "image/jpeg"
    elif message.get("document"):
        doc = message["document"]
        file_id = doc["file_id"]
        original_filename = doc.get("file_name") or f"document_{doc['file_unique_id']}"
        mime_type = doc.get("mime_type")
    elif message.get("video"):
        vid = message["video"]
        file_id = vid["file_id"]
        original_filename = vid.get("file_name") or f"video_{vid['file_unique_id']}.mp4"
        mime_type = vid.get("mime_type") or "video/mp4"

    if not file_id:
        return {"ok": True}

    # Extract task number from caption
    match = TASK_NUMBER_RE.search(caption.upper())
    if not match:
        logger.info("Telegram file received but no task number found in caption: %r", caption)
        return {"ok": True}

    task_number = match.group(1)
    task = db.query(models.Task).filter(models.Task.task_number == task_number).first()
    if not task:
        logger.info("Telegram file: task number %s not found", task_number)
        return {"ok": True}

    try:
        bot_token = _get_bot_token()
        content, tg_file_path = await _download_telegram_file(bot_token, file_id)
    except Exception as exc:
        logger.warning("Failed to download Telegram file: %s", exc)
        return {"ok": True}

    ext = os.path.splitext(original_filename)[1].lower() or (
        "." + (mimetypes.guess_extension(mime_type or "") or "bin").lstrip(".")
    )
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = os.path.join(UPLOAD_DIR, stored_name)
    try:
        with open(dest, "wb") as f:
            f.write(content)
    except OSError as exc:
        logger.error("Failed to save Telegram file: %s", exc)
        return {"ok": True}

    att = models.TaskAttachment(
        task_id=task.id,
        original_filename=original_filename,
        stored_filename=stored_name,
        file_path=dest,
        mime_type=mime_type or mimetypes.guess_type(original_filename)[0] or "application/octet-stream",
        file_extension=ext.lstrip(".") if ext else None,
        file_size=len(content),
        source="telegram",
        telegram_file_id=file_id,
        caption=caption or None,
    )
    db.add(att)
    db.commit()
    logger.info("Saved Telegram attachment for task %s (att id=%s)", task_number, att.id)
    return {"ok": True}
