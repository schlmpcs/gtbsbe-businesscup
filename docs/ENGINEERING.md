# ENGINEERING.md — conventions, math specs, testing, Figma handoff

## Ownership (avoid editing each other's folders)

| Area | Owner |
| --- | --- |
| `packages/types` | Both. Change only together. |
| `packages/engine/*` except `loan/` and `month.ts` | Amir |
| `packages/engine/loan/`, `packages/engine/month.ts`, `packages/engine/scene.ts` | Aibek |
| `apps/web/src/ui-kit/HouseScene/` | Aibek |
| `apps/web/public/scene/` (sprite kit) | Kiko |
| `packages/data` (incl. life cards) | Aibek |
| `packages/data/fixtures` | Both. Change only together. |
| `apps/web/app/api/{daily,daily/clue,daily/guess,leaderboard,share,events,session,statement}` | Aibek |
| `apps/web/app/api/ai/*` | Amir |
| `apps/web/src/features/{upload,mocks}` | Aibek |
| Everything else in `apps/web` | Amir |
| CI, deploy, Playwright | Aibek |

## Git workflow

- Trunk-based: small PRs to `main`, merged within about 30 minutes. CI (lint + test) must be green. There are no per-PR preview deploys. A push to `main` that passes CI is deployed to the team server automatically (`ARCHITECTURE.md`, Deployment; `deploy/README.md`).
- Commit prefix with the task ID: `Y2: forecast range band`, `T6: CSV column detection`.
- Give a heads-up in chat before touching the other person's folder or `packages/types`.

## TypeScript conventions

- `strict: true`; no `any` in the engine. Money is a `number` of dollars, rounded only at display time (`formatMoney`).
- Rates are decimals per year everywhere (`apr: 0.069`, `inflationAnnual: 0.03`). Percent is a display format only (`formatRate`). Each field states whether it is monthly or a balance.
- Engine functions are pure: no `Date.now()`, no `Math.random()` without a seed, no fetch, no AI.
- Put constants in `packages/engine/assumptions.ts`, never inline.
- Every exported engine function has a JSDoc line plus at least one test with hand-checked numbers.
- UI copy lives only in `apps/web/src/copy.ts`. The engine returns ids and kinds (e.g. `MoveKind`, `cheapestWay`), never sentences.
- Zod schemas validate every API input and every LLM output.

## Math specs (engine)

All monthly. `t` = month index starting at 0. Defaults live in `assumptions.ts` and are labeled as assumptions in the UI.

### Default assumptions (edit in one place)

| Name | Default | Note |
| --- | --- | --- |
| `inflationAnnual` | from BLS CPI YoY in `AreaData`, fallback 0.03 | Source-tagged |
| `incomeGrowthAnnual` | = `inflationAnnual` | Pay keeps pace with prices (real income flat). Raises are a decision, not a default. Label as assumption. |
| `returnAnnualNominal` | 0.06 savings/retirement blend | Assumption |
| `cashYieldAnnual` | 0.03 | Assumption |
| `cardAprDefault` | 0.228 | CardRates 2026, source-tagged; cross-check against the Fed G.19 "accounts assessed interest" rate |
| `cardMinPayment` | interest for the month + 1% of balance, floor $25 | Typical issuer formula; assumption. Used when the user skips the minimum payment. |
| `retirementShareDefault` | 0 | Take-home pay is already after payroll retirement contributions; the user can raise it |
| `estimateSpread` | ±0.15 per estimated field | Drives the range band |
| `debtLoad` thresholds | green < 0.20, yellow 0.20–0.36, red > 0.36 of take-home pay | Common lending rule of thumb; label as guidance |
| `safetyCushionMonths` | 1 month of spending | For Can I Afford It? |
| `clueCost`, `clueFloor` | 0.10 per opened clue, floor 0.50 | Game tuning, not finance; tune after playtests |
| `avgMealPrice`, `monthlyGallons`, `kidGroceryFactor` | from BLS CE / national averages | Source-tagged or assumption |
| `payCardExtraShareOfSurplus`, `payCardExtraStep`, `cutCategoryShare`, `cancelSubscriptionsShare` | 0.5 of the surplus in $10 steps, 0.20, 0.5 | Next Moves sizes; assumptions |

### Loan amortization (Aibek, T3)

