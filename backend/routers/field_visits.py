from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from collections import defaultdict
import re
import urllib.parse

from database import get_db
import models

router = APIRouter()

VALID_STATUSES = {"Draft", "Planned", "Done"}
HIGH_PRIORITY_KEYWORDS = {
    "critical", "urgent", "worst", "very poor", "high priority",
    "backlog", "delay", "failed", "underperform", "at risk"
}
THEME_HINTS = {
    "health": {"health", "hospital", "mmr", "anm", "clinic", "malnutrition", "tb", "sickle", "delivery"},
    "education": {"school", "education", "teacher", "exam", "students", "library", "mdm", "anganwadi"},
    "infrastructure": {"road", "bridge", "pipeline", "water", "electricity", "civil", "construction", "repair"},
    "livelihood": {"ripa", "livelihood", "skill", "college", "self-employment", "job", "shg", "maatikala"},
    "governance": {"audit", "compliance", "grievance", "dashboard", "court", "assembly", "tl", "review"},
}
GENERIC_ROUTE_WORDS = {
    "field", "visit", "visits", "route", "routes", "plan", "day", "cluster",
    "priority", "high", "worst", "item", "project", "projects", "general",
}

DEFAULT_GP_MASTER = [
    {"block": "Dantewada", "name": "Bade Bacheli", "villages": "Bade Bacheli"},
    {"block": "Dantewada", "name": "Badekameli", "villages": "Badekameli"},
    {"block": "Dantewada", "name": "Balpet", "villages": "Balpet, Bhairamband"},
    {"block": "Dantewada", "name": "Balud", "villages": "Balud"},
    {"block": "Dantewada", "name": "Bhaisi", "villages": "Porokamel"},
    {"block": "Dantewada", "name": "Bhansi", "villages": "Bhansi"},
    {"block": "Dantewada", "name": "Bhogam", "villages": "Bhogam, Purantarai"},
    {"block": "Dantewada", "name": "Chandenar", "villages": "Chandenar"},
    {"block": "Dantewada", "name": "Chitalank", "villages": "Chitalank"},
    {"block": "Dantewada", "name": "Chitaloor", "villages": "Chitaloor"},
    {"block": "Dantewada", "name": "Degalras", "villages": "Markanar"},
    {"block": "Dantewada", "name": "Dhurli", "villages": "Dhurli"},
    {"block": "Dantewada", "name": "Dugeli", "villages": "Dugeli"},
    {"block": "Dantewada", "name": "Fulnar", "villages": "Fulnar, Muskel"},
    {"block": "Dantewada", "name": "Gadapal", "villages": "Gadapal"},
    {"block": "Dantewada", "name": "Gamawada", "villages": "Gamawada"},
    {"block": "Dantewada", "name": "Ganjenar", "villages": "Ganjenar"},
    {"block": "Dantewada", "name": "Jaram", "villages": "Jaram, Mendoli"},
    {"block": "Dantewada", "name": "Kamaloor", "villages": "Basanpur, Kamaloor, Kundeli"},
    {"block": "Dantewada", "name": "Kawadgaon", "villages": "Dadpal, Dumam, Kawadgaon"},
    {"block": "Dantewada", "name": "Kawalnar", "villages": "Kawalnar"},
    {"block": "Dantewada", "name": "Keshpur", "villages": "Keshpur, Midkulnar"},
    {"block": "Dantewada", "name": "Kumharras", "villages": "Karnjener, Kumharras"},
    {"block": "Dantewada", "name": "Mangnar", "villages": "Kuper, Mangnar"},
    {"block": "Dantewada", "name": "Masenar", "villages": "Masenar"},
    {"block": "Dantewada", "name": "Matenar", "villages": "Matenar, Murkee"},
    {"block": "Dantewada", "name": "Metapal", "villages": "Metapal, Metapal-2"},
    {"block": "Dantewada", "name": "Molasnar", "villages": "Kuhchepal, Molasnar, Udela"},
    {"block": "Dantewada", "name": "Nareli", "villages": "Behnar"},
    {"block": "Dantewada", "name": "Nerli", "villages": "Nerli"},
    {"block": "Dantewada", "name": "Netapur", "villages": "Badegodre, Chhotegodre, Netapur"},
    {"block": "Dantewada", "name": "Padhapur", "villages": "Bainpal, Padhapur, Pinabacheli"},
    {"block": "Dantewada", "name": "Pandewar", "villages": "Gadapal, Jhirka, Pandewar"},
    {"block": "Dantewada", "name": "Pondum", "villages": "Pondum"},
    {"block": "Dantewada", "name": "Pondum-2", "villages": "Pondum-2"},
    {"block": "Dantewada", "name": "Teknar", "villages": "Teknar"},
    {"block": "Dantewada", "name": "Toylanka", "villages": "Toylanka"},
    {"block": "Dantewada", "name": "Tudparas", "villages": "Degalras, Tudparas"},
    {"block": "Geedam", "name": "Aalnar", "villages": "Alnar, Kurenar, Masodi"},
    {"block": "Geedam", "name": "Badekarli", "villages": "Badekarli"},
    {"block": "Geedam", "name": "Badepaneda", "villages": "Badepaneda"},
    {"block": "Geedam", "name": "Badesurokhi", "villages": "Badesurokhi, Siyanar"},
    {"block": "Geedam", "name": "Badetumnar", "villages": "Badetumnar"},
    {"block": "Geedam", "name": "Bangapaal", "villages": "Muhander"},
    {"block": "Geedam", "name": "Bangapal", "villages": "Bangapal"},
    {"block": "Geedam", "name": "Bhatpal", "villages": "Bhatpal, Neurnar, Udenar"},
    {"block": "Geedam", "name": "Binjam", "villages": "Binjam"},
    {"block": "Geedam", "name": "Bodali", "villages": "Farasmadur, Fundari, Paraspal"},
    {"block": "Geedam", "name": "Cherpal", "villages": "Cherpal, Chhote Karka, Padmeta"},
    {"block": "Geedam", "name": "Chhindnar", "villages": "Chhindnar"},
    {"block": "Geedam", "name": "Chotetumnar", "villages": "Chhotetumar, Kandakarka"},
    {"block": "Geedam", "name": "Faraspal", "villages": "Faraspal"},
    {"block": "Geedam", "name": "Ghotpal", "villages": "Ghotpal"},
    {"block": "Geedam", "name": "Gumalnar", "villages": "Gumalnar, Nelgoda"},
    {"block": "Geedam", "name": "Gumda", "villages": "Gumda"},
    {"block": "Geedam", "name": "Gutoli", "villages": "Gutoli, Tarlapal"},
    {"block": "Geedam", "name": "Haram", "villages": "Haram"},
    {"block": "Geedam", "name": "Haurnar", "villages": "Haurnar"},
    {"block": "Geedam", "name": "Hidhpal", "villages": "Balengpal"},
    {"block": "Geedam", "name": "Hidpal", "villages": "Bhalunala, Hidpal, Norli, Tondama"},
    {"block": "Geedam", "name": "Hiranar", "villages": "Hiranar"},
    {"block": "Geedam", "name": "Hitameta", "villages": "Hitameta"},
    {"block": "Geedam", "name": "Javanga", "villages": "Jaunga"},
    {"block": "Geedam", "name": "Jhodiyawadam", "villages": "Jhodiyawadam, Kutulnar"},
    {"block": "Geedam", "name": "Jodatarai", "villages": "Harla, Jodatarai"},
    {"block": "Geedam", "name": "Karli 2", "villages": "Karli 2"},
    {"block": "Geedam", "name": "Karli-1", "villages": "Karli-1"},
    {"block": "Geedam", "name": "Kasoli", "villages": "Budhpadar, Japodi, Kasoli"},
    {"block": "Geedam", "name": "Katulnar", "villages": "Katulnar, Madhpal"},
    {"block": "Geedam", "name": "Kaurgaon", "villages": "Kaurgaon"},
    {"block": "Geedam", "name": "Korkoti", "villages": "Korkoti, Reka"},
    {"block": "Geedam", "name": "Korlapal", "villages": "Korlapal, Nagphani"},
    {"block": "Geedam", "name": "Madase", "villages": "Madase"},
    {"block": "Geedam", "name": "Mofalnar", "villages": "Mofalnar"},
    {"block": "Geedam", "name": "Muchnar", "villages": "Malemunda, Muchnar"},
    {"block": "Geedam", "name": "Mustalnar", "villages": "Mustalnar, Salnar"},
    {"block": "Geedam", "name": "Nagul", "villages": "Hiroli, Nagul"},
    {"block": "Geedam", "name": "Pahurnar", "villages": "Badekarka, Pahurnar"},
    {"block": "Geedam", "name": "Ronje", "villages": "Ronje"},
    {"block": "Geedam", "name": "Samlur", "villages": "Samlur"},
    {"block": "Geedam", "name": "Tumirgunda", "villages": "Tumirgunda"},
    {"block": "Geedam", "name": "Upet", "villages": "Purantarai, Upet"},
    {"block": "Katekalyan", "name": "Badebedma", "villages": "Bade Bedma"},
    {"block": "Katekalyan", "name": "Badegadam", "villages": "Badegadam, Kidariras, Pratapgir"},
    {"block": "Katekalyan", "name": "Badegudra", "villages": "Badegudra"},
    {"block": "Katekalyan", "name": "Badelekhapal", "villages": "Badelekhapal"},
    {"block": "Katekalyan", "name": "Bengalur", "villages": "Bengalur"},
    {"block": "Katekalyan", "name": "Bhusaras", "villages": "Bhusaras"},
    {"block": "Katekalyan", "name": "Chhotegudra", "villages": "Atepal, Chhotegudra, Jihakodata"},
    {"block": "Katekalyan", "name": "Chikpal", "villages": "Chikpal, Munaga"},
    {"block": "Katekalyan", "name": "Darva", "villages": "Chhote Gatam"},
    {"block": "Katekalyan", "name": "Dhanikarka", "villages": "Burdikarka, Dhanikarka, Duvalikarka"},
    {"block": "Katekalyan", "name": "Edpal", "villages": "Dodpal, Dudhiras, Edpal"},
    {"block": "Katekalyan", "name": "Gatam", "villages": "Gatam, Mathadi"},
    {"block": "Katekalyan", "name": "Gudse", "villages": "Gudase"},
    {"block": "Katekalyan", "name": "Jangampal", "villages": "Chhote Lakhapaal, Jangampal, Tongpal"},
    {"block": "Katekalyan", "name": "Katekalyan", "villages": "Katekalyan, Lakharas"},
    {"block": "Katekalyan", "name": "Koriras", "villages": "Chhote Gatam, Koriras"},
    {"block": "Katekalyan", "name": "Maharakarka", "villages": "Chhotehadma Munda, Mahrakarka"},
    {"block": "Katekalyan", "name": "Marjum", "villages": "Marjum"},
    {"block": "Katekalyan", "name": "Mokhpal", "villages": "Mokhpal"},
    {"block": "Katekalyan", "name": "Parcheli", "villages": "Nadenar, Parcheli"},
    {"block": "Katekalyan", "name": "Surnar", "villages": "Surnar"},
    {"block": "Katekalyan", "name": "Tetam", "villages": "Kodripal, Nayanar, Tetam"},
    {"block": "Katekalyan", "name": "Tumakpal", "villages": "Tumakpal"},
    {"block": "Kuakonda", "name": "Aranpur", "villages": "Acheli, Aranpur, Mendpal"},
    {"block": "Kuakonda", "name": "Burgum", "villages": "Burgum, Pujaripal"},
    {"block": "Kuakonda", "name": "Gadhmiri", "villages": "Gadhmiri"},
    {"block": "Kuakonda", "name": "Garhmiri", "villages": "Reganar"},
    {"block": "Kuakonda", "name": "Gongpal", "villages": "Bade Hadhmamunda, Gongpal"},
    {"block": "Kuakonda", "name": "Gumiyapal", "villages": "Aalnar, Gumiyapal"},
    {"block": "Kuakonda", "name": "Hiroli", "villages": "Hiroli, Pirnar"},
    {"block": "Kuakonda", "name": "Hitawar", "villages": "Hitawar"},
    {"block": "Kuakonda", "name": "Jabeli", "villages": "Jabeli"},
    {"block": "Kuakonda", "name": "Kadampal", "villages": "Kadampal"},
    {"block": "Kuakonda", "name": "Kalepal", "villages": "Cholnar, Kalepal"},
    {"block": "Kuakonda", "name": "Kodenar", "villages": "Kodenar"},
    {"block": "Kuakonda", "name": "Kuakonda", "villages": "Halbaras, Kuakonda"},
    {"block": "Kuakonda", "name": "Kutrem", "villages": "Kutrem, Pedka, Taneli"},
    {"block": "Kuakonda", "name": "Madadi", "villages": "Madadi, Perpa"},
    {"block": "Kuakonda", "name": "Mahrahaunraar", "villages": "Doriras, Lendra, Mahrahaurnar, Penta"},
    {"block": "Kuakonda", "name": "Mailawada", "villages": "Mailawada"},
    {"block": "Kuakonda", "name": "Nahadi", "villages": "Kakdi, Muler, Nahadi"},
    {"block": "Kuakonda", "name": "Nakulnar", "villages": "Nakulnar"},
    {"block": "Kuakonda", "name": "Neelavaya", "villages": "Arbe"},
    {"block": "Kuakonda", "name": "Nilawaya", "villages": "Nilawaya"},
    {"block": "Kuakonda", "name": "Palnar", "villages": "Palnar"},
    {"block": "Kuakonda", "name": "Phulpad", "villages": "Pulpad"},
    {"block": "Kuakonda", "name": "Potli", "villages": "Potli"},
    {"block": "Kuakonda", "name": "Rewali", "villages": "Barrem, Rewali"},
    {"block": "Kuakonda", "name": "Samalwar", "villages": "Madkamiras, Samalwar"},
    {"block": "Kuakonda", "name": "Sameli", "villages": "Madenda, Sameli"},
    {"block": "Kuakonda", "name": "Shyamgiri", "villages": "Khutepal, Samgiri"},
    {"block": "Kuakonda", "name": "Tikanpal", "villages": "Tikanpal"},
]


