#!/usr/bin/env bash
# Pair one mentee to one mentor on public.mentor_mentee.
#
# The mentor is a profiles.student_id. Zero or more than one profile is an
# error. A mentee who already has another mentor is moved only after the
# operator types yes. --dry-run prints the cards and writes nothing.
#
# Usage:
#   ./scripts/assign-mentor-mentee.sh
#   ./scripts/assign-mentor-mentee.sh MENTOR_STUDENT_ID MENTEE_UID
#   ./scripts/assign-mentor-mentee.sh --dry-run MENTOR_STUDENT_ID MENTEE_UID
#
# URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the current shell, or URL-only
# from backend/.env (never reads SUPABASE_SERVICE_ROLE_KEY from project env files).
#
# Service role: prompted interactively (hidden) unless already set in this shell.
# --dry-run still needs credentials because it reads before printing.
#
# Exit codes: 0 = success (or the operator declined), 1 = failure

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="${REPO_ROOT}/scripts/assign-mentor-mentee.py"
ARGS=("$@")
POSITIONAL=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/assign-mentor-mentee.sh [options] [MENTOR_STUDENT_ID] [MENTEE_UID]

Prompts for a mentor student_id and a mentee uid when they are not given.
Looks up exactly one profiles row for that student_id and pairs the mentee
to that profile. A mentee already assigned only to this mentor is left alone.
Anyone else is moved only after you type yes, and the mentee is left with
exactly one mentor_mentee row.

Options:
  --dry-run    Print the cards and write nothing (still reads Supabase)
  --yes        Skip the confirmation prompt (required when stdin is not a TTY)
  -h, --help   Show this help

Requires: python3.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run | --yes)
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      POSITIONAL=$((POSITIONAL + 1))
      if [[ "$POSITIONAL" -gt 2 ]]; then
        echo "error: unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ ! -f "$HELPER" ]]; then
  echo "error: helper not found: $HELPER" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required" >&2
  exit 1
fi

# shellcheck source=scripts/supabase-env.sh
source "${REPO_ROOT}/scripts/supabase-env.sh"

require_supabase_url
require_supabase_service_role

# Key and URL exist only in this process environment for the helper.
# macOS bash 3.2 treats "${ARGS[@]}" as unbound when the array is empty.
if [[ ${#ARGS[@]} -gt 0 ]]; then
  exec python3 "$HELPER" "${ARGS[@]}"
fi
exec python3 "$HELPER"
