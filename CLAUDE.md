# CLAUDE.md — LifeGuessr (working name)

Read this first. It tells you what the product is, how the repo is laid out, and the rules you must follow when writing code here.

## What we are building

A **Monarch-style money planner** (Dashboard, Accounts, Transactions, Cash Flow, Budget, Recurring, Goals, Plan) for US adults aged 25–45, with a daily game, the **Duel**, as the front door. Built for the **Zimran Business Cup** hackathon. The decisions behind the rebuild are in `docs/PIVOT.md` (epic #160).

- **Product (what people pay for):** the **Plan**: a yearly net-worth plan to age 90 with life events on a timeline (Buy a home, Have a kid, Retire, an Expense, …), an Assumptions panel, Compare scenarios and **Chance of success** (a seeded Monte Carlo), plus **Next Moves** ranked in dollars. Around it sit the Monarch-style screens: Accounts, Transactions, Budget, Cash Flow, Recurring and Goals (Save up, Pay down = Loan Lab). It needs no bank login: sliders, manual accounts and a CSV statement parsed in the browser get you a plan in 2 minutes (connecting a bank app is an optional extra, shown as "coming soon" in the 24h build).
- **Marketing (how people find it):** a GeoGuessr-style daily game, the **Duel** ("Which life costs more?": two composite lives, pick the costlier, optional hint; five rounds a day, server-scored, shareable result and challenge link). The game then asks you to guess your own month and hands you to the sliders. It is built for streamers and TikTok.
- **Pitch line** (from `docs/PIVOT.md`): "Monarch's best feature is the forecast, and it's behind a bank login and a $299/year plan. We give you that plan in 2 minutes, from a game, with no bank login, and we rank which decision to make next." (Don't say budget apps only look backward: Monarch and PocketSmith do forecast. See `docs/PRODUCT.md`.) We take Monarch's information architecture and math only, never its name, logo, copy, colors, icons or illustrations.

Full business context: `docs/PRODUCT.md`.

## Hackathon constraints (non-negotiable)

- Web only, runs in the browser, **no sign-up or login** to use it end to end.
- Judges read the repo. **40% of the score is "does it work, not faked or hardcoded".**
- Submission: a live production link, a public GitHub repo, and a pitch deck of 10 slides or fewer.
- Team: **Amir** (owner; ML/AI + SWE, ~57% of the code), **Aibek** (backend, ~43%), **Kiko** (UI/UX: Figma frames, design tokens, house sprite kit; no code). Folder ownership is in `docs/ENGINEERING.md`; the task split is in `docs/TASKS.md`; work is tracked as GitHub issues (labels `owner:*`, `area:*`; milestones Hour 0 → Submit).
- The UI is being designed in Figma in parallel. Placeholder screens come first, then Figma frames get mapped onto them screen by screen.

## Golden rules for code

1. **Code does the math; AI does language and one labeled second opinion.** The plan line, every KPI (net worth at year end, at retirement, retirement age, net worth at the end, shortfall age), the range and Chance of success come from `packages/engine` (`plan()`, `monteCarlo()`), which is pure, deterministic and tested. So do loan payments, costs, guess scores, affordability, budget rows, cash flow and month-end projections. The AI forecaster (Claude for the demo, a trained model later) is a **second opinion**: a separate line on `/plan` labeled "AI estimate", validated in code against the Monte Carlo p5–p95 band (shape, today's balance exact, every point inside the band), and **hidden when it fails**. It never feeds a KPI, a verdict, a Next Move or Chance of success, and it never replaces an engine number. Everywhere else, LLM calls only parse text into typed JSON, categorize merchant labels, write card captions, and explain results. An LLM must never produce a number for the plan, loans, costs, scores, affordability, budget or month-end. Spec: `docs/ENGINEERING.md → AI forecast (second opinion on /plan)`.
2. **The UI is replaceable.** Files in `apps/web/src/features/*/ui/` are presentational only: props in, events out. They import only from `@/ui-kit/**`, `@/copy` and their feature's `../model/types`. A lint rule enforces this.
3. **Contracts first.** Shared types live in `packages/types`. Don't change a contract silently; update the type, the fixtures and both consumers in the same PR.
4. **Fixtures first.** Every feature must work on fixtures before it is wired to real data or APIs. The canonical fixtures live in `packages/data/fixtures/*` (so engine tests can use them); `apps/web/src/fixtures/index.ts` only re-exports them.
5. **Every number has a source or an "estimate" tag.** Data values carry a `Source` (`{ name, year, url }`). User fields that we defaulted carry `isEstimate: true`. Engine plans carry `source: 'rules'`; the AI line carries `source: 'ai'` and its "AI estimate" label.
6. **Privacy:** never store raw bank statements, account numbers or names. CSVs are parsed in the browser. Each line sent to the server holds only the merchant label (with personal names masked, e.g. in Zelle/Venmo lines), the amount, the month and the day of month. Labels pass through the LLM provider for categorizing and are not stored. From statements, only category totals are persisted.
7. **Wording:** the app is an "educational simulation, not financial advice". Never recommend specific lenders, investments or securities.
8. **Units:** `Money` is unrounded US dollars; whether a value is per month or a balance is stated on the field. Rates are decimals per year (`apr: 0.228` means 22.8%). Never mix in percent numbers.

## Repo map

```
packages/types     shared TypeScript contracts (Profile, Forecast, LoanInput, Account, PlanEvent, Scenario, PlanResult, …)
packages/engine    pure functions + Vitest: plan, planEvents, monteCarlo, scenarios, accounts, budget, cashFlow,
                   forecast, moves, afford, cost, score, month, loan/
packages/data      fetch scripts for HUD / Census / BLS / childcare → normalized JSON, life cards
  fixtures/        canonical fixtures: area data, cards, demo profile, accounts, scenarios, plan, transactions, sample statement, loan offers
apps/web           Next.js App Router app
  app/             routes (the Duel reveal and day result are states of /play; /plan?view=compare and ?view=chance are views of /plan), app/api/* server routes
  src/ui-kit/      primitives + tokens.css (generated from tokens.json)
  src/features/<feature>/model   view-model hooks (data + actions)
  src/features/<feature>/ui      presentational components (rewritten from Figma)
  src/features/      new: shell (sidebar on desktop, bottom tabs on a phone, routing), dashboard, accounts, transactions,
                     cashflow, budget, recurring, goals, plan (/plan: chart, KPIs, events, assumptions, compare,
                     chance of success, AI line); kept: game (the Duel), ladder (onboarding), upload, pro
  src/fixtures/    re-exports packages/data/fixtures
tokens.json        design tokens exported from Figma variables
docs/              PRODUCT, PIVOT, ARCHITECTURE, ENGINEERING, DATA, TASKS
```

Details: `docs/PIVOT.md` (why we rebuilt around the planner, what we take from Monarch), `docs/ARCHITECTURE.md` (layers, screens P1–P12, contracts, API), `docs/ENGINEERING.md` (formulas, conventions, testing, Figma handoff), `docs/DATA.md` (sources and series IDs), `docs/TASKS.md` (who does what, status).

## Commands (set up in task T1)

```
pnpm install
pnpm dev            # apps/web on localhost:3000
pnpm test           # Vitest (engine + utils)
pnpm e2e            # Playwright demo-path smoke test
pnpm lint           # includes the UI import rule
pnpm data:refresh   # re-fetch public data into packages/data/out/*.json
pnpm tokens         # tokens.json → apps/web/src/ui-kit/tokens.css
```

## When I (the user) give you a Figma frame

1. Find its screen ID (P1–P12) in `docs/ARCHITECTURE.md`.
2. Rewrite **only** `apps/web/src/features/<feature>/ui/*` (and ui-kit primitives if the frame introduces a new style). Don't touch the model, engine or API.
3. If the frame needs data the view-model doesn't provide, add a field to the view-model hook (and its fixture). Never put logic in the UI.
4. Use tokens (CSS variables) for every color, size and radius. Put all copy in `src/copy.ts`.
5. Run `pnpm lint && pnpm test && pnpm e2e` before saying the screen is done.

## Definition of done

The feature works on a phone at the live URL, uses real data or labeled estimates, has engine tests where it computes anything, passes lint, e2e and CI, and is listed in the README.
