# Deploying LifeGuessr to the team server

Production runs in Docker on the team's own server, behind the Tailscale Funnel host's root `/`
(Funnel terminates HTTPS and proxies to `127.0.0.1:3000`). The server's address and the Funnel
hostname are not in this repo, which is public; ask the team.

| File | What it is |
| --- | --- |
| `Dockerfile` | Next.js standalone build of the pnpm monorepo (`apps/web`), Node 22 |
| `compose.yaml` | Runtime: the app (loopback port 3000, a `/data` volume, healthcheck, 1 GB cap) and `postgres` (the store; compose network only, `pgdata` volume, healthcheck, 512 MB cap) |
| `deploy.sh` | Runs on your machine or on the server: ships a `git archive` and runs `remote.sh` |
| `remote.sh` | The server side: checks, build, store backup, switch, health + store check, automatic rollback |

`.github/workflows/deploy.yml` runs `deploy.sh` after CI is green on `main`. CI's `deploy-smoke` job
runs the same `deploy.sh` on a GitHub runner first (`.github/scripts/deploy-smoke.sh`): first
deploy, redeploy, rollback, a database outage and a missing `STORE_PASSWORD`.

## Deploy by hand

```bash
DEPLOY_HOST=user@host deploy/deploy.sh          # HEAD; or pass a branch, tag or commit
DEPLOY_HOST=user@host deploy/deploy.sh --rollback   # back to the previous image
```

Uncommitted changes are not deployed. A deploy builds the image on the server, makes sure
`postgres` is up and healthy, backs the database up (`~/lifeguessr/backups/`), keeps the running app
image as `lifeguessr-app:previous`, recreates only the app container on the new one and waits for
`/api/health`: first the container's health check (liveness), then `store.status: "ok"` in its
reply (the new image connected to the store and ran its migrations). If either fails it puts the
previous image back by itself and exits non-zero. `postgres` is never recreated by a deploy or a
rollback unless its own section of `compose.yaml` changed, and its `pgdata` volume never is.
`DEPLOYED` on the server records the commit, the author and the time.

Why the container health check ignores the store: a database blip must not make Docker or a deploy
treat a working app as broken (the previous image would use the same database, and every screen
that does not save works without it). A store that fails right after a deploy, though, most likely
comes from the new image (a bad migration), so the deploy checks it once and rolls back on it.

## One-time server setup

