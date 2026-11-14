# LifeGuessr

A forward-looking budget planner for US adults aged 25–45, plus a GeoGuessr-style daily game that brings people in. Built in 24 hours for the Zimran Business Cup.

- **Planner:** a forecast of your month and of "You in 10 years", your next best money moves ranked in dollars, "Can I Afford It?" and "Loan Lab". No sign-up, no bank login.
- **Game:** explore a stranger's home, open clues, guess what their life costs per month, then guess your own.

Every number comes from a pure, tested engine (`packages/engine`) fed by public data with sources (HUD, BLS, USDA, DOL). AI only parses text and explains results; it never produces a number you see. Educational simulation, not financial advice.

## Commands

Requires Node 22.12+ and pnpm 10 (`corepack enable` picks up the pinned version).

```
pnpm install
pnpm dev            # apps/web on localhost:3000
pnpm test           # Vitest (engine, types, data fixtures, web utils, ui-kit components in jsdom)
pnpm lint           # ESLint, incl. the UI import rule; checks tokens.css is up to date
pnpm typecheck      # tsc in every package
pnpm build          # Next.js production build
pnpm e2e            # Playwright: builds, starts and smoke-tests every screen
pnpm tokens         # tokens.json → apps/web/src/ui-kit/tokens.css
pnpm data:refresh   # re-fetch public data (T2, not implemented yet)
```

Copy `.env.example` to `.env` for the AI routes and storage.

## Repo map

```
packages/types     @lifeguessr/types   shared contracts (index.ts) + zod schemas (schemas.ts)
packages/engine    @lifeguessr/engine  pure functions + Vitest: cost, score, forecast, moves, afford, month, scene, loan/
packages/data      @lifeguessr/data    public data pipeline (T2) and the canonical fixtures in fixtures/
apps/web           web                 Next.js App Router app
  app/             routes (S3 and S4 are states of /play); app/api/* server routes
  src/features/<feature>/{model,ui}    view-model hooks and presentational components
  src/ui-kit/      primitives + tokens.css (generated); every primitive is on show at /kit
  src/copy/        all user-facing strings, one file per feature (import from @/copy)
  src/fixtures/    re-exports packages/data/fixtures
tokens.json        design tokens (Figma variables export)
docs/              PRODUCT, ARCHITECTURE, ENGINEERING, DATA, TASKS
```

Rules for contributors (human or AI) are in [CLAUDE.md](CLAUDE.md); specs are in [docs/](docs).

## Status

| Area | State |
| --- | --- |
| Monorepo, lint (incl. UI import rule), Vitest, Playwright, CI | Done (T1) |
| Contracts and zod schemas | Done (H0) |
| Fixtures: 4 Dallas–Fort Worth ZIPs (HUD FY2027 SAFMR, DOL childcare, USDA, EIA, BLS), 6 life cards, demo profile, sample statement, 3 loan offers | Done (H0) |
| Engine: `loan`, `compareLoans`, `payoffOrder`, `monthEnd` | Working stubs until T3, T9 |
| House scene: `sceneOf` (deterministic props from the same card fields as the cost lines; consistency test against `costOfLife` for every card) + `<HouseScene>` (dollhouse cutaway, closed rooms, tap → zoom → clue, close-up with props and facts; phone-sized targets, reduced motion) on `/play`; placeholder sprites in `apps/web/public/scene/` until the D1 kit | Done (T12), placeholder art |
| Engine: `forecast` (range band, today's dollars, purchases), `applyPatch`, `simulate` | Done (Y2) |
| Engine: `costOfLife`, `cardToProfile`, `scoreGuess` | Done (Y1) |
| Engine: `rankMoves` (level 1, top 3 by 10-year effect), `movesLevel` / `isLevelUnlocked` | Done (Y3) |
| Engine: `canAfford` (fits / wait / no over the next 12 months: cash cushion, debt load, card paid off within 12 months; `baselineFails`; with / without forecasts; `cheapestWay`) | Done (Y4) |
| AI routes: `POST /api/ai/parse` (text → `ProfilePatch` / `Purchase` / `LoanInput`, zod-validated, user confirms) and `POST /api/ai/explain` (2 sentences, numbers checked against the input, template fallback); rate-limited; work without a key | Done (Y12) |
| UI kit: Button, Card, Slider (linear + log), Stat, Gauge, Tabs, Sheet, ForecastChart, BarBreakdown, Field/NumberInput, EstimateTag, SourceNote, Money, Stack/Row; showcase at `/kit` | Done |
| View-model hooks S1–S12 (`features/*/model`) + client state (`src/state`: Zustand store persisted to localStorage, anon id, session sync seam); game playable on fixtures (`NEXT_PUBLIC_GAME_SOURCE`) | Done (Y7) |
| S1 Today (`/`): You in 10 years with its range, month-end card (drift flags from 3 statement months), play CTA, committed / best move, Can I Afford It? / Loan Lab / profile entry points, all-screens list | Placeholder UI on real data (Y10) |
| S10 You in 10 years + Next Moves (`/future`): forecast chart with the range band ("range from the numbers we estimated"), today's dollars toggle, compare with a move, top 3 moves with commit / done / "Why?" (`/api/ai/explain`), level 2 preview, "How we calculate" | Placeholder UI on real data (Y10) |
| Game `/play`: S2 explore (home card + the illustrated house: tap a room to zoom in and open its clue, with the clue cost shown, log-scale guess slider + typed entry), S3 reveal (guess on the range, points × multiplier, cost bars by category with sources), summary (emoji share grid, Web Share with clipboard fallback, bridge to S5), S4 streamer mode (`?stream=1`, big type, countdown that locks in at zero). The static tap-to-reveal `ClueBoard` stays as the fallback `ClueSlot` | Placeholder UI (Y8) |
| Ladder S5–S9 (`/me/guess`, `/me/closest`, `/me/sliders`, `/me/balance`, `/me/upload`): guess vs. engine estimate, closest life with sources, sliders + "describe your life" (confirm before apply), balance sheet with debts, statement review + "What we keep"; rung progress and the 10-year range narrowing as estimates become real | Placeholder UI done (Y9) |
| Statements (S9): CSV read in the browser (header or headerless, debit/credit or signed amounts with the sign detected, pending lines skipped), personal names and account numbers masked before sending; `POST /api/statement/categorize` sorts the masked labels (AI, keyword rules without a key) and sums `CategoryTotals` per month in the engine, one-offs and transfers left out; nothing stored | Done (T6/T7); waiting on two anonymized real exports to confirm |
| S11 Can I Afford It? (`/afford`: form + free text with confirm, verdict and reason, with / without chart, wishlist) and S12 Loan Lab (`/loan`: 3 offers side by side, debt-load gauges, extra-payment slider, edit / add / type an offer) | Placeholder UI on real data (Y11) |
| Screens S13–S15 | Placeholder pages |
| Store + sessions (T4): Postgres store (`apps/web/src/server/store`: pooled `pg`, versioned migrations under an advisory lock, in-memory twin for tests and dev, 503 in production without `STORE_URL`), `POST`/`GET /api/session` (save and load the Profile + wishlist by anonymous id, wishlist adds gated on Pro), Pro entitlements moved onto the store, `postgres` service in `deploy/compose.yaml` with backups on every deploy | Done (T4) |
| Deploy (live URL) | Done: live on the team server; a push to `main` that passes CI is deployed automatically (`deploy/README.md`) |
