# PRODUCT-NEXT.md — the thesis, the duel game, and what we add to the app

**Status: proposal for the team.** Written by Amir. Items marked **[proposal]** are suggested defaults nobody has agreed yet. Items under *Open decisions* need an answer before anyone builds. This doc does not edit PRODUCT.md, ARCHITECTURE.md or TASKS.md. Once agreed, those get updated from here.

## The thesis

> **Nobody can feel what they are worth, or where small choices lead. Our game proves it in a minute. Our app fixes it.**

Almost nobody can feel what their lifestyle and assets are worth. After a minute of the game they see for themselves that they cannot judge it. The app then does three jobs:

1. **Show what you are worth today** (net worth), honestly and completely.
2. **Plan to a goal.** People cannot predict what they will be worth in 10 years, or what it takes to reach the number they want.
3. **Project small decisions.** People underestimate how small choices compound into net worth. We rank them in dollars.

Net worth is the one number that ties it together: the duel compares it, the app shows it today and in 10 years, and every move changes it.

**Evidence status.** Our only sourced figure is about subscriptions (quick guesses averaged $86 a month against $219 itemized, C+R Research). That nobody can feel their net worth is a **hypothesis**. The product measures it (see *The aha moment*); do not claim it as fact in the pitch until we have real counts.

### Three proof moments (the story in the demo)

1. **The duel miss.** You pick the person who looks richer and you are wrong.
2. **The self-estimate reveal.** You guessed your own net worth and your 10-year number, and the app shows how far off you were.
3. **The compounding duel and the ranked moves.** A small daily habit costs more over 10 years than the one-off purchase you worried about, and the same math ranks your own next moves.

## Why change the game

The current game (Five Lives: explore a home, guess one monthly cost on a slider) has three weaknesses:

1. **The answers come from a formula.** `costOfLife` turns public averages into the "truth", so a sharp player learns the formula and a card is not a real person.
2. **Nothing to get better at.** GeoGuessr players feel themselves improving. A slider guess gives no transferable lesson.
3. **A slider is awkward.** It cannot hold a negative net worth, takes about a minute per home, and is hard for a streamer's chat to vote on.

The duel keeps everything else (the funnel, the engine, the forecast, the daily same-for-everyone set) and swaps the core interaction.

## The duel

Two options, one question, pick one. About ten seconds a round, five rounds a day. There are two card types.

### Person duel: "Who's further ahead?"

```
Who's further ahead?                  3/5 · streak 2
┌─────────────┐   ┌─────────────┐
│ Dana, 31    │   │ Marcus, 34  │
│ nurse       │   │ electrician │
│ Denver      │   │ Atlanta     │
│ car · food  │   │ car · food  │      [ hint: -10% ]
└─────────────┘   └─────────────┘
        tap one person to pick

Reveal:  Dana +$41k   Marcus -$12k   (illustrative numbers)
Tell:    "Income isn't wealth: a truck loan and no savings."
Crowd:   63% of players picked Marcus.
```

| Question | Truth | Source of truth |
| --- | --- | --- |
| Who is further ahead? | net worth | Profile / avatar |
| Who spends more per month? | total monthly cost | `costOfLife` or avatar |
| Who spends a bigger share of take-home on rent? | rent ÷ take-home | `costOfLife` + income |
| Who carries more debt? | sum of debt balances | Profile / avatar |

### Habit duel: "Which costs you more over 10 years?"

This is the compounding duel. It proves the second half of the thesis (small decisions are underestimated) with the same mechanic. The two options are choices, not people.

```
Which costs you more over 10 years?            4/5
┌──────────────────┐   ┌──────────────────┐
│ A coffee         │   │ B streaming and  │
│ every workday    │   │ app subscriptions│
│ $6 × 5 / week    │   │ $90 / month      │
└──────────────────┘   └──────────────────┘
Reveal: A ≈ $X over 10 years, B ≈ $Y   (computed by the engine)
Tell:   "Small and daily beats big and rare."
```

- **Truth comes from the engine, deterministically.** The 10-year cost of a recurring or one-off outflow is `forecast(base).in10y.mid − forecast(base, { extra: [item] }).in10y.mid` on a fixed reference profile, in today's dollars. It uses the same assumptions as the app (inflation, return, cash yield), shown in the "How we calculate" panel. Say "under our assumptions" on the reveal.
- **Item catalogue.** Each item (price and frequency) is a named constant with a `Source` or an `assumption: true` flag. Prices we cannot source are labeled illustrative.
- **Robust pairs only.** A pair is allowed only if its ordering is the same under a low and a high return assumption. A pair that flips with the assumptions is dropped, so the "right answer" never depends on a number we picked.
- **Placement.** One habit duel a day, as round 4 or 5 **[proposal]**. It needs no real people, so it works with an empty avatar pool.
- **Calibration.** The calibration line for these rounds ("you underestimate small recurring costs") is computed in code from which habit duels were missed. No LLM.
- **Bridge.** "The same math ranks *your* moves" leads into the app's Next Moves.

