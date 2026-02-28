import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Tuple

import openpyxl
from docx import Document
from pypdf import PdfReader
from pptx import Presentation

SUPPORTED_EXTENSIONS = {
    ".txt", ".md", ".csv", ".json",
    ".docx", ".pptx", ".pdf", ".xlsx"
}

MAX_EXTRACT_CHARS = int(os.getenv("DOC_ANALYSIS_MAX_CHARS", "140000"))
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


class GeminiModelNotFoundError(RuntimeError):
    pass


def _read_text_file(path: str) -> str:
    with open(path, "rb") as f:
        raw = f.read()
    return raw.decode("utf-8", errors="ignore")


def _read_docx(path: str) -> str:
    doc = Document(path)
    chunks = []
    for para in doc.paragraphs:
        text = (para.text or "").strip()
        if text:
            chunks.append(text)

    for table in doc.tables:
        for row in table.rows:
            cells = [(cell.text or "").strip() for cell in row.cells]
            if any(cells):
                chunks.append(" | ".join(cells))

    return "\n".join(chunks)


def _read_pptx(path: str) -> str:
    presentation = Presentation(path)
    chunks = []
    for slide_no, slide in enumerate(presentation.slides, start=1):
        slide_lines = []
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                text = (shape.text or "").strip()
                if text:
                    slide_lines.append(text)
        if slide_lines:
            chunks.append(f"Slide {slide_no}:")
            chunks.extend(slide_lines)
    return "\n".join(chunks)


def _read_pdf(path: str) -> str:
    reader = PdfReader(path)
    chunks = []
    for i, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            chunks.append(f"Page {i}:")
            chunks.append(text)
    return "\n".join(chunks)


def _read_xlsx(path: str) -> str:
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    chunks = []
    for ws in wb.worksheets[:6]:
        chunks.append(f"Sheet: {ws.title}")
        row_count = 0
        for row in ws.iter_rows(values_only=True):
            values = ["" if v is None else str(v).strip() for v in row]
            if any(values):
                chunks.append("\t".join(values))
            row_count += 1
            if row_count >= 350:
                chunks.append("...")
                break
    return "\n".join(chunks)


def extract_text_from_document(file_path: str, extension: str) -> Tuple[str, bool]:
    ext = extension.lower()

    if ext in {".txt", ".md", ".csv", ".json"}:
        text = _read_text_file(file_path)
    elif ext == ".docx":
        text = _read_docx(file_path)
    elif ext == ".pptx":
        text = _read_pptx(file_path)
    elif ext == ".pdf":
        text = _read_pdf(file_path)
    elif ext == ".xlsx":
        text = _read_xlsx(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")

    text = (text or "").strip()
    if not text:
        raise ValueError("No readable text found in the uploaded document.")

    is_truncated = len(text) > MAX_EXTRACT_CHARS
    return text[:MAX_EXTRACT_CHARS], is_truncated


def _build_default_prompt(document_name: str, text: str) -> str:
    return f"""
You are a governance and policy review analyst. Analyze the following document in detail.

Document: {document_name}

Return your answer in Markdown using exactly these sections:

1) Executive Summary
- 6-10 crisp bullet points.

2) Agenda-wise Findings
- Group findings into inferred agenda themes (Agenda 1, Agenda 2, ...).
- Under each agenda, provide point-wise observations and evidence.

3) Risks / Gaps / Bottlenecks
- Prioritized bullets with severity (High/Medium/Low).

4) Action Recommendations (Table)
- Create a markdown table with columns:
  Action Point | Suggested Owner | Timeline | Expected Outcome | Priority

5) Questions For Next Meeting
- 5-10 pointed questions.

6) Suggested Minutes (Draft)
- Draft concise meeting minutes with decisions and follow-ups.

Rules:
- Be specific and practical.
- If a fact is uncertain, mark it as "Assumption".
- Keep output actionable for an administrative review meeting.

Document text:
{text}
""".strip()


def _build_custom_prompt(document_name: str, text: str, custom_prompt: str) -> str:
    return f"""
You are a governance document analyst.

User instruction:
{custom_prompt}

Document: {document_name}

Return a practical, structured answer in Markdown with bullets/tables wherever useful.
Mention assumptions explicitly where evidence is missing.

Document text:
{text}
""".strip()


def analyze_with_gemini(document_name: str, extracted_text: str, mode: str = "default", custom_prompt: Optional[str] = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Please add it in environment variables.")

    if mode not in {"default", "custom"}:
        raise ValueError("Invalid mode. Use 'default' or 'custom'.")
    if mode == "custom" and not (custom_prompt or "").strip():
        raise ValueError("Custom mode requires a prompt.")

    prompt = _build_default_prompt(document_name, extracted_text)
    if mode == "custom":
        prompt = _build_custom_prompt(document_name, extracted_text, custom_prompt.strip())

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 4096,
        },
    }

    preferred = (GEMINI_MODEL or "").strip()
    model_candidates = [
        preferred,
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    model_candidates = [m for i, m in enumerate(model_candidates) if m and m not in model_candidates[:i]]

    tried = []
    last_error = None

    for model_name in model_candidates:
        tried.append(model_name)
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{urllib.parse.quote(model_name)}:generateContent?key={urllib.parse.quote(api_key)}"
        )
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = resp.read().decode("utf-8")
            parsed = json.loads(body)
            candidates = parsed.get("candidates") or []
            if not candidates:
                raise RuntimeError("Gemini returned no candidates.")

            parts = candidates[0].get("content", {}).get("parts", [])
            text_chunks = [p.get("text", "") for p in parts if isinstance(p, dict)]
            result = "\n".join([c for c in text_chunks if c]).strip()
            if not result:
                raise RuntimeError("Gemini returned an empty response.")
            return result
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            if exc.code == 404 and ("not found" in detail.lower() or "not supported" in detail.lower()):
                last_error = GeminiModelNotFoundError(f"Model '{model_name}' unavailable")
                continue
            raise RuntimeError(f"Gemini API error ({exc.code}): {detail[:500]}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Gemini API network error: {exc}") from exc
        except Exception as exc:
            last_error = exc
            continue

    raise RuntimeError(
        f"No compatible Gemini model found. Tried: {', '.join(tried)}. "
        f"Set GEMINI_MODEL in env to a model from ListModels. Last error: {last_error}"
    )
