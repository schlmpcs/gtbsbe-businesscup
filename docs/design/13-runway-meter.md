# 13 · Runway meter (S25)

> **PARKED (2026-11-14). Do not design.** The owner cut the tools to three. The runway issue (#90) is to be closed as not planned. Kept for reference only.

**Priority 6 of the tools.** A new screen at `/tools/runway`. Engineering: issue **#90 (M14)**.

## The idea

One number people want to know and rarely compute: **how many months your cash would cover your essential spending**. The screen shows that number as a meter, how far it is from a 3 and a 6 month cushion, and the monthly saving that would close the gap in a year. It is the quickest, most shareable of the six tools, so it should feel like a reveal.

It works with no profile: five numbers (cash, rent and utilities, groceries, car running costs, minimum debt payments), then the meter.

## What to draw

- **Inputs** (cold): the five fields. With a profile they are prefilled and editable; edits here do not change the profile.
- **The meter.** Months of runway as the hero number ("4.2 months"), on a meter with marks at 3 and 6. The number, not the color, carries the meaning; pair any zone with a word or icon.
- **Mode toggle** (`Choice`): **Essentials** (rent and utilities, groceries, car running costs, childcare, minimum debt payments) and **Everything** (adds eating out, subscriptions, other). Essentials is the default. Show what is in each.
- **Target rows** for 3 and 6 months: what you would need, the shortfall, and "save $598 a month for 12 months to get there". If already above, say so and drop the savings line.
- **Notes** (always visible, `xs`): "Counts cash only, not retirement accounts." and "3 and 6 months is a common rule of thumb, not advice."
- **Result card** (optional, mark as later): a 1:1 share card with the number only.

## States

| Frame | When |
| --- | --- |
| `S25 · Inputs · empty` | First screen |
| `S25 · Meter · under 1 month` | Honest and kind: "Under a month. Here is what would change that." Never alarming |
| `S25 · Meter · 1 to 3` | |
| `S25 · Meter · 3 to 6` | |
| `S25 · Meter · over 6` | No savings line |
| `S25 · Meter · estimates` | Prefilled from estimated profile fields: `EstimateTag` |
| `S25 · Essentials unknown` | Costs are 0 or blank: ask for them, no meter |
| `S25 · Invalid` | Negative cash: plain inline error |

## Data you can rely on

`essentialMonthly`, `cash`, `months` (or null when the essentials are 0), `mode`, `targets` (for 3 and 6: `shortfall`, `extraMonthlyIn12`), `isEstimate`. The app also knows a bucket for the meter (under 1, 1 to 3, 3 to 6, over 6). No investment, retirement or income-loss scenarios exist.

## Wording guardrails

- Never alarmist: "Under a month" is a fact, not a warning light.
- 3 and 6 months are a rule of thumb. Do not claim an authority or say "you should have".
- No advice on where to keep savings or which account to use.
- Hidden in streamer mode (`?stream=1`).

## New components

`Meter` (a hero number on a scale with marks; contrast and non-color cues checked).

## Checklist

- [ ] Inputs and the five meter states
- [ ] Mode toggle with what each includes
- [ ] Target rows incl. "already above"
- [ ] Both notes always visible
- [ ] Phone first; desktop frame
