# Horizon picker (S10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The user picks 1, 3, 5 or 10 years on S10; the headline, range, chart and Next Moves (gains and ranking) on S10 and S1 read that year from the one answered bundle, and the server checks AI answers at each of those years.

**Architecture:** A shared constant `FORECAST_HORIZONS` in `packages/types`. The engine's AI checks take the year and scale their dollar floors with it; the server checks every offered year. The client keeps `horizonYears` in the persisted store and reads `points[12·years]` from the existing answer: no new request.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js App Router, Zustand, Playwright (CI only).

**Spec:** `docs/superpowers/specs/2026-11-14-horizon-picker-design.md`

## Global Constraints

- `FORECAST_HORIZONS = [1, 3, 5, 10]`; default horizon 10.
- Effect floor at year y: `effectFloor × y / 10` ($100 at 1, $1,000 at 10). Base floor at year y: `floorMonths × y / 10` months of take-home pay. Ratio 1/3×–3× and `relative` 0.25 unchanged.
- No prompt change, no `PROMPT_VERSION` bump, no cache-key change, no new model call when the horizon changes. The server never receives the horizon for `/api/ai/forecast`.
- `Move.effect10y` keeps meaning the 10-year effect; the shown-horizon effect lives on `MoveVM.effect`.
- `features/*/ui/` stays presentational (imports only `@/ui-kit/**`, `@/copy`, `../model/types`); every string in `src/copy/*`; tokens for every style.
- Commits: identity `schlmpcs`, no AI attribution lines. Locally only `pnpm test`, `pnpm lint`, `pnpm typecheck`; build and e2e run in CI.
- Ladder S5–S9 "rules preview" stays at 10 years (out of scope); Goals card unchanged; Can I Afford It? / Loan Lab unchanged.

## Review Focus

- A saved session from before this PR (no `horizonYears`) or with a bad value (e.g. `7`): loads with 10, nothing else in the saved state is lost. → Task 5 test.
- Switching the horizon while an AI answer is still loading or refreshing: the screen keeps showing the rules answer at the new year, and no new `/api/ai/forecast` request starts. → Task 5 and Task 6 tests.
- A move whose gain at 1 year is below $1 (dropped) but positive at 10: it disappears from the list at 1 year and comes back at 10; a committed move outside the top 3 still takes the third slot. → Task 5 test.
- An explanation fetched at 10 years is not reused after switching to 3 years (different effect, different horizon); switching back reuses it. → Task 5 test.
- "1 year" singular in every string ("+$513 in 1 year", "You in 1 year"). → Task 6 test.

---

### Task 1: Contracts

**Files:**
- Modify: `packages/types/constants.ts`, `packages/types/index.ts`, `packages/types/schemas.ts`
- Test: `packages/types/schemas.test.ts`

**Interfaces:**
- Produces: `FORECAST_HORIZONS` (`readonly [1, 3, 5, 10]`), `type HorizonYears = 1 | 3 | 5 | 10`, `HorizonYearsSchema` (zod union of literals), `ExplainRequest.horizon?: { years: HorizonYears; effect: Money }`, client event `{ name: 'forecast_horizon_changed'; props: { years: HorizonYears } }` in `ClientFunnelEvent` and `CLIENT_EVENT_NAMES` (not in `FUNNEL_STEPS`).

- [ ] **Step 1: Failing tests** in `schemas.test.ts`: `HorizonYearsSchema` accepts 1, 3, 5, 10 and rejects 0, 2, 7, 15, '10'; the client event schema accepts `{ id, name: 'forecast_horizon_changed', props: { years: 3 } }` and rejects `props: { years: 7 }` and a missing `props`.
- [ ] **Step 2:** `pnpm vitest run packages/types` → FAIL (not defined).
- [ ] **Step 3:** Add the constant (`as const satisfies readonly HorizonYears[]`), type, schema and event, following the existing `withProps(...)` pattern used by `goal_set`.
- [ ] **Step 4:** `pnpm vitest run packages/types` → PASS; `pnpm typecheck` → clean (the events store files may need the new name in exhaustive maps: fix them in this task).
- [ ] **Step 5: Commit** `Horizon picker: horizon constant, explain horizon and event contracts`.

### Task 2: Engine checks at any year

**Files:**
- Modify: `packages/engine/anchors.ts`, `packages/engine/index.ts` (export)
- Test: `packages/engine/anchors.test.ts`

