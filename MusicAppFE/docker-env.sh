#!/bin/sh
set -eu

api_url="${VITE_API_URL:-${API_URL:-}}"

if [ -n "$api_url" ]; then
  escaped_api_url=$(printf '%s' "$api_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
  cat > /usr/share/nginx/html/env.js <<EOF
window.__APP_ENV__ = {
  VITE_API_URL: "$escaped_api_url"
};
EOF
else
  cat > /usr/share/nginx/html/env.js <<EOF
window.__APP_ENV__ = {};
EOF
fi
