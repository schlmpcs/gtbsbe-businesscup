#!/usr/bin/env bash
# The server side of deploy/deploy.sh. It is sent over SSH (or run locally on the server); do not
# run it by hand.
#
#   remote.sh deploy   <sha> <ref> <subject> <deployer> <compose.yaml text>   (git archive on stdin)
#   remote.sh rollback <deployer>
#
# Every argument is base64 when it comes through deploy.sh over SSH, so decode with d() first.
# Steps (deploy), under a lock:
#   1. check .env and compose.yaml, then build the image from stdin as lifeguessr-app:candidate
#   2. make sure the postgres service runs and is healthy (its volume is never recreated), and
#      back the database up to $APP_DIR/backups before the new image can migrate it
#   3. keep the running app image as :previous, make the candidate :latest, recreate the app only
#   4. wait for the app's health check (liveness), then for its store to report ok (readiness)
#   5. either fails: put :previous back automatically and fail the deploy
#   6. record the deployed commit in $APP_DIR/DEPLOYED
set -euo pipefail

# stdin is the build context: keep it on fd 3 for the build, so every other command reads nothing.
exec 3<&0 0</dev/null

d() { printf '%s' "$1" | base64 -d; }
MODE=$(d "$1")

APP_DIR=${LIFEGUESSR_DIR:-$HOME/lifeguessr}
IMAGE=lifeguessr-app
BACKUPS_KEPT=14
cd "$APP_DIR" 2>/dev/null || { echo "deploy: $APP_DIR is missing; create it and its .env first (deploy/README.md)" >&2; exit 1; }
exec 9>.deploy.lock
flock -n 9 || { echo "deploy: another deploy is running on the server" >&2; exit 1; }
[ -f .env ] || { echo "deploy: $APP_DIR/.env is missing (deploy/README.md)" >&2; exit 1; }

# Fail with a reason instead of deep inside a build. The compose and buildx plugins are installed
# per user, so a new runner user can lack them (deploy/README.md).
docker info >/dev/null 2>&1 || { echo "deploy: docker is not reachable for user $(id -un); is it in the docker group?" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "deploy: the docker compose plugin is missing for user $(id -un)" >&2; exit 1; }
if [ "$MODE" = deploy ]; then
  docker buildx version >/dev/null 2>&1 || { echo "deploy: the docker buildx plugin is missing for user $(id -un); put docker-buildx in ~/.docker/cli-plugins (deploy/README.md)" >&2; exit 1; }
fi

# The store password goes into a postgres:// URL, so it must be URL-safe. Checked by name and
# shape only; the value is never printed.
STORE_PASSWORD_LINE=$(grep -E '^STORE_PASSWORD=' .env | tail -1 || true)
[ -n "$STORE_PASSWORD_LINE" ] || { echo "deploy: STORE_PASSWORD is missing from $APP_DIR/.env; generate one with: openssl rand -hex 32 (deploy/README.md)" >&2; exit 1; }
printf '%s\n' "$STORE_PASSWORD_LINE" | grep -Eq "^STORE_PASSWORD=([\"']?)[A-Za-z0-9]{32,}\\1\$" || {
  echo "deploy: STORE_PASSWORD in $APP_DIR/.env must be at least 32 letters or digits (it goes into a URL); generate one with: openssl rand -hex 32" >&2
  exit 1
}
unset STORE_PASSWORD_LINE

# Wait up to ~2 minutes for a service's container to report healthy. Prints the final status.
wait_healthy() { # wait_healthy <service>
  local cid status='' _
  cid=$(docker compose ps -q "$1")
  [ -n "$cid" ] || { echo missing; return; }
  for _ in $(seq 1 40); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
    [ "$status" = healthy ] && break
    [ "$status" = unhealthy ] && break
    sleep 3
  done
  echo "$status"
}

