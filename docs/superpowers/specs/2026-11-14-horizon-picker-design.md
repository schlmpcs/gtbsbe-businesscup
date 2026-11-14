# Horizon picker (S10): design

Date: 2026-11-14. Owner: Amir. First of three forecast features (then future life events, then 15–30 year horizons).

## Intent

On S10 ("You in 10 years") the user picks how far ahead to look: 1, 3, 5 or 10 years. The headline net worth, its range, the chart and the Next Moves gains and ranking all switch to that year. Short horizons answer "what happens soon"; they also change which move wins (paying a card down pays off early, a spending cut builds up slowly).

## Goals

- One horizon for the app, picked on S10, remembered with the session (store, `localStorage`), default 10. S1's forecast card and its Next Moves follow it, so the move order is the same on both screens.
- Every number shown at the chosen year comes from the one answered bundle (AI or rules) and is labeled as today.
- AI answers are checked at every offered year (1, 3, 5, 10), not only at year 10.
- No extra model call when the horizon changes, and no prompt change (the AI already writes years 1–10).

## Non-goals

- Horizons beyond 10 years (feature 3). The horizon list is built so 15/20/30 can be added there.
- Life events (feature 2).
- Changing the Goals card (#96): it keeps its own horizon, rules-only.
- Fixing the AI's undervaluing of `payCardFirst` (open issue from #98). The new checks may expose it more often; we measure it.

## Anti-goals

- A number on screen at year N that no check looked at.
- The server learning the horizon, or a new model call per horizon (cost and latency).
- A screen mixing AI and rules numbers for one horizon.

## Approaches considered (owner picked 1)

1. **Check every offered year, one source per answer (picked).** The server checks the base and each scenario at years 1, 3, 5, 10, with margins that shrink at short horizons. A failure takes today's path: one retry with the issues, then the whole answer falls back to rules. Labels unchanged. Cost: more answers may fall back; measured before shipping.
2. Per-horizon fallback: the same checks, but a failure only turns that horizon to rules. Fewer full fallbacks, but the bundle contract changes (which years passed), the source label changes as you switch, and retries happen less often.
3. Rules below 5 years: the AI headline at every year, move gains at 1 and 3 years from rules. No new checks, but one screen mixes sources at short horizons.

Scope: the owner picked app-wide and remembered (over S10-only with S1 at 10 years, and S10-only not saved).

## Design

### Contracts (`packages/types`)
- `FORECAST_HORIZONS = [1, 3, 5, 10] as const` and `type HorizonYears = (typeof FORECAST_HORIZONS)[number]` in `constants.ts` / `index.ts`. Feature 3 extends the list.
- `Move` is unchanged: `effect10y` keeps meaning the 10-year effect (Goals, loans, overpaying and the persisted `committedMove` rely on it; renaming it would silently drop users' committed moves on load).
- `ExplainRequest` gains optional `horizon?: { years: HorizonYears; effect: Money }`. When present the explanation is about that horizon's gain; absent means 10 years as today. Type, fixtures and both consumers in this PR (rule 3).

### Engine (`packages/engine`)
- `scenarioEffectIssues(candidate, reference, envelope, years = 10)`: compares the effect at month `12·years`; its messages name the year. The dollar floor scales with the horizon: `effectFloor × years / 10` ($100 at 1 year, $1,000 at 10, unchanged). The ratio range (1/3×–3×) and the "move changes nothing" rule are unchanged.
- `forecastSanityIssues`: the floor in months of pay scales with the year: `floorMonths × year / 10` (1.2 months of pay at year 1, 12 at year 10, unchanged). Replayed offline on last session's 11 live answers: none would have been rejected.
- `rankCandidates` ranks by the effect `effectOf` returns, unchanged; the caller decides which year it measures.
- Helpers `pointAt(f: Forecast, years)` (the month-`12·years` point, RangeError if missing) so no caller indexes `points[120]` by hand for the shown horizon.

### Server (`apps/web/src/server/ai/forecast.ts`)
- After the base envelope, each scenario's effect is checked at every year in `FORECAST_HORIZONS`. Retry and fallback as today. No change to the prompt, `PROMPT_VERSION` or the cache key (the checks don't change what is asked; cached answers were all checked at year 10, and the cache empties on every deploy anyway).

### Client
- Store: `horizonYears: HorizonYears` (default 10), `setHorizonYears`, persisted and validated like the other fields (an invalid saved value keeps the default).
- `shownForecast(forecast, todaysDollars, years)`: `in10y` becomes `atHorizon` (the point at the chosen year); the band rule reads that point.
- `useNextMoves`: `rankAnswer` ranks by the effect at the chosen year. `MoveVM` gains `effect: Money` (at the horizon) and `horizonYears`; `effect10y` stays on the move.
- `useFuture` / `useToday`: headline, range, committed preview and the compare value at the chosen year. S10's chart shows months 0 to `12·years` (my call: the headline and the chart then tell the same story; at 1 year the AI line is a straight line between its two anchors, which is honest).
- `useMoveExplain`: requests carry `horizon`; a cached explanation is reused only for the same move, source, effect and horizon.
- Analytics: `forecast_horizon_changed` with `{ years }` (strict events list updated).

### UI (presentational only)
- S10: a segmented control (1 / 3 / 5 / 10 years, a radio group for screen readers) above the headline. Title and copy read "You in N years", "Net worth in N years", "Your net worth over the next N years", "Ranked by N-year gain", "+$X in N years" (singular for 1 year). Copy in `src/copy/forecast.ts`.
- S1: no picker; its forecast card and move gains read the chosen horizon.
- The route stays `/future`. Kiko's Figma frame needs the picker and the "N years" wording (to tell Kiko).

### Testing and verification
- Engine: effect and envelope checks at each year, scaled floors, `pointAt`.
- Server: a scenario that passes at year 10 but fails at year 1 triggers the retry and then the rules fallback.
- View-models: headline, range, ranking by the chosen year's effect (a constructed answer whose order flips between 1 and 10 years; on the demo profile the rules order does not flip: card payoff +$513 vs spending cut +$1,077 at 1 year, +$6,344 vs +$10,773 at 10), S1 following the store, explain cache keyed by horizon.
- e2e: switching the horizon on S10 changes the headline and the move gains without a new forecast request.
- Live measurement before merge: about 5 requests to the live `/api/ai/forecast` (current code) for the variants used on 2026-11-14, then replay the new checks offline on those answers to count how many would fail. Tune the scaled floors only if the replay shows false rejections. Every model call is counted and reported.
- After merge and deploy: check S10 on the live site at each horizon (source label, headline, move order).

## Left to the builder
- Exact component and test file layout; the radio-group primitive in `ui-kit` if none fits.
- Wording details beyond the strings above.
