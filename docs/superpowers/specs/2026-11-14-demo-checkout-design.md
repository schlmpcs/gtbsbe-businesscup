# Pro paywall: in-app demo checkout (no Stripe)

Status: approved by Amir, 2026-11-14. Size: small-to-medium (one feature across contract, server, view-model, UI, copy, docs).

## Intent and why

The Pro screen (S15) must show a believable paywall step without any payment processor and without moving money. The hackathon needs no real payments (FAQ Q115), and the Stripe test-mode path needs a key and server setup that the team does not want to carry. The judges are paywall and subscription specialists, so the screen should still look like a checkout, and it must be honest that it is a simulation (40% of the score is "does it work, not faked or hardcoded").

Today Pro unlocks through Stripe test mode (`stripe_test`) or the promo code (`demo`). The production server has no `STRIPE_SECRET_KEY`, so `/pro` shows "Test checkout is off" and only the promo code works.

## Goals

- A checkout step on `/pro` that needs no external service: order summary, a pre-filled demo card, a **Pay (demo)** button. Pro unlocks for the chosen plan.
- Clear labelling everywhere that it is simulated: badge, the Pro screen's "unlocked with" line, docs.
- The server stays the authority on who is Pro; the entitlement records how it was unlocked.
- No change to how Stripe test mode works when a key is configured.

## Non-goals

- No payment processor, no webhook, no real or test money.
- No card form. No card data is typed, sent, or stored.
- No change to the promo code flow.
- No new gated features; the wishlist stays the only Pro feature.

## Anti-goals (a failure even if it technically works)

- A screen that reads as a real charge (wrong label, "Stripe" wording, a fake receipt that looks real).
- A card input that invites real card numbers.
- A demo purchase that overwrites or downgrades a Stripe purchase.
- The docs or pitch still saying "Real: Stripe test mode" for S15.

## Constraints

- Repo golden rules: contracts first (`packages/types`), UI in `features/pro/ui/*` is presentational only (imports `@/ui-kit/**`, `@/copy`, `../model/types`), all copy in `src/copy/pro.ts`, tokens for styling, every number has a source or an "estimate" tag (the plan prices already do).
- Wording: "educational simulation, not financial advice" stays.
- Privacy: anonymous ids are stored as SHA-256 hashes (existing store rule). Nothing new is collected: only `{ plan }` is sent.
- Production Postgres: the `pro_entitlements.source` column has a CHECK allowing only `stripe_test` and `demo`; a new migration is required and runs on the next deploy.
- Heavy checks (production build, Playwright e2e) run on the team server, not the Mac. Lint, typecheck and unit tests run locally.

## Approaches considered

1. **In-app demo checkout (chosen).** An on-page checkout block with a pre-filled demo card and a Pay (demo) button; a new route grants a new `demo_checkout` source. Trade-off: some code (types, route, migration, UI, tests), but it looks like a paywall step, needs no server setup, and is honest about being simulated.
2. **One-tap unlock, no card UI.** A single "Start Pro (demo)" button reusing the promo path. Least code, but the screen has no payment step, which paywall-expert judges may find thin.
3. **Keep Stripe test mode.** The most credible "real, not faked" flow, but it needs a Stripe test key and server `.env` changes. No new code.

Amir picked approach 1.

## Decisions (as approved)

1. **No card fields.** The block shows the order (plan and price), a read-only "Visa •••• 4242 (demo card)" row, and a **Pay $39.99 (demo)** button (price follows the selected plan). Only `{ plan }` goes to the server.
2. **New route `POST /api/pro/demo-checkout`** with body `{ plan }` and the same reply shape as `/api/pro/demo-unlock` (`{ ok: true, status }`). It has its own rate limit, the same event logging as the other Pro routes, and no artificial processing delay (the busy state is just the request in flight).
3. **New entitlement source `demo_checkout`** (with the plan). Precedence: `stripe_test` > `demo_checkout` > `demo`. A demo checkout upgrades a promo unlock (it records the plan); nothing downgrades a Stripe purchase; a promo code entered after a demo checkout changes nothing.
4. **Stripe stays.** If a test key is configured (`checkoutAvailable`), the Stripe button shows as today. Otherwise the demo checkout shows. `PRO_DEMO_UNLOCK=off` switches off both demo paths (promo code and demo checkout).
5. **Labels.** Badge: "Demo · simulated checkout, nothing is charged". Pro screen "Unlocked with": "Demo checkout (simulated)". `docs/ARCHITECTURE.md` S15 changes from "Real: Stripe test mode, no real money" to a simulated payment (with the Stripe path noted as optional). README and PRODUCT F13 say the same.
6. **Migration 005** replaces the `source` CHECK constraint to allow `demo_checkout`. Additive. It runs against the production Postgres at the next deploy.

Sketch:

```
 [Demo · simulated checkout, nothing is charged]
 Order     LifeGuessr Pro · Yearly          $39.99 / year
 Pay with  Visa •••• 4242  (demo card)
 [ Pay $39.99 (demo) ]
 Judges: skip checkout · promo code [JURY-DEMO] [Unlock]
```

## Left to the builder

- Exact shape of the status/`ProStatusResponse` change that tells the screen which checkout to show (for example a `checkoutMode` field replacing or extending `checkoutAvailable`), as long as the contract, fixtures and both consumers change together.
- Rate-limit numbers for the new route (keep them in line with `demoUnlock`).
- The new funnel event name, if the existing events need one (reuse the `pro_*` naming).
- How the migration drops and re-adds the CHECK safely (constraint name, idempotence), and its test.
- Component split inside `features/pro/ui` and the accessibility details (labels, live region, focus after unlock).
- Doc edits: ARCHITECTURE (S15 row, Pro paywall section, server routes table, env list), PRODUCT F13, README S15 row, `.env.example` comment.

## How it ships

Branch `feat/demo-checkout` off `main`, in its own worktree. Tests first. Local: lint, typecheck, unit tests. Server: production build and Playwright e2e. PR to `main`; merge triggers the auto-deploy. No server `.env` change is needed.
