# TASKS.md — split and status

Split for the 24h build: **Amir** (ML/AI + SWE) ~19 h (~57%), **Aibek** (backend) ~14.5 h (~43%) + T12 (the house scene, sized at Hour 0), **Kiko** (UI/UX) on Figma, tokens and the sprite kit. Each task is a GitHub issue. Every task can start on fixtures. "Depends on" names the real piece that later replaces a fixture. Update the checkboxes as you go.

## Pivot: a Monarch-style planner (epic #160, tasks MP1–MP19)

Decided Nov 15 (`docs/PIVOT.md`): one app with a sidebar (Dashboard, Accounts, Transactions, Cash Flow, Budget, Recurring, Goals, Plan), the Duel as the front door, the rules engine and Monte Carlo as the forecast source, the AI forecast as a labeled second opinion. **No cut line:** every task ships. Order still matters: follow "Depends on" so the demo path works at every merge, and every merged PR keeps the live link working. The tables for the 24h build (Hour 0, Y, T, D) below stay as the record of what was built.

Each task is a GitHub issue; the issue body is its spec. `[x]` done, `[~]` in review, `[ ]` open.

In the pivot Kiko also builds the `ui/*` of the new screens (MP14–MP17): props in, events out, no change to a model, the engine or an API. The task ID `P1` in Amir's 24h table (the Pro paywall demo) is a task; screen IDs P1–P12 are in `ARCHITECTURE.md`.

| Done | ID | Issue | Task | Owner | Depends on | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| [~] | MP1 | #161 | Docs: record the pivot decisions (CLAUDE.md, PRODUCT, ARCHITECTURE, ENGINEERING, TASKS, PIVOT) | Amir | — | nothing (do early so everyone codes against the same rules) |
| [ ] | MP2 | #162 | Contracts + fixtures + zod schemas: `Account`, `PlanEvent`, `Scenario`, `PlanResult`, `MonteCarlo*`, `BudgetRow`, `CashFlowSummary`, stored `Transaction`; engine stubs. **First** | Amir | — | MP3–MP11, MP15–MP17 |
| [ ] | MP3 | #163 | Engine `plan()`: yearly plan to the end age, shortfall, withdrawal order, savings split | Amir | MP2, MP4, MP8 (stub until they land) | MP5, MP6, MP7 |
| [ ] | MP4 | #164 | Engine `expandEvent()` + `defaultEvent()` from area data (Buy a home, Have a kid, New job, Retire, …) | Aibek | MP2 | MP3, MP7 |
| [ ] | MP5 | #165 | Engine `monteCarlo()`: seeded paths, p10/p50/p90 bands, success rate, histograms | Amir | MP3 | MP6, MP7 (AI band), MP16 |
| [ ] | MP6 | #166 | Scenarios, Compare, Next Moves ranked on the plan | Amir | MP3, MP5 | MP7 |
| [ ] | MP7 | #167 | `/plan` view-models (`usePlan`, `useScenarios`, `useEventEditor`, `useAssumptions`, `useChanceOfSuccess` in a worker) + the AI line | Amir | MP2 (fixtures first); MP3–MP6 to wire | MP15, MP16 |
| [ ] | MP8 | #168 | Accounts: `accountsToProfile`, net worth, browser store, onboarding → accounts | Aibek | MP2 | MP3, MP11, MP17 |
| [ ] | MP9 | #169 | Engine `budgetRows()` and `cashFlowSummary()` (incl. Sankey data) | Aibek | MP2 | MP11, MP17 |
| [ ] | MP10 | #170 | Transactions: browser-only store, CSV import into it, manual add, category override | Aibek | MP2, T6/T7 | MP11, MP17 |
| [ ] | MP11 | #171 | View-models for Dashboard, Accounts, Transactions, Cash Flow, Budget, Recurring, Goals | Aibek | MP2 (fixtures first); MP8–MP10 to wire | MP17 |
| [ ] | MP12 | #172 | Design: shell, design-system extension and `/plan` (Plan, event panels, Assumptions, Compare, Chance of success) | Kiko | — | MP14, MP15, MP16 |
| [ ] | MP13 | #173 | Design: Dashboard, Accounts, Transactions, Cash Flow, Budget, Recurring, Goals, onboarding bridge from the Duel | Kiko | MP12 (system) | MP17 |
| [ ] | MP14 | #174 | Frontend: app shell (sidebar + bottom tabs), routing, redirects, old screens out of the navigation | Kiko | MP12 (shell frames) | MP15–MP17 |
| [ ] | MP15 | #175 | Frontend: `/plan` UI (KPIs, chart with events, tables, Add event, event editors, Assumptions, Compare, Next Moves, AI line) | Kiko | MP7 (`plan/model/types.ts` on fixtures), MP12, MP14 | — |
| [ ] | MP16 | #176 | Frontend: Chance of success (gauge, path fan, band, histograms, settings) | Kiko | MP7 (`useChanceOfSuccess` on `monteCarlo.demo.json`), MP12 | — |
| [ ] | MP17 | #177 | Frontend: Dashboard, Accounts (+ add modal, account page), Transactions (+ import), Cash Flow (+ Sankey), Budget, Recurring, Goals | Kiko | MP11 (types on fixtures), MP13, MP14 | — |
| [ ] | MP18 | #178 | QA: new e2e demo path, performance budget, deploy check | Aibek | MP14 first, then grows with MP15–MP17 | MP19 |
| [ ] | MP19 | #179 | Deck (≤ 10 slides) and the 2-minute demo script for the new product (Kiko on slide design) | Amir | the demo path working (MP18) | — |

