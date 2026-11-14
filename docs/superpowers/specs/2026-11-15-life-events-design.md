# Future life events: design

Date: 2026-11-15. Owner: Amir. Second of three forecast features (after the horizon picker, #108; before 15–30 year horizons).

## Intent

A forecast that only knows today's numbers is wrong for anyone who knows a change is coming: a raise next year, a kid in 2028, cheaper rent after a move, a wedding. The user adds dated changes and the whole app (rules forecast, AI forecast, Next Moves, Goals, Can I Afford It?, Loan Lab, overpaying) plans with them. It is also a demo moment: add "a kid in 2028" on S10 and watch the line bend.

## Goals

- The user adds, edits and removes up to 12 future events on S10 ("Coming up" card), each with a calendar month.
- Three kinds: **pay** (take-home becomes X from a month), **spending** (a category's monthly amount becomes X from a month), **one-off** (a single cost or income in a month). Shortcuts: **raise** (pay), **kid** (childcare spending, prefilled from the area's childcare cost), **move** (rent and utilities spending), **big purchase** (one-off cost).
- Every engine consumer follows the events with no per-screen wiring, because events live on the `Profile`.
- The AI forecast sees the events and is checked against a rules forecast that includes them.
- Free (not Pro-gated).

## Non-goals

- A new debt starting at a date (a loan from month N). Debts already end on their own when paid off.
- Parsing events from typed text ("Describe your life").
- Recurring events other than "from this month on" (e.g. a raise every year), events that end (childcare stopping at school age), or relative events ("when the card is paid off").
- Horizons beyond 10 years (feature 3); events may be dated up to 30 years ahead so feature 3 can use them, and an event past the shown horizon simply has no effect within it.

## Anti-goals

- Free text from the user reaching the model (rule 6): events carry kinds, categories and numbers only, never a typed label.
- A number shown that ignores the events (one screen with events, another without).
- Events that drift: an event saved as "January 2028" must stay January 2028 when the user returns next month.

## Approaches considered (owner's picks marked)

- Storage: **on the `Profile` (picked)** vs a separate list sent only with the forecast (smaller change, but Goals, Afford and moves would ignore events until wired one by one).
- Kinds: **3 kinds + shortcuts (picked)** vs adding a new debt (more fields, more for the AI to get wrong) vs shortcuts only (least flexible).
- Dates: **calendar month (picked)** vs months from now (drifts later each month).
- Input: **a card on S10 (picked)** vs its own screen under Your numbers vs S10 card plus typed sentences.

## Design

### Contract (`packages/types`)
- `YearMonth = string` matching `^\d{4}-(0[1-9]|1[0-2])$`.
- `LifeEvent` (discriminated on `kind`, each with `id: string` (client-made, ≤ 64 chars) and `month: YearMonth` and optional `preset?: 'raise' | 'kid' | 'move' | 'bigPurchase'` (for the label only)):
  - `{ kind: 'pay'; takeHomePay: Estimate<Money> }`: monthly take-home from that month (absolute, ≥ 0: $0 models quitting or unpaid leave).
  - `{ kind: 'spending'; category: CostCategory; monthly: Estimate<Money> }`: that category's monthly amount from that month (absolute, ≥ 0: $0 models a cost ending, e.g. childcare or a car payment). `category` excludes `debtPayments` (debts are modelled as debts).
  - `{ kind: 'oneOff'; amount: Money; direction: 'cost' | 'income' }`: one amount in that month, `amount > 0`.
- `Profile.events?: LifeEvent[]` (absent = none; max 12) and `Profile.asOf?: YearMonth`: the calendar month the profile's "today" values describe, i.e. forecast month 0. `asOf` is stamped by the client when the profile is used (the current local month) and is required by the engine whenever `events` is non-empty.
- Schemas, the type/schema parity test, `cloneProfile`, and the demo fixture (no events) updated together (rule 3). `MAX_LIFE_EVENTS = 12`, `LIFE_EVENT_MAX_YEARS_AHEAD = 30`.

### Engine (`packages/engine`)
- `eventStartMonth(asOf, month): number` = whole months from `asOf` to `month`. The engine only ever sees future events (started ones are folded into today's values by the client, below); defensively, a month ≤ `asOf` is clamped to 0.
- The engine requires `asOf` only when `events` is non-empty (RangeError otherwise).
- `simulate` applies events inside its monthly loop:
  - Event amounts are in **today's dollars**, like every other amount in the app: "$6,000 from Jan 2028" means $6,000 in today's money, grown by the same index from month 0 (pay by `incomeGrowthAnnual`, spending and one-offs by inflation).
  - pay: the base take-home becomes the event's value from its start month.
  - spending: that category's base becomes the event's value from its start month, inflated with prices like today's spending. Spending becomes a per-category sum (it is a single scalar today).
  - one-off: in its start month, cost is paid like a cash purchase (`payWith: 'cash'`, inflated to that month); income adds to cash.
  - Several events on the same field: the latest start wins from its month; ties resolve by list order.
  - Estimates: an event value with `isEstimate: true` is shifted by `estimateSpread` in the low/high scenarios, exactly like today's estimated fields; `hasEstimates` counts event values.
- Moves (`applyPatch`) change today's values only. A later spending or pay event on the same field replaces the patched value from its month: a "spend less on rent" move stops counting once a move event sets new rent. (Documented; no special casing.)
- `forecastFacts(p)` keeps the events but replaces each `month` with `startsInMonths` (from `asOf`) and drops `asOf`, `id` and `preset`: what the model sees, and what the cache key covers. The same events therefore produce a new key each calendar month, which is correct (they are a month closer).

### Started events fold into today (owner, 2026-11-15)
- When an event's month arrives (its `month` ≤ the current local month), the client applies it to today's values and removes it: pay sets `takeHomePay`, spending sets `spending[category]` (value and `isEstimate` from the event), a one-off is simply removed (it is in the past). This runs once on app load after hydration and again when the month rolls over while open, in one store action `foldStartedEvents(currentMonth)`. S10 shows a one-line note for what was folded ("Your raise started, so we updated your take-home"). Session sync then saves the folded profile.
- So later edits (Your numbers, statement uploads) work as today, every screen that reads today's values directly (month-end, Loan Lab debt load, Next Moves candidate sizing, goal saving cap, the AI envelope floor, the avatar) agrees with the forecast, and a move on that field is not overridden from month 0.

### Server-side engine calls (owner, 2026-11-15)
- The server never stamps `asOf` and never applies events: wherever the server simulates a stored profile itself (today: the avatar's `coarsenAvatar` in `server/store/avatars.ts`), it strips `events` first. The avatar shows today's monthly cost.
- `/api/ai/forecast` is the exception: the client sends the stamped profile (`asOf` + future events), so the model and the rules reference both include them.

### Server AI
- Request schema accepts `events` and `asOf` on the profile (≤ 12 events; numbers capped as today; ids match the existing id pattern).
- Prompt: one fact line explaining events ("`events`: changes the person expects, in today's dollars; `startsInMonths` counts from now; pay and spending values replace the current amount from that month; one-offs happen once") and `PROMPT_VERSION` 4.
- Checks unchanged in form; the rules reference now includes events, so the envelope and effect checks compare like with like.

### Client
- Store: `addLifeEvent(event)`, `updateLifeEvent(id, event)`, `removeLifeEvent(id)` on the profile (rejecting a 13th). Session sync carries them inside the profile (no schema change at the session level beyond the profile's).
- One place stamps `asOf` (current local month, `lib/dates`) on the profile every consumer reads (a `useProfile()`-style selector or the existing profile accessor); every engine call site reads the stamped profile.
- View-model `useLifeEvents` (S10): the list (sorted by month, each with a label from kind/preset/category, its month, its value), shortcuts with prefilled values, add / edit / remove, the "folded" note, validation (month from next month to 30 years ahead; pay and spending ≥ 0, one-offs > 0; all ≤ the existing per-field caps).
- My calls: replacing the whole profile (a life card on S6, "Try with sample data", reset) replaces its events too; only future events can be added or edited (a started one is already folded).
- Kid shortcut: childcare prefilled from the area's `childcareMonthly.infant` for the profile's zip; when the zip is missing or not one of the 60 areas, the median of the 60 areas' infant figure, labeled "median of our 60 areas" with their `Source` (owner, 2026-11-15). Always `isEstimate: true`. If childcare already has a value, the prefill is that value plus the infant figure (my call: a second kid adds to the first).
- Analytics: `life_event_added` with `{ kind, preset? }` (the funnel mask has 64 slots since #108).

### UI
- S10 "Coming up" card under the forecast, kit parts only (Kiko has no frame yet): four shortcut buttons, a list of events, an inline form (month picker, amount, category for "other spending change", cost/income for one-offs), and "Remove". Copy in `src/copy`. The chart and headline update on every change (rules at once, AI after the usual wait).
- Elsewhere events show only through their effect; Goals, Afford and the ladder preview need no UI change.

### Testing and verification
- Engine: each kind at its start month (before / at / after), latest-start-wins, RangeError for events without `asOf`, estimate shifting of event values, one-off cost and income, `forecastFacts` offsets, `eventStartMonth` across year ends.
- Consumers: a goal reached sooner with a raise; Can I Afford It? verdict changed by a kid; move ranking with an event on the cut category.
- Server: events in the prompt, cache key changes with events and with `asOf`, schema rejects a 13th event, a free-text field, a bad month.
- Store: `foldStartedEvents` folds pay/spending (value + isEstimate), drops past one-offs, leaves future events, runs after hydration; the server strips events before the avatar's simulate.
- View-model and screens: add/edit/remove, shortcut prefill (area figure, median fallback, second kid), validation ($0 allowed for pay/spending), the folded note, persistence and session round trip.
- e2e: add a kid on S10, headline changes, reload keeps it.
- Live: the deployed code has the old prompt, so before merge the measurement calls the model through the eval harness with the new prompt (about 5 calls: kid, raise, move, big purchase, all four; counted and reported) and replays the checks; stop and report to the owner if more than 1 of 5 falls back to rules. After deploy, verify on the live site.

## Builder check (2026-11-15)
A fresh reviewer read this as a builder. Its four open questions (started events, server engine calls and `asOf`, $0 values, kid fallback) were answered by the owner and are written in above; the items it could decide itself are marked as my calls.

## Left to the builder
- Component layout and file names inside the feature folder; the month picker primitive (native `<input type="month">` is acceptable).
- How the stamped profile is provided (selector vs accessor), as long as there is exactly one stamping point.
