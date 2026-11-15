#!/usr/bin/env bash
# Sourced by run.sh. Uses psql_db and $DB from the caller.
# Two real sessions race on the same expected revision; the winner holds its transaction
# open long enough that the loser is forced to wait on the revision lock.

TL_UID="11111111-1111-1111-1111-111111111111"

worker_sql() { # uid expectedRevision day hold_seconds
  cat <<SQL
DO \$\$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '$TL_UID', 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.replace_scholar_schedule_from_week('$1', 902, '$WEEK'::date, $2,
    jsonb_build_array(jsonb_build_object('kind', 'front_desk', 'dayOfWeek', $3, 'startTime', '09:00', 'endTime', '10:00')));
  PERFORM pg_sleep($4);
  RAISE WARNING 'RESULT=OK';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'RESULT=%', SQLSTATE;
END \$\$;
SQL
}

start_worker() { # outfile uid rev day hold
  worker_sql "$2" "$3" "$4" "$5" | psql_db >"$1" 2>&1 &
}

result_of() { grep -o 'RESULT=[A-Z0-9]*' "$1" | head -1 | cut -d= -f2; }

assert_one_winner() { # label fileA fileB
  local a b
  a="$(result_of "$2")"; b="$(result_of "$3")"
  if [[ "$a $b" != "OK CS409" && "$a $b" != "CS409 OK" ]]; then
    echo "FAIL $1: expected one OK and one CS409, got A=$a B=$b" >&2
    cat "$2" "$3" >&2
    exit 1
  fi
  echo "   ok $1 (A=$a B=$b)"
}

snapshot_line() { # uid
  psql_db -At <<SQL | tail -1
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', '$TL_UID', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT (sc ->> 'revision') || '|' || jsonb_array_length(sc -> 'shifts')
FROM jsonb_array_elements(public.get_schedule_snapshot('$WEEK'::date, '$1') -> 'scholars') sc;
COMMIT;
SQL
}

run_concurrency_tests() {
  echo "== concurrency"
  WEEK="$(psql_db -At -c "SELECT public.eastern_week_start(now())")"
  local tmp; tmp="$(mktemp -d)"

  # First creation race: no revision row exists for S4 yet.
  start_worker "$tmp/a1" S4 0 1 1.5
  sleep 0.4
  start_worker "$tmp/b1" S4 0 2 0
  wait
  assert_one_winner "first creation of a revision row" "$tmp/a1" "$tmp/b1"

  # Same version race on an existing revision row.
  start_worker "$tmp/a2" S1 0 1 1.5
  sleep 0.4
  start_worker "$tmp/b2" S1 0 2 0
  wait
  assert_one_winner "same expected revision" "$tmp/a2" "$tmp/b2"
  [[ "$(psql_db -At -c "SELECT revision FROM public.scholar_schedule_revisions WHERE scholar_id='S1' AND semester_id=902")" == 1 ]] \
    || { echo "FAIL: revision should be 1 after the race" >&2; exit 1; }
  [[ "$(psql_db -At -c "SELECT count(*) FROM public.scholar_shift_assignments WHERE scholar_id='S1' AND effective_from = '$WEEK' AND session_kind='front_desk'")" == 1 ]] \
    || { echo "FAIL: loser must leave no rows behind" >&2; exit 1; }

  # Unsynchronized start.
  start_worker "$tmp/a3" S2 0 1 0
  start_worker "$tmp/b3" S2 0 2 0
  wait
  assert_one_winner "simultaneous start" "$tmp/a3" "$tmp/b3"

  # Readers see rows and revision from the same committed state, never a mix.
  start_worker "$tmp/w4" S3 0 1 2.0
  sleep 0.8
  local during after
  during="$(snapshot_line S3)"
  wait
  after="$(snapshot_line S3)"
  [[ "$during" == "0|0" ]] || { echo "FAIL: snapshot during the open write was '$during', want 0|0" >&2; exit 1; }
  [[ "$after" == "1|1" ]] || { echo "FAIL: snapshot after commit was '$after', want 1|1" >&2; exit 1; }
  echo "   ok snapshot read is consistent (during=$during after=$after)"
  rm -rf "$tmp"
}
