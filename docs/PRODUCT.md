# PRODUCT.md — business context

## One line

A Monarch-style money planner without the bank login: a yearly plan to age 90 with life events, a Chance of success (Monte Carlo) and Next Moves ranked in dollars, plus Accounts, Transactions, Cash Flow, Budget, Recurring and Goals. A viral daily game, the Duel, is how people discover it. Why we rebuilt around the planner: `docs/PIVOT.md`.

Name: **LifeGuessr** is the working name. Shortlist: Tomoro, Fork, Plotto, Ahead, Should I? (still to be checked for existing apps and domains).

## The hackathon

- **Event:** Zimran Business Cup, a 24-hour build. The judges work at Zimran (Almaty), which makes consumer subscription apps (Finelo, Coursiv) and are experts in onboarding, paywalls and retention.
- **Brief:** a B2C web product for US adults aged 25–45 that solves a fundamental pain they will pay for. There are three tracks: Money, Entertainment and Skills. **We submit under Money, with Entertainment as the retention and marketing engine.**
- **Judging criteria (from the organizers' slide):**

| Weight | Question | What it means for us |
| --- | --- | --- |
| 40% | Does it work? | Works end to end in production; core value real, not hardcoded; UX and code quality ("we read your repo") |
| 20% | What do we sell? | Clear what the user pays for and why they come back tomorrow |
| 15% | Who do we sell to? | Clear problem, deep understanding of the target user |
| 15% | Why does it make money? | Big or growing niche, $100M ARR potential, LTV > CAC |
| 10% | Is it new? | Not a copy-paste of an existing business |

- **Judge tests:** the problem must be clear in one sentence with no US jargon; a judge must see it working in under 2 minutes with no US documents; there must be a believable reason to return within a week.

## Problem

Adults aged 25–45 make their biggest money decisions (rent, car, kids, debt, job offers) without a feel for what things cost or where their choices lead.

- People underestimate even small recurring costs. In a C+R Research survey, quick guesses averaged $86/month on subscriptions against $219 when itemized.
- US credit card balances hit about $1.29T in Q3 2026 (New York Fed). The average card APR is about 22.8%.
- Budget apps mostly look backward ("where your money went"). Forward-looking planners (ProjectionLab, Boldin, Empower, Monarch's Forecasting) are built for retirement planners, or sit behind a bank login and a high price, and are opened a few times a year.

## Target user

US adults aged 25–45 with a job, bills and at least one big decision ahead. Typical: rents, has a car payment and some card debt, and is thinking about moving, a car or a kid. Secondary: couples planning together.

## Product: features

The sidebar (desktop) or bottom tabs (phone) holds: Play, Dashboard, Plan, Accounts, Transactions, Cash Flow, Budget, Recurring, Goals. Screen IDs P1–P12 and routes are in `docs/ARCHITECTURE.md`. Tasks MP1–MP19 (epic #160) are in `docs/TASKS.md`.

| ID | Feature (screen) | What it does | Status |
| --- | --- | --- | --- |
| F1 | **Duel** (P11, `/play`): the daily game, the front door | "Which life costs more?": 5 rounds a day, two composite lives each, pick the costlier, optional hint (900 points instead of 1,000), reveal with category bars, sources and year, a shareable result and a challenge link. Server-scored; the answers never reach the browser before the pick | Real |
| F2 | **Guess Yourself**, **Closest Life**, **Quick Sliders**, **Balance sheet** (onboarding after the game) | Guess your own month, pick the closest life, rent / car / food / subscriptions / savings sliders (~30 s), then age, take-home pay, cash, retirement, card balance and APR, other loans. Skipped fields become estimates. The balance sheet edits the same accounts as P2 | Real |
| F3 | **Dashboard** (P1, `/`) | Net worth with the 1-month change, this month's spending pace, budget summary, top Next Move, today's Duel card and streak, recent transactions, a setup checklist (x of 5) | Real |
| F4 | **Accounts** (P2, `/accounts`, `/accounts/[id]`) | Manual accounts: Cash, Investments, Retirement, Real estate, Vehicle (assets); Credit card, Loan, Mortgage (liabilities). Name + balance, net worth = assets − liabilities, balance history. Names stay in the browser. "Connect a bank" is a disabled "coming soon" card | Real |
| F5 | **Transactions** (P3, `/transactions`) | CSV import (parsed in the browser, names masked), list with search and filters, manual add, change a category ("apply to all from this merchant"), export. Lines are stored in the browser only | Real |
| F6 | **Cash Flow** (P4, `/cash-flow`) | Income, expenses, savings and savings rate by month, quarter or year; Sankey by category | Real |
| F7 | **Budget** (P5, `/budget`) | Planned vs actual per category with a "where you should be today" marker. "Create my budget" fills Planned from **our sliders and area data** (Monarch fills a generic sample). Replaces the monthly check-in | Real |
| F8 | **Recurring** (P6, `/recurring`) | Detected recurring charges (the subscription audit, moved into the shell) | Real |
| F9 | **Goals** (P7, `/goals`) | **Save up** goals (On track / At risk / Completed, the monthly amount to stay on track) and **Pay down** = Loan Lab (compare 3 loans, debt-load gauge, extra payments, payoff order) | Real |
| F10 | **Plan** (P8, `/plan`), the hero | A yearly net-worth line from today to age 90 (the part below zero is red and hatched), four KPIs (net worth at year end, at retirement, retirement age, at the end), tabs Accounts / Cash Flow / Events (all views of one simulation), an Assumptions panel (inflation, today's vs future dollars, withdrawal order, savings split), an **Add event** catalog (Income, Expense, Buy a home, Have a kid, New job, Career break, Windfall, Retire, Social Security) whose defaults come from our area data, autosave, and Next Moves ranked in dollars. Deterministic: `plan()` | Real |
| F11 | **Compare** (P9, `/plan?view=compare`) | Two scenarios (a copy of assumptions + events) overlaid, with a sentence like "Plan B leaves you $34K richer by 2036". Replaces Decide | Real |
| F12 | **Chance of success** (P10, `/plan?view=chance`) | 1,000 seeded Monte Carlo paths: a fan, a 10th–90th percentile band, a success % gauge, histograms of net worth at retirement and at the end, shortfall age; settings for inflation and growth spread, number of paths, fixed seed | Real |
| F13 | **AI estimate line** (on P8) | The AI forecaster's 10-year line as a labeled **second opinion**: shown only when it passes the code checks and falls inside the Monte Carlo p5–p95 band; hidden otherwise. It never feeds a KPI or a move | Real (labeled; hidden on failure) |
| F14 | **Make It Exact**: CSV statement upload | Tightens the range and fills Transactions, Cash Flow and Budget; or connect a bank app (read-only, through an aggregator), as most US budgeting apps do | Real (CSV); PDF if time allows; bank connect = "coming soon" button |
| F15 | **Pro / Paywall** (P12, `/pro`) | A simulated in-app checkout (demo card, nothing charged; Stripe Checkout in test mode instead when a key is set) plus a promo code on screen for the jury; gates saving purchases to the wishlist | Simulated payment, labelled as such (no real or test money moves) |
| F16 | **Game as marketing** | Share cards (9:16 and 1:1) and challenge links for the Duel's day result | Real |

**Folded in from the old build:** Can I Afford It? is now the **Expense** event on the plan (a one-off or financed purchase); Decide is **Compare**; the monthly Check-in is **Budget** (planned vs actual); Loan Lab is **Goals › Pay down** (and inside an Expense event with financing).

**Left the navigation:** the features that no longer have a place in the sidebar are listed in `docs/PIVOT.md` (their code stays until after the demo, then is deleted). Investments tracking is cut: an Investments account is just a balance.

### User journey

Play the Duel → guess your own month → sliders → Dashboard (net worth, this month) → **Plan** (the line to age 90; add Buy a home) + Next Moves → Chance of success → Compare → (optional) upload a statement: Transactions, Cash Flow, Budget → come back daily (the Duel) and monthly (Budget).

The paywall appears after the user has seen their own plan.

## Game design: the Duel (P11)

The game is the front door. Each day everyone gets the same five rounds. A round shows two composite lives (a metro, a household, a home size, a car, how often they eat out) and asks "Which life costs more per month?".

- **Pick:** tap the life you think costs more. Rounds can be played in any order; one pick per round per player per day.
- **Hint:** an optional extra fact on both lives (each life's neighborhood tier). Using it lowers that round's score from 1,000 to 900.
- **Score:** 1,000 points for the costlier life (900 after a hint), 0 for the other. A pair whose lives cost the same is never served.
- **Reveal:** both monthly totals by category with source and year, what decided it, and the crowd's split once at least 20 players have picked.
- **Day result:** a spoiler-free tile grid, the total, a share card (9:16 or 1:1 PNG) and a challenge link that shows a friend's real score before they play ("Your friend got 4/5 · 3,600 points").
- **Bridge:** "Now guess your own month." (Guess Yourself) → Closest Life → Quick Sliders → Balance sheet → Dashboard.
- **Day shape:** round 1 is easy, round 5 is a curveball (e.g. childcare costs more than rent).
- **Integrity:** the server holds the answers. The browser gets only the lives' public facts, hints are fetched on request, and picks are scored server-side from what the server recorded; the client never sends a score.
- **Rollback variant:** the earlier slider game (explore an illustrated dollhouse cutaway, tap rooms for clues that cost points, guess the monthly cost on a log slider, streamer mode) is kept behind `NEXT_PUBLIC_GAME_MODE=slider` and is not in the navigation.

## Retention loop

- **Daily (1 min):** the Duel, a streak, sharing. Planned: guess your own week's spending before you look (the game becomes budgeting practice).
- **Content runway:** 50 hand-made cards at 5 a day give only 10 days of new sets. After the hackathon, generate cards from `areas.json` × lifestyle templates so the daily set never repeats within a season.
- **Monthly (3 min):** Budget: planned vs actual per category and the "where you should be today" marker; a new statement updates Transactions, Cash Flow and the plan.
- **On demand:** the Plan (add an Expense or Buy a home event when a real decision comes up, then Compare) and Goals › Pay down (Loan Lab).
- Bill yearly first, so one skipped month doesn't lead straight to a cancellation.

## Business model (assumptions, label them as such)

- **Free:** the daily Duel, the Dashboard and one plan with the Baseline scenario.
- **Pro:** $39.99/year (yearly first) or $6.99/month. Includes saved scenarios and Compare, Chance of success runs, Goals and Loan Lab history, a wishlist and move levels. (The simulated checkout is built; exactly which screens it gates is an assumption to tune.)
- RevenueCat SOSA 2026: low-priced apps retain 36% vs 23% for high-priced apps, which supports a low price.
- Growth: game clips by creators and share cards. Target CAC under $15; LTV around $45–60 (assumption). Check: $39.99 / (1 − 36% yearly renewal) ≈ $62 gross before payment fees and refunds, consistent with that range.
- $100M ARR at $39.99/year means about 2.5M paying subscribers. Have this number ready for the "Why does it make money?" question.
- Market proof: Monarch Money reportedly reached about $100M revenue in 2026 (Sacra), and its Forecasting sits in the $299/year tier.

## Marketing: the game as the channel

- **Challenge links:** the Duel's day result links a friend straight into the same five rounds with your score to beat.
- **TikTok:** 9:16 result cards and reveal clips ("I picked the wrong life. It cost $1,200 more.").
- **Creator packs:** "Your city vs mine" (the creator packs are cut order items).
- **Funnel:** clip → play (no sign-up) → guess your own → sliders → Dashboard → Plan → paywall.
- **Guardrails:** cards are fictional composites from public averages; no prizes (avoids sweepstakes law).

## Competitors and positioning

| Product | Bank link? | Shows future? | Ranks decisions in $? | Daily habit? | Price (2026, re-check) |
| --- | --- | --- | --- | --- | --- |
| ProjectionLab | No | Yes | No (scenario compare) | No | Free; Premium $129/yr |
| Boldin | Optional | Yes (retirement) | No | No | Free; PlannerPlus $168/yr |
| Monarch Plus (Forecasting) | Yes | Yes (plan to a chosen age, Monte Carlo) | Scenarios | No | $299/yr |
| **Us** | **No** (sliders, manual accounts, CSV in the browser) | **Yes** (plan to 90, Chance of success) | **Yes** (Next Moves and events) | **Yes** (the Duel) | Free; Pro $39.99/yr (assumption) |
| Empower | Yes | Yes (retirement) | No | No | Free |
| Monarch Core / Copilot / Cleo / Rocket Money | Yes | Mostly no | No | No | ~$4–15/mo |
| Housle / PropQwiz (house-price games) | No | No | No | Yes | Free |
| ChatGPT/Claude + statement | No | Ad hoc | Inconsistent | No | ~$20/mo |

**Beat line:** Monarch's best feature is the forecast, and it is behind a bank login and a $299/year plan. We give a 25–45 adult that plan in 2 minutes, from a game, with no bank login, and rank which decision to make next in dollars.

**What is different from Monarch** (we take its information architecture and math; we never copy its name, logo, copy, colors, icons or illustrations):

- **No bank login.** Sliders, manual accounts and a CSV parsed in the browser. Account names and transactions stay in the browser.
- **A game as the front door.** The Duel gives a reason to come back tomorrow; Monarch has no daily habit.
- **Local public data behind every default.** Rent, childcare, property tax, home insurance and home appreciation by area (HUD, Census, BLS, FHFA, NAIC). Monarch uses flat rules of thumb: our Buy a home and Have a kid events start from the user's ZIP.
- **Moves and events ranked in dollars.** Next Moves ("Raise your 401(k) by 3% = +$41k at 65") on the plan screen.
- **Price.** Pro at $39.99/year (an assumption to test) against Monarch's $299/year plan.

**Why not ChatGPT?** A chatbot has no memory of your life; the app saves your profile, tracks forecast against reality, ranks your next moves in dollars, and comes with the daily game. Be straight about where the AI is: the plan, every KPI and Chance of success are computed by tested, deterministic code (`plan()` and a seeded Monte Carlo), so the same inputs and seed give the same answer. The AI forecaster is only a second opinion: a separate line labeled "AI estimate", checked in code against the Monte Carlo band and hidden when it fails. Loans, costs, scoring, budget rows and affordability are also computed by tested code.

Avoid saying "budget apps only look at the past". Monarch and PocketSmith do forecast. Say: "they forecast your accounts; we forecast your decisions, and rank which one to make next."

## Two-minute demo script

Same as `docs/PIVOT.md`.

1. Judges scan the QR code and play one home of the daily Duel (30 s); the reveal shows what decided it. Guess your own month.
2. Three sliders → the Dashboard shows your net worth and this month.
3. Plan: the line to age 90. Add "Buy a home" in 2029: the mortgage, tax and insurance come from data for your area, and the line drops.
4. Next Moves: the top move and its dollar effect.
5. Chance of success: 1,000 paths and the success %; change the seed and get the same result with "fixed seed" on. Compare: the two scenarios overlaid.
6. Upload the sample CSV → Transactions, Cash Flow Sankey, Budget planned vs actual.
7. Show the guardrails: the tests for `plan`, `expandEvent` and `monteCarlo` in the repo, the "How we calculate" panel, and the labeled "AI estimate" line (visible only when it passes the checks and falls inside the Monte Carlo band; with no key it is simply absent). Do not run a "ChatGPT twice" comparison.

## Metrics to show

Game: rounds played, hint rate, finish rate, challenge-link opens. Funnel: finished game → guessed own cost → sliders → Dashboard → viewed the plan → added an event → ran Chance of success → upload → saw paywall → paid. Plus share rate and plays per shared link.

## Legal and wording

- "Educational simulation, not financial advice."
- No lender recommendations, no referral fees, no securities advice.
- No prizes in the game.
- Don't use Zillow data or photos. Don't use MIT Living Wage data directly (all rights reserved); use its public underlying sources.
