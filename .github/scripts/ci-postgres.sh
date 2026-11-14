#!/usr/bin/env bash
# The throwaway Postgres of a CI job on the team server's runners (deploy/README.md, "CI runners").
#
#   ci-postgres.sh start <database>   start it, wait until it accepts TCP, write PG_URL to $GITHUB_ENV
#   ci-postgres.sh stop               remove it (run with `if: always()`)
#
# Not a `services:` container. Under rootless Docker the daemon picks a "random" host port without
# seeing which host ports are taken (a job failed on "address already in use"), and on the network a
# `services:` job creates it published that port on 0.0.0.0. Here each runner has a fixed port, 2000
# above its E2E_PORT (5101..5103, below the kernel's ephemeral range), bound to 127.0.0.1 only. One
# runner runs one job at a time, so the port and the container name are never shared.
set -euo pipefail

: "${E2E_PORT:?the runner sets E2E_PORT in its .env (deploy/ci-runner/install.sh)}"
port=$((E2E_PORT + 2000))
name=ci-postgres-$port

case ${1:-} in
start)
  db=${2:?usage: ci-postgres.sh start <database>}
  # Left over from a cancelled job on this runner.
  docker rm -f "$name" >/dev/null 2>&1 || true
  # Same major version as deploy/compose.yaml. The password only exists inside this job. The health
  # check goes over TCP: during first-run init the image's temporary server listens on the socket only.
  docker run -d --name "$name" -p "127.0.0.1:$port:5432" \
    -e POSTGRES_USER=lifeguessr -e POSTGRES_PASSWORD=ci-only-not-a-secret -e POSTGRES_DB="$db" \
    --health-cmd "pg_isready -h 127.0.0.1 -U lifeguessr -d $db" \
    --health-interval 1s --health-timeout 5s --health-retries 60 \
    postgres:17-alpine >/dev/null
  status=starting
  for _ in $(seq 1 90); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$name")
    [ "$status" = healthy ] && break
    [ "$status" = unhealthy ] && break
    sleep 1
  done
  if [ "$status" != healthy ]; then
    docker logs --tail 30 "$name" >&2 || true
    echo "ci-postgres.sh: $name is $status" >&2
    exit 1
  fi
  echo "PG_URL=postgres://lifeguessr:ci-only-not-a-secret@localhost:$port/$db" >>"$GITHUB_ENV"
  echo "postgres ready on 127.0.0.1:$port/$db"
  ;;
stop)
  docker rm -f "$name" >/dev/null 2>&1 || true
  ;;
*)
  echo "usage: ci-postgres.sh start <database> | stop" >&2
  exit 2
  ;;
esac
