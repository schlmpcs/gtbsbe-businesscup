# ENGINEERING.md — conventions, math specs, testing, Figma handoff

## Ownership (avoid editing each other's folders)

| Area | Owner |
| --- | --- |
| `packages/types` | Both. Change only together. |
| `packages/engine/*` except `loan/`, `month.ts`, `planEvents.ts`, `accounts.ts`, `budget.ts`, `cashFlow.ts` | Amir (incl. `plan.ts`, `monteCarlo.ts`, `scenarios.ts`) |
| `packages/engine/loan/`, `packages/engine/month.ts`, `packages/engine/scene.ts`, `packages/engine/planEvents.ts`, `packages/engine/accounts.ts`, `packages/engine/budget.ts`, `packages/engine/cashFlow.ts` | Aibek |
| `apps/web/src/ui-kit/HouseScene/` | Aibek |
| `apps/web/public/scene/` (sprite kit) | Kiko |
| `packages/data` (incl. life cards) | Aibek |
| `packages/data/fixtures` | Both. Change only together. |
| `apps/web/app/api/{daily,daily/clue,daily/guess,leaderboard,share,events,session,statement}` | Aibek |
| `apps/web/app/api/ai/*` | Amir |
| `apps/web/src/features/{upload,mocks}` | Aibek |
| `apps/web/src/features/{dashboard,accounts,transactions,cashflow,budget,recurring,goals}/model`, `apps/web/src/lib/model/{accounts,transactions}.ts` | Aibek |
| `apps/web/src/features/plan/model` | Amir |
| `apps/web/src/features/*/ui` for the pivot screens (P1–P10), `features/shell`, Figma frames, `tokens.json` | Kiko (UI only; model, engine and API untouched) |
| Everything else in `apps/web` | Amir |
| CI, deploy, Playwright | Aibek |

## Git workflow

- Trunk-based: small PRs to `main`, merged within about 30 minutes. CI (lint + test) must be green. There are no per-PR preview deploys. A push to `main` that passes CI is deployed to the team server automatically (`ARCHITECTURE.md`, Deployment; `deploy/README.md`).
- Commit prefix with the task ID: `Y2: forecast range band`, `T6: CSV column detection`, `MP3: plan() shortfall mode`. The pivot tasks MP1–MP19 are in `docs/TASKS.md`.
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
| `mortgageRateAnnual` | Freddie Mac PMMS 30-year fixed | Source-tagged (MP4); default for Buy a home |
| `vehicleDepreciationAnnual` | −0.15 | Assumption (MP3); vehicle accounts lose value |
| `monteCarlo` spreads | inflation sd 0.02; investments and retirement sd 0.15; real estate sd 0.05; cash and vehicle sd 0; 1,000 paths | Assumptions (MP5), documented in "How we calculate" |
| plan defaults | `retireAge` 67, `endAge` 90, `display: 'today'`, withdrawal order cash → investments → retirement | Assumptions (MP2/MP3) |
| `kidOtherMonthly`, `socialSecurityShare` | USDA cost of raising a child (without childcare and housing); a share of current take-home | Source-tagged / assumption (MP4) |
| `oneOffHintMinAmount`, `oneOffOutlierMinAmount`, `oneOffOutlierMultiple` | $50, $400, 5× the category median | Which statement charges count as one-offs; assumptions |

### Loan amortization (Aibek, T3)

```
P = amount − downPayment + fees          (fees are rolled into the loan)
r = apr / 12
payment = (r === 0) ? P / n : P * r / (1 - (1 + r) ** -n)
each month: interest = balance * r
            principal = min(payment + extra − interest, balance)   (the last payment only clears what is left)
            balance  -= principal
totalInterest = Σ interest; totalCost = downPayment + Σ payments; payoffMonth = first month balance = 0
if payment + extra ≤ interest in month 0 → payoffMonth = null (never pays off); the UI warns
debtLoad = Σ required monthly debt payments / takeHomePay
effect10y = forecast(with the purchase financed by this loan).in10y.mid − forecast(without).in10y.mid
```

Test against a known value: $28,000 at 6.9% (`apr: 0.069`) for 36 months gives $863.28/month (863.279…; checked). Hard-code it in the test.