# The `store.status` that /api/health reports from inside the app container ('ok' when the app
# connected and migrated). Retries for about a minute, then prints the last answer.
wait_store() {
  local status='' _
  for _ in $(seq 1 20); do
    status=$(docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => r.json()).then((b) => console.log((b.store && b.store.status) || 'missing'), () => console.log('error'))" 2>/dev/null || echo error)
    [ "$status" = ok ] && break
    sleep 3
  done
  echo "$status"
}

# Start the postgres service if it is not running (a no-op when it is and its config is unchanged)
# and wait for it. `up` never recreates the pgdata volume.
ensure_store() {
  docker compose up -d postgres
  local status
  status=$(wait_healthy postgres)
  if [ "$status" != healthy ]; then
    docker compose logs --tail 60 postgres >&2
    echo "deploy: the postgres service is $status" >&2
    return 1
  fi
}

# pg_dump of the store into backups/ (custom format; restore with pg_restore, deploy/README.md).
# Written to a temp name first, so a failed dump never looks like a backup. Keeps the newest
# $BACKUPS_KEPT dumps. Prints the file name.
backup_store() { # backup_store <label>
  local name tmp
  name="backups/lifeguessr-$(date -u +%Y%m%dT%H%M%SZ)-$1.dump"
  tmp="$name.partial"
  (umask 077 && mkdir -p backups)
  if ! (umask 077 && docker compose exec -T postgres pg_dump -U lifeguessr -d lifeguessr --format=custom > "$tmp"); then
    rm -f -- "$tmp"
    return 1
  fi
  mv -- "$tmp" "$name"
  # Rotate: only this script's own dump files, oldest beyond the newest $BACKUPS_KEPT.
  find backups -maxdepth 1 -type f -name 'lifeguessr-*.dump' -printf '%T@ %p\n' | sort -rn | tail -n +$((BACKUPS_KEPT + 1)) | cut -d' ' -f2- |
    while IFS= read -r old; do rm -f -- "$old"; done
  echo "$name"
}

# Recreate the app container on whatever :latest is now, leaving postgres alone.
start_app() {
  docker compose up -d --no-deps --force-recreate app
}

record() { # record <commit> <ref> <subject> <by> <note>
  printf 'commit=%s\nref=%s\nsubject=%s\nby=%s\nat=%s\nnote=%s\n' "$1" "$2" "$3" "$4" "$(date -u +%FT%TZ)" "$5" > DEPLOYED
}

if [ "$MODE" = rollback ]; then
  BY=$(d "$2")
  docker image inspect "$IMAGE:previous" >/dev/null 2>&1 || { echo "deploy: there is no $IMAGE:previous to roll back to" >&2; exit 1; }
  ensure_store || echo "deploy: rolling back anyway; the store routes will answer 503 until postgres is healthy" >&2
  docker tag "$IMAGE:previous" "$IMAGE:latest"
  start_app
  status=$(wait_healthy app)
  [ "$status" = healthy ] || { docker compose logs --tail 60 app >&2; echo "deploy: rolled back, but the app is $status" >&2; exit 1; }
  store=$(wait_store)
  [ "$store" = ok ] || echo "deploy: warning: after the rollback the app reports its store as '$store'" >&2
  record "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$IMAGE:latest")" rollback "rolled back to the previous image" "$BY" rollback
  echo "deploy: rolled back; healthy"
  exit 0
fi

[ "$MODE" = deploy ] || { echo "deploy: unknown mode '$MODE'" >&2; exit 1; }
SHA=$(d "$2") REF=$(d "$3") SUBJECT=$(d "$4") DEPLOYER=$(d "$5") COMPOSE=$(d "$6")

FREE_GB=$(df -BG --output=avail "$APP_DIR" | tail -1 | tr -dc 0-9)
[ "$FREE_GB" -ge 8 ] || { echo "deploy: only ${FREE_GB} GB free on the server; need 8" >&2; exit 1; }