def _normalize_text(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_status(value: Optional[str]) -> str:
    status = (value or "").strip().lower()
    if status in {"planned", "plan"}:
        return "Planned"
    if status in {"done", "completed", "complete"}:
        return "Done"
    return "Draft"


def _get_or_create_planning_note(db: Session) -> models.FieldVisitPlanningNote:
    row = db.query(models.FieldVisitPlanningNote).order_by(models.FieldVisitPlanningNote.id.asc()).first()
    if row:
        return row
    row = models.FieldVisitPlanningNote(note_text="", home_base="Collectorate, Dantewada")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _serialize_planning_note(row: models.FieldVisitPlanningNote) -> dict:
    return {
        "id": row.id,
        "note_text": row.note_text or "",
        "home_base": row.home_base or "Collectorate, Dantewada",
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _split_sample_villages(value: Optional[str]) -> List[str]:
    return [_normalize_text(item) for item in re.split(r"[,;]", value or "") if _normalize_text(item)]


def _ensure_default_gp_master(db: Session) -> None:
    # Older deployments created the GP table before district support existed.
    db.query(models.GramPanchayat).filter(
        models.GramPanchayat.district == None
    ).update({"district": "Dantewada"}, synchronize_session=False)
    db.commit()

    has_dantewada = db.query(models.GramPanchayat.id).filter(
        models.GramPanchayat.is_active == True,
        models.GramPanchayat.district == "Dantewada",
    ).first()
    if has_dantewada:
        return

    for item in DEFAULT_GP_MASTER:
        villages = _split_sample_villages(item.get("villages"))
        db.add(models.GramPanchayat(
            district="Dantewada",
            block=_normalize_text(item.get("block")) or "Unassigned",
            name=_normalize_text(item.get("name")),
            sample_villages=", ".join(villages),
            village_count=len(villages),
            is_active=True,
        ))
    db.commit()


def _gp_status(last_visit: Optional[date], has_legacy_visit: bool = False) -> str:
    if not last_visit:
        if has_legacy_visit:
            return "legacy"
        return "never"
    days = (date.today() - last_visit).days
    if days <= 30:
        return "recent"
    if days <= 90:
        return "visited"
    return "stale"


def _status_label(status: str) -> str:
    return {
        "recent": "Visited in last 30 days",
        "visited": "Visited in last 90 days",
        "stale": "Not visited in 90+ days",
        "legacy": "Visited before tracking",
        "never": "Never visited",
    }.get(status, "Unknown")


def _available_gp_districts(db: Session) -> List[str]:
    _ensure_default_gp_master(db)
    rows = db.query(models.GramPanchayat.district).filter(
        models.GramPanchayat.is_active == True
    ).group_by(
        models.GramPanchayat.district
    ).order_by(
        models.GramPanchayat.district.asc()
    ).all()
    return [row[0] or "Dantewada" for row in rows]


def _build_coverage_payload(db: Session, district: Optional[str] = None) -> dict:
    districts = _available_gp_districts(db)
    requested_district = _normalize_text(district)
    selected_district = requested_district if requested_district in districts else None
    if not selected_district:
        selected_district = "Dantewada" if "Dantewada" in districts else (districts[0] if districts else "Dantewada")

    gp_rows = db.query(models.GramPanchayat).filter(
        models.GramPanchayat.is_active == True,
        models.GramPanchayat.district == selected_district,
    ).order_by(
        models.GramPanchayat.block.asc(),
        models.GramPanchayat.name.asc(),
    ).all()

    gp_ids = [row.id for row in gp_rows]
    stats = {}
    if gp_ids:
        visit_rows = db.query(models.FieldVisitGPVisit).filter(
            models.FieldVisitGPVisit.gp_id.in_(gp_ids)
        ).all()
        for visit in visit_rows:
            entry = stats.setdefault(visit.gp_id, {
                "visit_count": 0,
                "legacy_count": 0,
                "last_visit_date": None,
            })
            entry["visit_count"] += 1
            visit_type = (visit.visit_type or visit.source or "exact").lower()
            if visit_type == "legacy" or (visit.source or "").lower() == "legacy":
                entry["legacy_count"] += 1
                continue
            if visit.visited_on and (entry["last_visit_date"] is None or visit.visited_on > entry["last_visit_date"]):
                entry["last_visit_date"] = visit.visited_on

    items = []
    block_summary = defaultdict(lambda: {
        "block": "",
        "total": 0,
        "visited": 0,
        "never": 0,
        "recent": 0,
        "stale": 0,
        "legacy": 0,
        "coverage_pct": 0,
    })

    for row in gp_rows:
        row_stats = stats.get(row.id, {})
        visit_count = int(row_stats.get("visit_count") or 0)
        legacy_count = int(row_stats.get("legacy_count") or 0)
        last_visit = row_stats.get("last_visit_date")
        status = _gp_status(last_visit, legacy_count > 0)
        days_since = (date.today() - last_visit).days if last_visit else None
        block = row.block or "Unassigned"
        summary = block_summary[block]
        summary["block"] = block
        summary["total"] += 1
        if visit_count:
            summary["visited"] += 1
        else:
            summary["never"] += 1
        if status == "recent":
            summary["recent"] += 1
        if status == "stale":
            summary["stale"] += 1
        if status == "legacy":
            summary["legacy"] += 1

        items.append({
            "id": row.id,
            "district": row.district or selected_district,
            "block": block,
            "name": row.name,
            "sample_villages": row.sample_villages or "",
            "village_count": row.village_count or 0,
            "latitude": row.latitude,
            "longitude": row.longitude,
            "map_x": row.map_x,
            "map_y": row.map_y,
            "visit_count": visit_count,
            "legacy_visit_count": legacy_count,
            "last_visit_date": str(last_visit) if last_visit else None,
            "days_since_last_visit": days_since,
            "status": status,
            "status_label": _status_label(status),
        })

    for summary in block_summary.values():
        total = summary["total"] or 0
        visited = summary["visited"] or 0
        summary["coverage_pct"] = round((visited / total) * 100, 1) if total else 0

    total_gps = len(items)
    visited_gps = sum(1 for item in items if item["visit_count"] > 0)
    recent_gps = sum(1 for item in items if item["status"] == "recent")
    stale_gps = sum(1 for item in items if item["status"] == "stale")
    legacy_gps = sum(1 for item in items if item["status"] == "legacy")
    never_gps = total_gps - visited_gps

    return {
        "district": selected_district,
        "districts": districts,
        "summary": {
            "total_gps": total_gps,
            "visited_gps": visited_gps,
            "never_visited_gps": never_gps,
            "recent_gps": recent_gps,
            "stale_gps": stale_gps,
            "legacy_gps": legacy_gps,
            "coverage_pct": round((visited_gps / total_gps) * 100, 1) if total_gps else 0,
        },
        "blocks": sorted(block_summary.values(), key=lambda item: item["block"]),
        "gram_panchayats": items,
    }


def _extract_location_from_note_line(line: str) -> Optional[str]:
    text = _normalize_text(line)
    if not text:
        return None

    if "|" in text:
        first = _normalize_text(text.split("|", 1)[0])
        if first:
            return first

    gp_match = re.search(
        r"(?:\bgram panchayat\b|\bpanchayat\b|\bgp\b)\s*[:\-]?\s*([a-z0-9 .()&/-]{2,})",
        text,
        flags=re.IGNORECASE,
    )
    if gp_match:
        return _normalize_text(gp_match.group(1))

    at_match = re.search(r"@\s*([a-z0-9 .()&/-]{2,})", text, flags=re.IGNORECASE)
    if at_match:
        return _normalize_text(at_match.group(1))

    tokens = re.split(r"\s[-:]\s", text, maxsplit=1)
    if len(tokens) == 2 and tokens[0] and len(tokens[0]) <= 50:
        return _normalize_text(tokens[0])

    return None


def _infer_theme(text: str) -> str:
    hay = (text or "").lower()
    best_theme = "general"
    best_score = 0
    for theme, hints in THEME_HINTS.items():
        score = sum(1 for token in hints if token in hay)
        if score > best_score:
            best_theme = theme
            best_score = score
    return best_theme


def _extract_route_anchor(text: str, fallback_location: Optional[str] = None) -> str:
    hay = _normalize_text(text).lower()
    patterns = [
        r"\bjanpad\s+[a-z0-9 .-]{2,35}",
        r"\bblock\s+[a-z0-9 .-]{2,35}",
        r"\btehsil\s+[a-z0-9 .-]{2,35}",
        r"\bgram panchayat\s+[a-z0-9 .-]{2,35}",
        r"\bgp\s+[a-z0-9 .-]{2,25}",
    ]
    for pattern in patterns:
        match = re.search(pattern, hay, flags=re.IGNORECASE)
        if match:
            candidate = _normalize_text(match.group(0)).lower()
            candidate = re.sub(r"\b(route|visit|visits)\b", "", candidate).strip()
            if len(candidate.replace(" ", "")) >= 4:
                return candidate

    location = _normalize_text(fallback_location).lower()
    if location:
        cleaned = re.sub(r"[^a-z0-9 ]", " ", location)
        words = [w for w in cleaned.split() if w and w not in GENERIC_ROUTE_WORDS]
        if len(words) >= 2:
            return " ".join(words[:3])
        if words:
            return words[0]

    cleaned = re.sub(r"[^a-z0-9 ]", " ", hay)
    words = [w for w in cleaned.split() if w and w not in GENERIC_ROUTE_WORDS]
    if len(words) >= 2:
        return " ".join(words[:2])
    if words and len(words[0]) >= 4:
        return words[0]
    return "mixed-route"


def _extract_places_from_text(text: str) -> List[str]:
    cleaned = _normalize_text(text)
    if not cleaned:
        return []
    chunks = []
    if "|" in cleaned:
        parts = [p.strip() for p in cleaned.split("|") if p.strip()]
        chunks.extend(parts[:2])
    for part in re.split(r"[,:;]\s*", cleaned):
        candidate = part.strip()
        if len(candidate) < 3:
            continue
        if candidate.lower() in {"etc", "where", "mostly", "bike", "route"}:
            continue
        if re.search(r"\b(worst|priority|urgent|critical)\b", candidate, flags=re.IGNORECASE):
            continue
        chunks.append(candidate)
    normalized = []
    seen = set()
    for chunk in chunks:
        value = _normalize_text(chunk)
        key = value.lower()
        if not value or key in seen:
            continue
        seen.add(key)
        normalized.append(value)
    return normalized[:6]


def _line_priority_score(line: str) -> int:
    text = (line or "").lower()
    score = 2
    for token in HIGH_PRIORITY_KEYWORDS:
        if token in text:
            score += 3
    if re.search(r"\b(high|p1|priority)\b", text):
        score += 2
    if re.search(r"\b(low|minor)\b", text):
        score -= 1
    return max(1, score)


def _build_note_candidates(note_text: str) -> List[dict]:
    rows = []
    for idx, raw in enumerate((note_text or "").splitlines(), start=1):
        line = _normalize_text(re.sub(r"^[-*•\u2022]\s*", "", raw))
        if not line:
            continue
        places = _extract_places_from_text(line)
        location = _extract_location_from_note_line(line) or (places[0] if places else None)
        theme = _infer_theme(line)
        route_anchor = _extract_route_anchor(line, location)
        rows.append({
            "source_type": "notepad",
            "source_id": idx,
            "title": line[:200],
            "location": location,
            "details": line,
            "theme": theme,
            "route_anchor": route_anchor,
            "places": places,
            "score": _line_priority_score(line),
            "duration_minutes": 60,
        })
    return rows


def _route_key(location: Optional[str], fallback: str = "general-route") -> str:
    text = _normalize_text(location).lower()
    if not text:
        return fallback
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    words = [w for w in text.split() if w and w not in GENERIC_ROUTE_WORDS]
    if not words:
        return fallback
    return " ".join(words[:3])


def _looks_generic_route_key(value: Optional[str]) -> bool:
    key = _normalize_text(value).lower()
    if not key:
        return True
    if key in {"mixed-route", "general-route", "route", "general", "mixed"}:
        return True
    if len(key.replace(" ", "")) <= 3:
        return True
    words = [w for w in key.split() if w]
    if words and all(w in GENERIC_ROUTE_WORDS for w in words):
        return True
    return False


def _pretty_route_label(route_key: str, items: List[dict]) -> str:
    for item in items:
        location = _normalize_text(item.get("location"))
        if location and len(location) >= 4:
            return location
    if route_key and not _looks_generic_route_key(route_key):
        return route_key.replace("-", " ").title()
    theme = next((item.get("theme") for item in items if item.get("theme")), "general")
    return f"{str(theme).title()} Cluster"


def _draft_score(draft: models.FieldVisitDraft) -> int:
    score = 3
    if _normalize_status(draft.status) == "Planned":
        score += 2
    hay = " ".join([
        draft.title or "",
        draft.theme or "",
        draft.focus_points or "",
        draft.visit_places_note or "",
    ]).lower()
    for token in HIGH_PRIORITY_KEYWORDS:
        if token in hay:
            score += 2
    return max(1, score)


def _build_google_maps_route_link(home_base: str, stops: List[str]) -> Optional[str]:
    valid = [_normalize_text(stop) for stop in (stops or []) if _normalize_text(stop)]
    if not valid:
        return None
    origin = urllib.parse.quote(home_base or "Collectorate, Dantewada")
    if len(valid) == 1:
        destination = urllib.parse.quote(valid[0])
        return f"https://www.google.com/maps/dir/?api=1&origin={origin}&destination={destination}"
    destination = urllib.parse.quote(valid[-1])
    waypoints = urllib.parse.quote("|".join(valid[:-1]))
    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin}"
        f"&destination={destination}"
        f"&waypoints={waypoints}"
    )


