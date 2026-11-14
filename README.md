# LifeGuessr

**A yearly money plan in 2 minutes, from a game, with no bank login, and a ranked list of which decision to make next.**

Forecasting in tools like Monarch Money sits behind a bank login and a $299/year plan. LifeGuessr builds the plan from three sliders, manual accounts or a CSV statement read in your browser, prices it with US public data for your area, and ranks your next money moves in dollars. A daily game, the **Duel** ("Which life costs more?"), is the front door. Built for the Zimran Business Cup. Educational simulation, not financial advice.

> **Live:** `https://<live-url>` **(TODO: paste the production link before submitting)**
> **Repo for judges:** start here, then [CLAUDE.md](CLAUDE.md) (rules), [docs/PIVOT.md](docs/PIVOT.md) (why the planner), [docs/TASKS.md](docs/TASKS.md) (status).

## Where the build is today (be precise)

- **Live on `main`:** the Duel, onboarding (S5–S9), Today, the 10-year forecast with Next Moves (`/future`), Can I Afford It?, Loan Lab, Together, the tools, Pro. All listed in the route table below.
- **Planner engine on `main`, tested:** `plan()`, `expandEvent()` / `defaultEvent()`, `monteCarlo()`, `accountsToProfile()` / `netWorthSummary()`, `budgetRows()`, `cashFlowSummary()`, plus the browser-only Accounts and Transactions stores and the view-models for every planner screen.
- **Not merged yet:** the planner **routes** (`/plan`, `/accounts`, `/transactions`, `/cash-flow`, `/budget`, `/recurring`, `/goals`, the Dashboard) and the app shell with phone bottom tabs. Their screens are being built on branch `claude/elegant-johnson-nb7p8z` (work in progress). The `/plan` view-models on `main` still read placeholder fixtures (`plan.demo.json`, `monteCarlo.demo.json`, marked `PLACEHOLDER` in the file); wiring them to `plan()` / `monteCarlo()` is task MP7b.

## Try it in 2 minutes

1. **Home** `/`: first visit explains the app with **Play** and **Try with sample data** (loads a sample life, with a "sample life" banner until you choose "Use mine").
2. **Onboarding** `/me/guess` → `/me/closest` → `/me/sliders` → `/me/balance` → `/me/upload`: guess your own month, see the closest life, set three sliders (or describe your life in words and confirm), add debts, then **Try with sample statement** to watch the CSV be read, masked and categorized.
3. **Plan** `/plan` *(in progress, not on `main` yet)*: the yearly net-worth line to age 90, KPIs, life events, Next Moves. **On `main` today use `/future`:** the 10-year forecast with its range band, life events and the top 3 Next Moves in dollars.
4. **Chance of success** `/plan?view=chance` *(in progress)*: 1,000 seeded Monte Carlo paths, success %, bands. The engine (`monteCarlo()`) is merged and tested; the screen is not.
5. **The Duel** `/play`: five rounds of "Which life costs more?", an optional hint, the reveal with both monthly totals by category and their sources, a share grid and a challenge link (`/duel?c=…`).

## Every route: what it does, where its numbers come from

Engine = `packages/engine` (pure, deterministic, Vitest). Area data = `packages/data/out/areas.json` (60 ZIPs in 15 metros: HUD FY2026 Small Area FMR rents, Census ACS rent ranges, home values, owner costs and property tax, DOL NDCP childcare, USDA food plans, EIA gas, BLS CPI, NAIC car and home insurance by state, FHFA home price index; details in [docs/DATA.md](docs/DATA.md) and `packages/data/README.md`).

### On `main` (live)

