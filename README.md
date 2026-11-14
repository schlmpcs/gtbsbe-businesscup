# LifeGuessr

Explore five daily homes, guess their monthly costs, then model your own budget, ten-year forecast, next moves, purchases and loans. Educational simulation, not financial advice.

## Run locally

Requires Go matching `go.mod`, Node 22+, and pnpm (`npm install -g pnpm@10.28.2`).

```sh
pnpm install --frozen-lockfile
STORE_MODE=memory PUBLIC_ORIGIN=http://localhost:3000 go run ./services/api/cmd/server
# In another terminal:
pnpm dev
```

Open http://localhost:3000. Memory mode is explicitly development-only and resets on restart. For durable storage, set `DATABASE_URL` to your Supabase Postgres connection string instead. The server applies its initial table migration on startup. Never expose the database service key to the browser.

## Features

- Daily five-home game, deterministic server-side scoring, paid-in-points clues, reveal and anonymous leaderboard.
- Separate square/story share PNGs generated from stored results; no client-supplied score.
- Anonymous cookie sessions retaining profile, wishlist and category totals.
- Go-only financial engine: costs, loans, payoff ordering, forecasts, moves, affordability and month-end drift.
- Local CSV parsing, column mapping, masked labels, category corrections and one-off exclusions. Only category totals persist. Eligible Anthropic categorization is optional and explicitly gated.
- Sixty ZIPs across fifteen metros, fifty modeled life cards and two creator packs; see data limitations below.
- Responsive placeholder house rooms and screens, plus clearly marked decision/check-in/paywall concepts. No payments collected.

## Verify

```sh
pnpm lint
pnpm test:csv
pnpm test:data
go test -race ./...
pnpm contracts
pnpm build
pnpm exec playwright install chromium
pnpm e2e
```

`TEST_DATABASE_URL=postgres://... go test -race ./...` additionally runs real Postgres concurrency, restart and isolation checks. CI provisions Postgres and runs the browser demo path. `pnpm tokens` regenerates CSS tokens; `pnpm data:refresh` refreshes offline source data and reports missing sources. Source refresh can require Python dependencies documented in `packages/data`.

The OpenAPI artifact is generated from Go engine types in `packages/contracts/openapi.json`; the browser consumes its generated TypeScript types. Update both with `pnpm contracts`. Engine math never lives in browser code.

## Deployment

Configure the VPS `.env` with `DOMAIN`, `DATABASE_URL` and optional Anthropic credentials. Then:

```sh
docker compose up -d --build
```

Caddy serves HTTPS on ports 80/443 and proxies `/api/*` to Go. Keep API and Next ports private. DNS must point to the VPS, ports 80/443 must be open, and the database role must be allowed to create the initial table. Production requires Postgres; it cannot silently fall back to memory. Compose enables secure cookies and trusted-proxy handling only inside its private network. Keep `.env` out of source control. Back up Postgres through your provider and retain the prior image/checkout for rollback.

## Data and delivery limitations

All numeric inputs carry sources or explicit estimate labels. BLS and USDA inputs are sourced. DOL childcare rows cover 56 ZIPs, adjusted for inflation; four ZIPs retain fallback estimates. ZIP-to-county mappings remain estimates pending crosswalk verification. Consult `packages/data/out/incomplete-data-report.json` for coverage. HUD/Census access was blocked during implementation, so rent and rent-range inputs remain labeled estimates until imported through the refresh pipeline. Do not present those estimates as measured local data.

This checkout does not contain Kiko’s final Figma frames or sprite kit. The placeholder scene remains playable; design tokens and presentation boundaries support later replacement. AI text parsing uses a clear manual-form fallback. Live deployment and submission recording require the VPS target and a reachable production URL; neither is implied by passing local tests.