Implementation details (T3, `packages/engine/loan/`):
- `amortize({ principal, apr, payment, extraPayment })` is the schedule for any fixed payment; `loan()` calls it with the level payment. A payment that never covers the interest returns `payoffMonth: null` and an empty schedule; so does a loan that would take longer than 1,200 months. The level payment of a valid `LoanInput` always covers the interest, so `null` from `loan()` needs a payment that doesn't (the `amortize` and `payoffOrder` paths).
- Numerics: with a level payment the principal part grows by (1 + r) a month, and the schedule carries it forward that way instead of as `payment − interest`, which cancels to 0 when the payment barely beats the interest (e.g. 100% APR over 600 months). It is the same schedule, without the rounding.
- Debt load counts **required** payments only (not extra payments): each debt's minimum, using the card formula for a card whose minimum is an estimate, capped at what is owed, and 0 for a paid-off debt. These are the same numbers as the simulation's month 1, so Loan Lab and Can I Afford It? agree. With take-home pay ≤ 0, the load is `Infinity` when anything is owed and 0 otherwise.
- `effect10y` is in today's dollars, like `Move.effect10y`. `loan(p, l, { rates })` and `compareLoans(p, ls, { rates })` take the area's rates (Loan Lab passes them the way the plan does). The thing bought counts as consumption, not an asset (as in Can I Afford It?), so this is the 10-year cost of buying it this way. `compareLoans` runs the baseline forecast once.
- `payoffOrder`: a fixed monthly budget = Σ today's required payments + each debt's own `extraPayment` + `extra`. Each month every debt gets its required payment, and the rest goes to the debts in order (avalanche = highest APR first, ties to the smaller balance; snowball = smallest balance first, ties to the higher APR). Debts that are paid off, and card minimums that shrink, free money for the next debt. `order` lists only the debts that have a balance.
- `suggestedPayoffExtra` (issue #144): the payoff planner used to open at $0 extra, where avalanche, snowball and minimums only pay the same total each month and come out identical, which read as a broken comparison. It now opens at `payCardExtraShareOfSurplus` (50%, the same rule as Next Moves → payCardFirst) of this month's surplus, rounded down to the planner's $25 slider step. The surplus is the forecast's month-1 surplus with the planner's debts in place of the profile's, so the selected loan offer's payment is taken out first: on the demo profile with offer A that is $939.08 − $863.28 = $75.80, so $25. No surplus (or less than one step after the share) gives $0. A pick the person made, saved or not, always wins; the saved `tools.payoff.extra` is written only once the person sets an amount, so picking a method alone does not freeze the suggestion. When methods still come out the same, the planner says why in one line (`features/loan/model/payoffTie.ts`: no extra, extra too small, one debt, the same order by rate and by balance, or different orders with the same result).
- Invalid input throws a `RangeError`: negative or non-finite numbers, a down payment above the amount, a term that is not a whole number of months in 1..1200, a duplicate debt id, an unknown debt kind or payoff method. API inputs are also checked by the zod schemas before they reach the engine.

### Forecast (Amir, Y2)

```
net worth N_t = cash_t + retirement_t (+ home_t for an owner) − Σ debt balances_t
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

**Life events** (the old Future screen's "Coming up"; the plan's events on P8 are macro events that `expandEvent` turns into these; design `docs/superpowers/specs/2026-11-15-life-events-design.md`). `Profile.events` are dated by calendar month and `Profile.asOf` is the month today's values describe (month 0), so an event's start month is `eventStartMonth(asOf, month)`; the engine throws (RangeError) when there are events and no `asOf`. Amounts are today's dollars, grown from month 0 like everything else (pay by income growth, spending and one-offs by inflation):

```
pay      takeHomePay base becomes the event's value from its start month
spending that category's base becomes the event's value from its start month (spending is a per-category sum)
one-off  in its start month: a cost is paid like a cash purchase, income is added to cash
same field: the latest start wins; ties go to the later event in the list
estimates: an event value with isEstimate shifts by ±estimateSpread in low/high, like any estimated field
```

**The home (JF4, #136).** A profile with `home` owns it: `simulate()` opens the real estate group at `home.value`, growing at `home.appreciation` (monthly rate `(1+appreciation)^(1/12) − 1`), so net worth is `cash + retirement + home − debts` at every month, `forecast()`, goals, Can I Afford It? and Next Moves included (`withHomeAsset`, the one place it is decided). The mortgage is a `'mortgage'` debt with P&I as its payment, so paying it down builds equity; owner costs sit in `spending.rentUtilities`. The home value is not shifted in the low/high band. A renter's numbers are exactly as before. `netWorthOf` counts the home; `profileToAccounts` adds a Home real estate account (id `home`) and `accountsToProfile` sets `home.value` from the included real estate accounts, which `plan()` passes as the real estate balance, so the home is counted once. The AI forecaster sees `home` (tenure, value, appreciation) in `forecastFacts` and is told net worth includes it; today's net worth in its prompt is the rules month 0. `negotiateRent` is never offered to an owner (`moveKindApplies`, `level2KindsFor`).

A move's patch changes today's values only, so a later event on the same field replaces it from its month. The client keeps only future events: when an event's month arrives, the store's `foldStartedEvents` makes it today's value (pay → `takeHomePay`, spending → `spending[category]`, value and `isEstimate` from the event; a past one-off is dropped) and the legacy Future screen shows a one-line note once. It runs after hydration, when the month rolls over while the page is open, and when a whole profile arrives (the server session).

**`asOf` is stamped in one place.** `stampProfile` (`apps/web/src/state/profile.ts`) sets it to the local month; `useProfile()` is how every view-model reads the profile for the engine, and it is never stored or saved (the store strips it). The server never reads the clock: it strips `events` before its own engine calls on a stored profile (the avatar's `coarsenAvatar`, via `withoutEvents`), and only `/api/ai/forecast` gets events, with the client's `asOf`.

Always simulate at least 120 months so `in10y` exists. The band shows **uncertainty in your inputs only**, not market or inflation risk. Label it that way ("range from the numbers we estimated"). It shrinks to zero when every field is measured.

The golden test: `profile.demo.json` + `areaData.sample.json` (fixtures, never the live `areas.json`, so a data refresh can't break it) produces a snapshot that must not change unless an assumption changes on purpose.

The simulation above is the **rules engine** that `plan()` (below) builds on. Since the pivot (`docs/PIVOT.md`) it draws the plan line and every KPI; the AI forecaster below is a second opinion and the yardstick for its own sanity checks, never the source of a number on screen.

### Plan (Amir, MP3)

`plan(profile, accounts, scenario, area?) → PlanResult` in `packages/engine/plan.ts`. The deterministic line on `/plan` (P8), its four KPIs and the Accounts / Cash Flow / Events tables all come from this one call. It builds on `simulate()`; it does not fork it. Types: `ARCHITECTURE.md → Planner contracts`. Depends on `expandEvent` (MP4) and `accountsToProfile` (MP8).

```
1. inputs   accountsToProfile(accounts) gives cash, retirement and debts; extra asset groups (investments,
            realEstate, vehicle, otherAsset) are carried as their own balances
2. events   scenario.events.filter(e => e.enabled).flatMap(e => expandEvent(e, ctx))
            → primitive LifeEvents + new Debts (mortgage, financed purchase) + asset changes
              (a home's value is added as a realEstate balance)
3. simulate monthly from asOf to endAge: months = (endAge − age) × 12, at most MAX_SIMULATION_MONTHS;
            aggregate into ONE PlanYear per calendar year (year-end balances; flows summed over the year)
4. options  the simulate() options in the table below
5. display  'today': every money value of year t is divided by (1 + inflation)^t (the deflator the forecast uses)
            'future': nominal
6. KPIs     netWorthEndOfYear    = this calendar year's end
            netWorthAtRetirement = the year where age = retireAge
            retireAge            = the retire event's age (or the assumption)
            netWorthAtEnd        = the last year
            shortfallAge         = first age with shortfall > 0, else null
```

Changes to `simulate()` (step 4), all behind options whose **defaults keep today's behavior**, so every existing test stays green:

| Option | Default | Behavior |
| --- | --- | --- |
| `shortfallMode: 'card' \| 'separate'` | `'card'` | `'separate'`: when cash and every account in `withdrawalOrder` are empty, the unpaid outflow accrues on a `shortfall` balance that grows with inflation (the "unfunded expenses" row). Net worth = assets − liabilities − shortfall |
| `withdrawalOrder` | cash → investments → retirement | a negative surplus draws from cash first, then the groups in order |
| `savingsSplit` | from `retirementShare` | a positive surplus is split by shares instead of only `retirementShare` |
| per-group growth | see below | `assumptions.growth` and `Account.growth` override |
| spending base | `expenses.mode === 'budget'` | `'budget'` → `profile.spending` (today's behavior); `'manual'` → one `other` line of `monthly` |
| `rates?: { inflation: number[]; growth: Record<AccountGroup, number[]> }` | absent | per-year rate arrays for Monte Carlo (MP5). Constant arrays must reproduce `plan()` exactly (test) |

Per-group growth: cash `cashYieldAnnual`; investments and retirement `returnAnnualNominal`; realEstate `AreaData.homeAppreciationAnnual ?? inflation`; vehicle −15% a year (new assumption in `assumptions.ts`, `assumption: true`); otherAsset = inflation.

Tests (`plan.test.ts`), expected numbers worked by hand from the inputs in each test's comment:
- No events, demo profile: year 1 net worth equals `forecast()` month 12 within $1 (same engine).
- Zero income, $10k cash, $2k a month spend: cash hits 0 in month 5, then the shortfall grows; `shortfallAge` is the age at that year; net worth goes negative.
- Withdrawal order: with cash = 0, investments drain before retirement; reversing the order reverses it.
- Savings split 50/50 cash/investments: deposits match within $1.
- Today's vs future dollars: future = today × (1 + i)^t at every year.
- Retire at 67: income stops at 67; Social Security from its year adds income.
- Retire at 72 with Social Security at 67: work pay + benefit at 70, the benefit alone from 72 on; on the demo inputs, retiring at 62 / 67 / 72 / 76 never lowers take-home before the later retirement age and raises net worth at the end.
- Golden snapshot for `scenario.demo.json` (regenerate the `plan.demo.json` fixture with `pnpm fixtures:plan`).
- Performance: one `plan()` for a 25-year-old to 90 runs in < 10 ms (Monte Carlo needs it).

### Plan events (Aibek, MP4)

Two pure functions in `packages/engine/planEvents.ts`.

1. `defaultEvent(type, ctx) → PlanEvent`: what "Add event" creates in one tap. Every default comes from **our area data** (Monarch uses flat rules of thumb) and carries a `Source` or `isEstimate`.
2. `expandEvent(event, ctx) → { lifeEvents: LifeEvent[]; debts: Debt[]; assets: { group: AccountGroup; month: number; value: Money }[] }`: turns a macro event into the primitives `simulate()` already understands (`pay` / `spending` / `oneOff` life events from `events.ts`, plus new debts and assets). Disabled events expand to nothing.

`ctx = { profile, area?: AreaData, assumptions: PlanAssumptions, asOf: YearMonth }`. Events are dated by **year**; they start in January of that year (`${year}-01`), or this month when the year is the current one. Amounts are today's dollars, like every `LifeEvent`; `simulate()` already inflates them.

| Type | Default (`defaultEvent`) | Expands to |
| --- | --- | --- |
| `income` | $500/mo, from next year, no end | `pay` event at start (take-home + monthly) and at `endYear` back |
| `expense` | $5,000 once, next year, no financing | `oneOff` cost; `monthly` → `spending` on `other` (+ amount) until `endYear`; with `financing`: `oneOff` = downPayment + a `Debt` (`kind: 'personal'`, `amortizedPayment`) starting that month |
| `buyHome` | `homeValue` = `area.homeValueMedian` (else $400k, estimate); down 20%; 30 years; `rate` = assumption `mortgageRateAnnual` (new constant in `assumptions.ts`, source: Freddie Mac PMMS); `propertyTaxRate` = `area.propertyTaxRate` (else 1%); insurance = `area.homeInsuranceMonthly`; upkeep 1%/yr; `replaceHousing: true` | `oneOff` = down payment (or the full value if `payCash`); mortgage `Debt` (`kind: 'mortgage'`, `amortizedPayment(value − down, rate, years × 12)`); `spending` on `rentUtilities` = tax/12 + insurance + upkeep/12 + **current utilities share** (replaces rent when `replaceHousing`, else adds); asset `realEstate` = homeValue that month |
| `haveKid` | `childcareMonthly` = `area.childcareMonthly.infant` (source), 5 years; `otherMonthly` = the USDA cost-of-raising-a-child figure without childcare and housing (new assumption with source) | `spending` childcare + the childcare amount for `childcareYears`, then back; `spending` other + `otherMonthly` until age 18 |
| `newJob` | take-home +10% | `pay` event |
| `careerBreak` | 1 year | `pay` = 0 at start, back to the previous pay at `endYear` |
| `windfall` | $10,000 | `oneOff` income |
| `retire` | year = birth year + `retireAge` | `pay` = 0 |
| `socialSecurity` | at 67; monthly = estimate (new assumption: a share of current take-home, `assumption: true`; the SSA Quick Calculator is the user's better source) | **adds** monthly to the take-home pay in effect from its start: work pay + benefit while still working (claiming does not need retiring), benefit only after Retire. Pay events set pay, so it also re-issues every later pay change (Retire, New job, Career break, …) with the benefit added; `orderPlanEvents` expands it after every other event |

Rules:
- The monthly payment shown in the event panel is **one function**, `buyHomeBreakdown(event) → { principalAndInterest, propertyTax, insurance, total }`, so the UI and the engine never disagree. Same for `expenseFinancingBreakdown`.
- `downPayment` in $ and % are kept in sync by the view-model, not the engine: the engine stores $ only.
- New constants go in `assumptions.ts` with a `source` or `assumption: true` (golden rule 5) and show in "How we calculate".

Tests (`planEvents.test.ts`):
- Buy a home $400k, 20% down, 30 years, 6.5%: P&I = $2,022.62 (the annuity formula), tax 1% → $333.33, total within $0.01.
- `payCash`: no debt, `oneOff` = the full value.
- `replaceHousing: false` adds to rent; `true` replaces it.
- Have a kid: childcare stops after `childcareYears`.
- Career break: pay 0, then restored to the pay **before** the break (including a prior `newJob`).
- Social Security: work pay + benefit while working; a later Retire keeps the benefit; `orderPlanEvents` puts it last.
- Every `defaultEvent` for the demo ZIP has a `Source` or `isEstimate` on each amount.
- Disabled events expand to nothing.

### Monte Carlo (Amir, MP5)

`monteCarlo(profile, accounts, scenario, settings: MonteCarloSettings, area?) → MonteCarloResult` in `packages/engine/monteCarlo.ts`. It is the Chance of success screen (P10) and the band the AI line is checked against.

```
1. PRNG       mulberry32(seed); normals by Box–Muller.
              seed: null → pick one with Math.random() OUTSIDE the pure core and return it, so "fixed seed"
              reproduces the exact run
2. draws      for each path k and plan year t: inflation_t ~ N(mean, sd) and per group growth_{g,t} ~ N(mean_g, sd_g)
              defaults: inflation sd 0.02; cash sd 0; investments and retirement mean returnAnnualNominal, sd 0.15
              (assumption, documented); realEstate sd 0.05; vehicle sd 0
              fed to plan() as per-year rate arrays (the `rates` option above)
3. per path   net worth per year, net worth at retirement, at the end, first shortfall age
4. success    net worth at end ≥ endThreshold AND shortfall stayed 0;  successRate = successes / paths
5. bands      per year p10 / p50 / p90 of net worth, nearest-rank percentiles: the p-th percentile of N values is
              the value at rank ceil(p/100 × N) in ascending order (rank ≥ 1). In the scenario's display unit:
              today's dollars deflate each path by ITS OWN inflation draws
6. samples    every ceil(paths/200)-th path, with its success flag (the UI draws them red or grey)
7. histograms 20 equal-width bins for atRetirement and atEnd; shortfallAge bins by year of age
              (paths without a shortfall are excluded, the count is reported)
```

Performance: 1,000 paths for a 25-year-old to 90 (about 780k simulated months) must finish in **< 400 ms** in Node on CI. If not, add a yearly-step fast path used only by Monte Carlo, and test that its mid path stays within 1% of `plan()`. The frontend runs it in a **Web Worker** (MP7), so the main thread never blocks.

Tests (`monteCarlo.test.ts`):
- Same seed → identical result (deep equal). A different seed → different `samplePaths`.
- All sd = 0 → every path equals `plan()`; p10 = p50 = p90 = the plan line; success 0% or 100%.
- A zero-income profile → success 0%, the shortfallAge histogram is non-empty.
- A rich profile (huge cash, tiny spend) → success 100%.
- p10 ≤ p50 ≤ p90 at every year; the atEnd bins sum to `paths`.
- A performance test with a generous CI bound (skipped under `CI_SLOW=1`).

### Scenarios, Compare and moves on the plan (Amir, MP6)

- `baselineScenario(profile, area, asOf)`: "Baseline", default assumptions, events Retire (`retireAge`) + Social Security (67); used for every new user so `/plan` is never empty. `duplicateScenario(s, name)` gives new event ids. At most 4 scenarios.
- `compareScenarios(a, b)` returns per-year `{ year, a, b, diff }`, KPI diffs, `firstYearBAhead` and `sentence` data (who is ahead, by how much, from which year) so the UI never shows a bare signed number.
- `planMoveEffects(profile, accounts, scenario, moves)` measures each Next Move on **this scenario's** plan (`effectAtRetirement`, `effectAtEnd`, and for the top 3 `successRateDelta` with the **same seed** before and after, otherwise noise looks like effect), sorted by `effectAtRetirement`. `previewEvent` gives with / without KPIs and `leftOverMonthly` for the event panel.

### Budget and cash flow (Aibek, MP9)

`budgetRows(planned, actual, today) → { income: BudgetRow; rows: BudgetRow[]; totals }` in `packages/engine/budget.ts`:
- `planned: Record<CostCategory, Money>` defaults to `profile.spending` (our sliders and area data: that is "Create my budget", personalized, unlike a generic sample). Editable per cell by the user (stored in the browser).
- `actual` comes from the current month's `CategoryTotals` (statement) or the daily log (`dailyMonthToDate`): whichever exists, the statement first.
- `expectedByToday = planned × day / daysInMonth` for flexible categories. **Fixed** categories (`rentUtilities`, `childcare`, `debtPayments`, `subscriptions`) expect the full amount once paid.
- `status`: `over` when actual > planned; `onPace` when actual is within ±10% of `expectedByToday`; else `under`.
- Table groups: Fixed (rent, childcare, debt payments, subscriptions) and Flexible (groceries, eating out, car, other).
- `budgetRowsForYear` sums the months that have data.

`cashFlowSummary(totals: CategoryTotals[], period) → CashFlowSummary` in `packages/engine/cashFlow.ts`:
- income = Σ `detectedPay` (+ other money in that is not a refund or transfer); expenses = Σ totals (+ one-offs, listed separately); savings = income − expenses; `savingsRate = savings / income` (null when income = 0).
- **Sankey:** income sources → "Income" → each category with amount > 0, plus "Savings" when savings > 0. Links sum exactly (in cents, like `statement.ts`). Categories under 2% of expenses are merged into "Other".
- Periods: monthly, quarterly, yearly (group by month string).

Tests: budget on day 15 of 30 with groceries planned $600 and $200 spent → expected $300, `under`; rent paid → `onPace`. Cash flow on the `statement.sample.csv` totals: savings = income − expenses to the cent; Sankey inflow = outflow per node. Zero income → `savingsRate` null, no crash.

### AI forecast: a second opinion on /plan (Amir, Y15–Y20; MP7)

**Role (decision 1 in #160, `docs/PIVOT.md`).** The rules engine (`plan()`) draws the main line and every KPI; Monte Carlo (`monteCarlo()`) draws the range and Chance of success. The AI forecaster is an **AI line on `/plan`**: a separate line labeled **"AI estimate"**, shown only if it passes two kinds of checks, and hidden when it fails. It never replaces an engine number and never feeds a KPI, a verdict, a Next Move or Chance of success.

```
client ──► /api/ai/forecast (profile of the scenario) ──► ForecastBundle (checked on the server: the checks below)
client: convert to the plan's years and display unit (deflateForecast for today's dollars)
        band  = Monte Carlo p5–p95 of the scenario, computed once with a fixed seed and 300 paths
        show  only if today's value matches the plan's exactly AND every point is inside the band
        else  status 'rejected' with a reason (useAiLine), the line is hidden; the engine numbers are untouched
```

The server checks below (shape, ordering, today's balance exact, the sanity envelope against the rules forecast, effect checks) are unchanged; the Monte Carlo band is a second, client-side gate that the plan's own uncertainty makes possible. The AI line covers the years the model answers (the next 10 years). Nothing on `/plan` is computed from it: KPIs, Accounts / Cash Flow / Events tables, Compare and moves read `plan()`. The p5 and p95 are read with the same nearest-rank percentile helper as the p10 / p50 / p90 bands (`MonteCarloResult` itself carries p10 / p50 / p90; MP7 asks the helper for the wider band).

Design: `docs/superpowers/specs/2026-11-14-llm-forecast-design.md`. Plan: `docs/superpowers/plans/2026-11-14-llm-forecast.md`. The old Future screen's horizon picker (1, 3, 5 or 10 years; replaced by the plan's yearly line) is in its own design, `docs/superpowers/specs/2026-11-14-horizon-picker-design.md`; its bullet is below.

```
client ──► POST /api/ai/forecast { profile, rates?, scenarios: [{ id, patch }] }
              │  cache hit (key = hash of the facts the model sees + scenarios + rates + model + prompt version)? return it
              │  else one LLM call: base + every scenario, yearly anchors (years 1–10, each [low, mid, high]), nominal dollars
              │  code: validate → interpolate to 121 monthly points → month 0 = today's balance sheet, exact
              │  fails twice, no key, or provider error → rules provider (`forecast()`), source 'rules'
              ◄── { source: 'ai' | 'rules', base: Forecast, scenarios: { [id]: Forecast } }   (nominal; todaysDollars: false)
client: today's dollars = deflateForecast(f, area inflation); move effect10y = scenario − base at month 120 (today's $); the gain shown on screen = the same difference at month 12·years (the picked horizon)
```

- **What the model returns:** per forecast, `years`: 10 entries `[low, mid, high]`, year 1 first (the year is the position; this compact shape is about half the output tokens of keyed objects, and output is most of the wait). Code interpolates linearly to monthly points. Month 0 is not asked of the model: it is today's `cash + retirement − debts`, exact, with low = mid = high.
- **Checks (all in code, `packages/engine/anchors.ts`):** each entry three numbers; exactly years 1–10; finite numbers; low ≤ mid ≤ high; every scenario id present. Then a sanity envelope against the rules forecast of the same profile, at every year 1–10: each anchor's mid within `[rules.low − tol, rules.high + tol]` with `tol = max(relative × |rules.mid|, floorMonths × (year / 10) × takeHomePay)`, and band width ≤ `bandMaxRatio` × the rules band width (or `tol`, if larger). The envelope is too loose to see a bad move, so each scenario also gets an effect check at every horizon the picker offers (`FORECAST_HORIZONS`: 1, 3, 5 and 10 years): the difference (scenario − base) at month 12·year must have the rules difference's sign and be within `effectRatioMin`–`effectRatioMax` of it, or within `effectFloor × year / 10` of it (under $1 of rules effect, within that floor of zero). Both dollar floors scale with the year, because a short horizon has small effects and little spread: `floorMonths` and `effectFloor` are the year-10 values, so at year 1 the base floor is 1.2 months of pay and the effect floor $100. The ratio range and `relative` are the same at every year. The values are `aiForecastSanity` in `assumptions.ts` (`relative` 0.25, `floorMonths` 12, `bandMaxRatio` 3, `effectRatioMin` 1/3, `effectRatioMax` 3, `effectFloor` $1,000; guards, tune on the fixtures. Tightened on 2026-11-14 from 0.5 and 0.25–4 after a live Sonnet 5.5 answer 60% below the simulation passed the old envelope). Every effect message names its year. One source per answer: a failure at any year goes back to the model once with the issues listed; a second failure falls back to the rules provider for the whole answer, never per horizon.
- **Stability:** one call returns the base forecast and every candidate move's forecast, so the effect differences (`effect10y` and the gain at the picked year) come from one response. The model and every cache key use `forecastFacts(profile)` (no `zip`, `committedMoveId`, `doneMoveIds`). Only `source: 'ai'` results are cached (in memory, per process, 1 hour; the demo profile's answer, asked for once at server start by `instrumentation.ts` → `src/server/ai/prewarm.ts`, is kept for as long as the process runs, so the demo path never waits); the client remembers the last 20 settled answers of the session and shows a remembered one at once: an `'ai'` answer is reused as it is, any other (the route's rules answer or the local fallback) is shown as refreshing and asked for again in the background, so an outage heals without a reload; it ranks moves from the (profile, candidates) pair each bundle answered, never from a bundle that answered other patches. **Rules first:** until a request has an answer, the screen shows the rules bundle computed in the browser for those very inputs, labeled "Rules-based estimate" and "Updating the forecast…", then the model's answer replaces it; so there is no skeleton, and a profile edit moves the numbers at once. Commit / done stay enabled on it (same ids and patches as the answer on its way); they are disabled only when the numbers on screen are another profile's, which now happens only if the local engine fails.
- **Model and time:** production sets `ANTHROPIC_FORECAST_MODEL=claude-opus-5-5` (effort `low`). Measured on 2026-11-14 with the demo profile: Opus 5.5 low answers in 15–20 s and passed every check, with the 10-year mid within 3% of the simulation; Haiku 5.5 thinks for 21–49 s even at effort low; Sonnet 5.5 low is ~5 s but once answered 60% below the simulation. Each model call has a timeout and no SDK retry; the request has a deadline (30 s for the first call, 40 s total; a retry starts only with ≥ 15 s left); the client falls back to the local rules bundle after 50 s.
- **Life events:** the request's profile carries `events` (at most 12; ids match the scenario id pattern) and `asOf` (required with events). `forecastFacts` replaces each event's `month` with `startsInMonths` (from `asOf`) and drops `id`, `preset` and `asOf`, so the model sees kinds, categories and numbers only (no text the user typed) and the cache key changes when the events do, and again each calendar month (they are a month closer). The prompt explains them in one fact line (`PROMPT_VERSION` 4). The checks are unchanged in form: the rules reference is the simulation of the same profile with its events, so the envelope and the effect checks compare like with like.
- **Labeling:** every forecast carries `source`. On `/plan` the AI line is always labeled "AI estimate" (the engine line is the plan, not an "estimate" of the model's kind), and the "How we calculate" panel says what each line is and that the AI line is a second opinion that is hidden when it fails. The AI range band is the model's own uncertainty (it is told which inputs are estimates). It is not guaranteed to shrink when the user uploads a statement, so check that in rehearsal (Y19).
- **Horizon picker (legacy, until MP14 removes `/future`):** the old Future screen let the user pick 1, 3, 5 or 10 years (`FORECAST_HORIZONS`, default 10). The pick is one horizon for the app, kept in the store and `localStorage` (not in the Profile); the old Today card, Next Moves and check-in followed it. The server is never told the horizon: the request, the prompt, `PROMPT_VERSION` and the cache key are unchanged and the model already writes years 1–10, so switching the year makes no model call. The client reads the picked year from the one answered bundle (`pointAt(forecast, years)` in `anchors.ts` is the month-`12·years` point), so every number on screen at any year comes from one source and passed the checks at that year. At 1 year the AI line on the chart is a straight line between its two anchors (month 0 and year 1). The ladder's 10-year preview (S5–S9), the Goals card, Can I Afford It? and Loan Lab stay at their own horizons.
- **Scope:** the AI estimate line on `/plan` only (since the pivot). Until MP14 removes the old routes, the legacy Future screen still reads the bundle for its headline and moves' effects (`effect10y`); the plan screens never do. `canAfford`, Loan Lab, `monthEnd`, `costOfLife` and `scoreGuess` stay on the rules engine (affordability rules need per-month cash and card balances that `Forecast` does not carry). The ladder's 10-year preview (S5–S9) stays on the rules engine, labeled "Rules-based preview". The explain route words a move's sentence by its `source`; a Next Move on `/plan` is measured by `planMoveEffects` on the rules engine, so its sentence uses the rules wording.
- **Replacing the model later:** a trained model answers the same request and response with a new `ForecastSource` value. The sanity envelope and the rules provider stay as guards and as the baseline it has to beat.

### AI growth estimate ("Estimate with AI" for growth rates)

**The second place an AI proposes a number, with the same safeguards as the AI forecast:** validated in code, labeled "AI estimate" wherever it shows, the rules default stays when it fails, and never presented as engine-computed. The model only proposes an **input**: a long-run average yearly change in an asset's value (a decimal, `0.06`). `plan()` and `monteCarlo()` do every projection with whatever rate is in the field; no balance, KPI or range ever comes from the model.

- **Where:** the Add account form and Account detail (asset types with the yearly-change field: investments, retirement, real estate, vehicle, other), and `/plan` → Assumptions → Growth per year (one suggestion per group, cash included).
- **Route:** `POST /api/ai/growth` (`GrowthEstimateRequest` / `GrowthEstimateResponse` in `packages/types/plan.ts`; server `src/server/ai/growth.ts`). Same client, model (`llmModel()`, effort low), structured output (zod → JSON schema), rate limit (shared with parse and explain) and error shape as the other `/api/ai/*` routes; no key → 503 and the UI keeps the default.
- **Checks (in code):** strict zod parse of the answer; each rate finite, a decimal and inside its group's envelope, `aiGrowthEnvelope` in `assumptions.ts` via `growthEstimateIssues` (`packages/engine/growthEstimate.ts`): cash 0…+6%, investments and retirement −5…+15%, real estate −5…+12%, vehicle −35…+5%, other −50…+50% (guards against wrong units and runaway answers, not accuracy grades); the reason is one line of at most 200 characters, with no link or buy/sell advice, and any percent it states must match the rate within 1 point (catches `0.5` written for 0.5%). One retry with the issues listed; then an account gets a typed error (nothing fills), and the plan keeps every group that passed and lists the rest in `rejected` (their default stays). The client checks the envelope again before it offers a rate.
- **Labeling:** an accepted rate is the plain `Account.growth` or `PlanAssumptions.growth[group]` override, plus an `AiGrowthNote` (`{ source: 'ai', reason }`) in `Account.growthNote` / `PlanAssumptions.growthNotes[group]`, so the UI shows "AI estimate" and the reason. Typing a rate or "Use default" drops the note. On `/plan` a suggestion is shown next to the sourced default (real estate keeps its FHFA source and "Default growth is …") with Apply per row or Apply all; it never replaces a default by itself.
- **Privacy (rule 6):** an account request carries only its type, the name the person typed and its value; a plan request the area (metro and state, no ZIP), totals and counts by group (no names, no ids) and the current defaults. The defaults stay out of the prompt itself: shown them, the model just repeated them; the UI shows its estimate next to each default instead. Nothing is stored on the server and the prompt is never logged (dev logs carry only the mode and stop reason). The UI says so next to the button.

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

- Props without a `clue` are decor (plants, lamps, posters) and must not suggest a cost (no luxury decor in a cheap home). Decor depends only on the layout (skyline, lamp and plant in the living room, a tree in the yard, one bed per bedroom; a studio has a sleeping loft and the bed in the living room), so two homes with the same layout look the same until a room is opened.
- Car price bands (`CAR_PRICE_BANDS`: economy < $25k ≤ mid ≤ $45k < luxury), takeout buckets (`TAKEOUT_BUCKETS`) and the clue → cost-line map (`CLUE_COST_CATEGORIES`) live in `scene.ts` as named constants. `sceneOf` throws when the area is not the card's ZIP.
- Sprite ids (`SPRITE_IDS`) are file paths under `apps/web/public/scene/` (`garage/luxury` → `garage/luxury.svg`). The placeholder kit there is drawn in the Dollhouse palette; the D1 kit replaces it one-for-one by id. The ids, the layout shells' 400 × 320 room grid and what each sprite stands for are in `apps/web/public/scene/README.md`.
- `<HouseScene>` (`apps/web/src/ui-kit/HouseScene.tsx`) renders the layout shell, the decor and the closed rooms (each shows what opening it costs). A tap zooms the house into the room (CSS transform; instant with reduced motion), raises `onOpenRoom` (the game view-model's `openClue` → `/api/daily/clue` or the fixture client), and the close-up under the house shows the room's props and facts. Esc or "Back to the house" zooms out and returns focus to the room. `features/game/ui/HouseSceneClues.tsx` maps the view-model onto it and is `PlayScreen`'s default `ClueSlot`; the static `ClueBoard` takes the same props and stays as the fallback.
- Tests (`packages/engine/scene.test.ts`): a snapshot of `sceneOf` for every fixture card, and a consistency test over every fixture card (and the full deck from `@lifeguessr/data` when present) that turns each clue's props back into the cost lines they stand for and compares them with `costOfLife`: no-car sprite ⇔ no car lines, band ⇔ price, loan tag ⇔ loan payment line (amount checked), childcare = Σ the area's price per kid prop, groceries = coats, the takeout pile = the bucket of the meals the eating-out line prices, rent = the layout's bedrooms, tier sign = the area's tier; and every cost line of a card is covered by a clue or the layout.

### Next Moves (Amir, Y3)

Generate candidate moves for the current level. Apply each move's `patch` with `applyPatch` to a copy of the profile, and compute `effect10y = forecast(withMove).in10y.mid − forecast(base).in10y.mid`. Sort in descending order and return the top 3.

Level 1 candidates:
- `payCardFirst`: `extraPayment` on the highest-APR card.
- `cutCategory`: cut the largest discretionary category (eatingOut, subscriptions, other) by 20%.
- `cancelSubscriptions`: only when a statement was uploaded and subscriptions were detected.

Level 2 unlocks once a level 1 move is in `doneMoveIds`, or is `committedMoveId` and has been checked in on. It adds: retirementMatch, hsa, refinance, negotiateRent (local rent data), reshopInsurance. These need inputs the profile doesn't have yet (employer match, insurance quote), so they stay in the mock path for the hackathon.

Implementation details (Y3, `packages/engine/moves.ts`):
- `effect10y` is in today's dollars (what the plan shows), with the same `rates` for both forecasts; pass the area's inflation as the plan does. The order is the same in nominal dollars.
- Horizon picker: `rankCandidates` ranks by whatever effect `effectOf` returns. `rankMoves` passes the 10-year rules effect; the web app passes the gain at the year picked on the legacy Future screen (1, 3, 5 or 10), read from the answered forecast bundle, so a short horizon can change which move wins (a card payoff pays off early, a spending cut builds up slowly). The $1 floor (`MIN_EFFECT_10Y`) applies to that effect. `Move.effect10y` stays the 10-year number (Goals, through `rankMoves`, and the stored committed move rely on it; loans and overpaying keep their own `effect10y` with the same meaning); the gain at the picked year is `MoveVM.effect`, with `horizonYears`. "Why?" sends it as `horizon: { years, effect }` in the explain request, so the sentence is about the gain on screen and names the year; without `horizon` it is about 10 years, as before. Explanations are kept per move and horizon (picking a year back shows its sentence again, no new request), and one is reused only for the same move, source, effect and horizon.
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
usual (per category)      = mean of the last 3 full months, or the profile's value with fewer months
projection (per category):
  bill categories         = max(spent so far, usual)       (rentUtilities, childcare, subscriptions, car)
  every other category    = current month total so far / day × days in month
projectedSpend            = Σ projections                   (debtPayments excluded; oneOffs are not in totals)
average = mean of last 3 full months per category
spread  = max(sample std dev, 10% of average, $25)
drift   = projection − average; flag if |drift| > spread
vsAverage = projectedSpend − Σ averages
```

With fewer than 3 months of history, `vsAverage = null` and `drifts = []`. Without any upload, the Dashboard (P1) shows the monthly spend implied by the profile and no drift flags. That also applies when there is history but no statement rows for the current calendar month; the Dashboard then says that this month has no transactions yet (and, with 3 months of history, that only this month's statement is missing), never that more months are needed.

`day` is how far the month in progress has data: the Dashboard and Budget pass the day of the statement's latest line that month (`CategoryTotals.lastDay`), not today's date, since days after the statement ends have no data yet and would project the month too low. Statement months saved before `lastDay` existed fall back to today.

Why bill categories are not extrapolated: rent paid on the 1st would project as rent × 30 on day 1, and as about twice the rent mid-month (the sample statement on Nov 14 would flag rent about $2,000 over). A bill is paid in one lump, so it is projected as the larger of what was paid and the usual amount, and it drifts only once it has really gone over. `car` mixes fixed insurance with variable gas, so it is floored at usual and not extrapolated either. The list, the 3-month window, the 10% share and the $25 floor are in `assumptions.ts` (`monthEnd*`). The sample std dev (n − 1) and the $25 floor keep a few dollars in a usually empty category from being called drift.

Other rules: only months strictly before the current month count as history; a negative category total (refunds above spending) counts as 0; drifts are sorted by size. Malformed input (a bad `YYYY-MM`, a day outside the month, a non-finite total, the same month twice) throws a `RangeError`.

### Daily log (`dailyMonthToDate`; one of the two sources of Budget's actuals, P5)

Entries (`DailyEntry`: id, local date, category, amount, label?) live in the browser's app store only (persisted v2). The month so far comes from the same engine as the statement month-end (`daily.ts`):

```
current      = dailyMonthToDate(entries, month, today)     → monthEnd(profile, history, current)
               (spent so far per category, days 1..today; day = today, since the log is complete up to now)
usual        = usualMonthSpend(profile, history, month)     (monthEnd's rule: mean of the last 3 full
               statement months, else the profile; debtPayments left out)
spent        = Σ month-to-date, debtPayments left out
billsDue     = Σ over bill categories of max(0, usual − paid so far)   (rent etc. not paid yet is still owed)
remaining    = usual.total − spent − billsDue                (negative = over the usual month)
daysLeft     = days in month − today + 1                    (today counts)
safe today   = max(0, remaining) / daysLeft
```

"Safe to spend today" is the spec's (planned − spent so far) ÷ days left, with the usual month as planned and the bills not yet paid this month held back, so an unpaid rent is never shown as spendable.

Parsing a line ("coffee 5, taxi 18, groceries 64") is local first (`features/spend/model/parseLine.ts`: one amount per part, the category from a keyword table, English and Russian). Only when a part has no amount, two amounts or no known word does the line go to `/api/ai/parse` with `kind: 'spend'`; the server rejects (and retries once) any amount not written in the text, and the browser keeps every amount its own parser read. The user confirms the AI's reading before it is saved. With the AI off, parts with amounts are offered with a category to pick. Preset chips (coffee $5, lunch $15, …) are typical prices we picked, tagged as estimates.

### Statements (Aibek, T6/T7)

The pipeline behind S9: `features/upload/model/readStatementFile.ts` → `lib/statement/*` (browser) → `POST /api/statement/categorize` → `statementTotals` (engine). S9 opens with a fork: a bank CSV (most accurate, about a minute) or, without one, the S7 sliders and free text as the fallback.

**Reading the CSV (browser, `lib/statement/read.ts`).** The header row is found by name anywhere in the first 30 rows (banks put summaries above it); a file without a header has its columns inferred from the cells. Dates: ISO, `MM/DD/YYYY`, `M/D/YY`, `YYYY/MM/DD`, `Oct 1, 2026` (US order, never DD/MM). Amounts: `$1,234.50`, `(12.50)`, `-$12.50`, `12.50-`. The sign convention is detected, in this order: separate Debit/Credit columns; a Debit/Credit type column; pay deposits (they are money in); else the sign most lines have (most lines are spending). Pending lines and lines that aren't transactions are skipped and counted, shown on the review. Comma, semicolon and tab separators, BOM and CRLF are handled.

**Masking (`lib/statement/mask.ts`, run in the browser and again on the server; idempotent).** Person-to-person lines become `Zelle to [name]`, `Venmo from [name]` …; transfers become `Transfer to savings` (or `[name]` when the other side isn't an account type); ACH name fields (`INDN:`, `IND NAME:`) are masked; e-mails, 4+ digit runs (card, account, phone, store numbers), `XXXX1234` and letter-digit reference codes become `[email]`, `#`, `[ref]`. Each line sent is `{ label, amount, month, day }`.

**Named counterparties (T6).** Bill-pay, online-payment-to, check-payee, deposit-from and bare ACH credit/debit descriptions are reduced to a fixed payment-kind label plus `[name]`. The entire counterparty and memo are dropped before sending; the server applies the same rule again. This deliberately masks business payees too: category words (`power`, `water`, `rent`, `gas`, `grill`, `kitchen`, `pub`) and suffixes (`CO`, `BANK`, `LLC`) do not prove a description is free of personal names. Ordinary card purchases retain their merchant. A masked business payment may need manual category correction on S9. No merchant or category allowlist bypasses this rule.

**Categorizing (server, `server/statement/*`).** The distinct (direction, masked label) pairs, never amounts or dates, go to the LLM in chunks of 100 (at most 400 per request), which returns a `StatementClass` and a "typically one-off or yearly" flag per label (zod-checked; one retry with the problems listed; what is still invalid or missing uses the keyword rules). Without an API key, or when the provider fails, the keyword rules (`rules.ts`) sort everything. The response says which: `categorizedBy: 'ai' | 'rules' | 'mixed'`. Nothing is stored.

**Totals (engine, `statementTotals`; whole cents).**

- Money out in a cost category → that category's month total; money out sorted as `transfer` (own accounts, investments) is left out.
- Money in sorted as `pay` → `detectedPay`; as a cost category → a refund off that category (never below 0); as `transfer` (money from people, interest, own accounts) → left out.
- One-off: a merchant (label without digits and masks) seen in only one month of a statement covering 2+ months, not rent/utilities, childcare or debt payments, and either flagged by the categorizer with an amount ≥ `oneOffHintMinAmount`, or ≥ `oneOffOutlierMinAmount` and ≥ `oneOffOutlierMultiple` × that category's median charge. One-offs are listed in `oneOffs` and left out of `totals`; the browser drops their labels when the months are applied.
- `firstDay` / `lastDay`: the day of the month's earliest and latest line of any kind (how much of the month the statement covers).

**Averages (engine, `statementAverages`).** The profile's spending (measured) is the mean of each category over the months the statement covers in full: first line within `statementFullMonthSlackDays` (7) of the 1st and last line within 7 days of the month's end. An export that runs to Nov 12 or starts on Aug 17 holds only part of that month, which would pull every category and pay down (the sample's November: groceries $169 against ~$520). With no full month (a two-week export), every month is used. An essential category (`statementEssentialCategories`: rent and utilities, groceries) with $0 in every averaged month is left out: a card-only statement without rent says the rent is paid elsewhere, not that it is $0, so the profile keeps its value and S9 asks (below). The review marks a partial month; S7 says which months the sliders came from.

**Follow-up questions (JF6; engine `statementFollowUps`, server `statement/followUps.ts`).** At most `MAX_STATEMENT_FOLLOW_UPS` (3), in this order:

1. `missing`: an essential category with nothing in any full month → "do you pay for it another way?"; the user may type a monthly amount, which becomes that category's value (measured: they said it) when the months are applied. It is not written into the months, so month-end never treats it as history.
2. `cash`: ATM and cash withdrawals, grouped into one question → which category the cash mostly pays for.
3. `merchant`: money out sorted as `other`, grouped by `merchantKey` (a store that sells everything, a payment to `[name]`), biggest first → which category it mostly is.

Cash and merchants are asked from `statementFollowUpMinMonthly` ($20) a month, averaged like the profile (full months, one-offs left out, refunds from the merchant subtracted). Every amount is code; the model only words the question. It sees the kind and the masked label (or the category's name), never an amount; its question must be short, end with "?", contain no number (digits or number words, `extractNumbers`) and no mask, with one retry listing the problems; otherwise the screen's template (`copy/ladder.ts`) is used, and without an API key nothing is sent. The categorize reply carries `lines` (each request line's class, in order) so the browser can apply an answer: `applyFollowUpAnswers` re-sorts the group's `other` lines and `statementTotals` sums the months again, the same function the server used. The classified lines stay in memory; only the category totals are saved. Each question can be skipped (nothing changes).

## AI usage rules

- Allowed: parse free text into typed JSON (`life`, `purchase`, `loan`), categorize merchant labels, tag one-off or yearly charges, write card captions, give 2-sentence explanations of an engine result, and produce the **AI estimate line** on `/plan` under the checks in **AI forecast** above (a labeled second opinion, hidden when it fails). The second place an AI proposes a number is the **AI growth estimate** (above): a yearly growth rate the person can apply and edit, with the same safeguards (validated, labeled "AI estimate", the rules default on failure, never presented as engine-computed).
- Not allowed: computing or inventing a number for the plan, its KPIs, the Monte Carlo range or Chance of success, loans, costs, guess scores, affordability, budget rows, cash flow or month-end; any AI forecast number that has not passed the AI forecast checks, or any use of the AI line in a KPI, a verdict or a Next Move; or giving advice about specific lenders, securities or tax.
- Numbers parsed from user text are inputs, not results. Show them to the user to confirm before they enter the profile.
- Labels sent for categorizing have account numbers masked, and personal names on payment-app and transfer lines (other lines: #19). The provider does not train on API data; zero data retention is not enabled, so no copy may claim it.
- Always: a zod schema on the output, one retry on validation failure, then a fallback (the manual form for parsing, a template for explanations, hiding the AI estimate line for the forecast: the plan itself is the engine's and needs no fallback; keeping the engine default for a growth estimate). Log prompts and responses in development only.

## Testing

- Vitest: every engine function, plus the golden forecast snapshot and the golden `plan()` snapshot for `scenario.demo.json`. Include edge cases:
  - `monteCarlo` with the same seed is identical; with every sd = 0 it equals `plan()`;
  - `plan()` with default options reproduces `forecast()` within $1 at month 12;
  - scoring is continuous at the range edges, and a guess ≤ 0 scores 0;
  - `canAfford` with `payWith: 'card'` can return "no";
  - a loan whose payment doesn't cover interest returns `payoffMonth: null`;
  - `low ≤ mid ≤ high` holds for every fixture card;
  - the clue multiplier applies and floors at `clueFloor`.
- Playwright (T8): `apps/web/e2e/demo-path.spec.ts` walks the full demo path (the Duel → guess own → sliders → Dashboard → `/plan` + Buy a home → Next Moves → Chance of success → Compare → upload sample CSV → Transactions / Cash Flow / Budget; MP18 #178 rewrites the spec from the older path of play 3 homes → guess own → closest life → sliders → forecast → upload sample CSV → Loan Lab compare) on a phone and a desktop viewport. With funnel events on (`NEXT_PUBLIC_EVENTS_SOURCE=api` and a store, as in CI) it also checks each step's event was sent without personal data and that `GET /api/events/funnel` counts it. `pnpm e2e` runs it with every other spec.
- AI forecast: tests replace the Anthropic SDK module (`server/ai/testUtils.ts`). CI and Playwright never call a live model, and Playwright runs with no key, so `/plan` shows no AI line (it is hidden, as it is whenever it fails its checks) and every number comes from the engine. The eval script (Y19) is the only thing that calls the live model, and it is not part of CI.
- AI forecast eval: `pnpm eval:forecast` calls the live model, so it costs API calls and is never run by CI or `pnpm test`. It asks `EVAL_RUNS` times (default 5) for the demo profile as it is and for the same profile with every input measured, with the request the app sends and without the route's cache; it reads `ANTHROPIC_API_KEY` from the shell or the repo root `.env`, and without a key it skips and says why. It reports the spread of the model's 10-year mid, its gap to the rules engine's mid, the mean band width, and whether the band is narrower for the measured profile than for the estimated one.
- Run `pnpm lint && pnpm test && pnpm e2e` before merging anything that touches the demo path.

## Figma handoff procedure

1. The designer names frames by screen ID (P1–P12, and S5–S9 for the onboarding steps) and components by ui-kit names.
   The house sprite kit is exported as SVGs to `apps/web/public/scene/`, named by the sprite ids that `scene.ts` uses (layouts, then props per clue, then decor). The list of ids is agreed at Hour 0.
2. Export Figma variables to `tokens.json` (colors including chart palette, type scale, spacing, radius, shadows). Run `pnpm tokens` to regenerate `tokens.css`.
3. Restyle the ui-kit first; every screen inherits it.
4. Per screen: rewrite only `features/<feature>/ui/*`, consuming the existing view-model props. If data is missing, extend the view-model and fixture, not the UI.
5. After each screen, the lint import rule, tests and e2e must pass.
6. If Figma is late, ship the placeholder UI built on the same tokens, and skin P11 (the Duel), P1, P8 and P10 first.

## Cut order if time runs out

There is **no cut line** in the pivot (epic #160): every task MP1–MP19 ships. Order still matters: follow the dependency graph in `docs/TASKS.md` so the demo path works at every merge, and every merged PR keeps the live link working. Never cut the engine tests, the Duel or the plan.

If the house scene isn't playable at Sync 2, ship the static card (same view-model and routes; clues become tap-to-reveal rows) and keep building the scene behind a flag.

### T6 real-export acceptance (#19)

Synthetic fixture tests cover the sample and debit/credit, signed-bank and credit-card layouts. They do not satisfy the two-real-export gate. With two anonymized real CSV exports stored outside this checkout, run:

```sh
REAL_STATEMENT_EXPORTS='["/absolute/path/bank.csv","/absolute/path/card.csv"]' pnpm exec vitest run apps/web/src/lib/statement/realExports.test.ts
```

The opt-in check requires two distinct files, parses them locally, and validates the masked wire items without calling an API or logging their contents. It is skipped when paths are absent. Record the bank export formats and pass/fail outcome in the PR after running it; do not call synthetic exports real. This gate is still pending until the actual files are supplied and checked.