| Route | What it does | Numbers from |
| --- | --- | --- |
| `/` | Today: first-visit intro, then net worth in 10 years with its range, month-end projection, quick spending add, best move, entry points | `forecast`, `monthEnd`, `rankMoves`, `dailyMonthToDate`, `safeToSpendToday` |
| `/play` | The Duel (default `NEXT_PUBLIC_GAME_MODE=duel`): 5 pairs of composite lives a day, hint (−10%), reveal, day result, share | `costOfLife` → `dailyDuelPairs` → `scoreDuelPick` on life cards (`packages/data/cards`) priced with area data. Production scores on the server (`GET /api/daily?game=duel`, `POST /api/daily/pick`, `/hint`) |
| `/duel?c=…` | Challenge view: a friend's real stored score to beat | stored duel results |
| `/me/guess` | S5: gut guess of your own month; the reveal once spending is your own | your profile vs the guess |
| `/me/closest` | S6: the life card closest to your household, with its price explained and sourced | `lifeCardFromFacts`, `costOfLife`, area data |
| `/me/sliders` | S7: three sliders, or "describe your life" parsed to typed fields you confirm | `cardToProfile`, `scaleSpendingTo`; text → fields by `POST /api/ai/parse` (no numbers invented, user confirms) |
| `/me/balance` | S8: cash, retirement, debts (card APR default sourced) | `cardAprDefault`, `debtAprDefaults`, `cardMinPaymentFor` |
| `/me/upload` | S9: CSV statement read in the browser, masked, categorized; "connect your bank app" is a disabled "coming soon" card | `POST /api/statement/categorize` (labels only) → `statementTotals`, `statementAverages` |
| `/future` | S10: net worth in 1/3/5/10 years with range band, today's-dollars toggle, life events, top 3 Next Moves, goal | `forecast`, `rankMoves`, `goalStatus`, `extraSavingToReach`; optionally `POST /api/ai/forecast`, shown only if it passes code checks and labeled "AI estimate" (see Honesty) |
| `/afford` | Can I Afford It? fits / wait / no over 12 months, with and without | `canAfford`, `goalReachMonth`, `workTime` |
| `/loan` | Loan Lab: 3 offers side by side, debt-load gauges, extra payments, payoff planner | `loan`, `compareLoans`, `payoffOrder`, `comparePayoff`, `extraToFinishBy`, `suggestedPayoffExtra` |
| `/decide` | Keep your car or lease a new one, 10 years in today's dollars | `forecast`, `simulate`; lease terms start from an illustrative fixture tagged estimate |
| `/checkin` | Latest month vs the 3 before it, committed move's progress | `monthEnd`, `simulate` |
| `/spend` | Daily spending log (typed or spoken), safe to spend today | `dailyMonthToDate`, `safeToSpendToday`, `monthEnd` |
| `/tools` | "What if?" hub | — |
| `/tools/subscriptions` | Subscription audit: tick-list or CSV, cancel plan with its 10-year effect | `detectSubscriptions`, `auditTotals`, `forecast`; catalogue of 62 services with dated, sourced or estimated prices |
| `/tools/overpaying` | Rent, insurance, groceries, childcare vs the typical range for your ZIP | `overpayingCheck`, area data |
| `/tools/bills` | Bills calendar, "due before payday", `.ics` export | pure date math in `features/bills/model/calendar.ts` |
| `/together`, `/together/[id]` | A couple's shared plan via a link: household month, fair split, "Us in 10 years" | `combineProfiles`, `householdMonth`, `sharedBills`, `fairSplit`, `forecast`, `goalStatus` |
| `/pro` | Simulated checkout (nothing charged; Stripe test mode only if a test key is set) + jury promo code | no money moves |
| `/kit`, `/screens` | UI-kit showcase; index of every screen | — |

### In progress (not on `main`)

The view-models below are merged on `main` (`apps/web/src/features/<feature>/model`, tested on fixtures); the routes and UI are not. Paths are from `features/dashboard/model/links.ts` and `docs/ARCHITECTURE.md` (P1–P10).

| Route | What it will do | Numbers from (already in `main`) | UI status |
| --- | --- | --- | --- |
| `/plan` | Yearly net worth to age 90, KPIs, events (Buy a home, Have a kid, Retire, Expense, …), Assumptions, Next Moves, the "AI estimate" line | `plan()`, `expandEvent()`, `defaultEvent()`, `buyHomeBreakdown()` (mortgage, property tax and home insurance from area data); view-models still on placeholder fixtures until MP7b | chart and event icons WIP on the branch |
| `/plan?view=compare` | Two scenarios overlaid | two `plan()` runs (MP6 open) | not started |
| `/plan?view=chance` | Chance of success: seeded paths, p10–p90 band, success %, histograms | `monteCarlo()` (mulberry32 seed, Box–Muller draws; same seed → same result, tested) | not started |
| Dashboard (`/` after onboarding) | Net worth, spending pace, budget summary, top move, Duel card, setup checklist | `netWorthSummary`, `budgetRows`, `rankMoves`, `dailyTotalsByDay` | not started |
| `/accounts` | Manual accounts, net worth by group, add account | `accountsToProfile`, `profileToAccounts`, `netWorthSummary`; accounts kept in this browser | WIP on the branch |
| `/transactions` | Ledger, CSV import, manual add, category override, export | ledger in IndexedDB in this browser; `cashFlowSummary` | WIP on the branch |
| `/cash-flow` | Income, expenses, savings rate, Sankey | `cashFlowSummary` | not started |
| `/budget` | Planned vs actual, "where you should be today" | `budgetRows`, `budgetRowsForYear` | WIP on the branch |
| `/recurring` | Recurring charges from the ledger | `detectSubscriptions` | not started |
| `/goals` | Save up (on track / at risk) and Pay down (Loan Lab) | `goalStatus`, `extraSavingToReach`, payoff engine | not started |
| App shell | Sidebar on desktop, bottom tabs on a phone | — | not started (no `features/shell` yet) |

