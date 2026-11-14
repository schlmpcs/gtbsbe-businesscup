# Avatar publishing: issue #105, Part 1

This PR prepares publishing for review. It does not complete #105 or connect real people to the current browser-only duel prototype. The persistent duel pick store, daily snapshots, own-avatar stand-ins, aggregate pick statistics, and final question set are still dependencies. There is no public pool endpoint and no fabricated pick count or verification badge.

## Default-off rollout

`AVATARS_ENABLED=true` enables preview and publication on the server. `NEXT_PUBLIC_AVATARS_ENABLED=true` enables the opt-in after the forecast is shown; rebuild the client when changing it. Both default to false, including Docker builds. CI enables both for the browser flow. Removal remains available with either flag off. A local discovery hint lets returning owners find management with opt-ins disabled; it never grants ownership or sets the published state.

All avatars are self-reported. The categorizer currently has no reliable evidence tying a user's current profile to a genuine statement. This change does not link statement uploads to anonymous IDs or claim statement verification. That needs a separate agreement and evidence design.

## Data and consent

The engine constructs the proposed coarse payload from the saved server profile and the covered area. Household facts are an optional additive Profile field, confirmed in the preview form; absent facts are marked estimates. They do not alter forecast math. Age, metro and each financial field are fixed enums, sourced lookup results or computed numbers. No ZIP, owner key, account data or free text enters the public payload.

The preview response includes a SHA-256 digest of the canonical public payload. Publishing requires literal consent and that digest, then reconstructs the payload from the saved profile. A changed payload causes `stale_preview`; an identical session re-save does not. Submitted financial values or stamps are rejected. This keeps consent attached to the numbers actually previewed.

The payload still contains the question fields proposed in #105. Before enabling real pool integration, agree the final question set and remove every unused truth. The existing cost-only prototype is not that agreement. No payload is served to strangers by this change.

## Persistence and lifecycle

Migration 007 adds the avatars table. Owner keys are SHA-256 hashes of anonymous IDs; public IDs use 128 random bits. A republish preserves the public ID and original publication day, updating the payload and expiry atomically. Unpublish deletes the row. Status refresh and publication sweep expired rows; pool reads exclude expired rows even before a sweep. Dates are New York calendar dates at the API boundary; expiry is 90 calendar days, independent of DST.

`poolFor` is server-only, suppresses pools smaller than 20, and supports owner exclusion. G-DUEL must handle the shared daily snapshot and per-owner stand-in before using it. No crowd or leaderboard behavior is changed here.

Avatar events carry booleans/enums only. Their counts appear in the existing events report. Main funnel ordering stays unchanged while the opt-in is optional and default-off; adding a mandatory publication step would otherwise make nonparticipants appear to abandon the paywall. Final dashboard/funnel integration belongs with the G-DUEL rollout. The referenced `docs/dashboard/features.json` is absent from this checkout.

The additional events cross the old 32-bit analytics limit. JavaScript masks now use exact arithmetic (bounded to 52 event bits); Postgres uses bigint masks, converted back to safe integers. Stored event rows keep names, so no backfill is needed. Existing funnel formulas and game counts remain unchanged.

## Validation

Engine tests cover rounding, negative values, raw bounds, age bands, omitted metro, estimates and suppressed small samples. Memory/Postgres parity tests cover exact previews, stale previews, stable IDs, concurrent republishes, expiry, small-pool suppression, owner exclusion and deletion. HTTP tests reject forged stamps/numbers and absent consent, and verify publishing limits and unlimited removal. View-model tests cover consent, changed profile facts, removal with flags off and late-response races. CI runs the forecast → preview → consent → publish → privacy disclosure → unpublish browser path.
