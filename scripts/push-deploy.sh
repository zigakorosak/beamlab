#!/usr/bin/env bash
# Push (which starts the deploy), then wait for it. Usage: scripts/push-deploy.sh "commit message"
set -euo pipefail
cd "$(dirname "$0")"
./git-push.sh "$@"
./watch-deploy.sh
