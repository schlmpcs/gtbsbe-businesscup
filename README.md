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
| Engine: `loan`, `compareLoans`, `payoffOrder`, `monthEnd`, `sceneOf` | Working stubs until T3, T9, T12 |
| Engine: `forecast` (range band, today's dollars, purchases), `applyPatch`, `simulate` | Done (Y2) |
| Engine: `costOfLife`, `cardToProfile`, `scoreGuess` | Done (Y1) |
| Engine: `rankMoves` (level 1, top 3 by 10-year effect), `movesLevel` / `isLevelUnlocked` | Done (Y3) |
| Engine: `canAfford` | Signature only (Y4) |
| AI routes: `POST /api/ai/parse` (text → `ProfilePatch` / `Purchase` / `LoanInput`, zod-validated, user confirms) and `POST /api/ai/explain` (2 sentences, numbers checked against the input, template fallback); rate-limited; work without a key | Done (Y12) |
| UI kit: Button, Card, Slider (linear + log), Stat, Gauge, Tabs, Sheet, ForecastChart, BarBreakdown, Field/NumberInput, EstimateTag, SourceNote, Money, Stack/Row; showcase at `/kit` | Done |
| View-model hooks S1–S12 (`features/*/model`) + client state (`src/state`: Zustand store persisted to localStorage, anon id, session sync seam); game playable on fixtures (`NEXT_PUBLIC_GAME_SOURCE`) | Done (Y7) |
| Screens S1–S15 | Placeholder pages |
| Deploy (live URL) | Pending: Vercel access |
