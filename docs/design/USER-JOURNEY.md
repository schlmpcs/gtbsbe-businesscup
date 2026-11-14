# LifeGuessr · User journey and frontend/backend contract

**Status:** designs done in Figma (file `OzBZZ1yd1o61NDYySGP3Pm`, pages "S1–S3 · Duel (design)" and "Duel flow (Nov 14)"). This doc lists every screen, every button, where it goes, and what the backend must provide, so the frontend and backend can be built in parallel.

**Audience:** frontend (screens + view-models), backend (routes + engine), anyone generating UI from the Figma frames.

**Legend**

| Tag | Meaning |
|---|---|
| `EXISTS` | Checked against `origin/main` on 14 Nov 2026: the route, function, type or event is in the repo |
| `CHANGE` | Exists, but this journey needs it changed |
| `NEW` | Must be built |

Related: `CLAUDE.md` (rules), `docs/ARCHITECTURE.md` (routes, contracts), `docs/research/7-decisions-and-screens.md` (decisions D-1…D-7), issues #69 (goal) and #77–#91 (micro-tools).

---

## 0. Ground rules

1. **No login.** A user is an anonymous `anonId` (`crypto.randomUUID()` in the browser, first visit). It travels in the body or the `x-anon-id` header, never in a URL. `EXISTS`
2. **Code does the math, AI does language.** Every number on screen comes from `packages/engine`. LLMs only parse text, categorize merchant labels and write explanations. An LLM never produces a number shown as a result.
3. **The UI is replaceable.** `apps/web/src/features/*/ui/*` = props in, events out. It imports only `@/ui-kit/**`, `@/copy` and `../model/types` (lint rule). All copy lives in `src/copy/*`.
4. **Fixtures first.** Each screen works on `packages/data/fixtures/*` before it is wired to an API.
5. **Every number has a `Source` or `isEstimate: true`.**
6. **Privacy.** CSVs are parsed in the browser. The server receives only `{label (names masked), amount, month, day}` per line for categorizing; only category totals are stored.
7. **Wording.** "Educational simulation, not financial advice." Never name lenders, investments or providers. Never tell the user what to cancel.
8. **Events.** Every key action sends a typed event through `track()` (`apps/web/src/lib/events.ts`) to `POST /api/events`. New event names must be added to `ClientFunnelEvent` in `packages/types/index.ts`.
9. **Dead buttons are hidden** (FAQ Q85): if a button's backend isn't ready, the button isn't rendered.

### Existing events (`EXISTS`, `packages/types/index.ts`)

Client: `play_started`, `clue_opened`, `home_guessed`, `game_finished`, `result_shared`, `own_guess_submitted`, `closest_life_chosen`, `sliders_adjusted`, `balance_sheet_edited`, `statement_applied`, `forecast_viewed`, `move_committed`, `afford_checked`, `loan_compared`, `paywall_viewed`.
Server: `checkout_started`, `pro_purchased`, `pro_demo_purchased`, `pro_promo_redeemed`.
Funnel steps (`FUNNEL_STEPS`): `play_started → game_finished → own_guess_submitted → sliders_adjusted → balance_sheet_edited → statement_applied → forecast_viewed → paywall_viewed → pro_purchased`.

### New events (`NEW`)

`sample_loaded`, `duel_picked`, `hint_opened`, `challenge_copied`, `own_guess_started`, `little_things_revealed`, `little_things_added`, `overpaying_checked`, `checkin_simulated`, `checkin_saved`, `calendar_downloaded`, `pro_paused`, `pro_cancelled`, `decision_shared`. Props carry enums and counts only, never amounts.

---

## 1. Map

```
S1 Today
 ├─ Play ─────────────────► S2 Duel ×5 ─► S3 Reveal ×5 ─► Day result ─► S5…S9 Onboarding ─► S10
 └─ Try with sample data ──────────────────────────────────────────────────────────────────► S10 (sample profile)

S10 You in 10 years
 ├─ Moves (Add to my plan)
 ├─ S21 Little things ─┐
 ├─ S23 Overpaying ────┼─► back to S10 with the move added
 ├─ S11 Afford · S12 Loan Lab · S13 Decide
 └─ Go Pro ─► S15 Paywall ─► S27 Manage Pro

Return loop:  .ics reminder ─► S14 Check-in ─► S10
Share loop:   S3 Day result ─► challenge link /play?c=… ─► friend plays
              S12 Loan Lab ─► /d/[id] (S29) ─► partner ─► S1
```