```
P = amount − downPayment + fees          (fees are rolled into the loan)
r = apr / 12
payment = (r === 0) ? P / n : P * r / (1 - (1 + r) ** -n)
each month: interest = balance * r
            principal = min(payment + extra − interest, balance)   (the last payment only clears what is left)
            balance  -= principal
totalInterest = Σ interest; payoffMonth = first month balance = 0
if payment + extra ≤ interest in month 0 → payoffMonth = null (never pays off); the UI warns
debtLoad = Σ monthly debt payments / takeHomePay
```

Test against a known value: $28,000 at 6.9% (`apr: 0.069`) for 36 months gives $863.28/month (863.279…; checked). Hard-code it in the test.

### Forecast (Amir, Y2)

```
net worth N_t = cash_t + retirement_t − Σ debt balances_t
each month:
  income   = takeHomePay × (1+incomeGrowth)^(t/12)
  spending = Σ spending categories EXCEPT debtPayments, × (1+inflation)^(t/12)
             (spending.car is running costs only; car loan payments come from debts)
  debt payments: each debt follows the loan engine with minPayment + extraPayment;
             card minPayment uses cardMinPayment when the user skipped it
  surplus  = income − spending − debt payments
  surplus > 0 → retirementShare of it to retirement, the rest to cash
  surplus < 0 → drawn from cash, then added to card debt at card APR
  cash grows at cashYield, retirement at returnAnnualNominal (monthly rate = (1+annual)^(1/12) − 1)
todaysDollars: divide N_t by (1+inflation)^(t/12)
range band: run low/high scenarios where every isEstimate field is shifted ±estimateSpread
            in the unfavorable/favorable direction; mid = point inputs
```

Always simulate at least 120 months so `in10y` exists. The band shows **uncertainty in your inputs only**, not market or inflation risk. Label it that way ("range from the numbers we estimated"). It shrinks to zero when every field is measured.