```
MP1 (decisions/docs)
MP2 (contracts + fixtures) ──► MP3 plan() ──► MP5 monteCarlo() ──► MP6 scenarios + moves
                 │            └► MP4 expandEvent()
                 │            └► MP7 /plan view-models (+ AI line) ──► MP15 /plan UI ──► MP16 Chance of success UI
                 ├► MP8 accounts ─┐
                 ├► MP9 budget + cash flow ─┼► MP11 view-models ──► MP17 the other screens' UI
                 └► MP10 transactions store ┘
MP12 + MP13 (Figma) ──► MP14 app shell + routing ──► MP15 / MP16 / MP17
MP18 e2e + perf + deploy      MP19 deck + demo script
```

The pivot is done when the demo in `docs/PIVOT.md` runs on a phone at the live URL (Duel → guess your own → sliders → Dashboard → `/plan` + Buy a home → Next Moves → Chance of success → Compare → CSV → Transactions / Cash Flow / Budget) and `pnpm lint && pnpm test && pnpm e2e` are green.

## The 24h build (record)

Screen IDs S1–S15 in the tables below are the old build's. They map to the new ones: S1 → P1, S2–S3 → P11, S10 → P8, S11 (Can I Afford It?) → an Expense event on P8, S12 (Loan Lab) → P7 Goals › Pay down, S13 (Decide) → P9, S14 (check-in) → P5, S15 → P12; S5–S9 keep their IDs as the onboarding steps (`ARCHITECTURE.md`).

## Hour 0 (together)

- [x] Agree stack defaults (ARCHITECTURE.md) or swaps
- [x] Merge `packages/types` contracts; agree units (rates as decimals, monthly vs balance per field)
- [x] Commit fixtures to `packages/data/fixtures/`: `areaData.sample.json`, `cards.sample.json`, `profile.demo.json`, `statement.sample.csv`, `loanOffers.sample.json`
- [ ] LLM provider and key (Anthropic: no training on API data; zero data retention is not enabled, so no copy may claim it); the store is self-hosted on the team's server (`STORE_URL`)
- [ ] Agree which Figma frames come first (S1, S2 house scene, S3, S10, S12)
- [ ] Agree the sprite id list for the house kit (layouts, props per clue, decor) with the designer, and size T12

## Amir (ML/AI + SWE)