| ID | Screen | Route | Status today | Build order |
|---|---|---|---|---|
| S1 | Today | `/` | `EXISTS`, needs first-visit state | 1 |
| S2–S3 | Duel + reveal + day result | `/play` | `CHANGE` (slider game → duel) | 1 |
| S5–S9 | Onboarding | `/me/guess`, `/me/closest`, `/me/sliders`, `/me/balance`, `/me/upload` | `EXISTS` | 2 (small changes) |
| S10 | You in 10 years + goal + moves | `/future` | `EXISTS`, goal is `NEW` (#69) | 2 |
| S21 | Little things (subscriptions + habits) | `/tools/subscriptions` | `NEW` (#79, #80, #81) | 3 |
| S14 | Monthly check-in | `/checkin` | `CHANGE` (preview → real) | 4 |
| S15 | Go Pro | `/pro` | `EXISTS` | 5 (copy changes) |
| S27 | Manage Pro | `/pro/manage` | `NEW` | 5 |
| S23 | Overpaying check | `/tools/overpaying` | `NEW` (#86, #87) | 6 |
| S11 / S12 / S13 | Afford / Loan Lab / Decide | `/afford`, `/loan`, `/decide` | `EXISTS`, small changes | 6 |
| S16 | Leaderboard | `/leaderboard` | page `NEW`, API `EXISTS` | after the cut line |
| X4, S28, S29 | Habit duel, Calendar, Shared decision | `/play`, `/calendar`, `/d/[id]` | `NEW` | after the cut line |

**Figma frame names on page "Duel flow (Nov 14)" use older numbers:** "S16 · Guess/Reveal/Keep or cut" = S21 Little things, "S17 Manage Pro" = S27, "S18 Decision calendar" = S28, "S19 Shared decision" = S29. The IDs in this doc follow issues #77–#91.

---

## 2. Global UI

| Element | Behavior | Backend |
|---|---|---|
| Header nav | Today `/` · Play `/play` · My future `/future` · Can I afford it? `/afford` · Loan Lab `/loan` · **Go Pro** `/pro` (becomes "Pro" pill when active) | `GET /api/pro/status` `EXISTS` |
| Footer | "Educational simulation, not financial advice." | — |
| Sample banner | On every screen while the sample profile is active: "You're looking at a sample life. Use mine →" → `/me/guess` | session flag `isSample` `NEW` |
| Estimates badge | Any number from defaulted fields shows an "estimate" tag | `isEstimate` `EXISTS` |
| Loading | Skeletons; never a fake number while loading | — |
| Errors | Inline "Couldn't load. Try again" with retry; the API error codes (`bad_request`, `rate_limited`, `unavailable`, …) map to copy in `src/copy/errors.ts` | `EXISTS` |

---

## 3. Screens

### S1 · Today · `/`

**Goal:** a judge with no context understands the app in 3 seconds.

| State | Condition | Shows |
|---|---|---|
| First visit | no profile, no game today | Headline "Which life costs more?", one sentence, **Play**, **Try with sample data**, "No sign-up, about a minute", 3 steps (Play 5 quick duels → Price your own month → See you in 10 years), duel preview art. **No user numbers.** |
| Played today | game finished, no profile | Day score, "Price my own month →" |
| Has profile | profile saved | Streak pill, "This month: $X projected" (`monthEnd`), card linking to S10 |
| Check-in due | Pro, first visit in a new month | Banner "Time for your check-in" → `/checkin` |

| Button | Goes to | Backend | Event |
|---|---|---|---|
| Play | `/play` | — | `play_started` `EXISTS` |
| Try with sample data | `/future?sample=1` | Load `profile.demo.json` as the session profile with `isSample: true` `NEW` | `sample_loaded` `NEW` |
| Price my own month → | `/me/guess` | — | `own_guess_started` `NEW` |
| Time for your check-in | `/checkin` | — | — |

### S2 · Duel round · `/play` (`CHANGE`, decision D-1)

**Goal:** a 10-second pick. Two lives, one question: "Which life costs more?"

**Data:** `GET /api/daily` `CHANGE` → today's 5 duels, the same for everyone, seeded by the New York date. Today it returns `PublicCard`s for the slider game; it must return duels instead (keep the old shape behind a flag until the duel ships).

```ts
// packages/types — NEW
type PublicDuel = {
  date: string;                       // YYYY-MM-DD, America/New_York
  round: 1 | 2 | 3 | 4 | 5;
  kind: 'life' | 'habit';             // 'habit' = X4, after the cut line
  cards: [PublicDuelCard, PublicDuelCard];
};
type PublicDuelCard = {
  letter: 'A' | 'B';
  household: string;                  // "2 adults · 1 kid · 3 bedrooms"
  metro: string;                      // "Columbus, OH"
  caption: string;                    // flavor line, no cost facts
  facts: string[];                    // 4 chips: "1 car", "Daycare", "Cooks at home", "Rent"
  art: SpriteId;                      // house render id
  composite: true;                    // UI shows a "Composite" label
};                                    // NO totals and NO hint on the client before pick/hint
```

| Action | Result | Backend | Event |
|---|---|---|---|
| Tap card A or B | Instant pick, no confirm → S3 | `POST /api/daily/pick { anonId, date, round, choice }` → `PickResult` `NEW`. Server holds the answers and scores. One pick per round per `anonId`; a second pick returns the stored result. | `duel_picked { round, correct }` `NEW` |
| Hint ("1 more fact each, −10% points") | Shows `hintFact` (neighborhood/ZIP tier) on **both** cards; "now worth 900 points" | `POST /api/daily/hint { anonId, date, round }` → `{ A: string, B: string }` `NEW` (can reuse the clue log behind `/api/daily/clue` `EXISTS`). Multiplier −10% per hint, floor 50% (`clueCost`, `clueFloor` `EXISTS` in engine). | `hint_opened { round }` `NEW` |
| Round dots | 5 dots, current highlighted | — | — |

States: default · hint used · already picked this round (show S3) · already played today (Day result) · loading · error with retry.

### S3 · Reveal (state of `/play`)

```ts
// packages/types — NEW
type PickResult = {
  resultId: string;                   // like GuessReveal.resultId (EXISTS) — used by share + challenge
  correct: boolean;
  points: number;                     // 1000 × multiplier, 0 if wrong
  totals: { A: Money; B: Money };     // costOfLife(card).total.mid, per month
  breakdown: { A: CategoryLine[]; B: CategoryLine[] }; // 5 categories, each with Source
  decidedBy: { category: CostCategory; A: Money; B: Money }; // biggest gap toward the costlier card
  lesson: string;                     // fixed template filled by code, never an LLM
  crowd: { pickedA: number; total: number } | null;     // null when total < 20
};
```

| Element | Rule |
|---|---|
| Result pill | Right: "Right! +1,000 points". Wrong: "Not this time · 0 points" in neutral gray, **never red** |
| Both cards | Total per month + colored category bar (rent blue, childcare pink, car yellow, food green, other gray) |
| Headline | "B costs $1,540 more a month." (difference of `totals`) |
| What decided it | "Daycare: $1,140 a month" + `lesson` ("Childcare often costs more than rent.") |
| Crowd | "61% picked A, from 214 picks", or "Not enough picks yet" when `crowd` is null |
| Sources → | Opens the `Source` of each breakdown line |
| Next round → | Visible without scrolling; after round 5 → Day result |

### S3 · Day result (state of `/play`)

| Element / button | Goes to | Backend | Event |
|---|---|---|---|
| "4 of 5", total points, grid (green = right, yellow = right with hint, ink = missed) | — | server-stored picks | `game_finished` `EXISTS` |
| Your blind spot ("You underestimate childcare.") | — | code template from the `decidedBy` of missed rounds `NEW` | — |
| Copy challenge link "Beat my 4/5" | copies `/play?c={resultId}` | `resultId` stored server-side `EXISTS`; `/play?c=` shows the friend's score on the same five `NEW` | `challenge_copied` `NEW` |
| Share | native share sheet; image from `GET /api/share?resultId=…&format=9x16\|1x1` `EXISTS` | — | `result_shared` `EXISTS` |
| **Price my own month →** (main CTA) | `/me/guess` | — | `own_guess_started` `NEW` |
| Next five in 6h 12m | — | countdown to New York midnight | — |
| See leaderboard | `/leaderboard` (after the cut line; hide until the page exists) | `GET /api/leaderboard` `EXISTS` | — |

### S5–S9 · Onboarding · `/me/*` (`EXISTS`)

A stepper on every step: **1 Your guess · 2 Closest life · 3 Your month · 4 Pay & savings · 5 Make it exact (optional)**, plus **Back**. Skipped fields become `isEstimate: true`; nothing blocks.

| Step | Route | Main button → | Secondary | Backend | Event |
|---|---|---|---|---|---|
| S5 Your guess | `/me/guess` | Lock my guess → S6 | — | stored in the session profile | `own_guess_submitted` `EXISTS` |
| S6 Closest life | `/me/closest` | Start from this life → S7 | — | `cardToProfile` `EXISTS` | `closest_life_chosen` `EXISTS` |
| S7 Your month | `/me/sliders` | Next → S8 | Back | `POST /api/session { anonId, profile }` `EXISTS` | `sliders_adjusted` `EXISTS` |
| S8 Pay & savings | `/me/balance` | Next → S9 | Skip, use estimates | same | `balance_sheet_edited` `EXISTS` |
| S9 Make it exact | `/me/upload` | See my future → S10 | **Try with sample statement** · Choose file · Skip | CSV parsed in the browser; `POST /api/statement/categorize` `EXISTS`; sample button loads `statement.sample.csv` through the same path `NEW` | `statement_applied` `EXISTS` |

S7 shows the aha line: "You guessed $2,600. Your month is $4,261. +$1,661." "Connect your bank app" stays hidden in the main flow (D-7).

### S10 · You in 10 years · `/future`

| Element / button | Backend | Event |
|---|---|---|
| Net worth in 2036 (mid), likely range, "Today −$5,900", "Rules forecast, today's dollars" | `forecast(profile)` `EXISTS`; AI forecast via `POST /api/ai/forecast` `EXISTS` may only add the explanation text — the headline and verdicts come from the rules forecast | `forecast_viewed` `EXISTS` |
| Chart: line + range band + dashed goal line | `forecast` points `EXISTS` | — |
| Toggle "As I live now / Without my little things" | second `forecast` with the little-things patch (`applyPatch` `EXISTS`) `NEW` | — |
| Goal card: target + year → **On track / Within range / Behind**, gap | `goalStatus`, `extraSavingToReach`, `movesTowardGoal` `NEW` (#69). Goal stored in the session, **outside** `Profile` | `goal_set` `NEW` |
| "7 of your numbers are estimates. Make it exact →" | count of `isEstimate` (`hasEstimates` `EXISTS`) → S9 | — |
| Moves: "+$10.8k over 10 years, Trim everything else" · **Add to my plan** | `rankMoves` `EXISTS`; save `committedMoveId` in the session `NEW` | `move_committed` `EXISTS` |
| Little things card → | `/tools/subscriptions` | — |
| How we calculate → | assumptions panel (`assumptions`, `assumptionSource` `EXISTS`) | — |

States: loading (rules forecast renders first) · no profile → redirect to S5 · mostly estimates · sample banner.

### S21 · Little things · `/tools/subscriptions` (`NEW`, issues #79 #80 #81)

| Step | UI | Button | Backend | Event |
|---|---|---|---|---|
| 1 Guess | "How much do you think goes to subscriptions and little things each month?" slider | Show me the real number | — | — |
| 2 See it | "You guessed $60. It's $169." + survey note "People guess $86 and pay $219 (C+R Research, 2022). A survey, not your data." | Upload a statement · Try sample statement · Pick mine by tapping | Recurring-charge detector in the browser `detectSubscriptions` (#79); catalog of ~40 services with price + `Source` or estimate (#80). Low-confidence finds show "Looks recurring: is it a subscription?" and are not counted until confirmed. Findings stay in the browser. | `little_things_revealed { source: 'statement'\|'ticks' }` |
| 3 Keep or cut | Each row: Keep / Cut (subscriptions) or Keep / Half / Cut (habits), "$X over 10 years", "+N days to your goal" | **Add to my moves** → S10 | `habitCost(price, perWeek, years)`, `goalDelay(profile, goal, change)` `NEW`; feeds the cancel-subscriptions move (`cancelSubscriptionsShare` `EXISTS` becomes the real cut list) | `little_things_added { count }` |

We never cancel anything, never link to cancel flows, never say which to cut.

### S23 · Overpaying check · `/tools/overpaying` (`NEW`, issues #86 #87)

| Element | Backend |
|---|---|
| ZIP (prefilled from profile) + "Your place: Studio / 1 bd / 2 bd / 3 bd" | profile `zip`; bedrooms picked here |
| Table: category · you pay · typical for your area (+ source) · result | `overpayingCheck(profile, areaData)` `NEW`: rent vs HUD, groceries vs USDA, childcare vs DOL, car insurance vs NAIC → below / in range / above, gap per month and per year |
| Summary: "$202 a month above the typical range. Over 10 years: $X. Your goal: N weeks later." | sum + `goalDelay` `NEW` |
| Add "Rent gap" to my moves → S10 | — |
| ZIP not covered | "Approximate: nearest metro" path |

Copy rule: "above the typical range for your area", never "you're overpaying". No provider names. Event: `overpaying_checked { above: number }`.

### S11 · Can I afford it? · `/afford` (`EXISTS`)

| Element / button | Backend | Event |
|---|---|---|
| Form: What · How much · One-time / monthly · Pay with Cash / Card / Loan | — | — |
| Verdict "Yes, in 3 months." + reason | `canAfford` → verdict, wait months, fail reason `EXISTS` | `afford_checked` `EXISTS` |
| Facts: effect on 2036, "+19 days for your goal", cheapest way to pay | `canAfford` with/without forecast `EXISTS`; `goalDelay` `NEW` | — |
| Save to wishlist (Pro) | `POST /api/session { wishlist }`; `402 not_paid` without Pro `EXISTS` → open S15 | — |
| Wishlist row "Affordable in N months" | re-run `canAfford` per item on profile change; extend the wait search beyond 12 months `NEW` | — |

### S12 · Loan Lab · `/loan` (`EXISTS`)

`loan`, `compareLoans`, `payoffOrder`, `amortize` `EXISTS`. Event `loan_compared` `EXISTS`.
**Share this comparison** → creates `/d/[id]` (S29, after the cut line; hide the button until then). Event `decision_shared`.

### S13 · Decide · `/decide` (`EXISTS`, preview)

Remove the "Next decisions" chips and the "PRO" label (tools are free, D-5). Keep the "Preview" label until the numbers are fully wired.

### S14 · Monthly check-in · `/checkin` (Pro, `CHANGE`)

| Button / element | Backend | Event |
|---|---|---|
| **Fast-forward 1 month (simulated)** | deterministic month generator from the profile, seeded, result typed `simulated: true` `NEW`; label "simulated month" on screen | `checkin_simulated` |
| Forecast vs actual (bars) | `monthEnd`, `simulate` `EXISTS` | — |
| Your move: progress ("$1,470 of $4,200 paid, 35%") | committed move + saved months `NEW` | — |
| Goal progress | goal functions `NEW` (#69) | — |
| Value check ("Card paid down $1,470, $640 vs forecast") | sum over saved check-ins `NEW` | — |
| Save check-in | persist the month in the session `NEW` | `checkin_saved` |
| Add monthly check-in to calendar (.ics) | build `.ics` in the browser (pure function, like #82 `renewalsToIcs`) `NEW` | `calendar_downloaded` |

Without Pro: show the screen with the paywall card instead of the Save button (`paywall_viewed`).

### S15 · Go Pro · `/pro` (`EXISTS`)

| Button | Backend | Event |
|---|---|---|
| Start yearly **$39.99** (shown first, preselected) | `POST /api/pro/checkout` (Stripe test mode when a key is set) or `POST /api/pro/demo-checkout` (simulated, nothing charged) `EXISTS`; prices from `PRO_PRICES` `EXISTS` | `checkout_started`, `pro_purchased` / `pro_demo_purchased` `EXISTS` |
| Monthly $6.99 | same | same |
| Have a promo code? | `POST /api/pro/demo-unlock` `EXISTS` | `pro_promo_redeemed` `EXISTS` |
| After purchase | `POST /api/pro/confirm` `EXISTS` → back to where the user came from | — |
| Manage, pause or cancel → | `/pro/manage` | — |

Pro lists only what works (D-5): goal + monthly check-in, saved life, saved tool plans, wishlist, history. No "coming soon" list. Event `paywall_viewed` `EXISTS` on view.

### S27 · Manage Pro · `/pro/manage` (`NEW`)

| Element / button | Backend | Event |
|---|---|---|
| Plan, price, renewal date | `GET /api/pro/status` `EXISTS` (add `renewsAt`) `CHANGE` | — |
| Pause 1 / 2 / 3 months | `POST /api/pro/pause { months }` `NEW` (store the Stripe subscription id on purchase; today it isn't saved) | `pro_paused { months }` |
| Cancel Pro | Modal shows the value check first; "Pause instead" and "Cancel Pro" are the same size; one click cancels. `POST /api/pro/cancel` `NEW`, revokes the entitlement at period end | `pro_cancelled` |
| Renewal reminder note | "We'll remind you 7 days before renewal" (California AB 2863 style, applied to everyone) | — |

### After the cut line (hide until built)

| ID | Route | What | Backend |
|---|---|---|---|
| S16 | `/leaderboard` | Today's board, your row pinned, made-up handles, countdown | `GET /api/leaderboard` `EXISTS` |
| X4 | `/play` round 4 or 5 | Habit duel "Which costs more over 10 years?" + the tell | robust pairs only: same answer under low and high return assumptions `NEW` |
| S28 | `/calendar` | Money moments: Black Friday → Afford, monthly check-in, tax refund → moves, lease end / loan payoff from the user | `.ics` per row and for all `NEW` |
| S29 | `/d/[id]` | Partner sees Path A vs Path B from Loan Lab, no login; CTA "See your own 10 years" → `/` | loan inputs encoded in the link, server re-runs `loan`; no personal data `NEW` |

---

## 4. Backend checklist (`NEW` and `CHANGE` only)

**Contracts (`packages/types`, one PR, rule 3)**
- [ ] `PublicDuel`, `PublicDuelCard`, `PickResult`, hint request/response, zod schemas
- [ ] New `ClientFunnelEvent` names (section 0)
- [ ] Session: `isSample`, `goal`, `committedMoveId`, saved check-ins

**Game**
- [ ] `GET /api/daily` returns 5 duels by New York date (keep slider shape behind a flag)
- [ ] `POST /api/daily/pick` (one pick per round per anonId, server-scored, stores `resultId`)
- [ ] `POST /api/daily/hint` (hint log, −10% per hint, floor 50%)
- [ ] Duel pairing: card pairs per day, gap ladder from easy to close
- [ ] `decidedBy` + lesson templates + blind-spot template (code, not LLM)
- [ ] Crowd counts per duel (shown at ≥ 20 picks)
- [ ] `/play?c={resultId}` challenge view

**Profile and forecast**
- [ ] Sample profile (`?sample=1`) and sample statement through the normal paths
- [ ] Goal (#69): `goalStatus`, `extraSavingToReach`, `movesTowardGoal`, `goalDelay`
- [ ] "Without my little things" forecast patch

**Tools**
- [ ] Little things: `detectSubscriptions` (#79), service catalog (#80), `habitCost`, view-model (#81)
- [ ] Overpaying: `overpayingCheck` (#86), view-model (#87)
- [ ] Wishlist "affordable in N months" beyond 12 months

**Retention and Pro**
- [ ] Check-in: simulated month generator, save, value check, `.ics`
- [ ] Pro: save Stripe subscription id, `renewsAt`, pause, one-click cancel

**After the cut line**
- [ ] Leaderboard page, habit pairs, calendar `.ics`, `/d/[id]`

Every engine function gets a Vitest test. Every new button sends its event.

---

## 5. Building the frontend from this doc

1. One screen at a time, in the build order from section 1.
2. View-model first: `features/<feature>/model/use<Screen>.ts` on fixtures (`packages/data/fixtures`), with a Vitest test. Then wire to the API when Aibek's route lands.
3. UI from the Figma frame into `features/<feature>/ui/*`: props in, events out, tokens only (`tokens.css`), copy in `src/copy/<feature>.ts`, no math.
4. Reuse ui-kit first: `Button` (Accent / Dark / Outline / Ghost), `Pill`, `Card`, `Stat`, `Sticker`, `Scoreboard`, `SpriteImage`. New from Figma: `DuelCard` (Round / Picked / Winner / Other), `FactChip` (Default / Hint), `VSBadge`, `RoundDots`, `CategoryBar`.
5. `pnpm lint && pnpm test && pnpm e2e` before calling a screen done.

**Prompt template for an AI code generator (one screen per run):**

> Read `CLAUDE.md` and `docs/design/USER-JOURNEY.md`. Build screen **S2 Duel round** at `/play`. View-model in `apps/web/src/features/game/model/useDuel.ts`, working on fixtures first (`packages/data/fixtures`), with a Vitest test. UI in `apps/web/src/features/game/ui/` from Figma frame "S2 Duel round" (file `OzBZZ1yd1o61NDYySGP3Pm`): props in, events out, ui-kit components and tokens only, copy in `src/copy/game.ts`, no math in the UI. Send `duel_picked` and `hint_opened` through `track()`. Add a Playwright step: tap card A → the reveal shows both monthly totals. Run `pnpm lint && pnpm test && pnpm e2e`.

Swap the screen name, route, frame and events for each screen.