**Interfaces:**
- Produces: `pointAt(f: Forecast, years: number): ForecastPoint` (the month-`12·years` point; RangeError when missing or `years` not a positive integer). `scenarioEffectIssues(candidate, reference, envelope = aiForecastSanity.value, years = 10): string[]` compares `pointAt(·, years).mid` effects; floor `envelope.effectFloor * years / 10`; every message starts with `${years}-year effect`. `forecastSanityIssues` unchanged signature; its tolerance becomes `max(relative × |ref.mid|, floorMonths × year / 10 × takeHomePay)`.

- [ ] **Step 1: Failing tests:**
  - `pointAt` returns `points[36]` for 3, throws RangeError for 0, 1.5 and for 11 on a 121-point forecast.
  - `scenarioEffectIssues(..., undefined, 1)` with rules effect $1,077 at month 12: AI effect $1,150 → `[]`; AI $1,200 → `[]` (ratio ok); AI $300 → one issue containing `1-year effect` and `0.3 times` (fails ratio 1/3, and |diff| 777 > $107.7 floor); AI −$50 → wrong-sign issue. The same AI $300 at years = 10 with a 10-year rules effect $1,077 → `[]` (floor $1,000 covers it).
  - Existing 10-year tests pass unchanged with the default.
  - `forecastSanityIssues`: a candidate whose year-1 mid is `rules.high + 2 × takeHomePay` (and `relative × |mid|` smaller than that) is rejected at year 1 (floor 1.2 months) but the same offset at year 10 is accepted (floor 12 months).
- [ ] **Step 2:** `pnpm vitest run packages/engine/anchors.test.ts` → FAIL.
- [ ] **Step 3:** Implement. Keep `YEARS = 10` for the anchor structure; name the reference horizon `ENVELOPE_REFERENCE_YEARS = 10` for the scaling.
- [ ] **Step 4:** `pnpm vitest run packages/engine` → PASS (all engine tests).
- [ ] **Step 5: Offline replay** (not committed): re-run the 11 recorded answers in `/private/tmp/claude-501/-Users-amir-Coding-personal-projects-zimran-gtbsbe/e2c821ee-9371-466d-9ae9-2adde2694677/scratchpad/demo-results.json` through the new base check: expect 0 rejections (already shown with Python on 2026-11-14).
- [ ] **Step 6: Commit** `Horizon picker: AI checks at any year, floors scaled by horizon`.

### Task 3: Server checks every offered year

**Files:**
- Modify: `apps/web/src/server/ai/forecast.ts` (the scenario-effect loop, ~l.229–238)
- Test: `apps/web/src/server/ai/forecast.test.ts`

**Interfaces:**
- Consumes: `FORECAST_HORIZONS`, `scenarioEffectIssues(…, undefined, years)`.

