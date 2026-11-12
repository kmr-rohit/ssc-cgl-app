#!/usr/bin/env bash
# Dev server wired to the LOCAL Supabase stack (npx supabase start).
# Uses Vite mode "localstack": .env.localstack.local outranks .env.local (which points at the hosted project).
set -euo pipefail
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: API_URL is not local ($API_URL)" >&2; exit 1;; esac
printf 'VITE_SUPABASE_URL=%s\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\n' "$API_URL" "$PUBLISHABLE_KEY" > .env.localstack.local
exec npx vite --mode localstack --port "${PORT:-5174}" --strictPort
