# LifeGuessr

### Not a budgeting app. It tells you what you're worth, then forecasts where your decisions take you.

**Live demo: https://forteveriti.tail8331b7.ts.net** · no sign-up, no bank login, works on a phone

Built in 24 hours for the **Zimran Business Cup** (track: Money, with Entertainment as the growth engine). For US adults aged 25–45. Educational simulation, not financial advice.

## The idea

Most money apps start from last month's transactions and ask where your money went. We start somewhere else, with two questions people can't answer today:

1. **What am I worth?** Ask a friend their net worth and you get a shrug. LifeGuessr makes you *guess* it first (one slider), then shows the real number: everything you own minus everything you owe, with the gap between your guess and the truth. Cash, investments, retirement, home, car, cards, loans. No bank login needed.
2. **Where is it heading, and what should I do next?** From that starting point we run your life forward to age 90: a home, kids, a new job, retirement, on a timeline. Then we run it **1,000 times with random markets and inflation** to tell you the share of futures where your money lasts, and we **rank your next decisions in dollars**.

> Money apps forecast your accounts. We forecast your decisions, and rank which one to make next.

Budget, Cash Flow, Transactions and Recurring screens exist, but they are inputs to the plan, not the product.

**The front door is a game.** A daily **Duel**, "Which life costs more?": five rounds, scored on the server, with a share grid and a challenge link, built for streamers and TikTok. When the round ends it asks the question that matters: *now guess your own month.* That hand-off is the funnel.

## Try it in 2 minutes

Full presenter script: [docs/DEMO.md](docs/DEMO.md).

