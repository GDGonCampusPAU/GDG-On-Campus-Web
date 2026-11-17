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

# Build while the old version keeps serving, so maintenance only covers the container swap.
echo "==> Derleniyor (eski sürüm yayında)"
"${COMPOSE[@]}" build

# Maintenance mode = flag file that nginx checks on every request (same file as the admin panel's
# "Bakım modu"). A flag set by an admin is left alone; only a flag this script wrote is removed.
FLAG_DIR="$APP_DIR/.maintenance"
FLAG="$FLAG_DIR/active.json"
OURS=0
# nginx workers run as the unprivileged "nginx" user: the directory must be world-readable,
# otherwise `-f active.json` is false and maintenance silently never shows.
mkdir -p "$FLAG_DIR" && chmod 755 "$FLAG_DIR"
if [[ -e "$FLAG" ]]; then
  echo "==> Bakım modu zaten açık (elle açılmış); deploy sonrası açık kalacak"
else
  printf '{\n  "since": "%s",\n  "by": { "id": "deploy", "name": "Otomatik deploy (%s)" }\n}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" "$AFTER" > "$FLAG.tmp" && chmod 644 "$FLAG.tmp" && mv "$FLAG.tmp" "$FLAG"
  OURS=1
  echo "==> Bakım modu açıldı"
fi

# Swap in two steps so the maintenance page stays up: the old web (nginx) container keeps
# serving it while mongo/backend are replaced and become healthy; web itself is swapped last,
# leaving only nginx's ~1 s restart without a page. DEPLOY_FORCE_RECREATE=1 recreates everything.
UP_FLAGS=(-d --wait --wait-timeout 300)
[[ "${DEPLOY_FORCE_RECREATE:-0}" == 1 ]] && UP_FLAGS+=(--force-recreate)
echo "==> Yeni sürüm başlatılıyor (önce veritabanı + API, sonra web)"
if ! { "${COMPOSE[@]}" up "${UP_FLAGS[@]}" --no-deps mongo backend &&
       "${COMPOSE[@]}" up "${UP_FLAGS[@]}" --no-deps web &&
       "${COMPOSE[@]}" up -d --wait --wait-timeout 300 --remove-orphans; }; then
  "${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}' || true
  echo "!! Başlatma başarısız; site bakım modunda bırakıldı. Düzeltip tekrar deploy edin" >&2
  echo "   ya da bakım modunu panelden / 'rm $FLAG' ile kapatın." >&2
  exit 1
fi

if (( OURS )) && grep -q '"id": "deploy"' "$FLAG" 2>/dev/null; then
  rm -f "$FLAG"
  echo "==> Bakım modu kapatıldı"
fi

echo "==> Eski imajlar temizleniyor"
docker image prune -f >/dev/null

"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
echo "==> Deploy tamam: $AFTER ($(date -Is))"
exit 0
}
