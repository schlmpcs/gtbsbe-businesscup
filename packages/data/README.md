# @lifeguessr/data

Public area data (T2), the life-card catalog (T10) and the canonical fixtures.

| Import | What | Where it may run |
| --- | --- | --- |
| `@lifeguessr/data/areas` (also re-exported from `@lifeguessr/data`) | `areaData`, `findArea(zip)`, `getArea(zip)`: 60 `AreaData` rows from `out/areas.json`, zod-validated at load | Anywhere (public data) |
| `@lifeguessr/data/cards` | `lifeCards`, `dailyCards(day)`, `dailyCycleDays`, `packIds`, `packCards(pack)`, `cardSlot(id)`, `findCard(id)` | **Server routes and tests only**: cards hold the answers. ESLint blocks it in `apps/web` outside `app/api/**` |
| `@lifeguessr/data/fixtures` | The small contract fixtures (4 Dallas ZIPs, 6 sample cards, demo profile, statement, loan offers) | Anywhere |

## Area data: `out/areas.json`

60 ZIPs in 15 metros, one per tier (cheap, mid, expensive, suburb), all in `scripts/refresh.py` → `METROS`. The tiers are an editorial choice; the build fails if one contradicts HUD's 2-bedroom rents (cheap < mid < expensive). Every value carries a `Source { name, year, url }`. Nothing is invented: a value we can't source is left out (optional fields) or the build fails.

| Field | Source | Notes |
| --- | --- | --- |
| `rentByBedrooms` | HUD **FY2026 Small Area Fair Market Rents**, read from HUD's official eGIS open-data service (`HUD_PDR_Small_Area_Fair_Market_Rents`, item "Date of Coverage: Fiscal Year 2026") | 40th-percentile gross rent (rent + utilities). The row must belong to the metro's HUD FMR area. All 60 ZIPs are HUD values; none is estimated. huduser.gov's workbooks sit behind an AWS WAF challenge from scripted clients; to use a downloaded workbook (e.g. FY2027) run with `HUD_XLSX=/path/fy2027_safmrs.xlsx HUD_FY=2027`. That parser accepts only base SAFMR columns, never the 90%/110% payment standards |
| `rentRangeRatio` | U.S. Census Bureau **ACS 2020–2024 5-year, B25063** (gross rent distribution) per ZCTA, read through the Census Reporter API (api.census.gov returns a Cloudflare block to this network) | Q1 and Q3 by linear interpolation inside the bracket, divided by the median. Our median is checked against the published B25064 median (max 0.05% apart). Left out when Q3 falls in the open-ended "$3,500 or more" bracket (5 expensive ZIPs) or fewer than 200 units pay cash rent; the engine then uses its estimate spread |
| county | Census Reporter TIGER 2024 ZCTA → county relationships | The county with the largest share of the ZCTA's land (75024 → Collin 87%, 30316 → DeKalb 84%; all others ≥ 96%) |
| `childcareMonthly` | DOL Women's Bureau **National Database of Childcare Prices** (NDCP2022.xlsx), county center-based weekly medians `MCINFANT`, `MCTODDLER`, `MCPRESCHOOL`, `MCSA` | × 52/12, then inflated from the survey year to the latest month with **BLS CPI-U day care and preschool** (`CUUR0000SEEB03`). NDCP 2022 has no center-based prices for Philadelphia and Bucks counties, so those 4 ZIPs use the county's latest complete year (2020). Both years are in the Source name |
| `groceriesPerAdult` | **USDA moderate-cost food plan, October 2026** (`sources/CostofFoodOct2026LowModLib.pdf` + its `pdftotext -layout` extract) | Mean of the female and male 19–50 monthly costs ($337.00, $398.90). National: USDA publishes no regional plan |
| `gasPerGallon` | **EIA weekly retail price, regular gasoline**, latest week | The closest published area: the city (NYC, LA, Chicago, Houston, Miami, Seattle, Denver, Boston), else the state (TX, MN), else the PADD region (Phoenix: West Coast less California; Philadelphia: Central Atlantic; Atlanta: Lower Atlantic; Nashville: Midwest) |
| `cpiYoY` | **BLS CPI-U all items**, 12-month change for the latest month with a year-earlier value | Metro series (`CUURS…`); Austin and Nashville have none, so they use the South region (`CUUR0300SA0`) |
| `carInsuranceMonthly` | **NAIC Auto Insurance Database**, combined average premium (liability + collision + comprehensive), 2023, by state (`sources/naic-auto-insurance-database-2023-table5.txt`) | ÷ 12, inflated to the latest month with BLS CPI-U motor vehicle insurance (`CUUR0000SETE`). A state average, not a quote: `isEstimate: true` everywhere |

