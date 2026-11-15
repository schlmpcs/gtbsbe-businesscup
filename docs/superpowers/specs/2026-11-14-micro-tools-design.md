# Micro-tools: three small products inside one app (design)

Status: **proposal**, written 2026-11-14 and **cut to three tools the same day** at the owner's request. Items marked **[call]** are defaults I picked, not agreed. Size: a project (three tools on shared contracts). Plan and issues: `docs/superpowers/plans/2026-11-14-micro-tools.md`. Designer briefs: `docs/design/08`, `11`, `12` (09, 10, 13, 14 are parked).

## Intent and why

Other apps are built around one of these tools alone (a subscription cancel-er, a debt-payoff planner). We put three of them inside LifeGuessr, each small enough to use in a minute, each on the same tested engine and the same profile. Two reasons:

1. **A tool can be a door.** Someone who only wants "what am I paying for every month?" lands on that tool, gets a real answer with no sign-up, and the app takes them from there.
2. **Each tool measures the same blind spot as the game.** The only sourced figure in our thesis is subscriptions: quick guesses averaged $86 a month against $219 itemized (C+R Research). The subscription audit lets a person see that gap in their own numbers. The overpaying check does the same for "not feeling what life costs", with real sourced benchmarks.

The three tools:

- **Subscription audit** (own page): hidden recurring costs.
- **Overpaying check** (own page): your rent and bills against sourced benchmarks for your area. The most original of the three, and the data already exists (`areas.json`, 60 ZIPs in 15 metros).
- **Debt payoff planner** (a section of Loan Lab, **not** a separate door): avalanche against snowball against minimums. Planners like this exist everywhere, so novelty is low; it earns its place by making Loan Lab the place for everything about debt. Lowest priority of the three: do it last.

## Parked (cut by the owner, 2026-11-14; nothing built)

