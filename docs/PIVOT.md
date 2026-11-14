# PIVOT.md: rebuild around a Monarch-style planner, keep the game

**Status:** proposal (Nov 15). Needs a yes from Amir and Aibek before CLAUDE.md, PRODUCT.md, ARCHITECTURE.md and TASKS.md change.
**Input:** the Monarch Money teardown (37 pages; screens, data model, Forecasting and Monte Carlo) and this repo as of `0b282e9`.

## The decision in one paragraph

Take Monarch's **structure** (one app with a sidebar: Dashboard, Accounts, Transactions, Cash Flow, Budget, Recurring, Goals, Plan) and its best feature, **Forecasting** (a yearly plan to age 90, life events on a timeline, an Assumptions panel, scenario compare, Chance of success via Monte Carlo). Keep **our** pieces that Monarch does not have: the daily game as the front door, no bank login (sliders + CSV get you a plan in 2 minutes), local public data behind every default, and Next Moves ranked in dollars. Do not copy Monarch's name, logo, copy, colors or illustrations (the teardown says the same); we take the information architecture and the math, built with our own tokens and components.

## Pitch after the pivot

"Monarch's best feature is the forecast, and it's behind a bank login and a $299/year plan. We give you that plan in 2 minutes, from a game, with no bank login, and we rank which decision to make next."

- **Is it new? (10%)**: a plain Monarch clone scores low here. What is new: the game funnel, no-login onboarding from local public data (rent, childcare, property tax, insurance by area), and moves and events ranked in dollars. Say this out loud in the pitch.
- **Does it work? (40%)**: Monarch's plan is deterministic math plus Monte Carlo. That is easier to defend in a repo review than an LLM forecast. See "AI's role" below.

## What we take from Monarch, what we keep, what we cut

| Monarch section | What we build | Reuse from this repo | New work |
| --- | --- | --- | --- |
| Dashboard | `/` net worth, this month's spending pace, top 3 moves, today's game card, a setup checklist (x of 5) | `monthEnd`, `dailyMonthToDate`, `rankMoves`, S1 view-model | widget layout |
| Accounts | `/accounts` manual accounts: Cash, Investments/Retirement, Real estate, Vehicle (assets); Credit card, Loan, Mortgage (liabilities). Name + balance, net worth = assets − liabilities | `Profile.cash/retirement/debts`, `netWorthOf`, balance sheet S8 | `Account[]` type and its mapping to `Profile`; illiquid assets (home, car) |
| Transactions | `/transactions` CSV import, list, change a category. **The lines stay in the browser** (rule 6); the server sees only masked labels to categorize, as today | T6 parser, `/api/statement/categorize`, `statementTotals` | list UI, local storage of lines |
| Cash Flow / Reports | `/cash-flow` income, expenses, savings, savings rate; Sankey by category | `statementTotals`, `CategoryTotals` | Sankey chart |
| Budget | `/budget` planned vs actual per category with a "where you should be today" marker. "Create my budget" fills Planned from **our sliders and area data** (Monarch fills a generic sample) | `Profile.spending`, `costOfLife`, `monthEnd` | `budgetRows()` in the engine + table |
| Recurring | `/recurring` detected recurring charges | `detectSubscriptions`, `/tools/subscriptions` | move it into the shell |
| Goals | `/goals` Save up (status On track / At risk) and Pay down (debt payoff) | `goalStatus`, `extraSavingToReach`, `loan/payoff` | merge the two screens |
| **Forecasting** | `/plan`, the hero screen, details below | `simulate`, `events`, `amortizedPayment`, JF5 home costs, childcare data, `rankMoves` | the most new work, see the engine list |
| Investments | **cut** | | |
| AI Assistant / "Understand…" | sparkle buttons that explain a widget in words | `/api/ai/explain` | small |
| — | **Play** (the game) at the top of the sidebar, daily | the game, share cards, leaderboard | none |

**Folded in:** Can I Afford It? becomes the "Expense" event (a one-off or financed purchase on the plan). Loan Lab stays as a tool under Goals → Pay down and inside the "Buy a car" event. Decide becomes Compare scenarios. Check-in becomes Budget (planned vs actual).

**Removed from navigation** (code stays until after the demo, deleted later): duel/together/avatar publishing, overpaying, work-time, spend, separate check-in and decide pages, the ladder screens that the Accounts and Budget screens replace.

## `/plan`, the hero screen

Copy Monarch's behaviour, not its look:

