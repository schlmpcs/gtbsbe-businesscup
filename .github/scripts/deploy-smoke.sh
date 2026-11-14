#!/usr/bin/env bash
# CI only (.github/workflows/ci.yml → deploy-smoke). Runs deploy/deploy.sh on the CI runner with
# DEPLOY_HOST=local, exactly as the server's runner does, then checks what a real deploy must
# guarantee with the app + postgres stack:
#   1. a first deploy brings up both services; /api/health reports the store ok and that the image
#      was built as production (the duel at /play, against the server: the Dockerfile's defaults,
#      since the .env below sets no game flag); a session saves; a funnel event is stored
#      (migration 004) and GET /api/events/funnel counts it; the duel plays on the real image and
#      Postgres: five duels with no answer in them, a hint, a pick, and the pick's share card
#   2. postgres is not published on any host port
#   3. a redeploy keeps the same postgres container and volume, so the saved session, the funnel
#      event and the duel pick survive, and leaves one more store backup behind
#   4. --rollback puts the previous image back; the session and the duel pick still load
#   5. a database outage leaves the app live (health 200, store unavailable, session 503, the day's
#      duels without progress still served) and the app recovers by itself when postgres is back
#   6. a .env without STORE_PASSWORD stops the deploy before it builds, and the app keeps running
# Everything is throwaway: a temp app folder, a random password, a runner that is discarded.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

export LIFEGUESSR_DIR="${RUNNER_TEMP:?run this in GitHub Actions}/lifeguessr"
export DEPLOY_HOST=local
APP=http://127.0.0.1:3000
ANON=$(node -e 'console.log(crypto.randomUUID())')

compose() { (cd "$LIFEGUESSR_DIR" && docker compose "$@"); }
fail() { echo "deploy-smoke: FAILED: $*" >&2; compose ps -a >&2 || true; compose logs --tail 80 >&2 || true; exit 1; }
step() { echo; echo "=== $*"; }
health() { curl -fsS --max-time 10 "$APP/api/health"; }
load_session() { curl -sS --max-time 10 -H "x-anon-id: $ANON" "$APP/api/session"; }
wait_for() { # wait_for <description> <command…>: retry for about a minute
  local what=$1 _
  shift
  for _ in $(seq 1 30); do "$@" >/dev/null 2>&1 && return 0; sleep 2; done
  fail "timed out waiting for $what"
}

step "server folder and .env (throwaway values)"
mkdir -p "$LIFEGUESSR_DIR"
(umask 077 && {
  echo "STORE_PASSWORD=$(openssl rand -hex 32)"
  echo "NEXT_PUBLIC_SESSION_SOURCE=api"
  echo "NEXT_PUBLIC_EVENTS_SOURCE=api"
} > "$LIFEGUESSR_DIR/.env")

step "1. first deploy"
deploy/deploy.sh HEAD
health | tee /dev/stderr | jq -e '.ok == true and .store.status == "ok" and .store.backend == "postgres"' >/dev/null ||
  fail "health does not report a working Postgres store"
# The .env above has no game flag, so these are the Dockerfile's defaults: production's (#120).
health | jq -e '.build == {gameMode: "duel", gameSource: "api", duelSource: "api"}' >/dev/null ||
  fail "the image was not built as production (the duel at /play against the server): $(health | jq -c .build)"

body=$(jq -c -n --arg id "$ANON" --slurpfile p packages/data/fixtures/profile.demo.json '{anonId: $id, profile: ($p[0] | .age.value = 33)}')
saved=$(curl -fsS --max-time 10 -X POST "$APP/api/session" -H 'content-type: application/json' -H "x-anon-id: $ANON" -d "$body")
echo "$saved" | jq -e '.ok == true and .revision == 1 and .profile.age.value == 33' >/dev/null || fail "session save: $saved"

event=$(jq -c -n --arg id "$ANON" --arg eid "$(node -e 'console.log(crypto.randomUUID())')" '{anonId: $id, events: [{id: $eid, name: "forecast_viewed"}]}')
stored=$(curl -fsS --max-time 10 -X POST "$APP/api/events" -H 'content-type: application/json' -H "x-anon-id: $ANON" -d "$event")
echo "$stored" | jq -e '.ok == true and .accepted == 1' >/dev/null || fail "event: $stored"
funnel() { curl -fsS --max-time 10 "$APP/api/events/funnel?days=1"; }
funnel | jq -e '.ok == true and .events.forecast_viewed == 1' >/dev/null || fail "the funnel does not count the event: $(funnel)"

step "1b. the duel against the server, on the real image and Postgres"
duel_daily() { curl -fsS --max-time 10 -H "x-anon-id: $ANON" "$APP/api/daily?game=duel"; }
duel_post() { curl -fsS --max-time 10 -X POST "$APP/api/daily/$1" -H 'content-type: application/json' -H "x-anon-id: $ANON" -d "$2"; }
# Five public duels and a fresh player's empty day; nothing that gives an answer away before a pick.
duel_daily | jq -e '.ok == true and (.duels | length) == 5 and (.progress.picks | length) == 0 and ([.. | objects | keys[] | select(. == "total" or . == "totals" or . == "zip" or . == "tier")] | length) == 0' >/dev/null ||
  fail "GET /api/daily?game=duel: $(duel_daily)"
