# PRODUCT.md — business context

## One line

A forward-looking budget planner: it forecasts your month and you in 10 years, and ranks your next money moves and decisions in dollars. A viral daily guessing game is how people discover it.

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
- Budget apps mostly look backward ("where your money went"). Forward-looking planners (ProjectionLab, Boldin, Empower) are built for retirement planners who open them a few times a year.

## Target user

US adults aged 25–45 with a job, bills and at least one big decision ahead. Typical: rents, has a car payment and some card debt, and is thinking about moving, a car or a kid. Secondary: couples planning together.

## Product: features

| ID | Feature | Status in the 24h build |
| --- | --- | --- |
| F1 | **Five Lives**: a daily game with 5 homes to explore (illustrated dollhouse cutaways); tap rooms for clues, guess the monthly cost; the same set for everyone | Real |
| F2 | **Typical Range reveal**: cost range with bars per category, each showing its source and year | Real |
| F3 | **Guess Yourself**: one slider for your own monthly cost | Real |
| F4 | **Closest Life**: pick one of today's cards as your starting point | Real |
| F5 | **Quick Sliders**: rent, car, food, subscriptions and savings (~30 s) | Real |
| F6 | **Balance Sheet in 6 taps**: age, take-home pay, cash, retirement, card balance and APR, other loans; skipped fields become estimates | Real |
| F7 | **Make It Exact**: CSV statement upload (parsed in the browser) that tightens the range; or connect a bank app (read-only, through an aggregator), as most US budgeting apps do | Real (CSV); PDF if time allows; bank connect = "coming soon" button |
| F8 | **You in 10 Years**: forecast line with a range band, in today's dollars by default | Real |
| F9 | **Next Moves**: top 3 moves ranked by 10-year dollar effect; levels; an "I'm doing this" commitment | Real (level 1) |
| F10 | **Decisions**: car, moving city, having a kid, job offer, wedding (Path A vs B) | Mock (car example) |
| F11 | **This Life vs Yours**: each game card compared with your own numbers | Real if time allows |
| F12 | **Monthly Check-in**: forecast vs 3-month average, drift flags, progress on your committed move | Mock |
| F13 | **Pro / Paywall**: Stripe Checkout in test mode (test card shown on screen) plus a promo code on screen for the jury; gates saving purchases to the wishlist | Real (test mode, no real money) |
| F14 | **Can I Afford It?**: a planned purchase (one-time or recurring) and its effect on this month, 12 months, 5 and 10 years; verdict and wishlist | Real |
| F15 | **Loan Lab**: model car, personal, student, BNPL, card and mortgage loans; compare 3 options; debt-load gauge; extra payments | Real |
| F16 | **Game as marketing**: streamer mode, share cards (9:16 and 1:1), creator packs, daily leaderboard | Streamer mode + share cards real |

### User journey

Play 5 lives → guess your own cost → pick the closest life → quick sliders → balance sheet → **You in 10 years + top 3 moves** → (optional) upload a statement to make it exact → commit to a move, check affordability, try Loan Lab → come back daily (game) and monthly (check-in).

The paywall appears after the user has seen their own forecast.

## Game design: Five Lives

Each day everyone gets the same 5 homes. Each home is an illustrated dollhouse cutaway you explore by tapping rooms, like GeoGuessr's looking around, but not a 3D walk-through.

- **Visible at once:** the metro (skyline in the window), the layout (studio to 4-bed, which sets the rent) and a one-line caption that contains no cost facts.
- **Clues (tap a room):**
  - garage: the car (none / economy / mid / luxury) and its loan term;
  - kids' room: crib, toddler, preschool or school-age toys, or a home office if there are no kids;
  - kitchen: piles of takeout = how often they eat out each week;
  - entry: coats and shoes = how many adults;
  - mailbox: ZIP and neighborhood tier (cheap / mid / expensive / suburb).
- **Clues cost points:** each opened clue lowers the card's multiplier by 10%, down to a floor of 50%. A blind guess can score the most; opening everything still scores half.
- **Guess:** a log-scale slider from $1k to $15k.
- **Reveal:** a needle sweeps to the mid, the typical-range band lights up with your guess pinned on it, then cost bars per category with source and year, and one surprise line ("Rent was 54% of her month").
- **After 5 homes:** a spoiler-free grid for sharing (🟩 in range, 🟨 500+ points, 🟥 below), plus a 9:16 clip card of the most surprising home.
- **Bridge:** "You guessed low on 4 of 5. Now guess your own month." → S5.
- **Day shape:** card 1 is easy, card 5 is a curveball (e.g. childcare costs more than rent).
- **Integrity:** every clickable object is generated from the card's data and matches one cost line; decorative objects never imply a cost. The server holds the answers: the browser gets only what's visible, each clue is fetched on tap, and guesses are scored server-side.
- **Streamer mode:** big type, a countdown, the answer hidden until the streamer locks in. Later: chat votes which room to open next.

