# 08 · Subscription audit (S21)

**Priority: first of the tools.** A new multi-step screen at `/tools/subscriptions`. Engineering: issues **#79 (M3)**, **#80 (M4)**, **#81 (M5)**, **#82 (M6)**.

## The idea

The one sourced number in our story: in a survey, quick guesses of monthly subscription spend averaged $86 against $219 when itemized (C+R Research). This tool lets someone see that gap in their **own** numbers, in a minute, with no sign-up, and then find the ones they forgot.

It works **cold**: no game, no profile, no upload needed for the first three steps. A bank statement is the upgrade.

## Flow (draw each as a frame)

1. **Guess.** "How much do you think you spend on subscriptions each month?" One number (`NumberInput`) plus quick presets ($25, $50, $100, $200).
2. **Ticks.** About forty common services as tappable items, grouped by category (video, music, software, cloud, fitness, news, gaming, learning, food). Tap to tick; a plan picker (`Sheet` on phone) when a service has more than one. A sticky running total. Each price carries "catalogue price, 2026" and an `EstimateTag`.
3. **Reveal.** Your guess against the total of your ticks. Say the gap plainly. Quote the survey with its source and "a survey, not your data". Primary action: "Find the ones you forgot".
4. **Upload.** Upload a bank statement (CSV). Reuse the S9 look, including the line "Your statement is read on this device" and the "What we keep" link.
5. **Findings.** The list of recurring charges, grouped **Active**, **To confirm**, **Stopped**. Header: "Found 11 · you ticked 7" with the monthly and yearly totals. Items found but not ticked get a "forgot this one?" highlight (kind, not scolding).
6. **Finding detail** (`Sheet`): amount, how often, charges seen, next expected date, flags, confirm or dismiss (for "to confirm"), "mark to cancel".
7. **Cancel plan.** What you marked, and the saving: per month, per year, and **over 10 years** (with the forecast source label as on S10). Actions: "Add as my next move", "Add renewals to my calendar" (an `.ics` file; draw it **locked and unlocked**, see the README tool rules), "Use this in my plan" (see below).
8. **Use this in my plan** (confirm `Sheet`): shows exactly what changes in the profile ("Subscriptions per month: $85 estimate → $69.54 measured") with Cancel as the default focus.

Optional, mark as later: a 1:1 share card, "I found $X a year in subscriptions".

## Flags on a finding (each needs an icon or word, not color alone)

| Flag | Meaning | Example copy |
| --- | --- | --- |
| Price up | Latest charge is higher than the steady amount | "Price up: $15.49 → $17.99" |
| Intro price ended | First charges were much lower | "Started at $0.99, now $9.99" |
| Overlap | Several active services in one category | "3 video services" |
| Seen once | A yearly or quarterly charge seen a single time | "Yearly charge, seen once (Aug)" |
| Stopped | Not charged recently | "Hasn't charged since June" |

A **low-confidence** finding is "To confirm": "Looks recurring. Is it a subscription?" with Yes and No. It is **not counted** in the totals until confirmed. Show that.

## Data you can rely on (from the M1 contracts)

Per finding: `label`, `category`, `cadence` (monthly, quarterly, yearly), `amount`, `monthly`, `yearly`, `chargesSeen`, `lastCharge`, `nextExpected` (or null), `status`, `flags[]`, `previousAmount?`, `confidence`, `origin` (`tickList` or `statement`), `isEstimate`. Totals: `monthlyTotal`, `yearlyTotal`, `monthsCovered`. Tick-list: service `name`, `category`, plans (`name`, `price`, `cadence`), `priceYear`, `source`. Nothing else exists: no logos, no cancel links, no usage data. Ambiguous merchants (Apple, Google, Amazon) arrive as "Apple subscription: which one?".

## States

| Frame | When |
| --- | --- |
| `S21 · Guess` | Start. Make it feel like a 10-second game |
| `S21 · Ticks` and `S21 · Ticks · plan picker` | |
| `S21 · Ticks · empty total` | Nothing ticked yet |
| `S21 · Reveal · guess lower` / `· guess higher` | Both directions, same tone |
| `S21 · Upload` and `· reading` and `· error` | Error reuses S9 copy; "needs at least 2 months for best results" |
| `S21 · Findings` | With all flags shown at least once |
| `S21 · Findings · to confirm` | Low-confidence items |
| `S21 · Findings · none found` | "We found no recurring charges in this statement" plus what to try |
| `S21 · Findings · short statement` | Under 2 months: mostly "medium" findings, explained |
| `S21 · Finding detail` | |
| `S21 · Cancel plan` and `· empty` | Nothing marked yet |
| `S21 · Use in my plan` | Confirm sheet |
| `S21 · Offline` | Ticks and reveal still work; the upload step explains it needs a connection |

## Entry points (optional, mark as optional)

There is no tools hub page. The audit has its own route (`/tools/subscriptions`) and an entry in the app navigation. Optionally draw a one-line link from S1 Today ("Check your subscriptions") and, on the game result screen S3, a bridge line ("Most people guess low on subscriptions. Check yours").

## Wording guardrails

- "Looks recurring", "possible subscription", "catalogue price, 2026". Never "hidden fee", "scam" or "you're being charged for".
- The tool never tells anyone to cancel a particular service. It shows what the numbers would be if they did.
- Forgetting a subscription is normal. No red for a miss; tone as in brief 02.
- Every catalogue price shows its year and source; ticks are labelled estimates; statement results are labelled measured.
- No brand logos: names only.

## New components (name them in PascalCase, mark as new)

`ServicePill` (a tickable service with price), `FlagTag` (a `Tag` variant per flag), `GapBar` (guess against actual, two bars), `FindingRow`.

## Checklist

- [ ] The eight flow frames with their states above
- [ ] All five flags and the "to confirm" treatment
- [ ] "Counted vs not counted" visible in the totals
- [ ] Locked and unlocked versions of the calendar export
- [ ] The "Use this in my plan" confirm sheet
- [ ] Phone first; desktop frame for Findings and Cancel plan
- [ ] Optional share card (marked later)
