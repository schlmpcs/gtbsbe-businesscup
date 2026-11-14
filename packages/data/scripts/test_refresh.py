#!/usr/bin/env python3
"""Tests for the data pipeline (standard library only, no network).

Run from the repo root:  pnpm --filter @lifeguessr/data test:py
"""
import importlib.util
import io
import json
import pathlib
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('refresh', pathlib.Path(__file__).with_name('refresh.py'))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'


def workbook(cells: list[list[str]]) -> bytes:
    """A minimal one-sheet xlsx with inline strings."""
    rows = []
    for r, row in enumerate(cells, start=1):
        cs = ''.join(
            f'<c r="{chr(65 + c)}{r}" t="inlineStr"><is><t>{v}</t></is></c>' for c, v in enumerate(row)
        )
        rows.append(f'<row r="{r}">{cs}</row>')
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as z:
        z.writestr('xl/worksheets/sheet1.xml', f'<worksheet xmlns="{NS}"><sheetData>{"".join(rows)}</sheetData></worksheet>')
    return stream.getvalue()


def brackets(**counts: float) -> list[float]:
    """B25063 bracket counts by lower bound, e.g. brackets(b1000=10, b1250=10)."""
    out = [0.0] * len(refresh.B25063_BRACKETS)
    for key, n in counts.items():
        lo = int(key[1:])
        out[[b[0] for b in refresh.B25063_BRACKETS].index(lo)] = n
    return out


class HudWorkbookTests(unittest.TestCase):
    def test_rejects_a_waf_page(self):
        with self.assertRaises(zipfile.BadZipFile):
            refresh.parse_safmr_workbook(b'<html>challenge</html>')

    def test_rejects_payment_standard_only_columns(self):
        data = workbook([['ZIP Code', 'SAFMR 1BR 90% Payment Standard', 'SAFMR 1BR 110% Payment Standard']])
        with self.assertRaises(refresh.SourceError):
            refresh.parse_safmr_workbook(data)

    def test_reads_base_columns_and_ignores_payment_standards(self):
        header = ['ZIP Code']
        for b in range(5):
            header += [f'SAFMR {b}BR', f'SAFMR {b}BR - 90% Payment Standard']
        row = ['75216']
        for b in range(5):
            row += [str(1000 + 100 * b), '1']
        values = refresh.parse_safmr_workbook(workbook([header, row]))
        self.assertEqual(values, {'75216': [1000.0, 1100.0, 1200.0, 1300.0, 1400.0]})

    def test_hud_row_must_match_the_metro_area(self):
        hud = {'kind': 'arcgis', 'rows': {'94558': [
            {'fmrName': 'Napa, CA MSA', 'rents': [1] * 5},
            {'fmrName': 'Santa Rosa, CA MSA', 'rents': [2] * 5},
        ]}}
        self.assertEqual(refresh.hud_row_for(hud, '94558', 'Santa Rosa, CA MSA')['rents'], [2] * 5)
        with self.assertRaises(refresh.SourceError):
            refresh.hud_row_for(hud, '94558', 'Vallejo, CA MSA')
        with self.assertRaises(refresh.SourceError):
            refresh.hud_row_for(hud, '00000', 'Napa, CA MSA')


class RentRangeTests(unittest.TestCase):
    def test_quantiles_interpolate_inside_the_bracket(self):
        # 100 units evenly in $1,000-$1,249 and 100 in $1,250-$1,499.
        b = brackets(b1000=100, b1250=100)
        self.assertAlmostEqual(refresh.rent_quantile(b, 0.25), 1125)
        self.assertAlmostEqual(refresh.rent_quantile(b, 0.5), 1250)
        self.assertAlmostEqual(refresh.rent_quantile(b, 0.75), 1375)

    def test_open_top_bracket_gives_no_quantile(self):
        b = brackets(b2000=100, b3500=300)
        self.assertIsNone(refresh.rent_quantile(b, 0.75))

    def test_ratio_is_quartiles_over_median(self):
        b = brackets(b1000=150, b1250=150)
        ratio, why, _ = refresh.rent_range_ratio({'cashRentUnits': 300, 'brackets': b, 'medianGrossRent': 1250})
        self.assertIsNone(why)
        self.assertEqual(ratio, {'low': round(1125 / 1250, 4), 'high': round(1375 / 1250, 4)})

    def test_ratio_refuses_small_samples_and_top_coded_quartiles(self):
        small = brackets(b1000=50, b1250=50)
        ratio, why, _ = refresh.rent_range_ratio({'cashRentUnits': 100, 'brackets': small, 'medianGrossRent': 1250})
        self.assertIsNone(ratio)
        self.assertIn('renter units', why)
        top = brackets(b3000=200, b3500=300)
        ratio, why, _ = refresh.rent_range_ratio({'cashRentUnits': 500, 'brackets': top, 'medianGrossRent': 3500})
        self.assertIsNone(ratio)
        self.assertIn('open-ended', why)


