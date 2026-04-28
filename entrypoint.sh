#!/bin/sh

# Export current environment variables into a file that cron jobs can source.
# Cron runs in a minimal environment without access to container env vars.
env | grep -E '^(DATABASE_URL|NODE_ENV|LOG_LEVEL|BUILD_COMMIT|BUILD_BRANCH)=' > /app/.env.cron

# Install the crontab
crontab /etc/crontabs/app

# Start crond in the background
crond -l 2

# Start the Node.js server as PID 1 (via exec) so it receives signals properly
exec node server.js
