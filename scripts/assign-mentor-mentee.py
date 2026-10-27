#!/usr/bin/env python3
"""
Pair one mentee to one mentor on public.mentor_mentee.

Invoked by scripts/assign-mentor-mentee.sh. The mentor argument is
profiles.student_id. Zero profiles or more than one profile is an error.
A mentee already assigned only to that mentor is left alone. Any other
current mentor is replaced only after the operator types yes (or passes
--yes).

The write deletes every mentor_mentee row for the mentee, then inserts one.
The sync trigger refreshes OLD.mentor_id on DELETE and NEW.mentor_id on
INSERT, so an UPDATE of mentor_id would leave the previous mentor's
mentee_count stale.

Does not write PII or credentials to disk. Service role key must come from
the environment (set by the shell after an interactive prompt).
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
    if prefer:
        headers["Prefer"] = prefer
    elif data is not None:
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


def show(value: Any) -> str:
    if value is None or value == "":
        return "—"
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


def target_label(roster: dict[str, Any], student_id: str) -> str:
    return f"{person_name(roster)} ({student_id})"


def fetch_roster(base_url: str, service_role: str, uid: str, who: str) -> dict[str, Any]:
    rows = fetch_all(
        base_url,
        service_role,
        "user_roster",
        "uid,first_name,last_name,program_role",
        [("uid", f"eq.{uid}")],
    )
    if len(rows) == 0:
        raise SystemExit(f"error: no user_roster row for {who} {uid}")
    if len(rows) > 1:
        raise SystemExit(f"error: more than one user_roster row for {who} {uid}")
    return rows[0]


def fetch_mentor_profile(
    base_url: str, service_role: str, student_id: str
) -> dict[str, Any]:
    rows = fetch_all(
        base_url,
        service_role,
        "profiles",
        "id,first_name,last_name,full_name,student_id",
        [("student_id", f"eq.{student_id}")],
    )
    if len(rows) == 0:
        raise SystemExit(f"error: no profiles row for student_id {student_id}")
    if len(rows) > 1:
        raise SystemExit(
            f"error: more than one profiles row for student_id {student_id}"
        )
    profile = rows[0]
    if not str(profile.get("id") or "").strip():
        raise SystemExit(f"error: profiles row for student_id {student_id} has no id")
    return profile


def fetch_mentee_links(
    base_url: str, service_role: str, uid: str
) -> list[dict[str, Any]]:
    return fetch_all(
        base_url,
        service_role,
        "mentor_mentee",
        "id,mentor_id,mentee_uid,profiles!mentor_mentee_mentor_id_fkey(student_id,first_name,last_name,full_name)",
        [("mentee_uid", f"eq.{uid}")],
    )


def assigned_only_to(links: list[dict[str, Any]], mentor_id: str) -> bool:
    if not links:
        return False
    return all(str(link.get("mentor_id") or "").strip() == mentor_id for link in links)


def prompt_value(given: str | None, label: str) -> str:
    if given is not None and given.strip():
        return given.strip()
    if not sys.stdin.isatty():
        raise SystemExit(f"error: pass a {label}, or run this in a terminal")
    try:
        value = input(f"{label}: ").strip()
    except EOFError as e:
        raise SystemExit(f"error: {label} is required") from e
    if not value:
        raise SystemExit(f"error: {label} is required")
    return value


def confirm_prompt(moving: bool, mentor: str) -> str:
    verb = "Move" if moving else "Assign"
    return f"{verb} this mentee to {mentor}? Type yes to confirm: "


def confirm(assume_yes: bool, moving: bool, mentor: str) -> None:
    if assume_yes:
        return
    if not sys.stdin.isatty():
        raise SystemExit(
            "error: stdin is not a TTY (cannot prompt). "
            "Pass --yes to assign without a prompt."
        )
    print()
    answer = input(confirm_prompt(moving, mentor))
    if answer.strip() != "yes":
        print("aborted")
        raise SystemExit(0)


def print_person(title: str, roster: dict[str, Any]) -> None:
    print(title)
    print(f"  uid:            {show(roster.get('uid'))}")
    print(f"  name:           {person_name(roster)}")
    print(f"  program_role:   {show(roster.get('program_role'))}")


def print_cards(
    mentor_roster: dict[str, Any],
    mentor_profile_row: dict[str, Any],
    mentee_roster: dict[str, Any],
    links: list[dict[str, Any]],
) -> None:
    print_person("mentor", mentor_roster)
    print(f"  profile id:     {show(mentor_profile_row.get('id'))}")
    print()
    print_person("mentee", mentee_roster)
    print()
    print("mentor_mentee (this mentee)")
    if not links:
        print("  no mentor_mentee row")
    else:
        for link in links:
            print(f"  mentor:         {mentor_label(link)}")
    print()


def insert_link(
    base_url: str,
    service_role: str,
    mentor_id: str,
    mentee_uid: str,
) -> None:
    inserted = request(
        base_url,
        service_role,
        "/rest/v1/mentor_mentee",
        method="POST",
        body={"mentor_id": mentor_id, "mentee_uid": mentee_uid},
        prefer="return=representation",
    )
    if not isinstance(inserted, list) or len(inserted) != 1:
        raise SystemExit("error: expected to insert 1 mentor_mentee row")


def restore_links(
    base_url: str,
    service_role: str,
    previous: list[dict[str, Any]],
) -> None:
    body = [
        {"mentor_id": row.get("mentor_id"), "mentee_uid": row.get("mentee_uid")}
        for row in previous
        if row.get("mentor_id") and row.get("mentee_uid")
    ]
    if not body:
        return
    request(
        base_url,
        service_role,
        "/rest/v1/mentor_mentee",
        method="POST",
        body=body,
        prefer="return=representation",
    )


def assign(
    base_url: str,
    service_role: str,
    mentor_id: str,
    mentee_uid: str,
    previous: list[dict[str, Any]],
) -> None:
    deleted = delete_rows(
        base_url,
        service_role,
        "mentor_mentee",
        [("mentee_uid", f"eq.{mentee_uid}")],
    )
    print(f"deleted mentor_mentee rows: {len(deleted)}")
    try:
        insert_link(base_url, service_role, mentor_id, mentee_uid)
    except SystemExit:
        if previous:
            restore_links(base_url, service_role, previous)
            print("restored previous mentor_mentee rows after insert failed")
        raise
    print(f"inserted mentor_mentee row: mentor_id {mentor_id} mentee_uid {mentee_uid}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pair one mentee to one mentor on mentor_mentee.",
    )
    parser.add_argument(
        "mentor_student_id",
        nargs="?",
        help="Mentor profiles.student_id. Prompted when omitted.",
    )
    parser.add_argument(
        "mentee_uid",
        nargs="?",
        help="Mentee user_roster.uid. Prompted when omitted.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the cards and write nothing.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Skip the confirmation prompt.",
    )
    args = parser.parse_args()

    mentor_student_id = prompt_value(args.mentor_student_id, "Mentor student_id")
    mentee_uid = prompt_value(args.mentee_uid, "Mentee UID")
    if mentor_student_id == mentee_uid:
        raise SystemExit("error: mentor and mentee are the same person")

    base_url = require_env("SUPABASE_URL")
    service_role = require_env("SUPABASE_SERVICE_ROLE_KEY")

    profile = fetch_mentor_profile(base_url, service_role, mentor_student_id)
    mentor_id = str(profile["id"]).strip()
    mentor_roster = fetch_roster(
        base_url, service_role, mentor_student_id, "mentor student_id"
    )
    mentee_roster = fetch_roster(base_url, service_role, mentee_uid, "mentee uid")
    links = fetch_mentee_links(base_url, service_role, mentee_uid)

    print_cards(mentor_roster, profile, mentee_roster, links)

    label = target_label(mentor_roster, mentor_student_id)
    if assigned_only_to(links, mentor_id):
        print(f"already assigned to {label}; no write")
        return

    moving = len(links) > 0
    if args.dry_run:
        print(confirm_prompt(moving, label))
        print("dry run: no rows written")
        return

    confirm(args.yes, moving, label)
    print()
    assign(base_url, service_role, mentor_id, mentee_uid, links)


if __name__ == "__main__":
    main()
