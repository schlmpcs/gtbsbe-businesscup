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
- One server-side LLM client: Anthropic Claude (`ANTHROPIC_API_KEY`, model in `ANTHROPIC_MODEL`); responses validated with zod.
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
    app/              routes (S3, S4 are states of /play)       [Amir]
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
| S1 | Today (month-end card, You in 10 years, play) | `/` | forecast | Real (drift flags need ≥ 3 uploaded months; before that the card shows the projection only) |
| S2 | Game: explore the home (house scene, tap rooms for clues) + guess | `/play` | game | Real (falls back to a static card if the scene isn't ready) |
| S3 | Reveal | `/play` (state) | game | Real |
| S4 | Streamer mode | `/play?stream=1` | game | Real |
| S5 | Guess yourself | `/me/guess` | ladder | Real |
| S6 | Closest life | `/me/closest` | ladder | Real |
| S7 | Quick sliders | `/me/sliders` | ladder | Real |
| S8 | Balance sheet | `/me/balance` | ladder | Real |
| S9 | Statement upload + "What we keep" (+ "connect your bank app", coming soon) | `/me/upload` | upload (logic) + ladder (ui) | Real (bank connect: Mock) |
| S10 | You in 10 years + Next Moves | `/future` | forecast | Real |
| S11 | Can I Afford It? | `/afford` | afford | Real |
| S12 | Loan Lab | `/loan` | loan | Real |
| S13 | Decision (car example) | `/decide` | mocks | Mock |
| S14 | Monthly check-in | `/checkin` | mocks | Mock |
| S15 | Paywall | `/pro` | pro | Real: Stripe test mode + promo code, no real money |

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
export type LoanResult = { monthly: Money; totalInterest: Money; totalCost: Money;
  payoffMonth: number | null;    // null = the payment never covers the interest
  debtLoadBefore: Rate; debtLoadAfter: Rate; effect10y: Money;
  schedule: { month: number; interest: Money; principal: Money; balance: Money }[] };
  // debtLoad = required debt payments / take-home pay; Infinity when there are payments but no pay.

// POST /api/ai/explain. JSON has no Infinity: a debt load with no take-home pay is sent as null.
export type ExplainLoanResult = Omit<LoanResult, 'schedule' | 'debtLoadBefore' | 'debtLoadAfter'> & {
  debtLoadBefore: Rate | null; debtLoadAfter: Rate | null };   // null = no take-home pay
export type ExplainRequest = { move?: Move; loanResult?: ExplainLoanResult };
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
| `forecast` | Amir | `(p: Profile, years = 10 /* ≥ 10 */, opts?: { todaysDollars?: boolean; extra?: Purchase[] }) => Forecast` |
| `applyPatch` | Amir | `(p: Profile, patch: ProfilePatch) => Profile` |
| `rankMoves` | Amir | `(p: Profile, opts?: { rates?: Partial<ForecastRates>; subscriptionsDetected?: boolean }) => Move[]` (level 1, top 3; `effect10y` in today's dollars; the committed move is the one with `id === p.committedMoveId`) |
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
| `GET /api/daily` | Aibek | → today's 5 `PublicCard`s, no answers (seed = calendar date in `America/New_York`, so the set rolls over at US midnight, not mid-evening) |
| `POST /api/daily/clue` | Aibek | `{ anonId, cardId, clue }` → `ClueReveal`; the server records the opened clue |
| `POST /api/daily/guess` | Aibek | `{ anonId, cardId, guess }` → `GuessReveal`. The server scores with `costOfLife` + `scoreGuess` using the clues it recorded; one guess per card per anonId per day. |
| `GET /api/leaderboard` | Aibek | query `date` (+ own `anonId` in a header) → `{ rank, todayStats }`, summed from stored guesses. The client never sends a score. |
| `GET /api/share` | Aibek | query `resultId, format` → PNG (9:16 or 1:1) from a stored result, so share cards can't be faked |
| `POST /api/session` | Aibek | `{ anonId, profile?, wishlist? }` → `{ ok: true, ...SessionState }`. `anonId` = `crypto.randomUUID()` (a UUID, required). `{ anonId }` alone loads; each field sent replaces the saved one whole. 402 `not_paid` when the save would add to the wishlist without Pro; 503 `unavailable` when the store is down or not configured. `GET /api/session` with the `x-anon-id` header loads too. |
| `POST /api/statement/categorize` | Aibek | `{ items: StatementItem[] }` (≤ 5,000) → `{ months: CategoryTotals[] /* one per month */, categorizedBy: 'ai' \| 'rules' \| 'mixed' }`; keyword rules without an API key; nothing stored |
| `POST /api/events` | Aibek | `{ anonId, events: [{ id, name, props? }] }` (1–25) → `{ ok: true, accepted }`. Names from `CLIENT_EVENT_NAMES`; props are small enums and counts only (`EventsRequestSchema`), so no personal data; `id` = the browser's UUID per event, so a resent batch is stored once. The browser batches them (`src/lib/events.ts`, on with `NEXT_PUBLIC_EVENTS_SOURCE=api`, off under GPC / Do Not Track); the Pro routes record `checkout_started`, `pro_purchased` and `pro_promo_redeemed` themselves. 503 when the store is down. |
| `GET /api/events/funnel` | Aibek | query `days` (1–90, default 7) → `FunnelReport`: distinct anonymous ids per event and per `FUNNEL_STEPS` step (with how many went through every earlier step, and the conversion), plus clues per home, blind-guess, finish and share rates. Aggregates only. |
| `POST /api/ai/parse` | Amir | `{ kind: 'life' \| 'purchase' \| 'loan', text }` → `ProfilePatch` / `Purchase` / `LoanInput` (zod-validated). The parsed values are shown to the user to confirm before they enter the profile. |
| `POST /api/ai/explain` | Amir | `ExplainRequest { move?, loanResult? }` → `{ text, source }` (2 sentences, no new numbers; a debt load with no take-home pay is `null`) |
| `GET /api/pro/status` | Amir | header `x-anon-id` → `{ status: ProStatus, checkoutAvailable, demo: { enabled, code? } }` |
| `POST /api/pro/checkout` | Amir | `{ plan }` → `{ url }`, a Stripe Checkout Session in test mode to redirect to |
| `POST /api/pro/confirm` | Amir | `{ sessionId }` → `{ status }`; the server retrieves the session from Stripe and checks it is test-mode, complete, paid and this anonymous ID's |
| `POST /api/pro/demo-unlock` | Amir | `{ code }` → `{ status }`; the promo code shown on the Pro screen, for the jury |

## Pro paywall (S15, demo)

No real money moves. Pro unlocks through a Stripe Checkout in **test mode** (the test card is shown on screen) or through the promo code shown on the Pro screen, which exists so the jury can pass the paywall without paying (FAQ Q115). Both end in the same entitlement, keyed by the anonymous ID. The shared contracts and prices (`PRO_PRICES`: $39.99/year, $6.99/month, an assumption) live in `packages/types`.

- **Test mode only.** `STRIPE_SECRET_KEY` is accepted only if it starts with `sk_test_` or `rk_test_`; anything else leaves checkout unavailable and the promo code still works. `/api/pro/confirm` accepts only `cs_test_…` session ids and refuses a session with `livemode: true`.
- **No webhook.** The success URL carries the session ID; `/api/pro/confirm` fetches the session from Stripe, so nothing needs to reach the server from outside (the server is behind a Funnel route). The session is bound to the anonymous ID (`client_reference_id`) and can be claimed by one ID only.
- **Entitlements** sit behind an `EntitlementStore` interface. With `STORE_URL` they live in the Postgres store (tables `pro_entitlements`, `pro_checkout_sessions`); the JSON file of the earlier builds (`PRO_DATA_DIR`) is imported once on first use. Without `STORE_URL` (dev) they stay in that file. A Stripe grant replaces a demo grant, never the reverse.
- **What is gated.** Server-side routes call `requirePro(req)`, or `proStatusFor(anonId)` when only part of a request is gated (`src/server/pro/http.ts`). In this build the one real gate is saving a purchase to the wishlist (S11, `wishlistLocked`): the browser hides the button, and `POST /api/session` refuses (402) a save that would add a purchase to the saved wishlist without Pro. Items already in the wishlist stay and can be removed; the profile always saves.
- **Env:** `STRIPE_SECRET_KEY`, `APP_URL` (public base URL including any sub-path, used for the return URLs), `PRO_DEMO_CODE`, `PRO_DEMO_UNLOCK` (`off` disables the code), `PRO_DATA_DIR`. Names only in `.env.example`.

## Store (`apps/web/src/server/store/`)

Server-only. `getStore()` returns the process-wide store: Postgres for a `postgres://` `STORE_URL`, in memory in dev and tests without one. In production (`NODE_ENV=production`) without `STORE_URL` it throws `StoreUnavailableError('not_configured')` and the store routes answer 503; it never falls back to memory there.

- **Domains:** `store.sessions` (`SessionStore`: `load`, `save`), `store.events` (`EventStore`: `record`, `funnel`). Each domain is an interface with its rules as pure functions (`sessions.ts`) plus a Postgres and a memory implementation (`sessions.postgres.ts`, `sessions.memory.ts`) that share them. T5 (game) adds its own the same way. `store.db` (`Db`: `query`, `transaction`) is the Postgres connection for modules that own their tables, like Pro.
- **Keys:** every table keys rows by `anon_key` = sha256 of the anonymous id (`anonKey()`); the raw id is never stored.
- **Concurrency:** a session save is one transaction that locks its row (`SELECT … FOR UPDATE`), so concurrent saves for one id apply one after the other (`revision` counts them). `Db.transaction` retries on deadlock and serialization failures.
- **Migrations:** `migrations/NNN_name.ts`, listed in `migrations/index.ts` (1 sessions, 2 Pro entitlements, 4 funnel events; 3 reserved for T5, which lands after 4 and still runs: versions are applied by set). They run once per process before the first query, in one transaction under an advisory lock, recorded with a checksum in `schema_migrations`. An edited migration stops the store; unknown newer ones (after a rollback) are tolerated. Additive only; parameterized queries only.
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
sliders / balance sheet / CSV ──► Profile ──► engine.forecast / rankMoves / canAfford / loan
                                   │                         │
                         /api/session (persist)        view-model hooks ──► ui
CSV (browser parse, mask names) ──► StatementItem[] ──► /api/statement/categorize ──► CategoryTotals[] ──► Profile
```

## Privacy design

- CSVs are parsed client-side. Account numbers, the account holder's name and personal names in labels (e.g. Zelle/Venmo/transfer lines) are masked before any request.
- The server receives only `StatementItem`s: merchant label, amount, month and day of month. The day lets the server detect subscriptions and yearly charges. It returns totals; raw items are not stored.
- Labels pass through the LLM provider for categorizing: only the distinct masked labels, each marked money in or out, never amounts or dates. Use the provider's no-training / zero-retention option, and say so in the "What we keep" panel. Without an API key, keyword rules on the server sort them instead.
- Saved profiles hold income, balances and debts keyed by an unguessable anonymous ID. The store keeps only its SHA-256 hash, so a leaked row cannot be turned back into an ID that loads the profile. The "What we keep" panel shows exactly the persisted fields (category totals and profile values).
- Bank connect (after the hackathon): read-only through an aggregator (e.g. Plaid). The access token stays server-side, transactions go through the same categorizer, and only category totals are persisted, like CSVs. "What we keep" must then say that transactions pass through the server, since the CSV line "the file never leaves your browser" does not hold for it. In the 24h build it is a disabled "coming soon" button.
- The anonymous ID lives in local storage; there are no accounts. It is sent in a header or body, never in a URL (share links use a separate `resultId`), because it also keys the saved profile.
- Pro keeps, per anonymous ID: the plan, how it was unlocked (`stripe_test` or `demo`), when, and the Stripe test Checkout Session ID. No card data or email ever reaches our server; the test checkout page belongs to Stripe.