## Honesty notes (checked against the code)

- **No sign-up, no login.** An anonymous id in `localStorage` keys the optional server session.
- **Statements stay in the browser.** The CSV is parsed on the device; each line sent to `POST /api/statement/categorize` holds only the label (account numbers and personal names on Zelle/Venmo, transfer, bill-pay, check and ACH lines masked first), the amount, the month and the day of month (`StatementItemSchema`). The route stores nothing; labels are masked again before the LLM sees them, and keyword rules sort them without an API key. The planner ledger and account names live only in this browser (IndexedDB / `localStorage`).
- **Code does the math.** Every number on screen comes from `packages/engine`. LLMs only parse text into typed fields the user confirms (`/api/ai/parse`), categorize labels, and write explanations whose numbers are checked against the input (`/api/ai/explain`).
- **The AI forecast, as it is today:** on `/` and `/future`, `POST /api/ai/forecast` may supply the 10-year line and the moves' effects. It is used only when it passes code checks (today's balance exact, an envelope around the rules forecast, move-effect sanity), is labeled "AI estimate", and falls back to the rules engine (`forecast`) on any failure, missing key or rate limit. **Planned for `/plan` (MP7b, not built):** the AI line becomes a second opinion only, shown when every point sits inside the Monte Carlo p5–p95 band and today's value matches, hidden otherwise, and never feeding a KPI, Next Move or Chance of success.
- **The Duel is server-scored in production.** The deploy image sets `NEXT_PUBLIC_DUEL_SOURCE=api`: the server holds the answers, records hints, and scores each pick once (`/api/daily/pick`); the client cannot post a score. CI checks that no answer reaches the browser bundle (`pnpm check:bundle`). Locally the default is `fixtures` (computed in the browser on sample cards).
- **Every number has a source or an estimate tag.** Area values carry `Source { name, year, url }`; defaults we filled in carry `isEstimate: true` and show an "estimate" tag.
- **Pro charges nothing.** Simulated checkout and a promo code; a live Stripe key is refused.
- **Educational simulation, not financial advice.** No lender, investment or security is recommended.

## Run it locally

Requires Node 22.12+ and pnpm 10 (`corepack enable` picks up the pinned version).

```
pnpm install
pnpm dev            # apps/web on localhost:3000
pnpm test           # Vitest: engine, types, data fixtures, web view-models and ui-kit (jsdom)
pnpm lint           # ESLint incl. the UI import rule; checks tokens.css is up to date
pnpm typecheck      # tsc in every package
pnpm build          # Next.js production build
pnpm e2e            # Playwright: builds, starts, runs apps/web/e2e (phone + desktop)
pnpm check:bundle   # no game answers in the client chunks of an API build
pnpm tokens         # tokens.json → apps/web/src/ui-kit/tokens.css
pnpm data:refresh   # re-fetch public data into packages/data/out (Python 3, no pip packages)
pnpm fixtures:plan  # regenerate the plan fixtures
pnpm eval:forecast  # AI forecast eval against a live model (costs API calls, never in CI)
```

