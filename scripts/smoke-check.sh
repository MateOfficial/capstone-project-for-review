#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
API_URL="${API_URL:-$BASE_URL/api}"
LOGIN_USER="${LOGIN_USER:-admin}"
LOGIN_PASS="${LOGIN_PASS:-123123}"

say() {
  printf "[SMOKE] %s\n" "$1"
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1"; exit 1; }
}

need_cmd curl
need_cmd python3

say "1/5 Backend health"
health_json="$(curl -fsS "$BASE_URL:8080/actuator/health")"
health_status="$(printf '%s' "$health_json" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')"
[[ "$health_status" == "UP" ]] || { echo "Backend is not UP: $health_json"; exit 1; }

say "2/5 Frontend reachable"
frontend_code="$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/catalog")"
[[ "$frontend_code" == "200" ]] || { echo "Frontend HTTP code: $frontend_code"; exit 1; }

say "3/5 Login and token"
login_json="$(curl -fsS -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$LOGIN_USER\",\"password\":\"$LOGIN_PASS\"}")"
access_token="$(printf '%s' "$login_json" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("data",{}).get("accessToken",""))')"
[[ -n "$access_token" ]] || { echo "No accessToken in login response"; exit 1; }

say "4/5 Import endpoint authorization (must not be 403)"
import_code="$(curl -s -o /tmp/storeflow-smoke-import.json -w "%{http_code}" -X POST "$API_URL/admin/integrations/1c/import" -H "Authorization: Bearer $access_token" -F "stockFile=@/dev/null;type=application/octet-stream" -F "priceFile=@/dev/null;type=application/octet-stream")"
if [[ "$import_code" == "403" ]]; then
  echo "Import endpoint returned 403 (forbidden)."
  cat /tmp/storeflow-smoke-import.json || true
  exit 1
fi

say "5/5 Public catalog API"
products_code="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/public/products?page=0&size=1")"
[[ "$products_code" == "200" ]] || { echo "Public products endpoint HTTP code: $products_code"; exit 1; }

say "OK: smoke checks passed"
echo "health=$health_status frontend=$frontend_code import_code=$import_code public_products=$products_code"