def _build_maps_search_link(query: Optional[str]) -> Optional[str]:
    text = _normalize_text(query)
    if not text:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(text)}"


def _serialize_draft(draft: models.FieldVisitDraft) -> dict:
    return {
        "id": draft.id,
        "title": draft.title,
        "theme": draft.theme,
        "location": draft.location,
        "village": draft.village,
        "department_id": draft.department_id,
        "department_name": draft.department.name if draft.department else None,
        "focus_points": draft.focus_points,
        "preferred_day": draft.preferred_day,
        "map_link": draft.map_link,
        "est_duration_minutes": draft.est_duration_minutes,
        "planned_date": str(draft.planned_date) if draft.planned_date else None,
        "planned_time": draft.planned_time,
        "visit_places_note": draft.visit_places_note,
        "people_going": draft.people_going,
        "status": _normalize_status(draft.status),
        "planner_event_id": draft.planner_event_id,
        "order_index": draft.order_index if draft.order_index is not None else 0,
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
    }


def _get_draft_or_404(db: Session, draft_id: int) -> models.FieldVisitDraft:
    draft = db.query(models.FieldVisitDraft).options(
        joinedload(models.FieldVisitDraft.department)
    ).filter(models.FieldVisitDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Field visit draft not found")
    return draft


class FieldVisitDraftCreate(BaseModel):
    title: str
    theme: Optional[str] = "General"
    location: Optional[str] = None
    village: Optional[str] = None
    department_id: Optional[int] = None
    focus_points: Optional[str] = None
    preferred_day: Optional[str] = None
    map_link: Optional[str] = None
    est_duration_minutes: Optional[int] = 120
    planned_date: Optional[date] = None
    planned_time: Optional[str] = None
    visit_places_note: Optional[str] = None
    people_going: Optional[str] = None
    status: Optional[str] = "Draft"
    order_index: Optional[int] = None


class FieldVisitDraftUpdate(BaseModel):
    title: Optional[str] = None
    theme: Optional[str] = None
    location: Optional[str] = None
    village: Optional[str] = None
    department_id: Optional[int] = None
    focus_points: Optional[str] = None
    preferred_day: Optional[str] = None
    map_link: Optional[str] = None
    est_duration_minutes: Optional[int] = None
    planned_date: Optional[date] = None
    planned_time: Optional[str] = None
    visit_places_note: Optional[str] = None
    people_going: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None


class ReorderDraftsPayload(BaseModel):
    ordered_ids: List[int]


class PlanningNotesUpdate(BaseModel):
    note_text: Optional[str] = ""
    home_base: Optional[str] = "Collectorate, Dantewada"


class SuggestionRequest(BaseModel):
    visit_date: Optional[date] = None
    max_stops: Optional[int] = 4


class GPVisitMarkPayload(BaseModel):
    gp_ids: List[int]
    visited_on: Optional[date] = None
    notes: Optional[str] = None
    visit_type: Optional[str] = "exact"


class GramPanchayatUpsertItem(BaseModel):
    name: str
    district: Optional[str] = "Dantewada"
    block: Optional[str] = "Unassigned"
    sample_villages: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    map_x: Optional[float] = None
    map_y: Optional[float] = None


class GramPanchayatBulkUpsertPayload(BaseModel):
    items: List[GramPanchayatUpsertItem]


@router.get("/coverage")
def get_gp_visit_coverage(district: Optional[str] = None, db: Session = Depends(get_db)):
    return _build_coverage_payload(db, district=district)


@router.post("/coverage/mark-visited")
def mark_gp_visits(data: GPVisitMarkPayload, db: Session = Depends(get_db)):
    _ensure_default_gp_master(db)
    gp_ids = sorted({int(gp_id) for gp_id in (data.gp_ids or []) if gp_id})
    if not gp_ids:
        raise HTTPException(status_code=400, detail="Select at least one Gram Panchayat")
    if len(gp_ids) > 500:
        raise HTTPException(status_code=400, detail="Too many Gram Panchayats selected at once")

    rows = db.query(models.GramPanchayat).filter(
        models.GramPanchayat.id.in_(gp_ids),
        models.GramPanchayat.is_active == True,
    ).all()
    found_ids = {row.id for row in rows}
    missing = [gp_id for gp_id in gp_ids if gp_id not in found_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Gram Panchayat not found: {missing[0]}")

    visit_type = (data.visit_type or "exact").strip().lower()
    if visit_type not in {"exact", "legacy"}:
        visit_type = "exact"
    # Legacy marks deliberately avoid stamping "today" when the exact historical
    # date is unknown. A stable placeholder keeps older DBs with NOT NULL dates happy.
    visited_on = data.visited_on or (date(2000, 1, 1) if visit_type == "legacy" else date.today())
    notes = _normalize_text(data.notes)
    for gp_id in gp_ids:
        db.add(models.FieldVisitGPVisit(
            gp_id=gp_id,
            visited_on=visited_on,
            visit_type=visit_type,
            notes=notes or None,
            source="legacy" if visit_type == "legacy" else "manual",
        ))
    db.commit()
    district = rows[0].district if rows else None
    return _build_coverage_payload(db, district=district)


@router.post("/gram-panchayats/bulk-upsert")
def bulk_upsert_gram_panchayats(data: GramPanchayatBulkUpsertPayload, db: Session = Depends(get_db)):
    incoming = data.items or []
    if not incoming:
        raise HTTPException(status_code=400, detail="No Gram Panchayat rows provided")
    if len(incoming) > 500:
        raise HTTPException(status_code=400, detail="Too many rows. Please import up to 500 at a time.")

    existing = db.query(models.GramPanchayat).all()
    by_key = {
        (
            _normalize_text(row.district or "Dantewada").lower(),
            _normalize_text(row.block).lower(),
            _normalize_text(row.name).lower(),
        ): row
        for row in existing
    }

    updated = 0
    created = 0
    first_district = None
    for item in incoming:
        name = _normalize_text(item.name)
        district = _normalize_text(item.district) or "Dantewada"
        block = _normalize_text(item.block) or "Unassigned"
        if not name:
            continue
        if first_district is None:
            first_district = district
        key = (district.lower(), block.lower(), name.lower())
        sample_villages = _normalize_text(item.sample_villages)
        village_count = len(_split_sample_villages(sample_villages))
        row = by_key.get(key)
        if row:
            row.district = district
            row.block = block
            row.name = name
            row.sample_villages = sample_villages or row.sample_villages
            row.village_count = village_count or row.village_count or 0
            row.latitude = item.latitude
            row.longitude = item.longitude
            row.map_x = item.map_x
            row.map_y = item.map_y
            row.is_active = True
            updated += 1
        else:
            row = models.GramPanchayat(
                district=district,
                block=block,
                name=name,
                sample_villages=sample_villages or None,
                village_count=village_count,
                latitude=item.latitude,
                longitude=item.longitude,
                map_x=item.map_x,
                map_y=item.map_y,
                is_active=True,
            )
            db.add(row)
            by_key[key] = row
            created += 1

    db.commit()
    payload = _build_coverage_payload(db, district=first_district)
    payload["import_result"] = {"created": created, "updated": updated}
    return payload


@router.get("/drafts")
def get_field_visit_drafts(db: Session = Depends(get_db)):
    rows = db.query(models.FieldVisitDraft).options(
        joinedload(models.FieldVisitDraft.department)
    ).order_by(
        models.FieldVisitDraft.order_index.asc(),
        models.FieldVisitDraft.created_at.asc()
    ).all()
    return [_serialize_draft(row) for row in rows]


@router.get("/planning-notes")
def get_field_visit_planning_notes(db: Session = Depends(get_db)):
    return _serialize_planning_note(_get_or_create_planning_note(db))


@router.put("/planning-notes")
def update_field_visit_planning_notes(data: PlanningNotesUpdate, db: Session = Depends(get_db)):
    row = _get_or_create_planning_note(db)
    payload = data.dict(exclude_unset=True)
    if "note_text" in payload:
        row.note_text = payload.get("note_text") or ""
    if "home_base" in payload:
        row.home_base = _normalize_text(payload.get("home_base")) or "Collectorate, Dantewada"
    db.commit()
    db.refresh(row)
    return _serialize_planning_note(row)


@router.get("/planning-notes/items")
def get_field_visit_planning_note_items(db: Session = Depends(get_db)):
    row = _get_or_create_planning_note(db)
    items = _build_note_candidates(row.note_text or "")
    output = []
    for item in items:
        output.append({
            "line_no": item.get("source_id"),
            "title": item.get("title"),
            "location": item.get("location"),
            "details": item.get("details"),
            "theme": item.get("theme"),
            "priority_score": item.get("score"),
            "route_anchor": item.get("route_anchor"),
            "places": item.get("places") or [],
            "map_link": _build_maps_search_link(item.get("location") or item.get("title")),
        })
    return output


@router.post("/suggestions")
def get_field_visit_suggestions(data: SuggestionRequest, db: Session = Depends(get_db)):
    planning_note = _get_or_create_planning_note(db)
    drafts = db.query(models.FieldVisitDraft).options(
        joinedload(models.FieldVisitDraft.department)
    ).order_by(
        models.FieldVisitDraft.order_index.asc(),
        models.FieldVisitDraft.created_at.asc()
    ).all()
    notes = _build_note_candidates(planning_note.note_text or "")

    candidates = []
    for draft in drafts:
        if _normalize_status(draft.status) == "Done":
            continue
        visit_note = draft.visit_places_note or draft.focus_points or ""
        extracted_places = _extract_places_from_text(visit_note)
        location = _normalize_text(draft.location) or _normalize_text(draft.village) or (extracted_places[0] if extracted_places else None)
        theme = _infer_theme(" ".join(filter(None, [draft.theme, draft.title, visit_note])))
        route_anchor = _extract_route_anchor(" ".join(filter(None, [draft.title, visit_note, draft.location, draft.village])), location)
        candidates.append({
            "source_type": "draft",
            "source_id": draft.id,
            "title": draft.title,
            "location": location,
            "details": visit_note,
            "theme": theme,
            "route_anchor": route_anchor,
            "places": extracted_places,
            "score": _draft_score(draft),
            "duration_minutes": max(30, int(draft.est_duration_minutes or 120)),
            "map_link": draft.map_link,
            "department_id": draft.department_id,
            "department_name": draft.department.name if draft.department else None,
            "people_going": draft.people_going,
            "planned_date": str(draft.planned_date) if draft.planned_date else None,
            "planned_time": draft.planned_time,
        })
    candidates.extend(notes)

    if not candidates:
        return {
            "visit_date": str(data.visit_date or date.today()),
            "home_base": planning_note.home_base or "Collectorate, Dantewada",
            "notepad_items_count": len(notes),
            "draft_items_count": 0,
            "suggestions": [],
        }

    grouped = defaultdict(list)
    for item in candidates:
        key = item.get("route_anchor") or _route_key(item.get("location"), fallback="mixed-route")
        if _looks_generic_route_key(key):
            key = f"mixed-{item.get('theme') or 'general'}"
        grouped[key].append(item)

    # Merge tiny generic buckets into stronger same-theme routes when possible.
    for route in list(grouped.keys()):
        if not route.startswith("mixed-"):
            continue
        items = grouped.get(route) or []
        if len(items) > 2:
            continue
        theme = route.replace("mixed-", "", 1)
        target_route = None
        for candidate_route, candidate_items in grouped.items():
            if candidate_route == route or candidate_route.startswith("mixed-"):
                continue
            if any((x.get("theme") or "general") == theme for x in candidate_items):
                target_route = candidate_route
                break
        if target_route:
            grouped[target_route].extend(items)
            del grouped[route]

    group_rows = []
    for route, items in grouped.items():
        ordered_items = sorted(
            items,
            key=lambda x: (
                x.get("score", 0),
                1 if x.get("source_type") == "notepad" else 0,
                1 if x.get("location") else 0
            ),
            reverse=True
        )
        unique_themes = {it.get("theme") for it in ordered_items if it.get("theme")}
        unique_locations = {it.get("location") for it in ordered_items if it.get("location")}
        priority_sum = sum(x.get("score", 0) for x in ordered_items)
        notepad_boost = sum(1 for x in ordered_items if x.get("source_type") == "notepad") * 0.6
        cohesion_bonus = 0.8 if len(unique_locations) <= max(1, len(ordered_items) // 2 + 1) else 0.0
        coverage_bonus = min(1.2, len(unique_themes) * 0.25)
        total_score = priority_sum + notepad_boost + cohesion_bonus + coverage_bonus
        group_rows.append((route, total_score, ordered_items))

    group_rows.sort(key=lambda x: x[1], reverse=True)

    max_stops = max(2, min(8, int(data.max_stops or 4)))
    suggestions = []
    for idx, (route, _, items) in enumerate(group_rows[:4], start=1):
        chosen = items[:max_stops]
        route_stops = []
        mapped_stops = []
        total_minutes = 0
        dept_counter = defaultdict(int)
        people_bits = []
        for item in chosen:
            location = _normalize_text(item.get("location"))
            places = item.get("places") or []
            if places:
                for place in places:
                    normalized = _normalize_text(place)
                    if normalized and normalized not in route_stops:
                        route_stops.append(normalized)
            elif location and location not in route_stops:
                route_stops.append(location)
            total_minutes += int(item.get("duration_minutes") or 60)
            dept_id = item.get("department_id")
            if dept_id:
                dept_counter[dept_id] += 1
            people_going = _normalize_text(item.get("people_going"))
            if people_going:
                people_bits.append(people_going)
            mapped_stops.append({
                "source_type": item.get("source_type"),
                "source_id": item.get("source_id"),
                "title": item.get("title"),
                "location": location,
                "details": item.get("details"),
                "theme": item.get("theme"),
                "department_id": item.get("department_id"),
                "department_name": item.get("department_name"),
                "priority_score": item.get("score"),
                "duration_minutes": int(item.get("duration_minutes") or 60),
                "map_link": item.get("map_link") or _build_maps_search_link(location or item.get("title")),
            })

        suggested_department_id = max(dept_counter, key=dept_counter.get) if dept_counter else None
        suggested_department_name = None
        if suggested_department_id:
            for item in chosen:
                if item.get("department_id") == suggested_department_id:
                    suggested_department_name = item.get("department_name")
                    break

        visit_lines = []
        for stop_idx, stop in enumerate(mapped_stops, start=1):
            base_line = stop.get("location") or stop.get("title") or "Visit point"
            detail = _normalize_text(stop.get("details"))
            if detail and detail.lower() not in base_line.lower():
                visit_lines.append(f"{stop_idx}. {base_line} — {detail}")
            else:
                visit_lines.append(f"{stop_idx}. {base_line}")

        route_label = _pretty_route_label(route, chosen)

        suggestions.append({
            "plan_title": f"Day Plan {idx}: {route_label} Route",
            "route_key": route,
            "visit_date": str(data.visit_date or date.today()),
            "estimated_total_minutes": total_minutes,
            "stop_count": len(mapped_stops),
            "stops": mapped_stops,
            "suggested_title": f"{route_label} Field Visit",
            "suggested_department_id": suggested_department_id,
            "suggested_department_name": suggested_department_name,
            "suggested_people_going": ", ".join(sorted(set(people_bits))) if people_bits else None,
            "suggested_visit_places_note": "\n".join(visit_lines),
            "route_map_link": _build_google_maps_route_link(planning_note.home_base or "Collectorate, Dantewada", route_stops),
        })

    return {
        "visit_date": str(data.visit_date or date.today()),
        "home_base": planning_note.home_base or "Collectorate, Dantewada",
        "notepad_items_count": len(notes),
        "draft_items_count": len([d for d in drafts if _normalize_status(d.status) != "Done"]),
        "suggestions": suggestions,
    }


@router.get("/drafts/{draft_id}")
def get_field_visit_draft(draft_id: int, db: Session = Depends(get_db)):
    return _serialize_draft(_get_draft_or_404(db, draft_id))


@router.post("/drafts")
def create_field_visit_draft(data: FieldVisitDraftCreate, db: Session = Depends(get_db)):
    payload = data.dict()
    payload["title"] = (payload.get("title") or "").strip()
    if not payload["title"]:
        raise HTTPException(status_code=400, detail="title is required")

    dept_id = payload.get("department_id")
    if dept_id is not None:
        dept = db.query(models.Department).filter(
            models.Department.id == dept_id,
            models.Department.is_active == True
        ).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")

    status = _normalize_status(payload.get("status"))
    order_index = payload.get("order_index")
    if order_index is None:
        max_order = db.query(func.max(models.FieldVisitDraft.order_index)).scalar()
        order_index = (max_order or 0) + 1

    draft = models.FieldVisitDraft(
        title=payload["title"],
        theme=(payload.get("theme") or "General").strip() or "General",
        location=(payload.get("location") or None),
        village=(payload.get("village") or None),
        department_id=dept_id,
        focus_points=payload.get("focus_points"),
        preferred_day=payload.get("preferred_day"),
        map_link=payload.get("map_link"),
        est_duration_minutes=max(30, int(payload.get("est_duration_minutes") or 120)),
        planned_date=payload.get("planned_date"),
        planned_time=_normalize_text(payload.get("planned_time")),
        visit_places_note=payload.get("visit_places_note"),
        people_going=payload.get("people_going"),
        status=status,
        order_index=max(0, int(order_index)),
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return _serialize_draft(_get_draft_or_404(db, draft.id))


@router.put("/drafts/{draft_id}")
def update_field_visit_draft(draft_id: int, data: FieldVisitDraftUpdate, db: Session = Depends(get_db)):
    draft = _get_draft_or_404(db, draft_id)
    payload = data.dict(exclude_unset=True)

    if "title" in payload:
        title = (payload.get("title") or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="title cannot be empty")
        draft.title = title

    if "theme" in payload:
        draft.theme = (payload.get("theme") or "General").strip() or "General"
    if "location" in payload:
        draft.location = payload.get("location")
    if "village" in payload:
        draft.village = payload.get("village")
    if "focus_points" in payload:
        draft.focus_points = payload.get("focus_points")
    if "preferred_day" in payload:
        draft.preferred_day = payload.get("preferred_day")
    if "map_link" in payload:
        draft.map_link = payload.get("map_link")
    if "est_duration_minutes" in payload:
        draft.est_duration_minutes = max(30, int(payload.get("est_duration_minutes") or 120))
    if "planned_date" in payload:
        draft.planned_date = payload.get("planned_date")
    if "planned_time" in payload:
        draft.planned_time = _normalize_text(payload.get("planned_time"))
    if "visit_places_note" in payload:
        draft.visit_places_note = payload.get("visit_places_note")
    if "people_going" in payload:
        draft.people_going = payload.get("people_going")
    if "status" in payload:
        draft.status = _normalize_status(payload.get("status"))
    if "order_index" in payload:
        draft.order_index = max(0, int(payload.get("order_index") or 0))

    if "department_id" in payload:
        dept_id = payload.get("department_id")
        if dept_id is None:
            draft.department_id = None
        else:
            dept = db.query(models.Department).filter(
                models.Department.id == dept_id,
                models.Department.is_active == True
            ).first()
            if not dept:
                raise HTTPException(status_code=404, detail="Department not found")
            draft.department_id = dept_id

    db.commit()
    db.refresh(draft)
    return _serialize_draft(_get_draft_or_404(db, draft.id))


@router.post("/drafts/reorder")
def reorder_field_visit_drafts(data: ReorderDraftsPayload, db: Session = Depends(get_db)):
    ordered_ids = [int(x) for x in (data.ordered_ids or [])]
    if not ordered_ids:
        return {"updated": 0}

    rows = db.query(models.FieldVisitDraft).filter(
        models.FieldVisitDraft.id.in_(ordered_ids)
    ).all()
    by_id = {row.id: row for row in rows}

    updated = 0
    for index, draft_id in enumerate(ordered_ids):
        draft = by_id.get(draft_id)
        if not draft:
            continue
        draft.order_index = index
        updated += 1

    db.commit()
    return {"updated": updated}


@router.delete("/drafts/{draft_id}")
def delete_field_visit_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.query(models.FieldVisitDraft).filter(models.FieldVisitDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Field visit draft not found")
    db.delete(draft)
    db.commit()
    return {"ok": True}
