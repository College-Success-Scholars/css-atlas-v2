#!/usr/bin/env bash
# Replace one scholar's signed-up front-desk and study-session shifts
# for the active semester on public.scholar_shift_assignments.
#
# Does not change user_roster.fd_required / ss_required (those are weekly
# minute totals, not the standing schedule).
#
# Usage:
#   ./scripts/update-scholar-schedule.sh
#   ./scripts/update-scholar-schedule.sh 123456789
#   ./scripts/update-scholar-schedule.sh --dry-run 123456789
#
# URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the current shell, or URL-only
# from backend/.env (never reads SUPABASE_SERVICE_ROLE_KEY from project env files).
#
# Service role: prompted interactively (hidden) unless already set in this shell.
# --dry-run still needs credentials because it reads the roster and current shifts.
#
# Exit codes: 0 = success (or the operator declined the write), 1 = failure

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="${REPO_ROOT}/scripts/update-scholar-schedule.py"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/update-scholar-schedule.sh [options] [UID]

Prompts for a scholar UID (unless UID is given), shows their active signed-up
front-desk and study-session shifts, then reads a replacement list. One shift
per line; a blank line finishes. The list replaces every active shift for that
scholar in the active semester. A blank list clears them.

  fd mon 09:00 11:00
  ss Tuesday 2:00pm 4:00pm
  front_desk wed 14:00-16:00

Options:
  --dry-run    Print the plan and write nothing (still reads Supabase)
  -h, --help   Show this help

Requires: python3.
Does not change weekly fd_required / ss_required totals.
EOF
}

for arg in "$@"; do
  case "$arg" in
  -h | --help)
    usage
    exit 0
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
exec python3 "$HELPER" "$@"
