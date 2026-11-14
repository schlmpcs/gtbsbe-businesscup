# Future life events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. Owner asked for speed: two large tasks, one final review.

**Goal:** Users add dated future changes (pay, a spending category, one-off cost/income; shortcuts raise / kid / move / big purchase) on S10, and the rules forecast, the AI forecast and every engine consumer follow them.

**Architecture:** `Profile.events` (calendar months) + `Profile.asOf` stamped by the client at read time; `simulate` applies future events month by month; started events are folded into today's values by the store; the server strips events except in `/api/ai/forecast`, whose prompt (v4) explains them.

**Tech Stack:** TypeScript, Zod, Vitest, Next.js, Zustand, Playwright (CI only).

**Spec:** `docs/superpowers/specs/2026-11-15-life-events-design.md` (read it whole: it holds every value and rule; this plan only splits the work and names interfaces).

## Global Constraints

- `MAX_LIFE_EVENTS = 12`; months from next month to `LIFE_EVENT_MAX_YEARS_AHEAD = 30` years ahead; `YearMonth` = `^\d{4}-(0[1-9]|1[0-2])$`.
- Pay and spending event values ≥ 0; one-off `amount` > 0 with `direction: 'cost' | 'income'`; spending `category` excludes `debtPayments`.
- Amounts in today's dollars; pay grows by `incomeGrowthAnnual`, spending and one-offs by inflation, all from month 0.
- Latest start wins on the same field; ties by list order. Estimated event values shift by `estimateSpread` in low/high; `hasEstimates` counts them.
- No user free text reaches the model: events carry kind, category, numbers, `startsInMonths` only (`forecastFacts` drops `id`, `preset`, `asOf`, `month`).
- `PROMPT_VERSION` 4. Checks unchanged in form.
- The server strips `events` before any engine call on a stored profile (avatar). Only `/api/ai/forecast` receives events (+ `asOf`).
- Commits: identity `schlmpcs`, no AI attribution lines, never stage `.superpowers/`. Locally only `pnpm test`, `pnpm lint`, `pnpm typecheck` (no build, no Playwright, no live model calls).

## Review Focus

- A saved profile from before this PR (no `events`/`asOf`) loads and forecasts exactly as before. → Task 1 test (forecast equality with and without `events: []`).
- An event whose month passed while the app was closed is folded on next load, once, with the note; a future one is untouched. → Task 2 test.
- Two events on the same field (raise in 2027, another in 2029) and an event on a category a move patched. → Task 1 tests.
- The AI cache key changes when an event is added/edited and when the month rolls over (same events, `startsInMonths` − 1). → Task 1 test.
- The avatar route with a stored profile that has events does not throw and ignores them. → Task 1 test.

---

### Task 1: Contract, engine, server

**Files:** `packages/types/{index,schemas,constants}.ts` (+ tests), `packages/engine/{simulate,forecast,bundle}.ts` (+ tests; new `packages/engine/events.ts` for `eventStartMonth`/helpers), `apps/web/src/server/ai/{forecast,schemas}.ts` (+ tests), `apps/web/src/server/store/avatars.ts` (+ test), fixtures untouched except where parity tests need `events` absent.

**Interfaces (produces):**
- Types: `YearMonth`, `LifeEvent` (union on `kind`: `pay` {takeHomePay: Estimate<Money>}, `spending` {category: Exclude<CostCategory,'debtPayments'>; monthly: Estimate<Money>}, `oneOff` {amount: Money; direction: 'cost'|'income'}; all with `id`, `month: YearMonth`, `preset?: 'raise'|'kid'|'move'|'bigPurchase'`), `LifeEventSchema`, `YearMonthSchema`, `Profile.events?: LifeEvent[]`, `Profile.asOf?: YearMonth`, constants `MAX_LIFE_EVENTS`, `LIFE_EVENT_MAX_YEARS_AHEAD`, `LIFE_EVENT_KINDS`, `LIFE_EVENT_PRESETS`.
- Engine: `eventStartMonth(asOf: YearMonth, month: YearMonth): number` (clamped ≥ 0); `addMonths(ym: YearMonth, n: number): YearMonth`; `simulate` honours `p.events` (RangeError when non-empty without `asOf`); `cloneProfile` copies `events`/`asOf`; `forecastFacts` returns events as `{kind, startsInMonths, ...values}` and no `asOf`; `withoutEvents(p: Profile): Profile` (drops `events` and `asOf`).
- Server: request schema accepts `events` (≤ 12) and `asOf` on the profile; prompt line + `PROMPT_VERSION = 4`; avatar strips events via `withoutEvents`.

