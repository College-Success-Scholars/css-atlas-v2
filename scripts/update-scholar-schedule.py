#!/usr/bin/env python3
"""Retired schedule writer. Use /dashboard/schedules instead."""

import sys


def main() -> int:
    print(
        "error: this schedule writer is retired. Use /dashboard/schedules to edit "
        "recurring schedules through the revision-checked API.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
