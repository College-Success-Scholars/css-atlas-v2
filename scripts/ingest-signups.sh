#!/usr/bin/env bash
# Load a sign-up sheet workbook into public.scholar_shift_assignments.
#
# Parses the human-facing Sign-Up grid (time rows x weekday columns, comma-separated
# names per cell), matches names against public.profiles, and replaces the loaded
# (semester, session_kind, tab) scope with the sheet's current state.
#
# Usage:
#   ./scripts/ingest-signups.sh --session-kind front_desk --dry-run path/to/workbook.xlsx
#   ./scripts/ingest-signups.sh --session-kind front_desk --check   path/to/workbook.xlsx
#   ./scripts/ingest-signups.sh --session-kind front_desk path/to/workbook.xlsx
#
# URL: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the current shell, or URL-only
# from backend/.env (never reads SUPABASE_SERVICE_ROLE_KEY from project env files).
#
# Service role: prompted interactively (hidden) unless already set in this shell.
# --dry-run and --self-test skip the prompt and do not touch the network.
#
# Exit codes: 0 = success, 1 = failure

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER="${REPO_ROOT}/scripts/ingest-signups.py"
NEEDS_CREDENTIALS=1

usage() {
  cat <<'EOF'
Usage:
  ./scripts/ingest-signups.sh --session-kind KIND [options] path/to/workbook.xlsx

Loads standing weekly shifts into public.scholar_shift_assignments from an .xlsx
export of the sign-up sheet (File -> Download -> Microsoft Excel).

Required:
  --session-kind KIND    front_desk (study_session lands with issue #69)

Modes:
  --dry-run              Parse and report only. No credentials, no network.
  --check                Parse and match against profiles. Reads only, writes nothing.
  (neither)              Replace the loaded scope and insert the sheet's current state.
  --self-test            Run the parser's internal assertions and exit

Options:
  --semester-id N        Override semester resolution
  --tabs "A,B"           Load these tabs instead of the profile defaults
  --alias-map FILE       CSV of sheet_name,profile_uuid for names that cannot match
                         automatically. Keep this file outside the repo.
  --allow-empty          Permit clearing the scope when the sheet parses to zero shifts
  --batch-size N         Rows per POST request (default 50)
  -h, --help             Show this help

The sheet is the source of truth: each load deletes the rows in the
(semester, session_kind, tab) scope it is about to load, then inserts what the
sheet currently says. Rows outside that scope are never touched.

Requires: python3 (standard library only).
The workbook is PII — this script does not write transformed copies to disk.
EOF
}

for arg in "$@"; do
  case "$arg" in
  -h | --help)
    usage
    exit 0
    ;;
  --dry-run | --self-test)
    NEEDS_CREDENTIALS=0
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

# A dry run neither reads nor writes Supabase, so it needs no credentials.
if [[ "$NEEDS_CREDENTIALS" -eq 1 ]]; then
  require_supabase_url
  require_supabase_service_role
fi

# Key and URL exist only in this process environment for the helper.
exec python3 "$HELPER" "$@"
