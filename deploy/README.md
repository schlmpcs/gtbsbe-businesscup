# Deploying LifeGuessr to the team server

Production runs in Docker on the team's own server, behind the Tailscale Funnel host's root `/`
(Funnel terminates HTTPS and proxies to `127.0.0.1:3000`). The server's address and the Funnel
hostname are not in this repo, which is public; ask the team.

| File | What it is |
| --- | --- |
| `Dockerfile` | Next.js standalone build of the pnpm monorepo (`apps/web`), Node 22 |
| `compose.yaml` | Runtime: loopback port 3000, a `/data` volume, healthcheck, 1 GB memory cap |
| `deploy.sh` | Runs on your machine or on the server: ships a `git archive` and runs `remote.sh` |
| `remote.sh` | The server side: build, switch, health check, automatic rollback |

`.github/workflows/deploy.yml` runs `deploy.sh` after CI is green on `main`.

## Deploy by hand

```bash
DEPLOY_HOST=user@host deploy/deploy.sh          # HEAD; or pass a branch, tag or commit
DEPLOY_HOST=user@host deploy/deploy.sh --rollback   # back to the previous image
```

Uncommitted changes are not deployed. A deploy builds the image on the server, keeps the running one
as `lifeguessr-app:previous`, starts the new one and waits for `/api/health`. If the new one is
unhealthy it puts the previous one back by itself and exits non-zero. `DEPLOYED` on the server
records the commit, the author and the time.

## One-time server setup

1. Create the app folder and its `.env` (names only here; values never go in the repo):
   `~/lifeguessr/.env` with `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `STORE_URL` once the store
   exists (T4/T5), `NEXT_PUBLIC_GAME_SOURCE`, `NEXT_PUBLIC_SESSION_SOURCE`, and optionally
   `PUBLIC_URL` (the public https URL; `deploy.sh` asks its `/api/health` after a deploy).
   `NEXT_PUBLIC_*` values are read at build time, so changing them needs a new deploy.
2. Funnel's `/` route must point at `http://127.0.0.1:3000` (it already does).
3. For auto-deploy, a GitHub Actions runner with the label `lifeguessr-deploy` on the server,
   running as a user that can use Docker. See "The self-hosted runner" below.

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

## Notes

- `/data` is a named volume, so it survives deploys. No database is wired yet; add a backup step to
  `remote.sh` when the store is chosen.
- A route that reads a file at run time (for example the sample statement CSV through
  `packages/data/fixtures/node.ts`) needs `outputFileTracingIncludes` in `apps/web/next.config.ts`,
  because the standalone build only copies the files it can trace.
- `deploy.sh` never prunes the server's shared Docker build cache; it removes only this app's
  untagged images.