Household (couples and family, tracked together), runway meter, yearly-bills smoother, and the `/tools` hub page (a hub of two cards holds nothing). Their issues (#83, #84, #85, #90, #91) are to be closed as not planned, and their briefs stay in `docs/design` marked parked. The household trade-off table is kept at the end in case it comes back.

## Goals

- The two door tools work **cold** **[call]**: no game, no profile, no upload needed for a first real answer. A profile or a statement makes them exact.
- Every number is computed by tested pure code, with a source or an "estimate" tag.
- The payoff planner replaces Loan Lab's single-method payoff card without changing anything else in Loan Lab.

## Non-goals

- Bank connections, accounts, push or e-mail reminders (an `.ics` file covers renewals without any of them).
- Changing `forecast`, `rankMoves` or `canAfford` behavior. The tools feed them a `Profile`; they do not edit them.
- Share cards for the tools (an optional frame in brief 08 only; not built).
- Cancel-flow links or "how to cancel" guides.
- Manual debt entry in the payoff planner (debts come from the balance sheet, S8).

## Anti-goals (a failure even if it technically works)

- Calling a recurring charge a subscription when it is rent, a loan payment or insurance. The detector must be conservative and ask the user to confirm low-confidence findings.
- A catalogue price shown as fact. Prices change; each carries the year and a source or an estimate tag.
- Telling people to switch providers, cancel specific services, or move. The tools show numbers and gaps, not product advice.
- Breaking Loan Lab: its existing outputs and tests stay as they are.
- Naming or shaming. A high rent share or a large gap is shown flatly.

## Constraints

- No accounts. Tool state is browser-local (M2).
- Privacy rule 6 (`CLAUDE.md`): no names, account numbers or raw statements. Subscription findings stay **in the browser** **[call, D3]**. Events carry enums and counts, never amounts.
- Code does the math. The only LLM use is the existing statement categorizer, which sorts labels.
- Contracts first: one PR (M1) adds all shapes; later issues do not touch `packages/types`.
- The existing forecast, `rankMoves`, `canAfford`, the AI forecast, the goal (T13, #69), Loan Lab and the statement pipeline keep their behavior. New code is additive. The one change to existing code is additive too: the categorizer also returns each label's class (M4).

## Approaches considered

| | A. Thin layers on the shared profile, cold-first **(chosen)** | B. Standalone mini-apps | C. One long "money check-up" wizard |
| --- | --- | --- | --- |
| Idea | Each tool is a pure engine function plus a view-model. It takes a `Profile` when one exists and asks for the minimum when it does not. | Each tool has its own inputs and storage. | One guided flow runs all tools in order. |
| For | Reuses the engine and the forecast, so a result changes the user's 10-year number. Small, parallel issues. | Zero coupling. | Strong demo story. |
| Against | Needs a clear "use this in my plan" step so a guess never silently overwrites measured data. | Duplicates inputs, never compounds with the forecast. | No standalone entry. |

For the payoff planner the owner chose **inside Loan Lab** over a separate door.

## Decisions

**By the owner (2026-11-14):** keep subscription audit, overpaying check and the debt payoff planner (inside Loan Lab, last); drop the rest.

**By me, as defaults to correct [call]:**

- **Cold-first** for the two door tools; the payoff planner uses the profile's debts and the selected loan offer, as Loan Lab does today.
- **No tools hub page.** Each door tool gets its own route (`/tools/subscriptions`, `/tools/overpaying`) and its own entry in the app navigation, added by its own issue.
- **D2, free vs Pro:** running every tool is free; the renewals `.ics` is the one candidate Pro feature. Nothing is gated in code until decided; the designer draws locked and unlocked versions.
- **D3, subscription findings are browser-local only.**
- **D4, demo path:** the subscription audit extends the "upload a statement" step ("we found 4 subscriptions, $57.96 a month, and a $139 yearly charge").
- **Issue IDs use the prefix `M`.**

## The tools

### Subscription audit (route `/tools/subscriptions`)

1. **Guess first.** "How much do you think you spend on subscriptions each month?"
2. **Tick-list.** About forty common services, each with a plan and a catalogue price (year and source, or an estimate tag). Running total.
3. **Reveal.** Guess against total, as a miss bucket, with the C+R figure quoted with its source and "a survey, not your data".
4. **Find the ones you forgot.** Upload a statement (parsed in the browser). The detector finds recurring charges, including ones not on the list, and flags price rises, intro prices that ended, overlaps and yearly charges.
5. **Plan.** Mark what you would cancel. The saving per year and over 10 years comes from the same forecast as Next Moves (nothing is cancelled for you).
6. **Renewals calendar** (`.ics`).

Hard facts from the fixture: `statement.sample.csv` has 5 months with Spotify $11.99, Netflix $17.99, Apple $2.99 and Planet Fitness $24.99 every month (monthly total $57.96), and an Amazon Prime $139 charge once in August. A yearly charge cannot be detected as recurring in under 12 months of data, so yearly detection relies on the catalogue.

### Overpaying check (route `/tools/overpaying`)

Your rent, car insurance, groceries and childcare against sourced benchmarks for your area (HUD, Census, NAIC, USDA, DOL). Shows below / in range / above, the gap per month and year, and the 10-year effect of closing it. A ZIP we do not cover gets an honest "approximate, nearest metro" path.

### Debt payoff planner (a section of Loan Lab, `/loan`)

Replaces Loan Lab's avalanche-only "payoff order" card. Avalanche against snowball against minimums-only on your debts plus the selected offer, an extra monthly payment, a debt-free date, interest saved, and the extra payment needed to finish by a chosen date. Builds on `payoffOrder` (T3) via M12.

## Honesty rules

- Every catalogue and benchmark value carries a `Source` or `isEstimate: true`.
- A guess-against-actual reveal compares like with like (ticked from memory against catalogue prices; statement against statement).
- The detector reports a confidence. Low confidence is shown as "looks recurring: is it a subscription?" and is never counted in totals until the user confirms.
- "Use this in my plan" is always an explicit, confirmed step.
- Benchmarks say "above the typical range for your area", never "you are overpaying", and name no provider.

## What is left to the builder

Thresholds and tolerances (day-of-month window, price-rise ratio, range fallbacks) are named constants in `assumptions.ts` with a rationale. Component structure inside `features/*/ui/` follows the Figma frames once they land. Catalogue contents beyond the categories listed in M4.

## Parked: household sync options (kept for reference)

If household comes back, the sync approach was open (decision D1). The merge engine is the same in all options (shared costs entered once, a merged `Profile`), and local-first ships first.

| | A. Server household by invite link | B. Local only | C. Snapshot link |
| --- | --- | --- | --- |
| How | Single-use, expiring invite; each partner publishes only the groups they chose; Postgres store, anon-ID auth | Type the partner's numbers on this device | A link carries a small snapshot, imported read-only |
| For | Real "track together" across two phones | No new disclosure; works on one device | No server state |
| Against | Consent controls, invite safety, leave/delete, idle purge; a lost device means a lost link | Partner cannot update their own numbers | Stale as soon as it is sent |
