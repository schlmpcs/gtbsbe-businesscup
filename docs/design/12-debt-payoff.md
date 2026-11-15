# 12 · Debt payoff planner, a section of Loan Lab (S12)

**Priority: last of the three tools.** A new section on the existing **S12 Loan Lab** (`/loan`), not a new screen. Engineering: issues **#88 (M12)**, **#89 (M13)**.

## The idea

Loan Lab today ends with a small "payoff order" card: your debts plus the selected loan offer, in avalanche order, with a payoff month and total interest. This brief replaces that card with a planner:

- **Avalanche:** highest interest rate first. Pays the least interest.
- **Snowball:** smallest balance first. Clears accounts sooner.
- **Minimums only:** the baseline.

Set an extra monthly payment and see, side by side, the **debt-free date**, the interest, and how much each method saves against minimums. Pick a date and see what extra payment would finish by then.

Debt payoff planners exist everywhere, so this is **not a separate door** and gets no route of its own. It is part of Loan Lab, which then covers everything about debt.

## Where the debts come from

The same list Loan Lab uses today: the debts in your profile, plus the selected loan offer as a new debt. There is **no debt entry in this section**. Debts are edited on the balance sheet (S8): show a link ("Edit your debts") instead of a form.

## What to draw

- **Section header and placement** within the S12 layout (where the old payoff-order card sat). Show it on phone and on desktop.
- **Extra per month** (`Slider` plus a number field), labelled so it cannot be confused with the extra-payment slider on the selected offer (that one belongs to the loan; this one is for all debts).
- **Method toggle** (`Choice`: avalanche, snowball), with one plain line saying what each optimizes.
- **Comparison.** Three columns: Avalanche, Snowball, Minimums only. Rows: debt-free date, total interest, months. Under it: "Saves $5,740 in interest and 32 months against minimums".
- **Balance chart.** Total balance over time, three lines, through the existing chart wrapper. Label directly on the lines; never color alone.
- **Order.** The payoff order for the selected method: kind of debt, APR and balance, never lender names. The new loan from the selected offer is marked.
- **Target date.** "Be debt-free by [month, year]" → "needs an extra $xxx per month". States for "already on track" and "not reachable even with the largest extra".
- A defaulted minimum payment keeps its `EstimateTag`.

## States

| Frame | When |
| --- | --- |
| `S12 · Payoff · plan · avalanche` / `· snowball` | Selected method |
| `S12 · Payoff · no debts` | One line and the link to the balance sheet; no chart |
| `S12 · Payoff · estimate minimums` | A defaulted minimum shown with its tag |
| `S12 · Payoff · never pays off` | The payment does not cover the interest: "not at these payments" and what extra fixes it. Never "Infinity" |
| `S12 · Payoff · target date` | A result, "already on track", and "not reachable" |
| `S12 · Payoff · one debt` | The comparison collapses sensibly |
| `S12 · Payoff · with selected offer` | The new loan appears in the order |

## Data you can rely on

Per plan (`avalanche`, `snowball`, `minimum`): `order` (debt ids), `monthsToDebtFree` (or null), `totalInterest`, `totalPaid`, `perDebt` (payoff month and interest for each), `timeline` (month, total balance), `interestSavedVsMinimum`, `monthsSavedVsMinimum` (or null). Plus the extra needed for a target date and whether it is reachable. Dates are computed from today in the app; draw month and year. Debts have a kind, APR, balance and (sometimes estimated) minimum payment. Nothing about lenders.

## Wording guardrails

- "Under our assumptions" near the dates; they are projections, not promises.
- Describe what each method optimizes. Never say which one a person "should" use.
- No lender, consolidation or refinancing advice. (The loan offers above it are the user's own inputs.)
- High balances are not shamed. A card at 22.8% is data.
- Personal numbers are hidden in streamer mode (`?stream=1`), as on the rest of Loan Lab.

## New components

`MethodCompare` (three columns), `PayoffChart` (a `ForecastChart` variant with three labelled lines), `TargetDate`.

## Checklist

- [ ] The section in context on S12, phone and desktop
- [ ] Both methods, no-debts, never-pays and target-date states
- [ ] The comparison and the chart, labelled without color alone
- [ ] Estimate-minimum treatment and the "with selected offer" order
- [ ] The link to the balance sheet (no debt form)
