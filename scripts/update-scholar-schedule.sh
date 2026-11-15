#!/usr/bin/env bash

printf '%s\n' \
  'error: this schedule writer is retired. Use /dashboard/schedules to edit recurring schedules through the revision-checked API.' \
  >&2
exit 1
