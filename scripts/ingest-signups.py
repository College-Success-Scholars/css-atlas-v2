#!/usr/bin/env python3
"""
Parse a sign-up sheet workbook and load shifts into public.scholar_shift_assignments.

Invoked by scripts/ingest-signups.sh. Does not write PII or credentials to disk.
Service role key must come from the environment (set by the shell after an
interactive prompt).

One script serves both sign-up sheets: the per-sheet differences live in
SheetProfile, not in branching logic.

The parse source is the human-facing Sign-Up grid (time rows x weekday columns,
comma-separated names per cell), which exists in both workbooks and is the
surface staff actually edit. The Front Desk workbook also carries hidden
"Schedule Data" tabs; they are separately hand-maintained and already disagree
with the grid, so they are deliberately not read.

Load strategy is delete-scope-then-insert, not upsert: the target table's
overlap rule is a GiST exclusion constraint, which INSERT ... ON CONFLICT cannot
target, and there is no unique constraint to conflict on. Re-running produces an
identical table, which is what idempotency means here.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

BATCH_SIZE_DEFAULT = 50
TABLE = "scholar_shift_assignments"
PAGE_SIZE = 1000

# Postgres DOW: 0=Sunday .. 6=Saturday. The sheets only populate Mon-Fri.
WEEKDAY_TO_DOW: dict[str, int] = {
    "monday": 1, "mondays": 1, "mon": 1,
    "tuesday": 2, "tuesdays": 2, "tue": 2, "tues": 2,
    "wednesday": 3, "wednesdays": 3, "wed": 3,
    "thursday": 4, "thursdays": 4, "thu": 4, "thur": 4, "thurs": 4,
    "friday": 5, "fridays": 5, "fri": 5,
}
DOW_NAME = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday"}

PAYLOAD_FIELDS = (
    "scholar_id",
    "semester_id",
    "session_kind",
    "day_of_week",
    "start_time",
    "end_time",
    "is_active",
    "source",
    "source_tab",
    "source_name",
    "match_method",
    "load_batch_id",
    "updated_at",
)

OPEN_MINUTES = 8 * 60           # 08:00
CLOSE_MINUTES = 20 * 60         # 20:00
SLOT_MINUTES = 30
MIN_BLOCK_MINUTES = 60

SEMINAR_MARKER = "freshman seminar"
UID_RE = re.compile(r"^\d{9}$")
SEMESTER_TAB_RE = re.compile(r"\(([^)]*)\)\s*$")
SEASONS = ("spring", "summer", "fall", "winter")


# ---------------------------------------------------------------------------
# Per-sheet configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SheetProfile:
    """Everything that differs between the two sign-up workbooks."""

    session_kind: str
    tab_patterns: tuple[str, ...]
    semester_from_tab: bool
    closed_markers: frozenset[str]
    required_slots: int | None


FRONT_DESK_PROFILE = SheetProfile(
    session_kind="front_desk",
    tab_patterns=("freshman sign-up", "sophomore sign-up"),
    semester_from_tab=False,
    closed_markers=frozenset({"front desk closed"}),
    required_slots=6,
)

PROFILES: dict[str, SheetProfile] = {
    FRONT_DESK_PROFILE.session_kind: FRONT_DESK_PROFILE,
}


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------


def norm_text(raw: str) -> str:
    """Casefolded, accent-stripped, whitespace-collapsed."""
    if not raw:
        return ""
    decomposed = unicodedata.normalize("NFKD", raw.replace("﻿", ""))
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(stripped.split()).casefold()


def norm_name(raw: str) -> str:
    """Normalized person name: no surrounding punctuation, no doubled spaces."""
    return norm_text(raw).strip(" ,.;:-")


def parse_float(raw: str) -> float | None:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def minutes_to_hhmmss(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}:00"


# ---------------------------------------------------------------------------
# Workbook reading (xlsx is a zip of XML; stdlib only, no openpyxl)
# ---------------------------------------------------------------------------

NS_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

Grid = list[list[str]]


def _col_index(cell_ref: str) -> int:
    """'C5' -> 2 (zero-based column index)."""
    idx = 0
    for ch in cell_ref:
        if not ch.isalpha():
            break
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx - 1


def _shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        blob = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    out: list[str] = []
    for si in ET.fromstring(blob).findall(f"{NS_MAIN}si"):
        out.append("".join(t.text or "" for t in si.iter(f"{NS_MAIN}t")))
    return out


def _sheet_index(zf: zipfile.ZipFile) -> list[tuple[str, str, str]]:
    """[(sheet name, zip part path, visibility)] in workbook order."""
    rels: dict[str, str] = {}
    for rel in ET.fromstring(zf.read("xl/_rels/workbook.xml.rels")):
        rels[rel.get("Id", "")] = rel.get("Target", "")
    out: list[tuple[str, str, str]] = []
    for sheet in ET.fromstring(zf.read("xl/workbook.xml")).iter(f"{NS_MAIN}sheet"):
        target = rels.get(sheet.get(f"{NS_REL}id", ""), "")
        if not target:
            continue
        part = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
        out.append((sheet.get("name", ""), part, sheet.get("state", "visible") or "visible"))
    return out


def _read_sheet(zf: zipfile.ZipFile, part: str, shared: list[str]) -> Grid:
    """Raw cell text as a dense grid. No type coercion - that happens later."""
    grid: Grid = []
    root = ET.fromstring(zf.read(part))
    for row in root.iter(f"{NS_MAIN}row"):
        cells: list[str] = []
        for c in row.findall(f"{NS_MAIN}c"):
            col = _col_index(c.get("r", "") or "")
            if col < 0:
                continue
            ctype = c.get("t", "")
            if ctype == "inlineStr":
                node = c.find(f"{NS_MAIN}is")
                value = "".join(t.text or "" for t in node.iter(f"{NS_MAIN}t")) if node is not None else ""
            else:
                v = c.find(f"{NS_MAIN}v")
                value = (v.text or "") if v is not None else ""
                if ctype == "s" and value:
                    si = int(value)
                    value = shared[si] if 0 <= si < len(shared) else ""
            while len(cells) <= col:
                cells.append("")
            cells[col] = value
        grid.append(cells)
    return grid


def read_xlsx(path: str) -> tuple[dict[str, Grid], dict[str, str]]:
    """Returns (grids by tab name, visibility by tab name)."""
    with zipfile.ZipFile(path) as zf:
        shared = _shared_strings(zf)
        index = _sheet_index(zf)
        grids = {name: _read_sheet(zf, part, shared) for name, part, _ in index}
        states = {name: state for name, _, state in index}
    return grids, states


def count_name_cells(grid: Grid, profile: SheetProfile, from_row: int = 0) -> int:
    """
    How many cells look like sign-ups rather than scaffolding.

    A blank sign-up tab still carries the full time ladder in column A and the
    "closed"/seminar markers, so a plain non-empty check would call it populated.
    Times parse as floats and markers are known strings; whatever is left is a
    name.
    """
    count = 0
    for row in grid[from_row:]:
        for cell in row:
            text = cell.strip()
            if not text or parse_float(text) is not None:
                continue
            normalized = norm_text(text)
            if normalized in profile.closed_markers or normalized == SEMINAR_MARKER:
                continue
            count += 1
    return count


def select_tabs(
    grids: dict[str, Grid],
    profile: SheetProfile,
    requested: list[str] | None,
    states: dict[str, str] | None = None,
) -> tuple[dict[str, Grid], list[dict[str, str]]]:
    """
    Pick the sign-up grid tabs to load.

    Workbook copies can contain near-duplicate tab names differing only by
    surrounding whitespace, where one twin is empty. Normalizing collapses them,
    so when several tabs share a normalized name the populated one wins and the
    choice is reported rather than silently made.
    """
    notes: list[dict[str, str]] = []
    states = states or {}
    if requested:
        wanted = {norm_text(t) for t in requested}
        candidates = {n: g for n, g in grids.items() if norm_text(n) in wanted}
    else:
        candidates = {
            n: g
            for n, g in grids.items()
            if any(norm_text(n).startswith(p) for p in profile.tab_patterns)
        }

    by_norm: dict[str, list[str]] = {}
    for name in candidates:
        by_norm.setdefault(norm_text(name), []).append(name)

    chosen: dict[str, Grid] = {}
    for normalized, names in sorted(by_norm.items()):
        if len(names) == 1:
            pick = names[0]
        else:
            scored = sorted(
                ((count_name_cells(candidates[n], profile), n) for n in names),
                key=lambda pair: (-pair[0], pair[1]),
            )
            best_count, pick = scored[0]
            notes.append(
                {
                    "normalized": normalized,
                    "candidates": " | ".join(
                        f"{n!r} ({c} names, {states.get(n, '?')})" for c, n in scored
                    ),
                    "chosen": f"{pick!r} ({states.get(pick, '?')})",
                    "reason": (
                        "most populated twin preferred"
                        if best_count
                        else "all twins empty; first kept"
                    ),
                }
            )
        chosen[pick] = candidates[pick]
    return chosen, notes


# ---------------------------------------------------------------------------
# Grid parsing
# ---------------------------------------------------------------------------


@dataclass
class RawSlot:
    tab: str
    row: int
    day_of_week: int
    raw_name: str
    start_min: int
    end_min: int


def find_header_row(grid: Grid) -> int:
    """First row carrying at least two weekday tokens. -1 when absent."""
    for i, row in enumerate(grid):
        hits = sum(1 for cell in row if norm_text(cell) in WEEKDAY_TO_DOW)
        if hits >= 2:
            return i
    return -1


def resolve_weekday_columns(grid: Grid, header_row: int) -> tuple[dict[int, int], str]:
    """
    Map column index -> day-of-week.

    A weekday header can be blank even though its column holds data, so the
    mapping is anchored on the headers that *are* present and filled in by
    position rather than trusting header text for every column.
    """
    row = grid[header_row]
    anchors: list[tuple[int, int]] = []
    for col, cell in enumerate(row):
        dow = WEEKDAY_TO_DOW.get(norm_text(cell))
        if dow is not None:
            anchors.append((col, dow))
    if not anchors:
        return {}, "no weekday headers found"

    offsets = {dow - col for col, dow in anchors}
    if len(offsets) != 1:
        return {}, f"weekday headers are not evenly spaced (offsets {sorted(offsets)})"

    offset = offsets.pop()
    mapping = {col: col + offset for col in range(len(row) + 8) if 1 <= col + offset <= 5}
    return mapping, ""


def find_time_column(grid: Grid, header_row: int) -> int:
    """The column below the header that reads as a ladder of day fractions."""
    best_col, best_hits = -1, 0
    span = grid[header_row + 1 :]
    width = max((len(r) for r in span), default=0)
    for col in range(width):
        hits = 0
        for row in span:
            if col >= len(row):
                continue
            f = parse_float(row[col].strip())
            if f is not None and 0.0 <= f < 1.0:
                hits += 1
        if hits > best_hits:
            best_col, best_hits = col, hits
    return best_col if best_hits >= 3 else -1


def parse_time_cell(raw: str) -> tuple[int | None, str]:
    """Slot start as minutes past midnight, or (None, reason)."""
    text = (raw or "").strip()
    if not text:
        return None, "empty"

    f = parse_float(text)
    if f is not None:
        if f < 0:
            return None, f"negative time value {text!r}"
        if f >= 1.0:
            f = f % 1.0
        return round(f * 1440), ""

    for fmt in ("%I:%M %p", "%I:%M:%S %p", "%H:%M", "%H:%M:%S"):
        try:
            parsed = datetime.strptime(text.upper().replace(".", ""), fmt)
        except ValueError:
            continue
        return parsed.hour * 60 + parsed.minute, ""

    return None, f"unrecognized time value {text!r}"


def split_names(cell: str, profile: SheetProfile) -> tuple[list[str], bool]:
    """
    Split one grid cell into name fragments.

    Cells are free text: names are comma-separated, but lists also wrap across
    embedded newlines and pick up empty fragments from leading, trailing, and
    doubled commas. Returns (names, was_marker).
    """
    text = (cell or "").strip()
    if not text:
        return [], False

    normalized = norm_text(text)
    if normalized in profile.closed_markers or normalized == SEMINAR_MARKER:
        return [], True

    names: list[str] = []
    for fragment in re.split(r"[,\n\r]+", text):
        cleaned = " ".join(fragment.split())
        if not cleaned:
            continue
        frag_norm = norm_text(cleaned)
        if frag_norm in profile.closed_markers or frag_norm == SEMINAR_MARKER:
            continue
        names.append(cleaned)
    return names, False


def parse_grid(
    tab: str, grid: Grid, profile: SheetProfile
) -> tuple[list[RawSlot], dict[int, int], list[dict[str, str]], list[dict[str, str]]]:
    """Returns (slots, weekday_columns, rejects, markers)."""
    rejects: list[dict[str, str]] = []
    markers: list[dict[str, str]] = []

    header_row = find_header_row(grid)
    if header_row < 0:
        raise SystemExit(f"error: no weekday header row found in tab {tab!r}")

    weekday_cols, problem = resolve_weekday_columns(grid, header_row)
    if problem:
        raise SystemExit(f"error: tab {tab!r}: {problem}")

    time_col = find_time_column(grid, header_row)
    if time_col < 0:
        raise SystemExit(f"error: tab {tab!r}: could not locate the time column")
    weekday_cols.pop(time_col, None)

    slots: list[RawSlot] = []
    for r in range(header_row + 1, len(grid)):
        row = grid[r]
        if time_col >= len(row):
            continue
        start_min, reason = parse_time_cell(row[time_col])
        if start_min is None:
            if reason != "empty":
                rejects.append({"tab": tab, "row": str(r + 1), "column": "time", "reason": reason})
            continue
        end_min = start_min + SLOT_MINUTES

        for col, dow in sorted(weekday_cols.items()):
            if col >= len(row):
                continue
            names, was_marker = split_names(row[col], profile)
            if was_marker:
                markers.append(
                    {
                        "tab": tab,
                        "row": str(r + 1),
                        "day": DOW_NAME.get(dow, str(dow)),
                        "text": " ".join(row[col].split()),
                    }
                )
                continue
            for name in names:
                slots.append(
                    RawSlot(
                        tab=tab,
                        row=r + 1,
                        day_of_week=dow,
                        raw_name=name,
                        start_min=start_min,
                        end_min=end_min,
                    )
                )
    return slots, weekday_cols, rejects, markers


# ---------------------------------------------------------------------------
# Identity matching against public.profiles
# ---------------------------------------------------------------------------


@dataclass
class ProfileIndex:
    by_student_id: dict[str, dict[str, Any]]
    by_full: dict[str, list[dict[str, Any]]]
    by_reversed: dict[str, list[dict[str, Any]]]
    by_first: dict[str, list[dict[str, Any]]]
    all_names: list[str]


def build_profile_index(rows: list[dict[str, Any]]) -> ProfileIndex:
    idx = ProfileIndex({}, {}, {}, {}, [])
    for row in rows:
        student_id = (row.get("student_id") or "").strip()
        if student_id:
            idx.by_student_id.setdefault(student_id, row)

        first = (row.get("first_name") or "").strip()
        last = (row.get("last_name") or "").strip()
        full = (row.get("full_name") or "").strip() or f"{first} {last}".strip()

        for key in {norm_name(full), norm_name(f"{first} {last}")}:
            if key:
                idx.by_full.setdefault(key, []).append(row)
        if first and last:
            idx.by_reversed.setdefault(norm_name(f"{last} {first}"), []).append(row)
        if first:
            idx.by_first.setdefault(norm_name(first), []).append(row)
        if full:
            idx.all_names.append(norm_name(full))
    return idx


def load_alias_map(path: str | None) -> dict[str, str]:
    """Operator-maintained `sheet_name,profile_uuid` CSV. Kept outside the repo."""
    if not path:
        return {}
    aliases: dict[str, str] = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for line_no, row in enumerate(csv.reader(f), start=1):
            if not row or not row[0].strip() or row[0].lstrip().startswith("#"):
                continue
            if len(row) < 2:
                raise SystemExit(
                    f"error: alias map line {line_no}: expected 'sheet_name,profile_uuid'"
                )
            aliases[norm_name(row[0])] = row[1].strip()
    return aliases


def match_scholar(
    raw_name: str,
    idx: ProfileIndex,
    aliases: dict[str, str],
) -> tuple[str | None, str, str]:
    """
    Resolve a sheet name fragment to a profiles.id.

    Only deterministic matches are accepted. Anything ambiguous or merely
    similar is returned unresolved so it lands in a report instead of silently
    attaching hours to the wrong person.

    Returns (scholar_id, match_method, note).
    """
    cleaned = " ".join(raw_name.split())
    key = norm_name(cleaned)
    if not key:
        return None, "", "empty after normalization"

    digits = cleaned.strip().strip(",.;")
    if UID_RE.fullmatch(digits):
        row = idx.by_student_id.get(digits)
        if row:
            return row["id"], "student_id", ""
        return None, "", f"no profile with student_id {digits}"

    if key in aliases:
        return aliases[key], "alias", ""

    for method, table in (("name_exact", idx.by_full), ("name_reversed", idx.by_reversed)):
        rows = table.get(key, [])
        unique = {r["id"]: r for r in rows}
        if len(unique) == 1:
            return next(iter(unique)), method, ""
        if len(unique) > 1:
            return None, "", "ambiguous: " + ", ".join(sorted(unique))

    rows = idx.by_first.get(key, [])
    unique = {r["id"]: r for r in rows}
    if len(unique) == 1:
        return next(iter(unique)), "first_only_unique", ""
    if len(unique) > 1:
        return None, "", "ambiguous first name: " + ", ".join(sorted(unique))

    return None, "", "no match"


def find_missing_separator(raw_name: str, idx: ProfileIndex) -> str:
    """
    Detect two names run together with no comma between them.

    Only reported, never auto-split: guessing the split point would attach real
    hours to a guessed identity.
    """
    tokens = " ".join(raw_name.split()).split(" ")
    if len(tokens) < 3:
        return ""
    for cut in range(1, len(tokens)):
        left, right = norm_name(" ".join(tokens[:cut])), norm_name(" ".join(tokens[cut:]))
        if left in idx.by_full and right in idx.by_full:
            return f"{' '.join(tokens[:cut])} | {' '.join(tokens[cut:])}"
    return ""


def suggest(raw_name: str, idx: ProfileIndex) -> str:
    close = difflib.get_close_matches(norm_name(raw_name), idx.all_names, n=3, cutoff=0.82)
    return ", ".join(close)


# ---------------------------------------------------------------------------
# Coalescing
# ---------------------------------------------------------------------------


def coalesce(
    rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """
    Merge each scholar's contiguous and overlapping slots into standing shifts.

    The grid yields one 30-minute slot per cell, but the schema wants one row per
    standing shift. This is also what keeps a single batch from violating the
    overlap exclusion constraint against itself.
    """
    merged: list[dict[str, Any]] = []
    notes: list[dict[str, str]] = []

    buckets: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for row in rows:
        buckets.setdefault((row["scholar_id"], row["day_of_week"]), []).append(row)

    for key in sorted(buckets, key=lambda k: (str(k[0]), k[1])):
        group = buckets[key]
        group.sort(key=lambda r: (r["start_min"], r["end_min"]))
        current = dict(group[0])
        parts = 1
        for nxt in group[1:]:
            if nxt["start_min"] <= current["end_min"]:
                if nxt["end_min"] > current["end_min"]:
                    current["end_min"] = nxt["end_min"]
                parts += 1
                continue
            merged.append(current)
            if parts > 1:
                notes.append(_merge_note(current, parts))
            current, parts = dict(nxt), 1
        merged.append(current)
        if parts > 1:
            notes.append(_merge_note(current, parts))
    return merged, notes


def _merge_note(row: dict[str, Any], parts: int) -> dict[str, str]:
    return {
        "scholar": row.get("source_name", ""),
        "day": DOW_NAME.get(row["day_of_week"], str(row["day_of_week"])),
        "shift": f"{minutes_to_hhmmss(row['start_min'])}-{minutes_to_hhmmss(row['end_min'])}",
        "slots_merged": str(parts),
    }


def slot_warnings(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in rows:
        issues = []
        if row["end_min"] - row["start_min"] < MIN_BLOCK_MINUTES:
            issues.append("shorter than the 1-hour minimum block")
        if row["start_min"] < OPEN_MINUTES or row["end_min"] > CLOSE_MINUTES:
            issues.append("outside 08:00-20:00")
        if issues:
            out.append(
                {
                    "scholar": row.get("source_name", ""),
                    "day": DOW_NAME.get(row["day_of_week"], str(row["day_of_week"])),
                    "shift": f"{minutes_to_hhmmss(row['start_min'])}-{minutes_to_hhmmss(row['end_min'])}",
                    "note": "; ".join(issues),
                }
            )
    return out


# ---------------------------------------------------------------------------
# PostgREST
# ---------------------------------------------------------------------------


def _request(
    url: str,
    service_role: str,
    method: str,
    path: str,
    body: Any = None,
    prefer: str | None = None,
) -> Any:
    endpoint = url.rstrip("/") + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(endpoint, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status not in (200, 201, 204):
                raise SystemExit(f"error: PostgREST returned HTTP {resp.status}")
            payload = resp.read().decode("utf-8", errors="replace")
            return json.loads(payload) if payload.strip() else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        if "23P01" in detail:
            raise SystemExit(
                "error: overlap rejected by no_overlapping_shift_assignments. Two different "
                "people on the sheet resolved to the same profile - review the match report "
                f"before retrying.\n{detail}"
            ) from e
        raise SystemExit(f"error: PostgREST HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"error: request failed: {e.reason}") from e


def fetch_profiles(url: str, service_role: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        page = _request(
            url,
            service_role,
            "GET",
            "/rest/v1/profiles?select=id,first_name,last_name,full_name,student_id"
            f"&limit={PAGE_SIZE}&offset={offset}",
        )
        if not page:
            break
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def fetch_semesters(url: str, service_role: str) -> list[dict[str, Any]]:
    return _request(url, service_role, "GET", "/rest/v1/semesters?select=id,name,is_active") or []


def resolve_semester(
    tab: str,
    profile: SheetProfile,
    explicit: int | None,
    semesters: list[dict[str, Any]],
) -> int:
    if explicit is not None:
        return explicit

    if profile.semester_from_tab:
        m = SEMESTER_TAB_RE.search(tab)
        if not m:
            raise SystemExit(
                f"error: tab {tab!r} carries no '(Season YY)' suffix and no --semester-id was given"
            )
        label = norm_text(m.group(1))
        season = next((s for s in SEASONS if s in label), "")
        year_m = re.search(r"(\d{2,4})", label)
        if not season or not year_m:
            raise SystemExit(f"error: could not read a semester from tab {tab!r} (got {label!r})")
        year = year_m.group(1)
        year4 = year if len(year) == 4 else f"20{year}"
        hits = [
            s
            for s in semesters
            if season in norm_text(s.get("name", "")) and year4[-2:] in norm_text(s.get("name", ""))
        ]
        if len(hits) != 1:
            names = ", ".join(repr(s.get("name", "")) for s in semesters)
            raise SystemExit(
                f"error: tab {tab!r} resolved to {len(hits)} semesters for {season} {year4}. "
                f"Known semesters: {names}. Pass --semester-id to disambiguate."
            )
        return int(hits[0]["id"])

    active = [s for s in semesters if s.get("is_active")]
    if len(active) != 1:
        raise SystemExit(
            f"error: expected exactly one active semester, found {len(active)}. Pass --semester-id."
        )
    return int(active[0]["id"])


def _in_list(values: list[str]) -> str:
    quoted = ",".join('"' + v.replace('"', '\\"') + '"' for v in values)
    return urllib.parse.quote(f"({quoted})", safe='(),"\\')


def scope_filter(semester_id: int, session_kind: str, tabs: list[str]) -> str:
    """
    The (semester, session_kind, tab) scope a single load owns.

    Scoping this tightly is what keeps a front-desk run from touching study
    session rows, a Freshman-only run from touching Sophomore rows, and any run
    from touching rows entered by hand under a different source.
    """
    return (
        f"semester_id=eq.{semester_id}"
        f"&session_kind=eq.{session_kind}"
        f"&source=eq.google_sheet"
        f"&source_tab=in.{_in_list(tabs)}"
    )


def preview_scope(url: str, key: str, flt: str) -> list[dict[str, Any]]:
    return (
        _request(
            url,
            key,
            "GET",
            f"/rest/v1/{TABLE}?select=scholar_id,day_of_week,start_time,end_time,source_tab&{flt}",
        )
        or []
    )


def delete_scope(url: str, key: str, flt: str) -> None:
    _request(url, key, "DELETE", f"/rest/v1/{TABLE}?{flt}", prefer="return=minimal")


def insert_batch(url: str, key: str, batch: list[dict[str, Any]]) -> None:
    _request(url, key, "POST", f"/rest/v1/{TABLE}", body=batch, prefer="return=minimal")


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def print_tsv(title: str, rows: list[dict[str, str]], columns: list[str]) -> None:
    print()
    print(f"=== {title} ({len(rows)}) ===")
    if not rows:
        print("(none)")
        return
    print("\t".join(columns))
    for r in rows:
        print("\t".join(str(r.get(c, "")) for c in columns))


# ---------------------------------------------------------------------------
# Self-test (pure functions only; no file, no network, no credentials)
# ---------------------------------------------------------------------------


def self_test() -> int:
    fp = FRONT_DESK_PROFILE

    # Excel day fractions are value * 24 hours.
    assert parse_time_cell("0.3333333333333333")[0] == 8 * 60
    assert parse_time_cell("0.375")[0] == 9 * 60
    assert parse_time_cell("0.5")[0] == 12 * 60
    assert parse_time_cell("0.75")[0] == 18 * 60
    assert parse_time_cell("0.8125")[0] == 19 * 60 + 30
    assert parse_time_cell("8:00 AM")[0] == 8 * 60
    assert parse_time_cell("14:30:00")[0] == 14 * 60 + 30

    # One rejection case per class the sheets actually contain.
    assert parse_time_cell("")[0] is None
    assert parse_time_cell("2:30:00 PM and 3:30 PM")[0] is None
    assert parse_time_cell("remote")[0] is None
    # A serial past midnight folds back into the day rather than exploding.
    assert parse_time_cell("1.5")[0] == 12 * 60

    # One cell holds any number of comma-separated names.
    assert split_names("Alpha One", fp)[0] == ["Alpha One"]
    assert split_names("Alpha One, Beta Two", fp)[0] == ["Alpha One", "Beta Two"]
    assert split_names("Alpha One, Beta Two, Gamma Three, Delta Four", fp)[0] == [
        "Alpha One",
        "Beta Two",
        "Gamma Three",
        "Delta Four",
    ]
    # A comma with nothing after it contributes nothing - no blank name is added.
    assert split_names("Alpha One,", fp)[0] == ["Alpha One"]
    assert split_names("Alpha One, ", fp)[0] == ["Alpha One"]
    assert split_names("Alpha One,,,", fp)[0] == ["Alpha One"]
    assert split_names(", Alpha One", fp)[0] == ["Alpha One"]
    assert split_names(" , Alpha One,", fp)[0] == ["Alpha One"]
    assert split_names("Alpha One,,Beta Two", fp)[0] == ["Alpha One", "Beta Two"]
    # A cell of nothing but separators yields no names at all.
    assert split_names(",", fp)[0] == []
    assert split_names(", ,", fp)[0] == []
    assert split_names("   ", fp) == ([], False)
    assert split_names("", fp) == ([], False)
    # Missing space after the comma, and lists that wrap onto another line.
    assert split_names("Alpha One,Beta Two", fp)[0] == ["Alpha One", "Beta Two"]
    assert split_names("Alpha One,\nBeta Two", fp)[0] == ["Alpha One", "Beta Two"]
    assert split_names("Alpha One\nBeta Two", fp)[0] == ["Alpha One", "Beta Two"]
    assert split_names("Alpha   One", fp)[0] == ["Alpha One"]
    # Markers are not names.
    assert split_names("Front Desk Closed", fp) == ([], True)
    assert split_names("Freshman Seminar", fp) == ([], True)

    assert norm_name("  Dany  romero, ") == "dany romero"
    assert norm_name("LUSENIE TURAY") == "lusenie turay"

    # A blank weekday header still resolves by position.
    grid = [
        ["Time", "Mondays", "", "Wednesdays", "Thursdays", "Fridays"],
        ["0.3333333333333333", "Alpha One", "Beta Two", "", "", ""],
        ["0.3541666666666667", "Alpha One", "", "", "", ""],
        ["0.375", "Alpha One", "", "", "", ""],
    ]
    cols, problem = resolve_weekday_columns(grid, 0)
    assert not problem, problem
    assert cols[1] == 1 and cols[2] == 2 and cols[5] == 5, cols
    assert find_header_row(grid) == 0
    assert find_time_column(grid, 0) == 0

    # End to end over that grid: three contiguous slots become one shift.
    slots, _, rejects, markers = parse_grid("T", grid, fp)
    assert len(rejects) == 0 and len(markers) == 0
    assert len(slots) == 4, slots
    assert {s.day_of_week for s in slots} == {1, 2}

    # Contiguous slots become one shift; a gap stays two.
    rows = [
        {"scholar_id": "s1", "day_of_week": 1, "start_min": 600, "end_min": 630, "source_name": "A"},
        {"scholar_id": "s1", "day_of_week": 1, "start_min": 630, "end_min": 660, "source_name": "A"},
        {"scholar_id": "s1", "day_of_week": 1, "start_min": 660, "end_min": 690, "source_name": "A"},
        {"scholar_id": "s1", "day_of_week": 1, "start_min": 780, "end_min": 810, "source_name": "A"},
    ]
    merged, notes = coalesce(rows)
    assert len(merged) == 2, merged
    assert merged[0]["start_min"] == 600 and merged[0]["end_min"] == 690, merged[0]
    assert merged[1]["start_min"] == 780 and merged[1]["end_min"] == 810, merged[1]
    assert len(notes) == 1 and notes[0]["slots_merged"] == "3", notes

    # Overlapping duplicates collapse rather than colliding inside one batch.
    dupes = [
        {"scholar_id": "s2", "day_of_week": 2, "start_min": 600, "end_min": 660, "source_name": "B"},
        {"scholar_id": "s2", "day_of_week": 2, "start_min": 630, "end_min": 690, "source_name": "B"},
    ]
    merged2, _ = coalesce(dupes)
    assert len(merged2) == 1 and merged2[0]["end_min"] == 690, merged2

    # A sub-hour shift is loaded but warned about.
    warns = slot_warnings([{"day_of_week": 1, "start_min": 600, "end_min": 630, "source_name": "A"}])
    assert len(warns) == 1 and "1-hour" in warns[0]["note"], warns

    # The populated twin wins when tab names collide after normalization. The
    # blank twin still carries the time ladder and the closed/seminar markers,
    # so neither may count as data.
    header = ["Time", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays"]
    empty_grid = [
        [], [], [], [], header,
        ["0.375", "", "", "", "", ""],
        ["0.75", "", "", "Freshman Seminar", "", "Front Desk Closed"],
    ]
    full_grid = [
        [], [], [], [], header,
        ["0.375", "Alpha One", "", "", "", ""],
        ["0.75", "Beta Two", "", "Freshman Seminar", "", "Front Desk Closed"],
    ]
    assert count_name_cells(empty_grid, fp, from_row=5) == 0
    assert count_name_cells(full_grid, fp, from_row=5) == 2
    chosen, tab_notes = select_tabs(
        {" Freshman Sign-Up ": empty_grid, "Freshman Sign-Up": full_grid}, fp, None
    )
    assert list(chosen) == ["Freshman Sign-Up"], list(chosen)
    assert tab_notes and "populated" in tab_notes[0]["reason"]

    # Order must not decide it: the populated twin wins from either side.
    chosen_rev, _ = select_tabs(
        {"Freshman Sign-Up": full_grid, " Freshman Sign-Up ": empty_grid}, fp, None
    )
    assert list(chosen_rev) == ["Freshman Sign-Up"], list(chosen_rev)

    # Leadership and the derived Schedule Data tabs are never selected.
    others = {"Leadership schedules": full_grid, "Freshman Schedule Data": full_grid}
    assert select_tabs(others, fp, None)[0] == {}

    # Matching accepts only deterministic resolutions.
    idx = build_profile_index(
        [
            {"id": "u1", "first_name": "Alpha", "last_name": "One",
             "full_name": "Alpha One", "student_id": "123456789"},
            {"id": "u2", "first_name": "Beta", "last_name": "Two",
             "full_name": "Beta Two", "student_id": None},
            {"id": "u3", "first_name": "Beta", "last_name": "Three",
             "full_name": "Beta Three", "student_id": None},
        ]
    )
    assert match_scholar("Alpha One", idx, {})[:2] == ("u1", "name_exact")
    assert match_scholar("  alpha   one , ", idx, {})[:2] == ("u1", "name_exact")
    assert match_scholar("One Alpha", idx, {})[:2] == ("u1", "name_reversed")
    assert match_scholar("123456789", idx, {})[:2] == ("u1", "student_id")
    assert match_scholar("Nobody Here", idx, {})[0] is None
    assert match_scholar("Gamma Three", idx, {norm_name("Gamma Three"): "u9"})[:2] == ("u9", "alias")
    # Two profiles share a first name, so a first-name-only entry stays unresolved.
    ambiguous_id, _, note = match_scholar("Beta", idx, {})
    assert ambiguous_id is None and note.startswith("ambiguous"), note

    # Run-together names are detected but never split automatically.
    assert find_missing_separator("Alpha One Beta Two", idx) == "Alpha One | Beta Two"
    assert find_missing_separator("Leigh Bodden II", idx) == ""

    # Scope filters pin every dimension that keeps loads from colliding.
    flt = scope_filter(3, "front_desk", ["Freshman Sign-Up"])
    assert "semester_id=eq.3" in flt
    assert "session_kind=eq.front_desk" in flt
    assert "source=eq.google_sheet" in flt
    assert "source_tab=in." in flt

    assert minutes_to_hhmmss(8 * 60) == "08:00:00"
    assert minutes_to_hhmmss(19 * 60 + 30) == "19:30:00"

    print("self-test: all assertions passed")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Load a sign-up sheet workbook into scholar_shift_assignments"
    )
    parser.add_argument(
        "workbook", nargs="?", help="Path to the .xlsx export (not copied or rewritten)"
    )
    parser.add_argument(
        "--session-kind", choices=sorted(PROFILES), help="Which sheet profile to use"
    )
    parser.add_argument("--semester-id", type=int, default=None, help="Override semester resolution")
    parser.add_argument(
        "--tabs", default="", help="Comma-separated tab names to load instead of the defaults"
    )
    parser.add_argument(
        "--alias-map", default=None, help="CSV of sheet_name,profile_uuid for known aliases"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse and report only; no network, no credentials"
    )
    parser.add_argument(
        "--check", action="store_true", help="Parse and match against profiles; report only, no writes"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=BATCH_SIZE_DEFAULT,
        help=f"Insert batch size (default {BATCH_SIZE_DEFAULT})",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Permit clearing the scope when the sheet parses to zero shifts",
    )
    parser.add_argument(
        "--self-test", action="store_true", help="Run internal assertions and exit"
    )
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    if not args.session_kind:
        print("error: --session-kind is required", file=sys.stderr)
        return 1
    if not args.workbook:
        print("error: workbook path is required", file=sys.stderr)
        return 1
    if not os.path.isfile(args.workbook):
        print(f"error: workbook not found: {args.workbook}", file=sys.stderr)
        return 1

    profile = PROFILES[args.session_kind]
    requested = [t.strip() for t in args.tabs.split(",") if t.strip()] or None

    grids, states = read_xlsx(args.workbook)
    tabs, tab_notes = select_tabs(grids, profile, requested, states)
    if not tabs:
        print(
            f"error: no matching tabs. Workbook contains: {', '.join(repr(n) for n in grids)}",
            file=sys.stderr,
        )
        return 1

    all_slots: list[RawSlot] = []
    rejects: list[dict[str, str]] = []
    markers: list[dict[str, str]] = []
    structure: list[dict[str, str]] = []

    for tab, grid in tabs.items():
        slots, weekday_cols, tab_rejects, tab_markers = parse_grid(tab, grid, profile)
        all_slots.extend(slots)
        rejects.extend(tab_rejects)
        markers.extend(tab_markers)
        structure.append(
            {
                "tab": tab,
                "visibility": states.get(tab, "?"),
                "weekday_columns": ", ".join(
                    f"{chr(ord('A') + c)}={DOW_NAME.get(d, d)}"
                    for c, d in sorted(weekday_cols.items())
                ),
                "slots_found": str(len(slots)),
            }
        )

    print_tsv(
        "Tabs selected and weekday columns resolved - confirm before loading",
        structure,
        ["tab", "visibility", "weekday_columns", "slots_found"],
    )
    if any(s["visibility"] != "visible" for s in structure):
        print(
            "note: at least one selected tab is hidden in the workbook. Tabs are chosen "
            "by how many names they hold, not by visibility — confirm this is the tab "
            "staff actually edit, or pass --tabs to choose explicitly.",
            file=sys.stderr,
        )
    if tab_notes:
        print_tsv(
            "Near-duplicate tab names resolved",
            tab_notes,
            ["normalized", "candidates", "chosen", "reason"],
        )
    print_tsv("Time cells rejected", rejects, ["tab", "row", "column", "reason"])
    print_tsv("Marker cells ignored (not sign-ups)", markers, ["tab", "row", "day", "text"])

    if args.dry_run:
        print()
        print(f"Name fragments parsed: {len(all_slots)}")
        print("Dry run - no credentials used, nothing sent to Supabase.")
        print("Identity matching needs profiles from the database; use --check for that.")
        return 0

    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url:
        print("error: SUPABASE_URL is required", file=sys.stderr)
        return 1
    if not key:
        print(
            "error: SUPABASE_SERVICE_ROLE_KEY is required "
            "(prompted by the shell wrapper; never loaded from repo .env files)",
            file=sys.stderr,
        )
        return 1

    aliases = load_alias_map(args.alias_map)
    profiles_rows = fetch_profiles(url, key)
    if not profiles_rows:
        print("error: no rows returned from public.profiles", file=sys.stderr)
        return 1
    idx = build_profile_index(profiles_rows)
    semesters = fetch_semesters(url, key)

    batch_id = str(uuid.uuid4())
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, str]] = []
    ambiguous: list[dict[str, str]] = []

    # Resolved for every selected tab, not just tabs that produced slots: a tab
    # everyone dropped out of still owns rows in the database that this load is
    # responsible for clearing.
    semester_by_tab: dict[str, int] = {
        tab: resolve_semester(tab, profile, args.semester_id, semesters) for tab in tabs
    }
    tabs_by_semester: dict[int, list[str]] = {}
    for tab, semester_id in semester_by_tab.items():
        tabs_by_semester.setdefault(semester_id, []).append(tab)

    for slot in all_slots:
        scholar_id, method, note = match_scholar(slot.raw_name, idx, aliases)
        if scholar_id is None:
            record = {
                "tab": slot.tab,
                "row": str(slot.row),
                "day": DOW_NAME.get(slot.day_of_week, str(slot.day_of_week)),
                "raw_name": slot.raw_name,
                "slot": f"{minutes_to_hhmmss(slot.start_min)}-{minutes_to_hhmmss(slot.end_min)}",
                "reason": note,
            }
            if note.startswith("ambiguous"):
                ambiguous.append(record)
            else:
                separator = find_missing_separator(slot.raw_name, idx)
                if separator:
                    record["reason"] = "possible missing separator"
                    record["suggestions"] = separator
                    ambiguous.append(record)
                else:
                    record["suggestions"] = suggest(slot.raw_name, idx)
                    unmatched.append(record)
            continue

        matched.append(
            {
                "scholar_id": scholar_id,
                "semester_id": semester_by_tab[slot.tab],
                "day_of_week": slot.day_of_week,
                "start_min": slot.start_min,
                "end_min": slot.end_min,
                "source_tab": slot.tab,
                "source_name": slot.raw_name,
                "match_method": method,
            }
        )

    shifts, merge_notes = coalesce(matched)
    warnings = slot_warnings(shifts)

    print_tsv(
        "Unmatched names - NOT loaded (no profile yet, or name not found)",
        unmatched,
        ["tab", "row", "day", "raw_name", "slot", "reason", "suggestions"],
    )
    print_tsv(
        "Ambiguous or run-together names - NOT loaded",
        ambiguous,
        ["tab", "row", "day", "raw_name", "slot", "reason", "suggestions"],
    )
    print_tsv(
        "Slots coalesced into standing shifts",
        merge_notes,
        ["scholar", "day", "shift", "slots_merged"],
    )
    print_tsv("Shift warnings - still loaded", warnings, ["scholar", "day", "shift", "note"])

    stale: list[dict[str, str]] = []
    for semester_id in sorted(tabs_by_semester):
        flt = scope_filter(semester_id, profile.session_kind, sorted(tabs_by_semester[semester_id]))
        for row in preview_scope(url, key, flt):
            stale.append(
                {
                    "semester_id": str(semester_id),
                    "scholar_id": str(row.get("scholar_id", "")),
                    "day": DOW_NAME.get(row.get("day_of_week"), str(row.get("day_of_week"))),
                    "shift": f"{row.get('start_time', '')}-{row.get('end_time', '')}",
                    "source_tab": str(row.get("source_tab", "")),
                }
            )
    print_tsv(
        "Existing rows in scope - replaced by this load",
        stale,
        ["semester_id", "scholar_id", "day", "shift", "source_tab"],
    )

    print()
    print(f"Shifts ready to insert: {len(shifts)}")
    print(f"Name fragments skipped: {len(unmatched) + len(ambiguous)}")

    if args.check:
        print("Check run - profiles read, nothing written.")
        return 0

    if not shifts:
        if not stale:
            print("Nothing to insert and nothing to clear.")
            return 0
        if not args.allow_empty:
            print(
                f"error: parsed zero loadable shifts, but the load scope holds {len(stale)} "
                "existing row(s). Refusing to clear the scope on an empty parse — that is "
                "usually a tab-selection or parsing problem rather than an empty sheet. "
                "Check the tab report above, then re-run with --allow-empty if the sheet "
                "really is empty.",
                file=sys.stderr,
            )
            return 1
        print(f"Parsed zero shifts; clearing {len(stale)} row(s) in scope as requested.")

    payload: list[dict[str, Any]] = []
    for s in shifts:
        row = {
            "scholar_id": s["scholar_id"],
            "semester_id": s["semester_id"],
            "session_kind": profile.session_kind,
            "day_of_week": s["day_of_week"],
            "start_time": minutes_to_hhmmss(s["start_min"]),
            "end_time": minutes_to_hhmmss(s["end_min"]),
            "is_active": True,
            "source": "google_sheet",
            "source_tab": s["source_tab"],
            "source_name": s["source_name"],
            "match_method": s["match_method"],
            "load_batch_id": batch_id,
            "updated_at": stamp,
        }
        # Every object must carry an identical key set, explicit nulls included,
        # or PostgREST rejects the batch.
        for field in PAYLOAD_FIELDS:
            row.setdefault(field, None)
        payload.append(row)

    # Delete before insert: an edited shift would otherwise overlap its own
    # surviving row and trip the exclusion constraint.
    for semester_id in sorted(tabs_by_semester):
        delete_scope(
            url,
            key,
            scope_filter(semester_id, profile.session_kind, sorted(tabs_by_semester[semester_id])),
        )
    print(f"Cleared scope for semester(s) {sorted(tabs_by_semester)}.")

    batch_size = max(1, args.batch_size)
    total = 0
    for i in range(0, len(payload), batch_size):
        batch = payload[i : i + batch_size]
        insert_batch(url, key, batch)
        total += len(batch)
        print(f"Inserted batch {i // batch_size + 1}: {len(batch)} row(s) (running total {total})")

    print(f"Done. Inserted {total} shift(s) into {TABLE} (batch {batch_id}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
