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
pnpm e2e            # Playwright: builds, starts, smoke-tests every screen and walks the demo path (e2e/demo-path.spec.ts)
pnpm tokens         # tokens.json → apps/web/src/ui-kit/tokens.css
pnpm data:refresh   # re-fetch public data into packages/data/out (T2; needs Python 3, no pip packages)
```

Copy `.env.example` to `.env` for the AI routes and storage.

## Repo map

```
packages/types     @lifeguessr/types   shared contracts (index.ts) + zod schemas (schemas.ts)
packages/engine    @lifeguessr/engine  pure functions + Vitest: cost, score, forecast, moves, afford, month, scene, loan/
packages/data      @lifeguessr/data    public data pipeline (T2: out/areas.json), life cards (T10: cards/), canonical fixtures in fixtures/
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
| Fixtures: 4 Dallas–Fort Worth ZIPs (HUD FY2027 SAFMR, DOL childcare, USDA, EIA, BLS), 6 life cards, demo profile, sample statement (+ its category totals), 3 loan offers, an illustrative car lease | Done (H0, T11) |
| Public data (`packages/data/out/areas.json`, `pnpm data:refresh`): 60 ZIPs in 15 metros, one per tier. HUD FY2026 SAFMR rents (none estimated), Census ACS 2020–2024 rent ranges (55 ZIPs), DOL NDCP county childcare CPI-inflated to today (60), USDA food plan, EIA gas, BLS metro CPI, NAIC state car insurance (labeled estimate). Coverage in `out/incomplete-data-report.json`; the web app reads it through `@lifeguessr/data/areas` | Done (T2) |
| Area comparisons: `overpayingCheck` for rent, insurance, groceries and childcare, with sourced or estimated ranges, real-dollar effects and explicit metro/tier coverage | Done (M10); UI follows in M11 |
| Life cards (`packages/data/cards/cards.json`, server-only `@lifeguessr/data/cards`): 50 daily cards (10 days, each easy → curveball across 5 metros) + 2 creator packs (`nyc-25`, `city-swap`), costed by the engine from the real area data | Done (T10) |
| Engine: `loan`, `compareLoans`, `payoffOrder`, `payoffPlan`, `comparePayoff`, `extraToFinishBy`, `monthEnd`: shared payoff simulation, per-debt detail, cent-rounded timelines and a capped target-date solver | Done (T3, T9, M12); payoff UI follows in M13 |
| House scene: `sceneOf` (deterministic props from the same card fields as the cost lines; consistency test against `costOfLife` for every card) + `<HouseScene>` (dollhouse cutaway, closed rooms, tap → zoom → clue, close-up with props and facts; phone-sized targets, reduced motion) on `/play`; placeholder sprites in `apps/web/public/scene/` until the D1 kit | Done (T12), placeholder art |
| Engine: `forecast` (range band, today's dollars, purchases), `applyPatch`, `simulate` | Done (Y2) |
| Engine: `costOfLife`, `cardToProfile`, `scoreGuess` | Done (Y1) |
| Engine: `rankMoves` (level 1, top 3 by 10-year effect), `movesLevel` / `isLevelUnlocked` | Done (Y3) |
| Engine: `canAfford` (fits / wait / no over the next 12 months: cash cushion, debt load, card paid off within 12 months; `baselineFails`; with / without forecasts; `cheapestWay`) | Done (Y4) |
| AI routes: `POST /api/ai/parse` (text → `ProfilePatch` / `Purchase` / `LoanInput`, zod-validated, user confirms) and `POST /api/ai/explain` (2 sentences, numbers checked against the input, template fallback); rate-limited; work without a key | Done (Y12) |
| AI forecast: `POST /api/ai/forecast` (Claude produces the 10-year forecast and the moves' effects; validated in code, cached, labeled, rules-based fallback) | Done (Y15–Y20) |
| UI kit: Button, Card, Choice, Slider (linear + log), Stat, Gauge, Tabs, Sheet, ForecastChart, BarBreakdown, Field/NumberInput, EstimateTag, Tag, SourceNote, Money, Stack/Row; showcase at `/kit` | Done |
| View-model hooks S1–S12 (`features/*/model`) + client state (`src/state`: Zustand store persisted to localStorage, anon id, session sync seam); game playable on fixtures (`NEXT_PUBLIC_GAME_SOURCE`) | Done (Y7) |
| S1 Today (`/`): first visit (no profile, no game yet) explains the app with **Play** and **Try with sample data** (`/future?sample=1` loads `profile.demo.json` as the session profile, flagged `isSample`, with a "sample life" banner on every screen until "Use mine"), no numbers; after that: You in 10 years with its range, month-end card (drift flags from 3 statement months), play CTA, committed / best move, Can I Afford It? / Loan Lab / Decision / Check-in / profile entry points, all-screens list | Placeholder UI on real data (Y10) |
| S10 You in 10 years + Next Moves (`/future`): forecast chart with the range band ("range from the numbers we estimated"), today's dollars toggle, compare with a move, top 3 moves with commit / done / "Why?" (`/api/ai/explain`), level 2 preview, "How we calculate" | Placeholder UI on real data (Y10) |
| S10 horizon picker: pick 1, 3, 5 or 10 years (default 10, remembered); the headline, range, chart and the Next Moves' gains and order read that year, and S1's forecast card and the check-in follow it; no extra model call (the AI forecast is checked at each of those years) | Done |
| S10 goal: target net worth in today’s dollars at 1–30 years, rules-only band verdict, gap, capped extra-saving solve and interacting move effects; local and session persistence | Done (T13), placeholder goal card |
| Avatar publishing preview: exact server-built payload, fresh consent, anonymous ownership, expiry and deletion; default-off flags, self-reported stamp only | Part 1 of #105; live duel pool and pick statistics blocked on G-DUEL |
| Game `/play` = the duel "Which life costs more?" (also `/duel`): today's five pairs of composite lives priced by the engine (`costOfLife` → `dailyDuelPairs` → `scoreDuelPick`), a hint per round (−10%), reveal with both monthly totals by category, what decided it and sources, day result with share grid and challenge link, bridge to S5. Plays in the browser for now, in every build (`NEXT_PUBLIC_DUEL_SOURCE=fixtures`, the default) until the duel server routes land (#115, #120); S1 Today counts its rounds. The slider game below stays as the rollback behind `NEXT_PUBLIC_GAME_MODE=slider` | Done (browser source) |
| Slider game (rollback, `NEXT_PUBLIC_GAME_MODE=slider`) at `/play`: S2 explore (home card + the illustrated house: tap a room to zoom in and open its clue, with the clue cost shown, log-scale guess slider + typed entry), S3 reveal (guess on the range, points × multiplier, cost bars by category with sources), summary (emoji share grid, Web Share with clipboard fallback, bridge to S5), S4 streamer mode (`?stream=1`, big type, countdown that locks in at zero). The static tap-to-reveal `ClueBoard` stays as the fallback `ClueSlot` | Placeholder UI (Y8) |
| Ladder S5–S9 (`/me/guess`, `/me/closest`, `/me/sliders`, `/me/balance`, `/me/upload`): guess vs. engine estimate, closest life with sources, sliders + "describe your life" (confirm before apply), balance sheet with debts, statement review + "What we keep" + "Try with sample statement" (the fixture CSV through the same in-browser read/mask/categorize path); rung progress and the 10-year range narrowing as estimates become real | Placeholder UI done (Y9) |
| Statements (S9): CSV read in the browser (header or headerless, debit/credit or signed amounts with the sign detected, pending lines skipped), account numbers, and personal names on payment-app, transfer, bill-pay, check-payee, deposit-from and ACH credit/debit lines, masked before sending; `POST /api/statement/categorize` sorts the masked labels (AI, keyword rules without a key) and sums `CategoryTotals` per month in the engine, one-offs and transfers left out; nothing stored | Done (T6/T7); waiting on two anonymized real exports to confirm |
| Subscription catalogue: 62 services, whole-word recognition, forty editable defaults, dated sourced/estimated prices; optional masked per-label classes from statement categorization | Done (M4); audit UI follows in M5 |
| S11 Can I Afford It? (`/afford`: form + free text with confirm, verdict and reason, with / without chart, wishlist) and S12 Loan Lab (`/loan`: 3 offers side by side, debt-load gauges, extra-payment slider, edit / add / type an offer) | Placeholder UI on real data (Y11) |
| S13 Decision: the car (`/decide`, Figma S13): keep your car or lease a new one, both paths through `forecast` on your profile (10 years, today's dollars), months left on the car loan from `simulate`, editable lease terms starting from an illustrative fixture (marked estimate); no unbuilt decisions listed; a free tool (no Pro gate). S14 Monthly check-in (`/checkin`, Figma S14): your latest month vs the 3 before it (`monthEnd`: projection, average, drift tiles; sample statement months until you upload), the committed move's progress (card paid this month and payoff with vs without it, or the category vs its target) with "I did it" / "not yet", or pick a ranked move | Preview UI on real data (T11); nothing is saved yet |
| S15 Pro (`/pro`): simulated checkout (nothing charged; Stripe test mode when a key is set) + promo code for the jury; gates the wishlist, and lists only that (no "coming soon" list) | Done (P1) |
| S21 Subscription audit (`/tools/subscriptions`, no sign-up, no profile needed): guess, tick-list from the catalogue (every price with its year and an estimate tag), the guess against the total of your ticks with the C+R survey quoted as a survey, a bank CSV read on this device to find recurring charges (price rises, intro prices that ended, overlaps, yearly charges, the ones you forgot; a low-confidence charge is asked about and left out of the totals until confirmed), a cancel plan whose 10-year effect is measured by the same forecast as Next Moves, "Use this in my plan" (confirm sheet; measured only when it comes from a statement), a renewals calendar file; findings and choices stay in this browser. Hidden in streamer mode | View-model and placeholder UI done on an injected catalogue and local store (M5); connecting them waits on M2 (#78) and M4 reaching this branch (`features/subscriptions/model/wiring.ts`) |
| Bills calendar (`/tools/bills`, in the What if? hub): rent & utilities, each debt's minimum payment and the subscriptions a statement found on a month grid (7 columns, phone first), "Next 7 days", the month total, "Due before payday" (paydays you set; the 1st and 15th until then, tagged estimate), an inline due-day editor (rent and debt days are assumed and tagged until you set them; a day 31 lands on a short month's last day), "Add to my calendar" (.ics built in the browser); the Home screen names the next bill. Date math is pure and tested (`features/bills/model/calendar.ts`); due days and paydays stay in this browser | Done |
| Funnel events (`POST /api/events`, batched from the view-models, fixed names, no personal data; `NEXT_PUBLIC_EVENTS_SOURCE=api`) and the funnel report (`GET /api/events/funnel?days=7`: people per step, through-every-step funnel, conversion; clues per home, blind-guess, finish and share rates). Playwright demo-path spec: 3 homes with a room each → own guess → closest life → sliders → forecast → sample statement → Loan Lab, plus the events it sent | Done (T8) |
| Tool plumbing: validated browser-local settings, privacy-aware tool events, distinct-user opened/completed funnels and cold-path Playwright fixtures | Done (M2); each tool adds its own route and findings |
| Store + sessions (T4): Postgres store (`apps/web/src/server/store`: pooled `pg`, versioned migrations under an advisory lock, in-memory twin for tests and dev, 503 in production without `STORE_URL`), `POST`/`GET /api/session` (save and load the Profile + wishlist by anonymous id, wishlist adds gated on Pro), Pro entitlements moved onto the store, `postgres` service in `deploy/compose.yaml` with backups on every deploy | Done (T4) |
| Game routes (T5): `GET /api/daily` (today's 5 homes by US Eastern date, DST-aware, PublicCards only, plus the player's recorded progress), `POST /api/daily/clue` (records the clue, then reveals it), `POST /api/daily/guess` (scored on the server by `costOfLife` + `scoreGuess` from the recorded clues; one guess per card per player per day, UNIQUE in Postgres migration 3; a repeat answers the stored result), `GET /api/leaderboard` (ranked from stored results, made-up handles), `GET /api/share` (9:16 and 1:1 PNG share cards from a stored result, `next/og`); rate-limited. Played through them with `NEXT_PUBLIC_GAME_SOURCE=api` (default `fixtures` plays in the browser); an API build has no fixture game client and no catalog card in its browser chunks (CI builds in API mode and checks with `pnpm check:bundle`) | Done (T5) |
| Deploy (live URL) | Done: live on the team server; a push to `main` that passes CI is deployed automatically (`deploy/README.md`) |
