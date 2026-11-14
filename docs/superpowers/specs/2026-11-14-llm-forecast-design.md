# AI-produced forecast for the demo (design)

Status: approved by the owner on 2026-11-14 (approach A). Refined the same day after reading `origin/main`, which already has the Y1–Y4 engine, the Y7 view-models and the Y12 AI routes, and again after an independent review of the plan (stale-bundle handling, a per-move effect check, timeouts, S5 and explanation wording). Size: small change (one route, one cache, a few pure helpers, async view-models, tests, doc amendments).

## Intent and why

The owner judged the rules-based forecast in `docs/ENGINEERING.md → Forecast` not accurate enough and wants an AI/ML predictor. A trained ML model is the end goal, but there is no outcome data to train or measure it on (no login, no stored statements). For the hackathon demo, Claude produces the forecast numbers. After the demo, a trained model replaces it.

## Decisions by the owner

- **Approach A:** the LLM is the forecaster. It receives the profile and returns the net-worth forecast. (Considered and not chosen: B, the LLM estimates inputs and the engine simulates; C, the engine forecasts and the LLM gives a second opinion.)
- The LLM may produce a number shown as a result. This amends golden rule #1 in `CLAUDE.md`.
- A trained ML model replaces the LLM later.

## Goals

- The 10-year forecast (low / mid / high) and the `effect10y` of Next Moves come from Claude via a new route.
- The route's response shape is one that a later trained model can fill without touching the UI.
- Output is validated in code, so a bad model answer never reaches the UI.
- The app still works with no `ANTHROPIC_API_KEY`, offline, and when the route is rate-limited.

## Non-goals

- Training an ML model now.
- LLM-computed loan amortization, guess scoring, card cost, affordability or month-end. They are exact or rule-based, and an LLM only adds error.
- Changing `Forecast`, `Move` or `AffordResult` in `packages/types`. New types are added next to them.

## Anti-goals (a failure even if it technically works)

