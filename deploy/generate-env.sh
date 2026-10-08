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

echo "Done. Keep $ENV_FILE private and back it up — it cannot be regenerated."
