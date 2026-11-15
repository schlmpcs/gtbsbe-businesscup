# 14 · Yearly-bills smoother (S26)

> **PARKED (2026-11-14). Do not design.** The owner cut the tools to three. The yearly-bills issue (#91) is to be closed as not planned. Kept for reference only. (The renewals calendar that brief 08 uses is separate and stays.)

**Priority 7 of the tools.** A new screen at `/tools/yearly`. Engineering: issue **#91 (M15)**, with the renewals calendar from **#82 (M6)**.

## The idea

Bills that arrive once or twice a year (car registration, an insurance premium, a yearly subscription) are what break a month. List them, and the screen turns them into **a monthly amount to set aside**, a **calendar of the next 12 months** and the **first month your cash would fall short** if you do nothing. The subscription audit (brief 08) finds yearly charges such as a $139 Prime renewal, and each one becomes a bill in one tap.

It works with no profile: add bills by hand and type your cash.

## What to draw

- **Bill list and add.** A picker of common bills (car registration, car insurance, renters or home insurance, a yearly membership) or a custom one; the amount is always typed by the person. Fields: label (typed on this device, never sent), amount per occurrence, every year or every 6 months, the due month and optionally day.
- **Suggestions** from the audit: "Amazon Prime, $139, August: add as a bill?" with confirm per item. Hide ones already added.
- **Plan summary.** Two numbers, both explained: **steady** ("$182 a month, once all bills have a full year to build up") and **first cycle** ("$268 a month, because some bills are only a few months away"). A short line saying why they differ.
- **Month strip.** 12 months, with the amounts due in each.
- **Cash curve.** Cash after bills over the next 12 months, with and without the set-aside, and the first shortfall marked. Label it plainly: "Shows the effect of these bills only. It does not include your income."
- **Add renewals to my calendar** (`.ics`): draw **locked and unlocked** versions (see the README tool rules).

## States

| Frame | When |
| --- | --- |
| `S26 · Empty` | No bills yet, with the picker and any suggestions |
| `S26 · Add bill` | `Sheet` on phone |
| `S26 · Plan` | Several bills, steady and first-cycle numbers |
| `S26 · Plan · shortfall` | The first shortfall marked on the strip and the curve |
| `S26 · Plan · covered` | No shortfall in 12 months |
| `S26 · Suggestions` | From the audit |
| `S26 · Calendar export · locked / unlocked` | |
| `S26 · Invalid` | An amount of 0, a due month out of range |

## Data you can rely on

Per bill: `label` (local), `amount`, `every` (year or half-year), `dueMonth`, `dueDay?`, `source` (you added it, or the audit found it). Plan: `steadyMonthly`, `catchUpMonthly`, per-bill steady and catch-up, `calendar` (month and amount due), `curve` (month, with and without the plan), `firstShortfall` (month and amount, or null). The curve has no income, no interest and no forecast in it.

## Wording guardrails

- "Set aside" is a suggestion about timing, not advice on where to keep money.
- The two monthly numbers are projections under simple rules; say so near them.
- Custom labels never leave the device: add the "Stays in this browser" `Tag`.
- Hidden in streamer mode (`?stream=1`).

## New components

`MonthStrip` (12 months with dues), `BillRow`, `CashCurve` (a `ForecastChart` variant with two lines and a shortfall marker).

## Checklist

- [ ] Empty, add, plan, shortfall and covered states
- [ ] Steady against first-cycle, explained
- [ ] Month strip and curve, with the "bills only" note
- [ ] Suggestions from the audit
- [ ] Locked and unlocked calendar export
- [ ] Phone first; desktop frame for the plan
