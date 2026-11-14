# ARCHITECTURE.md

## Principle

Build all logic and data behind fixed contracts first, with placeholder screens, so the Figma design can be dropped in screen by screen without touching logic.

## Layers (top changes for design; bottom never does)

| Layer | Path | Responsibility | Changes when Figma arrives? |
| --- | --- | --- | --- |
| UI | `apps/web/src/features/*/ui` | Presentational components: props in, events out. No math, no fetching, no business state. | **Rewritten** |
| UI kit | `apps/web/src/ui-kit` | Button, Card, Slider, Stat, Gauge, Tabs, Sheet, `<ForecastChart>`, `<BarBreakdown>`, `<HouseScene>`. Styled only via tokens; scene art comes from the sprite kit. | **Restyled** |
| View-models | `apps/web/src/features/*/model` | One hook per screen returning plain data + action callbacks. Calls engine and APIs. | No (may gain fields) |
| Core | `packages/engine`, `packages/data`, `apps/web/app/api` | Pure math, cached public data, server routes (AI, sessions, leaderboard, categorize). | No |

**Import rule (lint-enforced via `no-restricted-imports`):** `features/*/ui/**` may import only `@/ui-kit/**`, `@/copy`, and `../model/types`. Nothing else.

## Default stack

- Next.js (App Router) + TypeScript, deployed with Docker on the team's own server (see Deployment below); pnpm workspaces monorepo.
- Tailwind reading CSS variables from `tokens.css`, which is generated from `tokens.json` (Figma variables export).
- Zustand (or React context) for client state; local storage holds the anonymous ID and a profile cache.
- Vitest (engine) and Playwright (one end-to-end demo path).
- A self-hosted Postgres store on the team's own server for sessions, Pro entitlements, leaderboard and events (T4; `STORE_URL`, `pg` driver, server code in `apps/web/src/server/store/`).
- One server-side LLM client: Anthropic Claude (`ANTHROPIC_API_KEY`, model in `ANTHROPIC_MODEL`); responses validated with zod. It also produces the 10-year forecast for the demo (`/api/ai/forecast`, optional `ANTHROPIC_FORECAST_MODEL`); the rules engine is the fallback.
- Charts: one wrapper component (e.g. Recharts or visx) behind `<ForecastChart>` so restyling stays local.

## Deployment

Production runs on the team's own server, not on Vercel. The files are in `deploy/` (runbook: `deploy/README.md`). It is live: a push to `main` that passes CI is deployed automatically.

- **Public URL:** the Tailscale Funnel host that PawCoach used. PawCoach has been removed from the server, and LifeGuessr takes over the host's root `/`, so it needs no sub-path and no Next.js `basePath`. Funnel terminates HTTPS on the host (port 443) and proxies to the app on loopback port 3000. Other apps on that host keep their own routes (for example `/ember`) and must not be touched.
- **Runtime:** a Docker image (`deploy/Dockerfile`, Next.js standalone build) and `deploy/compose.yaml`, with an `.env` beside it on the server, never in the repo. The app port is published on `127.0.0.1` only, so Funnel is the only way in from outside.
- **Store:** a `postgres` service (`postgres:17-alpine`) in the same compose project, with no published port (the compose network only), its data in the named volume `pgdata`, a healthcheck and a 512 MB cap. The app starts after it is healthy and gets `STORE_URL` from compose, built from `STORE_PASSWORD` in the server's `.env` (required: compose and `remote.sh` stop the deploy when it is missing). The app runs its schema migrations itself on first use (see Store below).
- **CI/CD:** CI (lint, typecheck, test with a Postgres service, build, Playwright e2e against a real store, and a dry run of `deploy/deploy.sh` with the whole compose stack on the CI runner) runs on GitHub-hosted runners for every PR and push. `.github/workflows/deploy.yml` then deploys `main` by running `deploy/deploy.sh` on a self-hosted runner on the server: build there, make sure `postgres` is healthy, back it up (`pg_dump`, newest 14 kept), recreate only the app container, check `/api/health` (container liveness, then `store.status: "ok"` from the new image), automatic rollback to the previous image when either fails. A deploy never recreates the database volume. Rules for that runner are in `deploy/README.md`.
- **Server notes:** the runner has its own user on the server and keeps the app's `.env` in that user's home. Its clock must be right (`deploy/README.md`). The server address and Funnel hostname stay out of this repo, which becomes public; they live in the team's private notes.
- **No PR previews:** without Vercel there are no per-PR preview deploys.

## Folder structure (owner in brackets)

