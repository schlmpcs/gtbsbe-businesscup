# 10 · Household (S22)

> **PARKED (2026-11-14). Do not design.** The owner cut the tools to three (subscription audit, overpaying check, debt payoff in Loan Lab). The household issues (#83, #84, #85) are to be closed as not planned. Kept for reference in case it comes back.

**Priority 3.** A new multi-step screen at `/tools/household`. Engineering: issues **#83 (M7)**, **#85 (M9)**, **#84 (M8, blocked on decision D1)**.

## The idea

Couples and families plan money together. Add a partner (and any other adults, and kids), enter the shared costs once, choose what each person shares, and see the household as one: net worth, the 10-year forecast, "Can *we* afford it?", and who covers how much of the shared costs.

It starts **local**: one person types in the partner's numbers on their own device (or hands over the phone). A **link** mode, where the partner joins from their own phone and edits their own numbers, comes after decision D1. **Draw both.** Frames that depend on the link are named `· linked` so engineering knows they are not built yet.

## Two ideas to get right

1. **Shared costs are entered once.** Rent, groceries and childcare belong to the household, not to a person. If two people each enter the rent it would be counted twice. The setup must make "entered once, for the household" obvious.
2. **Privacy is per person and per group.** Each member decides for four groups (income, savings, debts, spending) whether the household sees it. The combined view must say what it leaves out ("Excludes Partner's savings (private)") and never show a partial number as if it were complete.

## Flow

1. **Start.** "Budget with someone". Choose who: partner, another adult, kids. Start from your own numbers (your current profile is copied in, and not changed).
2. **Add a person** (local): the same fields as the balance sheet (S8): take-home pay, cash, retirement, debts. A nickname field with the helper "Stays on this device only".
3. **Kids.** Age bands (infant, toddler, preschool, school age). No names. Childcare is estimated from the area when the household has not entered it, labelled as an estimate.
4. **Shared costs.** Rent and utilities, groceries, childcare, entered once. A clear "this is for the whole household" treatment. Moving a cost between shared and personal moves the value (it is not duplicated).
5. **What each person shares** (`ShareToggle` per group, per member), with a plain preview: "The household will see: take-home pay, debts. Not shared: savings, spending."
6. **Household summary.** Combined net worth today; combined 10-year forecast (chart, with its source label "AI estimate" or "Rules-based estimate" as on S10); monthly picture (income, shared costs, personal costs); the "excludes" chips.
7. **Split.** Three methods: by income, equal, custom (a `Slider` per person). Amounts per person for the shared costs, summing exactly to the total. Warnings: "No income entered, so we split equally", "Partner's income is private, so we split equally".
8. **Can we afford it?** Enter the existing S11 flow with a banner "for the household".
9. **Use the household numbers in my plan** (confirm `Sheet`, what changes from → to).
10. **Leave or delete** (confirm).

### Link mode (decision D1 pending; draw as `· linked`)

- Not linked → **Create a link** → invite shown (copy, share; a QR code is optional). It is **single-use and expires**; say when.
- **Waiting for partner** → **Joined**.
- Joining screen for the partner: what they are joining, what will be shared (nothing until they choose), who to trust the link with.
- Edge: **link expired or already used** (one calm message for both), **household full** (4 adults), **offline**, **partner left** (their numbers disappear from the view; say so).
- What we keep: "Only the groups you choose to share are stored on our server, with no names, and are deleted when you leave. If you lose this device we cannot recover your link."

## States

| Frame | When |
| --- | --- |
| `S22 · Start` | |
| `S22 · Person` and `· Kids` and `· Shared costs` | |
| `S22 · Sharing` | Per-member toggles with the preview |
| `S22 · Summary` | Complete numbers |
| `S22 · Summary · excludes` | A group is private |
| `S22 · Summary · one person` | A household of one looks like a normal profile |
| `S22 · Split · income / equal / custom` | Plus both warnings |
| `S22 · Use in my plan` | Confirm sheet |
| `S22 · Leave` | Confirm |
| `S22 · Link · not linked / invite / waiting / joined / join screen / expired / full / offline / partner left` | Marked `· linked`, pending D1 |

## Data you can rely on

Per member: `role` (you, partner, adult), the groups they share, and the profile fields from S8. Household: `kids` (age bands), `shared` costs with estimate flags, `sharedDebts`, `zip`. View: combined profile numbers, `excluded` (member and group), split `shares` (amount and rate per member), `warnings`. The combined forecast comes from the same source as S10. The server (linked mode) holds numbers only, no names.

## Wording guardrails

- **"Partner"** by default; no assumptions about gender, marriage or who earns more. Say "who covers what", never "who earns more" or "who owes".
- Never present the split as the "fair" answer. It is one of three options, and the screen says what each assumes.
- Nicknames are local. Anywhere the app would show a name, show it only if it was typed on this device.
- No advice on how a couple should divide money.
- Hidden in streamer mode (`?stream=1`).

## New components

`MemberChip` (a person with role and what they share), `ShareToggle` (group + plain-language preview), `SplitBar` (shares of the shared costs per person), `InviteCard` (link, expiry, copy). Existing: `Sheet`, `Slider`, `Stat`, `Tag`, `EstimateTag`, `ForecastChart`.

## Checklist

- [ ] The ten local frames and their states
- [ ] Per-group privacy with the plain-language preview
- [ ] "Excludes" chips; the one-person case
- [ ] Split in three methods and both warnings
- [ ] Link-mode frames drawn and marked `· linked`
- [ ] Phone first; desktop frame for Summary
