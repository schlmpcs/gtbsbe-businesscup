# 09 · Tools hub (S20)

> **PARKED (2026-11-14). Do not design.** The owner cut the tools to three, and a hub of two cards holds nothing. Each tool has its own route and navigation entry instead; the optional entry points on S1 and S3 are listed in briefs 08 and 11. Kept for reference only.

**Priority 2 of the tools.** A new screen at `/tools`, the list of the six tools. Engineering: issue **#78 (M2)**.

## The idea

Six small tools, each of which other apps sell as a whole product. The hub is the shelf. It has to say what each tool does in one line and make a person want to open one, before they have entered anything. Nothing here shows personal data.

| Tool | Route | Working title | One line |
| --- | --- | --- | --- |
| Subscription audit | `/tools/subscriptions` | Subscription audit | Find what you pay for every month, including what you forgot |
| Household | `/tools/household` | Household | Budget with a partner or family, tracked together |
| Overpaying check | `/tools/overpaying` | Am I paying more than typical? | Your rent and bills against your area |
| Debt payoff planner | `/tools/payoff` | Debt payoff | The fastest way out, and the date |
| Runway meter | `/tools/runway` | Runway | How many months your cash would last |
| Yearly-bills smoother | `/tools/yearly` | Yearly bills | Turn once-a-year bills into a monthly number |

The names above are working titles. Rename freely and tell Amir; the code reads names from `copy`.

## What to draw

- **Hub, phone and desktop.** A card per tool: icon, title, one line, and a quiet "no sign-up" cue. Order as in the table (subscriptions first).
- **Card states:** available; coming soon (a tool can be listed before it ships, with `available: false`); and, optionally, "you have used this" (a small check) if you want it. The code can know only whether the browser has local data for the tool.
- **Entry points** (optional, mark as optional): a one-line link from S1 Today ("Check your subscriptions") and from the game result screen S3 ("Most people guess low on subscriptions. Check yours").
- **Navigation:** where "Tools" sits in the app navigation.
- **Stub page** for a tool that is not live yet: a card with the one-liner and "coming soon", so no link dead-ends.

## States

| Frame | When |
| --- | --- |
| `S20 Tools` | All six available |
| `S20 Tools · some coming soon` | Mixed |
| `S20 Tools · desktop` | |
| `S20 Tool stub` | A tool not live yet |

## Data you can rely on

For each tool: `id`, `route`, `available` (boolean). Titles and lines come from `copy`. Nothing about the user.

## Wording guardrails

- "Educational simulation, not financial advice" in the footer, as on the other screens.
- No claims like "save $X": the hub shows no numbers.
- Hidden in streamer mode (`?stream=1`).

## Checklist

- [ ] Hub phone and desktop; six cards
- [ ] Available, coming soon, and the stub page
- [ ] Navigation placement
- [ ] Optional entry points on S1 and S3 (marked optional)
