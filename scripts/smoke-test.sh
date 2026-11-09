#!/usr/bin/env bash
# Deployment smoke test — run against any deployed backend URL
#
# Usage:
#   BASE_URL=https://your-backend.railway.app ./scripts/smoke-test.sh
#   BASE_URL=https://your-app.vercel.app/_/backend ./scripts/smoke-test.sh
#   SMOKE_ORIGIN=http://localhost:3002 ./scripts/smoke-test.sh   # bare app.ts default CORS
#
# Exit codes: 0 = all passed, 1 = at least one check failed

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
# Must match an origin allowed by the target (Docker Compose defaults to :3000; bare app.ts defaults to :3002)
SMOKE_ORIGIN="${SMOKE_ORIGIN:-${CORS_ORIGIN:-http://localhost:3000}}"
SMOKE_ORIGIN="${SMOKE_ORIGIN%%,*}"
SMOKE_ORIGIN="${SMOKE_ORIGIN// /}"
PASS=0
FAIL=0

check() {
  local description="$1"
  local expected_status="$2"
  local actual_status="$3"

  if [ "$actual_status" = "$expected_status" ]; then
    echo "  PASS  $description (HTTP $actual_status)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $description (expected HTTP $expected_status, got HTTP $actual_status)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "Smoke testing: $BASE_URL"
echo "-------------------------------------------"

# Health check
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
check "GET / health check" "200" "$STATUS"

# Auth gating — all protected routes must return 401 without a token
for ROUTE in \
  "/api/auth/me" \
  "/api/memo/page-data" \
  "/api/users" \
  "/api/session-logs" \
  "/api/attendance/week/1?kind=front_desk" \
  "/api/traffic" \
  "/api/form-logs" \
  "/api/daily-activity" \
  "/api/tutor-reports"
do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$ROUTE")
  check "GET $ROUTE is auth-gated" "401" "$STATUS"
done

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/dev/test-profiles")
check "GET /api/dev/test-profiles is auth-gated" "401" "$STATUS"

# CORS header present on health check (Origin must be in the server's CORS_ORIGIN allowlist)
CORS_HEADER=$(curl -s -o /dev/null -D - -H "Origin: $SMOKE_ORIGIN" "$BASE_URL/" | grep -i "access-control-allow-origin" | tr -d '\r\n' || true)
if [ -n "$CORS_HEADER" ]; then
  echo "  PASS  CORS header present on GET /"
  PASS=$((PASS + 1))
else
  echo "  FAIL  CORS header missing on GET /"
  FAIL=$((FAIL + 1))
fi

echo "-------------------------------------------"
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
