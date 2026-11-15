# 05 · Creator packs (S17)

**Priority 5.** New screens: `S17a Packs` (gallery, `/packs`), `S17b Pack intro` (`/packs/[id]`), and `S17c Pack summary`. Playing a pack reuses the S2/S3 frames with a pack header. Product: F16 / PRODUCT.md → Marketing ("Creator packs: 'Guess the NYC 25-year-old', 'Your city vs mine'").

## What a pack is

A themed set of **five homes**, played like the daily game (explore → clues → guess → reveal), but:

- **Not daily.** A pack is always there; anyone can play it any time, and replay it.
- **Built around one comparison.** The fun is the set as a whole, so the summary is where the payoff lands.
- **Shareable by link.** Creators (TikTok, streamers) post a pack and their followers play the same five.

## Status

The pack data exists: two packs of five homes, written and sourced (task T10). **There is no route and no UI yet**, and whether pack scores count anywhere is not decided. Design it as **standalone**: pack points never go on the daily leaderboard.

## The two packs (real data)

### `nyc-25`: "Guess the NYC 25-year-old"

Five 25-year-olds in New York. Same age and city, very different months.

| # | Caption | Household |
| --- | --- | --- |
| 1 | Norwood, Bronx, a first-year teacher | 2 adults, 2 bd |
| 2 | Ridgewood studio, first job in publishing | 1 adult, studio |
| 3 | New Rochelle, reverse-commuting to a lab | 1 adult, 1 bd, **has a car** |
| 4 | Tribeca, a junior product designer | 2 adults, 1 bd |
| 5 | Tribeca, a first-year banking analyst | 1 adult, 1 bd |

Payoff: the spread. "Same age, same city: $X to $Y a month."

### `city-swap`: "Same family, five cities" / "Your city vs mine"

**One family** (2 adults, 1 preschooler, 2 bd, a car) moved to five cities: East Nashville, Arcadia (Phoenix), Avondale (Chicago), Little Havana (Miami), Jamaica Plain (Boston).

Payoff: same life, different price. The summary should line up the five cities' monthly costs side by side, split by category, so you see *what* changes (rent and childcare swing; groceries barely move).

## Screens

### S17a Packs gallery (`/packs`)

- A grid of pack cards: title, one-line hook, "5 homes", a visual. The kit has `Art` illustrations per city (austin, brooklyn, boise, tampa, queens, columbus); a pack might need its own cover art. If so, say what you need.
- Played packs show your best score and a "Play again".
- **Creator slot:** packs are meant to carry "by @creator". Our two packs have **no creator**, and we must not invent one or use a real person's name. Design the slot as optional and show the frames without it.
- Entry points to design:
  - S1 Today, under the daily Play card: "More to play: packs".
  - The daily summary, once today's five are done: "Done for today? Try a pack."

### S17b Pack intro (`/packs/[id]`)

- Title, hook, the five homes previewed without answers (city / neighborhood names only; the captions above are fine to show), "Start".
- This is the landing page for a shared link, so it has to work for someone who has never seen the app: one sentence on how to play, and no sign-up.
- Share button (link to this page).

### Playing a pack (S2/S3 with a pack header)

- Same scene, clues, guess slider and reveal as the daily game. Replace the daily header with: pack title + "Home 2 of 5" + an exit.
- No countdown to the next day (packs don't expire).
- Design one frame each: `S2 · pack header`, `S3 · pack header`.

### S17c Pack summary

- Points total and the emoji grid (same as daily).
- **The comparison payoff**, different per pack:
  - `nyc-25`: the five homes on one scale from cheapest to most expensive, with your guesses marked. `RangeScale` or `BarBreakdown` style.
  - `city-swap`: five cities as stacked bars by category (`BarBreakdown` + the chart colors). One headline: "Boston costs this family $X more a month than Phoenix."
- Share: text grid + link to the pack. (Image share cards exist for single daily results only; a pack image card would need engineering. Draw it if you think it's worth it, marked "needs engineering".)
- The bridge: "Guess your own month" to S5, as on the daily summary.
- "Play another pack".

## States

| Frame | When |
| --- | --- |
| `S17a · first visit` | No pack played |
| `S17a · some played` | Best scores shown |
| `S17b · intro` | Phone + desktop |
| `S17b · not found` | Bad or old pack link: friendly message + link to `/packs` |
| `S17c · nyc-25` | |
| `S17c · city-swap` | |
| `S17c · replay` | Second play: show previous best vs now |

## Guardrails

- Cards are **fictional composites** built from public averages. Say so on the intro ("composite households, real local prices"), because the captions sound like real people.
- No prizes, no "win".

## Checklist

- [ ] Gallery (2 states) + both entry points
- [ ] Intro page that works as a cold landing from a shared link
- [ ] Pack header on S2 and S3
- [ ] Summary for each pack, with its own comparison
- [ ] Not-found and replay states
- [ ] Optional creator slot (shown empty)
- [ ] Cover art needs listed, if any