The golden test: `profile.demo.json` + `areaData.sample.json` (fixtures, never the live `areas.json`, so a data refresh can't break it) produces a snapshot that must not change unless an assumption changes on purpose.

The simulation above is now the **rules provider**: the fallback when the AI forecaster is unavailable or fails its checks, and the yardstick any AI or ML forecaster is compared with. The headline forecast comes from the AI forecaster below.

### AI forecast (Amir, Y15–Y20)

Design: `docs/superpowers/specs/2026-11-14-llm-forecast-design.md`. Plan: `docs/superpowers/plans/2026-11-14-llm-forecast.md`.

```
client ──► POST /api/ai/forecast { profile, rates?, scenarios: [{ id, patch }] }
              │  cache hit (key = hash of the facts the model sees + scenarios + rates + model + prompt version)? return it
              │  else one LLM call: base + every scenario, yearly anchors (years 1–10: low, mid, high), nominal dollars
              │  code: validate → interpolate to 121 monthly points → month 0 = today's balance sheet, exact
              │  fails twice, no key, or provider error → rules provider (`forecast()`), source 'rules'
              ◄── { source: 'ai' | 'rules', base: Forecast, scenarios: { [id]: Forecast } }   (nominal; todaysDollars: false)
client: today's dollars = deflateForecast(f, area inflation); move effect10y = scenario − base at month 120 (today's $)
```

- **What the model returns:** per forecast, 10 yearly anchors. Code interpolates linearly to monthly points. Month 0 is not asked of the model: it is today's `cash + retirement − debts`, exact, with low = mid = high.
- **Checks (all in code, `packages/engine/anchors.ts`):** exactly years 1–10; finite numbers; low ≤ mid ≤ high; every scenario id present. Then a sanity envelope against the rules forecast of the same profile: each anchor's mid within `[rules.low − tol, rules.high + tol]` with `tol = max(relative × |rules.mid|, floorMonths × takeHomePay)`, and band width ≤ `bandMaxRatio` × the rules band width (or `tol`, if larger). The envelope is too loose to see a bad move, so each scenario also gets an effect check: the year-10 difference (scenario − base) must have the rules difference's sign and be within `effectRatioMin`–`effectRatioMax` of it, or within `effectFloor` of it (under $1 of rules effect, within `effectFloor` of zero). The values are `aiForecastSanity` in `assumptions.ts` (`relative` 0.5, `floorMonths` 12, `bandMaxRatio` 3, `effectRatioMin` 0.25, `effectRatioMax` 4, `effectFloor` $1,000; guards, tune on the fixtures). A failure goes back to the model once with the issues listed; a second failure falls back to the rules provider.
- **Stability:** one call returns the base forecast and every candidate move's forecast, so `effect10y` differences come from one response. The model and every cache key use `forecastFacts(profile)` (no `zip`, `committedMoveId`, `doneMoveIds`). Only `source: 'ai'` results are cached (in memory, per process, 1 hour); the client keeps one answer per profile for the session and ranks moves from the (profile, candidates) pair each bundle answered, never from a bundle that answered other patches.
- **Time:** each model call has a timeout and no SDK retry; the request has a deadline (starting values 12 s per call, 20 s total); the client falls back to the local rules bundle after 25 s.
- **Labeling:** every forecast carries `source`. The UI shows "AI estimate" or "Rules-based estimate", and the "How we calculate" panel says which. The AI range band is the model's own uncertainty (it is told which inputs are estimates). It is not guaranteed to shrink when the user uploads a statement, so check that in rehearsal (Y19).
- **Scope:** the headline forecast and the moves' `effect10y` only. `canAfford`, Loan Lab, `monthEnd`, `costOfLife` and `scoreGuess` stay on the rules engine (affordability rules need per-month cash and card balances that `Forecast` does not carry). The ladder's 10-year preview (S5–S9) stays on the rules engine, labeled "Rules-based preview". The explain route words a move's sentence by its `source`.
- **Replacing the model later:** a trained model answers the same request and response with a new `ForecastSource` value. The sanity envelope and the rules provider stay as guards and as the baseline it has to beat.

### Cost of a life card (Amir, Y1)

```
rentUtilities = rentByBedrooms[bedrooms]          (HUD FMR is already gross rent: rent + utilities. Don't add utilities.)
car           = loan payment(price − downPayment) + carInsuranceMonthly + fuel (gasPerGallon × monthlyGallons)
childcare     = Σ over kids of childcareMonthly[kidAge]
groceries     = groceriesPerAdult × adults + kidGroceryFactor × groceriesPerAdult × kids.length
eatingOut     = eatingOutPerWeek × 4.33 × avgMealPrice
total.mid     = Σ items
total.low/high: rent part = FMR × rentRangeRatio.low / .high (fallback ±estimateSpread)
                other estimated items ± estimateSpread; sourced items unchanged
                then clamp so low ≤ mid ≤ high
```

The rent range applies ZCTA-level ratios to the card's own bedroom FMR, so a 3-bedroom card gets a 3-bedroom range. Never use all-unit quartiles as absolute dollar bounds; a big apartment's mid would fall outside them.

`cardToProfile` (Closest Life) copies these items into `Profile.spending`. The car loan becomes an `auto` debt, and `spending.car` keeps only insurance + fuel.

### Guess scoring (Amir, Y1)

```
if guess ≤ 0                → points = 0
if low ≤ guess ≤ high       → points = 1000, logError = 0
else edge = (guess < low) ? low : high
     logError = |ln(guess / edge)|
     basePoints = max(0, round(1000 × (1 − logError / ln 2)))  (0 points at 2× off the nearest edge)
multiplier = max(clueFloor, 1 − clueCost × cluesOpened)
points     = round(basePoints × multiplier)
```

The server counts `cluesOpened` from its own log of `/api/daily/clue` calls, never from the client.

Measuring from the nearest edge, not from the mid, keeps the score continuous: a guess just outside the range scores ~1000, not ~800. Log error makes a 10% miss on $3K and on $9K score the same. Keep the in-range band at the middle half, so a perfect score still needs a good guess.

### House scene (Aibek, T12)

`sceneOf(card, area)` is the only place scene content comes from, so the picture can never contradict the numbers.

| Clue | Card field | Props | Cost line |
| --- | --- | --- | --- |
| (always visible) | `bedrooms`, `metro` | layout studio–4bed, skyline in the window | rentUtilities |
| `garage` | `car` | none (bike / bus pass), economy (< $25k), mid ($25–45k), luxury (> $45k); loan-term tag | car |
| `kidsRoom` | `kids` | crib / toddler / preschool / school-age props per kid, or a home office | childcare, groceries |
| `kitchen` | `eatingOutPerWeek` | takeout piles: 0–1, 2–3, 4–6, 7+ per week | eatingOut |
| `entry` | `adults`, `kids` | coats and shoes per person | groceries |
| `mailbox` | `zip`, `tier` | ZIP + neighborhood tier sign | rentUtilities |

- Props without a `clue` are decor (plants, lamps, posters) and must not suggest a cost (no luxury decor in a cheap home).
- Car price bands and takeout buckets live in `scene.ts` as named constants.
- `<HouseScene>` renders the layout, the decor and closed rooms. A tap zooms into the room, calls `/api/daily/clue`, and then shows that room's props and facts. It works with labeled placeholder rectangles before the sprite kit lands.
- Tests: a snapshot of `sceneOf` for every fixture card, plus a consistency test that every clue maps to a `CostBreakdown` item.

### Next Moves (Amir, Y3)

Generate candidate moves for the current level. Apply each move's `patch` with `applyPatch` to a copy of the profile, and compute `effect10y = forecast(withMove).in10y.mid − forecast(base).in10y.mid`. Sort in descending order and return the top 3.

Level 1 candidates:
- `payCardFirst`: `extraPayment` on the highest-APR card.
- `cutCategory`: cut the largest discretionary category (eatingOut, subscriptions, other) by 20%.
- `cancelSubscriptions`: only when a statement was uploaded and subscriptions were detected.

Level 2 unlocks once a level 1 move is in `doneMoveIds`, or is `committedMoveId` and has been checked in on. It adds: retirementMatch, hsa, refinance, negotiateRent (local rent data), reshopInsurance. These need inputs the profile doesn't have yet (employer match, insurance quote), so they stay in the mock path for the hackathon.

Implementation details (Y3, `packages/engine/moves.ts`):
- `effect10y` is in today's dollars (what S10 shows), with the same `rates` for both forecasts; pass the area's inflation as on S10. The order is the same in nominal dollars.
- `payCardFirst` size: `payCardExtraShareOfSurplus` (0.5) of this month's surplus, rounded down to a multiple of `payCardExtraStep` ($10), capped by the card balance, added to any existing `extraPayment`. No surplus or no card with a balance: no move.
- `cancelSubscriptions` needs `opts.subscriptionsDetected` from the caller (a statement upload found subscription charges). The Profile has no statement flag, and `isEstimate: false` also means "typed in the Quick Sliders", so the engine can't infer it. It cancels `cancelSubscriptionsShare` (0.5) of subscriptions; while it is offered, `cutCategory` leaves subscriptions out so two moves never target one line.
- Ids: `payCardFirst:<debt id>`, `cutCategory:<category>`, `cancelSubscriptions`. A done move never comes back; the next one of its kind takes its place (next card by APR, next largest category). Moves under $1 of effect are dropped.
- The committed move is always returned while it applies and helps; outside the top 3 it takes the third slot. Level 2 unlocks when a level 1 move is done or committed (the check-in is a mock).

### Can I Afford It? (Amir, Y4)

Run `forecast` with and without the purchase over the next 12 months. A month **passes** when all three hold:

1. month-end cash ≥ safety cushion;
2. debt load ≤ the red threshold (0.36);
3. if paid by card, the card balance it adds is cleared within 12 months (no revolving debt at card APR).

Without rules 2 and 3, paying by card or loan never lowers cash, so everything would "fit".

- **fits:** every month passes.
- **wait:** one-time purchases only. It fits if delayed `k` months (search k = 1..12); return `waitMonths`. Recurring purchases don't get "wait".
- **no:** otherwise; `failsOn` names the first rule that broke.
- `baselineFails`: set when the plan fails a rule even without the purchase. The UI then says so, instead of blaming the purchase.

`cheapestWay` compares `'cash' | 'card' | 'loan'` by 10-year effect.

Implementation notes (full detail in the header of `packages/engine/afford.ts`):

- **Cushion** = `safetyCushionMonths` × that month's outflow: spending + required debt payments (including a loan or card the purchase adds) + the purchase's own monthly cost when it recurs (yearly ÷ 12).
- **Rule 3 needs a payoff plan.** The forecast default pays a card only its minimum, so every card purchase would "revolve". Can I Afford It? simulates the purchase with `ScheduledPurchase.payOffFromSurplus`: whatever it puts on a card (the charge, or the part of a cash payment cash couldn't cover) sits on its own card balance, and each month's whole positive surplus pays it down before cash or retirement. A charge made in month c must be gone by the end of month c + 11. Savings above the cushion are not used to pay it (that would be the cash purchase).
- **Window:** the purchase month and the 11 months after it (for "wait k", months k+1..k+12).
- **baselineFails vs verdict:** `baselineFails` = rule 1 or 2 breaks in the next 12 months without the purchase. A failing rule counts against the purchase only if it holds without the purchase that month, or the purchase makes it worse. So `baselineFails` can come with any verdict: "fits" (the purchase doesn't touch what's broken), "wait" (the plan recovers first) or "no" (the purchase breaks or deepens a rule).
- `failsOn` is set for "wait" and "no": the first rule that buying now breaks (earliest month, then cushion → debt load → card).
- `with` = buying now as chosen (with the payoff plan); `without` = the plain forecast.
- **cheapestWay** = highest net worth at month 120 (mid) over cash, card (paid off from the surplus) and the loan only when the user gave loan terms. There is no sourced default for personal-loan APR/term, so no loan is invented. Ties go to cash, then card.

### Month-end (Aibek, T9)

```
projection (per category) = current month total so far / day × days in month   (oneOffs excluded)
average = mean of last 3 full months per category (excluding oneOffs)
spread  = max(std dev, 10% of average)
drift   = projection − average; flag if |drift| > spread
```

With fewer than 3 months of history, `vsAverage = null` and `drifts = []`. Without any upload, S1 shows the monthly spend implied by the profile and no drift flags.

## AI usage rules

- Allowed: parse free text into typed JSON (`life`, `purchase`, `loan`), categorize merchant labels, tag one-off or yearly charges, write card captions, give 2-sentence explanations of an engine result, and produce the 10-year forecast under the checks in **AI forecast** above.
- Not allowed: computing or inventing a number for loans, costs, guess scores, affordability or month-end; any forecast number that has not passed the AI forecast checks; or giving advice about specific lenders, securities or tax.
- Numbers parsed from user text are inputs, not results. Show them to the user to confirm before they enter the profile.
- Labels sent for categorizing have personal names masked. Use the provider's no-training / zero-retention option.
- Always: a zod schema on the output, one retry on validation failure, then a fallback (the manual form for parsing, a template for explanations, the rules-based forecast for the forecast). Log prompts and responses in development only.

## Testing

- Vitest: every engine function, plus the golden forecast snapshot. Include edge cases:
  - scoring is continuous at the range edges, and a guess ≤ 0 scores 0;
  - `canAfford` with `payWith: 'card'` can return "no";
  - a loan whose payment doesn't cover interest returns `payoffMonth: null`;
  - `low ≤ mid ≤ high` holds for every fixture card;
  - the clue multiplier applies and floors at `clueFloor`.
- Playwright (T8): one spec for the full demo path (play 3 homes, opening at least one clue → guess own → sliders → forecast → upload sample CSV → Loan Lab compare).
- AI forecast: tests replace the Anthropic SDK module (`server/ai/testUtils.ts`). CI and Playwright never call a live model, and Playwright runs with no key, so S1 and S10 show the rules-based forecast. The eval script (Y19) is the only thing that calls the live model, and it is not part of CI.
- Run `pnpm lint && pnpm test && pnpm e2e` before merging anything that touches the demo path.

## Figma handoff procedure

1. The designer names frames by screen ID (S1–S15) and components by ui-kit names.
   The house sprite kit is exported as SVGs to `apps/web/public/scene/`, named by the sprite ids that `scene.ts` uses (layouts, then props per clue, then decor). The list of ids is agreed at Hour 0.
2. Export Figma variables to `tokens.json` (colors including chart palette, type scale, spacing, radius, shadows). Run `pnpm tokens` to regenerate `tokens.css`.
3. Restyle the ui-kit first; every screen inherits it.
4. Per screen: rewrite only `features/<feature>/ui/*`, consuming the existing view-model props. If data is missing, extend the view-model and fixture, not the UI.
5. After each screen, the lint import rule, tests and e2e must pass.
6. If Figma is late, ship the placeholder UI built on the same tokens, and skin S1, S3, S10 and S12 first.

## Cut order if time runs out

PDF upload → creator packs → leaderboard → "this life vs yours" → mockups S13–S14. Never cut the engine, the game, the forecast or Loan Lab.

If the house scene isn't playable at Sync 2, ship the static card (same view-model and routes; clues become tap-to-reveal rows) and keep building the scene behind a flag.
