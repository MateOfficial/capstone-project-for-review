#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[RELEASE] 1/4 Containers status"
docker compose ps

echo "[RELEASE] 2/4 Backend image build (retry up to 3 times)"
for i in 1 2 3; do
  echo "[RELEASE] backend build attempt $i"
  if docker compose build backend; then
    break
  fi
  if [[ "$i" -eq 3 ]]; then
    echo "[RELEASE] backend build failed after retries"
    exit 1
  fi
done

echo "[RELEASE] 3/4 Frontend image build"
docker compose build frontend

echo "[RELEASE] 4/4 Smoke checks"
"$ROOT_DIR/scripts/smoke-check.sh"

echo "[RELEASE] OK: release checks passed"
