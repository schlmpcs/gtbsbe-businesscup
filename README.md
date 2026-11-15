# LifeGuessr

**A yearly money plan in 2 minutes, from a game, with no bank login, and a ranked list of which decision to make next.** For US adults aged 25–45. Built in 24 hours for the Zimran Business Cup. Educational simulation, not financial advice.

**Live demo: https://forteveriti.tail8331b7.ts.net** (no sign-up, works on a phone)

## What it is

- **Planner:** your net worth year by year to age 90, life events on a timeline (buy a home, have a kid, retire, …), scenario compare, a seeded Monte Carlo **Chance of success**, and **Next Moves** ranked in dollars. Plus Cash Flow, Budget, Recurring, Goals, Can I Afford It? and Loan Lab.
- **Game:** the daily **Duel**, "Which life costs more?": five rounds, server-scored, a share grid and a challenge link. It hands you over to your own month and your plan.

No sign-up and no bank login: you bring a CSV statement (read in your browser), sliders, or the sample data.

## Try it in 2 minutes

1. [`/play`](https://forteveriti.tail8331b7.ts.net/play): today's Duel. Pick the life that costs more; the reveal shows both monthly totals by category, with sources.
2. [`/start`](https://forteveriti.tail8331b7.ts.net/start): guess your own month, then count it from a CSV, the sliders, or the sample bank link.
3. [`/dashboard`](https://forteveriti.tail8331b7.ts.net/dashboard): drag "Buy a home" along the **Life line** and watch the plan and its Chance of success redraw.
4. [`/plan`](https://forteveriti.tail8331b7.ts.net/plan): add a life event, then `?view=chance` (1,000 seeded paths) and `?view=compare` (two scenarios overlaid).

The 2-minute script is in [docs/DEMO.md](docs/DEMO.md).

## How it works (and what is not faked)

- **Code does the math.** Loan payments, costs, guess scores, affordability and month-end come from pure, tested functions in `packages/engine`, fed by public data with sources (HUD, Census ACS, BLS, USDA, DOL, NAIC, FHFA). Same seed, same Monte Carlo result.
- **AI does language.** It parses text into typed JSON, categorizes merchant labels and explains results; it never produces a number for loans, costs, scores, affordability or month-end. The 10-year forecast from Claude is validated in code, labeled "AI estimate", and replaced by the rules-based forecast when the model is unavailable or fails validation.
- **Every number has a source or an "estimate" tag.**
- **Privacy:** statements are parsed in the browser; only masked merchant labels, amounts, months and days go to the server, and only category totals are kept.
- **Pro** is a test-mode checkout: nothing is charged.

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
packages/engine   pure functions + Vitest: cost, score, forecast, plan, moves, afford, loan
packages/data     public data pipeline, life cards, canonical fixtures
apps/web          Next.js App Router app (app/api/* server routes, src/features/*/{model,ui})
deploy/           Docker + CI deploy to the team server (see deploy/README.md)
docs/             PRODUCT, ARCHITECTURE, ENGINEERING, DATA, TASKS, DEMO
```

More: [CLAUDE.md](CLAUDE.md) (rules for contributors, human or AI), [docs/PRODUCT.md](docs/PRODUCT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA.md](docs/DATA.md).

## Team

Amir (ML/AI + full stack), Aibek (backend), Kiko (UI/UX design).
