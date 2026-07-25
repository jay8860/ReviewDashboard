from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
import os
import re
import uuid
from pathlib import Path

from database import get_db
import models
from services.document_ai import (
    SUPPORTED_EXTENSIONS,
    extract_text_from_document,
    analyze_with_gemini,
    analyze_file_with_gemini,
)

router = APIRouter()

MAX_DOC_UPLOAD_BYTES = int(os.getenv("MAX_DOC_UPLOAD_BYTES", str(25 * 1024 * 1024)))
UPLOAD_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads", "general_info")


class GeneralInfoProfileUpdate(BaseModel):
    district_name: Optional[str] = None
    headline: Optional[str] = None
    overview_markdown: Optional[str] = None
    sections: Optional[List[dict]] = None
    key_metrics: Optional[List[dict]] = None
    raw_notes: Optional[str] = None


class GeneralInfoDocumentLinkCreate(BaseModel):
    title: str
    external_url: str
    category: Optional[str] = "reference"
    is_map: Optional[bool] = False


class DocumentAnalyzeRequest(BaseModel):
    mode: Optional[str] = "default"
    prompt: Optional[str] = None


class GenerateBriefRequest(BaseModel):
    prompt: Optional[str] = None


def _safe_json_list(value: Optional[str], fallback: list) -> list:
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else fallback
    except Exception:
        return fallback


def _clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_category(value: Optional[str], is_map: bool = False) -> str:
    if is_map:
        return "map"
    text = (value or "reference").strip().lower().replace(" ", "_")
    if text in {"map", "brief", "dataset", "reference"}:
        return text
    return "reference"


