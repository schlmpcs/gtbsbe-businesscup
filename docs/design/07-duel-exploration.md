# 07 · Duel game and the net-worth story (exploratory, X1–X8)

**Status: proposal, not agreed.** Source: `docs/PRODUCT-NEXT.md` (Amir). The team has not decided whether the duel replaces today's game. Several open decisions (listed at the end) change what these screens show.

**So:** design these **low-fidelity first** (gray boxes, real copy, real flow), with frame IDs **X1–X8**, not S-numbers. They exist to (1) test the idea on strangers and (2) let the team decide. Don't polish them until the decisions are made, and don't change the S2/S3/S5/S10 frames that are live.

## The idea in one paragraph

Today's game asks you to guess one stranger's monthly cost on a slider: about a minute per home, and the answer comes from a formula. The duel swaps that for a **10-second binary pick**: two options, one question, tap one. Five rounds a day. Two kinds of rounds:

- **Person duel**: "Who's further ahead?" Two people, a few visible facts each; pick the one with the higher net worth (or higher monthly cost, bigger rent share, more debt).
- **Habit duel**: "Which costs you more over 10 years?" Two habits ("a coffee every workday" vs "$90/month of subscriptions"); the answer is computed by our engine.

The thesis behind it: *nobody can feel what they're worth, or where small choices lead. The game proves it in a minute; the app fixes it.*

## Screens to explore

### X1 · Person duel round

```
Who's further ahead?                  3/5 · streak 2
┌─────────────┐   ┌─────────────┐
│ Dana, 31    │   │ Marcus, 34  │
│ nurse       │   │ electrician │
│ Denver      │   │ Atlanta     │
│ car · food  │   │ car · food  │      [ hint: -10% ]
└─────────────┘   └─────────────┘
        tap one person to pick
```

- Header: question, round "3/5", streak.
- Two person cards: name, age, job, city, and a few facts as chips. **Label every card "Composite"** (built from averages) or, later, "Real person · Self-reported / Statement-verified". Never present a composite as a real person.
- **Hint** button: reveals one more fact about *both* people and lowers the round's points by 10%. Show the before and after.
- The pick is one tap. No confirm step (or design one, and argue for it).
- **The look is open (decision 3 below), and your input is wanted.** Options on the table: photo clues chosen by the card's data, phone-style tiles (a subscriptions list, a masked receipt), or a vertical "story" mix (Amir's lean). The dollhouse may go. Sketch two directions side by side.

### X2 · Habit duel round

```
Which costs you more over 10 years?            4/5
┌──────────────────┐   ┌──────────────────┐
│ A coffee         │   │ B streaming and  │
│ every workday    │   │ app subscriptions│
│ $6 × 5 / week    │   │ $90 / month      │
└──────────────────┘   └──────────────────┘
```

- No people, just two habits with price and frequency. Prices we can't source are labeled "illustrative".
- One habit duel a day, as round 4 or 5.

### X3 · Reveal (both types)

```
Dana +$41k   Marcus -$12k
"Income isn't wealth: a truck loan and no savings."
63% of players picked Marcus.
```

- Both true values, which one you picked, right or wrong.
- **The "tell":** one reusable lesson line. This is the thing people learn, so give it weight.
- **Crowd %:** from stored picks only. Below ~20 picks, show "not enough picks yet". Design that state.
- Habit reveal: both 10-year costs + "under our assumptions" + link to How we calculate. Tell: "Small and daily beats big and rare."
- Net worth can be **negative**: design how −$12k looks without a shaming red alarm.

### X4 · Day result

- Score (1000 per correct pick × hint multiplier), streak, spoiler-free grid (🟩 correct no hint, 🟨 correct with hint, 🟥 wrong).
- **Calibration line**, computed in code from which rounds you missed: "You trust income too much." This is the hook, so make it the headline.
- Challenge link ("Beat my 4/5"), share.
- Bridge: **"Now you're up"** to X5.
- Streamer variant (large type, chat-vote friendly: big A / B labels).

### X5 · Self-estimate (would replace S5)

```
"What do you think you're worth today?"         [ band pick ]
"What do you think you'll be worth in 10 years?" [ band pick ]
```

- **Bands, not a slider,** because net worth can be negative: under −$10k · −$10k to 0 · 0 to $10k · $10k to $50k · … (edges not final).
- Two questions, one screen or two steps. Fast: under 15 seconds.

### X6 · The aha reveal (on S10)

```
You guessed  $10k–$50k      Actual  −$4k
You guessed  $200k–$500k    Forecast  $48k–$91k  (AI estimate)
You rank above 1 of the 5 people you met.
```

- Shown after the forecast: your guesses vs reality, today and in 10 years, plus your rank among today's five people.
- The 10-year forecast keeps its source tag (brief 01).
- **Tone is everything here:** "most people are off, here's how to see it", plus "educational simulation, not financial advice". Design a version where the user is far off on the low side (worth less than they thought) and check it doesn't feel like a slap.
- Sits next to the goal card (brief 02). Show both on one S10 so the page doesn't become a wall.

### X7 · "Things you own" step (S8 balance sheet)

- Optional, skippable step: home value, car value, other investments. Without these, a homeowner's "net worth" is badly incomplete.
- Skipped fields become estimates (`EstimateTag`). These are always self-reported, since a bank CSV can't show assets. Label them that way.
- Depends on decision 6 (a contract change). Explore only.

### X8 · Avatar opt-in and stats

- After seeing their forecast, a user can **publish an anonymous avatar** that strangers meet in duels.
- **Opt-in, off by default,** with a **preview of exactly what strangers will see**: rounded amounts, an age band, a metro (never a ZIP), no names, no free text.
- Stamp: "Self-reported" or "Statement-verified" (if a CSV was uploaded).
- **Unpublish** is always one tap away.
- Owner's stats: "Your avatar was picked 38 times · picked as 'further ahead' 61%". Never show strangers' guesses about them.
- Lives near S9 and in a new small screen. List every field shown, because this is a privacy screen first.

## Open decisions that change these frames

1. **Composite net worth.** Composites have no real balance sheet. Either authored and labeled "illustrative", or seeds only ask cost questions and net-worth duels wait for real avatars. This changes which question X1 shows on day one.
2. **S5:** two band picks (X5) vs a number input for monthly cost.
3. **The look** (photo clues / phone tiles / story mix). **This one is yours to weigh in on.**
4. **Free vs Pro:** what sits behind the paywall.
5. **Defaults:** minimum picks for the crowd %, scoring, grid, band edges.
6. **Assets on the profile** (X7).
7. **Goal vs AI forecast** side by side (see brief 02).
8. **Cut order:** the challenge link may replace the leaderboard as the social feature.

## The test (do this before polishing)

The biggest risk: nobody has checked that duels are more fun than the slider. Make a clickable low-fi prototype of **X1 → X3 → X4** (five rounds) and put it in front of a few strangers. Watch two things: do they finish all five, and do they share the grid? Write down what you see; that answer decides whether the duel gets built.

## Checklist

- [ ] X1 person round: two look directions, hint before/after
- [ ] X2 habit round
- [ ] X3 reveal: right, wrong, negative value, "not enough picks yet"
- [ ] X4 result + calibration line + streamer variant
- [ ] X5 self-estimate bands
- [ ] X6 aha reveal, including the "far off" case, next to the goal card
- [ ] X7 things-you-own step (explore only)
- [ ] X8 avatar opt-in with preview, unpublish, owner stats
- [ ] Clickable X1→X4 prototype + notes from the stranger test