- [ ] Step 1: failing tests (types parity/accept/reject: 13 events, bad month, free-text field, `debtPayments` category, negative pay; engine: each kind before/at/after start, latest-start-wins, tie by order, estimate shift, one-off cost and income, inflation/income-growth from month 0, no-events equality with today, RangeError without `asOf`, `eventStartMonth` across year ends, `forecastFacts` shape and key change on roll-over; a move patch on a category superseded from the event month; server: prompt contains the events line and v4, cache key differs with events, avatar ignores events).
- [ ] Step 2: run → FAIL. Step 3: implement (per-category spending in `simulate`'s loop; events pre-sorted by start). Step 4: `pnpm test && pnpm lint && pnpm typecheck` → green.
- [ ] Step 5: commit `Life events: contract, engine and AI prompt`.

### Task 2: Store, S10 card, copy, e2e, docs

**Files:** `apps/web/src/state/store.ts` (+ test), the single profile-stamping point (selector/accessor) and every web engine call site switched to it, `apps/web/src/features/forecast/model/useLifeEvents.ts` (+ test) and `types.ts`, `features/forecast/ui/LifeEventsCard.tsx` (kit parts only) placed on S10 under the forecast, `apps/web/src/copy/forecast.ts` (or a new `copy/events.ts` exported via `@/copy`), area childcare median helper (in `lib/areas` or engine, with `Source`), analytics event `life_event_added {kind, preset?}`, `apps/web/e2e/forecast.spec.ts`, `docs/ENGINEERING.md` (AI forecast + engine sections), `docs/ARCHITECTURE.md` (Profile contract, S10 row; not Deployment), `README.md` row.

**Interfaces:**
- Consumes Task 1's types and engine functions.
- Store: `addLifeEvent(e)`, `updateLifeEvent(id, e)`, `removeLifeEvent(id)` (13th rejected), `foldStartedEvents(currentMonth: YearMonth): FoldedNote[]` (applies pay/spending value + isEstimate, drops past one-offs, keeps future) run once after hydration and on month roll-over; the folded notes are shown once on S10.
- `useLifeEvents()` VM: `events` (sorted, labelled), `shortcuts` (prefilled: raise = current take-home, kid = area infant childcare or the 60-area median labelled "median of our 60 areas", added to existing childcare, move = current rent, big purchase = empty), `add/update/remove`, `validate`, `foldedNotes`, `dismissFolded`.

- [ ] Step 1: failing tests (store ops + fold + persistence of events, no `asOf` persisted; VM prefill/validation/sorting/labels; screens: card renders, adding a kid changes the headline; S6 life card / sample / reset replace events).
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: e2e on `/future?sample=1`: add a kid from the shortcut, headline changes, reload keeps the event. Step 5: docs. Step 6: `pnpm test && pnpm lint && pnpm typecheck` → green.
- [ ] Step 7: commit `Life events: S10 card, store and docs`.

### Controller steps
- Live measurement: 3 model calls through the eval harness with the new prompt (kid; raise + move; big purchase + income one-off), replay checks; stop and report if 2+ fall back.
- One final review (opus) of the branch; one fix wave.
- PR, CI green, merge (owner's OK), verify live.