1. Create the app folder and its `.env` in the home of the user that runs the runner (names only
   here; values never go in the repo): `~/lifeguessr/.env` (mode 600) with `ANTHROPIC_API_KEY`,
   `ANTHROPIC_MODEL`, `STORE_PASSWORD` (required, see "The store" below),
   `NEXT_PUBLIC_GAME_SOURCE`, `NEXT_PUBLIC_SESSION_SOURCE` (`api` saves sessions to the store),
   `NEXT_PUBLIC_EVENTS_SOURCE` (`api` records funnel events in the store), optionally
   `NEXT_PUBLIC_GAME_MODE` (unset or `duel`: `/play` is the duel "Which life costs more?";
   `slider` brings back the slider game and its streamer mode as a rollback) and
   `NEXT_PUBLIC_DUEL_SOURCE` (unset or `fixtures`: the duel is computed in the browser with the
   real engine, even when `NEXT_PUBLIC_GAME_SOURCE=api`; `api` plays it against the server routes,
   which are not built yet (#115), so leave it unset until the switch-over in #120), and
   optionally `PUBLIC_URL` (the public https URL; `deploy.sh` asks its `/api/health` after a deploy).
   `NEXT_PUBLIC_*` values are read at build time, so changing them needs a new deploy.
   For the Pro paywall demo: `STRIPE_SECRET_KEY` (a **test-mode** key, `sk_test_…`; without it
   checkout is off and only the promo code works), `APP_URL` (the same public https URL, plus the
   sub-path if there is one; Stripe sends the payer back to it) and optionally `PRO_DEMO_CODE`.
   Who is Pro is kept in the store; the file the earlier builds kept in `/data/pro` is imported
   into it on first use and left in place.
2. Funnel's `/` route must point at `http://127.0.0.1:3000` (it already does).
3. For auto-deploy, a GitHub Actions runner with the label `lifeguessr-deploy` on the server,
   running as its own user that can use Docker. See "The self-hosted runner" below.

## The self-hosted runner

The runner executes jobs on the server itself, so only `deploy.yml` may use it:

- `deploy.yml` is triggered by `workflow_run` (loaded from `main`, so a PR cannot edit it) and only
  for a CI run that came from a push to `main` in this repository.
- Never add a `pull_request` or `pull_request_target` trigger to a workflow that uses
  `runs-on: self-hosted`. CI and e2e stay on GitHub-hosted runners.
- Once the repo is public, set Settings, Actions, General, "Fork pull request workflows from
  outside collaborators" to "Require approval for all outside collaborators".
- Docker access is root-equivalent on the server. Run the runner as a user that owns nothing else
  of value, and remove the runner (Settings, Actions, Runners) when the event is over.

Setting it up, as that dedicated user (the team server uses `lgrunner`):

1. The user is in the `docker` group, and `loginctl enable-linger <user>` is on.
2. Install the runner in `~/actions-runner` (download from the actions/runner releases and check its
   SHA-256), then register it with a repo registration token and the label `lifeguessr-deploy`:
   `./config.sh --url <repo url> --token <token> --labels lifeguessr-deploy --unattended`.
3. Install `lifeguessr-runner.service` (this folder) as a user unit and enable it.
4. The docker `buildx` plugin is per user: put `docker-buildx` (checksum-verified, from the
   docker/buildx releases) in `~/.docker/cli-plugins/`. `remote.sh` says so when it is missing.
5. The server's clock must be right. The runner's login token is time-limited, and a clock that is
   hours off makes GitHub refuse it with a misleading "registration has been deleted" error.
   Check `timedatectl` (System clock synchronized) and `date -u`.

## The store

Sessions, Pro entitlements and (T5/T8) the game and events live in the `postgres` service
(`postgres:17-alpine`). It has no published port: only containers of this compose project reach it,
as `postgres:5432`. The app gets `STORE_URL` from `compose.yaml`, built from `STORE_PASSWORD`.

- **`STORE_PASSWORD`**: generate it once with `openssl rand -hex 32` and put it in `.env`. It must
  be letters and digits (it goes into a URL); `remote.sh` refuses to deploy without it, before
  building. Postgres reads it only when the `pgdata` volume is first created. To change it later,
  change the role too, then `.env`, then deploy:
  `docker compose exec postgres psql -U lifeguessr -d lifeguessr -c "ALTER ROLE lifeguessr PASSWORD '<new>'"`.
- **Schema**: the app runs its migrations itself, on first use after it starts
  (`apps/web/src/server/store/migrations/`), in one transaction under an advisory lock. They are
  additive, so a rolled-back image still works on a newer schema.
- **Backups**: every deploy writes `backups/lifeguessr-<time>-<commit>.dump` (`pg_dump -Fc`, mode
  600) before the new image can migrate anything, and keeps the newest 14. To restore one (this
  replaces the data; stop the app first):
  `docker compose stop app && docker compose exec -T postgres pg_restore -U lifeguessr -d lifeguessr --clean --if-exists < backups/<file>.dump && docker compose start app`.
- **Never** run `docker compose down -v` or `docker volume rm lifeguessr_pgdata`: that deletes the
  database. `docker compose down` (without `-v`) keeps it.
- **psql**: `docker compose exec postgres psql -U lifeguessr -d lifeguessr`.

## Notes

- `/data` and `pgdata` are named volumes, so they survive deploys.
- A route that reads a file at run time (for example the sample statement CSV through
  `packages/data/fixtures/node.ts`) needs `outputFileTracingIncludes` in `apps/web/next.config.ts`,
  because the standalone build only copies the files it can trace.
- `deploy.sh` never prunes the server's shared Docker build cache; it removes only this app's
  untagged images.