if ss -Htln 'sport = :3000' | grep -q . && [ -z "$(docker compose ps -q app 2>/dev/null)" ]; then
  echo "deploy: port 3000 on the server is held by something other than the app: ss -tlnp 'sport = :3000'" >&2
  exit 1
fi

echo "deploy: compose file"
printf '%s\n' "$COMPOSE" > compose.yaml.new
# Also fails here, before any build, when a required .env value (STORE_PASSWORD) is missing.
docker compose -f compose.yaml.new config --quiet
mv compose.yaml.new compose.yaml

# NEXT_PUBLIC_* flags are baked into the client bundle, so they are read from .env at build time.
BUILD_ARGS=()
for v in NEXT_PUBLIC_GAME_SOURCE NEXT_PUBLIC_SESSION_SOURCE NEXT_PUBLIC_EVENTS_SOURCE NEXT_PUBLIC_AVATARS_ENABLED NEXT_PUBLIC_GAME_MODE NEXT_PUBLIC_DUEL_SOURCE; do
  val=$(sed -n "s/^$v=//p" .env | tail -1)
  [ -z "$val" ] || BUILD_ARGS+=(--build-arg "$v=$val")
done

echo "deploy: building ${SHA:0:12}"
docker buildx build --progress=plain --load -f deploy/Dockerfile \
  ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} \
  --label org.opencontainers.image.title=lifeguessr \
  --label "org.opencontainers.image.revision=$SHA" \
  -t "$IMAGE:candidate" - <&3 2>&1 | tail -n 40 || {
  echo "deploy: build failed; the running app is unchanged" >&2
  exit 1
}

echo "deploy: store"
ensure_store || { docker rmi "$IMAGE:candidate" >/dev/null 2>&1 || true; echo "deploy: the running app is unchanged" >&2; exit 1; }
BACKUP=$(backup_store "${SHA:0:12}") || {
  docker rmi "$IMAGE:candidate" >/dev/null 2>&1 || true
  echo "deploy: could not back up the store; not deploying (the running app is unchanged)" >&2
  exit 1
}
echo "deploy: store backed up to $APP_DIR/$BACKUP"

# The build worked: keep what runs now for rollback, then switch.
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi
docker tag "$IMAGE:candidate" "$IMAGE:latest"
docker rmi "$IMAGE:candidate" >/dev/null

echo "deploy: starting"
start_app
status=$(wait_healthy app)
# Liveness passed: now the new image must be able to use the store (connect + migrate). A failure
# here most likely comes from the new image, and going back is safe: a failed migration rolled
# itself back, and successful ones are additive (apps/web/src/server/store/migrations/index.ts).
store=skipped
[ "$status" != healthy ] || store=$(wait_store)
if [ "$status" != healthy ] || [ "$store" != ok ]; then
  docker compose logs --tail 60 app >&2
  if [ "$status" != healthy ]; then why="the new image is $status"; else why="the new image's store is '$store'"; fi
  if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
    echo "deploy: $why; putting the previous image back" >&2
    docker tag "$IMAGE:previous" "$IMAGE:latest"
    start_app
    back=$(wait_healthy app)
    echo "deploy: previous image is $back" >&2
  else
    echo "deploy: $why and there is no previous image to go back to" >&2
  fi
  exit 1
fi

# Old builds of this app are now untagged; drop them (nothing else on the server is touched).
docker image prune -f --filter label=org.opencontainers.image.title=lifeguessr >/dev/null
record "$SHA" "$REF" "$SUBJECT" "$DEPLOYER" deploy
echo "deploy: healthy, store ok: ${SHA:0:12} ($REF)"

# Informational: ask the public URL too, when .env names it. A failure here does not fail the deploy.
PUBLIC_URL=$(sed -n 's/^PUBLIC_URL=//p' .env | tail -1)
if [ -n "$PUBLIC_URL" ]; then
  printf 'deploy: public health: '
  curl -fsS --max-time 20 "$PUBLIC_URL/api/health" && echo || echo "(not reachable from the server; check Funnel)"
fi
