#!/usr/bin/env python3
"""
Remove one scholar from user_roster and the mentor_mentee link.

Invoked by scripts/remove-scholar.sh. Looks the uid up, prints a card, and
deletes only after the operator types yes (or passes --yes).

Delete order is fixed by foreign keys:

  1. mentor_mentee where mentee_uid = uid (TL denormalization still sees the mentor)
  2. notification_log for the profile (no ON DELETE; blocks the profile delete)
  3. profiles where student_id = uid (cascades mentor_mentee where they are mentor)
  4. auth user (profiles.id is auth.users.id; migrations do not cascade that)
  5. user_roster (cascades scholar_shift_assignments)

Form logs, front-desk / study-session logs, excuses, and weekly stats stay.
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
from typing import Any

PAGE_SIZE = 1000


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"error: {name} is unset")
    return value


def request(
    base_url: str,
    service_role: str,
    path: str,
    method: str = "GET",
    *,
    prefer: str | None = None,
) -> Any:
    endpoint = base_url.rstrip("/") + path
    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Accept": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer

    req = urllib.request.Request(endpoint, method=method, headers=headers)
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
    # Keep PostgREST filter punctuation and embed hints (!, parentheses) intact.
    query = "&".join(
        f"{urllib.parse.quote(key, safe='')}={urllib.parse.quote(value, safe='-.,()*:=!')}"
        for key, value in params
    )
    return f"/rest/v1/{table}?{query}"


def fetch_all(
    base_url: str,
    service_role: str,
    table: str,
    columns: str,
    filters: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        params = [
            ("select", columns),
            ("limit", str(PAGE_SIZE)),
            ("offset", str(offset)),
            *filters,
        ]
        page = request(base_url, service_role, rest_path(table, params))
        if not isinstance(page, list):
            raise SystemExit(f"error: unexpected response shape for {table}")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def delete_rows(
    base_url: str,
    service_role: str,
    table: str,
    filters: list[tuple[str, str]],
) -> list[Any]:
    deleted = request(
        base_url,
        service_role,
        rest_path(table, filters),
        method="DELETE",
        prefer="return=representation",
    )
    if deleted is None:
        return []
    if not isinstance(deleted, list):
        raise SystemExit(f"error: unexpected response shape for {table} delete")
    return deleted


def delete_auth_user(base_url: str, service_role: str, user_id: str) -> str:
    quoted = urllib.parse.quote(user_id, safe="-")
    endpoint = base_url.rstrip("/") + f"/auth/v1/admin/users/{quoted}"
    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Accept": "application/json",
    }
    req = urllib.request.Request(endpoint, method="DELETE", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status not in (200, 204):
                raise SystemExit(f"error: auth admin returned HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "already gone"
        detail = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"error: auth admin HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise SystemExit(f"error: auth admin request failed: {e.reason}") from e
    return "deleted"


def show(value: Any) -> str:
    if value is None or value == "":
        return "—"
    if isinstance(value, list):
        parts = [str(item) for item in value if item not in (None, "")]
        return ", ".join(parts) if parts else "—"
    return str(value)


def person_name(row: dict[str, Any]) -> str:
    full = str(row.get("full_name") or "").strip()
    if full:
        return full
    first = str(row.get("first_name") or "").strip()
    last = str(row.get("last_name") or "").strip()
    return f"{first} {last}".strip() or "—"


def mentor_profile(row: dict[str, Any]) -> dict[str, Any] | None:
    profile = row.get("profiles")
    if isinstance(profile, list):
        profile = profile[0] if profile else None
    if isinstance(profile, dict):
        return profile
    return None


def mentor_label(row: dict[str, Any]) -> str:
    profile = mentor_profile(row)
    if profile is None:
        return f"mentor_id {show(row.get('mentor_id'))}"
    student_id = profile.get("student_id") or "no student_id"
    return f"{person_name(profile)} ({student_id})"


def fetch_roster(base_url: str, service_role: str, uid: str) -> dict[str, Any]:
    rows = fetch_all(
        base_url,
        service_role,
        "user_roster",
        "uid,first_name,last_name,email,program_role,status,cohort,teams",
        [("uid", f"eq.{uid}")],
    )
    if len(rows) == 0:
        raise SystemExit(f"error: no user_roster row for uid {uid}")
    if len(rows) > 1:
        raise SystemExit(f"error: more than one user_roster row for uid {uid}")
    return rows[0]


def fetch_profile(base_url: str, service_role: str, uid: str) -> dict[str, Any] | None:
    rows = fetch_all(
        base_url,
        service_role,
        "profiles",
        "id,app_role,emails,first_name,last_name,student_id",
        [("student_id", f"eq.{uid}")],
    )
    if len(rows) > 1:
        raise SystemExit(f"error: more than one profiles row for student_id {uid}")
    return rows[0] if rows else None


def fetch_mentee_links(
    base_url: str, service_role: str, uid: str
) -> list[dict[str, Any]]:
    return fetch_all(
        base_url,
        service_role,
        "mentor_mentee",
        "id,mentor_id,profiles!mentor_mentee_mentor_id_fkey(student_id,first_name,last_name,full_name)",
        [("mentee_uid", f"eq.{uid}")],
    )


def fetch_mentor_links(
    base_url: str, service_role: str, profile_id: str
) -> list[dict[str, Any]]:
    return fetch_all(
        base_url,
        service_role,
        "mentor_mentee",
        "mentee_uid",
        [("mentor_id", f"eq.{profile_id}")],
    )


def print_card(
    roster: dict[str, Any],
    profile: dict[str, Any] | None,
    mentee_links: list[dict[str, Any]],
    mentor_links: list[dict[str, Any]],
    notification_count: int,
    shift_count: int,
) -> None:
    role = str(roster.get("program_role") or "").strip().lower()
    if role != "scholar":
        print(
            "warning: program_role is not scholar. "
            "Confirm only if this is the person you mean."
        )
        print()

    print("user_roster")
    print(f"  uid:            {show(roster.get('uid'))}")
    print(f"  name:           {person_name(roster)}")
    print(f"  email:          {show(roster.get('email'))}")
    print(f"  program_role:   {show(roster.get('program_role'))}")
    print(f"  status:         {show(roster.get('status'))}")
    print(f"  cohort:         {show(roster.get('cohort'))}")
    print(f"  teams:          {show(roster.get('teams'))}")
    print()

    print("profile")
    if profile is None:
        print("  no profile")
    else:
        print(f"  id:             {show(profile.get('id'))}")
        print(f"  app_role:       {show(profile.get('app_role'))}")
        print(f"  emails:         {show(profile.get('emails'))}")
    print()

    print("mentor_mentee (this person is the mentee)")
    if not mentee_links:
        print("  no mentor_mentee row")
    else:
        for link in mentee_links:
            print(f"  mentor:         {mentor_label(link)}")
    print()

    if mentor_links:
        uids = ", ".join(show(row.get("mentee_uid")) for row in mentor_links)
        print(
            "warning: this person is a mentor. "
            "Deleting the profile cascades those assignments and unassigns the mentees."
        )
        print(f"  mentee rows:    {len(mentor_links)} ({uids})")
        print()

    print("also removed")
    print(f"  notification_log:          {notification_count}")
    print(f"  scholar_shift_assignments: {shift_count} (cascade with the roster row)")
    print()
    print(
        "left in place: form logs, front-desk logs, study-session logs, "
        "excuses, weekly stats"
    )


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


def confirm(assume_yes: bool) -> None:
    if assume_yes:
        return
    if not sys.stdin.isatty():
        raise SystemExit(
            "error: stdin is not a TTY (cannot prompt). "
            "Pass --yes to remove without a prompt."
        )
    print()
    answer = input("Remove this scholar? Type yes to confirm: ")
    if answer.strip() != "yes":
        print("aborted")
        raise SystemExit(0)


def remove(
    base_url: str,
    service_role: str,
    uid: str,
    profile: dict[str, Any] | None,
) -> None:
    mentee_deleted = delete_rows(
        base_url,
        service_role,
        "mentor_mentee",
        [("mentee_uid", f"eq.{uid}")],
    )
    print(f"deleted mentor_mentee mentee rows: {len(mentee_deleted)}")

    if profile is None:
        print("skipped notification_log (no profile)")
        print("skipped profiles (no profile)")
        print("skipped auth user (no profile)")
    else:
        profile_id = str(profile.get("id") or "").strip()
        if not profile_id:
            raise SystemExit(f"error: profiles row for student_id {uid} has no id")
        notes_deleted = delete_rows(
            base_url,
            service_role,
            "notification_log",
            [("recipient_id", f"eq.{profile_id}")],
        )
        print(f"deleted notification_log rows: {len(notes_deleted)}")

        profiles_deleted = delete_rows(
            base_url,
            service_role,
            "profiles",
            [("student_id", f"eq.{uid}")],
        )
        print(f"deleted profiles rows: {len(profiles_deleted)}")

        auth_status = delete_auth_user(base_url, service_role, profile_id)
        print(f"auth user {profile_id}: {auth_status}")

    roster_deleted = delete_rows(
        base_url,
        service_role,
        "user_roster",
        [("uid", f"eq.{uid}")],
    )
    print(f"deleted user_roster rows: {len(roster_deleted)}")
    if len(roster_deleted) != 1:
        raise SystemExit(
            f"error: expected to delete 1 user_roster row, deleted {len(roster_deleted)}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove a scholar from user_roster and mentor_mentee.",
    )
    parser.add_argument(
        "uid",
        nargs="?",
        help="user_roster uid to remove. Prompted when omitted.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the card and write nothing.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt.",
    )
    args = parser.parse_args()

    uid = prompt_uid(args.uid)

    base_url = require_env("SUPABASE_URL")
    service_role = require_env("SUPABASE_SERVICE_ROLE_KEY")

    roster = fetch_roster(base_url, service_role, uid)
    profile = fetch_profile(base_url, service_role, uid)
    mentee_links = fetch_mentee_links(base_url, service_role, uid)
    mentor_links: list[dict[str, Any]] = []
    notification_count = 0
    if profile is not None:
        profile_id = str(profile.get("id") or "").strip()
        if not profile_id:
            raise SystemExit(f"error: profiles row for student_id {uid} has no id")
        mentor_links = fetch_mentor_links(base_url, service_role, profile_id)
        notification_count = len(
            fetch_all(
                base_url,
                service_role,
                "notification_log",
                "id",
                [("recipient_id", f"eq.{profile_id}")],
            )
        )
    shift_count = len(
        fetch_all(
            base_url,
            service_role,
            "scholar_shift_assignments",
            "id",
            [("scholar_id", f"eq.{uid}")],
        )
    )

    print_card(
        roster,
        profile,
        mentee_links,
        mentor_links,
        notification_count,
        shift_count,
    )

    if args.dry_run:
        print()
        print("dry run: no rows deleted")
        return

    confirm(args.yes)
    print()
    remove(base_url, service_role, uid, profile)


if __name__ == "__main__":
    main()
