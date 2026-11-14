# AI Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude produces the 10-year forecast and the Next Moves' `effect10y` behind a new route, validated in code and labeled, with the rules-based `forecast()` as the fallback.

**Architecture:** `POST /api/ai/forecast` makes one structured-output call per profile (yearly anchors for the base profile and every candidate move), checks it in code against the rules forecast, interpolates it to the 121 monthly points, caches it, and falls back to `rulesBundle` on any failure. The client keeps the engine as a second fallback, ranks moves from the bundle, and derives today's dollars locally. Pure helpers live in `packages/engine`; the model call, cache and route live in `apps/web/src/server/ai`.

**Tech Stack:** TypeScript, Next.js route handlers, zod 4, `@anthropic-ai/sdk` 1.8 (`zodOutputFormat`), Vitest 5 (jsdom for hooks), pnpm workspaces. Production is one Docker process on the team server behind Tailscale Funnel (`docs/ARCHITECTURE.md → Deployment`), so the in-memory cache and rate limiter are per process, not per serverless instance.

**Spec:** `docs/superpowers/specs/2026-11-14-llm-forecast-design.md` (also `docs/ENGINEERING.md → AI forecast`). Issues: Y15–Y20.

## Global Constraints

- One branch and PR per task, stacked: Task N branches off Task N−1's branch (or off `main` once N−1 is merged). Never push to `main`. Commit messages start with the task ID (`Y15: …`).
- Commit messages, PR text and issue text carry no AI attribution lines (owner's rule; it overrides any harness default).
- `Money` is unrounded US dollars; rates are decimals per year; never percent numbers (CLAUDE.md rule 8).
- Contracts first (rule 3): a type, its zod schema, its fixtures and both consumers change in the same task.
- Files in `apps/web/src/features/*/ui/` import only `@/ui-kit/**`, `@/copy` and their `../model/types` (lint-enforced). All user-facing strings go in `apps/web/src/copy/*`.
- The model sees `forecastFacts(profile)` only: numbers, no names, no account numbers, no `zip`, no `committedMoveId`, no `doneMoveIds` (rule 6). Cache keys are built from the same payload.
- No sampling parameters are sent (the parse tests assert none): use `effort` only.
- Tests replace the Anthropic SDK module (pattern: `apps/web/app/api/ai/parse/route.test.ts`, helpers in `apps/web/src/server/ai/testUtils.ts`). CI and Playwright never call a live model.
- Prompts and responses are logged with `devLog` only (development).
- The app works with no `ANTHROPIC_API_KEY`.
- Heavy checks (`pnpm e2e`, full builds) run on the team server or in CI, not on a laptop. Unit tests run locally: `pnpm exec vitest run <path>`.
- No effort estimates in any doc or issue.

## Review Focus

1. **Wrong-unit or runaway model answers** (values in thousands, percent-style, ×10): the checks reject them, the model gets one retry with the issues, then the rules bundle is returned. Tests: Task 1 envelope tests, Task 2 retry and fallback tests.
2. **Moves that look fine but are wrong** (a scenario equal to base, a wrong-sign effect, an effect 5× too big): the per-scenario effect check rejects them, because the yearly envelope is too loose to see them. Tests: Task 1 `scenarioEffectIssues`, Task 2 retry.
3. **Negative net worth or a zero rules band** (debts exceed assets, or no `isEstimate` field): a sensible answer must still pass. Tests: Task 1, Task 2.
4. **Slider spam, a stale answer meeting new candidates** (the screen must never rank with a bundle that answered other candidates or patches) and **out-of-order responses**. Tests: Task 4.
5. **Everything unavailable or slow** (no key, provider error, refusal, hung call, 429, offline, invalid or incomplete body): the user still gets a labeled rules forecast within a bounded time, never a blank screen. Tests: Task 2 (server deadline), Task 4 (client timeout and fallbacks).
6. **Scenario ids**: the model omits, duplicates or renames an id; the committed move is not a ranked candidate. Tests: Task 2, Task 4.

## File Structure

| File | Responsibility |
|---|---|
| `packages/types/index.ts`, `schemas.ts` | `ForecastSource`, `YearAnchor`, `ForecastBundle` + zod |
| `packages/engine/anchors.ts` | pure helpers: check, expand, deflate, sanity-compare, effect-compare |
| `packages/engine/bundle.ts` | `rulesBundle`, `forecastFacts` |
| `packages/engine/moves.ts` | split `rankMoves` into `moveCandidates` + `rankCandidates` |
| `packages/engine/assumptions.ts` | `aiForecastSanity` guard constants (exported separately; not in the user-facing assumptions list) |
| `apps/web/src/server/ai/forecast.ts` | prompt, wire schema, model call with deadline, checks, retry, fallback |
| `apps/web/src/server/ai/forecastCache.ts` | key, LRU + TTL, in-flight dedup |
| `apps/web/src/server/ai/http.ts`, `client.ts`, `schemas.ts` | forecast limiter, `forecastModel()`, request schema |
| `apps/web/app/api/ai/forecast/route.ts` | the route |
| `apps/web/src/lib/api/aiForecast.ts` | client fetch, zod-validated |
| `apps/web/src/features/forecast/model/*` | `useForecastBundle`, async `useNextMoves` / `useFuture` / `useToday`, VM types |
| `apps/web/src/features/ladder/model/useQuickSliders.ts` | S5 keeps the rules preview, now labeled |
| `apps/web/src/copy/{forecast,ai,upload}.ts` | source, band, "How we calculate" and "What we keep" strings |
| `apps/web/src/server/ai/evalSummary.ts`, `apps/web/evals/forecast.eval.ts` | eval summary (unit-tested) and the live harness (not in CI) |

Order: Task 1 → Task 2 → Task 3; Task 4 needs Task 2's route shape (it can start with a mocked route); Task 5 needs Task 2; Task 6 needs Task 4.

---

### Task 1 (Y15): Contracts and pure engine helpers

**Files:**
- Modify: `packages/types/index.ts`, `packages/types/schemas.ts`, `packages/types/schemas.test.ts`
- Create: `packages/engine/anchors.ts`, `packages/engine/anchors.test.ts`, `packages/engine/bundle.ts`, `packages/engine/bundle.test.ts`
- Modify: `packages/engine/assumptions.ts`, `packages/engine/moves.ts` (`rankMoves`, from the `Candidate` type to the end), `packages/engine/moves.test.ts`, `packages/engine/index.ts` (exports, and its header comment: the engine stays pure; the AI forecast is checked here, not computed here)

**Interfaces:**
- Consumes: `Forecast`, `ForecastPoint`, `Profile`, `ProfilePatch`, `Move` (types); `forecast`, `applyPatch`, `simulate`, `ForecastRates` (engine).
- Produces (exact):
```ts
// packages/types
export type ForecastSource = 'ai' | 'rules';
export type YearAnchor = { year: number; low: Money; mid: Money; high: Money };
export type ForecastBundle = { source: ForecastSource; model?: string; base: Forecast; scenarios: Record<string, Forecast> };
// + YearAnchorSchema, ForecastSchema (points.length >= 121, in10y, todaysDollars), ForecastBundleSchema
// packages/engine/anchors.ts
export function anchorIssues(anchors: readonly YearAnchor[]): string[];                 // [] = structurally valid
export function anchorsToForecast(anchors: readonly YearAnchor[], todayNetWorth: Money): Forecast; // nominal, 121 points
export function deflateForecast(f: Forecast, inflationAnnual: Rate): Forecast;          // todaysDollars: true
export function forecastSanityIssues(candidate: Forecast, reference: Forecast, takeHomePay: Money,
  envelope?: AiForecastSanity): string[];
export function scenarioEffectIssues(candidate: { base: Forecast; scenario: Forecast },
  reference: { base: Forecast; scenario: Forecast }, envelope?: AiForecastSanity): string[];
// packages/engine/bundle.ts
export type ForecastFacts = Omit<Profile, 'zip' | 'committedMoveId' | 'doneMoveIds'>;
export function forecastFacts(p: Profile): ForecastFacts;   // what the model sees and what keys are built from
export function rulesBundle(p: Profile, scenarios: readonly { id: string; patch: ProfilePatch }[],
  rates?: Partial<ForecastRates>): ForecastBundle;   // source 'rules', nominal
// packages/engine/moves.ts
export type MoveCandidate = Omit<Move, 'effect10y'>;
export function moveCandidates(p: Profile, opts?: RankMovesOptions): MoveCandidate[];
export function rankCandidates(p: Profile, candidates: readonly MoveCandidate[], effectOf: (c: MoveCandidate) => Money): Move[];
// packages/engine/assumptions.ts
export type AiForecastSanity = { relative: number; floorMonths: number; bandMaxRatio: number;
  effectRatioMin: number; effectRatioMax: number; effectFloor: Money };
export const aiForecastSanity: Assumption<AiForecastSanity>;   // 0.5, 12, 3, 0.25, 4, 1_000; assumption: true
```

- [ ] **Step 1: Write the failing tests**
  - `anchors.test.ts`, `anchorsToForecast`: for anchors years 1–10 and `todayNetWorth = 10_000`, `points.length === 121`; `points[0]` equals `{ month: 0, mid: 10_000, low: 10_000, high: 10_000 }`; `points[12]` equals anchor year 1; `points[6].mid` is the midpoint of `points[0].mid` and `points[12].mid`; `in10y === points[120]`; `todaysDollars === false`; `low ≤ mid ≤ high` at every point.
  - `anchorIssues`: `[]` for a valid list; non-empty for 9 anchors, years out of order (1,3,2…), a `NaN`, and `low > mid`.
  - `deflateForecast`: point `m` equals the input divided by `(1 + i) ** (m / 12)`; `todaysDollars` is `true`; throws `RangeError` when given an already-deflated forecast.
  - `forecastSanityIssues` against the rules forecast of `profile.demo.json` (fixture helpers as in `forecast.test.ts`): `[]` when the candidate is the reference; non-empty when every mid is ×3, when every value is ÷1000, and when the band is 10× wider than the reference band; `[]` for a negative-net-worth profile whose candidate equals its reference; `[]` for a zero-band reference with a candidate band no wider than the tolerance.
  - `scenarioEffectIssues` with a rules effect of +$5,000 at month 120: `[]` for an AI effect of +$5,900 (inside the $1,000 floor) and +$7,500 (ratio 1.5); non-empty for an effect of $0 (scenario equal to base), −$5,000 (wrong sign), +$25,000 (5×) and +$1,000. With a rules effect under $1: `[]` for an AI effect of $500, non-empty for $5,000.
  - `bundle.test.ts`: `rulesBundle(demo, [{ id: 'a', patch }])` has `source: 'rules'`, `base` equal to `forecast(demo, 10, { rates })`, `scenarios.a` equal to `forecast(applyPatch(demo, patch), 10, { rates })`, and parses with `ForecastBundleSchema`. `forecastFacts(demo)` has no `zip`, `committedMoveId` or `doneMoveIds`, and two profiles that differ only in those fields give equal facts.
  - `moves.test.ts`, add: `rankCandidates(p, moveCandidates(p, o), rulesEffect)` equals `rankMoves(p, o)` for the demo profile (where `rulesEffect` is the forecast difference in today's dollars); a custom `effectOf` orders candidates by its values; effects below $1 are dropped; the committed move takes the third slot when ranked below the top 3. The existing `rankMoves` tests stay untouched.
  - `schemas.test.ts`: `ForecastBundleSchema` accepts a `rulesBundle` result and rejects a point with `NaN` and a bundle whose `source` is `'x'`.
- [ ] **Step 2: Run to verify failure:** `pnpm exec vitest run packages/engine packages/types`. Expected: the new tests FAIL (missing exports), existing tests pass.
- [ ] **Step 3: Implement the types and schemas** in `packages/types` as in Interfaces.
- [ ] **Step 4: Implement `aiForecastSanity`** in `assumptions.ts` (`assumption: true`, a `note` that says the values are guards, tunable on the fixtures; keep it out of the user-facing assumptions list).
- [ ] **Step 5: Implement `anchors.ts`.** `anchorIssues` returns human-readable strings (they go back to the model). `anchorsToForecast` assumes valid input and throws `RangeError` otherwise; it interpolates linearly per year and sets month 0 exactly. `forecastSanityIssues`: for each year `k` 1–10, `tol = max(relative × |ref.mid|, floorMonths × takeHomePay)`, issue if `cand.mid` is outside `[ref.low − tol, ref.high + tol]`, or `cand.high − cand.low > max(bandMaxRatio × (ref.high − ref.low), tol)`; name the year and the bound in each message. `scenarioEffectIssues` compares `scenario.in10y.mid − base.in10y.mid` (nominal) of candidate and reference: accept when `|ai − rules| ≤ effectFloor`; otherwise an issue when `|rules| < 1`, when the signs differ, or when `ai / rules` is outside `[effectRatioMin, effectRatioMax]`.
- [ ] **Step 6: Implement `bundle.ts`** with the engine's `forecast` and `applyPatch`, nominal dollars (`todaysDollars: false`), and `forecastFacts` as a plain object copy without the three fields.
- [ ] **Step 7: Refactor `rankMoves` in `moves.ts`.** Export `MoveCandidate` (the former local `Candidate`). `moveCandidates` is the existing candidate selection (the `pick` / `cancel` logic) and returns the picked list. `rankCandidates` is the existing measure, filter, sort and committed-slot logic with `effectOf` injected. `rankMoves` becomes `rankCandidates(p, moveCandidates(p, opts), rulesEffect)` where `rulesEffect` computes the base forecast lazily once, so a profile with no candidates still runs no forecast. Export from `index.ts`.
- [ ] **Step 8: Run to verify pass:** `pnpm exec vitest run packages/engine packages/types && pnpm typecheck`. Expected: all pass, including the untouched `moves.test.ts` cases and the forecast golden snapshot.
- [ ] **Step 9: Commit:** `git add packages && git commit -m "Y15: forecast bundle contract, anchor helpers, rules bundle, split rankMoves"`.

---

### Task 2 (Y16): `POST /api/ai/forecast`

**Files:**
- Modify: `apps/web/src/server/ai/schemas.ts`, `apps/web/src/server/ai/client.ts`, `apps/web/src/server/ai/http.ts`, `.env.example`
- Create: `apps/web/src/server/ai/forecast.ts`, `apps/web/src/server/ai/forecast.test.ts`, `apps/web/app/api/ai/forecast/route.ts`, `apps/web/app/api/ai/forecast/route.test.ts`

**Interfaces:**
- Consumes: Task 1 (`anchorIssues`, `anchorsToForecast`, `forecastSanityIssues`, `scenarioEffectIssues`, `rulesBundle`, `forecastFacts`, `aiForecastSanity`), `simulate(profile, 0).path[0].netWorth` for month 0, `getLlmClient`, `responseText`, `devLog`, `readJsonBody`, `json`.
- Produces (exact):
```ts
// schemas.ts
export const MAX_FORECAST_BODY_BYTES = 32 * 1024;
export const ForecastRequestSchema: z.ZodType<{          // output type; `scenarios` is optional in the input and defaults to []
  profile: Profile; rates?: { inflationAnnual: Rate }; scenarios: { id: string; patch: ProfilePatch }[]; // ≤ 8, unique ids
}>;
export type ForecastRequest = z.infer<typeof ForecastRequestSchema>;
// client.ts
export function forecastModel(): string;   // ANTHROPIC_FORECAST_MODEL || llmModel()
// http.ts
export const FORECAST_RATE_LIMITS: { perAnonId: RateLimitRule; perIp: RateLimitRule };
export function checkForecastRateLimit(req: Request): Response | null;   // own limiter, 429 + Retry-After
// forecast.ts
export const PROMPT_VERSION: number;
export const FORECAST_CALL_TIMEOUT_MS: number;   // starting values: 12_000 per call
export const FORECAST_DEADLINE_MS: number;       // 20_000 for the whole request, retry included
export function forecastPrompt(req: ForecastRequest): { system: string; content: string };
export function forecastWithModel(req: ForecastRequest, client: LlmClient | null): Promise<ForecastBundle>; // never throws; source 'ai' | 'rules'
// route: POST → 200 ForecastBundle JSON, Cache-Control: no-store; 400/413/429 as the other /api/ai routes
```

- [ ] **Step 1: Write the failing tests** (SDK mocked as in the parse route test; each model answer is built from the rules forecast of the demo profile so it passes the checks).
  - `forecast.test.ts`: no client → `source: 'rules'` and equals `rulesBundle`; valid answer → `source: 'ai'`, `base.points.length === 121`, `base.points[0].mid` equals today's net worth, `todaysDollars === false`, `model` set, every scenario id present; first answer with every value ÷1000 → second call made, its prompt contains the issue text, result `'ai'`; an answer whose scenario equals base (effect 0) → retried; two bad answers → `'rules'`; provider throws → `'rules'`; `stop_reason: 'refusal'` → `'rules'`; `'max_tokens'` → retried; answer missing a scenario id → retried; duplicate scenario id → retried; a negative-net-worth profile with an in-envelope answer → `'ai'`.
  - Deadline (fake timers): a `create` that never resolves → `'rules'` once `FORECAST_DEADLINE_MS` has passed; no second attempt starts when less than 8 s remain; `create` is called with `maxRetries: 0`, a `timeout` and an `AbortSignal` in its request options.
  - `forecastPrompt`: the content contains the facts numbers and `isEstimate` flags and the scenario ids and patches; contains none of `zip`, `committedMoveId`, `doneMoveIds`; the system text asks for nominal dollars, years 1–10 only, `low ≤ mid ≤ high`, no advice, JSON only. No `temperature` or other sampling parameter in the `create` call.
  - `route.test.ts`: 400 on a body that fails the schema and on duplicate scenario ids; a body without `scenarios` is accepted; 413 over `MAX_FORECAST_BODY_BYTES`; 429 with `Retry-After` after the limit, without touching the parse/explain limiter; 200 with `cache-control: no-store`; with no key the body has `source: 'rules'`.
- [ ] **Step 2: Run to verify failure:** `pnpm exec vitest run apps/web/src/server/ai apps/web/app/api/ai/forecast`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement `ForecastRequestSchema`** (`ProfileSchema`, `ProfilePatchSchema` from `@lifeguessr/types`; `.default([])`; `refine` for unique ids), `forecastModel`, and the limiter. Refactor `checkAiRateLimit` into a shared helper taking the limiter and its limits. The forecast limits are higher than parse/explain's, and the per-IP limit is at least 5× the per-anon one: behind Tailscale Funnel `x-forwarded-for` may be missing, which puts everyone in the `ip:unknown` bucket (check what Funnel sends before relying on per-IP).
- [ ] **Step 4: Implement `forecast.ts`.** Wire schema `{ forecasts: { id: string; anchors: { year: int; low; mid; high }[] }[] }`, passed through `zodOutputFormat`. The model is asked for ids `'base'` plus each scenario id. The prompt carries `forecastFacts(profile)` (with `isEstimate`), the scenario patches, area inflation from `rates` and the defaults from `assumptions.ts`, and says which inputs are estimates and that the band is uncertainty from those. Per forecast: `anchorIssues`, then month-0 expansion with `anchorsToForecast`, then `forecastSanityIssues` against `forecast(applyPatch(profile, patch), 10, { rates })` (nominal), and per scenario `scenarioEffectIssues` against the rules pair. Missing and duplicate ids are issues. Each call gets `{ timeout, maxRetries: 0, signal }`; the second attempt runs only if at least 8 s remain before `FORECAST_DEADLINE_MS`, with the remaining time as its timeout; `max_tokens` large enough for 9 forecasts of 10 anchors; then `rulesBundle`.
- [ ] **Step 5: Implement the route** like `explain/route.ts`: rate limit, `readJsonBody`, `json(await forecastWithModel(body.data, getLlmClient()))`; add `ANTHROPIC_FORECAST_MODEL=` (blank = use `ANTHROPIC_MODEL`) to `.env.example`.
- [ ] **Step 6: Run to verify pass:** `pnpm exec vitest run apps/web && pnpm typecheck && pnpm lint`. Expected: pass.
- [ ] **Step 7: Commit:** `git add apps/web .env.example && git commit -m "Y16: /api/ai/forecast with checks, retry and rules fallback"`.

---

### Task 3 (Y17): Server cache and in-flight dedup

**Files:**
- Create: `apps/web/src/server/ai/forecastCache.ts`, `apps/web/src/server/ai/forecastCache.test.ts`
- Modify: `apps/web/app/api/ai/forecast/route.ts`, `apps/web/app/api/ai/forecast/route.test.ts`

**Interfaces:**
- Consumes: `ForecastRequest`, `PROMPT_VERSION`, `forecastModel`, `forecastWithModel`, `forecastFacts`.
- Produces (exact):
```ts
export function forecastKey(req: ForecastRequest, model: string): string;   // sha256 hex of canonical JSON of { facts: forecastFacts(profile), scenarios, rates } + model + PROMPT_VERSION
export type ForecastCache = { getOrCompute(key: string, compute: () => Promise<ForecastBundle>): Promise<ForecastBundle>; clear(): void };
export function createForecastCache(opts?: { max?: number; ttlMs?: number; now?: () => number }): ForecastCache; // defaults 500, 3_600_000
export const forecastCache: ForecastCache;   // used by the route; one per process
```

- [ ] **Step 1: Write the failing tests.** Same request with keys in a different order → same key; changing one spending value, the model id or `PROMPT_VERSION` → different key; two profiles differing only in `committedMoveId`, `doneMoveIds` or `zip` → same key; two concurrent identical calls run `compute` once; a `source: 'rules'` result is not stored (the next call computes again); an `'ai'` result is returned from cache until `ttlMs` passes (fake `now`); the least recently used entry is evicted beyond `max`. Route: the same body twice makes one model call; a body that fell back to rules makes a model call each time.
- [ ] **Step 2: Run to verify failure:** `pnpm exec vitest run apps/web/src/server/ai/forecastCache.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `forecastCache.ts`** (`Map` for LRU order, a second `Map` for in-flight promises, `node:crypto` for the hash, a canonical stringify that sorts object keys). Wire it into the route.
- [ ] **Step 4: Run to verify pass:** `pnpm exec vitest run apps/web && pnpm typecheck`. Expected: pass. Clear the cache in route tests' `beforeEach`.
- [ ] **Step 5: Commit:** `git add apps/web && git commit -m "Y17: forecast cache with in-flight dedup"`.

---

### Task 4 (Y18): Client fetch, async view-models, source labels

**Files:**
- Create: `apps/web/src/lib/api/aiForecast.ts`, `apps/web/src/features/forecast/model/useForecastBundle.ts`, `apps/web/src/features/forecast/model/useForecastBundle.test.ts`, `apps/web/src/test/forecastApi.ts`
- Modify: `apps/web/src/features/forecast/model/{useNextMoves,useFuture,useToday,types}.ts`, `apps/web/src/features/forecast/model/forecast.test.ts`, `apps/web/src/features/ladder/model/useQuickSliders.ts` (+ its types and test), `apps/web/src/test/clientState.ts`, `apps/web/src/copy/forecast.ts`, `apps/web/src/copy/upload.ts`

**Interfaces:**
- Consumes: `ForecastBundleSchema`, `ForecastBundle`, `rulesBundle`, `forecastFacts`, `deflateForecast`, `moveCandidates`, `rankCandidates`, `MoveCandidate` (Task 1); `postJson` (`lib/api/http.ts`; it rethrows `AbortError` unchanged); the anon id as `parseText` callers pass it; `areaRates`, `runEngine`, `toVMError`, `useAppReady`.
- Produces (exact):
```ts
// lib/api/aiForecast.ts
export type ScenarioPatch = { id: string; patch: ProfilePatch };
export function fetchForecastBundle(profile: Profile, scenarios: readonly ScenarioPatch[],
  opts?: { rates?: { inflationAnnual: Rate }; anonId?: string; signal?: AbortSignal }): Promise<ForecastBundle>;
// features/forecast/model/types.ts
export type ForecastAnswer = { bundle: ForecastBundle; profile: Profile; candidates: MoveCandidate[] }; // what the bundle answered
export type ForecastState =
  | { status: 'loading' }
  | { status: 'ready'; source: ForecastSource; answer: ForecastAnswer; isRefreshing: boolean }
  | { status: 'error'; error: VMError };
// useForecastBundle.ts
export const FORECAST_DEBOUNCE_MS = 600;           // starting values
export const FORECAST_CLIENT_TIMEOUT_MS = 25_000;  // > the server deadline (20_000)
export function useForecastBundle(profile: Profile, candidates: readonly MoveCandidate[],
  preview?: Pick<Move, 'id' | 'patch'>): ForecastState;   // preview is sent as scenario id `committed:<id>`
export function resetForecastMemory(): void;       // clears the per-session answer cache; called by resetClientState()
// types.ts: NextMovesVM gains `forecast: ForecastState`; FutureVM and TodayVM gain `source: ForecastSource | null`;
//   FutureVM gains `isRefreshing: boolean` and `band.kind: 'inputs' | 'model'`;
//   TodayVM.status becomes 'loading' | 'ready' | 'error' and gains `error: VMError | null`
// test/forecastApi.ts
export function mockForecastRoute(handler?: (body: unknown) => ForecastBundle | Response): { calls: unknown[] };
//   stubs global fetch for /api/ai/forecast; the default handler answers with rulesBundle
```

- [ ] **Step 1: Write the failing tests** (jsdom; `mockForecastRoute`; fake timers advanced with `vi.advanceTimersByTimeAsync`, not RTL's `waitFor`).
  - `useForecastBundle.test.ts`: an `'ai'` bundle is returned with `source: 'ai'`; fetch rejecting → `source: 'rules'` and the bundle equals the local `rulesBundle`; a 429 → `'rules'`; an invalid body → `'rules'`; a valid body that lacks a requested scenario id → `'rules'`; no answer after `FORECAST_CLIENT_TIMEOUT_MS` → `'rules'`; an aborted superseded request does not switch to `'rules'`; a request error where the local engine also throws → `status: 'error'`; no request is sent before `useAppReady()`.
  - First request and a session-memory hit are not debounced; a profile change after an answer waits `FORECAST_DEBOUNCE_MS`. Stale guard: change the profile twice within the window, then twice more; make the first request resolve last; the state holds the newest profile's answer (assert on a field that differs) and only the newest request is sent. While refreshing, `isRefreshing` is `true` and `answer` is still the previous one.
  - Same profile re-rendered or remounted → `calls.length` stays 1. A change only to `committedMoveId`, `doneMoveIds` or `zip` sends no request (keys come from `forecastFacts`).
  - `forecast.test.ts` (existing file): call `mockForecastRoute()` in `beforeEach`. Keep the `in10y`, `points` and `yearly` assertions as they are (they hold because the default route answer is the rules bundle). Rewrite the post-`act` assertions of the commit / markDone test and of the `cancelSubscriptions` test to `await waitFor(...)` (the state they check now arrives asynchronously). Add: toggling `setTodaysDollars` makes no new request; with an `'ai'` bundle whose scenarios give a different order than the rules, `moves` follows the bundle; after `applyStatementTotals` (new candidate `cancelSubscriptions`, changed patches) the screen never ranks with the previous bundle's scenarios (no `undefined` effects, no throw) and shows the previous ranking with `isRefreshing: true` until the new answer; a move in `doneMoveIds` is dropped from the shown ranking immediately; `committedPreview.in10y` comes from scenario `committed:<id>` using the stored `committedMove.patch`; `source` is `'ai'` or `'rules'` as answered; `TodayVM` has `error` and `status: 'error'` when the engine throws; `band.isZero` is `false` for an `'ai'` bundle with a non-zero band and follows `!hasEstimates(profile)` for `'rules'`; `useAfford` and `useLoanLab` tests pass unchanged.
  - `useQuickSliders` test: S5 still shows the rules preview and now reports `in10ySource: 'rules'`.
- [ ] **Step 2: Run to verify failure:** `pnpm exec vitest run apps/web/src/features`. Expected: new tests FAIL, the rest pass.
- [ ] **Step 3: Implement `fetchForecastBundle`** with `postJson('/api/ai/forecast', { profile, rates, scenarios }, ForecastBundleSchema, …)`.
- [ ] **Step 4: Implement `useForecastBundle`.** The effect depends on a memoized canonical key of (`forecastFacts(profile)`, scenarios, rates), not on the arrays. Debounce as in the tests; abort the previous request; ignore a response unless it belongs to the latest request (a counter); a module-level `Map` (capped at 20 entries, FIFO) from that key to the answer, cleared by `resetForecastMemory`; validate that the bundle covers `base` and every requested id, otherwise treat it as invalid; on any `ApiError`, network error, timeout or invalid body, use `runEngine(() => rulesBundle(profile, scenarios, areaRates(profile)))`. An `AbortError` from a superseded request is ignored. Store the `(profile, candidates)` pair that each bundle answered in `answer`.
- [ ] **Step 5: Rewire `useNextMoves`.** Candidates = `moveCandidates(profile, { rates, subscriptionsDetected })`; pass the stored `committedMove` as `preview`. Rank from the answered pair so ids and patches always match the bundle: `rankCandidates({ ...answer.profile, committedMoveId: profile.committedMoveId, doneMoveIds: profile.doneMoveIds }, answer.candidates.filter((c) => !profile.doneMoveIds.includes(c.id)), effectOf)` with `effectOf(c) = deflated(bundle.scenarios[c.id]).in10y.mid − deflated(bundle.base).in10y.mid`, `deflated` = `deflateForecast(f, areaRates(profile).inflationAnnual)`. `moves.status` follows `forecast.status`. Return `forecast` in the VM.
- [ ] **Step 6: Rewire `useFuture` and `useToday`** to read `nextMoves.forecast` instead of `displayForecast`. Today's dollars comes from `deflateForecast` when on, nominal otherwise; `points`, `yearly`, `today`, `in10y`, `committedPreview` (from `scenarios['committed:<id>']`) derive from it. `band.kind` is `'model'` for `'ai'` and `'inputs'` for `'rules'`; `band.isZero` is `!hasEstimates(profile)` for `'rules'` and `in10y.high − in10y.low < 1` for `'ai'`. Until the first bundle arrives, `useToday` and `useFuture` report `status: 'loading'` with a zero point for `in10y`; the `'error'` state fills `error` (add `error` to `TodayVM`).
- [ ] **Step 7: Keep S5 on the rules preview.** `useQuickSliders` keeps `displayForecast` (a drag needs instant feedback) and exposes `in10ySource: 'rules'`.
- [ ] **Step 8: Add copy** in `copy/forecast.ts`: source labels (`'AI estimate'`, `'Rules-based estimate'`, `'Rules-based preview'` for S5), one band note per `band.kind` (the model's own uncertainty; uncertainty from the numbers we estimated), and a "How we calculate" note that says the forecast is model-generated and code-checked; in `copy/upload.ts`: the "What we keep" line that the profile's numbers (no names or account numbers) go to the model provider, which does not train on API data (zero data retention is not enabled, so the copy must not claim it). Add `resetForecastMemory()` to `resetClientState` in `test/clientState.ts`.
- [ ] **Step 9: Run to verify pass:** `pnpm exec vitest run apps/web && pnpm typecheck && pnpm lint`. Expected: pass. Run `pnpm e2e` on the team server or in CI (no key set, so the demo path shows the rules fallback).
- [ ] **Step 10: Commit:** `git add apps/web && git commit -m "Y18: async forecast view-models with AI source and rules fallback"`.

---

### Task 5 (Y19): Eval script, outside CI

**Files:**
- Create: `apps/web/src/server/ai/evalSummary.ts`, `apps/web/src/server/ai/evalSummary.test.ts`, `apps/web/evals/forecast.eval.ts`, `apps/web/vitest.eval.config.ts`
- Modify: root `package.json` (script `eval:forecast`), `README.md` (status row to Done once Tasks 1–6 are merged)

**Interfaces:**
- Consumes: `forecastWithModel` and the fixture profiles (`profile.demo.json`, and the demo profile with every `isEstimate` set to `false`).
- Produces (exact):
```ts
export type EvalRun = { in10yMid: Money; in10yLow: Money; in10yHigh: Money; source: ForecastSource };
export type EvalSummary = { runs: number; aiRuns: number; meanMid: Money; spread: number /* stdev / |mean| of in10y mid */;
  gapToRules: number /* (meanMid − rulesMid) / |rulesMid| */; meanBandWidth: Money };
export function summarizeRuns(runs: readonly EvalRun[], rulesMid: Money): EvalSummary;   // only source 'ai' runs counted
```

- [ ] **Step 1: Write the failing test** for `summarizeRuns`: three runs with mids 100, 110, 90 and `rulesMid` 100 → `meanMid` 100, `spread` ≈ 0.0816 (population stdev ÷ mean), `gapToRules` 0, `meanBandWidth` the mean of `high − low`; a `source: 'rules'` run is excluded from `aiRuns`; zero AI runs → `spread` and `gapToRules` are `NaN` and `aiRuns` is 0.
- [ ] **Step 2: Run to verify failure:** `pnpm exec vitest run apps/web/src/server/ai/evalSummary.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `summarizeRuns`.**
- [ ] **Step 4: Write `forecast.eval.ts`.** Needs `ANTHROPIC_API_KEY`; skips with a printed reason when it is unset. For each fixture profile it calls `forecastWithModel` N times (N from `EVAL_RUNS`, default 5) bypassing the cache, prints one `EvalSummary` per profile, and prints whether the AI band for the measured profile is narrower than for the estimated one. `vitest.eval.config.ts` sets `root` to `apps/web`, includes only `evals/**/*.eval.ts`, uses the same `@` alias as `vitest.config.ts` and a long `testTimeout` for live calls. Root script: `"eval:forecast": "vitest run --config apps/web/vitest.eval.config.ts"`. The default `pnpm test` does not pick it up.
- [ ] **Step 5: Run to verify pass:** `pnpm exec vitest run apps/web/src/server/ai/evalSummary.test.ts` and `pnpm test` (the eval file is not in it); `pnpm eval:forecast` with no key prints the skip reason and exits 0. The live run costs API calls; run it once by hand on the team server and record the report in the PR description.
- [ ] **Step 6: Commit:** `git add apps/web package.json README.md && git commit -m "Y19: forecast eval harness"`.

---

### Task 6 (Y20): Explanations say where a number came from

**Files:**
- Modify: `apps/web/src/server/ai/schemas.ts` (`MoveInputSchema`), `apps/web/src/server/ai/explain.ts`, `apps/web/src/copy/ai.ts`, the client wrapper for `/api/ai/explain` in `apps/web/src/lib/api/` and its callers (find them with `grep -rn "api/ai/explain" apps/web/src`), `apps/web/src/server/ai/explain` tests and `apps/web/app/api/ai/explain/route.test.ts`

**Interfaces:**
- Consumes: `ForecastSource`, Task 4's `source` in the view-models.
- Produces (exact): `MoveInputSchema` gains `source: z.enum(['ai', 'rules']).optional()`; `copy.explain.move(kind, category, effect10y, positive, source?: ForecastSource)`; a request without `source` behaves exactly as before.

- [ ] **Step 1: Write the failing tests.** `templateExplanation` for a move with `source: 'ai'` says "Our AI estimate" (no "In our simulation"); with `'rules'` or no `source` it keeps the current sentence; the model prompt for `'ai'` facts says the number is an AI estimate; a body without `source` is accepted; the numbers guard still rejects numbers that are not in the facts.
- [ ] **Step 2: Run to verify failure:** `pnpm exec vitest run apps/web/src/server/ai apps/web/app/api/ai/explain`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** the schema field, the wording by source in `copy/ai.ts` and in the explain facts and system prompt (`explain.ts`), and pass `source` from the view-model that calls explain.
- [ ] **Step 4: Run to verify pass:** `pnpm exec vitest run apps/web && pnpm typecheck && pnpm lint`. Expected: pass.
- [ ] **Step 5: Commit:** `git add apps/web && git commit -m "Y20: explanations name the forecast source"`.
