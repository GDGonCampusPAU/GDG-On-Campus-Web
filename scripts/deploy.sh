#!/usr/bin/env bash
# Production deploy on the server: pull the tracked branch and rebuild the compose stack.
#
# Run by GitHub Actions (deploy job in .github/workflows/check.yml) through a dedicated SSH key whose
# authorized_keys entry forces this script:  command="/root/gdg-web/scripts/deploy.sh",restrict ssh-ed25519 ...
# The key can only trigger a deploy; the requested branch arrives in SSH_ORIGINAL_COMMAND and
# must equal DEPLOY_BRANCH from the server's root .env (switch dev -> main there and in check.yml).
#
# Manual run on the server:  /root/gdg-web/scripts/deploy.sh dev

# The whole body sits inside { ... } so bash parses it before running: `git reset` below may
# rewrite this very file mid-run.
{
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

DEPLOY_BRANCH="$(sed -n 's/^DEPLOY_BRANCH=//p' .env 2>/dev/null | tail -n1)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-dev}"
REQUESTED="${SSH_ORIGINAL_COMMAND:-${1:-$DEPLOY_BRANCH}}"

if [[ ! "$REQUESTED" =~ ^[A-Za-z0-9._/-]+$ ]] || [[ "$REQUESTED" != "$DEPLOY_BRANCH" ]]; then
  echo "Reddedildi: '$REQUESTED' istendi, sunucu '$DEPLOY_BRANCH' dalını takip ediyor (.env DEPLOY_BRANCH)." >&2
  exit 2
fi

# One deploy at a time.
exec 9>/tmp/gdg-web-deploy.lock
flock -w 600 9 || { echo "Başka bir deploy sürüyor, zaman aşımı." >&2; exit 3; }

COMPOSE=(docker compose -f compose.prod.yaml)

echo "==> $DEPLOY_BRANCH çekiliyor"
git fetch --prune origin "$DEPLOY_BRANCH"
BEFORE="$(git rev-parse --short HEAD)"
git checkout -q -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"
git reset -q --hard "origin/$DEPLOY_BRANCH"
AFTER="$(git rev-parse --short HEAD)"
echo "    $BEFORE -> $AFTER"

echo "==> Derleniyor ve başlatılıyor"
"${COMPOSE[@]}" up -d --build --remove-orphans --wait --wait-timeout 300

echo "==> Eski imajlar temizleniyor"
docker image prune -f >/dev/null

"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
echo "==> Deploy tamam: $AFTER ($(date -Is))"
exit 0
}
