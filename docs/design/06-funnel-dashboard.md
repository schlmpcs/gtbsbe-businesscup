# 06 · Funnel dashboard (S19, internal)

**Priority 6.** One internal page, `S19 Funnel`, at **`/admin/funnel`**. Not linked from the app's navigation and hidden from search engines, like the `/kit` showcase. Its audience is **the team and the judges**: during the pitch we open it to show real usage numbers from the live app instead of numbers typed into a slide.

## Status

The backend is done: `GET /api/events/funnel?days=N` returns aggregates only (counts of anonymous IDs, no personal data). No page exists.

## The data

Window: the last **N days** (1–90, default 7). The response holds:

**Headline**
- `users`: distinct anonymous visitors who sent any event in the window
- `from` / `to`: the window's start and end

**Funnel steps, in order** (each: `users` who did it, `funnel` = how many also did every earlier step, `conversion` = share from the previous step, which can be empty when the previous step is 0):

| # | Event | Label to use |
| --- | --- | --- |
| 1 | `play_started` | Started the game |
| 2 | `game_finished` | Finished five homes |
| 3 | `own_guess_submitted` | Guessed their own month |
| 4 | `sliders_adjusted` | Adjusted quick sliders |
| 5 | `balance_sheet_edited` | Filled the balance sheet |
| 6 | `statement_applied` | Uploaded a statement |
| 7 | `forecast_viewed` | Saw their 10-year forecast |
| 8 | `paywall_viewed` | Saw the Pro offer |
| 9 | `pro_purchased` | Bought Pro (test mode) |

**Game stats:** `players`, `finished`, `finishRate`, `guesses`, `cluesPerHome` (average clues opened per home), `blindGuessRate` (guesses with zero clues), `shared`, `shareRate`.

**All events:** a count of users per event, including ones outside the funnel (`clue_opened`, `home_guessed`, `result_shared`, `closest_life_chosen`, `move_committed`, `afford_checked`, `loan_compared`, `checkout_started`, `pro_promo_redeemed`).

## Layout

Design for a **laptop on a projector first** (1280–1440 wide, readable from the back of a room), then check that it doesn't break on a phone.

1. **Header:** "Funnel", the window ("Nov 7 – Nov 14"), and a window picker (`Choice`: 1 day · 7 days · 30 days · 90 days).
2. **Headline row:** `Stat`s for total users, players, finish rate, share rate.
3. **The funnel:** nine horizontal bars, widest at the top. Each bar shows the count, the strict funnel count (did every step before it) and the step conversion as a percentage. Show both numbers (`users` and `funnel`) distinctly; they answer different questions. Explain the difference in one muted line.
4. **Game panel:** clues per home, blind-guess rate, finished vs started.
5. **All events table:** event label + users, sorted by count. A collapsible section is fine.
6. **Footer note** (exact meaning, your wording): counts are anonymous browser IDs; browsers with Do Not Track or Global Privacy Control send no events, so real usage is higher.

## States

| Frame | When |
| --- | --- |
| `S19 · data` | Normal |
| `S19 · early` | Few users: steps at 0 and conversions empty. Show "—", not "0%" or "NaN". |
| `S19 · loading` | |
| `S19 · unavailable` | The store is down (503): plain message |
| `S19 · presentation` | Optional: one big-type view for a slide moment (the funnel only, display-size numbers) |

## Guardrails

- Never fake or round up numbers. If a step has tiny counts, the page shows tiny counts.
- No individual user rows, ever. Aggregates only.
- Percentages need their base visible ("38% · 12 of 31") so a 100% from 1 user can't mislead.

## Checklist

- [ ] Projector-first layout + phone check
- [ ] Funnel bars with users / funnel / conversion
- [ ] Headline stats and game panel
- [ ] Events table
- [ ] Early, loading, unavailable states
- [ ] Optional presentation view