### Round anatomy (both types)

1. **Question.** One per round, from a fixed list.
2. **Two options.** Each is a card with a few visible facts. A **hint** reveals one more fact about both and lowers that round's points.
3. **Pick.** One tap. The pick is sent to the server, which holds the answer.
4. **Reveal.** Both true values, a one-line "tell" the player can reuse, and the crowd percentage.
5. **Optional, skippable (person duels):** one tap about *you* after rounds 2 to 4 (for example "car payment? yes/no"). It fills the player's draft Profile as `isEstimate: true` and is never required **[proposal]**.

**Day shape:** round 1 is obvious (large gap), round 5 is a curveball (income does not equal wealth, or a small gap). Difficulty is the relative gap between the two values, with the thresholds as named constants in `assumptions.ts` **[proposal]**.

### Scoring and result

- A correct pick scores **1000 × multiplier**; a wrong pick scores 0 **[proposal]**.
- The multiplier reuses today's rule: each hint lowers it by 10%, floor 50%. The server counts hints from its own log of hint calls, never from the client.
- **Streak** = consecutive correct picks, shown in the round header; daily streak = consecutive days with a finished set **[proposal]**.
- **Spoiler-free grid** for sharing: 🟩 correct without a hint, 🟨 correct with a hint, 🟥 wrong **[proposal]**.
- **Calibration line** after five rounds, for example "you trust income too much". Computed in code from which rounds were missed. No LLM writes it or any number in it.

## The aha moment: your own blind spot

The strongest beat is personal, not about strangers. After the duels and before the balance sheet, the app asks two things, then reveals the answer after the forecast.

```
Before (S5):   "What do you think you're worth today?"        [ band pick ]
               "What do you think you'll be worth in 10 years?" [ band pick ]
               ... balance sheet (S8) ... forecast (S10) ...
Reveal (S10):  You guessed  $10k–$50k      Actual  −$4k
               You guessed  $200k–$500k    Forecast  $48k–$91k  (AI estimate)
               You rank above 1 of the 5 people you met.
```

- **Bands, not a slider,** because net worth can be negative: for example under −$10k, −$10k to 0, 0 to $10k, $10k to $50k, and so on. The band edges are named constants **[proposal]**.
- **The reveal compares like with like:** today's guess against the computed net worth, and the 10-year guess against the forecast (labeled "AI estimate" when it comes from the model).
- **Rank among the five:** the user's computed net worth is ranked against the five people from today's duels. Computed in code.
- **Tone:** never shaming. The framing is "most people are off, and here is how to see it", with "educational simulation, not financial advice".
- **The thesis metric.** Send one event with the **miss factor in a bucket** (for example under 0.5×, 0.5–0.8×, 0.8–1.25×, 1.25–2×, over 2×), never the values. The share of players who miss by more than 2× is the real evidence for the pitch. Quote it only from real counts, never typed in by hand.
- This replaces the earlier idea of placing yourself above or below each of the five people, which is now the computed rank above.

## The goal: plan to a number

Today the forecast and ranked moves have no target. People want a goal value, so we add one.