class BlsTests(unittest.TestCase):
    def obs(self, pairs):
        return sorted(({'year': y, 'period': p, 'value': v} for y, p, v in pairs),
                      key=lambda o: (o['year'], o['period']), reverse=True)

    def test_yoy_skips_months_without_a_prior_year(self):
        # Bimonthly metro series: Oct 2025 was never published, so Oct 2026 has no comparison.
        obs = self.obs([(2026, 'M10', 110.0), (2026, 'M09', 104.0), (2025, 'M09', 100.0), (2025, 'M08', 99.0)])
        value, month = refresh.yoy(obs)
        self.assertAlmostEqual(value, 0.04)
        self.assertEqual((month['year'], month['period']), (2026, 'M09'))

    def test_inflation_factor_needs_a_full_base_year(self):
        full = [(2022, f'M{m:02d}', 100.0) for m in range(1, 13)] + [(2026, 'M10', 125.0)]
        factor, newest = refresh.inflation_factor(self.obs(full), 2022)
        self.assertAlmostEqual(factor, 1.25)
        self.assertEqual(newest['period'], 'M10')
        with self.assertRaises(refresh.SourceError):
            refresh.inflation_factor(self.obs(full[1:]), 2022)


class EiaTests(unittest.TestCase):
    PAGE = '''
      <th class="Series5">11/02/26</th><th class="Series5">11/09/26</th>
      <tr class="DataRow"><td class="DataStub"><table><tr><td class="DataStub1">Texas</td></tr></table></td>
        <td width="76" class="DataB">3.578</td><td width="76" class="Current2">3.408</td>
        <td class="DataHist"><a href="./hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_STX_DPG&f=W">1990-2026</a></td></tr>
      <tr class="DataRow"><td class="DataStub"><table><tr><td class="DataStub1">Miami</td></tr></table></td>
        <td width="76" class="DataB">3.872</td><td width="76" class="Current2">NA</td>
        <td class="DataHist"><a href="./hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_YMIA_DPG&f=W">2003-2026</a></td></tr>
      </table>'''

    def test_latest_numeric_week_per_area(self):
        table = refresh.parse_eia_table(self.PAGE)
        self.assertEqual(refresh.gas_for(table, 'Texas'), (3.408, '2026-11-09', 'EMM_EPMR_PTE_STX_DPG'))
        # A withheld/NA latest week falls back to the newest published one.
        self.assertEqual(refresh.gas_for(table, 'Miami'), (3.872, '2026-11-02', 'EMM_EPMR_PTE_YMIA_DPG'))
        with self.assertRaises(refresh.SourceError):
            refresh.gas_for(table, 'Phoenix')


class CommittedSourcesTests(unittest.TestCase):
    def test_usda_extract(self):
        usda = refresh.usda_food_plan()
        self.assertEqual((usda['female'], usda['male']), (337.0, 398.9))
        self.assertEqual(usda['value'], 367.95)
        self.assertTrue(usda['url'].endswith('CostofFoodOct2026LowModLib.pdf'))

    def test_naic_extract(self):
        naic = refresh.naic_premiums()
        self.assertEqual(naic['Texas'], 1726.91)
        self.assertEqual(naic['New York'], 1895.99)
        self.assertEqual(set(naic) - {'Countrywide'}, set(refresh.STATE_NAMES.values()))


class OutputTests(unittest.TestCase):
    def test_committed_areas_are_what_the_cache_builds(self):
        areas, report = refresh.build(refresh.load_cache(), [])
        committed = json.loads(refresh.AREAS_PATH.read_text())
        self.assertEqual(areas, committed, 'out/areas.json is stale: run refresh.py --offline')
        self.assertEqual(report['areas'], 60)

    def test_coverage_is_15_metros_by_4_tiers(self):
        self.assertEqual(len(refresh.METROS), 15)
        for m in refresh.METROS:
            self.assertEqual(set(m['zips']), set(refresh.TIERS), m['metro'])
        self.assertEqual(len(set(refresh.all_zips())), 60)

    def test_every_value_has_a_source_and_estimates_say_so(self):
        for a in json.loads(refresh.AREAS_PATH.read_text()):
            sourced = [*a['rentByBedrooms'].values(), a['groceriesPerAdult'], a['gasPerGallon'],
                       a['carInsuranceMonthly'], a['cpiYoY']]
            for s in sourced:
                self.assertTrue(s['source']['url'].startswith('https://'), a['zip'])
                self.assertGreater(s['source']['year'], 2000)
            for rent in a['rentByBedrooms'].values():
                self.assertNotIn('isEstimate', rent)   # every rent is a HUD value, none defaulted
            self.assertTrue(a['carInsuranceMonthly']['isEstimate'])


if __name__ == '__main__':
    unittest.main()
