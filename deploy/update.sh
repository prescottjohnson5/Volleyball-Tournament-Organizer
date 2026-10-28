#!/usr/bin/env bash
# Deploys the latest code on the server (see DEPLOY_AWS.md). Run from anywhere: ./deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
# NEXT_PUBLIC_ values in .env.local are built into the pages, so every change to them needs this build.
npm run build
pm2 restart volleyball --update-env

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://localhost:3000/api/health > /dev/null; then
    echo "The app is up."
    exit 0
  fi
  sleep 2
done
echo "The app did not answer. See the logs with: pm2 logs volleyball" >&2
exit 1