duel_date=$(duel_daily | jq -r .date)
hint=$(duel_post hint "$(jq -c -n --arg id "$ANON" --arg d "$duel_date" '{anonId: $id, date: $d, round: 1}')")
echo "$hint" | jq -e '.recorded == true and (.A | type) == "string" and (.B | type) == "string"' >/dev/null || fail "duel hint: $hint"
pick=$(duel_post pick "$(jq -c -n --arg id "$ANON" --arg d "$duel_date" '{anonId: $id, date: $d, round: 1, choice: "A"}')")
echo "$pick" | jq -e '.replayed == false and (.points == 0 or .points == 900) and (.resultId | test("^[0-9a-f]{32}$"))' >/dev/null || fail "duel pick: $pick"
duel_result=$(echo "$pick" | jq -r .resultId)
duel_kept() { duel_daily | jq -e --arg r "$duel_result" '.progress.picks["1"].choice == "A" and .progress.picks["1"].result.resultId == $r' >/dev/null; }
duel_kept || fail "the pick is not in the day's progress: $(duel_daily)"
share=$(curl -sS --max-time 30 -o /dev/null -w '%{http_code} %{content_type}' "$APP/api/share?resultId=$duel_result")
[ "$share" = "200 image/png" ] || fail "the share card of the duel day answered: $share"

step "2. postgres is reachable only inside the compose network"
pg_id=$(compose ps -q postgres)
[ -n "$pg_id" ] || fail "no postgres container"
ports=$(docker inspect -f '{{json .NetworkSettings.Ports}}' "$pg_id")
echo "postgres ports: $ports"
echo "$ports" | jq -e '[.[] | select(. != null)] | length == 0' >/dev/null || fail "postgres is published on the host: $ports"
volume=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$pg_id")
[ -n "$volume" ] || fail "postgres has no named data volume"

step "3. redeploy keeps the database"
deploy/deploy.sh HEAD
[ "$(compose ps -q postgres)" = "$pg_id" ] || fail "the redeploy recreated the postgres container"
docker volume inspect "$volume" >/dev/null || fail "the data volume is gone"
load_session | jq -e '.revision == 1 and .profile.age.value == 33' >/dev/null || fail "the session did not survive the redeploy"
funnel | jq -e '.events.forecast_viewed == 1' >/dev/null || fail "the funnel event did not survive the redeploy"
duel_kept || fail "the duel pick did not survive the redeploy"
backups=$(find "$LIFEGUESSR_DIR/backups" -name 'lifeguessr-*.dump' | wc -l)
[ "$backups" -eq 2 ] || fail "expected 2 store backups, found $backups"
[ "$(stat -c %a "$LIFEGUESSR_DIR/backups")" = 700 ] || fail "the backups folder is not private"

step "4. rollback"
deploy/deploy.sh --rollback
[ "$(compose ps -q postgres)" = "$pg_id" ] || fail "the rollback recreated the postgres container"
load_session | jq -e '.revision == 1 and .profile.age.value == 33' >/dev/null || fail "the session did not survive the rollback"
duel_kept || fail "the duel pick did not survive the rollback"

step "5. database outage: the app stays live and recovers"
compose stop postgres
health | tee /dev/stderr | jq -e '.ok == true and .store.status == "unavailable"' >/dev/null || fail "health during the outage"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H "x-anon-id: $ANON" "$APP/api/session")
[ "$code" = 503 ] || fail "a session load during the outage answered $code, not 503"
# The day's duels need no store; a player's progress does.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H "x-anon-id: $ANON" "$APP/api/daily?game=duel")
[ "$code" = 503 ] || fail "the duel day with progress during the outage answered $code, not 503"
curl -fsS --max-time 15 "$APP/api/daily?game=duel" | jq -e '.ok == true and (.duels | length) == 5' >/dev/null ||
  fail "the day's duels were not served without the store"
compose start postgres
wait_for "the store to come back" sh -c "curl -fsS --max-time 5 $APP/api/health | jq -e '.store.status == \"ok\"'"
load_session | jq -e '.profile.age.value == 33' >/dev/null || fail "the session after the outage"
duel_kept || fail "the duel pick after the outage"
app_status=$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q app)")
[ "$app_status" = healthy ] || fail "the app container is $app_status after the outage"

step "6. a missing STORE_PASSWORD stops the deploy before it builds"
cp "$LIFEGUESSR_DIR/.env" "$LIFEGUESSR_DIR/.env.full"
grep -v '^STORE_PASSWORD=' "$LIFEGUESSR_DIR/.env.full" > "$LIFEGUESSR_DIR/.env"
if out=$(deploy/deploy.sh HEAD 2>&1); then fail "deployed without STORE_PASSWORD"; fi
echo "$out" | tail -3
echo "$out" | grep -q 'STORE_PASSWORD is missing' || fail "no clear message for the missing STORE_PASSWORD"
echo "$out" | grep -q 'deploy: building' && fail "it started building without STORE_PASSWORD"
mv "$LIFEGUESSR_DIR/.env.full" "$LIFEGUESSR_DIR/.env"
health | jq -e '.store.status == "ok"' >/dev/null || fail "the app stopped after the refused deploy"

echo
echo "deploy-smoke: all checks passed"