## Retention loop

- **Daily (1 min):** the game, a streak, sharing. Planned: guess your own week's spending before you look (the game becomes budgeting practice).
- **Content runway:** 50 hand-made cards at 5 a day give only 10 days of new sets. After the hackathon, generate cards from `areas.json` × lifestyle templates so the daily set never repeats within a season.
- **Monthly (3 min):** check-in comparing forecast vs actual, with progress on the committed move.
- **On demand:** Can I Afford It? and Loan Lab, whenever a real purchase or loan comes up.
- Bill yearly first, so one skipped month doesn't lead straight to a cancellation.

## Business model (assumptions, label them as such)

- **Free:** daily game and one forecast.
- **Pro:** $39.99/year (yearly first) or $6.99/month. Includes a saved life, check-ins, decisions, Loan Lab history, a wishlist and move levels.
- RevenueCat SOSA 2026: low-priced apps retain 36% vs 23% for high-priced apps, which supports a low price.
- Growth: game clips by creators and share cards. Target CAC under $15; LTV around $45–60 (assumption). Check: $39.99 / (1 − 36% yearly renewal) ≈ $62 gross before payment fees and refunds, consistent with that range.
- $100M ARR at $39.99/year means about 2.5M paying subscribers. Have this number ready for the "Why does it make money?" question.
- Market proof: Monarch Money reportedly reached about $100M revenue in 2026 (Sacra).

## Marketing: the game as the channel

- **Streamer mode:** big cards, a countdown and a dramatic reveal. Later: "chat vs streamer" via a room code.
- **TikTok:** 9:16 result cards and reveal clips ("I guessed $3,400. It was $4,610.").
- **Creator packs:** "Guess the NYC 25-year-old", "Your city vs mine".
- **Funnel:** clip → play (no sign-up) → guess your own → forecast → paywall.
- **Guardrails:** cards are fictional composites from public averages; no prizes (avoids sweepstakes law).

## Competitors and positioning

| Product | Bank link? | Shows future? | Ranks decisions in $? | Daily habit? | Price (2026, re-check) |
| --- | --- | --- | --- | --- | --- |
| ProjectionLab | No | Yes | No (scenario compare) | No | Free; Premium $129/yr |
| Boldin | Optional | Yes (retirement) | No | No | Free; PlannerPlus $168/yr |
| Monarch Plus (Forecasting) | Yes | Yes | Scenarios | No | $299/yr |
| Empower | Yes | Yes (retirement) | No | No | Free |
| Monarch Core / Copilot / Cleo / Rocket Money | Yes | Mostly no | No | No | ~$4–15/mo |
| Housle / PropQwiz (house-price games) | No | No | No | Yes | Free |
| ChatGPT/Claude + statement | No | Ad hoc | Inconsistent | No | ~$20/mo |

**Beat line:** unlike planners people open a few times a year, we give a 25–45 adult a 30-second forecast with no bank link, rank their next decisions in dollars, and earn a daily visit with a game.

**Why not ChatGPT?** The same inputs always give the same numbers; the app saves your life and tracks forecast against reality; and the daily game. Demo: ask a chatbot the same 10-year question twice and show its numbers change.

Avoid saying "budget apps only look at the past". Monarch and PocketSmith do forecast. Say: "they forecast your accounts; we forecast your decisions."

## Two-minute demo script

1. Judges scan the QR code and play 3 homes (tap the garage and kitchen, guess); the reveal shows that most guess low.
2. Guess your own cost → closest life → sliders.
3. You in 10 years appears with a range, plus the top 3 moves.
4. Upload the sample statement and the monthly spending range tightens (estimated fields become measured). Quote the before/after numbers the engine produces for `profile.demo.json` + `statement.sample.csv`; never hand-type them into the deck.
5. Loan Lab: car 36 vs 60 months vs waiting; the debt-load gauge and the 10-year effect.
6. The ChatGPT twice vs us twice proof (pre-record the chatbot half; a live chatbot may happen to repeat itself), then show the engine tests in the repo.

## Metrics to show

Game: clues opened per home, blind-guess rate, finish rate. Funnel: finished game → guessed own cost → sliders → balance sheet → upload → saw paywall → paid. Plus share rate and plays per shared link.

## Legal and wording

- "Educational simulation, not financial advice."
- No lender recommendations, no referral fees, no securities advice.
- No prizes in the game.
- Don't use Zillow data or photos. Don't use MIT Living Wage data directly (all rights reserved); use its public underlying sources.
