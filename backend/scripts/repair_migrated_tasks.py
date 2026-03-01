#!/usr/bin/env python3
"""
Repair migrated tasks in target ReviewDashboard:
1) Remove duplicate task rows created by repeated migration runs.
2) Shift migrated data mapping:
   - task_number (legacy title) -> description
   - description (legacy detailed notes) -> steno_comment
   - assign a clean generated task_number code.
"""

import argparse
import json
import re
import ssl
import sys
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_TARGET = "https://reviewdashboard-production.up.railway.app"
SSL_CONTEXT: Optional[ssl.SSLContext] = None


def http_json(method: str, url: str, payload: Optional[Dict[str, Any]] = None, timeout: int = 60) -> Any:
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = Request(url=url, data=body, method=method.upper(), headers=headers)
    try:
        with urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"{method} {url} failed: {exc.code} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"{method} {url} failed: {exc}") from exc


def normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def looks_like_code(task_number: str) -> bool:
    tn = (task_number or "").strip()
    if not tn:
        return False
    patterns = [
        r"^[A-Z]{2,8}-\d{1,4}$",
        r"^[A-Z]{2,8}_\d{1,4}$",
        r"^[A-Z]{2,8}\d{2,4}$",
        r"^MIG-\d{3,5}$",
    ]
    return any(re.match(p, tn) for p in patterns)


def is_migrated_style_title(task_number: str) -> bool:
    tn = (task_number or "").strip()
    if not tn:
        return False
    if looks_like_code(tn):
        return False
    return (
        bool(re.search(r"\s", tn))
        or len(tn) > 16
        or bool(re.search(r"[^A-Za-z0-9._\-]", tn))
    )


def dedupe_key(task: Dict[str, Any]) -> str:
    parts = [
        normalize_text(task.get("description")),
        normalize_text(task.get("assigned_agency")),
        str(task.get("allocated_date") or "").strip(),
        str(task.get("deadline_date") or "").strip(),
        normalize_text(task.get("status")),
        normalize_text(task.get("completion_date")),
    ]
    return "|".join(parts)


def choose_keeper(tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
    def rank(task: Dict[str, Any]) -> Tuple[int, int, int]:
        tn = str(task.get("task_number") or "").strip()
        mig_suffix = 1 if re.search(r"-MIG\d+$", tn, re.IGNORECASE) else 0
        return (mig_suffix, len(tn), int(task.get("id") or 0))

    return sorted(tasks, key=rank)[0]


def next_mig_code(existing: Set[str]) -> str:
    idx = 1
    while True:
        code = f"MIG-{idx:03d}"
        if code not in existing:
            existing.add(code)
            return code
        idx += 1


def run_repair(target_base: str, apply_changes: bool) -> None:
    target_base = target_base.rstrip("/")
    tasks = http_json("GET", f"{target_base}/api/tasks/")
    if not isinstance(tasks, list):
        raise RuntimeError("Target tasks response is not a list")

    print(f"Fetched tasks: {len(tasks)}")

    groups: Dict[str, List[Dict[str, Any]]] = {}
    for task in tasks:
        key = dedupe_key(task)
        groups.setdefault(key, []).append(task)

    duplicate_ids: List[int] = []
    for _, items in groups.items():
        if len(items) <= 1:
            continue
        keeper = choose_keeper(items)
        for row in items:
            if int(row.get("id") or 0) != int(keeper.get("id") or -1):
                duplicate_ids.append(int(row.get("id")))

    print(f"Duplicates found: {len(duplicate_ids)}")
    deleted = 0
    if apply_changes:
        for task_id in duplicate_ids:
            try:
                http_json("DELETE", f"{target_base}/api/tasks/{task_id}")
                deleted += 1
            except Exception as exc:
                print(f"Failed to delete duplicate task {task_id}: {exc}")
    print(f"Duplicates deleted: {deleted}")

    # Reload after dedupe before remap
    tasks = http_json("GET", f"{target_base}/api/tasks/")
    if not isinstance(tasks, list):
        raise RuntimeError("Target tasks response is not a list after dedupe")

    existing_numbers = {str(t.get("task_number") or "").strip() for t in tasks if str(t.get("task_number") or "").strip()}

    remap_candidates: List[Tuple[int, Dict[str, Any]]] = []
    for task in tasks:
        old_tn = str(task.get("task_number") or "").strip()
        old_desc = str(task.get("description") or "").strip()
        if not is_migrated_style_title(old_tn):
            continue
        if not old_tn:
            continue

        patch: Dict[str, Any] = {
            "task_number": next_mig_code(existing_numbers),
            "description": old_tn,
        }
        if old_desc:
            patch["steno_comment"] = old_desc

        remap_candidates.append((int(task.get("id")), patch))

    print(f"Remap candidates: {len(remap_candidates)}")
    remapped = 0
    if apply_changes:
        for task_id, patch in remap_candidates:
            try:
                http_json("PUT", f"{target_base}/api/tasks/{task_id}", patch)
                remapped += 1
            except Exception as exc:
                print(f"Failed to remap task {task_id}: {exc}")

    print(f"Tasks remapped: {remapped}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair migrated task data on ReviewDashboard.")
    parser.add_argument("--target-base", default=DEFAULT_TARGET, help="Target dashboard base URL")
    parser.add_argument("--insecure", action="store_true", help="Disable SSL cert verification")
    parser.add_argument("--apply", action="store_true", help="Apply changes (without this, dry-run only)")
    args = parser.parse_args()

    global SSL_CONTEXT
    if args.insecure:
        SSL_CONTEXT = ssl._create_unverified_context()

    print(f"Target: {args.target_base.rstrip('/')}")
    print(f"Mode: {'apply' if args.apply else 'dry-run'}")
    if args.insecure:
        print("SSL verification: disabled")

    try:
        run_repair(args.target_base, args.apply)
    except Exception as exc:
        print(f"Repair failed: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