Everything works with no `.env` (AI routes fall back to rules, the store is in memory in dev). Copy `.env.example` to `.env` to turn things on:

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_FORECAST_MODEL` | Claude for `/api/ai/*` and statement categorizing |
| `STORE_URL` (prod: `STORE_PASSWORD`), `TEST_STORE_URL` | Postgres store for sessions, duel results, Pro, events; tests use their own schema |
| `NEXT_PUBLIC_GAME_MODE` | `duel` (default) or `slider` (the old slider game, kept as a rollback) |
| `NEXT_PUBLIC_DUEL_SOURCE`, `NEXT_PUBLIC_GAME_SOURCE` | `fixtures` (local default) or `api` (server-scored; the deploy image's default) |
| `NEXT_PUBLIC_SESSION_SOURCE`, `NEXT_PUBLIC_EVENTS_SOURCE`, `NEXT_PUBLIC_TOGETHER_SOURCE` | browser-only by default; `api` uses the store |
| `STRIPE_SECRET_KEY`, `APP_URL`, `PRO_DEMO_CODE`, `PRO_DEMO_UNLOCK`, `PRO_DATA_DIR` | Pro demo (test keys only) |
| `AVATARS_ENABLED`, `NEXT_PUBLIC_AVATARS_ENABLED` | avatar publishing preview, off by default |
| `BLS_KEY`, `HUD_XLSX`, `HUD_FY`, `PYTHON` | optional, for `pnpm data:refresh` |

## Tests and CI

- **Vitest:** about 3,770 tests in 227 files (count at `c1d39ed`; 37 skip without `TEST_STORE_URL`). The engine has a test file per module, including `plan.test.ts` (golden snapshot), `planEvents.test.ts`, `monteCarlo.test.ts` (same seed → same result; all spreads 0 reproduces `plan()`; a timing budget), `budget.test.ts`, `cashFlow.test.ts`, `accounts.test.ts`.
- **Playwright:** 20 spec files in `apps/web/e2e`, including `demo-path.spec.ts` (Today → the Duel → own guess → closest life → sliders → forecast → sample statement → Loan Lab) and `duel-api.spec.ts` (the server-scored duel).
- **CI** (`.github/workflows/ci.yml`, on every PR and push to `main`): lint, typecheck, Vitest with a Postgres service, the data pipeline's Python tests, a production build in API mode plus `check:bundle`; e2e on the fixture build, on the production build against Postgres, and on the slider rollback. `deploy.yml` deploys `main` to the team server after CI passes (`deploy/README.md`).

## Repo map

```
packages/types     @lifeguessr/types   shared contracts + zod schemas (Profile, Account, PlanEvent, Scenario, PlanResult, MonteCarlo*, …)
packages/engine    @lifeguessr/engine  pure functions + Vitest: plan, planEvents, monteCarlo, simulate, accounts, budget, cashFlow,
                                       forecast, moves, afford, goal, month, statement, subscriptions, overpaying, together,
                                       cost, score, duel, daily, scene, loan/
packages/data      @lifeguessr/data    public data pipeline (out/areas.json), life cards (cards/), canonical fixtures (fixtures/)
apps/web           web                 Next.js App Router app
  app/             routes and app/api/* server routes
  src/features/<feature>/{model,ui}    view-model hooks and presentational components (lint-enforced split)
  src/server/      store (Postgres + in-memory twin), game, ai, statement, pro, session, events
  src/ui-kit/      primitives + tokens.css (generated); on show at /kit
  src/copy/        every user-facing string
tokens.json        design tokens (Figma variables export)
deploy/            Dockerfile, compose (app + Postgres), deploy and rollback notes
docs/              PRODUCT, PIVOT, ARCHITECTURE, ENGINEERING, DATA, TASKS
```

Rules for contributors (human or AI): [CLAUDE.md](CLAUDE.md). Specs: [docs/](docs).

## Server routes

| Route | Purpose |
| --- | --- |
| `GET /api/daily`, `POST /api/daily/pick`, `/hint`, `/clue`, `/guess`, `GET /api/daily/challenge` | Daily game by US Eastern date; answers stay on the server; one scored answer per round per player per day |
| `GET /api/leaderboard`, `GET /api/share` | Ranked stored results; 9:16 and 1:1 PNG share cards |
| `POST /api/ai/parse`, `/api/ai/explain`, `/api/ai/forecast` | Text → typed fields; checked explanations; the labeled AI forecast with rules fallback (all rate-limited, work without a key) |
| `POST /api/statement/categorize`, `GET /api/statement/sample` | Masked labels → `CategoryTotals`, nothing stored; the sample statement |
| `POST`/`GET /api/session` | Save and load the profile by anonymous id |
| `/api/together/*` | Couple plans under a random id, numbers only, 30 days |
| `/api/pro/*` | Simulated checkout, promo code, entitlement status |
| `POST /api/events`, `GET /api/events/funnel` | Funnel events with fixed names and no personal data |
| `/api/avatar/*` | Avatar publishing preview (off by default) |
| `GET /api/health` | Build and store status |

## Data coverage

60 ZIPs in 15 metros, one per price tier. Coverage gaps are listed in `packages/data/out/incomplete-data-report.json`; values we could not source are tagged estimates (for example state-average car insurance). Life cards: 50 daily cards and 2 creator packs, priced by the engine from the area data. Synthetic bank statements with answer keys test the CSV reader (`packages/data/fixtures/synthetic-statements`).