def _get_or_create_profile(db: Session) -> models.GeneralInfoProfile:
    row = db.query(models.GeneralInfoProfile).order_by(models.GeneralInfoProfile.id.asc()).first()
    if row:
        return row
    row = models.GeneralInfoProfile(
        district_name="District",
        headline="District briefing and references",
        overview_markdown="",
        sections_json="[]",
        key_metrics_json="[]",
        raw_notes="",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _serialize_profile(row: models.GeneralInfoProfile) -> dict:
    return {
        "id": row.id,
        "district_name": row.district_name,
        "headline": row.headline,
        "overview_markdown": row.overview_markdown or "",
        "sections": _safe_json_list(row.sections_json, []),
        "key_metrics": _safe_json_list(row.key_metrics_json, []),
        "raw_notes": row.raw_notes or "",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_document(doc: models.GeneralInfoDocument) -> dict:
    return {
        "id": doc.id,
        "title": doc.title,
        "category": doc.category,
        "is_map": bool(doc.is_map),
        "external_url": doc.external_url,
        "original_filename": doc.original_filename,
        "stored_filename": doc.stored_filename,
        "mime_type": doc.mime_type,
        "file_extension": doc.file_extension,
        "file_size": doc.file_size,
        "extraction_truncated": bool(doc.extraction_truncated),
        "analysis_mode": doc.analysis_mode,
        "analysis_prompt": doc.analysis_prompt,
        "analysis_output": doc.analysis_output,
        "analysis_status": doc.analysis_status,
        "analysis_error": doc.analysis_error,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


def _validate_document_extension(filename: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext or 'unknown'}. Supported: {supported}")
    return ext


def _collect_upload_files(file: Optional[UploadFile], files: Optional[List[UploadFile]]) -> List[UploadFile]:
    collected: List[UploadFile] = []
    if file is not None:
        collected.append(file)
    if files:
        collected.extend([item for item in files if item is not None])
    valid = [item for item in collected if (item.filename or "").strip()]
    if not valid:
        raise HTTPException(status_code=400, detail="At least one valid file is required")
    return valid


def _store_uploaded_document(file: UploadFile) -> tuple[str, str, int, str]:
    ext = _validate_document_extension(file.filename or "")
    os.makedirs(UPLOAD_ROOT, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_ROOT, stored_filename)
    total_bytes = 0

    try:
        with open(file_path, "wb") as out:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_DOC_UPLOAD_BYTES:
                    out.close()
                    os.remove(file_path)
                    raise HTTPException(status_code=413, detail=f"File too large. Max allowed: {MAX_DOC_UPLOAD_BYTES // (1024 * 1024)} MB")
                out.write(chunk)
    finally:
        file.file.close()

    return file_path, stored_filename, total_bytes, ext


def _extract_json_object(text: str) -> Optional[dict]:
    if not text:
        return None
    cleaned = text.strip()
    for candidate in [cleaned, re.sub(r"^```json\s*|\s*```$", "", cleaned, flags=re.S)]:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    match = re.search(r"\{.*\}", cleaned, re.S)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return None
    return None


def _build_brief_source(profile: models.GeneralInfoProfile, docs: List[models.GeneralInfoDocument]) -> str:
    chunks = []
    if profile.raw_notes:
        chunks.append("User notes:\n" + profile.raw_notes[:20000])
    for doc in docs:
        if doc.analysis_output and doc.analysis_output.strip():
            chunks.append(f"Document analysis - {doc.title}:\n{doc.analysis_output[:20000]}")
        elif doc.extracted_text and doc.extracted_text.strip():
            chunks.append(f"Document extracted text - {doc.title}:\n{doc.extracted_text[:20000]}")
        elif doc.external_url:
            chunks.append(f"Reference link - {doc.title}: {doc.external_url}")
    return "\n\n".join(chunks).strip()


@router.get("/")
def get_general_info(db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    docs = db.query(models.GeneralInfoDocument).order_by(
        models.GeneralInfoDocument.is_map.desc(),
        models.GeneralInfoDocument.created_at.desc(),
    ).all()
    return {
        "profile": _serialize_profile(profile),
        "documents": [_serialize_document(doc) for doc in docs],
    }


@router.put("/profile")
def update_general_info_profile(data: GeneralInfoProfileUpdate, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    payload = data.dict(exclude_unset=True)
    if "district_name" in payload:
        profile.district_name = _clean_text(payload.get("district_name")) or "District"
    if "headline" in payload:
        profile.headline = _clean_text(payload.get("headline"))
    if "overview_markdown" in payload:
        profile.overview_markdown = payload.get("overview_markdown") or ""
    if "sections" in payload:
        profile.sections_json = json.dumps(payload.get("sections") or [], ensure_ascii=False)
    if "key_metrics" in payload:
        profile.key_metrics_json = json.dumps(payload.get("key_metrics") or [], ensure_ascii=False)
    if "raw_notes" in payload:
        profile.raw_notes = payload.get("raw_notes") or ""
    db.commit()
    db.refresh(profile)
    return _serialize_profile(profile)


@router.get("/documents")
def list_general_info_documents(db: Session = Depends(get_db)):
    docs = db.query(models.GeneralInfoDocument).order_by(
        models.GeneralInfoDocument.is_map.desc(),
        models.GeneralInfoDocument.created_at.desc(),
    ).all()
    return [_serialize_document(doc) for doc in docs]


@router.post("/documents")
def upload_general_info_documents(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form("reference"),
    is_map: Optional[bool] = Form(False),
    db: Session = Depends(get_db),
):
    upload_items = _collect_upload_files(file, files)
    created_docs: List[models.GeneralInfoDocument] = []
    created_paths: List[str] = []
    try:
        for index, upload in enumerate(upload_items):
            file_path, stored_filename, file_size, ext = _store_uploaded_document(upload)
            created_paths.append(file_path)
            resolved_title = _clean_text(title) if index == 0 else None
            doc = models.GeneralInfoDocument(
                title=resolved_title or (upload.filename or f"Reference {index + 1}"),
                category=_normalize_category(category, bool(is_map)),
                is_map=bool(is_map),
                original_filename=upload.filename,
                stored_filename=stored_filename,
                file_path=file_path,
                mime_type=upload.content_type,
                file_extension=ext,
                file_size=file_size,
                analysis_status="Not Analyzed",
            )
            db.add(doc)
            db.flush()
            created_docs.append(doc)
        db.commit()
    except Exception:
        db.rollback()
        for path in created_paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass
        raise

    for doc in created_docs:
        db.refresh(doc)
    if len(created_docs) == 1:
        return _serialize_document(created_docs[0])
    return [_serialize_document(doc) for doc in created_docs]


@router.post("/links")
def create_general_info_link(data: GeneralInfoDocumentLinkCreate, db: Session = Depends(get_db)):
    title = _clean_text(data.title)
    url = _clean_text(data.external_url)
    if not title or not url:
        raise HTTPException(status_code=400, detail="Title and external URL are required")
    doc = models.GeneralInfoDocument(
        title=title,
        category=_normalize_category(data.category, bool(data.is_map)),
        is_map=bool(data.is_map),
        external_url=url,
        analysis_status="Not Analyzed",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _serialize_document(doc)


@router.post("/documents/{doc_id}/analyze")
def analyze_general_info_document(doc_id: int, data: DocumentAnalyzeRequest, db: Session = Depends(get_db)):
    doc = db.query(models.GeneralInfoDocument).filter(models.GeneralInfoDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.file_path:
        raise HTTPException(status_code=400, detail="External links cannot be analyzed directly")

    doc.analysis_status = "Processing"
    doc.analysis_error = None
    db.commit()

    mode = (data.mode or "default").strip().lower()
    prompt = (data.prompt or "").strip() if data.prompt else None
    try:
        extracted_text, was_truncated = extract_text_from_document(doc.file_path, doc.file_extension or "")
        analysis = analyze_with_gemini(doc.original_filename or doc.title, extracted_text, mode=mode, custom_prompt=prompt)
        doc.extracted_text = extracted_text
        doc.extraction_truncated = was_truncated
        doc.analysis_mode = mode
        doc.analysis_prompt = prompt if mode == "custom" else None
        doc.analysis_output = analysis
        doc.analysis_status = "Completed"
        doc.analysis_error = None
    except ValueError as exc:
        fallback_reason = str(exc)
        if "no readable text" not in fallback_reason.lower():
            doc.analysis_status = "Failed"
            doc.analysis_error = fallback_reason
            db.commit()
            db.refresh(doc)
            raise HTTPException(status_code=422, detail=fallback_reason)
        try:
            analysis = analyze_file_with_gemini(
                document_name=doc.original_filename or doc.title,
                file_path=doc.file_path,
                mime_type=doc.mime_type,
                mode=mode,
                custom_prompt=prompt,
            )
            doc.extracted_text = None
            doc.extraction_truncated = False
            doc.analysis_mode = mode
            doc.analysis_prompt = prompt if mode == "custom" else None
            doc.analysis_output = analysis
            doc.analysis_status = "Completed"
            doc.analysis_error = None
        except Exception as fallback_exc:
            detail = f"{fallback_reason} Also Gemini file-based OCR analysis failed: {fallback_exc}"
            doc.analysis_status = "Failed"
            doc.analysis_error = detail
            db.commit()
            db.refresh(doc)
            raise HTTPException(status_code=422, detail=detail)
    except Exception as exc:
        doc.analysis_status = "Failed"
        doc.analysis_error = str(exc)
        db.commit()
        db.refresh(doc)
        raise HTTPException(status_code=500, detail=f"Document analysis failed: {exc}")

    db.commit()
    db.refresh(doc)
    return _serialize_document(doc)


@router.post("/generate-brief")
def generate_general_info_brief(data: GenerateBriefRequest, db: Session = Depends(get_db)):
    profile = _get_or_create_profile(db)
    docs = db.query(models.GeneralInfoDocument).order_by(models.GeneralInfoDocument.created_at.desc()).all()
    source_text = _build_brief_source(profile, docs)
    if not source_text:
        raise HTTPException(status_code=400, detail="Add notes or analyze at least one document before generating a brief")

    custom_prompt = (data.prompt or "").strip() or (
        "You are preparing a district general information brief. Return JSON only with these keys: "
        "headline (string), overview_markdown (string), key_metrics (array of objects with label, value, note), "
        "sections (array of objects with title and body). Keep it practical and administrative."
    )
    result = analyze_with_gemini("general_info_source.txt", source_text, mode="custom", custom_prompt=custom_prompt)
    parsed = _extract_json_object(result)

    if parsed:
        if isinstance(parsed.get("headline"), str):
            profile.headline = parsed.get("headline").strip() or profile.headline
        if isinstance(parsed.get("overview_markdown"), str):
            profile.overview_markdown = parsed.get("overview_markdown").strip()
        if isinstance(parsed.get("key_metrics"), list):
            profile.key_metrics_json = json.dumps(parsed.get("key_metrics") or [], ensure_ascii=False)
        if isinstance(parsed.get("sections"), list):
            profile.sections_json = json.dumps(parsed.get("sections") or [], ensure_ascii=False)
    else:
        profile.overview_markdown = (result or "").strip()

    db.commit()
    db.refresh(profile)
    return {
        "profile": _serialize_profile(profile),
        "raw_generation": result,
        "parsed": bool(parsed),
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/documents/{doc_id}/download")
def download_general_info_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.GeneralInfoDocument).filter(models.GeneralInfoDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.external_url:
        raise HTTPException(status_code=400, detail="External links cannot be downloaded from the server")
    if not doc.file_path or not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="Stored file not found")
    return FileResponse(path=doc.file_path, filename=doc.original_filename or doc.title, media_type=doc.mime_type or "application/octet-stream")


@router.delete("/documents/{doc_id}")
def delete_general_info_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.GeneralInfoDocument).filter(models.GeneralInfoDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass
    db.delete(doc)
    db.commit()
    return {"message": "Deleted"}