- The user sets **a target net worth** (in today's dollars) and **a horizon** (1–30 years, default 10).
- The app shows a **verdict** from the projected range at that horizon: `onTrack` (even the low end reaches it), `withinRange` (the target sits inside the range, so it depends on the estimates in your numbers), or `behind` (even the high end falls short). Plus the gap in dollars and the share of the target reached.
- **Required extra monthly saving** to reach the target: a deterministic solve by code, capped so you cannot save more than you earn, with "not reachable by saving alone" when it is.
- **Which moves close the gap:** each of the top moves' effect at the goal horizon as a share of the gap, and the three together (computed by applying all patches, not by adding the effects).
- **The verdict comes from the rules forecast, not the AI forecast.** Code does the math. If the headline forecast is the AI one, show it as a labeled estimate next to the goal; never let "on track" rest on the model alone.
- The goal lives **outside `Profile`**, so the AI forecast's input, its cache key and `rankMoves` are untouched.
- No recommendations of lenders, investments or securities. Wording: "projected", "based on your inputs", never "you will reach".

**Issue: [#69 (T13)](https://github.com/schlmpcs/gtbsbe-businesscup/issues/69), assigned to Aibek.** The issue holds the full spec: contracts, functions, view-model, persistence, copy, tests and done-when.

## A complete net worth

"What you are worth" is only honest if the number is complete. Today `Profile` holds cash, retirement and debts, and the engine computes `net worth = cash + retirement − debts`. A homeowner's net worth is mostly home equity, and cars and investments matter too, so we would be calling a partial number "your net worth".

- **Add asset fields to `Profile`,** each an `Estimate<Money>` so a skipped field becomes a flagged estimate: `homeValue`, `carValue`, `otherInvestments` **[proposal]**. The mortgage is already a `Debt` kind.
- **Growth assumptions** for each asset (home appreciation, car depreciation) live in `assumptions.ts` with a `Source` or an assumption flag.
- **Not measurable from a statement.** A bank CSV shows spending, not assets, so these stay self-reported and are labeled that way.
- **UI:** an optional, skippable "things you own" step in the balance sheet (S8), with defaults only where we can source them.
- Person duels and avatars use the same extended net worth, so the question stays consistent.
- No issue yet. It changes the `Profile` contract (both sides must agree), so it needs a decision first (see *Open decisions* 6).

## People in the pool

| Type | Where from | Label shown |
| --- | --- | --- |
| **Composite** | Authored from sourced averages (the existing 50 cards) | "Composite" |
| **Real avatar** | A user who opted in after entering their own numbers | "Real person", plus "Statement-verified" if they uploaded a CSV, otherwise "Self-reported" |

The community slot is the same for everyone on a given date (seeded by the New York date, like today's set), so the leaderboard and challenge links still compare like with like. A player never meets their own avatar. Habit duels need no people.

### Avatar publishing (consent and privacy)

Publishing is a new kind of disclosure, so it goes beyond the existing privacy design:

- **Opt-in, off by default,** asked after the player has seen their own forecast, with a preview of exactly what strangers will see.
- **Coarse values only:** rounded amounts, an age band, a metro (never a ZIP), no free text, no names.
- **Unlinked from the anonymous ID** in the public pool. The owner sees their own stats only from the same browser, because there are no accounts.
- **One avatar per anonymous ID,** with sanity bounds on every value and the usual rate limits. Self-reported numbers can be nonsense, which is why the stamp matters.
- **Unpublish** is always available. The "What we keep" panel lists the published fields.
- **What the owner sees:** how many times their avatar was picked and its win rate (share of duels where it was picked). Never a stranger's guess at their net worth, which can sting and invites trolling.
- Wording stays "educational simulation, not financial advice". No prizes.

## Honesty rules (the judges check "is it faked")

- **Crowd percentages come only from stored picks.** Below a minimum number of picks on a duel (say 20 **[proposal]**), show "not enough picks yet" instead of a number.
- **Seeds are labeled composite.** Never present an authored card as a real person.
- **The server holds the answers.** The browser gets only what is visible. One pick per duel per anonymous ID per day. The client never sends a score.
- **Code does the math.** Net worth, rankings, scoring, habit costs, goal verdicts and the calibration line come from tested pure functions. An LLM may not produce them.
- **Habit and goal numbers state their assumptions** ("under our assumptions") and link to the "How we calculate" panel.
- **The thesis metric uses real counts only.**

## Funnel

```
DISCOVER → LAND → 5 DUELS → RESULT → SELF-ESTIMATE → BUILD → AHA + VALUE → GOAL → AVATAR OPT-IN → PAYWALL
                    ↑                                                                              ↓
                 SHARE ←──────────────── RETURN (daily, monthly, on demand) ←──────────────────────┘
```

| Step | What happens | Screen |
| --- | --- | --- |
| Discover | Clip, stream, friend's challenge link, or a grid in a chat | — |
| Land | Straight into duel 1, no sign-up, no explainer; the anonymous ID is created silently | S2 |
| 5 duels | About a minute, mostly person duels plus one habit duel, with reveals | S2, S3 |
| Result | Score, streak, calibration line, grid, challenge link; bridge: "Now you're up" | S3 |
| Self-estimate | Two band picks: what you are worth today and in 10 years | S5 |
| Build | Pick the closest person as a starting point, sliders, 6-tap balance sheet (plus optional assets); skipped fields become flagged estimates | S6–S8 |
| Aha + value | Reveal your guesses against reality, your rank among the five, the 10-year forecast (labeled "AI estimate") and top 3 moves | S10 |
| Goal | Set a target and a horizon; see the verdict, the gap, the saving needed and which moves close it | S10 |
| Avatar opt-in | Preview, consent toggle, optional statement upload for the "verified" stamp | S9 and new |
| Paywall | After the forecast; stays a mock | S15 |
| Return | Daily new five plus "your avatar was picked X times"; monthly check-in (mock); Can I Afford It? and Loan Lab on demand | S1, S11, S12 |
| Share | Grid, challenge link, avatar result card | — |

**Metrics.** Funnel: land → first pick → finish 5 → self-estimate → balance sheet → forecast → set a goal → avatar opt-in → saw paywall → paid. Game: hints per duel, blind-pick rate, finish rate. Spread: shares per finish, plays per shared link. Retention: next-day return (not in PRODUCT.md yet, add it). Thesis: miss-factor buckets for today's and 10-year guesses. Goal: share of users who set a goal and the verdict mix.

## Streamer mode

`/play?stream=1` (S4) gets big type, a countdown, and the answer hidden until the streamer locks in. For the hackathon, chat votes in the streamer's own poll, and the reveal shows the streamer's pick next to the majority the streamer types in. A room code and a chat vote integration come later. Both duel types work for chat voting. Streamers are a growth plan, not something this build can prove.

## What stays and what changes in the repo

**Stays:** the whole engine (`forecast`, `rankMoves`, `canAfford`, `loan`, `monthEnd`), the ladder S6–S12, sessions, the paywall mock, the privacy design for statements, the daily New York date seed, and the rate limits.

**Changes (names below are placeholders):**

| Area | Change | Owner |
| --- | --- | --- |
| `packages/types` | Replace `PublicCard`/`GuessReveal`/`GuessResult` for the game with duel equivalents (for example `PublicDuel` as a person-or-habit union, `DuelReveal`, `PickResult`); add `Goal`, `GoalStatus`; later the asset fields on `Profile`. Both sides must agree. | Both |
| `LifeCard` | Net-worth and share-of-income questions need `cash`, `retirement`, `debts` and take-home income on a card; today it has none of them. See *Open decisions* 1. | Both |
| `packages/engine` | Add `netWorthOf(profile)`, `scoreDuel(...)`, a pairing/difficulty function, `habitCost(item)` with the robust-pair check, and the goal functions (`goalStatus`, `extraSavingToReach`, `movesTowardGoal`). `scoreGuess` is no longer used by the game. | Amir (goal functions: Aibek via T13) |
| `/api/daily*` | `GET /api/daily` returns five duels; `POST /api/daily/hint`; `POST /api/daily/pick` replaces `/guess`; leaderboard and share image read stored picks. | Aibek |
| Avatars | Store for published avatars and per-duel pick counts (Postgres, per the store decision); publish, unpublish and "my stats" routes. | Aibek |
| Estimate events | An event carrying the miss-factor bucket, never the values. | Aibek |
| Game UI (Y8) | Duel screens replace the slider and house scene in S2/S3. | Amir |
| S5 and S10 | S5 becomes the two self-estimates; S10 gains the reveal and the goal card. | Amir / Aibek (goal card) |
| House scene (T12) and sprite kit (D1) | The look is undecided (see below). Whatever is chosen replaces the dollhouse. | Aibek / Kiko |
| Cards (T10) | The 50 cards need the balance-sheet fields and a "tell" line each; the habit catalogue needs its constants. | Aibek |
| Figma (D2) | S2, S3, S5 and S10 frames change. | Kiko |

## Open decisions

1. **Truth for composite net worth.** Composite cards have no sourced balance sheet, so a net-worth answer on a seed is authored, not measured. Options: (a) author it from sourced age-based figures and label it "illustrative"; (b) restrict seeds to question types `costOfLife` can answer (monthly cost, rent share, debt payments) and unlock net-worth duels once enough real avatars exist. I lean to (b), but it is the team's call.
2. **S5.** Two band picks (today and 10 years) is my proposal. The alternative is a number input for "your monthly cost".
3. **The look.** Photo clues from a library chosen by the card's data (so a clue never contradicts the numbers), phone-style tiles (subscriptions list, masked receipt), or a mix in a vertical story layout (my recommendation). Not decided; Kiko should weigh in.
4. **Free vs Pro.** Which of Can I Afford It? and Loan Lab sit behind the paywall, and whether the goal is free.
5. **Minimum picks** before showing a crowd percentage, and the scoring, grid and band defaults marked **[proposal]**.
6. **Assets on `Profile`.** Whether to add `homeValue`, `carValue` and `otherInvestments`, and which defaults we can source.
7. **Goal source.** I specify the rules forecast as the source of the verdict. If the headline forecast (Y16–Y18) is the AI one, decide how the two are shown side by side.
8. **Cut order.** The leaderboard stays first to cut; the challenge link ("beat my 4/5", reusing the stored `resultId`) replaces it as the social feature.

## Risks to keep in view

- A binary pick is 50% luck. Mitigations: streaks, close-gap rounds as the hard ones, the hint, and the calibration line.
- Ranking real people against each other can feel judgmental. Hence opt-in, aggregates only, and no individual stranger's judgment shown to the owner.
- A low or negative net worth can feel shaming. Tone, framing and the "not financial advice" wording matter.
- "On track" must not rest on the AI forecast alone, so the goal verdict is rules-based.
- The pool is seeds on day one. The funnel and metrics must still work with composites only, and the habit duel needs none.
- Nobody has tested whether duels are more fun than the slider. Before committing the whole build, put a throwaway of the duel screen in front of a few strangers and watch whether they finish all five rounds and share the grid.