```
lifeguessr/
  packages/
    types/            shared contracts                          [both]
    engine/           pure TS + Vitest                          [Amir; loan/, month.ts, scene.ts = Aibek]
      cost.ts score.ts scene.ts forecast.ts moves.ts afford.ts month.ts loan/ assumptions.ts
    data/             fetch scripts, normalized JSON, cards     [Aibek]
      fixtures/       canonical fixtures (engine tests + web)   [both]
  apps/web/
    app/              routes (S2/S3 are states of /play; S4 in the slider build)  [Amir]
    app/api/
      daily/ daily/clue/ daily/guess/ leaderboard/ share/       [Aibek]
      events/ session/ statement/                               [Aibek]
      ai/parse/ ai/explain/                                     [Amir]
    src/ui-kit/       primitives + tokens.css                   [Amir; HouseScene/ = Aibek]
    public/scene/     sprite kit (SVG layouts + props, from Figma)  [Kiko]
    src/features/
      game/ ladder/ forecast/ afford/ loan/                     [Amir]   (model/ + ui/)
      upload/ mocks/                                            [Aibek]
    src/fixtures/     re-exports packages/data/fixtures         [both]
    src/copy.ts       all user-facing strings                   [Amir]
  tokens.json       Figma variables export                      [Kiko exports; Amir runs pnpm tokens]
  docs/
```

## Screens

