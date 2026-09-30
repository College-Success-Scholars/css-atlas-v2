#!/usr/bin/env bash
# Remove one scholar: mentor_mentee link, profile, auth user, and user_roster row.
#
# Prints the roster card first. A real run deletes only after the operator types
# yes. --dry-run prints the card and writes nothing.
#
# Usage:
#   ./scripts/remove-scholar.sh
#   ./scripts/remove-scholar.sh 123456789
#   ./scripts/remove-scholar.sh --dry-run 123456789
#
# URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the current shell, or URL-only
# from backend/.env (never reads SUPABASE_SERVICE_ROLE_KEY from project env files).
#
# Service role: prompted interactively (hidden) unless already set in this shell.
# --dry-run still needs credentials because it reads the roster before printing.
#
# Exit codes: 0 = success (or the operator declined), 1 = failure

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="${REPO_ROOT}/scripts/remove-scholar.py"
ARGS=("$@")
UID_ARG=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/remove-scholar.sh [options] [UID]

Prompts for a scholar UID when one is not given. Prints who they are, and on
confirmation removes:

  1. mentor_mentee rows where they are the mentee
  2. notification_log rows for their profile (so the profile delete can succeed)
  3. the profiles row (cascades mentor_mentee rows where they are the mentor)
  4. the auth user
  5. the user_roster row (cascades scholar_shift_assignments)

Form logs, front-desk logs, study-session logs, excuses, and weekly stats stay.

Options:
  --dry-run    Print the card and write nothing (still reads Supabase)
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
      if [[ -n "$UID_ARG" ]]; then
        echo "error: unexpected argument: $1" >&2
        usage >&2
        exit 1
      fi
      UID_ARG="$1"
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