| Done | ID | Task | Hours | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| [x] | Y1 | Engine: `costOfLife` + `cardToProfile` + range-based `scoreGuess` with clue multiplier | 2 | Contracts; T2 data later | Tests pass for 3 sample cards; low ≤ mid ≤ high; scoring continuous at the range edges |
| [x] | Y2 | Engine: `forecast` (inflation, income growth, debt, range band, today's-$) + `applyPatch` | 2.5 | Contracts; T3 loan (stub first) | Golden test stable; range narrows with real inputs |
| [x] | Y3 | Engine: `rankMoves` level 1 + unlock rules | 1.5 | Y2 | Top 3 sorted by `effect10y` |
| [x] | Y4 | Engine: `canAfford` | 1 | Y2; T3 | Correct verdict for 3 fixtures, incl. a card purchase that returns "no" |
| [x] | Y7 | View-model hooks S1–S12 | 1.5 | Contracts | Hooks work on fixtures |
| [x] | Y8 | Placeholder UI: game S2–S4 (hosts `<HouseScene>`, static-card fallback, guess slider, reveal, share grid) + share button | 2 | Y7; T5; T12 | Game playable on live link |
| [x] | Y9 | Placeholder UI: ladder S5–S9 | 1.5 | Y7; T6–T7 | Profile builds end to end |
| [x] | Y10 | Placeholder UI: S1 Today + S10 forecast + Next Moves | 2 | Y2, Y3 | Range band + top 3 render |
| [x] | Y11 | Placeholder UI: S11 Can I Afford It? + S12 Loan Lab | 2 | Y4; T3 | Compare 3 loans, gauge, slider work |
| [x] | Y12 | `/api/ai/parse` + `/api/ai/explain` | 1 | Contracts | Typed JSON or clear error; no numbers; parsed values confirmed by the user |
| [x] | Y14 | Figma skin pass | 2 | Figma frames | Screens match Figma; no model or engine file changed |
| [x] | Y15 | AI forecast: contracts + pure engine helpers (`ForecastBundle`, `anchorsToForecast`, `deflateForecast`, `forecastSanityIssues`, `moveCandidates` / `rankCandidates`; `rankMoves` unchanged) | — | Y2, Y3 | Helpers tested incl. envelope rejects x3 / ÷1000 / over-wide band and wrong-effect moves; `rankMoves` tests untouched and green |
| [x] | Y16 | AI forecast: `POST /api/ai/forecast` (prompt, wire schema, checks, one retry, rules fallback, own rate limit) | — | Y12, Y15 | Valid → `source: 'ai'`, month 0 exact; invalid twice / no key / provider error → `source: 'rules'`; no live model in tests |
| [x] | Y17 | AI forecast: cache + in-flight dedup keyed by profile hash | — | Y16 | Same profile → same bundle; concurrent identical requests call the model once; fallbacks never cached |
| [x] | Y18 | AI forecast: client fetch + `useForecastBundle`; async S1/S10 view-models; source labels; local rules fallback | — | Y16, Y7 | Slider spam shows only the newest answer; offline / 429 → rules, labeled; today's-$ toggle makes no request |
| [x] | Y19 | AI forecast: eval script (run-to-run spread, gap to rules, band narrows after upload), outside CI | — | Y16 | Report printed for the fixture profiles; baseline recorded for the later ML model |
| [x] | Y20 | AI forecast: explanations name the source (`MoveInputSchema.source`, wording by source) | — | Y18 | AI move → "Our AI estimate…"; no `source` → current wording; numbers guard unchanged |
| [ ] | P1 | Pro paywall demo (replaces the S15 part of T11): Stripe Checkout in test mode + promo code, `/api/pro/*`, entitlement store, S15 screen, wishlist gate | — | Y7 | Test checkout and the promo code both unlock Pro; a live key is refused; wishlist save locked until Pro |

## Aibek (backend)

| Done | ID | Task | Hours | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| [x] | T1 | Monorepo, lint (incl. UI import rule), Vitest, CI, env, live deploy (on the team's server, see `ARCHITECTURE.md`, Deployment) | 0.5 | — | Live URL by hour 1 |
| [x] | T2 | Data pipeline (HUD, Census, BLS, childcare) → `areas.json` for ~60 ZIPs + refresh | 2.5 | Contracts | JSON committed, every value has a Source |
| [x] | T3 | Engine: `loan`, `compareLoans`, debt load, extra payments, payoff order | 1.5 | Contracts | Amortization matches the formula in tests; `payoffMonth: null` when the payment doesn't cover interest |
| [x] | T4 | Sessions: anon ID, save Profile + wishlist | 1 | T1 | Reload keeps profile without sign-up |
| [x] | T5 | `/api/daily` (US Eastern date, `PublicCard`s), `/api/daily/clue`, `/api/daily/guess`, leaderboard, share images 9:16 + 1:1 by `resultId`, rate limits | 1.5 | T1; T10 (fixture first) | Same 5 homes for everyone; no answer reaches the browser before the guess; share PNG renders; client can't post a score |
| [~] | T6 | In-browser CSV parsing, column detection, PII and name masking | 1.5 | Contracts | Sample + 2 real exports parse locally |
| [x] | T7 | `/api/statement/categorize` + one-off tagging + "What we keep" data | 1.5 | T6 | Returns CategoryTotals; raw data never stored |
| [x] | T8 | Funnel events + Playwright demo-path test | 1 | T1 | One command runs the demo path green |
| [x] | T9 | Engine: `monthEnd` (was Y5) | 1 | T7 shape (fixture first) | Flags only real drift; no flags with < 3 months |
| [x] | T10 | 50 life cards + 2 creator packs (no per-card images: the scene is built from the data) (was Y6) | 1.5 | T2 | Cards load with real costs; day order goes easy → curveball |
| [x] | T11 | Mockups S13–S15 (was Y13) | 1 | Y7 | Clickable on fixtures |
| [x] | T12 | House scene: `sceneOf` in `scene.ts` + `<HouseScene>` (layout, closed rooms, tap → zoom → clue) | Sized at Hour 0 | Contracts; D1 for art (placeholder rectangles first) | Playable on a phone with placeholders by Sync 2; consistency test green |

## Kiko (UI/UX, Figma only)

| Done | ID | Task | Depends on | Done when |
| --- | --- | --- | --- | --- |
| [x] | D1 | House sprite kit: 5 layouts, props per clue state (car bands, kid ages, takeout piles, coats, tier signs), decor set; SVGs named by sprite id | Sprite id list (Hour 0) | Kit in `apps/web/public/scene/` by Sync 2; scene skinned by h17 |
| [x] | D2 | Figma frames S1–S15, named by screen ID; S1, S2 (house scene), S3, S10, S12 first | Screen list (ARCHITECTURE.md) | Priority frames by h12, the rest by h17, ready for the Y14 skin pass |
| [x] | D3 | Design tokens: Figma variables → `tokens.json` (colors incl. chart palette, type scale, spacing, radius, shadows) | — | `pnpm tokens` generates `tokens.css`; ui-kit restyle can start by Sync 2 |
| [x] | D4 | S9: "connect your bank app" option next to CSV upload (Figma + disabled "coming soon" card in the UI) | D2 | Frame in Figma; card on `/me/upload` with a test; real integration is post-hackathon |

`[~]` means partly done. T6 (#19): the sample and three synthetic exports parse and are tested; payee/payer masking on bill-pay, check, deposit and ACH lines is fixed in PR #102 with passing CI. Two anonymized real exports still need to be supplied and parsed locally; the opt-in check is documented in ENGINEERING.md.

After T8–T12, Aibek owns integration and bugs and pairs on Y14.

Y15–Y20 (AI forecast, Amir) put a server forecaster behind S1 and S10. They have to land before the Sync 3 logic freeze, with the rules forecast as the fallback. The Hours column is left blank for them on purpose.

## Timeline

| Hours | Amir | Aibek | Sync |
| --- | --- | --- | --- |
| 0–1 | Contracts + fixtures | Contracts + T1 | Live URL, types merged |
| 1–6 | Y1, Y2, start Y7 | T2, T3 | **Sync 1 (h6):** engine + real data |
| 6–12 | Finish Y7, Y3, Y8, Y9 | T10, T4, T5, T6, T12 | **Sync 2 (h12):** game (house scene or static fallback) → own profile live on the real engine |
| 12–17 | Y10, Y4, Y11 | T7, T9, T8, T11, finish T12 + sprite kit | **Sync 3 (h17):** logic freeze, demo path green |
| 17–20 | Y12, Y14 Figma pass | Pair on Y14, phone testing | Final design on real screens; AI routes behind the manual-form fallback |
| 20–22 | Demo data, rehearsal | Performance, README | One rehearsal |
| 22–24 | Deck, rehearse | Final deploy, backup recording | Submit: deck PDF, live link, repo |

**Slack warning:** Amir's 1–17 windows are full to the hour, with no slack. If Amir is behind at Sync 1, hand the S12 Loan Lab UI (half of Y11) to Aibek, who already owns the loan engine.

**T12 has to fit in Aibek's spare time:** about 2 h before h17 by the hours above, plus whatever dropping per-card images saves from T10. If T12 is bigger than that once sized at Hour 0, cut from the cut order (creator packs, then leaderboard) before touching the demo path. If the scene isn't playable at Sync 2, ship the static card and keep T12 behind a flag.
