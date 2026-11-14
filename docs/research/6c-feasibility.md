# 6c. Codebase audit and feasibility of the ecosystem features

Audit date: 2026-11-14 (about 17 h before the 2026-11-15 12:00 deadline). Commit `9546f66`. Read-only audit: no tracked file was changed.

## Part 1: current usability

### Commands

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install` | Pass | 4.7 s |
| `pnpm lint` | Pass | `tokens.css is up to date`; ESLint clean (the UI import rule included) |
| `pnpm test` | 1 failure out of 1,283 (1,259 pass, 23 skipped) | `src/server/pro/store.test.ts > file entitlement store > does not keep a grant in memory that it failed to write`. The test `chmod 0500`s a directory and expects the write to fail. The sandbox runs as root (uid 0), and root ignores the permission, so the write succeeds. This comes from the environment, not from a bug, and it should pass in CI (non-root). The skipped tests are the Postgres tests, which need `TEST_STORE_URL`. |
| `pnpm e2e --trace off` | **84 passed, 2 skipped** (phone + desktop) | First run: all 86 failed at `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1255/...`. Playwright 1.65.1 expects browser build 1255, and the image has 1243. I symlinked `chromium*-1255 → chromium*-1243` in `/opt/pw-browsers` (outside the repo) and everything passed. The skipped test is `session.spec.ts` (it needs `NEXT_PUBLIC_SESSION_SOURCE=api` and a store). |

The e2e run used the default build flags: the game on fixtures, sessions in localStorage only, funnel events off. The live server's `.env` decides whether production uses `api`. Those values are not in the repo, so this audit could not check them (see Risks).

### Routes and screens

Classes: **Real** = every number comes from `packages/engine` or a server route. **Fixture-only** = runs real engine code, but only on fixture inputs. **Mock** = labelled preview. **Broken** = does not work.

| ID | Route | Class | Evidence / caveats |
| --- | --- | --- | --- |
| S1 | `/` Today | Real | `useToday` → `forecast`, `monthEnd`, and the committed move. It starts on the **demo profile** (`profileOrigin: 'demo'`, labelled "sample life"). It also lists links to all 15 screens (a dev-style nav; the smoke test expects it). |
| S2–S4 | `/play`, `?stream=1` | Real (engine) / **Fixture-only by default** | `client.ts`: `NEXT_PUBLIC_GAME_SOURCE=api` uses `/api/daily*` (server scores, leaderboard, share PNG). Any other value, including the Dockerfile default `fixtures`, plays `cardsSample` in the browser with the same engine and a localStorage "server" log. In that mode the leaderboard and the `/api/share` PNG have no stored results. |
| S5 | `/me/guess` | Real | |
| S6 | `/me/closest` | Real | `cardToProfile` on today's homes. It falls back to `cardsSample` if the user hasn't played. |
| S7 | `/me/sliders` | Real | |
| S8 | `/me/balance` | Real | |
| S9 | `/me/upload` | Real (bank connect: Mock "coming soon") | Browser CSV parse → mask → `/api/statement/categorize` (AI or keyword rules) → `statementTotals`. **There is no "Try with sample data" / "Use sample statement" button, and the sample CSV is not in `public/`.** A judge without a US bank CSV can't exercise this path. e2e uploads `packages/data/fixtures/statement.sample.csv` with `setInputFiles`. |
| S10 | `/future` | Real | `forecast` + `rankMoves`. Level 2 moves are a locked preview ("coming soon"). |
| S11 | `/afford` | Real | `canAfford`, `/api/ai/parse`. Saving to the wishlist is the one real Pro gate (`POST /api/session` 402 when the session API is on; otherwise the browser hides the button). |
| S12 | `/loan` | Real (starts from fixture offers) | `compareLoans`, `loan`, `payoffOrder`. The first 3 offers come from `loanOffers.sample.json`, and the user can edit them. |
| S13 | `/decide` | Mock label, real math | `evaluateDecision` runs the engine's `forecast`/`simulate` (keep the car vs lease) on the user's profile. The lease terms start from a labelled fixture. "Next decisions" (move, kid, job offer, wedding) are **dead "coming soon" chips**. Nothing is saved. |
| S14 | `/checkin` | Mock label, real math | `useCheckin` runs `monthEnd` on the user's uploads, or on `statementTotalsSample` (labelled "Sample statement"), plus `moveProgress` (engine `simulate`). "Yes, I did it" really applies the patch (`markMoveDone`). "Not yet" says "Next month's check-in asks again", but **there is no reminder or schedule**, and the spending "actual" exists only with a finished uploaded month. |
| S15 | `/pro` | Real (test mode) | `/api/pro/checkout` creates a Stripe Checkout in `mode: 'subscription'` (needs `sk_test_` on the server). `/api/pro/confirm` checks that the session is test-mode, paid and owned by this anonymous ID. The promo code goes through `/api/pro/demo-unlock`. **Yearly is already the default** (`useState<ProPlan>('yearly')`, "Best value" badge). The "Coming to Pro" list promises features that don't exist yet: cross-device save, monthly check-ins, decision journal, Loan Lab history, move levels. There is **no cancel, pause, renewal date or manage screen**. |
| — | `/kit` | Dev showcase | noindex, not in the nav. |

No route is **Broken** in the local production build.

### Funnel, Stripe, sample data

- **Funnel events:** they exist. There are 15 client events (`CLIENT_EVENT_NAMES`) and 3 server events (`checkout_started`, `pro_purchased`, `pro_promo_redeemed`). `POST /api/events` and `GET /api/events/funnel` are backed by migration 004. Events are **off by default** (Dockerfile `NEXT_PUBLIC_EVENTS_SOURCE=off`) and on only when the server `.env` sets `api`. CI builds with `api`.
- **Stripe test checkout:** it exists (see S15). It is available only when the server has an `sk_test_…`/`rk_test_…` key. Otherwise the screen says so, and the promo code still works.
- **"Try with sample data":** there is no explicit button. The app silently starts on the demo profile, and `/checkin` offers a "Sample statement" toggle. `/me/upload` has no sample option.

### Risks that matter more than new features

1. **Production flags.** Unless the server `.env` sets `NEXT_PUBLIC_GAME_SOURCE=api`, `NEXT_PUBLIC_SESSION_SOURCE=api` and `NEXT_PUBLIC_EVENTS_SOURCE=api`, the live game runs on browser fixtures: no server scoring, an empty leaderboard, share PNGs that 404, no saved sessions and no funnel data. That weakens the "not faked" score. Check the live site's network tab or `/api/health` before anything else.
2. **No sample CSV for judges** on S9 (about 0.5 h to fix: copy the fixture to `public/`, add a "Use our sample statement" button that feeds the same `readFile` path).
3. **Promises without features:** the Pro "Coming to Pro" list, "Next month's check-in asks again", the S13 next-decision chips and the Level 2 "coming soon" text. Either build them or cut the wording.
4. The Playwright/Chromium revision mismatch exists only in this sandbox. CI installs its own browsers.

## Part 2: feasibility of the proposed ecosystem features

Estimates are for one of the two devs who already knows the code. They include engine tests and copy, but not the Figma skin. "Real" means every number comes from the engine or Stripe, with no hardcoded result.

### 1. Decision calendar (Black Friday → Afford, tax refund → moves, lease renewal → rent forecast, car payoff → Loan Lab) + `.ics` monthly check-in

- **Exists:** `canAfford` (S11), `rankMoves` (S10), `forecast` (rent line inflated by `inflationAnnualOf(area)`), `simulate(...).payoffMonth[debtId]` (already used in `useDecide` for the months left on the auto loan), `loan`/`compareLoans` (S12).
- **Missing:**
  - A `features/calendar` model that turns these into dated items. The dates are computed in the model, since the engine has no `Date`.
  - Black Friday: Nov 27, 2026 (fixed rule: 4th Thursday of November + 1).
  - Tax refund: an IRS-season window, Feb–Apr. Any refund amount must be typed by the user, never invented.
  - Lease renewal: needs a user-entered date. The Profile has no lease date, so add a local-only field or ask inline.
  - Car payoff: today + `payoffMonth` months.
  - Deep links that prefill S11/S12. Today the afford and loan hooks don't read query params, so that needs adding.
  - A client-side `.ics` generator (`VEVENT` + `RRULE:FREQ=MONTHLY`, Blob download). No library is needed, and no `.ics` code exists today.
- **Hours:** 5–7.
- **Real by deadline:** Yes. Every amount comes from existing engine calls. The dates are calendar rules, the profile's own debts, or user input. Only the tax refund amount must stay user-entered.

### 2. Real monthly check-in: "Fast-forward 1 month (demo)"

- **Exists:**
  - `useCheckin` already runs engine `monthEnd(profile, history, current)` and `moveProgress` (`simulate`, `applyPatch`). `checkinMonthInputs`, `compareOf` and `nextMonth` helpers are there.
  - `markMoveDone` applies the move's patch.
  - `simulate` returns month-by-month cash, debts and surplus. `path[1]` is exactly "one month later".
  - The store keeps `statementMonths: CategoryTotals[]` and merges new months (`mergeStatementHistory`).
- **Missing:**
  - (a) An engine function, e.g. `simulateMonthSpending(p, month, seed): CategoryTotals`. It would use a seeded PRNG (the engine has none today; ENGINEERING.md allows `Math.random` only with a seed) and per-category noise bounded by the `estimateSpread` / the monthEnd spread rules, with tests.
  - (b) Advance the profile one month from `simulate(p,1).path[1]` (cash, retirement, debt balances).
  - (c) A "Fast-forward" action in the store that appends the generated month to `statementMonths`, tagged `simulated: true`. The `CategoryTotals` contract would need an optional flag, which is a `packages/types` change agreed by both devs.
  - (d) Show "forecast (profile) vs actual (generated)", and let `moveProgress` use the generated month for `spendingTarget.actual`. It is gated on `source === 'uploads'` today.
  - (e) Persist a check-in log (date, move answer).
- **Hours:** 6–8.
- **Real by deadline:** Yes, if it is labelled honestly. The numbers come from deterministic engine code, but the "actual" month is synthetic. It must say "simulated month (demo)" and never be mixed with real uploads. Otherwise it reads as fake to judges.

### 3. Subscription audit (swipe keep/cut, 10-year cost each, feeds ranked moves)

- **Exists:**
  - `subscriptions` is a `CostCategory`. The keyword rules (`server/statement/rules.ts`) and the LLM prompt both classify subscriptions.
  - `statementTotals` sums per category.
  - The store sets `subscriptionsDetected` when any month has subscriptions.
  - `rankMoves` offers `cancelSubscriptions`, a flat 50% cut (`cancelSubscriptionsShare`).
- **Missing:**
  - The categorize response returns **only category totals**, so there is no per-merchant list. Add `recurring: { label, monthly, monthsSeen }[]` for subscription-class lines. It can be computed in the engine next to `statementTotals` with `merchantKey`, since the day of month is already sent for recurrence. That is a contract change in `packages/types` plus the route.
  - Keep it in the browser only, so the privacy rules hold: labels are already masked and are not persisted.
  - An engine helper for the 10-year cost of a line, as `forecast(applyPatch(p, {spending:{subscriptions: v − line}})).in10y.mid − base`, the same method as moves.
  - A `rankMoves` option (e.g. `subscriptionCut?: Money`) so the move uses the user's actual cut list instead of 50%.
  - The swipe UI.
  - Without an upload there is nothing to audit, so it needs the S9 sample-statement button. The sample CSV has subscription lines.
- **Hours:** 6–8 (about 3 of them for the contract, engine and route).
- **Real by deadline:** Yes, but it is the riskiest of the data features, because it touches the shared contract and Aibek's route.

### 4. Wishlist countdown ("affordable in N months")

- **Exists:**
  - The wishlist (store `WishlistItem[]`, Pro-gated save).
  - `canAfford` returns `verdict: 'wait'` with `waitMonths`, but only searches k = 1..`AFFORD_MAX_WAIT_MONTHS` = 12. Beyond that the answer is "no".
- **Missing:**
  - An engine option such as `canAfford(p, x, { maxWaitMonths })`, or a separate `affordableIn(p, x, max = 60)` that reuses the wait search, with tests.
  - Run it for each wishlist item in `useAfford` and show "in N months / now / not within 5 years".
  - A cost note: about 10-year simulations × k per item. A 60-month search is fine in the browser for a handful of items. Memoize it.
- **Hours:** 2–3.
- **Real by deadline:** Yes. It is the cheapest feature here. Judges unlock Pro with the promo code to save items.

### 5. Value receipt before renewal

- **Exists:**
  - Each `Move` carries `effect10y`.
  - `doneMoveIds` and `committedMove` are in the store.
  - The entitlement has `plan` + `since`, so the next renewal date can be derived (since + 1 year or 1 month).
- **Missing:**
  - Store each done move's `effect10y` and its monthly patch delta **when it is marked done**. Today only ids are kept, and re-deriving the effect later gives a different number.
  - An engine `valueReceipt(...)` that sums them: 10-year effect, monthly cash freed, card payoff months saved (from `simulate`).
  - Check-ins done, afford checks run (local counters or funnel events).
  - A receipt card on `/pro` (Pro active) or S1, near the renewal date.
  - On a fresh session it is honestly $0. Pair it with #2 so the demo shows a non-zero receipt.
- **Hours:** 3–4.
- **Real by deadline:** Yes. The "value" is the engine's 10-year effect of the moves the user actually took, not a dollar figure for Pro.

### 6. Shareable decision link (Path A vs B, e.g. Loan Lab compare) for a partner, no login

- **Exists:**
  - The share infrastructure to copy is game-only: a random 128-bit `resultId`, `store.game.findResult`, `/api/share` rendering a `next/og` PNG from stored data so it can't be faked, and the rule that anonymous IDs never go in URLs.
  - `compareLoans` and `evaluateDecision` (S13) are pure, so a recipient can recompute from inputs.
- **Missing, option A (fast, about 3–4 h):** encode the comparison inputs (offers, the relevant profile fields) in the URL **fragment** (`#…`, never sent to the server). Add a `/share/decision` page that recomputes with the engine in the recipient's browser, plus a "this contains your numbers" consent line. No backend and no storage. It doesn't produce an OG image.
- **Missing, option B (about 7–9 h):** migration 005 `decisions` table (random id, inputs JSON, created_at), `POST /api/decisions` + `GET` by id, a page that recomputes from stored inputs, and an OG image. It stores financial inputs, so it needs a privacy review and new "What we keep" wording.
- **Real by deadline:** Option A, yes. Option B is possible but competes with everything else.

