#!/usr/bin/env bash
# Acceptance test: the waiting run survives `docker compose restart` and the SAME run resumes.
#   1. post a request and run to the wait
#   2. docker compose restart (the whole iMBrace stack)
#   3. post the reply webhook
#   4. the same run resumes, gets approved and calls the business system
# Exit code 0 = pass.
set -euo pipefail
. "$(dirname "$0")/common.sh"

COMPOSE_FILE="${COMPOSE_FILE:-$EXAMPLE_DIR/../../deploy/docker-compose.yml}"
# COMPOSE_PROJECT: set it when the stack runs under another project name (docker compose -p).
COMPOSE=(docker compose -f "$COMPOSE_FILE")
if [ -n "${COMPOSE_PROJECT:-}" ]; then COMPOSE+=(-p "$COMPOSE_PROJECT"); fi
ID="REQ-AT-$(date +%s)"
fail() { echo "FAIL: $*" >&2; exit 1; }
step() { echo; echo "== $*"; }

step "1. Post request $ID and run to the wait"
sed "s/__REQUEST_ID__/$ID/" "$EXAMPLE_DIR/payloads/request.json" |
  curl -sf -o /dev/null -X POST "$INTAKE_URL" -H 'content-type: application/json' --data-binary @- ||
  fail "intake webhook rejected the request"
NOTIFY="$(wait_for_call /notify "$ID" 180)" || fail "no 'information required' message within 180 s"
RUN_ID="$(printf '%s' "$NOTIFY" | json 'j.run_id')"
echo "waiting run: $RUN_ID, missing: $(printf '%s' "$NOTIFY" | json 'j.missing_fields')"

step "2. docker compose restart"
"${COMPOSE[@]}" restart
deadline=$((SECONDS + 300))
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$WORKFLOW_URL/api/v1/flags")" = 200 ]; do
  [ $SECONDS -lt $deadline ] || fail "workflow API not back within 300 s"
  sleep 5
done
echo "stack is back"

step "3. Post the customer reply"
deadline=$((SECONDS + 180)); CODE=000
while [ "$CODE" != 202 ]; do
  [ $SECONDS -lt $deadline ] || fail "reply router never accepted the reply (last HTTP $CODE)"
  CODE="$(sed "s/__REQUEST_ID__/$ID/" "$EXAMPLE_DIR/payloads/reply.json" |
    curl -s -o /dev/null -w '%{http_code}' -X POST "$REPLY_URL/sync" -H 'content-type: application/json' --data-binary @-)"
  [ "$CODE" = 202 ] || sleep 5
done
echo "reply accepted (HTTP 202)"

step "4. Approve and check that the same run finished"
LINKS="$(wait_for_call /approvals "$ID" 120)" || fail "the resumed run never reached the approval step"
[ "$(printf '%s' "$LINKS" | json 'j.run_id')" = "$RUN_ID" ] || fail "approval came from a different run"
curl -sf -o /dev/null -X POST "$(printf '%s' "$LINKS" | json "j.links.find(l => l.name === 'Approve').url")" ||
  fail "could not resolve the approval task"
DONE="$(wait_for_call /business-system "$ID" 120)" || fail "business system was never called"
DONE_RUN="$(printf '%s' "$DONE" | json 'j.run_id')"
[ "$DONE_RUN" = "$RUN_ID" ] || fail "business system called by run $DONE_RUN, expected $RUN_ID"
[ -n "$(printf '%s' "$DONE" | json 'j.reply && j.reply.address')" ] || fail "reply data did not reach the business system"

echo
echo "PASS: run $RUN_ID waited, survived the restart, resumed on the reply and finished."
echo "Trace: $WORKFLOW_URL  ->  Runs  ->  $RUN_ID"