1. [`/play`](https://forteveriti.tail8331b7.ts.net/play): today's Duel. The reveal shows both monthly totals by category, with sources and year. The answers never reach your browser before you pick.
2. [`/start`](https://forteveriti.tail8331b7.ts.net/start): guess what you're worth, then count it from the sample bank link, a CSV statement or sliders. Anything you skip is filled from public data for your area and tagged **estimate**.
3. [`/dashboard`](https://forteveriti.tail8331b7.ts.net/dashboard): the **Life line**. Drag "Buy a home" along the years and watch your plan to 90 and its Chance of success redraw.
4. [`/plan`](https://forteveriti.tail8331b7.ts.net/plan): add a life event. *Buy a home* pulls mortgage payment, property tax and insurance for your ZIP. Then `?view=chance` (1,000 seeded paths) and `?view=compare` (two scenarios overlaid).

## The algorithm (all in `packages/engine`, pure functions, tested)

| Piece | What it does |
| --- | --- |
| **`netWorthSummary`** | Net worth from your accounts: assets (cash, investments, retirement, real estate, vehicles) minus liabilities (cards, loans, mortgage). Anything you leave out counts nowhere. |
| **`plan()`** | A monthly simulation to age 90, reported per year. Life events expand into pay changes, spending, one-off costs and new debts (amortized mortgages, childcare). Tracks a separate *shortfall* when money runs out, a withdrawal order across accounts, and shows today's or future dollars. |
| **`monteCarlo()`** | Seeded (mulberry32 + Box–Muller). Draws inflation and a growth rate per asset group for every year of every path. Returns p5–p95 bands, success rate, shortfall age and histograms. **Same seed, same answer.** A fast replay path is tested to equal a full `plan()` run with the same draws. |
| **`decisionSweep()`** | Moves one decision (e.g. buy a home) across candidate years under one fixed seed, so the change in Chance of success between two years is the decision's, not noise. This drives the Life line. |
| **`rankMoves()`** | Every candidate move (pay the highest-APR card first, cut the biggest discretionary category, cancel detected subscriptions) is applied to your profile and measured: `effect = forecast(with move) − forecast(without)` at 10 years, in today's dollars. Ranked by that number. |
| **`canAfford()`** | "Can I afford it?" as a verdict: fits, wait, or no, over the next 12 months (cash cushion, debt load, card paid off in time). |
| **Loan Lab** | Payoff simulation, extra payments, payoff order, loan comparison. |

**Data, not guesses.** Defaults come from public sources with year and URL: HUD (rents), Census ACS, BLS (metro CPI), DOL (childcare), USDA (food), EIA (gas), NAIC (car insurance), FHFA. 60 ZIPs in 15 metros today (`packages/data`, refresh with `pnpm data:refresh`).

## Is it real? (it is not faked)

- **Code does the math.** Loan payments, costs, scores, affordability, month-end and every KPI come from deterministic, tested engine code. An LLM never produces those numbers.
- **AI does language, and a labeled estimate.** It parses text into typed JSON, categorizes merchant labels, explains results, and can propose growth rates or a 10-year line. Each output is validated in code (shape, envelope, today's balance exact), shown as **"AI estimate"** that you can edit, and replaced by the rules engine when the model is unavailable or fails validation. With no API key the app still works end to end.
- **Every number has a source or an "estimate" tag.** The sample life is labeled as a sample until you enter your own.
- **Server-scored game.** `GET /api/daily` serves cards without answers; `POST /api/daily/pick` scores once per card per player, stored in Postgres.
- **Tested.** 270+ Vitest files (engine, types, data, web, ui-kit) and a Playwright suite that builds the production app, smoke-tests every screen and walks the demo path. CI blocks on lint, types, tests, e2e and a bundle check; a green `main` deploys itself.
- **Privacy.** Statements are parsed in your browser. Only masked merchant labels, amounts, months and days go to the server (personal names and account numbers are masked first), and only category totals are kept. Accounts and plans stay in your browser.

Where to look in the repo: [`monteCarlo.ts`](packages/engine/monteCarlo.ts), [`plan.ts`](packages/engine/plan.ts), [`decision.ts`](packages/engine/decision.ts), [`moves.ts`](packages/engine/moves.ts), the demo-path spec [`demo-path.spec.ts`](apps/web/e2e/demo-path.spec.ts), and `GET /api/health` on the live URL (reports the running build).

## Business

- **Who:** US adults 25–45 with a job, bills and one big decision ahead (a home, a kid, a car, a move).
- **Why they pay:** the forecast of *their* decisions, ranked in dollars, is the product. Free: the daily Duel, the Dashboard and one plan. **Pro** (about $39.99/year, a pricing assumption in [docs/PRODUCT.md](docs/PRODUCT.md)) adds saved scenarios, Compare, more Chance of success runs and the wishlist. Checkout runs in Stripe test mode; nothing is charged.
- **Why they come back:** a new Duel every day, a streak, and a plan that moves when their life does.
- **Growth:** game clips and share cards; the Duel needs no sign-up, so a shared link plays instantly.
- **Where we sit:** budgeting apps start from the past and ask for a bank login; retirement planners (ProjectionLab, Boldin) forecast but have no game, no decision ranking and a steep learning curve. We combine a no-login start, a forecast, ranked decisions and a daily game. Comparison: [docs/PRODUCT.md](docs/PRODUCT.md).

## Run it locally

Needs Node 22.12+ and pnpm 10 (`corepack enable`). Copy `.env.example` to `.env` for the AI routes and storage.

```
pnpm install
pnpm dev         # apps/web on localhost:3000
pnpm test        # Vitest: engine, types, data, web utils, ui-kit
pnpm lint        # ESLint incl. the UI import rule
pnpm typecheck
pnpm build
pnpm e2e         # Playwright: every screen plus the demo path
```

## Repo map

```
packages/types    shared contracts + zod schemas
packages/engine   pure functions + Vitest: plan, monteCarlo, decision, moves, afford, loan, cost, score
packages/data     public data pipeline, life cards, canonical fixtures
apps/web          Next.js App Router app (app/api/* server routes, src/features/*/{model,ui})
deploy/           Docker + CI deploy to the team server (see deploy/README.md)
docs/             PRODUCT, PIVOT, ARCHITECTURE, ENGINEERING, DATA, TASKS, DEMO
```

The UI is replaceable: `features/*/ui` is presentational only, with an ESLint rule enforcing it. Contributor rules: [CLAUDE.md](CLAUDE.md). Specs: [docs/ENGINEERING.md](docs/ENGINEERING.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA.md](docs/DATA.md).

## Team

**Amir** (ML/AI + full stack), **Aibek** (backend), **Kiko** (UI/UX design).