| ID | Screen | Route | Feature folder | Build |
| --- | --- | --- | --- | --- |
| S1 | Today (first visit: Play / Try with sample data, no numbers; then month-end card, You in N years (the year picked on S10), play) | `/` | forecast | Real (drift flags need ≥ 3 uploaded months; before that the card shows the projection only) |
| S2 | Game: the duel "Which life costs more?" (two composite lives, pick the costlier, optional hint). Also at `/duel`. Rollback: the slider game (explore the home, tap rooms for clues, guess) with `NEXT_PUBLIC_GAME_MODE=slider` | `/play` | game | Real (engine `costOfLife` + `dailyDuelPairs` + `scoreDuelPick`), computed in the browser until the duel routes land (#115; `NEXT_PUBLIC_DUEL_SOURCE`, switch-over #120) |
| S3 | Duel reveal (both monthly totals by category, what decided it, sources) and day result (share, challenge link, bridge to S5); the slider's reveal and summary with `NEXT_PUBLIC_GAME_MODE=slider` | `/play` (state) | game | Real, browser source as S2 |
| S4 | Streamer mode (slider game only: not linked while `/play` is the duel) | `/play?stream=1` with `NEXT_PUBLIC_GAME_MODE=slider` | game | Real (slider build only) |
| S5 | Guess yourself | `/me/guess` | ladder | Real |
| S6 | Closest life | `/me/closest` | ladder | Real |
| S7 | Quick sliders | `/me/sliders` | ladder | Real |
| S8 | Balance sheet | `/me/balance` | ladder | Real |
| S9 | Statement upload + "What we keep" + "Try with sample statement" | `/me/upload` | upload (logic) + ladder (ui) | Real (bank connect: not shown until built) |
| S10 | You in N years + Next Moves (a picker: 1, 3, 5 or 10 years, default 10; the headline, range, chart and the moves' gains and ranking read that year; S1's forecast card and the S14 check-in follow it) | `/future` | forecast | Real |
| S11 | Can I Afford It? | `/afford` | afford | Real |
| S12 | Loan Lab | `/loan` | loan | Real |
| S13 | Decision (car example) | `/decide` | mocks | Mock |
| S14 | Monthly check-in | `/checkin` | mocks | Mock |
| S15 | Paywall | `/pro` | pro | Simulated checkout (nothing charged; Stripe test mode instead when a key is set) + promo code, no real money |
| S21 | Subscription audit | `/tools/subscriptions` | subscriptions | Guess, tick-list, reveal, statement, findings, cancel plan; cold-first, findings stay in the browser; hidden in streamer mode (no tools hub: its own entry in `lib/screens.ts`) |

## Contracts (`packages/types/index.ts`, draft)

Units: `Money` is unrounded US dollars, and each field says whether it is **monthly** or a **balance**. `Rate` is a decimal per year (`0.228` = 22.8%). The engine returns no user-facing strings; the UI maps ids and kinds to `copy.ts`.

```ts
export type Money = number;   // US dollars, unrounded; monthly vs balance is stated per field
export type Rate = number;    // decimal per year: 0.228 = 22.8%
export type Source = { name: string; year: number; url?: string };
export type Sourced<T> = { value: T; source: Source; isEstimate?: boolean };

export type CostCategory =
  | 'rentUtilities' | 'car' | 'childcare' | 'groceries'
  | 'eatingOut' | 'subscriptions' | 'debtPayments' | 'other';
// In a Profile: `car` = running costs only (insurance, fuel, upkeep); loan payments live in `debts`.
// `debtPayments` is informational (measured from a statement); forecast() takes payments from `debts`, never from here.

export type KidAge = 'infant' | 'toddler' | 'preschool' | 'schoolAge';

export type AreaData = {
  zip: string; metro: string; county: string; state: string;
  tier: 'cheap' | 'mid' | 'expensive' | 'suburb';     // chosen when the ZIPs are picked (DATA.md)
  rentByBedrooms: Record<0|1|2|3|4, Sourced<Money>>;   // monthly GROSS rent (rent + utilities), HUD FMR/SAFMR
  rentRangeRatio?: { low: number; high: number; source: Source }; // ZCTA gross-rent Q1/median and Q3/median
  childcareMonthly?: Record<KidAge, Money> & { source: Source };  // monthly, per child, county
  groceriesPerAdult: Sourced<Money>;                    // monthly
  gasPerGallon: Sourced<Money>;
  carInsuranceMonthly: Sourced<Money>;                  // state average; isEstimate until a source is verified
  cpiYoY: Sourced<Rate>;
};

// Server-side only: holds the answer. The browser never gets a full LifeCard during play.
export type LifeCard = {
  id: string; zip: string; metro: string;
  adults: 1|2; kids: KidAge[]; bedrooms: 0|1|2|3|4;
  car?: { price: Money; downPayment: Money; apr: Rate; termMonths: number };
  eatingOutPerWeek: number; caption: string; pack?: string;
};
export type CostBreakdown = {
  total: { low: Money; mid: Money; high: Money };       // monthly; always low ≤ mid ≤ high
  items: { category: CostCategory; amount: Money; source: Source; isEstimate: boolean }[];
};
export type GuessResult = { points: number; basePoints: number; multiplier: number;
  inRange: boolean; logError: number };               // logError = 0 when in range

// Game scene. Every clue prop is derived from one LifeCard field and maps to one cost line.
export type ClueId = 'garage' | 'kidsRoom' | 'kitchen' | 'entry' | 'mailbox';
export type SceneLayout = 'studio' | '1bed' | '2bed' | '3bed' | '4bed';   // from bedrooms 0–4
export type SceneProp = { sprite: string; room: string; clue?: ClueId };  // no clue = decor, never implies a cost
export type PublicCard = { id: string; metro: string; layout: SceneLayout;  // what the browser gets before guessing
  caption: string; decor: SceneProp[] };
export type ClueReveal = { cardId: string; clue: ClueId; props: SceneProp[];
  facts: Partial<Pick<LifeCard, 'car' | 'kids' | 'eatingOutPerWeek' | 'adults' | 'zip'>> & { tier?: AreaData['tier'] } };
export type GuessReveal = { resultId: string; cost: CostBreakdown; result: GuessResult;
  card: LifeCard; cluesOpened: ClueId[] };

export type Estimate<T> = { value: T; isEstimate: boolean };
export type Debt = { id: string; kind: 'card'|'auto'|'student'|'personal'|'bnpl'|'mortgage';
  balance: Money; apr: Rate;
  minPayment: Estimate<Money>;   // monthly; defaulted from assumptions when the user skips it
  extraPayment?: Money };        // monthly, set by moves
export type Profile = {
  age: Estimate<number>;
  takeHomePay: Estimate<Money>;  // monthly, after tax and payroll retirement contributions
  spending: Record<CostCategory, Estimate<Money>>;      // monthly
  cash: Estimate<Money>; retirement: Estimate<Money>;   // balances
  retirementShare: Estimate<Rate>; // share of a positive monthly surplus saved to retirement
  debts: Debt[]; zip?: string;
  committedMoveId?: string; doneMoveIds: string[];
};
export type ProfilePatch = {
  spending?: Partial<Record<CostCategory, Money>>;
  debts?: { id: string; extraPayment?: Money; apr?: Rate }[];
  retirementShare?: Rate;
};

export type ForecastPoint = { month: number; mid: Money; low: Money; high: Money }; // net worth (balance)
export type Forecast = { points: ForecastPoint[]; in10y: ForecastPoint; todaysDollars: boolean };
  // always simulated for ≥ 120 months; in10y = point at month 120
export type MoveKind = 'payCardFirst' | 'cutCategory' | 'cancelSubscriptions'
  | 'retirementMatch' | 'hsa' | 'refinance' | 'negotiateRent' | 'reshopInsurance';
export type Move = { id: string; kind: MoveKind; level: 1|2|3; category?: CostCategory;
  effect10y: Money; patch: ProfilePatch };
export type MonthEnd = { projectedSpend: Money; vsAverage: Money | null;  // null until ≥ 3 months of history
  drifts: { category: CostCategory; delta: Money }[] };

export type LoanInput = { amount: Money; apr: Rate; termMonths: number;
  fees?: Money; downPayment?: Money; extraPayment?: Money };
  // financed principal = amount − downPayment + fees (fees are rolled into the loan)
export type ForecastSource = 'ai' | 'rules';
export type HorizonYears = 1 | 3 | 5 | 10;   // the S10 picker's years (`FORECAST_HORIZONS`); default 10
export type YearAnchor = { year: number; low: Money; mid: Money; high: Money }; // what the model returns: years 1–10, nominal
export type ForecastBundle = {            // /api/ai/forecast response; nominal dollars (todaysDollars: false)
  source: ForecastSource; model?: string;
  base: Forecast; scenarios: Record<string, Forecast>;   // scenarios keyed by candidate move id
};
export type LoanResult = { monthly: Money; totalInterest: Money; totalCost: Money;
  payoffMonth: number | null;    // null = the payment never covers the interest
  debtLoadBefore: Rate; debtLoadAfter: Rate; effect10y: Money;
  schedule: { month: number; interest: Money; principal: Money; balance: Money }[] };
  // debtLoad = required debt payments / take-home pay; Infinity when there are payments but no pay.

// POST /api/ai/explain. JSON has no Infinity: a debt load with no take-home pay is sent as null.
export type ExplainLoanResult = Omit<LoanResult, 'schedule' | 'debtLoadBefore' | 'debtLoadAfter'> & {
  debtLoadBefore: Rate | null; debtLoadAfter: Rate | null };   // null = no take-home pay
// move.source = the forecast its effect10y came from; the server words the sentence by it.
// horizon = the S10 picker's year and the move's effect there (`move.effect10y` cannot say it); absent = 10 years.
export type ExplainRequest = { move?: Move & { source?: ForecastSource }; loanResult?: ExplainLoanResult;
  horizon?: { years: HorizonYears; effect: Money } };
export type ExplainResponse = { text: string; source: 'ai' | 'template' };

export type Purchase = { label: string; amount: Money;   // amount per occurrence
  recurring: false | 'monthly' | 'yearly';
  payWith: 'cash' | 'card' | { loan: LoanInput } };
export type AffordResult = { verdict: 'fits'|'wait'|'no'; waitMonths?: number;
  failsOn?: 'cushion' | 'debtLoad' | 'cardRevolves';
  baselineFails: boolean;        // the plan already breaks a rule without this purchase
  with: Forecast; without: Forecast; cheapestWay: 'cash' | 'card' | 'loan' };

// Browser only; never sent. date = 'YYYY-MM-DD'; amount > 0 = money out, < 0 = money in.
export type Transaction = { date: string; description: string; amount: Money };
// The only statement data that leaves the browser. month = 'YYYY-MM'; label has names masked.
export type StatementItem = { label: string; amount: Money; month: string; day: number };
export type CategoryTotals = { month: string; totals: Record<CostCategory, Money>; // month = 'YYYY-MM'
  oneOffs: { label: string; amount: Money }[]; detectedPay?: Money;
  lastDay?: number };            // day of the month's latest statement line (how far the statement goes)

// POST /api/session (T4). revision counts saves (0 = nothing saved); updatedAt is ISO 8601 UTC.
export type SessionState = { profile?: Profile; wishlist: Purchase[]; revision: number; updatedAt: string | null };
```

## Engine API (pure, no I/O)

| Function | Owner | Signature |
| --- | --- | --- |
| `costOfLife` | Amir | `(card: LifeCard, area: AreaData) => CostBreakdown` |
| `cardToProfile` | Amir | `(card: LifeCard, area: AreaData) => Profile` (Closest Life; car loan becomes an `auto` debt, all fields `isEstimate: true`) |
| `scoreGuess` | Amir | `(guess: Money, cost: CostBreakdown, cluesOpened: number) => GuessResult` |
| `sceneOf` | Aibek | `(card: LifeCard, area: AreaData) => { public: PublicCard; clues: Record<ClueId, ClueReveal> }` (deterministic; the only place scene props come from) |
| `forecast` | Amir | `(p: Profile, years = 10 /* ≥ 10 */, opts?: { todaysDollars?: boolean; extra?: Purchase[] }) => Forecast` (the rules provider: fallback and yardstick; the headline forecast comes from `/api/ai/forecast`) |
| `applyPatch` | Amir | `(p: Profile, patch: ProfilePatch) => Profile` |
| `rankMoves` | Amir | `(p: Profile, opts?: { rates?: Partial<ForecastRates>; subscriptionsDetected?: boolean }) => Move[]` (level 1, top 3; `effect10y` in today's dollars; the committed move is the one with `id === p.committedMoveId`) |
| `moveCandidates` / `rankCandidates` | Amir | `(p: Profile, opts?: RankMovesOptions) => MoveCandidate[]` / `(p: Profile, candidates: MoveCandidate[], effectOf: (c: MoveCandidate) => Money) => Move[]`. `rankMoves` is both with the rules forecast as `effectOf`; the AI path supplies `effectOf` from the bundle. `MoveCandidate = Omit<Move, 'effect10y'>`. |
| `anchorIssues` / `anchorsToForecast` / `deflateForecast` / `pointAt` / `forecastSanityIssues` / `scenarioEffectIssues` / `rulesBundle` / `forecastFacts` | Amir | Pure helpers for the AI forecast: check the model's `YearAnchor[]`, expand it to a nominal `Forecast` (month 0 = today's balance sheet), convert a `Forecast` to today's dollars, read its point at a year (`pointAt`), compare a forecast and a move's effect (at 1, 3, 5 or 10 years) with the rules forecast, wrap the rules forecast as a `ForecastBundle` (the fallback), and strip a `Profile` to what the model sees. See ENGINEERING.md → AI forecast. |
| `movesLevel` / `isLevelUnlocked` | Amir | `(p: Profile) => 1 \| 2` / `(p: Profile, level: 1 \| 2 \| 3) => boolean` |
| `canAfford` | Amir | `(p: Profile, x: Purchase) => AffordResult` |
| `monthEnd` | Aibek | `(p: Profile, history: CategoryTotals[], current?: { month: string; day: number; totals: Record<CostCategory, Money> }) => MonthEnd` |
| `loan` | Aibek | `(p: Profile, l: LoanInput, opts?: { rates?: Partial<ForecastRates> }) => LoanResult` (`effect10y` in today's dollars, like moves) |
| `compareLoans` | Aibek | `(p: Profile, ls: LoanInput[], opts?: { rates?: Partial<ForecastRates> }) => LoanResult[]` (same order as `ls`) |
| `payoffOrder` | Aibek | `(debts: Debt[], extra: Money, method: 'avalanche' \| 'snowball') => { order: string[] /* debt ids */; payoffMonth: number \| null; totalInterest: Money }` |

All assumptions (inflation, returns, thresholds) live in `packages/engine/assumptions.ts` with a `Source` or an `assumption: true` flag. The UI shows them in a "How we calculate" panel.

## Server routes

Every route validates its input with zod. All POST routes and `/api/share` are rate-limited per anonymous ID and IP, with the strictest limits on `/api/ai/*` and `/api/statement/categorize` (they cost LLM calls).

| Route | Owner | In → out |
| --- | --- | --- |
| `GET /api/daily` | Aibek | → `{ ok, date, cards, progress? }`: today's 5 `PublicCard`s, no answers (`dailyCards(dayNumber(date))`; date = calendar date in `America/New_York`, DST-aware, so the set rolls over at US midnight, not mid-evening). With the `x-anon-id` header, `progress` = the clues the server recorded and the guesses it scored for this player today, so a cleared browser shows what will be counted. Query `game=slider` (the default) or `game=duel`; any other value is a 400 `bad_request`. |
| `GET /api/daily?game=duel` | Amir | → `{ ok, date, duels, progress? }` (`DuelDailyResponseSchema`): the day's 5 `PublicDuel`s from `publicDuels(date)`, same date rule as the slider, no totals, ZIPs, tiers or card ids before a pick. The `game` switch is a query parameter, not a server flag: the browser knows its mode at build time (`NEXT_PUBLIC_GAME_MODE`), so old slider clients keep working during the rollout. With a valid `x-anon-id`, `progress` (`DuelProgressWireSchema`) = `{ resultId, picks, hints }` for what the server recorded today: `resultId` is the day's result id (null before the first pick); `picks` maps round `"1"`–`"5"` to `{ choice, result: PickResult }` for picked rounds only, the result as scored at pick time but with a live `crowd` (null until #116); `hints` maps a round to the hint **text** (rebuilt with `duelHint`) for rounds the server recorded a hint for, so the browser never gets a hint it did not ask for. JSON keys are strings: the client turns them into the numbers of `DuelProgress`. Without the header there is no `progress` and the store is not touched; 400 for a malformed header, 503 when progress is asked for and the store is down. |
| `POST /api/daily/clue` | Aibek | `{ anonId, cardId, clue, date? }` → `ClueReveal`; the server records the opened clue first (once per clue; not after the guess). `date` is the set's date from `/api/daily`: yesterday's set stays open 30 minutes after midnight, then 409 `day_over`. 404 `not_in_set` for a card outside that day's set. |
| `POST /api/daily/guess` | Aibek | `{ anonId, cardId, guess, date? }` → `GuessReveal` + `{ guess, replayed }`. The server scores with `costOfLife` + `scoreGuess` using the clues it recorded, never a count or score from the client; one guess per card per anonId per day (UNIQUE in migration 3). A repeat answers the stored result (`replayed: true`, the amount scored then), never a second score. Stored with a random 128-bit `resultId`. |
| `POST /api/daily/hint` | Amir | `{ anonId, date, round }` (strict; `date` required) → `DuelHint { A, B }` + `{ recorded }`: one more fact on both cards of the duel round (each life's neighborhood tier, from the shared builder so the fixture and server texts match). The server records the hint first (`store.duel.openHint`), and `/api/daily/pick` scores 900 instead of 1,000 from that record; the client sends no count or score (400). One hint per round: asking twice, or after the pick, answers the same text with `recorded: false` and changes nothing. 409 `day_over` (carries `today`) past the grace period, 413, 429 (`Retry-After`), 503 when the store is down. |
| `GET /api/leaderboard` | Aibek | query `date` (default today), `limit` (1–100, default 50) (+ own `anonId` in a header) → `{ ok, date, players, entries, rank, todayStats }`, summed from stored guesses. Ties on points share a rank; handles are made up from a hash (no id, no PII). The client never sends a score. |
| `GET /api/share` | Aibek | query `resultId, format` (`9x16` default, `1x1`) → PNG (1080×1920 or 1080×1080, `next/og`) from a stored result, so share cards can't be faked; cached as immutable |
| `POST /api/session` | Aibek | `{ anonId, profile?, wishlist? }` → `{ ok: true, ...SessionState }`. `anonId` = `crypto.randomUUID()` (a UUID, required). `{ anonId }` alone loads; each field sent replaces the saved one whole. 402 `not_paid` when the save would add to the wishlist without Pro; 503 `unavailable` when the store is down or not configured. `GET /api/session` with the `x-anon-id` header loads too. |
| `POST /api/statement/categorize` | Aibek | `{ items: StatementItem[] }` (≤ 5,000) → `{ months: CategoryTotals[] /* one per month */, categorizedBy: 'ai' \| 'rules' \| 'mixed', classes?: { label, class: StatementClass }[] /* how each distinct masked label was sorted */ }`; keyword rules without an API key; nothing stored |
| `GET /api/statement/sample` | Amir | → `text/csv`: `packages/data/fixtures/statement.sample.csv`, prerendered at build. S9's "Try with sample statement" reads it as a File through the same browser path as an upload |
| `POST /api/events` | Aibek | `{ anonId, events: [{ id, name, props? }] }` (1–25) → `{ ok: true, accepted }`. Names from `CLIENT_EVENT_NAMES`; props are small enums and counts only (`EventsRequestSchema`), so no personal data; `id` = the browser's UUID per event, so a resent batch is stored once. The browser batches them (`src/lib/events.ts`, on with `NEXT_PUBLIC_EVENTS_SOURCE=api`, off under GPC / Do Not Track); the Pro routes record `checkout_started`, `pro_purchased`, `pro_demo_purchased` and `pro_promo_redeemed` themselves. 503 when the store is down. |
| `GET /api/events/funnel` | Aibek | query `days` (1–90, default 7) → `FunnelReport`: distinct anonymous ids per event and per `FUNNEL_STEPS` step (with how many went through every earlier step, and the conversion), plus clues per home, blind-guess, finish and share rates. Aggregates only. |
| `POST /api/ai/parse` | Amir | `{ kind: 'life' \| 'purchase' \| 'loan', text }` → `ProfilePatch` / `Purchase` / `LoanInput` (zod-validated). The parsed values are shown to the user to confirm before they enter the profile. |
| `POST /api/ai/explain` | Amir | `ExplainRequest { move? (optional `source: 'ai' \| 'rules'` words the sentence), loanResult?, horizon? { years: 1 \| 3 \| 5 \| 10, effect } (the sentence is about the move's gain at that year; ignored without a move) }` → `{ text, source }` (2 sentences, no new numbers; a debt load with no take-home pay is `null`) |
| `POST /api/ai/forecast` | Amir | `{ profile, rates?, scenarios?: { id, patch }[] }` → `ForecastBundle` (nominal dollars). Validated in code, cached, falls back to the rules forecast (`source: 'rules'`). Has its own rate limiter so it cannot use up the parse and explain budget. |
| `GET /api/pro/status` | Amir | header `x-anon-id` → `{ status: ProStatus, checkoutAvailable, demo: { enabled, code? } }` |
| `POST /api/pro/checkout` | Amir | `{ plan }` → `{ url }`, a Stripe Checkout Session in test mode to redirect to |
| `POST /api/pro/confirm` | Amir | `{ sessionId }` → `{ status }`; the server retrieves the session from Stripe and checks it is test-mode, complete, paid and this anonymous ID's |
| `POST /api/pro/demo-unlock` | Amir | `{ code }` → `{ status }`; the promo code shown on the Pro screen, for the jury |
| `POST /api/pro/demo-checkout` | Amir | `{ plan }` (strict: any other field is a 400) → `{ status }` with source `demo_checkout`; the simulated checkout, nothing is charged. 503 when `PRO_DEMO_UNLOCK=off`. |

## Pro paywall (S15, demo)

No real money moves. The Pro screen offers one checkout: the **simulated checkout** (a pre-filled demo card and a Pay (demo) button, no payment processor) when the server has no Stripe key, or Stripe's hosted Checkout in **test mode** (the test card is shown on screen) when it has one. The promo code shown on the Pro screen lets the jury skip both and pass the paywall without paying (FAQ Q115). All end in the same entitlement, keyed by the anonymous ID. The shared contracts and prices (`PRO_PRICES`: $39.99/year, $6.99/month, an assumption) live in `packages/types`.

- **Simulated checkout.** It is a demo and says so ("Demo · simulated checkout, nothing is charged"; the Pro screen shows "Demo checkout (simulated)"). There is no card field: the screen shows the order and a read-only "Visa •••• 4242 (demo card)", and only `{ plan }` is sent (`ProDemoCheckoutRequestSchema` is strict, so card-like fields are refused). The server grants source `demo_checkout` with the plan and records `pro_demo_purchased`, which is deliberately not `pro_purchased` and not in `FUNNEL_STEPS`: the funnel's "paid" step counts Stripe test payments only, and simulated ones show up under their own event. The screen picks the checkout from `checkoutAvailable` and `demo.enabled` (view-model `checkoutMode`: `stripe`, `demo` or `off`); `PRO_DEMO_UNLOCK=off` switches off the simulated checkout together with the promo code.
- **Test mode only (Stripe).** `STRIPE_SECRET_KEY` is accepted only if it starts with `sk_test_` or `rk_test_`; anything else leaves checkout unavailable and the promo code still works. `/api/pro/confirm` accepts only `cs_test_…` session ids and refuses a session with `livemode: true`.
- **No webhook.** The success URL carries the session ID; `/api/pro/confirm` fetches the session from Stripe, so nothing needs to reach the server from outside (the server is behind a Funnel route). The session is bound to the anonymous ID (`client_reference_id`) and can be claimed by one ID only.
- **Entitlements** sit behind an `EntitlementStore` interface. With `STORE_URL` they live in the Postgres store (tables `pro_entitlements`, `pro_checkout_sessions`); the JSON file of the earlier builds (`PRO_DATA_DIR`) is imported once on first use. Without `STORE_URL` (dev) they stay in that file. Sources rank `stripe_test` > `demo_checkout` > `demo`: a grant replaces the current one only when it ranks the same or higher, and the promo code never replaces anything, so nothing downgrades a Stripe purchase (migration 005 added `demo_checkout` to the `source` check).
- **What is gated.** Server-side routes call `requirePro(req)`, or `proStatusFor(anonId)` when only part of a request is gated (`src/server/pro/http.ts`). In this build the one real gate is saving a purchase to the wishlist (S11, `wishlistLocked`): the browser hides the button, and `POST /api/session` refuses (402) a save that would add a purchase to the saved wishlist without Pro. Items already in the wishlist stay and can be removed; the profile always saves.
- **Env:** `STRIPE_SECRET_KEY`, `APP_URL` (public base URL including any sub-path, used for the return URLs), `PRO_DEMO_CODE`, `PRO_DEMO_UNLOCK` (`off` disables the promo code and the simulated checkout), `PRO_DATA_DIR`. Names only in `.env.example`.

## Store (`apps/web/src/server/store/`)

Server-only. `getStore()` returns the process-wide store: Postgres for a `postgres://` `STORE_URL`, in memory in dev and tests without one. In production (`NODE_ENV=production`) without `STORE_URL` it throws `StoreUnavailableError('not_configured')` and the store routes answer 503; it never falls back to memory there.

- **Domains:** `store.sessions` (`SessionStore`: `load`, `save`), `store.game` (`GameStore`: `openClue`, `submitGuess`, `playerDay`, `findResult`, `leaderboard`; clue and guess writes for one day, player and card are serialized by a transaction-scoped advisory lock) and `store.events` (`EventStore`: `record`, `funnel`). Each domain is an interface with its rules as pure functions (`sessions.ts`) plus a Postgres and a memory implementation (`sessions.postgres.ts`, `sessions.memory.ts`) that share them. `store.db` (`Db`: `query`, `transaction`) is the Postgres connection for modules that own their tables, like Pro.
- **Keys:** every table keys rows by `anon_key` = sha256 of the anonymous id (`anonKey()`); the raw id is never stored.
- **Concurrency:** a session save is one transaction that locks its row (`SELECT … FOR UPDATE`), so concurrent saves for one id apply one after the other (`revision` counts them). `Db.transaction` retries on deadlock and serialization failures.
- **Migrations:** `migrations/NNN_name.ts`, listed in `migrations/index.ts` (1 sessions, 2 Pro entitlements, 3 game clues and results, 4 funnel events; versions are applied by set, so one that lands after a higher one still runs). They run once per process before the first query, in one transaction under an advisory lock, recorded with a checksum in `schema_migrations`. An edited migration stops the store; unknown newer ones (after a rollback) are tolerated. Additive only; parameterized queries only.
- **Errors:** connection, auth and shutdown errors become `StoreUnavailableError`; routes map it to 503 with `storeErrorResponse()` (`http.ts`). Anything else is a bug and surfaces as a 500.
- **Health:** `GET /api/health` always answers 200 while the app serves (liveness, for the container) and reports `store: { status, backend, reason? }` (readiness, checked once by the deploy) with a 2-second timeout.
- **Tests:** the memory store in unit tests; the Postgres tests run when `TEST_STORE_URL` is set (CI sets it), each in its own schema.

## Data flow

```
packages/data scripts ──► packages/data/out/areas.json (cached, committed)
                                   │
cards.json (server) ──► sceneOf ──► /api/daily (PublicCard) + /api/daily/clue (ClueReveal) ──► HouseScene (S2)
                 └──► costOfLife + scoreGuess in /api/daily/guess ──► game reveal (S3)
                                   │
sliders / balance sheet / CSV ──► Profile ──► /api/ai/forecast (S1, S10; rules fallback) · engine (the ladder's 10-year preview on S5–S9, canAfford, loan, monthEnd)
                                   │                         │
                         /api/session (persist)        view-model hooks ──► ui
CSV (browser parse, mask names) ──► StatementItem[] ──► /api/statement/categorize ──► CategoryTotals[] ──► Profile
```

## Privacy design

- CSVs are parsed client-side. Account numbers and personal names on payment-app (Zelle/Venmo/…), transfer and ACH name-field lines are masked before any request. Names on bill-pay, check-payee, "deposit from" and ACH-credit lines are not masked yet (#19), so the copy must not promise masking on every line.
- The server receives only `StatementItem`s: merchant label, amount, month and day of month. The day lets the server detect subscriptions and yearly charges. It returns totals; raw items are not stored.
- Labels pass through the LLM provider for categorizing: only the distinct masked labels, each marked money in or out, never amounts or dates. The provider (Anthropic) does not train on API data. Zero data retention is not enabled on the account, so the "What we keep" panel must not claim it; it says only that the labels go to the provider to be sorted and that we don't store them. Without an API key, keyword rules on the server sort them instead.
- Saved profiles hold income, balances and debts keyed by an unguessable anonymous ID. The store keeps only its SHA-256 hash, so a leaked row cannot be turned back into an ID that loads the profile. The "What we keep" panel shows exactly the persisted fields (category totals and profile values).
- Tool state (the micro-tools' local slices) lives only in browser localStorage and never enters a session or the database. The subscription audit's `audit` field is the one place it keeps more than category totals: the masked merchant labels, amounts and charge dates of the last statement's findings, so "only category totals are persisted" describes what our server stores, not this browser copy. Copy that lists what stays in the browser (the S9 "What we keep" panel, the kit showcase) must not say that nothing but totals is kept there.
- Bank connect (after the hackathon): read-only through an aggregator (e.g. Plaid). The access token stays server-side, transactions go through the same categorizer, and only category totals are persisted, like CSVs. "What we keep" must then say that transactions pass through the server, since the CSV line "the file never leaves your browser" does not hold for it. In the 24h build it is not shown (dead buttons are hidden).
- The anonymous ID lives in local storage; there are no accounts. It is sent in a header or body, never in a URL (share links use a separate `resultId`), because it also keys the saved profile.
- Pro keeps, per anonymous ID: the plan, how it was unlocked (`stripe_test`, `demo_checkout` or `demo`), when, and the Stripe test Checkout Session ID for a Stripe test payment. No card data or email ever reaches our server: the simulated checkout has no card field, and the Stripe test checkout page belongs to Stripe.
- The forecast request sends the profile's numbers (income, balances, debts, spending, area inflation) and no names or account numbers to the model provider, which does not train on API data. Zero data retention is not enabled, so no copy claims it; the "What we keep" panel says only that these numbers (no names or account numbers) go to the provider, which does not train on API data.
