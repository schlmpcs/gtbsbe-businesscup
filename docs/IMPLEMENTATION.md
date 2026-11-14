# Accepted implementation architecture

User-approved decisions supersede the original TypeScript-engine and Vercel defaults.

- Next.js frontend; Go API and pure Go financial engine; Supabase Postgres.
- Docker Compose on a VPS, Caddy same-origin routing, anonymous HttpOnly cookies.
- OpenAPI contract generates the browser client; browser never computes financial results.
- Aibek agents take engine tasks #2–#5 in addition to #14–#26 and shared #1. Amir owns frontend integration and AI behavior.
- Anthropic statement processing requires verified eligible zero retention; otherwise local/manual categorization.
- All issues required in a 24-hour delivery window. Final seven hours reserved for integration and submission.
- User authorized available Codex subagents instead of Sonnet. Three agents work concurrently in separate directories.

## Agent boundaries after foundation
1. Engine: services/api/internal/engine, engine tests; all math including loans and month-end.
2. Data/scene: packages/data, Go scene derivation, presentational HouseScene; then mock screens.
3. Backend: persistence/migrations, HTTP routes, game state; then upload integration and e2e.
Coordinator owns contract changes, shared configuration, integrations and deployment.

## Implemented and verified

Go engine, transactional backend, offline catalog, cookie sessions, daily game, PNG sharing, browser CSV correction, calculation screens, debt editing, wishlist and placeholder scene are implemented. Canonical fixtures and source completeness report are included as source files in the checkout. OpenAPI and TypeScript contracts regenerate via `pnpm contracts`. CI runs Go race tests, Postgres integration, CSV/data tests, type/import checks, production build and mobile Playwright.

## Remaining acceptance gates

- #14/#26: VPS deployment and production rehearsal require SSH target, domain and server database configuration. Docker daemon is unavailable locally, so image execution is not locally verified.
- #15: all 60 rent inputs and Census rent ranges remain explicit estimates because official endpoints were blocked; verified HUD imports are supported. Four childcare ZIPs remain fallback estimates and county mappings need the official crosswalk.
- #19: three anonymized synthetic export formats are tested; the two-real-export acceptance gate requires suitably anonymized real exports.
- #25: functional original placeholder scene is present; final Kiko Figma art is not supplied.
- Anthropic key/retention eligibility are not configured or verified. Local/manual categorization works. AI parsing remains a manual-form fallback, outside Aibek's original issue scope.
- GitHub issues are not closed: live/data-dependent acceptance gates remain outstanding.

## Issue acceptance status

| Issue | Local implementation | Remaining external acceptance |
| --- | --- | --- |
| #1, #14 | Contracts, fixtures, monorepo, CI and deployment definitions | Team design handoff and live URL |
| #15 | Refresh/import tooling and labeled offline data | HUD/Census, crosswalk and verified insurance sources |
| #16 | Loans, comparisons, payoff strategies | None in local engine scope |
| #17 | Cookie sessions, profiles and wishlist | Production restart check |
| #18 | Daily game, leaderboard, sharing, limits | Production game check |
| #19 | Local CSV parser, masking, correction; three synthetic formats tested | Two anonymized real exports |
| #20 | Numeric aggregation, local/manual fallback, optional gated Anthropic classification | Provider eligibility/key validation |
| #21 | Funnel events and mobile full-path test | Production rehearsal |
| #22 | Month projection and three-month drift | None in local engine scope |
| #23 | Fifty modeled cards and two creator packs | Verified rent inputs from #15 |
| #24 | Interactive concept screens, forecast-gated paywall | None in mock scope |
| #25 | Deterministic scene, clue consistency, playable placeholder kit | Kiko's final artwork |
| #26 | README, local checks, browser recording | Live deployment, performance validation and submission recording |
