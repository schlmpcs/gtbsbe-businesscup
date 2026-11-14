# DATA.md — public data sources

All data is fetched ahead of time by `packages/data` scripts and committed as JSON. The app never calls government APIs live during the demo. Every value carries a `Source { name, year, url }`.

## Sources

| Cost component | Source | Access | Notes |
| --- | --- | --- | --- |
| Rent by bedrooms (0–4), by ZIP | HUD Fair Market Rents and Small Area FMRs — https://www.huduser.gov/PORTAL/datasets/fmr.html | Free API, free token (HUD USER) | FMR = 40th-percentile gross rent (rent + utilities). Use as-is; never add a utilities estimate on top. Label as "typical, not luxury". |
| Rent range ratios, by ZIP (ZCTA) | Census ACS 5-year API — B25063 (gross rent distribution) → interpolate Q1, median, Q3; B25064 (median gross rent) and B25031 (median gross rent by bedrooms) as cross-checks; B25077 (median home value) | Free API key | Store `rentRangeRatio = Q1/median, Q3/median` and apply it to the card's bedroom FMR (scoring range = middle half). Don't use B25057/B25059: they are *contract* rent quartiles (no utilities) across all unit sizes, so they don't match FMR gross rent. Verify the table IDs before building. |
| Grocery, gas and food prices | BLS Average Price Data (series prefix `APU`), e.g. eggs `APU0000708111`, white bread `APU0000702111` | BLS Public Data API v2 with `BLS_KEY` (up to 50 series per request; v1 without a key: 25) | Monthly U.S. city average, some regional series. Groceries and gas vary by region at most, not by ZIP; rent drives most local differences. |
| Inflation | BLS CPI-U | Same API | Drives `inflationAnnual`. |
| Childcare by county | DOL Women's Bureau, National Database of Childcare Prices | Public download (verify format) | Cited as a source by the MIT Living Wage methodology. By age group (infant, toddler, preschool, school-age). Map ZIP → county with the HUD USPS ZIP crosswalk. The latest survey year lags several years: inflate to today with CPI and show both years in the Source label. |
| Groceries by household size | USDA food plans (Thrifty / Low / Moderate / Liberal) | Public PDFs/tables (verify) | Per-person monthly cost. |
| Eating out | BLS Consumer Expenditure Survey (food away from home) | Public tables (verify) | Average meal price assumption. |
| Car insurance | Source to choose (state averages) | Verify | Stored per area as `carInsuranceMonthly`; `isEstimate: true` until a source is verified. |
| Card APR default | ~22.8% average APR on accounts with balances (CardRates, 2026) | Constant | Source-tagged. Cross-check with the Federal Reserve G.19 "interest rate on accounts assessed interest"; prefer G.19 if the two disagree. Stored as a decimal (`0.228`). |
| Debt context for the pitch | New York Fed Household Debt and Credit, Q3 2026: card balances ~$1.29T | Constant | Pitch only. |

## Do not use

- **Zillow** listings, Zestimates or photos: there is no open API, the terms ban automated access, and there are photo copyright risks.
- **MIT Living Wage Calculator data directly:** the documentation says "All rights reserved". Use its underlying public sources (HUD, DOL, USDA, BLS) instead.

## Coverage for the hackathon

About 60 ZIPs across 15 metros. Suggested metros: New York, Los Angeles, Chicago, Houston, Phoenix, Philadelphia, Dallas, Austin, Atlanta, Miami, Seattle, Denver, Boston, Nashville, Minneapolis. Pick about 4 ZIPs per metro (cheap, mid, expensive, suburb) and store that choice as `AreaData.tier`; the game's mailbox clue and window view use it.

## Output shape

`packages/data/out/areas.json` is an array of `AreaData` (see ARCHITECTURE.md). Fixtures are in `packages/data/fixtures/` (`areaData.sample.json` with 3 ZIPs, `cards.sample.json`, `profile.demo.json`, `statement.sample.csv`, `loanOffers.sample.json`), so the engine and UI can start before the pipeline lands. This is the only fixture location; `apps/web/src/fixtures` re-exports it. Life cards (`cards.json`, 50 cards + 2 creator packs) are built here too, from `areas.json`.

## Refresh

`pnpm data:refresh` re-fetches everything. API keys go in `.env` (`HUD_TOKEN`, `CENSUS_KEY`, `BLS_KEY`, plus the LLM key and the Supabase / Vercel KV credentials chosen in Hour 0) and are never committed. Commit a `.env.example` with names only.
