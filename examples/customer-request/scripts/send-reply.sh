#!/usr/bin/env bash
# Step 7: post the customer's reply for an existing request.  Usage: send-reply.sh <request_id>
set -euo pipefail
. "$(dirname "$0")/common.sh"

ID="${1:?usage: send-reply.sh <request_id>}"
sed "s/__REQUEST_ID__/$ID/" "$EXAMPLE_DIR/payloads/reply.json" |
  curl -s -w "\nreply router -> HTTP %{http_code}\n" -X POST "$REPLY_URL/sync" \
    -H 'content-type: application/json' --data-binary @-
