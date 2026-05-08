#!/bin/bash
# Launch Chrome with remote debugging for MCP agent access.
# Log in to your app in this browser instance — both Playwright MCP and
# Chrome DevTools MCP will share the authenticated session.
#
# Usage: ./scripts/dev-chrome.sh [url]

PORT=9222
URL="${1:-http://localhost:5173}"

echo "Starting Chrome with remote debugging on port $PORT..."
echo "Navigate to $URL and log in — MCP agents will share this session."

/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$HOME/.chrome-dev-debug" \
  "$URL" 2>/dev/null &

echo "Chrome PID: $!"
echo "CDP endpoint: http://localhost:$PORT"
