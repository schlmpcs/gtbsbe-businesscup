# Design brief: the pages still missing

For: **Kiko** (UI/UX, Figma). From: Amir. Date: 2026-11-14.

Frames S1–S15 are designed (D2) and built on `main`. This folder covers everything that has **no Figma frame yet**: new features whose backend or data exists but no screen does, new states that the AI forecast adds to screens you already designed, an exploratory track for the duel game, and **three new small tools** (briefs 08, 11 and 12; briefs 09, 10, 13 and 14 are parked).

Read this file first. It holds the rules every frame follows. Then take the briefs in priority order.

## What to design, in order

| # | Brief | Frame IDs | Kind | Why this order |
| --- | --- | --- | --- | --- |
| 1 | [AI forecast states](01-ai-forecast-states.md) | S1, S5–S10 variants | New states on existing frames | Being built now (Y18–Y20); on the 2-minute demo path |
| 2 | [Goal card](02-goal-card.md) | S10 · Goal | New card on an existing screen | Issue #69 is open; on the demo path |
| 3 | [Daily leaderboard](03-leaderboard.md) | S16 | New screen + 2 embeds | API done and tested; only the UI is missing |
| 4 | [This Life vs Yours](04-this-life-vs-yours.md) | S18 | New panel on S3 (+ teaser) | Bridges the game to the app (the funnel's key step) |
| 5 | [Creator packs](05-creator-packs.md) | S17 | New screens (gallery, intro, summary) | Pack data done (2 packs × 5 homes); no route or UI |
| 6 | [Funnel dashboard](06-funnel-dashboard.md) | S19 | Internal page | API done; for live numbers in the pitch |
| 7 | [Duel game (exploratory)](07-duel-exploration.md) | X1–X8 | Proposal, not agreed | Open decisions; start with a low-fi prototype to test |
| 8 | [Subscription audit](08-subscription-audit.md) | S21 | New multi-step screen | Agreed. The tool closest to the demo path (extends the statement upload); the engine and catalogue are being built |
| 9 | [Tools hub](09-tools-hub.md) | S20 | **Parked** | Cut: a hub of two cards holds nothing. Do not design |
| 10 | [Household](10-household.md) | S22 | **Parked** | Cut on 2026-11-14. Do not design |
| 11 | [Overpaying check](11-overpaying-check.md) | S23 | New screen | Agreed. Sourced area data already exists |
| 12 | [Debt payoff planner](12-debt-payoff.md) | S12 · Payoff | New section on S12 Loan Lab | Agreed, last. Replaces the old payoff-order card; not a separate screen |
| 13 | [Runway meter](13-runway-meter.md) | S25 | **Parked** | Cut on 2026-11-14. Do not design |
| 14 | [Yearly-bills smoother](14-yearly-bills.md) | S26 | **Parked** | Cut on 2026-11-14. Do not design |

1 and 2 change screens judges will see in the demo, so they come first. 3–6 are new surfaces with data already in place. 7 is a proposal: design it low-fidelity until the team settles the open decisions listed there. 8, 11 and 12 are the three micro-tools, in that order: do 8 early, then 11, and 12 last. 9, 10, 13 and 14 are parked.

## Ground rules (apply to every frame)

### Use the existing system

- **Tokens only.** Every color, type size, spacing, radius and shadow comes from the Figma variables collection **"LifeGuessr / Dollhouse"** (exported to `tokens.json`). If a frame needs a new value, add it as a variable and tell Amir. `pnpm tokens` turns it into CSS. Do not use one-off hex values.
  - Colors: `bg`, `surface`, `surface-strong`, `border`, `text`, `text-muted`, `primary` (+ `-hover`, `-soft`), `on-primary`, `positive` (+ `-soft`), `warning`, `negative`, `ink`, chart `1–6`, `chart.band`, `chart.grid`.
  - Type: `display` (Bricolage Grotesque) for headlines, `sans` (DM Sans) for everything else, `mono` for codes. Sizes `xs`–`4xl`, `display`.
  - Spacing `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`. Radius `sm 8 · md 12 · lg 18 · xl 24 · full`.
- **Components by their ui-kit names.** Name Figma components after the code so the skin pass maps one-to-one. The kit has `Art`, `BarBreakdown`, `Button` (primary / secondary / ghost / dark; sm / md / lg), `Card` (default / muted / arena), `Choice` (segmented radio row), `EstimateTag`, `Field`, `ForecastChart`, `Gauge`, `HouseScene`, `LockNotice`, `Money` / `Percent`, `NumberInput`, `PageHeader`, `Scoreboard`, `Sheet`, `Slider`, `SourceNote`, `SpriteImage`, `Sticker` (primary / ink / positive / soft, with tilt), `Stat` (default / positive / warning / negative), `Tabs`, and `Tag` (new: a small pill, solid or dashed, coming with the AI forecast). You can see all of them live at `/kit`.
- **New component?** Draw it as a component and name it in PascalCase. Say in the frame notes that it is new, so it gets built in the kit instead of inside a screen.

### Frames

- **Names:** `S16 Leaderboard`, `S16 Leaderboard · empty`, `S10 · Goal · behind`, and so on: screen ID first, then the state. Exploratory duel frames use `X1…X8` so nobody mistakes them for agreed screens.
- **Sizes:** the same frame widths you used for S1–S15. Design phone first. Add a desktop frame wherever the matching existing screen has one.
- **Every frame needs its states.** Each brief lists them. The usual set is loading, empty, error, and the "not available yet" case. Code builds exactly what the frames show, so a missing state becomes an improvised one.
- **Copy:** write real English copy in the frames, not lorem ipsum. Engineers move it into `src/copy/*` verbatim. Where a brief gives exact copy that already exists in the code, keep it word for word, or flag your change in a comment.
- **Numbers in frames are illustrative.** Use plausible values (the briefs give some), and never present a frame as real data in the pitch deck.

### Wording guardrails (the judges check these)

- It is an **"educational simulation, not financial advice"**. Never recommend a lender, an investment or a security.
- Forecast language: "projected", "based on your inputs", "under our assumptions". Never "you will have / you will reach".
- **Every number shows where it comes from.** Data carries a source note (name + year), defaulted inputs carry the `EstimateTag`, and forecasts carry their source label ("AI estimate" / "Rules-based estimate"). If a frame shows a number, it needs room for its label.
- **Never shame.** Low or negative net worth, a bad guess, a last-place rank: the tone is "most people are off, here's how to see it".
- **No personal data on screen that the app does not have.** There are no accounts, names, emails or avatars. Players are anonymous. Leaderboard handles are made up ("Thrifty Otter 12").
- **Streamer mode (`?stream=1`) never shows the player's own money.** Anything personal is hidden there.

### Accessibility

- Text contrast at least 4.5:1 (3:1 for large text). Check muted text on `surface-strong` and on the `arena` card.
- Never use color alone for meaning (tp/fp style): pair it with an icon, a word or a shape. This matters for verdicts, ranks and the funnel bars.
- Touch targets at least 44 × 44 px on phone.
- Draw the focus ring (`focus` = primary) on at least one interactive element per new component.

### The micro-tools (briefs 08, 11 and 12): shared rules

The tools are small products that other apps sell whole. They share a few patterns. Design these once, as components, and reuse them.

- **Cold first** (subscription audit and overpaying check). Each must look right with **no data at all**. The first frame is a question or an input, never an empty dashboard. A profile only prefills; it is never required. The payoff planner lives in Loan Lab and uses your profile's debts.
- **"Use this in my plan" confirm sheet.** When a tool can write into the profile, it never does it silently. One `Sheet` lists exactly which fields change, **from → to**, with estimate and measured tags, and Cancel is the default focus. Same sheet in every tool.
- **Where a number comes from.** Catalogue and benchmark values show a `SourceNote` (name and year) and an `EstimateTag` where they are estimates. Say whether a number is "from your ticks" or "from your statement". A guess is compared only with a number of the same kind.
- **"Stays in this browser" tag.** Anything that never leaves the device (findings, tick choices, overpaying inputs) carries a small `Tag` that says so. Add a "What we keep" link as on S9.
- **Locked states.** Free or Pro is not decided. For the calendar export, draw **both** the locked version (`LockNotice`) and the unlocked one. Do not decide what is locked.
- **Streamer mode.** The two door tools are hidden in `?stream=1`; the payoff section follows the rest of Loan Lab.
- **Names are working titles.** The tool names can be renamed; tell Amir and the copy follows.
- **Tone.** A forgotten subscription, a high rent and a large debt are facts, not failures. No red for a miss, no "you should".

## Handing off

1. Put the frames in the existing Figma file, in a page called **"Missing pages (Nov 14)"**, one section per brief.
2. Tick the checklist at the bottom of each brief and leave a comment on any decision you made yourself.
3. Tell Amir which briefs are ready. Engineering then rewrites only `features/<feature>/ui/*` against the frames (the Figma handoff procedure in `docs/ENGINEERING.md`). If a frame needs data the app does not have, it comes back to you as a question. Nothing gets faked.

## Where things live (for reference)

- Product context: `docs/PRODUCT.md` (agreed) and `docs/PRODUCT-NEXT.md` (the duel proposal).
- Screen list and routes: `docs/ARCHITECTURE.md` → Screens.
- AI forecast spec: `docs/ENGINEERING.md` → AI forecast.
- Goal spec: GitHub issue #69.
- Micro-tools: `docs/superpowers/specs/2026-11-14-micro-tools-design.md` (design), `docs/superpowers/plans/2026-11-14-micro-tools.md` (plan and split), GitHub issues #77 to #82 and #86 to #89 (#83 to #85, #90 and #91 are parked).
