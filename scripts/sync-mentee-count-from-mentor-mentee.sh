#!/usr/bin/env bash
# Sync user_roster.mentee_count / mentee_uids from public.mentor_mentee.
#
# Team leaders (roster program_role ≠ scholar, status = enrolled) with no join
# rows get mentee_count = -1 (no relationship yet). Assigned TLs get the join
# count. Linked profiles.mentee_count is updated to match.
#
# Usage:
#   ./scripts/sync-mentee-count-from-mentor-mentee.sh --dry-run
#   ./scripts/sync-mentee-count-from-mentor-mentee.sh
#
# URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the current shell, or URL-only
# from backend/.env (never reads SUPABASE_SERVICE_ROLE_KEY from project env files).
#
# Service role: prompted interactively (hidden) unless already set in this shell.
# --dry-run still needs credentials because it reads roster / profiles / joins first.
#
# Exit codes: 0 = success, 1 = failure

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="${REPO_ROOT}/scripts/sync-mentee-count-from-mentor-mentee.py"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/sync-mentee-count-from-mentor-mentee.sh [options]

Sets user_roster.mentee_count from public.mentor_mentee for team leaders.

Options:
  --dry-run              Print the plan; send no writes (still reads the tables)
  --batch-size N         Row ids per PATCH request (default 100)
  -h, --help             Show this help

Requires: python3.
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

exec python3 "$HELPER" "$@"
