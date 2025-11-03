#!/usr/bin/env sh
set -eu

API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
TEMPLATE_PATH=/etc/nginx/templates/config.template.js
OUTPUT_PATH=/usr/share/nginx/html/config.js

# Escape characters that would break sed replacement.
escape_sed() {
  printf '%s' "$1" | sed -e 's/[\\/&]/\\&/g'
}

escaped_api_base_url=$(escape_sed "$API_BASE_URL")
mkdir -p "$(dirname "$OUTPUT_PATH")"
sed "s/__API_BASE_URL__/${escaped_api_base_url}/g" "$TEMPLATE_PATH" > "$OUTPUT_PATH"

exec "$@"
