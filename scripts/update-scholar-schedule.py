#!/usr/bin/env python3
"""
Replace one scholar's active signed-up front-desk / study-session shifts.

Invoked by scripts/update-scholar-schedule.sh. Prompts for a UID and a list of
shifts, then deactivates that scholar's active scholar_shift_assignments rows
for the active semester and inserts the new list. An empty list clears them.

Does not write user_roster.fd_required / ss_required. Does not write PII or
credentials to disk. Service role key must come from the environment (set by
the shell after an interactive prompt).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

DAY_NAMES = ("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
DAYS = {
    "sun": 0,
    "sunday": 0,
    "mon": 1,
    "monday": 1,
    "tue": 2,
    "tues": 2,
    "tuesday": 2,
    "wed": 3,
    "wednesday": 3,
    "thu": 4,
    "thur": 4,
    "thurs": 4,
    "thursday": 4,
    "fri": 5,
    "friday": 5,
    "sat": 6,
    "saturday": 6,
}
KINDS = {
    "fd": "front_desk",
    "front_desk": "front_desk",
    "front-desk": "front_desk",
    "ss": "study_session",
    "study_session": "study_session",
    "study-session": "study_session",
}
KIND_LABEL = {"front_desk": "FD", "study_session": "SS"}
TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?(am|pm)?$", re.IGNORECASE)


class ShiftParseError(ValueError):
    """One shift line could not be parsed."""


@dataclass(frozen=True)
class Shift:
    kind: str
    day: int
    start_min: int
    end_min: int

    def week_start(self) -> int:
        return self.day * 1440 + self.start_min

    def week_end(self) -> int:
        return self.day * 1440 + self.end_min


@dataclass(frozen=True)
class ExistingShift:
    id: str
    shift: Shift


def request(
    base_url: str,
    service_role: str,
    path: str,
    method: str = "GET",
    body: Any | None = None,
    prefer: str | None = None,
) -> Any:
    endpoint = base_url.rstrip("/") + path
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = prefer or "return=minimal"

    req = urllib.request.Request(endpoint, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status not in (200, 201, 204):
                raise SystemExit(f"error: PostgREST returned HTTP {resp.status}")
            payload = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"error: PostgREST HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"error: request failed: {e.reason}") from e

    if not payload:
        return None
    return json.loads(payload.decode("utf-8"))


def rest_path(table: str, params: list[tuple[str, str]]) -> str:
    # Keep PostgREST filter punctuation (in.(...), order commas) intact.
    query = "&".join(
        f"{urllib.parse.quote(key, safe='')}={urllib.parse.quote(value, safe='-.,()*:=')}"
        for key, value in params
    )
    return f"/rest/v1/{table}?{query}"


def parse_clock(token: str) -> int:
    match = TIME_RE.fullmatch(token.strip())
    if not match:
        raise ShiftParseError(f"invalid time: {token}")
    hour = int(match.group(1))
    minute = int(match.group(2))
    second = int(match.group(3) or 0)
    meridiem = (match.group(4) or "").lower()
    if minute > 59 or second > 59 or second != 0:
        raise ShiftParseError(f"invalid time: {token}")
    if meridiem:
        if hour < 1 or hour > 12:
            raise ShiftParseError(f"invalid time: {token}")
        hour = hour % 12
        if meridiem == "pm":
            hour += 12
    elif hour > 23:
        raise ShiftParseError(f"invalid time: {token}")
    return hour * 60 + minute


def format_clock(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def format_shift(shift: Shift) -> str:
    return (
        f"  {KIND_LABEL[shift.kind]:<2}  {DAY_NAMES[shift.day]:<3}  "
        f"{format_clock(shift.start_min)}-{format_clock(shift.end_min)}"
    )


def merge_meridiem(tokens: list[str]) -> list[str]:
    merged: list[str] = []
    for token in tokens:
        if token.lower() in {"am", "pm"} and merged:
            merged[-1] = merged[-1] + token.lower()
        else:
            merged.append(token)
    return merged


def split_range(token: str) -> tuple[str, str]:
    if token.count("-") != 1:
        raise ShiftParseError(f"invalid time range: {token}")
    start, end = token.split("-", 1)
    if not start or not end:
        raise ShiftParseError(f"invalid time range: {token}")
    return start, end


def parse_shift_line(line: str) -> Shift:
    tokens = line.strip().split()
    if len(tokens) < 3:
        raise ShiftParseError("expected: <fd|ss> <day> <start> <end>")
    kind_token = tokens[0].lower()
    day_token = tokens[1].lower()
    if kind_token not in KINDS:
        raise ShiftParseError(f"unknown kind: {tokens[0]} (use fd or ss)")
    if day_token not in DAYS:
        raise ShiftParseError(f"unknown day: {tokens[1]}")
    time_tokens = merge_meridiem(tokens[2:])
    if len(time_tokens) == 1 and "-" in time_tokens[0]:
        start_token, end_token = split_range(time_tokens[0])
    elif len(time_tokens) == 2:
        start_token, end_token = time_tokens
    else:
        raise ShiftParseError("expected a start and end time")
    start = parse_clock(start_token)
    end = parse_clock(end_token)
    if end <= start:
        raise ShiftParseError("end time must be after start time")
    return Shift(KINDS[kind_token], DAYS[day_token], start, end)


def overlapping_pairs(shifts: list[Shift]) -> list[tuple[Shift, Shift]]:
    """Half-open week ranges, matching Postgres int4range [start, end)."""
    ordered = sorted(shifts, key=lambda shift: (shift.week_start(), shift.week_end(), shift.kind))
    pairs: list[tuple[Shift, Shift]] = []
    for index, left in enumerate(ordered):
        for right in ordered[index + 1 :]:
            if right.week_start() >= left.week_end():
                break
            pairs.append((left, right))
    return pairs


def clock_token(value: object) -> str:
    token = str(value).strip()
    if "." in token:
        token = token.split(".", 1)[0]
    return token


def shift_from_row(row: dict[str, Any]) -> ExistingShift:
    try:
        start = parse_clock(clock_token(row["start_time"]))
        end = parse_clock(clock_token(row["end_time"]))
    except ShiftParseError as e:
        raise SystemExit(f"error: stored shift {row.get('id')} has {e}") from e
    kind = str(row["session_kind"])
    if kind not in KIND_LABEL:
        raise SystemExit(f"error: unexpected session_kind on row {row.get('id')}: {kind}")
    day = int(row["day_of_week"])
    if day < 0 or day > 6 or end <= start:
        raise SystemExit(f"error: unexpected shift stored on row {row.get('id')}")
    return ExistingShift(str(row["id"]), Shift(kind, day, start, end))


def prompt_uid(given: str | None) -> str:
    if given is not None and given.strip():
        return given.strip()
    if not sys.stdin.isatty():
        raise SystemExit("error: pass a UID, or run this in a terminal")
    try:
        uid = input("Scholar UID: ").strip()
    except EOFError as e:
        raise SystemExit("error: UID is required") from e
    if not uid:
        raise SystemExit("error: UID is required")
    return uid


def read_shifts() -> list[Shift]:
    if not sys.stdin.isatty():
        raise SystemExit("error: shift entry needs a terminal")
    print()
    print("Enter the replacement schedule, one shift per line. Blank line to finish.")
    print("  fd mon 09:00 11:00")
    print("  ss Tuesday 2:00pm 4:00pm")
    print("  front_desk wed 14:00-16:00")
    shifts: list[Shift] = []
    while True:
        try:
            line = input("> ")
        except EOFError as e:
            raise SystemExit("error: stdin closed before a blank line") from e
        if not line.strip():
            return shifts
        try:
            shifts.append(parse_shift_line(line))
        except ShiftParseError as e:
            print(f"error: {e}", file=sys.stderr)


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"error: {name} is not set")
    return value


def fetch_scholar(base_url: str, service_role: str, uid: str) -> dict[str, Any]:
    path = rest_path(
        "user_roster",
        [
            ("select", "uid,first_name,last_name"),
            ("uid", f"eq.{uid}"),
            ("limit", "2"),
        ],
    )
    rows = request(base_url, service_role, path)
    if not isinstance(rows, list) or len(rows) == 0:
        raise SystemExit(f"error: no user_roster row for uid {uid}")
    if len(rows) > 1:
        raise SystemExit(f"error: more than one user_roster row for uid {uid}")
    return rows[0]


def fetch_active_semester(base_url: str, service_role: str) -> dict[str, Any]:
    path = rest_path(
        "semesters",
        [("select", "id,name"), ("is_active", "eq.true")],
    )
    rows = request(base_url, service_role, path)
    if not isinstance(rows, list) or len(rows) == 0:
        raise SystemExit("error: no active semester")
    if len(rows) > 1:
        raise SystemExit("error: more than one active semester")
    return rows[0]


def fetch_active_shifts(
    base_url: str,
    service_role: str,
    uid: str,
    semester_id: int,
) -> list[ExistingShift]:
    path = rest_path(
        "scholar_shift_assignments",
        [
            ("select", "id,session_kind,day_of_week,start_time,end_time"),
            ("scholar_id", f"eq.{uid}"),
            ("semester_id", f"eq.{semester_id}"),
            ("is_active", "eq.true"),
            ("order", "day_of_week.asc,start_time.asc"),
        ],
    )
    rows = request(base_url, service_role, path)
    if not isinstance(rows, list):
        raise SystemExit("error: unexpected shift response")
    return [shift_from_row(row) for row in rows]


def scholar_name(row: dict[str, Any]) -> str:
    name = " ".join(
        part.strip()
        for part in (row.get("first_name") or "", row.get("last_name") or "")
        if isinstance(part, str) and part.strip()
    )
    return name or "(no name)"


def print_shifts(title: str, shifts: list[Shift]) -> None:
    print(title)
    if not shifts:
        print("  (none)")
        return
    for shift in sorted(shifts, key=lambda item: (item.week_start(), item.kind)):
        print(format_shift(shift))


def confirm(clearing: bool) -> bool:
    if not sys.stdin.isatty():
        raise SystemExit("error: confirmation needs a terminal")
    prompt = (
        "This clears every active signed-up shift for this semester. Continue? [y/N] "
        if clearing
        else "Apply this replacement? [y/N] "
    )
    try:
        answer = input(prompt).strip().lower()
    except EOFError:
        return False
    return answer in {"y", "yes"}


def set_active(
    base_url: str,
    service_role: str,
    ids: list[str],
    active: bool,
) -> list[dict[str, Any]]:
    if not ids:
        return []
    path = rest_path(
        "scholar_shift_assignments",
        [("id", f"in.({','.join(ids)})")],
    )
    rows = request(
        base_url,
        service_role,
        path,
        method="PATCH",
        body={"is_active": active},
        prefer="return=representation",
    )
    if not isinstance(rows, list):
        raise SystemExit("error: unexpected update response")
    return rows


def insert_shifts(
    base_url: str,
    service_role: str,
    uid: str,
    semester_id: int,
    shifts: list[Shift],
) -> None:
    if not shifts:
        return
    body = [
        {
            "scholar_id": uid,
            "semester_id": semester_id,
            "session_kind": shift.kind,
            "day_of_week": shift.day,
            "start_time": f"{format_clock(shift.start_min)}:00",
            "end_time": f"{format_clock(shift.end_min)}:00",
            "is_active": True,
        }
        for shift in shifts
    ]
    request(
        base_url,
        service_role,
        "/rest/v1/scholar_shift_assignments",
        method="POST",
        body=body,
        prefer="return=representation",
    )


def apply_replacement(
    base_url: str,
    service_role: str,
    uid: str,
    semester_id: int,
    existing: list[ExistingShift],
    shifts: list[Shift],
) -> None:
    ids = [row.id for row in existing]
    deactivated: list[dict[str, Any]] = []
    try:
        deactivated = set_active(base_url, service_role, ids, False)
        if ids and {str(row.get("id")) for row in deactivated} != set(ids):
            raise SystemExit("error: could not turn off every current shift")
        insert_shifts(base_url, service_role, uid, semester_id, shifts)
    except SystemExit as original:
        if deactivated:
            try:
                set_active(
                    base_url,
                    service_role,
                    [str(row["id"]) for row in deactivated],
                    True,
                )
            except SystemExit as rollback_error:
                print(f"error: rollback failed: {rollback_error}", file=sys.stderr)
                print(
                    "error: previous shifts may still be inactive; restore them before retrying",
                    file=sys.stderr,
                )
            else:
                print("error: write failed; previous shifts were restored", file=sys.stderr)
        raise original


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Replace a scholar's signed-up front-desk and study-session shifts.",
    )
    parser.add_argument("uid", nargs="?", help="Scholar UID. Prompted when omitted.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the plan and write nothing.",
    )
    args = parser.parse_args()

    uid = prompt_uid(args.uid)
    base_url = require_env("SUPABASE_URL")
    service_role = require_env("SUPABASE_SERVICE_ROLE_KEY")

    scholar = fetch_scholar(base_url, service_role, uid)
    semester = fetch_active_semester(base_url, service_role)
    semester_id = int(semester["id"])
    existing = fetch_active_shifts(base_url, service_role, uid, semester_id)

    print(f"{scholar_name(scholar)} ({uid})")
    print(f"Active semester: {semester.get('name') or semester_id}")
    print()
    print_shifts("Current signed-up shifts:", [row.shift for row in existing])

    shifts = read_shifts()
    pairs = overlapping_pairs(shifts)
    if pairs:
        print(
            "error: these shifts overlap (front desk and study session share one timeline):",
            file=sys.stderr,
        )
        for left, right in pairs:
            print(format_shift(left), file=sys.stderr)
            print(format_shift(right), file=sys.stderr)
        raise SystemExit(1)

    print()
    print(f"Replace schedule for {scholar_name(scholar)} ({uid}) — {semester.get('name') or semester_id}")
    print()
    print_shifts("Turn off:", [row.shift for row in existing])
    print_shifts("Insert:", shifts)

    if not existing and not shifts:
        print()
        print("No active shifts, and the new list is empty. Nothing to change.")
        return

    if args.dry_run:
        print()
        print("Dry run: no changes written.")
        return

    print()
    if not confirm(clearing=not shifts):
        print("Cancelled. No changes written.")
        return

    apply_replacement(base_url, service_role, uid, semester_id, existing, shifts)
    print(f"Replaced schedule: turned off {len(existing)}, inserted {len(shifts)}.")


if __name__ == "__main__":
    main()