- [ ] **Step 1: Failing tests** (use the file's existing fake-client helpers):
  - "retries when a scenario's 1-year effect is far off although its 10-year effect is fine": first answer's scenario matches rules at year 10 but has year-1 effect 0.1× rules; second call's prompt contains `1-year effect`; second answer valid → `source: 'ai'`.
  - "falls back to rules when the short-horizon effect stays wrong": both answers like that → rules bundle, two calls.
- [ ] **Step 2:** `pnpm vitest run apps/web/src/server/ai/forecast.test.ts` → FAIL.
- [ ] **Step 3:** Loop `for (const years of FORECAST_HORIZONS)` around the existing per-scenario call, de-duplicating nothing (each year's issue is reported).
- [ ] **Step 4:** Same command → PASS; existing tests unchanged.
- [ ] **Step 5: Commit** `Horizon picker: server checks scenario effects at 1, 3, 5 and 10 years`.

### Task 4: Explanations name the horizon

**Files:**
- Modify: `apps/web/src/server/ai/schemas.ts` (`ExplainRequestSchema` + `horizon`), `apps/web/src/server/ai/explain.ts` (`HORIZON_YEARS` → the request's years; facts label `Change in net worth after N year(s)`; system-prompt wording "the move's N-year change"), `apps/web/src/copy/ai.ts` (template sentences take `years`), `apps/web/src/lib/api/aiExplain.ts` (`ExplainInput.horizon?`, forwarded)
- Test: `apps/web/app/api/ai/explain/route.test.ts`, `apps/web/src/lib/api/aiExplain.test.ts`

**Interfaces:**
- Produces: `ExplainInput = { move?; loanResult?; horizon?: { years: HorizonYears; effect: Money } }`. When `horizon` is present with a move, the facts' change line and allowed numbers use `horizon.effect` and `horizon.years` instead of `move.effect10y` and 10. Loan facts stay 10 years.

- [ ] **Step 1: Failing tests:**
  - Route: a move with `horizon: { years: 3, effect: 3232 }` and no client → template text contains `$3,232` and `in 3 years`, not `10 years`; `years: 1` → `in 1 year`. Without `horizon` the existing text is unchanged.
  - Route: `horizon: { years: 7, effect: 1 }` → 400.
  - Route with a fake client answering a sentence that names `$3,232` and `3 years` → `source: 'ai'`; one naming `$10,773` → rejected and retried (number not in facts).
  - `aiExplain.test.ts`: `horizon` is forwarded in the body.
- [ ] **Step 2:** `pnpm vitest run apps/web/app/api/ai/explain apps/web/src/lib/api` → FAIL.
- [ ] **Step 3:** Implement; copy helper `yearsPhrase(years)` → `1 year` / `N years` in `copy/ai.ts` (reused by Task 6 through `@/copy`).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5: Commit** `Horizon picker: explanations name the chosen horizon`.

### Task 5: Store and view-models

**Files:**
- Modify: `apps/web/src/state/store.ts` (+ `horizonYears`, `setHorizonYears`, persisted via `HorizonYearsSchema`), `features/forecast/model/forecastAnswer.ts`, `useNextMoves.ts`, `useFuture.ts`, `useToday.ts`, `useMoveExplain.ts`, `types.ts`
- Test: `apps/web/src/state/store.test.ts`, `features/forecast/model/forecastAnswer.test.ts`, `forecast.test.ts`, `useForecastBundle.test.ts` (only if a signature it uses changes)

**Interfaces:**
- Consumes: `pointAt`, `HorizonYears`, `FORECAST_HORIZONS`, `ExplainInput.horizon`.
- Produces (renames are deliberate; update every consumer and test):
  - `shownForecast(forecast, todaysDollars, years: HorizonYears): ShownForecast` with `atHorizon: ForecastPoint` replacing `in10y`; `NO_POINT` replaces `NO_IN10Y` (month 0 point is fine: screens show a skeleton).
  - `bandIsZero(source, profile, point)` unchanged semantics.
  - `MoveVM` adds `effect: Money` (scenario − base at the horizon, today's dollars) and `horizonYears: HorizonYears`; ranking uses `effect`; `effect10y` on the move is the 10-year effect from the same answer.
  - `NextMovesVM` adds `horizonYears: HorizonYears`, `horizons: readonly HorizonYears[]`, `setHorizonYears(y)` (tracks `forecast_horizon_changed` with `{ years }` only when the value changes).
  - `FutureVM`: `in10y` → `atHorizon`; `committedPreview: { moveId; point } | null`; `withMove: { moveId; points; point } | null`; `points` and `yearly` cut to months `0..12·years`.
  - `TodayVM`: `in10y` → `atHorizon`, `in10yBandIsZero` → `bandIsZero`, `in10yBandKind` → `bandKind`, adds `horizonYears`.
  - `useMoveExplain` entry key: `(effect, source, horizonYears)`; requests send `horizon: { years, effect }`.

- [ ] **Step 1: Failing tests:**
  - Store: default `horizonYears` is 10; `setHorizonYears(3)` persists; a saved state without the field, or with `7`, hydrates to 10 and keeps the saved profile.
  - `shownForecast(..., 3).atHorizon` equals the deflated month-36 point.
  - Ranking: a constructed answer where move A's effect is larger at 10 years and move B's at 1 year ranks A first at 10 and B first at 1; a move below $1 at 1 year is dropped at 1 year and present at 10; the committed move outside the top 3 takes slot 3 at either horizon.
  - Switching the horizon creates no new forecast request (the request spy's call count is unchanged) and, while the answer is still `isRefreshing`, the screen reads the rules answer at the new year.
  - S1's `topMove` and `atHorizon` follow the store's horizon.
  - Explain: entry from 10 years not shown at 3 years; shown again after switching back; the request body carries `horizon`.
- [ ] **Step 2:** `pnpm vitest run apps/web/src/state apps/web/src/features/forecast/model` → FAIL.
- [ ] **Step 3:** Implement. Rank inside `rankAnswer(answer, live, years)` by computing both effects once per candidate (base points read once).
- [ ] **Step 4:** Same command → PASS; `pnpm typecheck` → only the UI files of Task 6 may fail.
- [ ] **Step 5: Commit** `Horizon picker: remembered horizon, view-models read the chosen year`.

### Task 6: UI, copy and e2e

**Files:**
- Modify: `apps/web/src/copy/forecast.ts`, `features/forecast/ui/FutureScreen.tsx`, `ui/NextMoves.tsx`, `ui/TodayScreen.tsx`, `ui/shared.tsx` (if a helper moves), `apps/web/e2e/forecast.spec.ts`
- Test: `apps/web/src/features/forecast/screens.test.tsx`, `apps/web/e2e/forecast.spec.ts`

**Interfaces:**
- Consumes: the VM fields of Task 5; `Choice` from `@/ui-kit` (radio group styled as segments) with options `1 year`, `3 years`, `5 years`, `10 years`, legend `Look ahead` (copy).
- Copy (functions of `years`, singular at 1): `future.title(y)` "You in N years", `future.headline(y)` "Net worth in N years", `future.chartTitle(y)` "Your net worth over the next N years", `moves.intro(y)` "Ranked by N-year gain, in today’s dollars.", `moves.effect(amount, y)` "+$X in N years", `moves.effectLabel(y)` "Net worth gain in N years", `committedIn10y`/`withMoveIn10y` → `committedAt`/`withMoveAt` (no number of years in them), `today.future.title(y)`, `netWorthAt(y)`, `screens.S10` stays "You in 10 years" only if it names the route in navigation (check; else make it "Your future").

- [ ] **Step 1: Failing tests** in `screens.test.tsx`: S10 renders the radio group with 10 checked; choosing 3 calls `setHorizonYears(3)`; with `horizonYears: 1` the title reads "You in 1 year" and a move reads "+$513 in 1 year"; S1's card title follows `horizonYears`.
- [ ] **Step 2:** `pnpm vitest run apps/web/src/features/forecast/screens.test.tsx` → FAIL.
- [ ] **Step 3:** Implement. The picker sits in the hero above the headline. Keep `data-testid="in10y"` renamed to `data-testid="at-horizon"` and update `e2e/forecast.spec.ts` and `e2e/ladder.spec.ts` selectors.
- [ ] **Step 4:** e2e addition in `forecast.spec.ts`: on S10 click "3 years" → headline text changes, "in 3 years" appears on the first move, and no request to `/api/ai/forecast` is made after the click (`page.on('request')` counter). Runs in CI.
- [ ] **Step 5:** `pnpm test && pnpm lint && pnpm typecheck` → all pass.
- [ ] **Step 6: Commit** `Horizon picker: S10 picker, N-year copy on S10 and S1`.

### Task 7: Docs

**Files:**
- Modify: `docs/ENGINEERING.md` → "AI forecast" (checks at 1/3/5/10 years, scaled floors), `README.md` feature list (horizon picker). Do not touch `docs/DATA.md` or the Deployment section of `docs/ARCHITECTURE.md`.

- [ ] **Step 1:** Edit both; `pnpm lint` → pass.
- [ ] **Step 2: Commit** `Horizon picker: docs`.

### Task 8: Live measurement (before merge)

- [ ] **Step 1:** Using the untracked `zz-demo.eval.ts` pattern (never committed) against the live site's current code, request the 5 variants `demo`, `pay-low`, `card`, `kid`, `sweep-4700` once each (5 model calls at most; cache hits cost none). Save full bundles to the scratchpad.
- [ ] **Step 2:** Replay the new checks (`forecastSanityIssues`, `scenarioEffectIssues` at every horizon, with the AI and rules bundles the script has) offline; report per variant pass/fail and which year fails.
- [ ] **Step 3:** If more than 1 of 5 fail only on short-horizon effects, stop and bring the numbers to the owner before tuning anything.

### Task 9: PR, CI, live check

- [ ] **Step 1:** Push `feat/horizon-picker`, open the PR (no AI attribution), wait for CI green.
- [ ] **Step 2:** After the owner merges and the deploy finishes: on the live S10, switch 1/3/5/10 and confirm the source label, headline and move gains change and no new forecast request is sent; check S1 follows. Report the live model calls made in total.