### 7. Annual plan default, pause instead of cancel, one-click cancel

- **Exists:**
  - **The annual default is already done** (`plan` defaults to `'yearly'`, "Best value" badge, prices in `PRO_PRICES`).
  - Checkout uses `mode: 'subscription'` in test mode.
  - `EntitlementStore` has `get`, `grant` and `claimSession`.
- **Missing:**
  - The subscription id is not stored. Read `session.subscription` in `/api/pro/confirm` and save it (additive migration 005 column, or a new table).
  - `EntitlementStore.revoke`/`setPaused`.
  - Routes `POST /api/pro/cancel` (`stripe.subscriptions.update(id, { cancel_at_period_end: true })` or `cancel`) and `POST /api/pro/pause` (`pause_collection: { behavior: 'void' }`).
  - For promo-code grants (no Stripe subscription), do a local revoke or pause.
  - A `ProActive` "Manage" block with renewal date, Pause 1 month (primary) and Cancel (one click, no dark pattern).
  - Tests against the Stripe stub in `server/pro/testUtils.ts`.
- **Hours:** 4–5 (pause and cancel). The default plan takes 0 h.
- **Real by deadline:** Yes, in Stripe test mode, but only if the server has a test key. Otherwise only the promo-grant path can be shown.

### Summary table

