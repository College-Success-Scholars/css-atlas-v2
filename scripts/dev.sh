#!/usr/bin/env bash
# Start local full-stack development (shared watch + backend + frontend).
#
# Usage:
#   ./scripts/dev.sh
#   ./scripts/dev.sh --install     # npm install in shared, backend, frontend first
#   ./scripts/dev.sh --no-watch    # build shared once; skip tsc --watch
#
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
#
# Prerequisites:
#   backend/.env       (copy from backend/.env.example)
#   frontend/.env.local (copy from frontend/.env.example)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INSTALL=false
WATCH_SHARED=true

for arg in "$@"; do
  case "$arg" in
    --install)
      INSTALL=true
      ;;
    --no-watch)
      WATCH_SHARED=false
      ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Run ./scripts/dev.sh --help for usage." >&2
      exit 1
      ;;
  esac
done

if [[ ! -f backend/.env ]]; then
  echo "Missing backend/.env — copy backend/.env.example and set Supabase credentials." >&2
  exit 1
fi

if [[ ! -f frontend/.env.local && ! -f frontend/.env ]]; then
  echo "Missing frontend/.env.local — copy frontend/.env.example and set Supabase credentials." >&2
  exit 1
fi

PIDS=()

cleanup() {
  local pid
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if $INSTALL; then
  echo "Installing dependencies..."
  npm install --prefix shared
  npm install --prefix backend
  npm install --prefix frontend
fi

echo "Building shared..."
npm run build --prefix shared

# Turbopack root is the monorepo (so shared/dist resolves). Next lives under
# frontend/node_modules — without this link HMR panics: "Next.js package not found"
# and remounts the app in a loop (repeated /api/auth/me + layout fetches).
mkdir -p "$ROOT/node_modules"
ln -sfn "$ROOT/frontend/node_modules/next" "$ROOT/node_modules/next"

if $WATCH_SHARED; then
  echo "Watching shared for changes..."
  # npm run sets cwd to shared/, so tsconfig.json resolves (unlike npm exec from repo root).
  npm run watch --prefix shared &
  PIDS+=("$!")
fi

echo "Starting backend (port 3001)..."
npm run dev --prefix backend &
PIDS+=("$!")

echo "Starting frontend (port 3000)..."
npm run dev --prefix frontend &
PIDS+=("$!")

echo ""
echo "Dev stack running:"
echo "  Frontend  http://localhost:3000"
echo "  Backend   http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# wait -n is unavailable on macOS's default Bash 3.2; plain wait is portable.
wait