`out/incomplete-data-report.json` lists the coverage of every ZIP (which source each field came from, ACS quartiles, county land share) and the known limits. `complete` stays false while any ZIP lacks a rent range. `out/source-cache.json` keeps the raw values used, with URLs and retrieval times, so `refresh:offline` rebuilds the outputs without network access.

## Refresh

Needs Python 3 and no pip packages (`scripts/python.mjs` picks `$PYTHON`, `python3` or `/usr/bin/python3`).

```
pnpm data:refresh                                  # fetch (small read-only requests) + build
pnpm --filter @lifeguessr/data refresh:offline     # rebuild from out/source-cache.json
pnpm --filter @lifeguessr/data test:py             # pipeline tests (no network); CI runs them
```

Childcare comes from a 92 MB workbook, so it is imported separately (about 30 s on one core) after a refresh has cached the ZIP → county map:

```
curl -o /tmp/NDCP2022.xlsx https://www.dol.gov/sites/dolgov/files/WB/NDCP2022.xlsx
pnpm --filter @lifeguessr/data import:ndcp /tmp/NDCP2022.xlsx
pnpm --filter @lifeguessr/data refresh:offline
```

Optional env (names in `.env.example`): `BLS_KEY` (BLS API v2), `HUD_XLSX` + `HUD_FY` (a downloaded HUD workbook). A source that fails during a refresh keeps its previous cache entry, and the failure is written to the report. `test_refresh.py` fails if `out/areas.json` is not what the cache builds.

To move to a newer USDA month, replace the PDF and its `pdftotext -layout` extract in `sources/` (exactly one month is kept).

## Life cards: `cards/cards.json`

Hand-written, 60 cards: 50 daily + 2 creator packs of 5. A card is a `LifeCard` plus `slot` (1–5), its place in a day's set: 1 is easy (no kids, housing is the biggest cost) and 5 is a curveball (another category costs at least as much as housing: childcare, a car, or eating out). The loader strips `slot`, so consumers get plain `LifeCard`s. Costs are never stored: the engine's `costOfLife` computes them from the card and its area's real data.

- **Daily:** one pool of 10 per slot. `dailyCards(day)` takes the `(day mod 10)`-th card of each pool, so every day goes easy → curveball, uses 5 different metros, and the 50 cards cycle every 10 days. `day` is any integer day counter (e.g. `dayNumber` of the US Eastern date).
- **Packs:** `nyc-25` ("Guess the NYC 25-year-old", 5 NYC lives) and `city-swap` ("Your city vs mine": one household in 5 metros). They never enter the daily rotation.
- **Captions** contain no cost facts: no digits, prices or percentages (tested).

The loader throws at import on a schema error, a duplicate id, a card whose ZIP is missing from `out/areas.json` (or whose metro differs from its area's), a card with kids in an area without childcare data, or incomplete slots. `packages/engine/lifeCards.test.ts` costs every card with the engine (low ≤ mid ≤ high, all positive, mid inside the $1k–$15k guess slider) and checks the easy → curveball shape of every day.
