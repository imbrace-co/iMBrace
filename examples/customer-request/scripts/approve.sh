#!/usr/bin/env bash
# Step 9 without the UI: resolve the approval task.  Usage: approve.sh <request_id> [Approve|Reject]
set -euo pipefail
. "$(dirname "$0")/common.sh"

ID="${1:?usage: approve.sh <request_id> [Approve|Reject]}"
DECISION="${2:-Approve}"
LINKS="$(wait_for_call /approvals "$ID" 60)" || { echo "no approval task for $ID yet" >&2; exit 1; }
URL="$(printf '%s' "$LINKS" | json "j.links.find(l => l.name === '$DECISION').url")"
curl -s -X POST "$URL" -w "\napproval ($DECISION) -> HTTP %{http_code}\n"
