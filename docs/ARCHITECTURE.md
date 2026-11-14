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

- Next.js (App Router) + TypeScript, deployed on Vercel; pnpm workspaces monorepo.
- Tailwind reading CSS variables from `tokens.css`, which is generated from `tokens.json` (Figma variables export).
- Zustand (or React context) for client state; local storage holds the anonymous ID and a profile cache.
- Vitest (engine) and Playwright (one end-to-end demo path).
- Supabase Postgres or Vercel KV for sessions, leaderboard and events.
- One server-side LLM client; responses validated with zod.
- Charts: one wrapper component (e.g. Recharts or visx) behind `<ForecastChart>` so restyling stays local.

## Folder structure (owner in brackets)

```
lifeguessr/
  packages/
    types/            shared contracts                          [both]
    engine/           pure TS + Vitest                          [You; loan/, month.ts, scene.ts = Teammate]
      cost.ts score.ts scene.ts forecast.ts moves.ts afford.ts month.ts loan/ assumptions.ts
    data/             fetch scripts, normalized JSON, cards     [Teammate]
      fixtures/       canonical fixtures (engine tests + web)   [both]
  apps/web/
    app/              routes (S3, S4 are states of /play)       [You]
    app/api/
      daily/ daily/clue/ daily/guess/ leaderboard/ share/       [Teammate]
      events/ session/ statement/                               [Teammate]
      ai/parse/ ai/explain/                                     [You]
    src/ui-kit/       primitives + tokens.css                   [You; HouseScene/ = Teammate]
    public/scene/     sprite kit (SVG layouts + props, from Figma)  [Designer]
    src/features/
      game/ ladder/ forecast/ afford/ loan/                     [You]   (model/ + ui/)
      upload/ mocks/                                            [Teammate]
    src/fixtures/     re-exports packages/data/fixtures         [both]
    src/copy.ts       all user-facing strings                   [You]
  tokens.json                                                   [You]
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
| S9 | Statement upload + "What we keep" | `/me/upload` | upload (logic) + ladder (ui) | Real |
| S10 | You in 10 years + Next Moves | `/future` | forecast | Real |
| S11 | Can I Afford It? | `/afford` | afford | Real |
| S12 | Loan Lab | `/loan` | loan | Real |
| S13 | Decision (car example) | `/decide` | mocks | Mock |
| S14 | Monthly check-in | `/checkin` | mocks | Mock |
| S15 | Paywall | `/pro` | mocks | Mock |

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
  oneOffs: { label: string; amount: Money }[]; detectedPay?: Money };
```

## Engine API (pure, no I/O)

| Function | Owner | Signature |
| --- | --- | --- |
| `costOfLife` | You | `(card: LifeCard, area: AreaData) => CostBreakdown` |
| `cardToProfile` | You | `(card: LifeCard, area: AreaData) => Profile` (Closest Life; car loan becomes an `auto` debt, all fields `isEstimate: true`) |
| `scoreGuess` | You | `(guess: Money, cost: CostBreakdown, cluesOpened: number) => GuessResult` |
| `sceneOf` | Teammate | `(card: LifeCard, area: AreaData) => { public: PublicCard; clues: Record<ClueId, ClueReveal> }` (deterministic; the only place scene props come from) |
| `forecast` | You | `(p: Profile, years = 10 /* ≥ 10 */, opts?: { todaysDollars?: boolean; extra?: Purchase[] }) => Forecast` |
| `applyPatch` | You | `(p: Profile, patch: ProfilePatch) => Profile` |
| `rankMoves` | You | `(p: Profile) => Move[]` |
| `canAfford` | You | `(p: Profile, x: Purchase) => AffordResult` |
| `monthEnd` | Teammate | `(p: Profile, history: CategoryTotals[], current?: { month: string; day: number; totals: Record<CostCategory, Money> }) => MonthEnd` |
| `loan` | Teammate | `(p: Profile, l: LoanInput) => LoanResult` |
| `compareLoans` | Teammate | `(p: Profile, ls: LoanInput[]) => LoanResult[]` |
| `payoffOrder` | Teammate | `(debts: Debt[], extra: Money, method: 'avalanche' \| 'snowball') => { order: string[] /* debt ids */; payoffMonth: number \| null; totalInterest: Money }` |

All assumptions (inflation, returns, thresholds) live in `packages/engine/assumptions.ts` with a `Source` or an `assumption: true` flag. The UI shows them in a "How we calculate" panel.

## Server routes

Every route validates its input with zod. All POST routes and `/api/share` are rate-limited per anonymous ID and IP, with the strictest limits on `/api/ai/*` and `/api/statement/categorize` (they cost LLM calls).

| Route | Owner | In → out |
| --- | --- | --- |
| `GET /api/daily` | Teammate | → today's 5 `PublicCard`s, no answers (seed = calendar date in `America/New_York`, so the set rolls over at US midnight, not mid-evening) |
| `POST /api/daily/clue` | Teammate | `{ anonId, cardId, clue }` → `ClueReveal`; the server records the opened clue |
| `POST /api/daily/guess` | Teammate | `{ anonId, cardId, guess }` → `GuessReveal`. The server scores with `costOfLife` + `scoreGuess` using the clues it recorded; one guess per card per anonId per day. |
| `GET /api/leaderboard` | Teammate | query `date` (+ own `anonId` in a header) → `{ rank, todayStats }`, summed from stored guesses. The client never sends a score. |
| `GET /api/share` | Teammate | query `resultId, format` → PNG (9:16 or 1:1) from a stored result, so share cards can't be faked |
| `POST /api/session` | Teammate | `{ anonId, profile?, wishlist? }` → saved state. `anonId` = `crypto.randomUUID()`. |
| `POST /api/statement/categorize` | Teammate | `{ items: StatementItem[] }` → `CategoryTotals[]` (one per month) |
| `POST /api/events` | Teammate | `{ anonId, name, props? }` → ok |
| `POST /api/ai/parse` | You | `{ kind: 'life' \| 'purchase' \| 'loan', text }` → `ProfilePatch` / `Purchase` / `LoanInput` (zod-validated). The parsed values are shown to the user to confirm before they enter the profile. |
| `POST /api/ai/explain` | You | `{ move? , loanResult? }` → `{ text }` (2 sentences, no new numbers) |

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
- Labels pass through the LLM provider for categorizing. Use the provider's no-training / zero-retention option, and say so in the "What we keep" panel.
- Saved profiles hold income, balances and debts keyed by an unguessable anonymous ID. The "What we keep" panel shows exactly the persisted fields (category totals and profile values).
- The anonymous ID lives in local storage; there are no accounts. It is sent in a header or body, never in a URL (share links use a separate `resultId`), because it also keys the saved profile.
