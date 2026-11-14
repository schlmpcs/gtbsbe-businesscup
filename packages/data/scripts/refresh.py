#!/usr/bin/env python3
"""T2 data pipeline: public data -> packages/data/out/areas.json (+ coverage report).

Two stages, so the app never calls a government API at run time (docs/DATA.md):

1. fetch (default; skipped with --offline): small read-only requests to the official sources.
   The raw values we use are stored, with their URL and retrieval time, in out/source-cache.json.
   A source that fails keeps its previous cache entry and the failure goes into the report.
2. build (always): out/areas.json and out/incomplete-data-report.json from the cache and the
   committed source extracts in sources/. Nothing is invented: a value we cannot source is
   either left out (optional fields) or the build fails loudly. Defaulted values carry
   isEstimate: true and say why in their Source name.

Sources (see packages/data/README.md for the provenance of each one):
  rent      HUD FY2026 Small Area FMRs (gross rent) from HUD's official eGIS open-data service.
            HUD_XLSX=/path/to/fyNNNN_safmrs.xlsx [HUD_FY=NNNN] uses a downloaded HUD workbook instead.
  range     Census ACS 2020-2024 5-year B25063 (gross rent distribution) per ZCTA, read through
            Census Reporter's API (api.census.gov blocks this network); B25064 as a cross-check.
  county    ZCTA -> county from Census Reporter's TIGER 2024 relationships (largest land share).
  childcare DOL NDCP county medians, 2022 (or the county's latest complete year), imported with
            import-ndcp.py, x 52/12, inflated with BLS CPI-U "day care and preschool" to the latest month.
  groceries USDA moderate-cost food plan (sources/CostofFood*.txt, extracted from the USDA PDF).
  gas       EIA weekly retail regular gasoline, the closest published area (city, state or PADD).
  cpi       BLS CPI-U 12-month change for the metro (Census region where BLS has no metro index).
  insurance NAIC Auto Insurance Database, combined average premium by state, 2023
            (sources/naic-*.txt), inflated with BLS CPI-U motor vehicle insurance. An estimate.

Usage (from the repo root):
  pnpm data:refresh                          fetch + build
  pnpm --filter @lifeguessr/data refresh:offline   build from the cache only
  python3 packages/data/scripts/import-ndcp.py /path/NDCP2022.xlsx   then refresh:offline
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import html
import io
import json
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

DATA = pathlib.Path(__file__).resolve().parents[1]
OUT = DATA / 'out'
SOURCES = DATA / 'sources'
CACHE_PATH = OUT / 'source-cache.json'
AREAS_PATH = OUT / 'areas.json'
REPORT_PATH = OUT / 'incomplete-data-report.json'

USER_AGENT = 'lifeguessr-data-refresh/1.0 (offline public-data pipeline)'
TIMEOUT = 40

TIERS = ('cheap', 'mid', 'expensive', 'suburb')

# ----- coverage: 15 metros x 4 ZIPs (cheap, mid, expensive, suburb) --------------------------
# Tiers are an editorial choice made when the ZIPs were picked (docs/DATA.md): the build checks
# that cheap < mid < expensive by HUD 2-bedroom rent, so a label can't contradict the data.
# `hud` must match the HUD FMR area the ZIP's SAFMR belongs to; `cpi` is a BLS CPI-U series;
# `gas` is the row label in EIA's weekly retail table.
METROS: list[dict] = [
    {'metro': 'New York, NY', 'state': 'NY', 'hud': 'New York, NY HUD Metro FMR Area',
     'cpi': ('CUURS12ASA0', 'New York-Newark-Jersey City'), 'gas': 'New York City',
     'zips': {'cheap': '10467', 'mid': '11385', 'expensive': '10013', 'suburb': '10801'}},
    {'metro': 'Los Angeles, CA', 'state': 'CA', 'hud': 'Los Angeles-Long Beach-Glendale, CA HUD Metro FMR Area',
     'cpi': ('CUURS49ASA0', 'Los Angeles-Long Beach-Anaheim'), 'gas': 'Los Angeles',
     'zips': {'cheap': '90011', 'mid': '90042', 'expensive': '90024', 'suburb': '91301'}},
    {'metro': 'Chicago, IL', 'state': 'IL', 'hud': 'Chicago-Joliet-Naperville, IL HUD Metro FMR Area',
     'cpi': ('CUURS23ASA0', 'Chicago-Naperville-Elgin'), 'gas': 'Chicago',
     'zips': {'cheap': '60621', 'mid': '60618', 'expensive': '60611', 'suburb': '60007'}},
    {'metro': 'Houston, TX', 'state': 'TX', 'hud': 'Houston-The Woodlands-Sugar Land, TX HUD Metro FMR Area',
     'cpi': ('CUURS37BSA0', 'Houston-The Woodlands-Sugar Land'), 'gas': 'Houston',
     'zips': {'cheap': '77033', 'mid': '77008', 'expensive': '77019', 'suburb': '77449'}},
    {'metro': 'Phoenix, AZ', 'state': 'AZ', 'hud': 'Phoenix-Mesa-Chandler, AZ MSA',
     'cpi': ('CUURS48ASA0', 'Phoenix-Mesa-Scottsdale'), 'gas': 'West Coast less California',
     'zips': {'cheap': '85009', 'mid': '85018', 'expensive': '85253', 'suburb': '85225'}},
    {'metro': 'Philadelphia, PA', 'state': 'PA', 'hud': 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD MSA',
     'cpi': ('CUURS12BSA0', 'Philadelphia-Camden-Wilmington'), 'gas': 'Central Atlantic (PADD 1B)',
     'zips': {'cheap': '19132', 'mid': '19125', 'expensive': '19103', 'suburb': '19020'}},
    {'metro': 'Dallas-Fort Worth, TX', 'state': 'TX', 'hud': 'Dallas, TX HUD Metro FMR Area',
     'cpi': ('CUURS37ASA0', 'Dallas-Fort Worth-Arlington'), 'gas': 'Texas',
     'zips': {'cheap': '75216', 'mid': '75206', 'expensive': '75205', 'suburb': '75024'}},
    {'metro': 'Austin, TX', 'state': 'TX', 'hud': 'Austin-Round Rock-San Marcos, TX MSA',
     'cpi': ('CUUR0300SA0', 'South region (BLS publishes no Austin index)'), 'gas': 'Texas',
     'zips': {'cheap': '78744', 'mid': '78704', 'expensive': '78703', 'suburb': '78660'}},
    {'metro': 'Atlanta, GA', 'state': 'GA', 'hud': 'Atlanta-Sandy Springs-Roswell, GA HUD Metro FMR Area',
     'cpi': ('CUURS35CSA0', 'Atlanta-Sandy Springs-Roswell'), 'gas': 'Lower Atlantic (PADD 1C)',
     'zips': {'cheap': '30315', 'mid': '30316', 'expensive': '30305', 'suburb': '30350'}},
    {'metro': 'Miami, FL', 'state': 'FL', 'hud': 'Miami-Miami Beach-Kendall, FL HUD Metro FMR Area',
     'cpi': ('CUURS35BSA0', 'Miami-Fort Lauderdale-West Palm Beach'), 'gas': 'Miami',
     'zips': {'cheap': '33142', 'mid': '33125', 'expensive': '33131', 'suburb': '33186'}},
    {'metro': 'Seattle, WA', 'state': 'WA', 'hud': 'Seattle-Bellevue, WA HUD Metro FMR Area',
     'cpi': ('CUURS49DSA0', 'Seattle-Tacoma-Bellevue'), 'gas': 'Seattle',
     'zips': {'cheap': '98118', 'mid': '98103', 'expensive': '98101', 'suburb': '98052'}},
    {'metro': 'Denver, CO', 'state': 'CO', 'hud': 'Denver-Aurora-Centennial, CO MSA',
     'cpi': ('CUURS48BSA0', 'Denver-Aurora-Lakewood'), 'gas': 'Denver',
     'zips': {'cheap': '80219', 'mid': '80205', 'expensive': '80202', 'suburb': '80013'}},
    {'metro': 'Boston, MA', 'state': 'MA', 'hud': 'Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area',
     'cpi': ('CUURS11ASA0', 'Boston-Cambridge-Newton'), 'gas': 'Boston',
     'zips': {'cheap': '02124', 'mid': '02130', 'expensive': '02116', 'suburb': '02184'}},
    {'metro': 'Nashville, TN', 'state': 'TN', 'hud': 'Nashville-Davidson--Murfreesboro--Franklin, TN HUD Metro FMR Area',
     'cpi': ('CUUR0300SA0', 'South region (BLS publishes no Nashville index)'), 'gas': 'Midwest (PADD 2)',
     'zips': {'cheap': '37207', 'mid': '37206', 'expensive': '37215', 'suburb': '37075'}},
    {'metro': 'Minneapolis-St. Paul, MN', 'state': 'MN', 'hud': 'Minneapolis-St. Paul-Bloomington, MN-WI HUD Metro FMR Area',
     'cpi': ('CUURS24ASA0', 'Minneapolis-St. Paul-Bloomington'), 'gas': 'Minnesota',
     'zips': {'cheap': '55411', 'mid': '55408', 'expensive': '55401', 'suburb': '55420'}},
]

STATE_NAMES = {
    'AZ': 'Arizona', 'CA': 'California', 'CO': 'Colorado', 'FL': 'Florida', 'GA': 'Georgia',
    'IL': 'Illinois', 'MA': 'Massachusetts', 'MN': 'Minnesota', 'NY': 'New York',
    'PA': 'Pennsylvania', 'TN': 'Tennessee', 'TX': 'Texas', 'WA': 'Washington',
}

# ----- source endpoints ----------------------------------------------------------------------

HUD_SAFMR_SERVICE = ('https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/'
                     'HUD_PDR_Small_Area_Fair_Market_Rents/FeatureServer')
HUD_SAFMR_ITEM = 'https://www.arcgis.com/sharing/rest/content/items/6458c67bad2a4cc7aa97514ef7ba8a0e'
HUD_SAFMR_PAGE = 'https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html'
CENSUS_REPORTER = 'https://api.censusreporter.org/1.0'
ACS_RELEASE = 'acs2024_5yr'
ACS_LABEL = 'ACS 2020-2024 5-year'
ACS_YEAR = 2024
TIGER_RELEASE = 'tiger2024'
BLS_API = 'https://api.bls.gov/publicAPI/v1/timeseries/data/'
BLS_SERIES_PAGE = 'https://data.bls.gov/timeseries/'
CPI_DAYCARE = 'CUUR0000SEEB03'     # CPI-U, day care and preschool, U.S. city average
CPI_INSURANCE = 'CUUR0000SETE'     # CPI-U, motor vehicle insurance, U.S. city average
EIA_GAS_TABLE = 'https://www.eia.gov/dnav/pet/pet_pri_gnd_a_epmr_pte_dpgal_w.htm'
EIA_SERIES = 'https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s={}&f=W'
NDCP_URL = 'https://www.dol.gov/sites/dolgov/files/WB/NDCP2022.xlsx'
NDCP_YEAR = 2022        # latest NDCP survey; a county without 2022 prices uses its latest complete year
BLS_START_YEAR = 2018   # covers the base year of every CPI adjustment (NDCP fallback years, NAIC 2023)
USDA_GLOB = 'CostofFood*LowModLib.txt'
USDA_URL = 'https://www.fns.usda.gov/sites/default/files/resource-files/{}'
NAIC_TEXT = 'naic-auto-insurance-database-2023-table5.txt'
NAIC_URL = 'https://content.naic.org/sites/default/files/publication-aut-pb-auto-insurance-database.pdf'
NAIC_YEAR = 2023

# Census Reporter B25063 columns 003..026: gross rent brackets for units paying cash rent.
B25063_BRACKETS = [
    (0, 100), (100, 150), (150, 200), (200, 250), (250, 300), (300, 350), (350, 400), (400, 450),
    (450, 500), (500, 550), (550, 600), (600, 650), (650, 700), (700, 750), (750, 800), (800, 900),
    (900, 1000), (1000, 1250), (1250, 1500), (1500, 2000), (2000, 2500), (2500, 3000), (3000, 3500),
    (3500, None),  # "$3,500 or more": open-ended, a quartile that lands here can't be interpolated
]
MIN_CASH_RENT_UNITS = 200   # below this, ZCTA quartiles are too noisy to use

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
          'October', 'November', 'December']


class SourceError(Exception):
    """A source responded with something we refuse to use (WAF page, wrong columns, ...)."""


# ----- small helpers -------------------------------------------------------------------------

def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def all_zips() -> list[str]:
    return [z for m in METROS for z in m['zips'].values()]


def http_get(url: str, *, expect_json: bool = False):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        body = res.read()
        status = res.status
    if status != 200 or not body:
        raise SourceError(f'HTTP {status} with an empty body from {url} (likely a WAF challenge)')
    if not expect_json:
        return body
    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        raise SourceError(f'non-JSON response from {url}: {body[:120]!r}') from e


def http_post_json(url: str, payload: dict):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST',
                                 headers={'User-Agent': USER_AGENT, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
        return json.loads(res.read())


def r2(x: float) -> float:
    return round(x, 2)


def month_name(period: str) -> str:
    return MONTHS[int(period[1:]) - 1]


# ----- HUD Small Area FMRs --------------------------------------------------------------------

def fetch_hud_safmr(zips: list[str]) -> dict:
    item = http_get(HUD_SAFMR_ITEM + '?f=json', expect_json=True)
    blob = json.dumps(item)
    years = sorted(set(int(y) for y in re.findall(r'Fiscal Year (20\d\d)', blob)))
    if len(years) != 1:
        raise SourceError(f'cannot tell the SAFMR fiscal year from the item metadata (found {years})')
    rows: dict[str, list[dict]] = {}
    for i in range(0, len(zips), 50):
        chunk = zips[i:i + 50]
        q = urllib.parse.urlencode({
            'where': 'ID IN (' + ','.join(f"'{z}'" for z in chunk) + ')',
            'outFields': 'ID,HUD_CODE,FMR_NAME,SAFMR_0BR,SAFMR_1BR,SAFMR_2BR,SAFMR_3BR,SAFMR_4BR',
            'f': 'json',
        })
        res = http_get(f'{HUD_SAFMR_SERVICE}/1/query?{q}', expect_json=True)
        if 'error' in res:
            raise SourceError(f"HUD SAFMR query failed: {res['error']}")
        for f in res['features']:
            a = f['attributes']
            rows.setdefault(a['ID'], []).append({
                'hudCode': a['HUD_CODE'], 'fmrName': a['FMR_NAME'],
                'rents': [a[f'SAFMR_{b}BR'] for b in range(5)],
            })
    return {
        'kind': 'arcgis', 'fiscalYear': years[0], 'url': HUD_SAFMR_SERVICE,
        'itemUrl': 'https://www.arcgis.com/home/item.html?id=6458c67bad2a4cc7aa97514ef7ba8a0e',
        'itemModified': item.get('modified'), 'retrievedAt': now_iso(), 'rows': rows,
    }


def parse_safmr_workbook(data: bytes) -> dict[str, list[float]]:
    """Read HUD's SAFMR workbook with the standard library: ZIP -> [0BR..4BR] base SAFMRs.

    Only the base SAFMR columns are accepted; payment-standard columns (90%/110%) are ignored,
    and a workbook whose columns we don't recognize is rejected instead of guessed at.
    """
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings = [''.join(n.itertext()) for n in root.findall('s:si', ns)]
        rows = []
        for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row', ns):
            cells = {}
            for c in row.findall('s:c', ns):
                col = ''.join(ch for ch in c.attrib['r'] if ch.isalpha())
                v = c.find('s:v', ns)
                inline = c.find('s:is', ns)
                val = v.text if v is not None else (''.join(inline.itertext()) if inline is not None else '')
                if c.attrib.get('t') == 's':
                    val = strings[int(val)]
                cells[col] = val or ''
            rows.append(cells)
    header = next((r for r in rows if any('zip' in v.lower() for v in r.values())), None)
    if header is None:
        raise SourceError('no header row with a ZIP column')
    zip_col = next(c for c, v in header.items() if 'zip' in v.lower())
    cols: dict[int, str] = {}
    for c, v in header.items():
        text = ' '.join(v.lower().split())
        if '%' in text or 'payment' in text:
            continue
        for b in range(5):
            if f'{b}br' in text.replace(' ', ''):
                cols[b] = c
    if len(cols) != 5:
        raise SourceError('unrecognized HUD columns; inspect the workbook instead of guessing')
    result = {}
    for row in rows:
        try:
            z = str(int(float(row.get(zip_col, '')))).zfill(5)
            rents = [float(row[cols[b]]) for b in range(5)]
        except (ValueError, KeyError):
            continue
        if all(r > 0 for r in rents):
            result[z] = rents
    if not result:
        raise SourceError('no valid ZIP rows in the HUD workbook')
    return result


def load_hud_workbook(path: str, fiscal_year: int, zips: list[str]) -> dict:
    raw = pathlib.Path(path).read_bytes()
    values = parse_safmr_workbook(raw)
    return {
        'kind': 'workbook', 'fiscalYear': fiscal_year,
        'url': f'https://www.huduser.gov/portal/datasets/fmr/fmr{fiscal_year}/fy{fiscal_year}_safmrs.xlsx',
        'sha256': hashlib.sha256(raw).hexdigest(), 'retrievedAt': now_iso(),
        'rows': {z: [{'hudCode': None, 'fmrName': None, 'rents': values[z]}] for z in zips if z in values},
    }


def hud_row_for(hud: dict, zipcode: str, fmr_area: str) -> dict:
    rows = hud['rows'].get(zipcode) or []
    if hud['kind'] == 'workbook':
        if len(rows) != 1:
            raise SourceError(f'ZIP {zipcode}: {len(rows)} rows in the HUD workbook')
        return rows[0]
    matching = [r for r in rows if r['fmrName'] == fmr_area]
    if len(matching) != 1:
        found = [r['fmrName'] for r in rows]
        raise SourceError(f'ZIP {zipcode}: expected one SAFMR row in "{fmr_area}", found {found}')
    return matching[0]


# ----- Census ACS (via Census Reporter) -------------------------------------------------------

def fetch_acs(zips: list[str]) -> dict:
    rows = {}
    for i in range(0, len(zips), 20):
        geo = ','.join('86000US' + z for z in zips[i:i + 20])
        url = f'{CENSUS_REPORTER}/data/show/{ACS_RELEASE}?table_ids=B25063,B25064&geo_ids={geo}'
        res = http_get(url, expect_json=True)
        if res.get('release', {}).get('id') != ACS_RELEASE:
            raise SourceError(f"unexpected ACS release {res.get('release')}")
        for geoid, tables in res['data'].items():
            est = tables['B25063']['estimate']
            rows[geoid.removeprefix('86000US')] = {
                'cashRentUnits': est['B25063002'],
                'brackets': [est[f'B25063{n:03d}'] for n in range(3, 27)],
                'medianGrossRent': tables['B25064']['estimate']['B25064001'],
            }
    return {'release': ACS_RELEASE, 'label': ACS_LABEL, 'year': ACS_YEAR,
            'url': f'{CENSUS_REPORTER}/data/show/{ACS_RELEASE}', 'retrievedAt': now_iso(), 'rows': rows}


def fetch_counties(zips: list[str]) -> dict:
    rows = {}
    for z in zips:
        res = http_get(f'{CENSUS_REPORTER}/geo/{TIGER_RELEASE}/86000US{z}/parents', expect_json=True)
        counties = [
            {'fips': p['geoid'].removeprefix('05000US'), 'name': p['display_name'], 'coverage': p['coverage']}
            for p in res['parents'] if p['relation'] == 'county'
        ]
        if not counties:
            raise SourceError(f'ZCTA {z}: no county in Census Reporter relationships')
        rows[z] = sorted(counties, key=lambda c: -c['coverage'])
    return {'release': TIGER_RELEASE, 'url': f'{CENSUS_REPORTER}/geo/{TIGER_RELEASE}', 'retrievedAt': now_iso(), 'rows': rows}


def rent_quantile(brackets: list[float], p: float) -> float | None:
    """Gross rent at quantile p by linear interpolation inside the bracket (Census's method).

    Returns None when the quantile falls in the open-ended top bracket.
    """
    total = sum(brackets)
    if total <= 0:
        return None
    target = p * total
    cum = 0.0
    for (lo, hi), count in zip(B25063_BRACKETS, brackets):
        if count > 0 and cum + count >= target:
            if hi is None:
                return None
            return lo + (target - cum) / count * (hi - lo)
        cum += count
    return None


def rent_range_ratio(acs_row: dict) -> tuple[dict | None, str | None, dict]:
    """(ratio, reason it is missing, diagnostics) for one ZCTA."""
    units = acs_row['cashRentUnits']
    q1, med, q3 = (rent_quantile(acs_row['brackets'], p) for p in (0.25, 0.5, 0.75))
    diag = {'cashRentUnits': units, 'q1': q1 and r2(q1), 'median': med and r2(med), 'q3': q3 and r2(q3),
            'publishedMedian': acs_row['medianGrossRent']}
    if units < MIN_CASH_RENT_UNITS:
        return None, f'only {units:.0f} renter units paying cash rent', diag
    if med is None or q1 is None:
        return None, 'median falls in the open-ended top bracket', diag
    if q3 is None:
        return None, 'third quartile falls in the open-ended "$3,500 or more" bracket', diag
    return {'low': round(q1 / med, 4), 'high': round(q3 / med, 4)}, None, diag


# ----- BLS ------------------------------------------------------------------------------------

def bls_series_ids() -> list[str]:
    ids = {m['cpi'][0] for m in METROS} | {CPI_DAYCARE, CPI_INSURANCE}
    return sorted(ids)


def fetch_bls(series: list[str]) -> dict:
    year = dt.date.today().year
    key = os.getenv('BLS_KEY')
    url = BLS_API.replace('/v1/', '/v2/') if key else BLS_API
    out = {}
    for i in range(0, len(series), 25):   # v1 (no key): 25 series and 10 years per request
        payload = {'seriesid': series[i:i + 25], 'startyear': str(BLS_START_YEAR), 'endyear': str(year)}
        if key:
            payload['registrationkey'] = key
        res = http_post_json(url, payload)
        if res.get('status') != 'REQUEST_SUCCEEDED':
            raise SourceError(f"BLS: {res.get('status')} {res.get('message')}")
        for s in res['Results']['series']:
            obs = [{'year': int(o['year']), 'period': o['period'], 'value': float(o['value'])}
                   for o in s['data'] if o['period'].startswith('M') and o['period'] != 'M13'
                   and o['value'] not in ('-', '')]
            if not obs:
                raise SourceError(f"BLS series {s['seriesID']} returned no observations")
            out[s['seriesID']] = sorted(obs, key=lambda o: (o['year'], o['period']), reverse=True)
    return {'url': BLS_API, 'retrievedAt': now_iso(), 'series': out}


def latest(obs: list[dict]) -> dict:
    return obs[0]   # sorted newest first


def yoy(obs: list[dict]) -> tuple[float, dict]:
    """12-month change for the newest month that has the same month a year earlier."""
    by_key = {(o['year'], o['period']): o['value'] for o in obs}
    for o in obs:
        prior = by_key.get((o['year'] - 1, o['period']))
        if prior:
            return o['value'] / prior - 1, o
    raise SourceError('no month with a year-earlier observation')


def annual_average(obs: list[dict], year: int) -> float:
    vals = [o['value'] for o in obs if o['year'] == year]
    if len(vals) < 12:
        raise SourceError(f'only {len(vals)} monthly observations for {year}')
    return sum(vals) / len(vals)


def inflation_factor(obs: list[dict], base_year: int) -> tuple[float, dict]:
    newest = latest(obs)
    return newest['value'] / annual_average(obs, base_year), newest


# ----- EIA gasoline ---------------------------------------------------------------------------

def parse_eia_table(page: str) -> dict:
    weeks = re.findall(r'<th class="Series5">\s*(\d\d/\d\d/\d\d)\s*</th>', page)
    if not weeks:
        raise SourceError('EIA table: no week columns')
    rows = {}
    # Each data row holds a nested stub table, so split on the row markers instead of matching </tr>.
    for block in page.split('<tr class="DataRow">')[1:]:
        name = re.search(r'class="DataStub1">(.*?)</td>', block, re.S)
        series = re.search(r's=(EMM_EPMR_PTE_[A-Z0-9]+_DPG)', block)
        values = re.findall(r'class="(?:DataB|Current2)">\s*([\d.]+|NA|W|-+)?\s*</td>', block)
        if name and series and values:
            label = ' '.join(html.unescape(re.sub(r'<[^>]+>', '', name.group(1))).split())
            rows[label] = {'series': series.group(1), 'values': values}
    if not rows:
        raise SourceError('EIA table: no data rows')
    return {'weeks': weeks, 'rows': rows}


def fetch_eia() -> dict:
    page = http_get(EIA_GAS_TABLE).decode('utf-8', 'replace')
    table = parse_eia_table(page)
    release = re.search(r'Release Date:\s*([\d/]+)', page)
    return {'url': EIA_GAS_TABLE, 'release': release.group(1) if release else None,
            'retrievedAt': now_iso(), **table}


def eia_label_key(label: str) -> str:
    return re.sub(r'\s+', '', label).lower()


def gas_for(eia: dict, area: str) -> tuple[float, str, str]:
    rows = {eia_label_key(k): v for k, v in eia['rows'].items()}
    row = rows.get(eia_label_key(area))
    if row is None:
        raise SourceError(f'EIA has no row "{area}"')
    for week, value in zip(reversed(eia['weeks']), reversed(row['values'])):
        try:
            v = float(value)
        except (TypeError, ValueError):
            continue
        m, d, y = week.split('/')
        return v, f'20{y}-{m}-{d}', row['series']
    raise SourceError(f'EIA row "{area}" has no numeric week')


# ----- committed source extracts (USDA, NAIC) ---------------------------------------------------

def usda_food_plan() -> dict:
    files = sorted(SOURCES.glob(USDA_GLOB))
    if len(files) != 1:
        raise SourceError(f'expected exactly one USDA food plan extract ({USDA_GLOB}) in {SOURCES}, found {len(files)}: '
                          'keep only the latest month (PDF + its pdftotext -layout extract)')
    path = files[0]
    text = path.read_text()
    title = re.search(r'U\.S\. Average,\s+(\w+) (20\d\d)', text)
    if not title:
        raise SourceError(f'{path.name}: no "U.S. Average, <Month> <Year>" title')
    month, year = title.group(1), int(title.group(2))
    section = None
    found: dict[str, float] = {}
    for line in text.splitlines():
        s = line.strip()
        if s.startswith(('Female:', 'Male:', 'Child:')):
            section = s[:-1]
        m = re.match(r'19-50 years\s+((?:\$[\d,.]+\s+){5}\$[\d,.]+)', s)
        if m and section in ('Female', 'Male'):
            nums = [float(x.replace(',', '')) for x in re.findall(r'\$([\d,.]+)', m.group(1))]
            found[section] = nums[3]     # moderate-cost plan, monthly
    if set(found) != {'Female', 'Male'}:
        raise SourceError(f'{path.name}: could not find both adult 19-50 rows')
    pdf_name = path.with_suffix('.pdf').name
    return {'month': month, 'year': year, 'female': found['Female'], 'male': found['Male'],
            'value': r2((found['Female'] + found['Male']) / 2), 'url': USDA_URL.format(pdf_name), 'file': path.name}


def naic_premiums() -> dict[str, float]:
    text = (SOURCES / NAIC_TEXT).read_text()
    out = {}
    for name in list(STATE_NAMES.values()) + ['Countrywide']:
        m = re.search(rf'^\s*{re.escape(name)}\s+([\d,]+\.\d\d)\s', text, re.M)
        if not m:
            raise SourceError(f'NAIC extract: no 2023 row for {name}')
        out[name] = float(m.group(1).replace(',', ''))
    return out


# ----- build ----------------------------------------------------------------------------------

def acs_median_check(coverage: list[dict]) -> str:
    """Our interpolated B25063 median vs the published B25064 median (both gross rent)."""
    diffs = [abs(c['acs']['median'] / c['acs']['publishedMedian'] - 1) for c in coverage
             if c.get('acs', {}).get('median') and c['acs'].get('publishedMedian')]
    if not diffs:
        return 'no ZCTA with both medians'
    return f'interpolated vs published B25064 median: max {max(diffs):.2%} apart over {len(diffs)} ZCTAs'


def sourced(value, source: dict, estimate: bool = False) -> dict:
    v = {'value': value, 'source': source}
    if estimate:
        v['isEstimate'] = True
    return v


def build(cache: dict, failures: list[dict]) -> tuple[list[dict], dict]:
    for key in ('hud', 'acs', 'counties', 'bls', 'eia'):
        if key not in cache:
            raise SourceError(f'source cache has no "{key}" entry; run a refresh with network access first')
    hud, acs, counties, bls, eia = (cache[k] for k in ('hud', 'acs', 'counties', 'bls', 'eia'))
    ndcp = cache.get('ndcp')
    usda = usda_food_plan()
    naic = naic_premiums()

    ins_factor, ins_month = inflation_factor(bls['series'][CPI_INSURANCE], NAIC_YEAR)
    ins_label = f"{month_name(ins_month['period'])} {ins_month['year']}"

    groceries = sourced(usda['value'], {
        'name': (f"USDA Moderate-Cost Food Plan, {usda['month']} {usda['year']}, U.S. average, "
                 f"mean of male and female age 19-50"),
        'year': usda['year'], 'url': usda['url'],
    })

    areas: list[dict] = []
    coverage: list[dict] = []
    for m in METROS:
        cpi_id, cpi_area = m['cpi']
        cpi_value, cpi_obs = yoy(bls['series'][cpi_id])
        cpi = sourced(round(cpi_value, 4), {
            'name': (f"BLS CPI-U, {cpi_area}, all items, 12 months ending "
                     f"{month_name(cpi_obs['period'])} {cpi_obs['year']}"),
            'year': cpi_obs['year'], 'url': BLS_SERIES_PAGE + cpi_id,
        })
        gas_value, gas_week, gas_series = gas_for(eia, m['gas'])
        gas = sourced(gas_value, {
            'name': f"EIA weekly retail price, regular gasoline, {m['gas']}, week of {gas_week}",
            'year': int(gas_week[:4]), 'url': EIA_SERIES.format(gas_series),
        })
        state_name = STATE_NAMES[m['state']]
        insurance = sourced(r2(naic[state_name] / 12 * ins_factor), {
            'name': (f"NAIC Auto Insurance Database, {state_name} combined average premium "
                     f"(liability + collision + comprehensive) {NAIC_YEAR}, per month, inflated to "
                     f"{ins_label} with BLS CPI-U motor vehicle insurance; a state average, not a quote"),
            'year': NAIC_YEAR, 'url': NAIC_URL,
        }, estimate=True)

        for tier in TIERS:
            z = m['zips'][tier]
            row = hud_row_for(hud, z, m['hud'])
            rents = row['rents']
            if any(r is None or r <= 0 for r in rents):
                raise SourceError(f'ZIP {z}: missing SAFMR values {rents}')
            area_label = row['fmrName'] or m['hud']
            rent_source = {
                'name': (f"HUD FY{hud['fiscalYear']} Small Area Fair Market Rent, ZIP {z}, {area_label} "
                         f"(40th-percentile gross rent: rent + utilities)"),
                'year': hud['fiscalYear'],
                'url': hud['itemUrl'] if hud['kind'] == 'arcgis' else hud['url'],
            }

            county = counties['rows'][z][0]
            county_name, _, county_state = county['name'].rpartition(', ')
            if county_state != m['state']:
                raise SourceError(f"ZIP {z}: county {county['name']} is not in {m['state']}")

            area = {
                'zip': z, 'metro': m['metro'], 'county': county_name, 'state': m['state'], 'tier': tier,
                'rentByBedrooms': {str(b): sourced(float(rents[b]), rent_source) for b in range(5)},
            }
            cov = {'zip': z, 'metro': m['metro'], 'tier': tier, 'county': county['name'],
                   'countyLandShare': round(county['coverage'], 2),
                   'rent': f"HUD FY{hud['fiscalYear']} SAFMR"}

            acs_row = acs['rows'].get(z)
            if acs_row is None:
                cov['rentRangeRatio'] = 'missing: no ACS row for this ZCTA'
            else:
                ratio, why, diag = rent_range_ratio(acs_row)
                cov['acs'] = diag
                if ratio:
                    area['rentRangeRatio'] = {**ratio, 'source': {
                        'name': (f"U.S. Census Bureau {acs['label']}, table B25063 gross rent distribution, "
                                 f"ZCTA {z}: first and third quartile / median (via Census Reporter)"),
                        'year': acs['year'],
                        'url': f"https://censusreporter.org/data/table/?table=B25063&geo_ids=86000US{z}",
                    }}
                    cov['rentRangeRatio'] = 'ACS B25063'
                else:
                    cov['rentRangeRatio'] = f'missing: {why} (the engine falls back to its estimate spread)'

            ndcp_row = (ndcp or {}).get('rows', {}).get(county['fips'])
            if ndcp_row and ndcp_row.get('weekly'):
                weekly, study_year = ndcp_row['weekly'], ndcp_row['year']
                factor, newest = inflation_factor(bls['series'][CPI_DAYCARE], study_year)
                newest_label = f"{month_name(newest['period'])} {newest['year']}"
                area['childcareMonthly'] = {
                    **{k: r2(weekly[k] * 52 / 12 * factor) for k in ('infant', 'toddler', 'preschool', 'schoolAge')},
                    'source': {
                        'name': (f"U.S. DOL Women's Bureau, National Database of Childcare Prices, "
                                 f"{county['name']}, {study_year} center-based weekly median x 52/12, "
                                 f"inflated from {study_year} to {newest_label} with BLS CPI-U day care and preschool"),
                        'year': study_year, 'url': NDCP_URL,
                    },
                }
                cov['childcare'] = f"NDCP {study_year} {county['name']}" + (
                    f" ({ndcp_row['note']})" if ndcp_row.get('note') else '')
            else:
                reason = (ndcp_row or {}).get('missing') or 'county not imported (run import-ndcp.py)'
                cov['childcare'] = f'missing: {reason}; cards with kids cannot use this ZIP'

            area.update({
                'groceriesPerAdult': groceries,
                'gasPerGallon': gas,
                'carInsuranceMonthly': insurance,
                'cpiYoY': cpi,
            })
            cov['gas'] = f"EIA {m['gas']}"
            cov['cpi'] = f'BLS {cpi_id} ({cpi_area})'
            cov['carInsurance'] = f'estimate: NAIC {NAIC_YEAR} {state_name} average, CPI-inflated'
            areas.append(area)
            coverage.append(cov)

        by_tier = {a['tier']: a['rentByBedrooms']['2']['value'] for a in areas if a['metro'] == m['metro']}
        if not by_tier['cheap'] < by_tier['mid'] < by_tier['expensive']:
            raise SourceError(f"{m['metro']}: tiers contradict HUD 2-bedroom rents {by_tier}")

    for a in areas:
        rents = [a['rentByBedrooms'][str(b)]['value'] for b in range(5)]
        if rents != sorted(rents):
            raise SourceError(f"ZIP {a['zip']}: rents do not rise with bedrooms {rents}")

    n = len(areas)
    with_ratio = sum('rentRangeRatio' in a for a in areas)
    with_childcare = sum('childcareMonthly' in a for a in areas)
    older_childcare = sorted({a['childcareMonthly']['source']['year'] for a in areas
                              if 'childcareMonthly' in a} - {NDCP_YEAR})
    older_childcare_zips = [a['zip'] for a in areas
                            if a.get('childcareMonthly', {}).get('source', {}).get('year', NDCP_YEAR) != NDCP_YEAR]
    split_counties = [f"{c['zip']} ({c['county']}, {c['countyLandShare']}% of land)"
                      for c in coverage if c['countyLandShare'] < 95]
    limits = [
        (f"Rents are HUD FY{hud['fiscalYear']} Small Area FMRs "
         + ("from HUD's eGIS open-data service; huduser.gov's workbooks sit behind a WAF challenge "
            "from this network (HUD_XLSX + HUD_FY use a downloaded workbook instead)."
            if hud['kind'] == 'arcgis' else 'from a downloaded HUD workbook.')),
        ('ACS quartiles are read through Census Reporter (a mirror of the Census API, which blocks '
         'this network). ZIP codes are treated as their ZCTA.'),
        ('Childcare uses the county with the largest share of the ZCTA\'s land'
         + (f"; split ZCTAs: {', '.join(split_counties)}" if split_counties else '') + '.'),
        'Groceries are a national USDA plan (no regional plan exists); gas and CPI are regional.',
        ('Car insurance is a state average premium (NAIC 2023, CPI-inflated), not a quote for a '
         'driver: isEstimate is true in every area.'),
        ('Engine constants (meal price, gallons per month, kid grocery factor) are assumptions in '
         'packages/engine/assumptions.ts, not data from this pipeline.'),
    ]
    if older_childcare:
        limits.insert(3, (f"NDCP {NDCP_YEAR} has no center-based prices for ZIPs {', '.join(older_childcare_zips)}; "
                          f"they use the county's latest complete survey year ({', '.join(map(str, older_childcare))}), "
                          f"inflated the same way and labeled with that year."))
    report = {
        'generatedAt': now_iso(),
        'areas': n,
        'metros': len(METROS),
        'complete': with_ratio == n and with_childcare == n and not failures,
        'summary': {
            'rentFromHud': f'{n}/{n} ZIPs (HUD FY{hud["fiscalYear"]} SAFMR, no estimated rents)',
            'rentRangeRatio': f'{with_ratio}/{n} ZIPs (others use the engine estimate spread)',
            'childcare': f'{with_childcare}/{n} ZIPs (others have no childcareMonthly)',
            'groceries': f"USDA {usda['month']} {usda['year']} (national)",
            'gas': 'EIA weekly by city / state / PADD',
            'cpi': 'BLS CPI-U by metro (South region for Austin and Nashville)',
            'carInsurance': f'{n}/{n} ZIPs, isEstimate: true (NAIC state average)',
            'acsMedianCrossCheck': acs_median_check(coverage),
        },
        'knownLimits': limits,
        'failures': failures,
        'coverage': coverage,
    }
    return areas, report


# ----- main -------------------------------------------------------------------------------------

def load_cache() -> dict:
    return json.loads(CACHE_PATH.read_text()) if CACHE_PATH.exists() else {}


def write_json(path: pathlib.Path, data) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def fetch_all(cache: dict, failures: list[dict]) -> None:
    zips = all_zips()
    steps = [
        ('hud', 'HUD Small Area FMRs',
         (lambda: load_hud_workbook(os.environ['HUD_XLSX'], int(os.environ.get('HUD_FY', '0')) or
                                    sys.exit('HUD_FY=<fiscal year> is required with HUD_XLSX'), zips))
         if os.getenv('HUD_XLSX') else (lambda: fetch_hud_safmr(zips))),
        ('acs', 'Census ACS B25063/B25064', lambda: fetch_acs(zips)),
        ('counties', 'ZCTA to county', lambda: fetch_counties(zips)),
        ('bls', 'BLS CPI-U', lambda: fetch_bls(bls_series_ids())),
        ('eia', 'EIA weekly gasoline', fetch_eia),
    ]
    for key, label, fetch in steps:
        try:
            cache[key] = fetch()
            print(f'  ok   {label}')
        except Exception as e:  # keep the previous cache entry and say so
            stale = cache.get(key, {}).get('retrievedAt')
            failures.append({'source': label, 'reason': f'{type(e).__name__}: {e}',
                             'usingCacheFrom': stale})
            print(f'  FAIL {label}: {e}' + (f' (using cache from {stale})' if stale else ''), file=sys.stderr)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    p.add_argument('--offline', action='store_true', help='build from out/source-cache.json only')
    args = p.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    cache = load_cache()
    failures: list[dict] = []
    if not args.offline:
        print('Fetching sources...')
        fetch_all(cache, failures)
        write_json(CACHE_PATH, cache)
    areas, report = build(cache, failures)
    write_json(AREAS_PATH, areas)
    write_json(REPORT_PATH, report)
    print(json.dumps({'areas': len(areas), **report['summary'],
                      'complete': report['complete']}, indent=2))


if __name__ == '__main__':
    main()
