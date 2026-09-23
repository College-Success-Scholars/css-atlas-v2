#!/usr/bin/env python3
"""
Sync user_roster.mentee_count / mentee_uids from public.mentor_mentee.

Invoked by scripts/sync-mentee-count-from-mentor-mentee.sh. Team leaders
(program_role ≠ scholar, status = enrolled — same rule as
isTeamLeaderForPerformance) are compared to mentor_mentee via profiles.id.

TLs with join rows get mentee_count = distinct mentee_uid count and mentee_uids
= that list. TLs with none get mentee_count = -1 (no relationship yet) and an
empty mentee_uids array. Linked profiles.mentee_count is patched to the same
number. Scholar rows are left alone. Repeat runs converge to a no-op.

Does not write PII or credentials to disk. Service role key must come from the
environment (set by the shell after an interactive prompt).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import Any

NO_RELATIONSHIP = -1
BATCH_SIZE_DEFAULT = 100
PAGE_SIZE = 1000

ROSTER_COLUMNS = (
    "id",
    "uid",
    "first_name",
    "last_name",
    "program_role",
    "status",
    "mentee_count",
    "mentee_uids",
)


def request(
    base_url: str,
    service_role: str,
    path: str,
    method: str = "GET",
    body: Any | None = None,
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
        headers["Prefer"] = "return=minimal"

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


def fetch_pages(
    base_url: str,
    service_role: str,
    table: str,
    columns: str,
    *,
    order: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        query = urllib.parse.urlencode(
            {
                "select": columns,
                "order": order,
                "limit": PAGE_SIZE,
                "offset": offset,
            }
        )
        page = request(base_url, service_role, f"/rest/v1/{table}?{query}")
        if not isinstance(page, list):
            raise SystemExit(f"error: unexpected PostgREST response shape for {table} read")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def is_enrolled(status: Any) -> bool:
    return (status or "").strip().lower() == "enrolled"


def is_team_leader_for_performance(row: dict[str, Any]) -> bool:
    role = (row.get("program_role") or "").strip().lower()
    return role != "scholar" and is_enrolled(row.get("status"))


def normalize_uids(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return sorted({str(uid) for uid in value if uid})


def mentees_by_profile_id(join_rows: list[dict[str, Any]]) -> dict[str, list[str]]:
    grouped: dict[str, set[str]] = defaultdict(set)
    for row in join_rows:
        mentor_id = row.get("mentor_id")
        mentee_uid = row.get("mentee_uid")
        if not mentor_id or not mentee_uid:
            continue
        grouped[str(mentor_id)].add(str(mentee_uid))
    return {mentor_id: sorted(uids) for mentor_id, uids in grouped.items()}


def intended_assignment(
    row: dict[str, Any],
    profile_by_uid: dict[str, dict[str, Any]],
    mentees_by_mentor: dict[str, list[str]],
) -> tuple[int, list[str], bool]:
    """Return (mentee_count, mentee_uids, has_profile)."""
    uid = str(row.get("uid") or "")
    profile = profile_by_uid.get(uid)
    if profile is None:
        return NO_RELATIONSHIP, [], False
    assigned = mentees_by_mentor.get(str(profile["id"]), [])
    if not assigned:
        return NO_RELATIONSHIP, [], True
    return len(assigned), assigned, True


def plan_roster_updates(
    team_leaders: list[dict[str, Any]],
    profile_by_uid: dict[str, dict[str, Any]],
    mentees_by_mentor: dict[str, list[str]],
) -> list[tuple[dict[str, Any], dict[str, Any], bool]]:
    planned: list[tuple[dict[str, Any], dict[str, Any], bool]] = []
    for row in team_leaders:
        count, uids, has_profile = intended_assignment(row, profile_by_uid, mentees_by_mentor)
        current_count = row.get("mentee_count")
        current_uids = normalize_uids(row.get("mentee_uids"))
        if current_count == count and current_uids == uids:
            continue
        planned.append((row, {"mentee_count": count, "mentee_uids": uids}, has_profile))
    return planned


def plan_profile_updates(
    planned_roster: list[tuple[dict[str, Any], dict[str, Any], bool]],
    profile_by_uid: dict[str, dict[str, Any]],
) -> list[tuple[str, int, Any]]:
    """Return (student_id, mentee_count, current_count) for profiles that need a patch."""
    planned: list[tuple[str, int, Any]] = []
    for row, patch, has_profile in planned_roster:
        if not has_profile:
            continue
        uid = str(row.get("uid") or "")
        profile = profile_by_uid.get(uid)
        if profile is None:
            continue
        current = profile.get("mentee_count")
        intended = patch["mentee_count"]
        if current == intended:
            continue
        planned.append((uid, intended, current))
    # Also catch profiles whose roster row already matches but profile count is stale.
    return planned


def extra_profile_updates(
    team_leaders: list[dict[str, Any]],
    planned_roster_uids: set[str],
    profile_by_uid: dict[str, dict[str, Any]],
    mentees_by_mentor: dict[str, list[str]],
) -> list[tuple[str, int, Any]]:
    extra: list[tuple[str, int, Any]] = []
    for row in team_leaders:
        uid = str(row.get("uid") or "")
        if uid in planned_roster_uids:
            continue
        count, _, has_profile = intended_assignment(row, profile_by_uid, mentees_by_mentor)
        if not has_profile:
            continue
        profile = profile_by_uid[uid]
        current = profile.get("mentee_count")
        if current != count:
            extra.append((uid, count, current))
    return extra


def describe_roster_changes(row: dict[str, Any], patch: dict[str, Any]) -> str:
    shown_count = "blank" if row.get("mentee_count") is None else str(row.get("mentee_count"))
    shown_uids = ",".join(normalize_uids(row.get("mentee_uids"))) or "(none)"
    new_uids = ",".join(patch["mentee_uids"]) or "(none)"
    return (
        f"mentee_count: {shown_count} -> {patch['mentee_count']}; "
        f"mentee_uids: {shown_uids} -> {new_uids}"
    )


def print_plan(
    planned_roster: list[tuple[dict[str, Any], dict[str, Any], bool]],
    planned_profiles: list[tuple[str, int, Any]],
) -> None:
    print()
    print(f"=== Planned roster updates ({len(planned_roster)}) ===")
    if not planned_roster:
        print("(none — roster already matches mentor_mentee)")
    else:
        print("\t".join(("uid", "first_name", "last_name", "program_role", "has_profile", "changes")))
        for row, patch, has_profile in planned_roster:
            print(
                "\t".join(
                    (
                        str(row.get("uid") or ""),
                        str(row.get("first_name") or ""),
                        str(row.get("last_name") or ""),
                        str(row.get("program_role") or ""),
                        "yes" if has_profile else "no",
                        describe_roster_changes(row, patch),
                    )
                )
            )

    print()
    print(f"=== Planned profile mentee_count updates ({len(planned_profiles)}) ===")
    if not planned_profiles:
        print("(none — profiles already match)")
        return
    print("\t".join(("student_id", "mentee_count")))
    for uid, count, current in planned_profiles:
        shown = "blank" if current is None else str(current)
        print(f"{uid}\t{shown} -> {count}")


def print_summary(
    *,
    roster_rows: int,
    team_leaders: int,
    with_profile: int,
    without_profile: int,
    with_assignment: int,
    no_relationship: int,
    planned_roster: int,
    planned_profiles: int,
) -> None:
    print()
    print(f"Roster rows read: {roster_rows}")
    print(f"Team leaders (memo performance rule): {team_leaders}")
    print(f"  with a profiles row: {with_profile}")
    print(f"  without a profiles row: {without_profile}")
    print(f"  with mentor_mentee rows: {with_assignment}")
    print(f"  no relationship yet (mentee_count -> {NO_RELATIONSHIP}): {no_relationship}")
    print(f"Roster rows to patch: {planned_roster}")
    print(f"Profile rows to patch: {planned_profiles}")


def apply_roster_updates(
    base_url: str,
    service_role: str,
    planned: list[tuple[dict[str, Any], dict[str, Any], bool]],
    batch_size: int,
) -> int:
    groups: dict[tuple[int, tuple[str, ...]], list[int]] = defaultdict(list)
    for row, patch, _has_profile in planned:
        key = (int(patch["mentee_count"]), tuple(patch["mentee_uids"]))
        groups[key].append(int(row["id"]))

    total = 0
    for (count, uids), ids in groups.items():
        patch = {"mentee_count": count, "mentee_uids": list(uids)}
        for start in range(0, len(ids), batch_size):
            chunk = ids[start : start + batch_size]
            id_list = ",".join(str(i) for i in chunk)
            query = urllib.parse.urlencode({"id": f"in.({id_list})"})
            request(base_url, service_role, f"/rest/v1/user_roster?{query}", "PATCH", patch)
            total += len(chunk)
            print(f"Patched {len(chunk)} roster row(s) mentee_count={count} (running total {total})")
    return total


def apply_profile_updates(
    base_url: str,
    service_role: str,
    planned: list[tuple[str, int, Any]],
    batch_size: int,
) -> int:
    groups: dict[int, list[str]] = defaultdict(list)
    for uid, count, _current in planned:
        groups[count].append(uid)

    total = 0
    for count, uids in groups.items():
        patch = {"mentee_count": count}
        for start in range(0, len(uids), batch_size):
            chunk = uids[start : start + batch_size]
            query = urllib.parse.urlencode({"student_id": f"in.({','.join(chunk)})"})
            request(base_url, service_role, f"/rest/v1/profiles?{query}", "PATCH", patch)
            total += len(chunk)
            print(f"Patched {len(chunk)} profile row(s) mentee_count={count} (running total {total})")
    return total


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync user_roster.mentee_count from public.mentor_mentee"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read tables and print the plan only; send no writes",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=BATCH_SIZE_DEFAULT,
        help=f"Row ids per PATCH request (default {BATCH_SIZE_DEFAULT})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

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

    roster = fetch_pages(url, key, "user_roster", ",".join(ROSTER_COLUMNS), order="id.asc")
    profiles = fetch_pages(url, key, "profiles", "id,student_id,mentee_count", order="id.asc")
    joins = fetch_pages(url, key, "mentor_mentee", "mentor_id,mentee_uid", order="id.asc")

    profile_by_uid = {
        str(row["student_id"]): row
        for row in profiles
        if row.get("student_id")
    }
    mentees_by_mentor = mentees_by_profile_id(joins)
    team_leaders = [row for row in roster if is_team_leader_for_performance(row)]

    planned_roster = plan_roster_updates(team_leaders, profile_by_uid, mentees_by_mentor)
    roster_uids = {str(row.get("uid") or "") for row, _patch, _has in planned_roster}
    planned_profiles = plan_profile_updates(planned_roster, profile_by_uid)
    planned_profiles.extend(
        extra_profile_updates(team_leaders, roster_uids, profile_by_uid, mentees_by_mentor)
    )

    with_profile = 0
    without_profile = 0
    with_assignment = 0
    no_relationship = 0
    for row in team_leaders:
        count, _uids, has_profile = intended_assignment(row, profile_by_uid, mentees_by_mentor)
        if has_profile:
            with_profile += 1
        else:
            without_profile += 1
        if count > 0:
            with_assignment += 1
        else:
            no_relationship += 1

    print_plan(planned_roster, planned_profiles)
    print_summary(
        roster_rows=len(roster),
        team_leaders=len(team_leaders),
        with_profile=with_profile,
        without_profile=without_profile,
        with_assignment=with_assignment,
        no_relationship=no_relationship,
        planned_roster=len(planned_roster),
        planned_profiles=len(planned_profiles),
    )

    if args.dry_run:
        print("Dry run — no data sent to Supabase.")
        return 0

    if not planned_roster and not planned_profiles:
        print("Nothing to patch.")
        return 0

    batch_size = max(1, args.batch_size)
    roster_total = apply_roster_updates(url, key, planned_roster, batch_size) if planned_roster else 0
    profile_total = apply_profile_updates(url, key, planned_profiles, batch_size) if planned_profiles else 0
    print(f"Done. Patched {roster_total} roster row(s) and {profile_total} profile row(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
