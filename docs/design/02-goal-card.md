# 02 · Goal card (S10)

**Priority 2.** A new card on S10. Engineering: issue **#69 (T13)**, owner Aibek.

## The idea

Today S10 shows where your net worth is heading, but there's no target. People want a number to aim at. The user picks a **target net worth** and a **horizon**, and the card answers four questions:

1. Am I on track?
2. How far off am I, in dollars?
3. How much more would I need to save each month to get there?
4. How much of the gap do my top moves close?

All of it is computed by code from the **rules forecast**, never the AI one. "On track" must never rest on a model's guess.

## Inputs

| Input | Values | Default |
| --- | --- | --- |
| Target | Dollars, **in today's dollars**, > 0. Presets: $50k, $100k, $250k, $500k, $1M, plus a custom amount (`NumberInput`). | none (empty state) |
| Horizon | Whole years 1–30. Presets: 5, 10, 15, 20, 30. | 10 |

The goal is saved in the browser and survives a reload. It is not part of the profile.

## What the card shows

Placeholder layout from the issue (numbers illustrative):

```
Your goal                         [ $250k ▾ ]  in  [ 10 years ▾ ]
Projected  $168k – $214k of $250k      ▓▓▓▓▓▓▓░░░  67%
Verdict    Behind: even the high end falls short
Gap        $36k
To close by saving alone:  +$310 / month   (or "not reachable by saving alone")
Your top moves close:  Pay card first 22% · Cut eating out 9% · Cancel subs 4%
All three together:  35% of the gap
```

### The verdict (three values)

| Verdict | Rule | Suggested tone | Copy direction |
| --- | --- | --- | --- |
| `onTrack` | Even the low end of the projected range reaches the target | `positive` | "On track: even the low end of the range gets there." |
| `withinRange` | The target is inside the range, so it depends on numbers we estimated | `warning` | "Within range: it depends on the numbers we estimated. Make them exact to know." Link to S9. |
| `behind` | Even the high end falls short | `negative`, but **gentle** | "Behind: even the high end falls short. Here's what closes the gap." |

Pair each verdict with an icon or a word, not color alone.

### Progress bar

- `progress = projected mid ÷ target`. It **can be negative** (negative net worth) and **can exceed 100%**.
- Design all three: a negative bar (empty with a note, or a bar extending left of zero), 0–100%, and over 100% (full plus "+20% over").
- Showing the range (low–high) on the bar, not just the mid, would explain `withinRange` better. It's your call; if you do it, use the band style from brief 01.

### Saving to reach it

- "+$310 / month" = the extra monthly saving that gets the projected mid to the target.
- Two special cases: already there ("No extra saving needed") and **not reachable by saving alone** (the amount would exceed take-home pay).
- Under it, in `xs` muted: "Assumes the extra goes to savings and debt like any other surplus; taxes ignored." The exact rule goes in the How we calculate panel.

### Moves toward the goal

- One row per top move: move name (existing move copy) + share of the gap it closes, as a small bar or percentage.
- "All three together" is computed by applying all three at once, so it is **not** the sum of the rows. Don't draw it as a total under a column of numbers. Make it its own line.
- When there's no gap (on track), hide the shares and show something like "Your moves would put you further ahead."

### The AI question

S10's headline forecast may be the AI one, while the goal card uses the rules forecast. So the card carries the label **"Computed from your inputs with fixed assumptions"** (or a `Tag` "Rules-based estimate"). The goal's projected range can therefore differ from the chart above it. Design that honestly:

- Option A: the goal card states its own range and labels it rules-based (the default in #69).
- Option B: a small "why is this different from the chart?" disclosure.

Pick one, and show the frame where the two numbers visibly differ.

## States

| Frame | When |
| --- | --- |
| `S10 · Goal · empty` | No goal yet: one-line pitch + target presets + horizon. This is the first thing users see, so make it inviting. |
| `S10 · Goal · onTrack` | |
| `S10 · Goal · withinRange` | |
| `S10 · Goal · behind` | Including the "not reachable by saving alone" variant |
| `S10 · Goal · negative` | Negative projected net worth (progress < 0) |
| `S10 · Goal · editing` | Changing target or horizon (a `Sheet` on phone?) |
| `S10 · Goal · invalid` | Custom amount ≤ 0 or empty: plain inline error |
| `S10 · Goal · loading` | While the profile or moves load |

Plus a **clear goal** action (small, ghost).

## Placement

- On S10, between the headline forecast and Next Moves is the natural spot, because the goal bridges "where you're heading" and "what to do about it". Propose otherwise if the layout says so.
- Optional: a compact one-line version on S1 Today ("Goal $250k in 10 yrs · behind by $36k"). If you draw it, mark it optional.

## Wording guardrails

- "Projected", "based on your inputs". Never "you will reach".
- No product advice (no "open a high-yield account", no fund names).
- Add the goal rules to the How we calculate panel: the verdict thresholds, the target in today's dollars, and that the saving solve ignores taxes.

## Checklist

- [ ] Empty state with presets
- [ ] The three verdicts + negative + not reachable
- [ ] Progress bar: negative / normal / over 100%
- [ ] Moves toward goal rows + "all three together" line
- [ ] Rules label and the "differs from chart" decision (A or B), shown in a frame
- [ ] Editing (phone `Sheet`), invalid, loading
- [ ] Optional S1 one-liner