- Presenting the AI forecast as deterministic, audited or "computed by the engine". The 40% "not faked" criterion is met by being honest about the source.
- Showing unvalidated model output (non-finite numbers, `low > mid`, missing years, a month-0 value that is not today's balance sheet).
- Making the app unusable without the key or during an outage.

## Constraints

- Server-side only; the key never reaches the browser. Reuse what Y12 merged (#34): `getLlmClient`, `llmModel`, `devLog`, `responseText`, `readJsonBody`, `checkAiRateLimit` patterns, `zodOutputFormat` structured output, the SDK-mocking test helpers.
- The profile sent is numbers only: no names, no account numbers (rule #6).
- Reuse the rules engine as it is on `origin/main`: `forecast()` (Y2) is the fallback and the sanity reference; `rankMoves` (Y3) keeps its signature and behavior.
- Tests and Playwright never call a live model.

## Approaches (summary)

| | Trade-off | Outcome |
|---|---|---|
| A: LLM is the forecaster | Fastest; flexible. Non-deterministic, no golden snapshot, move ranking is noisy, arithmetic can drift. | **Chosen by the owner** |
| B: LLM estimates inputs, engine simulates | Math stays testable and ranking stable; LLM numbers enter only as labeled inputs; clean slot for the ML model later. | Recommended, not chosen |
| C: engine forecasts, LLM second opinion | Keeps rule #1 for headline numbers; adds no accuracy; two numbers on screen. | Not chosen |

## Design (my calls, for the owner to veto)

1. **Contract.** `POST /api/ai/forecast { profile, rates?, scenarios?: { id, patch }[] }` returns `ForecastBundle = { source: 'ai' | 'rules', model?, base: Forecast, scenarios: Record<id, Forecast> }`, in **nominal dollars**. A trained model later answers the same shape with another `source`. New types live in `packages/types` with zod schemas.
2. **What the model returns.** Yearly anchors (years 1–10: low, mid, high) for the base profile and for each scenario, in one structured-output call. Code interpolates linearly to the 121 monthly points `Forecast` requires. **Month 0 is not asked of the model:** it is today's `cash + retirement − debts`, computed by code, with low = mid = high.
3. **Today's dollars is code.** The model returns nominal dollars; `deflateForecast` applies the area's inflation, exactly as the engine does. The today's-dollars toggle needs no second call, and the cache works for both states.
4. **Checks, in code.** Exactly years 1–10; finite; `low ≤ mid ≤ high`; every scenario id present. Then a **sanity envelope against the rules forecast** of the same profile: each anchor's mid within `[rules.low − tol, rules.high + tol]`, `tol = max(0.5 × |rules.mid|, 12 × takeHomePay)`, and band width at most 3× the rules band (or `tol`). This catches wrong units (thousands, percent) and runaway answers, but it is too loose to see a bad *move*: the floor is about $62k on the demo profile and move effects are thousands. So each scenario also gets an **effect check**: the year-10 difference (scenario − base) must have the rules difference's sign and lie within ×0.25–×4 of it, or within $1,000 of it; when the rules effect is under $1 the AI effect must be within $1,000 of zero. One retry with the issues listed; then fall back. The constants are `aiForecastSanity` in `assumptions.ts`: guards, flagged as assumptions, kept out of the user-facing assumptions list.
5. **Moves.** The engine keeps generating candidates and rules (`moveCandidates`); the AI supplies each candidate's forecast in the same response as the base, so `effect10y = scenario − base` comes from one answer (`rankCandidates`). `rankMoves` is rebuilt on the same two functions with the rules forecast as the effect, so its behavior and tests do not change. The committed move is sent as a scenario too, for the "with your move" line.
6. **Fallback, twice, with bounded time.** Server: no key, provider error, refusal, a hung call, or two failed checks → the route returns `rulesBundle` with `source: 'rules'`. Each model call has its own timeout and no SDK retry; the whole request has a deadline (starting values 12 s per call, 20 s total, retry only if at least 8 s remain; raised on 2026-11-14 to 30 s, 40 s and 15 s for Claude Opus 5.5 at effort low, which answers in 15–20 s: see docs/ENGINEERING.md → AI forecast). Client: network error, rate limit (429), an invalid or incomplete body, or no answer after 25 s (now 50 s) → the hook computes the same bundle locally with `forecast()`. Labeled "Rules-based estimate". Since 2026-11-14 the client also shows that local bundle at once while the model's answer is on its way (rules first), instead of a skeleton.
7. **Stability.** The model, the server cache key and the client key all use `forecastFacts(profile)`: the profile without `zip`, `committedMoveId` and `doneMoveIds`, so committing or finishing a move never re-calls the model for the same numbers. Server cache: in-memory, 1 hour, key = hash of canonical JSON of (facts, scenarios, rates) + model + prompt version; concurrent identical requests share one call; only `source: 'ai'` is cached, so an outage heals. Client: no debounce for the first request or a remembered answer, debounce after that, abort the previous request, ignore stale responses, and keep one answer per profile for the session. Each bundle is stored with the (profile, candidates) pair it answered, and Next Moves are ranked from that pair, so a refreshing screen never ranks with scenarios that belong to other patches; ids now in `doneMoveIds` are dropped immediately.
8. **Rate limit.** Own limiter (not the parse/explain budget): every slider edit would otherwise starve them. A 429 falls back to rules.
9. **Labeling.** Every forecast shows its `source` ("AI estimate" / "Rules-based estimate") and the "How we calculate" panel says which. The AI band is the model's own uncertainty, told which inputs are estimates.
10. **Scope.** The headline forecast and the moves' `effect10y`. `canAfford` (needs per-month cash and card balances that `Forecast` does not carry), Loan Lab, `monthEnd`, `costOfLife` and `scoreGuess` stay on code. `canAfford`'s `with` / `without` lines are rules-based and are not labeled AI. S5 (Quick Sliders) keeps the rules preview, because a drag needs instant feedback, and is labeled "Rules-based preview" so S5 and S10 never show two unlabeled "in 10 years" numbers. The explain route takes the move's `source` and words the sentence accordingly (Y20); "In our simulation" is wrong for an AI number.
11. **Doc amendments in the same effort:** `CLAUDE.md` rule #1, `docs/ENGINEERING.md` (AI forecast section, AI usage rules, testing), `docs/ARCHITECTURE.md`, `docs/TASKS.md` (Y15–Y20), `docs/PRODUCT.md`, `README.md`. Done on the planning branch.

## Consequences for the pitch (found while reading the docs)

`docs/PRODUCT.md` claimed "the same inputs always give the same numbers" and planned a "ChatGPT twice vs us twice" demo. With approach A the forecast comes from a model too, so neither holds. Rewritten: the pitch says plainly that a model produces the forecast and code checks it, and the demo shows the guardrails (label, fallback, engine tests) instead of a determinism comparison. The F7 claim "uploading a statement tightens the range" is no longer true by construction: the AI forecast is told which inputs are estimates, but the model chooses the width. The eval script (Y19) checks it, and the demo script says to check it in rehearsal.

## Risks

- **Run-to-run spread** on the same profile. Mitigation: cache, joint call for moves, `effort` only (no sampling parameters are sent), the envelope and the effect check. Measure with Y19.
- **No ground truth.** Accuracy cannot be proven with the data we have. Measure what we can: spread, gap to the rules forecast, and whether the band narrows after an upload.
- **Cache and limiter are per process.** Production is one Docker process on the team server (`docs/ARCHITECTURE.md → Deployment`), so they are effectively global; a restart empties the cache. Behind Tailscale Funnel `x-forwarded-for` may be missing, which would put everyone in one `ip:unknown` bucket: the forecast limiter's per-IP limit is at least 5× the per-anon one, and the builder checks what Funnel sends.
- **Cost and latency** per profile change. Mitigation: debounce, cache, own rate limit, fallback.
- **Linear interpolation** between yearly anchors flattens debt-payoff kinks inside a year. Acceptable for the chart; not used for any rule.

## Left to the builder

- Prompt wording; model and effort for forecasting (`ANTHROPIC_FORECAST_MODEL`, default `ANTHROPIC_MODEL`; the `.env.example` default is a small model and a larger one may forecast better); timeouts.
- Exact rate-limit numbers for the forecast limiter.
- Debounce delay and the cache sizes, within the limits above.
