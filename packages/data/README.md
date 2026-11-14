# Offline public data and illustrative fallback

Run `python3 packages/data/scripts/refresh.py` from the repository root, or `pnpm --filter @lifeguessr/data refresh`. `--offline` regenerates normalized data and embedded Go snapshots from the committed source cache. The running API makes no government data calls.

The catalog covers 60 deliberately selected ZIPs in 15 metros. Tier labels are editorial selections, not measured neighborhood rankings. The 50 fictional household cards are deterministic and include two creator packs (`coastal-lives`, `family-lives`). Captions contain no hidden cost facts.

## What is verified

- BLS national gasoline price (`APU000074714`): latest numeric monthly observation, with observation year/month in its source.
- BLS CPI-U (`CUUR0000SA0`): year-over-year change for the latest numeric observation with a matching prior-year observation.
- USDA September 2026 moderate-cost food plan: female/male adults 19–50 monthly values $336.40/$398.40. The catalog's $367.40 is their arithmetic mean. USDA figures apply to individuals in four-person households; our simplified household model has no sex mix or USDA household-size adjustment, so this remains an estimate for a specific adult. Original PDF and extracted text are under `sources/`.

- DOL NDCP2022 workbook: 17 selected county rows, 2022 weekly center-based medians (`MCINFANT`, `MCTODDLER`, `MCPRESCHOOL`, `MCSA`). Multiply by 52/12, then adjust by latest BLS CPI-U / arithmetic mean of 12 monthly 2022 CPI-U observations. Survey and adjustment years are both labeled. Selected source rows and original workbook SHA-256 are retained in `out/source-cache.json`; base CPI observations in `out/cpi-base2022.json`.

To reimport childcare, download `https://www.dol.gov/sites/dolgov/files/WB/NDCP2022.xlsx` (about 92 MB), run `python3 packages/data/scripts/import-ndcp.py /path/NDCP2022.xlsx`, then regenerate with `refresh.py --offline`. Requires only Python standard-library XML/ZIP support.

## What remains illustrative

Read `out/incomplete-data-report.json` before claiming real-data completeness. HUD downloads currently return an empty WAF challenge and Census requests are blocked from this environment. Rent by ZIP and bedroom is therefore an **illustrative planning assumption**, not a claimed HUD value. State insurance and unverified local rent ranges are also estimates. Childcare uses verified DOL county rows for 56 ZIPs; four Pennsylvania ZIPs use illustrative fallbacks. ZIP-to-county assignment is manually curated rather than verified against the HUD crosswalk, so every childcare value remains tagged as an estimate. Every such number is explicitly marked; source names do not misrepresent these as government measurements.

To replace rent estimates, download the unmodified official FY2026 SAFMR workbook and run `HUD_XLSX=/absolute/path/fy2026_safmrs.xlsx python3 packages/data/scripts/refresh.py`. The parser selects base SAFMR columns and rejects payment-standard columns. Unrecognized spreadsheets fail visibly. `out/source-cache.json` records selected official rows and a workbook SHA-256.

Fixtures are synthetic, non-personal samples. `statement.sample.csv` uses positive outflows; `statement.debit-credit.csv` has separate columns; `statement.signed-bank.csv` uses bank-style negative outflows and requires sign selection. They are format tests, not real customer exports. No actual bank statements or provider secrets are committed.

`out/areas.json` and `out/cards.json` are offline server inputs. Copies under `services/api/internal/catalog/data` are generated for Go embedding. Never import either file into browser code: cards contain game answers. Only public/revealed projections may cross the API boundary.

## Verification

```
python3 packages/data/scripts/test_refresh.py
go test ./services/api/internal/catalog
```

The pipeline tests reject WAF bodies and payment-standard-only workbooks, ensure embedded data matches canonical outputs, and prevent illustrative rents from claiming HUD provenance. Catalog tests validate ZIP/card/metro/pack coverage, deterministic clue projection, public answer exclusion, and clue-to-cost-line consistency for every card.
