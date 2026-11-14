# Subscription catalogue

Manual US snapshot prepared 2026-11-14. Names and public pricing/membership links only; no brand artwork. This catalogue identifies merchants, not recommendations.

Spotify Premium Individual ($12.99 monthly) and Apple's US iCloud+ 50 GB ($0.99 monthly) were checked against their linked official pages on that date. All other amounts are explicitly `isEstimate: true` and their plan name says `Catalogue estimate`. Netflix's public page varied by region, so its amount remains estimated. Gym prices vary by location and meal-kit amounts are estimated monthly spending, not a quoted membership fee. Taxes, promotions and legacy plans are excluded. Statement fixture amounts are historical charges, not current prices.

To refresh, open each entry's public source in the US region, check the recurring price and cadence after any introductory offer, set a descriptive plan name, `priceYear`, and `source.year`, and clear `isEstimate` only after verification. Leave unverified prices estimated. Record the verification date here. Run the catalogue collision/schema tests and fixture-label recognition tests before committing.

`findService` uses normalized whole-word descriptors; multiple matches return null instead of guessing. Generic marketplace descriptors are ambiguous and require product confirmation. Matchers must not overlap across services. `tickList()` supplies forty unambiguous editable defaults. A user's actual charges always take precedence over catalogue estimates.
