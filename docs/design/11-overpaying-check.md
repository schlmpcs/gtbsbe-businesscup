# 11 · Overpaying check (S23)

**Priority: second of the three tools.** A new screen at `/tools/overpaying`, with its own entry in the app navigation (there is no tools hub page). Optionally draw a one-line link from S1 Today ("Are you paying more than typical?"), marked optional. Engineering: issues **#86 (M10)**, **#87 (M11)**.

## The idea

"Am I paying more than typical?" You enter your ZIP, your bedrooms and household size, and up to four monthly amounts: rent, car insurance, groceries, childcare. For each, the screen shows where you sit against the typical range for your area, the gap per year, and what closing that gap would be worth over 10 years. The benchmarks are real and sourced (HUD, Census, NAIC, USDA, the Department of Labor), which is why this is a tool and not a guess.

It works with no profile and no documents: five fields and an answer.

## What to draw

- **Inputs form.** ZIP, bedrooms (studio to 4), adults (1 to 4), kids (age bands), and the four amounts. All optional except one amount. If a profile exists the fields are prefilled and editable; editing here never changes the profile (say so).
- **Result rows.** One per line. Each shows: your amount, the typical range as a bar with your marker on it, the position as **a word and an icon** (below / in range / above, never color alone), the gap per month and per year, the 10-year effect, and the source note ("HUD fair market rent, 2026") with an `EstimateTag` where the benchmark is an estimate.
- **Summary** above the rows: how many lines are above, total gap per year, total 10-year effect.
- **Coverage.** We cover 60 ZIPs in 15 metros. For a ZIP outside them: a calm notice and a **metro picker** (metro, then tier: cheap, mid, expensive, suburb); results are labelled "approximate, nearest metro".
- **Skipped lines**: lines you left blank, and lines with no benchmark ("no data for childcare here").

## States

| Frame | When |
| --- | --- |
| `S23 · Inputs · empty` | First screen, cold |
| `S23 · Inputs · prefilled` | From a profile |
| `S23 · Result` | A mix of below, in range and above |
| `S23 · Result · all in range` | A positive, not smug |
| `S23 · Result · approximate` | Metro picker used |
| `S23 · Coverage · not covered` | With the picker |
| `S23 · Result · partial` | Some lines skipped |
| `S23 · Invalid` | A bad ZIP or an amount of 0 |

## Data you can rely on

Per line: `line`, `yours`, `typical` (low, mid, high), `source` (name, year, url), `isEstimate`, `position`, `gapPerMonth`, `gapPerYear`, `effect10y`. Result: `coverage` (exact, metro, none), `metro?`, `skipped[]` with reasons. There is no data for phone, internet, utilities alone, or anything else, and none for a specific landlord or insurer.

## Wording guardrails

- "Above the typical range for your area." Never "overpaying", "ripped off" or "too much".
- Never tell anyone to move, switch insurer, or negotiate. The tool shows a position and the dollar value of a gap.
- A position of "below" is not a prize and not a warning (it may mean cheaper, or a smaller place).
- Every row has its source and year; estimates carry the tag.
- Hidden in streamer mode (`?stream=1`).

## New components

`RangeMarker` (a low-to-high range bar with a marker for "yours"), `PositionTag` (word plus icon).

## Checklist

- [ ] Inputs empty and prefilled
- [ ] Result rows with the range bar, all three positions
- [ ] Metro picker and the "approximate" label
- [ ] Skipped and partial states
- [ ] Phone first; desktop frame for Result
