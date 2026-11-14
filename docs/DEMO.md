# DEMO.md — the 2-minute demo script (MP19)

The deck is ≤ 10 slides (problem, insight, product, the Duel, demo, why it's real, market, business model, traction and plan, team). This page is what the presenter says and taps during the live demo. Source of truth for the flow: `docs/PIVOT.md` → "New demo script". Run it on a phone at the live URL; mirror the phone to the projector.

> **Status (Nov 14):** steps 0:00–0:45 run on `main` today. The planner steps (`/plan`, `?view=chance`, `?view=compare`, `/transactions`, Cash Flow, Budget) need MP14–MP17 merged; until then use `/future` for the plan line. Rehearse on the live URL once they land.

**Before you start (5 min earlier)**

- Open the live link in a fresh private tab on the phone (no saved state, so the Duel and onboarding show as a first visit).
- Have `packages/data/fixtures/statement.sample.csv` on the phone (AirDrop/Files) for step 6.
- Check `/api/health` returns OK. If the AI key is not set, the "AI estimate" line is simply absent: that is the designed behaviour, not a failure.
- Fill the two `[__]` traction numbers on slide 10 from the funnel events (`/api/events/funnel`). Don't guess them.

## The script

| Time | Screen | Tap | Say |
| --- | --- | --- | --- |
| 0:00–0:20 | `/play` (the Duel) | Pick the life you think costs more in round 1. | "Today's Duel: which life costs more per month? Everyone gets the same five rounds. … The reveal shows each life's costs by category, with the source and year, and what decided it. The server holds the answers, so a score can't be faked from the browser." |
| 0:20–0:30 | Day result → **Guess your own month** | Tap the one primary button. | "This is the hand-off: now guess your own month. That's the front door into the planner." |
| 0:30–0:45 | `/me/guess` → sliders | Enter a guess, move rent, car and food. | "Three sliders, no bank login. Anything I skip gets a default from public data for my area, tagged as an estimate." |
| 0:45–0:50 | Dashboard (`/`) | — | "Net worth and this month's pace." |
| 0:50–1:15 | `/plan` | **Add event → Buy a home**, set 2029. | "My plan to age 90. I add Buy a home in 2029: the mortgage payment, property tax and home insurance come from Census and NAIC data for my ZIP. Watch the line drop." |
| 1:15–1:25 | `/plan` → Next Moves | Point at the top move. | "Next Moves, ranked in dollars: the top one and what it's worth at retirement. That's the part forecasting apps don't do." |
| 1:25–1:45 | `/plan?view=chance`, then `?view=compare` | Open Chance of success; then Compare. | "1,000 seeded Monte Carlo paths. The success rate. Same seed, same answer: it's code, not a guess. … Compare: two scenarios overlaid." |
| 1:45–2:00 | `/transactions` → Cash Flow → Budget | Upload the sample CSV. | "Optionally, drop a bank CSV. It's parsed in the browser; only masked merchant labels go to the server, and only category totals are kept. Transactions, Cash Flow, Budget planned vs actual." |

Close: "Every number you saw comes from tested, deterministic code with a cited source. Educational simulation, not financial advice."

## If something goes wrong

- **Slow network:** skip step 1:45 (CSV); end on Chance of success.
- **A screen errors:** say "the numbers are in the engine", open the repo on the laptop at `packages/engine/plan.test.ts` and `monteCarlo.test.ts`, and run `pnpm exec vitest run packages/engine/monteCarlo.test.ts`.
- **Already played today on the demo phone:** use another private tab, or show the day result and its single "Guess your own month" button directly.

## Questions judges are likely to ask

- **"Is the AI making up numbers?"** No. The plan, every KPI and Chance of success come from `plan()` and `monteCarlo()` in `packages/engine`. The AI line is a labeled second opinion, shown only when it falls inside the Monte Carlo 5th–95th band, and it never feeds a KPI or a move.
- **"Where do the defaults come from?"** HUD rents, Census ACS (home value, owner costs, property tax), BLS prices, DOL childcare, NAIC insurance, FHFA home prices: 60 ZIPs across 15 metros, each value with its source and year (`docs/DATA.md`).
- **"How do you make money?"** Pro at $39.99/year (an assumption to test); the paywall shows after the user has seen their own plan (`docs/PRODUCT.md`).
- **"Why not just a bank-linked app?"** No login and a daily game get people to a plan in two minutes; bank-linked forecasting sits behind a $299/year plan.
