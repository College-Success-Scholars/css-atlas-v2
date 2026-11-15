#!/usr/bin/env bash
# Rerunnable Postgres contract tests for effective-dated schedule assignments.
#
# This is a Postgres contract fixture, not a Supabase end-to-end test: it applies the repo's
# real migrations to a throwaway database in a stock postgres container after
# 00_supabase_shim.sql supplies roles and auth.uid(). hypopg, index_advisor, pg_cron and pgjwt
# are not installable there and are stripped from the sync migration; pg_cron is stubbed.
#
# Usage: supabase/tests/schedule-assignments/run.sh
# Env:   SCHEDULE_TEST_CONTAINER  container running postgres (default atlas-schedule-test-20261115)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$(cd "$HERE/../../migrations" && pwd)"
CONTAINER="${SCHEDULE_TEST_CONTAINER:-atlas-schedule-test-20261115}"
DB="schedtest_$(date +%s)_$$"
TARGET_GLOB="*_team_leader_effective_dated_schedules.sql"

psql_admin() { snip docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql_db() { psql_admin -d "$DB" "$@"; }

cleanup() { psql_admin -d postgres -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql_admin -d postgres -c "CREATE DATABASE \"$DB\"" >/dev/null
psql_admin -d postgres -c "ALTER DATABASE \"$DB\" SET client_min_messages = warning" >/dev/null
psql_db <"$HERE/00_supabase_shim.sql" >/dev/null

apply_migration() {
  { grep -v -i -E '(CREATE|COMMENT ON) EXTENSION "(hypopg|index_advisor|pg_cron|pgjwt)"' "$1" || true; } | psql_db -1 >/dev/null || { echo "migration failed: $1" >&2; return 1; }
}

target_applied=0
for file in "$MIGRATIONS"/*.sql; do
  # shellcheck disable=SC2053
  if [[ "$(basename "$file")" == $TARGET_GLOB ]]; then
    psql_db <"$HERE/05_legacy_seed.sql" >/dev/null
    target_applied=1
  fi
  apply_migration "$file"
done
[[ "$target_applied" == 1 ]] || { echo "target migration not found" >&2; exit 1; }
psql_db <"$HERE/01_helpers.sql" >/dev/null

for test in "$HERE"/[1-9]0_*.test.sql; do
  echo "== $(basename "$test")"
  psql_db <"$test" >/dev/null
  echo "   ok"
done

# shellcheck source=/dev/null
source "$HERE/concurrency.sh"
run_concurrency_tests

echo "schedule assignment contract tests passed"
