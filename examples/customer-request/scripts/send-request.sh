#!/usr/bin/env bash
# Step 1: post a service request with missing fields.  Usage: send-request.sh [request_id]
set -euo pipefail
. "$(dirname "$0")/common.sh"

ID="${1:-REQ-$(date +%s)}"
sed "s/__REQUEST_ID__/$ID/" "$EXAMPLE_DIR/payloads/request.json" |
  curl -s -o /dev/null -w "intake webhook -> HTTP %{http_code}\n" -X POST "$INTAKE_URL" \
    -H 'content-type: application/json' --data-binary @-

echo "request_id: $ID"
echo "waiting for the 'information required' message ..."
wait_for_call /notify "$ID" | json 'j' && echo