| Feature | Exists | Missing | Hours | Real by deadline? |
| --- | --- | --- | --- | --- |
| 1. Decision calendar + .ics | canAfford, rankMoves, forecast, simulate.payoffMonth, loan | date model, S11/S12 prefill params, lease-date input, .ics generator | 5–7 | Yes (refund amount user-entered) |
| 2. Fast-forward check-in | useCheckin + monthEnd + moveProgress, simulate path[1], statementMonths | seeded engine month generator, profile advance, `simulated` flag in contract, check-in log | 6–8 | Yes, if labelled "simulated month" |
| 3. Subscription audit | subscriptions category, rules + LLM classify, cancelSubscriptions move | per-merchant recurring list in categorize response (contract change), per-line 10-y cost, rankMoves cut option, swipe UI, S9 sample button | 6–8 | Yes, riskiest |
| 4. Wishlist countdown | wishlist, canAfford waitMonths (≤ 12) | longer wait search option, per-item display | 2–3 | Yes |
| 5. Value receipt | Move.effect10y, doneMoveIds, plan + since | record effect at done time, engine sum, receipt card | 3–4 | Yes (pair with #2) |
| 6. Shareable decision link | game resultId/share/next-og pattern, pure compareLoans/evaluateDecision | fragment-encoded link + recompute page (A), or decisions table + routes (B) | 3–4 (A) / 7–9 (B) | A yes, B tight |
| 7. Annual/pause/cancel | yearly default done, test-mode subscription checkout | store subscription id, cancel/pause routes, revoke in store, manage UI | 4–5 | Yes (needs sk_test on server) |

Total if every feature were built: about 30–40 dev-hours, against about 2 × 17 h minus the deck, rehearsal and sleep. That does not fit. A suggested order:

1. Verify the production flags and add the S9 sample button (≤ 1 h; this protects the 40% score).
2. #4 wishlist countdown.
3. #7 pause/cancel.
4. #2 fast-forward check-in + #5 value receipt (they share the data).
5. #1 calendar.
6. #6 option A.
7. #3 last, or cut it.
