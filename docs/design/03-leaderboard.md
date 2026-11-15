# 03 · Daily leaderboard (S16)

**Priority 3.** New screen `S16 Leaderboard` at **`/leaderboard`**, plus two small embeds. Product: F16 "Game as marketing".

## Status

The backend is done and tested: `GET /api/leaderboard`. Players are ranked by the points the **server** scored, so nobody can post a fake score. The UI is the only missing part.

## What the data contains (and nothing more)

One request returns, for one day (the US Eastern calendar date):

| Field | Meaning |
| --- | --- |
| `date` | The day's date (`YYYY-MM-DD`) |
| `players` | How many people played that day |
| `entries[]` | Up to 50 rows (configurable 1–100), each: |
| ↳ `rank` | 1, 2, 3… **Ties share a rank** (two players on 4,200 are both #3, and the next one is #5). Among tied players, whoever finished first is listed first. |
| ↳ `handle` | A **made-up name** from a hash, e.g. **"Thrifty Otter 12"**, **"Savvy Panda 3"** (adjective + animal + number). No real names, no IDs. |
| ↳ `points` | Total points today (0–5,000: five homes × max 1,000) |
| ↳ `played` | Homes guessed so far (0–5) |
| ↳ `inRange` | How many guesses landed inside the home's typical range |
| ↳ `you` | True on the viewer's own row |
| `rank` | The viewer's own rank (null if they haven't guessed yet) |
| `todayStats` | The viewer's own points / played / inRange (null before their first guess) |

Not available, so don't design for it: avatars, profile pictures, countries, all-time or weekly totals, friends, streaks, a player's guesses per home, or the ability to tap into another player.

The handle word lists are in `apps/web/src/copy/game.ts` (32 adjectives × 32 animals). Use real ones in frames.

## Where it appears

### A. Full screen `/leaderboard` (S16)

- Header: "Today's leaderboard", the date, and "{players} players".
- **Your row pinned.** If you're outside the visible top 50, show your row at the top or bottom, separated ("…" gap), with your rank. Your row is highlighted and says "You".
- Table rows: rank · handle · points · played (as "4/5" or five small dots) · in range (e.g. "3 in range").
- **Top 3** get extra treatment (`Sticker`, medal-like, without trophies or prizes: **no prizes** is a legal guardrail).
- Players still mid-set (played < 5) should look different from finished ones, e.g. a muted "playing" note. Their score isn't final.
- Countdown to the next set (reuse the `Countdown` style from the game): the board resets at US Eastern midnight.
- CTA by state:
  - Not played today → "Play today's five" (to `/play`).
  - Mid-set → "Continue (3/5)".
  - Finished → "Guess your own month" (to S5), the main funnel step.
- Link back to the game.

### B. Embed on the game summary (after five homes)

`SummaryView` currently shows the emoji grid, total points, share, and the bridge to "guess your own". Add a compact board:

- Your rank as a headline ("#12 of 340 today"), the top 3, and your row.
- "See full leaderboard" link to S16.
- Must not push the **"Guess your own month"** bridge below the fold on phone. That bridge is the most important button in the funnel. If space is tight, the leaderboard loses.

### C. Embed on S1 Today (optional)

On the "Play" card after finishing: "You're #12 today" + link. Mark it optional in Figma.

## Streamer mode (`/play?stream=1`)

Streamers show this on screen. Design a **large** variant of the summary embed (display-size rank, top 5) that reads from across a room. Handles are already anonymous, so it's safe to show.

## States

| Frame | When |
| --- | --- |
| `S16 · loading` | Skeleton rows |
| `S16 · empty` | `players: 0`, the first person of the day: "No one has played today yet. Be first." |
| `S16 · not played` | Viewer has no rank; no pinned row; CTA to play |
| `S16 · mid-set` | Viewer played 2/5, rank provisional |
| `S16 · finished, in top 50` | Own row inside the list, highlighted |
| `S16 · finished, outside top 50` | Own row pinned separately |
| `S16 · ties` | Show two rows sharing a rank |
| `S16 · error` | Store down (`unavailable`) or too many requests (`rate_limited`): message + retry. Never an empty table that looks like nobody played. |
| `S2 · summary + leaderboard` | Embed B, phone + desktop |
| `S4 · summary + leaderboard (stream)` | Embed B large |

## Copy to write

Title, subtitle with player count, column headers, "You", the empty and error messages, "playing" marker, the three CTAs, "See full leaderboard", rank sentence ("#{rank} of {players} today"). Keep it playful but plain. No "loser", no shaming for low ranks: ranks below the top 50 are "outside the top 50", not "unranked".

## Checklist

- [ ] S16 phone + desktop, all states above
- [ ] Top-3 treatment (no prize language)
- [ ] Pinned own row
- [ ] Summary embed (normal + streamer large)
- [ ] Optional S1 one-liner
- [ ] Copy for every string above