1. A KPI strip: net worth at year end, net worth at retirement, retirement age, net worth at the end of the plan.
2. A yearly net worth line from today to age 90. The part below zero is red with a hatched area. Event icons sit on vertical lines and can be dragged along the year axis.
3. Tabs below the chart: **Accounts** (per account: start balance → growth → deposits → end), **Cash Flow** (income, expenses, withdrawals, net), **Events** (a timeline). All three are views of one simulation.
4. An **Assumptions** side panel: age, income sources, yearly expenses (from the budget or entered), inflation (3% default, slider), today's vs future dollars, withdrawal order, savings split.
5. **Add event** catalog: Income, Expense, Buy a home, Have a kid, New job, Career break, Windfall, Retire, Social Security. Each event is created right away with sensible defaults, the chart redraws, autosave shows "Saved".
6. **Buy a home** uses our area data, not flat rules of thumb: price, down payment ($ and % kept in sync), term, rate → monthly payment with principal and interest, property tax and insurance from JF5 for the user's area; a "replace my current housing cost" switch.
7. **Have a kid** uses the childcare cost for the user's area.
8. **Compare**: a scenario is a copy of assumptions + events; the chart overlays two lines.
9. **Chance of success**: 1,000 paths (seeded), a fan of paths, a 10th–90th percentile band, a success % gauge, histograms of net worth at retirement and at the end, shortfall age. Settings: inflation mean and spread, growth and spread per account group, number of paths, fixed seed.
10. **Next Moves** stay on top of this screen: "Raise your 401(k) by 3% = +$41k at 65", ranked in dollars. That is the part Monarch does not do.
11. The disclaimer: "Educational simulation, not financial advice. Estimates only."

## Engine work (all pure, tested, in `packages/engine`)

| ID | Function | Notes |
| --- | --- | --- |
| E1 | `plan(profile, scenario)` → yearly rows to the end age | Wrap `simulate` (it already runs up to 1,200 months). Add a separate **shortfall** balance (unfunded expenses, grows with inflation) instead of pushing it onto a card; withdrawal order across accounts; savings split. Output rows that feed the Accounts / Cash Flow / Events tabs |
| E2 | `expandEvent(event, area)` → primitive events + debts | Buy a home, Have a kid, New job, Career break, Windfall, Retire, Social Security expand into today's `pay` / `spending` / `oneOff` events plus a mortgage `Debt`. Buy a home: `amortizedPayment`, tax and insurance from JF5, upkeep 1% of value, optional replace housing |
| E3 | `monteCarlo(profile, scenario, { paths, seed, inflation: {mean, sd}, growth: {mean, sd}[] })` | mulberry32 PRNG, normal draws via Box–Muller. Success = net worth at the end ≥ threshold and no shortfall. Returns per-year p10/p50/p90, a 1-in-5 sample of paths for drawing, success %, histograms. Same seed → same output (test). Check speed: 1,000 paths × 65 years must stay under ~300 ms, or simulate yearly steps or run in a Web Worker |
| E4 | `Scenario` type: `{ id, name, assumptions, events }` | Stored next to the profile; Compare = two `plan()` calls |
| E5 | `budgetRows(profile, totals, day)` | Planned, actual, remaining, and the expected spend by today's date |
| E6 | `accountsToProfile(accounts)` and back | Keeps every existing engine function working unchanged |

## AI's role after the pivot (needs a team decision)

Recommendation: **the rules engine + Monte Carlo becomes the only source of forecast numbers**, as in Monarch. The AI forecaster (Y15–Y20) stays in the repo behind a flag and is no longer on the demo path. AI keeps doing language: categorizing CSV labels, the "Understand…" explanations, and parsing typed text.

Why: 40% of the score is "does it work, not faked", and a seeded, tested Monte Carlo is easier to defend than a model whose numbers we have to sanity-check. It also removes the "AI estimate" caveat from the main screen.

This changes golden rule 1 in CLAUDE.md. If the team agrees, CLAUDE.md, PRODUCT.md and ENGINEERING.md → AI forecast get updated in the same PR.

## Order of work and the cut line

Every step must leave the live link working.

1. **App shell** (Aibek + Kiko): sidebar on desktop, bottom tabs on a phone (Dashboard, Plan, Budget, Play, More). Old routes redirect into it. Kiko does the shell and the `/plan` frame in Figma first.
2. **E1 + E2 + `/plan` Plan tab** (Amir): chart, KPIs, Events tab, Add event with Buy a home / Have a kid / Retire, Assumptions panel. **This is the demo.**
3. **E3 + Chance of success** (Amir): fan, band, success %, one histogram.
4. **Accounts + Dashboard** (Aibek): E6, manual accounts, net worth.
5. **Budget + Transactions + Cash Flow** (Aibek): reuse T6/T7, E5, Sankey.
6. **Compare** (Amir): E4, two lines.
7. ---- cut line ---- Recurring and Goals moved into the shell, account and Cash Flow tables on `/plan`, draggable event icons, "Understand…" buttons.

## New demo script (2 minutes)

1. Scan the QR code, play one home of the daily game (30 s). Guess your own month.
2. Three sliders → the Dashboard shows your net worth and this month.
3. Plan: the line to age 90. Add "Buy a home" in 2029: the mortgage, tax and insurance come from data for your area, and the line drops.
4. Next Moves: the top move and its dollar effect.
5. Chance of success: 1,000 paths, the success %; change the seed and get the same result with "fixed seed" on.
6. Upload the sample CSV → Transactions, Cash Flow Sankey, Budget planned vs actual.
7. Show the tests for `plan`, `expandEvent` and `monteCarlo` in the repo.

## Open questions for the team

1. Agree to make the rules engine + Monte Carlo the forecast source (rule 1 change)?
2. Which game do we keep on the front door: the house scene or the duel?
3. How many hours are left? If fewer than ~10, stop after step 3 and present the rest as the roadmap.
