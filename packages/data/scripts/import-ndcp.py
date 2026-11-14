#!/usr/bin/env python3
"""Import county childcare prices from the DOL National Database of Childcare Prices workbook.

Usage (from the repo root, after a `pnpm data:refresh` so the ZIP -> county map is cached):
  curl -o /tmp/NDCP2022.xlsx https://www.dol.gov/sites/dolgov/files/WB/NDCP2022.xlsx   (~92 MB)
  python3 packages/data/scripts/import-ndcp.py /tmp/NDCP2022.xlsx
  pnpm --filter @lifeguessr/data refresh:offline

Streams the workbook with the standard library (about 30 s, one core) and keeps, for each county
our ZIPs belong to (matched by county FIPS, not by name), the weekly center-based medians
MCINFANT / MCTODDLER / MCPRESCHOOL / MCSA in nominal dollars of the study year. It takes the
latest study year in which all four prices are published (2022 for most counties); a county with
no complete year is stored with the reason, never filled in. Columns are found by header name,
so a reordered workbook can't shift values silently. refresh.py turns the prices into monthly
ones (x 52/12) and inflates them from the study year to today with BLS CPI-U.
"""
from __future__ import annotations

import hashlib
import importlib.util
import pathlib
import sys
import xml.etree.ElementTree as ET
import zipfile

spec = importlib.util.spec_from_file_location('refresh', pathlib.Path(__file__).with_name('refresh.py'))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
PRICE_COLUMNS = {'infant': 'MCINFANT', 'toddler': 'MCTODDLER', 'preschool': 'MCPRESCHOOL', 'schoolAge': 'MCSA'}
KEY_COLUMNS = ('STATE_ABBREVIATION', 'COUNTY_NAME', 'COUNTY_FIPS_CODE', 'STUDYYEAR')


def col_of(ref: str) -> str:
    return ''.join(ch for ch in ref if ch.isalpha())


def read_rows(path: pathlib.Path, wanted_fips: set[str]) -> dict[str, dict[int, dict]]:
    """FIPS -> study year -> {'state', 'county', 'weekly'?, 'missing'?} for the wanted counties."""
    out: dict[str, dict[int, dict]] = {}
    with zipfile.ZipFile(path) as z:
        strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(NS + 'si')]
        columns: dict[str, str] | None = None   # column letter -> header name (only those we need)
        for _, el in ET.iterparse(z.open('xl/worksheets/sheet1.xml'), events=('end',)):
            if el.tag != NS + 'row':
                continue
            cells = {}
            for c in el.iter(NS + 'c'):
                col = col_of(c.get('r', ''))
                if columns is not None and col not in columns:
                    continue
                v = c.find(NS + 'v')
                val = v.text if v is not None else ''
                if c.get('t') == 's' and val:
                    val = strings[int(val)]
                cells[col] = val or ''
            el.clear()
            if columns is None:
                needed = set(KEY_COLUMNS) | set(PRICE_COLUMNS.values())
                columns = {col: name for col, name in cells.items() if name in needed}
                missing = needed - set(columns.values())
                if missing:
                    raise SystemExit(f'NDCP workbook has no column(s) {sorted(missing)}; refusing to guess')
                continue
            row = {columns[col]: val for col, val in cells.items()}
            fips = row.get('COUNTY_FIPS_CODE', '').split('.')[0].zfill(5)
            if fips not in wanted_fips:
                continue
            year = int(float(row['STUDYYEAR']))
            weekly, missing = {}, []
            for key, name in PRICE_COLUMNS.items():
                try:
                    value = float(row.get(name, ''))
                except ValueError:
                    value = -1
                if value > 0:
                    weekly[key] = value
                else:
                    missing.append(name)
            entry = {'state': row['STATE_ABBREVIATION'], 'county': row['COUNTY_NAME']}
            if missing:
                entry['missing'] = missing
            else:
                entry['weekly'] = weekly
            out.setdefault(fips, {})[year] = entry
    return out


def choose(fips: str, years: dict[int, dict]) -> dict:
    """The latest complete study year for one county, or the reason there is none."""
    complete = sorted((y for y, e in years.items() if 'weekly' in e), reverse=True)
    newest = max(years) if years else None
    if not complete:
        where = f"{years[newest]['county']}, {years[newest]['state']}" if newest else f'county FIPS {fips}'
        return {'missing': f'NDCP publishes no complete center-based prices for {where} in any study year'}
    year = complete[0]
    entry = {**years[year], 'year': year}
    if newest and year != newest:
        entry['note'] = f'{newest} lacks {", ".join(years[newest].get("missing", []))}; latest complete year is {year}'
    return entry


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    path = pathlib.Path(sys.argv[1])
    cache = refresh.load_cache()
    counties = cache.get('counties', {}).get('rows')
    if not counties:
        raise SystemExit('No ZIP -> county map in out/source-cache.json: run `pnpm data:refresh` first.')
    wanted = {rows[0]['fips'] for rows in counties.values()}
    found = read_rows(path, wanted)
    rows = {fips: choose(fips, found.get(fips, {})) for fips in sorted(wanted)}
    cache['ndcp'] = {
        'url': refresh.NDCP_URL,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'importedAt': refresh.now_iso(),
        'rows': rows,
    }
    refresh.write_json(refresh.CACHE_PATH, cache)
    ok = sum('weekly' in r for r in rows.values())
    print(f'Imported {ok} of {len(wanted)} counties from {path.name}')
    for fips, r in rows.items():
        if 'missing' in r or 'note' in r:
            print(f"  {fips}: {r.get('missing') or r['note']}")


if __name__ == '__main__':
    main()
