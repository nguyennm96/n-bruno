#!/bin/bash
# Bruno Server - Quick API Test Script
# Usage: ./test.sh

BASE_URL="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${BLUE}▶  $1${NC}"; }
section() { echo -e "\n${YELLOW}━━━ $1 ━━━${NC}"; }

# ── Health ────────────────────────────────────────────────────────────────────
section "Health Check"
info "GET /api/health"
RESP=$(curl -s "$BASE_URL/api/health")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo "$RESP" | grep -q '"ok"' && pass "Server is healthy" || fail "Server not responding"

# ── Register ──────────────────────────────────────────────────────────────────
section "Auth: Register"
info "POST /api/auth/register"
RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}')
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

# ── Login ─────────────────────────────────────────────────────────────────────
section "Auth: Login"
info "POST /api/auth/login"
LOGIN_RESP_FILE=$(mktemp)
RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')
echo "$RESP" > "$LOGIN_RESP_FILE"
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

ACCESS_TOKEN=$(python3 -c "import sys,json; d=json.load(open('$LOGIN_RESP_FILE')); print(d['data']['access_token'])" 2>/dev/null)
REFRESH_TOKEN=$(python3 -c "import sys,json; d=json.load(open('$LOGIN_RESP_FILE')); print(d['data']['refresh_token'])" 2>/dev/null)

if [ -n "$ACCESS_TOKEN" ]; then
  pass "Got access token"
  echo "   Token: ${ACCESS_TOKEN:0:30}..."
else
  fail "Login failed - stopping tests"
  exit 1
fi

# ── Me ────────────────────────────────────────────────────────────────────────
section "Auth: Get Me"
info "GET /api/auth/me"
RESP=$(curl -s "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo "$RESP" | grep -q '"email"' && pass "Get me works" || fail "Get me failed"

# ── Create Workspace ──────────────────────────────────────────────────────────
section "Workspaces"
info "POST /api/workspaces"
RESP=$(curl -s -X POST "$BASE_URL/api/workspaces" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workspace","description":"Created by test script"}')
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

WORKSPACE_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
if [ -n "$WORKSPACE_ID" ]; then
  pass "Workspace created: $WORKSPACE_ID"
else
  fail "Workspace creation failed"
  exit 1
fi

info "GET /api/workspaces"
RESP=$(curl -s "$BASE_URL/api/workspaces" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
pass "List workspaces"

# ── Create Collection ─────────────────────────────────────────────────────────
section "Collections"
info "POST /api/workspaces/$WORKSPACE_ID/collections"
RESP=$(curl -s -X POST "$BASE_URL/api/workspaces/$WORKSPACE_ID/collections" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My API","description":"Test collection"}')
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

COLLECTION_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
[ -n "$COLLECTION_ID" ] && pass "Collection created: $COLLECTION_ID" || { fail "Collection creation failed"; exit 1; }

# ── Create Folder ─────────────────────────────────────────────────────────────
section "Items: Folder & Request"
info "POST /api/collections/$COLLECTION_ID/folders"
RESP=$(curl -s -X POST "$BASE_URL/api/collections/$COLLECTION_ID/folders" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Users API","sort_order":1.0}')
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

FOLDER_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
[ -n "$FOLDER_ID" ] && pass "Folder created: $FOLDER_ID" || fail "Folder creation failed"

info "POST /api/collections/$COLLECTION_ID/requests"
RESP=$(curl -s -X POST "$BASE_URL/api/collections/$COLLECTION_ID/requests" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Get Users\",\"method\":\"GET\",\"url\":\"https://api.example.com/users\",\"parent_item_id\":\"$FOLDER_ID\",\"sort_order\":1.0}")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

ITEM_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
[ -n "$ITEM_ID" ] && pass "Request created: $ITEM_ID" || fail "Request creation failed"

info "GET /api/collections/$COLLECTION_ID/items"
RESP=$(curl -s "$BASE_URL/api/collections/$COLLECTION_ID/items" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
pass "List items"

# ── Create Environment ────────────────────────────────────────────────────────
section "Environments"
info "POST /api/workspaces/$WORKSPACE_ID/environments"
RESP=$(curl -s -X POST "$BASE_URL/api/workspaces/$WORKSPACE_ID/environments" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Development","variables":[{"key":"API_URL","value":"https://dev.api.example.com","enabled":true},{"key":"API_KEY","value":"dev-secret","enabled":true}]}')
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

ENV_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null)
[ -n "$ENV_ID" ] && pass "Environment created: $ENV_ID" || fail "Environment creation failed"

# ── Create Example ────────────────────────────────────────────────────────────
section "Examples"
if [ -n "$ITEM_ID" ]; then
  info "POST /api/items/$ITEM_ID/examples"
  RESP=$(curl -s -X POST "$BASE_URL/api/items/$ITEM_ID/examples" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"200 OK","status_code":200,"headers":{"Content-Type":"application/json"},"body":"{\"users\":[],\"total\":0}"}')
  echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
  echo "$RESP" | grep -q '"id"' && pass "Example created" || fail "Example creation failed"
fi

# ── Refresh Token ─────────────────────────────────────────────────────────────
section "Auth: Refresh Token"
info "POST /api/auth/refresh"
RESP=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo "$RESP" | grep -q '"access_token"' && pass "Token refreshed" || fail "Token refresh failed"

# ── Permission Test ───────────────────────────────────────────────────────────
section "Security: Unauthorized Access"
info "Access protected route without token"
RESP=$(curl -s "$BASE_URL/api/auth/me")
echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"
echo "$RESP" | grep -q '"UNAUTHORIZED"' && pass "Correctly rejected (401)" || fail "Should have been rejected"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All tests completed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
