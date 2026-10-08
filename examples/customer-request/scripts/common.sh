# Shared helpers for the customer-request scripts. Source, don't run.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(dirname "$HERE")"
STATE="$HERE/.state.json"
STUB_URL="${STUB_URL:-http://127.0.0.1:30800}"
WORKFLOW_URL="${WORKFLOW_URL:-http://127.0.0.1:30700}"

[ -f "$STATE" ] || { echo "Run 'node scripts/setup.mjs' first." >&2; exit 1; }

# json <expression over j> < input   e.g. json 'j.flows.intake.webhookUrl' < file
json() { node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));const r=($1);process.stdout.write(r==null?'':typeof r==='string'?r:JSON.stringify(r))"; }

INTAKE_URL="$(json 'j.flows.intake.webhookUrl' < "$STATE")"
REPLY_URL="$(json 'j.flows.replyRouter.webhookUrl' < "$STATE")"

# stub_call <path> <request_id>  -> JSON body of the latest matching call, empty if none
stub_call() {
  curl -s "$STUB_URL/calls?path=$1&request_id=$2" | json 'j.length ? j[j.length-1].body : null'
}

# wait_for_call <path> <request_id> [timeout_s]
wait_for_call() {
  local deadline=$((SECONDS + ${3:-120})) body
  while [ $SECONDS -lt $deadline ]; do
    body="$(stub_call "$1" "$2")"
    [ -n "$body" ] && { printf '%s' "$body"; return 0; }
    sleep 2
  done
  return 1
}
