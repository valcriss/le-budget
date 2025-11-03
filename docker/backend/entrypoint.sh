#!/usr/bin/env bash
set -euo pipefail

# Ensure database migrations are applied before starting the API.
npx prisma migrate deploy

exec "$@"
