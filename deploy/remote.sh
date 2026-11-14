#!/usr/bin/env bash
# The server side of deploy/deploy.sh. It is sent over SSH (or run locally on the server); do not
# run it by hand.
#
#   remote.sh deploy   <sha> <ref> <subject> <deployer> <compose.yaml text>   (git archive on stdin)
#   remote.sh rollback <deployer>
#
# Every argument is base64 when it comes through deploy.sh over SSH, so decode with d() first.
# Steps (deploy), under a lock:
#   1. build the image from the stdin build context as lifeguessr-app:candidate
#   2. keep the running image as :previous, make the candidate :latest
#   3. install compose.yaml, `docker compose up -d`, wait for the health check
#   4. unhealthy: put :previous back automatically and fail the deploy
#   5. record the deployed commit in $APP_DIR/DEPLOYED
set -euo pipefail

# stdin is the build context: keep it on fd 3 for the build, so every other command reads nothing.
exec 3<&0 0</dev/null

d() { printf '%s' "$1" | base64 -d; }
MODE=$(d "$1")

APP_DIR=${LIFEGUESSR_DIR:-$HOME/lifeguessr}
IMAGE=lifeguessr-app
cd "$APP_DIR" 2>/dev/null || { echo "deploy: $APP_DIR is missing; create it and its .env first (deploy/README.md)" >&2; exit 1; }
exec 9>.deploy.lock
flock -n 9 || { echo "deploy: another deploy is running on the server" >&2; exit 1; }
[ -f .env ] || { echo "deploy: $APP_DIR/.env is missing (deploy/README.md)" >&2; exit 1; }

# Wait up to ~2 minutes for the container to report healthy. Prints the final status.
wait_healthy() {
  local cid status='' _
  cid=$(docker compose ps -q app)
  for _ in $(seq 1 40); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
    [ "$status" = healthy ] && break
    [ "$status" = unhealthy ] && break
    sleep 3
  done
  echo "$status"
}

record() { # record <commit> <ref> <subject> <by> <note>
  printf 'commit=%s\nref=%s\nsubject=%s\nby=%s\nat=%s\nnote=%s\n' "$1" "$2" "$3" "$4" "$(date -u +%FT%TZ)" "$5" > DEPLOYED
}

if [ "$MODE" = rollback ]; then
  BY=$(d "$2")
  docker image inspect "$IMAGE:previous" >/dev/null 2>&1 || { echo "deploy: there is no $IMAGE:previous to roll back to" >&2; exit 1; }
  docker tag "$IMAGE:previous" "$IMAGE:latest"
  docker compose up -d --force-recreate
  status=$(wait_healthy)
  [ "$status" = healthy ] || { docker compose logs --tail 60 app >&2; echo "deploy: rolled back, but the app is $status" >&2; exit 1; }
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
docker compose -f compose.yaml.new config --quiet
mv compose.yaml.new compose.yaml

# NEXT_PUBLIC_* flags are baked into the client bundle, so they are read from .env at build time.
BUILD_ARGS=()
for v in NEXT_PUBLIC_GAME_SOURCE NEXT_PUBLIC_SESSION_SOURCE; do
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

# The build worked: keep what runs now for rollback, then switch.
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi
docker tag "$IMAGE:candidate" "$IMAGE:latest"
docker rmi "$IMAGE:candidate" >/dev/null

echo "deploy: starting"
docker compose up -d
status=$(wait_healthy)
if [ "$status" != healthy ]; then
  docker compose logs --tail 60 app >&2
  if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
    echo "deploy: the new image is $status; putting the previous image back" >&2
    docker tag "$IMAGE:previous" "$IMAGE:latest"
    docker compose up -d --force-recreate
    back=$(wait_healthy)
    echo "deploy: previous image is $back" >&2
  else
    echo "deploy: the new image is $status and there is no previous image to go back to" >&2
  fi
  exit 1
fi

# Old builds of this app are now untagged; drop them (nothing else on the server is touched).
docker image prune -f --filter label=org.opencontainers.image.title=lifeguessr >/dev/null
record "$SHA" "$REF" "$SUBJECT" "$DEPLOYER" deploy
echo "deploy: healthy: ${SHA:0:12} ($REF)"

# Informational: ask the public URL too, when .env names it. A failure here does not fail the deploy.
PUBLIC_URL=$(sed -n 's/^PUBLIC_URL=//p' .env | tail -1)
if [ -n "$PUBLIC_URL" ]; then
  printf 'deploy: public health: '
  curl -fsS --max-time 20 "$PUBLIC_URL/api/health" && echo || echo "(not reachable from the server; check Funnel)"
fi
