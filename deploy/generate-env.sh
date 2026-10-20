#!/bin/sh
# Generate the per-install secrets docker-compose.yml requires into .env.
#
# Only keys that are missing from .env are added; existing values are never
# touched. That matters: replacing AP_ENCRYPTION_KEY on a running install makes
# every stored Workflow connection undecryptable, and replacing AP_JWT_SECRET
# signs everyone out.
#
# Formats follow https://www.activepieces.com/docs/install/configuration/environment-variables
#   AP_ENCRYPTION_KEY  32 hex chars (16 bytes)  — openssl rand -hex 16
#   AP_JWT_SECRET      64 hex chars (32 bytes)  — openssl rand -hex 32
#
# Dashboard admin (platform-service NEW_ORG_USERNAME / NEW_ORG_PASSWORD):
#   ADMIN_EMAIL        defaults to admin@imbrace.co (override: ADMIN_EMAIL=you@x sh generate-env.sh)
#   ADMIN_PASSWORD     "Im" + 16 hex chars + "@1" — upper, lower, digit and
#                      symbol, and no $ or # (both special in .env / compose)
#   platform-service only applies these when it first creates the org; changing
#   them in .env afterwards does not change the existing admin's password.
#
# Service secrets (all 64 hex chars, openssl rand -hex 32):
#   INTERNAL_SERVICE_KEY          ai-agent -> chat-ai key (unmasked provider
#                                 credentials and DocIQ); safe to rotate
#   CHATAI_ENCRYPTION_SECRET_KEY  encrypts chat-ai's stored LLM provider configs —
#                                 replacing it makes them undecryptable
#   CHATAI_WEBUI_SECRET_KEY       signs chat-ai sessions — replacing it signs
#                                 everyone out
#   GARAGE_RPC_SECRET             Garage (S3) rpc_secret
#
# Datastore passwords (32 hex chars, openssl rand -hex 16):
#   POSTGRES_PASSWORD  initdb only runs once — changing it after the first run
#                      also needs an `ALTER ROLE` inside Postgres, or the
#                      services using the old password can no longer connect.
#   REDIS_PASSWORD     safe to rotate: Redis re-reads it from `--requirepass`
#                      on restart.
#
# Upgrading an install that ran the earlier compose file (fixed values)? Put the
# old values into .env BEFORE running this script, so existing data still works:
#   ADMIN_PASSWORD=ChangeMe@12345
#   CHATAI_ENCRYPTION_SECRET_KEY=imbrace2026
#   CHATAI_WEBUI_SECRET_KEY=Ga9fImSJMCx5d9qLkRNwCQJ9I//573YWZ0zcl34n8pU=
set -eu

cd "$(dirname "$0")"
ENV_FILE=.env

rand_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
  fi
}

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

add_if_missing() {
  if grep -q "^$1=" "$ENV_FILE"; then
    echo "kept      $1 (already in $ENV_FILE)"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
    echo "generated $1"
  fi
}

add_if_missing AP_ENCRYPTION_KEY "$(rand_hex 16)"
add_if_missing AP_JWT_SECRET "$(rand_hex 32)"
add_if_missing ADMIN_EMAIL "${ADMIN_EMAIL:-admin@imbrace.co}"
add_if_missing ADMIN_PASSWORD "Im$(rand_hex 8)@1"
add_if_missing INTERNAL_SERVICE_KEY "$(rand_hex 32)"
add_if_missing CHATAI_ENCRYPTION_SECRET_KEY "$(rand_hex 32)"
add_if_missing CHATAI_WEBUI_SECRET_KEY "$(rand_hex 32)"
add_if_missing GARAGE_RPC_SECRET "$(rand_hex 32)"
add_if_missing POSTGRES_PASSWORD "$(rand_hex 16)"
add_if_missing REDIS_PASSWORD "$(rand_hex 16)"

echo
echo "Dashboard login: $(sed -n 's/^ADMIN_EMAIL=//p' "$ENV_FILE") / $(sed -n 's/^ADMIN_PASSWORD=//p' "$ENV_FILE")"
echo "Done. Keep $ENV_FILE private and back it up — it cannot be regenerated."
