# CLAUDE.md — LifeGuessr (working name)

Read this first. It tells you what the product is, how the repo is laid out, and the rules you must follow when writing code here.

## What we are building

A **forward-looking budget planner** for US adults aged 25–45, built in 24 hours for the **Zimran Business Cup** hackathon.

- **Product (what people pay for):** a forecast of your month, of "You in 10 years", and your next best money moves ranked in dollars. It also includes "Can I Afford It?" (purchases) and "Loan Lab" (loans), with no bank login needed.
- **Marketing (how people find it):** a GeoGuessr-style daily game. You explore a stranger's home (an illustrated dollhouse cutaway: tap the garage, kitchen, kids' room… for clues that cost points) and guess what their life costs per month; then the game asks you to guess your own. It is built for streamers and TikTok.
- **Pitch line:** "Money apps forecast your accounts. We forecast your decisions, and rank which one to make next." (Don't say budget apps only look backward: Monarch and PocketSmith do forecast. See `docs/PRODUCT.md`.)

Full business context: `docs/PRODUCT.md`.

## Hackathon constraints (non-negotiable)

- Web only, runs in the browser, **no sign-up or login** to use it end to end.
- Judges read the repo. **40% of the score is "does it work, not faked or hardcoded".**
- Submission: a live production link, a public GitHub repo, and a pitch deck of 10 slides or fewer.
- Team: **Amir** (owner; ML/AI + SWE, ~57% of the code), **Aibek** (backend, ~43%), **Kiko** (UI/UX: Figma frames, design tokens, house sprite kit; no code). Folder ownership is in `docs/ENGINEERING.md`; the task split is in `docs/TASKS.md`; work is tracked as GitHub issues (labels `owner:*`, `area:*`; milestones Hour 0 → Submit).
- The UI is being designed in Figma in parallel. Placeholder screens come first, then Figma frames get mapped onto them screen by screen.

## Golden rules for code

1. **Code does the math; AI does language and, for the demo, the 10-year forecast.** Loan payments, costs, guess scores, affordability verdicts and month-end projections come from `packages/engine`, which uses pure, deterministic, tested functions. The 10-year forecast and the `effect10y` of Next Moves come from an AI forecaster: Claude for the demo, a trained model later. Its output is validated in code (shape, ordering, today's balance exact, a sanity envelope against the rules engine), labeled "AI estimate" wherever it appears, and replaced by the rules-based `forecast()` when the model is unavailable or fails validation. Never present it as engine-computed or deterministic. Everywhere else, LLM calls only parse text into typed JSON, categorize merchant labels, write card captions, and explain results. An LLM must never produce a number for loans, costs, scores, affordability or month-end. Spec: `docs/ENGINEERING.md → AI forecast`.
2. **The UI is replaceable.** Files in `apps/web/src/features/*/ui/` are presentational only: props in, events out. They import only from `@/ui-kit/**`, `@/copy` and their feature's `../model/types`. A lint rule enforces this.
3. **Contracts first.** Shared types live in `packages/types`. Don't change a contract silently; update the type, the fixtures and both consumers in the same PR.
4. **Fixtures first.** Every feature must work on fixtures before it is wired to real data or APIs. The canonical fixtures live in `packages/data/fixtures/*` (so engine tests can use them); `apps/web/src/fixtures/index.ts` only re-exports them.
5. **Every number has a source or an "estimate" tag.** Data values carry a `Source` (`{ name, year, url }`). User fields that we defaulted carry `isEstimate: true`. Forecasts carry `source: 'ai' | 'rules'`.
6. **Privacy:** never store raw bank statements, account numbers or names. CSVs are parsed in the browser. Each line sent to the server holds only the merchant label (with personal names masked, e.g. in Zelle/Venmo lines), the amount, the month and the day of month. Labels pass through the LLM provider for categorizing and are not stored. From statements, only category totals are persisted.
7. **Wording:** the app is an "educational simulation, not financial advice". Never recommend specific lenders, investments or securities.
8. **Units:** `Money` is unrounded US dollars; whether a value is per month or a balance is stated on the field. Rates are decimals per year (`apr: 0.228` means 22.8%). Never mix in percent numbers.

## Repo map

```
packages/types     shared TypeScript contracts (Profile, Forecast, LoanInput, …)
packages/engine    pure functions + Vitest: cost, score, forecast, moves, afford, month, loan/
packages/data      fetch scripts for HUD / Census / BLS / childcare → normalized JSON, life cards
  fixtures/        canonical fixtures: area data, cards, demo profile, sample statement, loan offers
apps/web           Next.js App Router app
  app/             routes (S3 and S4 are states of /play), app/api/* server routes
  src/ui-kit/      primitives + tokens.css (generated from tokens.json)
  src/features/<feature>/model   view-model hooks (data + actions)
  src/features/<feature>/ui      presentational components (rewritten from Figma)
  src/fixtures/    re-exports packages/data/fixtures
tokens.json        design tokens exported from Figma variables
docs/              PRODUCT, ARCHITECTURE, ENGINEERING, DATA, TASKS
```

Details: `docs/ARCHITECTURE.md` (layers, contracts, API), `docs/ENGINEERING.md` (formulas, conventions, testing, Figma handoff), `docs/DATA.md` (sources and series IDs), `docs/TASKS.md` (who does what, status).

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

1. Find its screen ID (S1–S15) in `docs/ARCHITECTURE.md`.
2. Rewrite **only** `apps/web/src/features/<feature>/ui/*` (and ui-kit primitives if the frame introduces a new style). Don't touch the model, engine or API.
3. If the frame needs data the view-model doesn't provide, add a field to the view-model hook (and its fixture). Never put logic in the UI.
4. Use tokens (CSS variables) for every color, size and radius. Put all copy in `src/copy.ts`.
5. Run `pnpm lint && pnpm test && pnpm e2e` before saying the screen is done.

## Definition of done

The feature works on a phone at the live URL, uses real data or labeled estimates, has engine tests where it computes anything, passes lint, e2e and CI, and is listed in the README.
