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

    def test_naic_homeowners_extract(self):
        premiums = refresh.naic_homeowners_premiums()
        self.assertEqual(premiums['Texas'], 2864)
        self.assertEqual(premiums['New York'], 1801)
        self.assertEqual(premiums['Countrywide'], 1737)
        self.assertEqual(len(premiums), 52)   # 50 states, DC and Countrywide

    def test_naic_extract(self):
        naic = refresh.naic_premiums()
        self.assertEqual(naic['Texas'], 1726.91)
        self.assertEqual(naic['New York'], 1895.99)
        self.assertEqual(set(naic) - {'Countrywide'}, set(refresh.STATE_NAMES.values()))


def acs_cell(estimate, moe):
    return {'estimate': estimate, 'moe': moe}


def owner_row(**overrides):
    """An ACS row with only the owner-side cells the home fields read."""
    row = {
        'ownerUnits': acs_cell(5000.0, 400.0),
        'B25077001': acs_cell(415200.0, 9000.0),
        'B25088002': acs_cell(2794.0, 216.0),
        'B25088003': acs_cell(950.0, 153.0),
        'B25082001': acs_cell(2_000_000_000.0, 1e8),
        'B25090001': acs_cell(20_000_000.0, 2e6),
    }
    row.update(overrides)
    return row


class HomeTests(unittest.TestCase):
    ACS = {'label': 'ACS 2020-2024 5-year', 'year': 2024}

    def test_measured_medians_are_used_as_published(self):
        self.assertEqual(refresh.acs_median(owner_row(), 'B25077001'), (415200.0, None))

    def test_top_coded_median_is_its_floor_and_an_estimate(self):
        row = owner_row(B25077001=acs_cell(2000001.0, None), B25088003=acs_cell(1501.0, None))
        fields, cov = refresh.home_from_acs('10013', self.ACS, row)
        self.assertEqual(fields['homeValueMedian']['value'], 2_000_000)
        self.assertTrue(fields['homeValueMedian']['isEstimate'])
        self.assertIn('$2,000,000 or more', fields['homeValueMedian']['source']['name'])
        self.assertEqual(fields['ownerCostsWithoutMortgageMonthly']['value'], 1500)
        self.assertNotIn('isEstimate', fields['ownerCostsWithMortgageMonthly'])
        self.assertIn('top-coded', cov['homeValueMedian'])

    def test_a_median_without_moe_that_is_not_a_top_code_is_refused(self):
        row = owner_row(B25088002=acs_cell(3999.0, None))
        fields, cov = refresh.home_from_acs('10013', self.ACS, row)
        self.assertNotIn('ownerCostsWithMortgageMonthly', fields)
        self.assertIn('missing', cov['ownerCostsWithMortgageMonthly'])

    def test_small_owner_samples_and_missing_rows_give_no_home_fields(self):
        fields, cov = refresh.home_from_acs('98101', self.ACS, owner_row(ownerUnits=acs_cell(150.0, 60.0)))
        self.assertEqual(fields, {})
        self.assertIn('150 owner-occupied units', cov['home'])
        self.assertEqual(refresh.home_from_acs('98101', self.ACS, None)[0], {})

    def test_property_tax_rate_is_aggregate_taxes_over_aggregate_value(self):
        rate, why, diag = refresh.property_tax_rate(owner_row())
        self.assertEqual(rate, 0.01)
        self.assertIsNone(why)
        self.assertEqual(diag['taxesRelativeMoe'], 0.1)
        with self.assertRaises(refresh.SourceError):   # 25% a year is a broken row, not a place
            refresh.property_tax_rate(owner_row(B25090001=acs_cell(500_000_000.0, 1.0)))
        rate, why, _ = refresh.property_tax_rate(owner_row(B25082001=acs_cell(None, None)))
        self.assertIsNone(rate)

    def test_fhfa_file_and_annualized_change(self):
        text = ('cbsa\tmetro_name\tyr\tqtr\tindex_nsa\tindex_sa\r\n'
                '35614\t"New York-Jersey City-White Plains, NY-NJ (MSAD)"\t1996\t2\t100.00\t100.50\r\n'
                '35614\t"New York-Jersey City-White Plains, NY-NJ (MSAD)"\t2026\t1\t390.00\t391.00\r\n'
                '35614\t"New York-Jersey City-White Plains, NY-NJ (MSAD)"\t2026\t2\t400.00\t401.00\r\n'
                '10580\t"Albany-Schenectady-Troy, NY"\t2026\t2\t300.00\t300.00\r\n')
        places = refresh.parse_fhfa_po_metro(text, {'35614'})
        self.assertEqual(set(places), {'35614'})
        self.assertEqual(places['35614']['name'], 'New York-Jersey City-White Plains, NY-NJ (MSAD)')
        rate, end = refresh.annualized_change(places['35614']['quarters'], 30)
        self.assertAlmostEqual(rate, 4 ** (1 / 30) - 1)   # same quarter at both ends: 1996 Q2 -> 2026 Q2
        self.assertEqual(end, (2026, 2))
        self.assertIsNone(refresh.annualized_change(places['35614']['quarters'], 10))
        with self.assertRaises(refresh.SourceError):
            refresh.parse_fhfa_po_metro('cbsa,metro_name\n', {'35614'})

    def test_split_metros_use_their_division(self):
        omb = refresh.omb_delineation()
        self.assertEqual(refresh.hpi_place('42017', omb)[0], '33874')   # Bucks: Montgomery-Bucks-Chester
        self.assertEqual(refresh.hpi_place('42101', omb)[0], '37964')   # Philadelphia County
        self.assertEqual(refresh.hpi_place('48085', omb)[0], '19124')   # Collin: Dallas-Plano-Irving
        self.assertEqual(refresh.hpi_place('48453', omb), ('12420', 'Austin-Round Rock-San Marcos, TX'))
        with self.assertRaises(refresh.SourceError):
            refresh.hpi_place('99999', omb)

    def test_appreciation_refuses_an_fhfa_area_named_differently_from_omb(self):
        omb = refresh.omb_delineation()
        fhfa = {'places': {'33874': {'name': 'Somewhere Else, PA (MSAD)', 'quarters': {'1996Q2': 1.0, '2026Q2': 2.0}}}}
        with self.assertRaises(refresh.SourceError):
            refresh.home_appreciation(fhfa, '42017', omb)
        value, note = refresh.home_appreciation({'places': {}}, '42017', omb)
        self.assertIsNone(value)
        self.assertIn('missing', note)


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

    def test_home_values_are_sourced_and_estimates_say_why(self):
        for a in json.loads(refresh.AREAS_PATH.read_text()):
            for field in ('homeValueMedian', 'ownerCostsWithMortgageMonthly', 'ownerCostsWithoutMortgageMonthly',
                          'propertyTaxRate', 'homeInsuranceMonthly', 'homeAppreciationAnnual'):
                v = a[field]
                self.assertTrue(v['source']['url'].startswith('https://'), (a['zip'], field))
                if field in ('homeInsuranceMonthly', 'homeAppreciationAnnual'):
                    self.assertTrue(v['isEstimate'], (a['zip'], field))   # defaults, never measured here
                elif v.get('isEstimate'):
                    self.assertIn('top-coded', v['source']['name'], (a['zip'], field))
            self.assertLess(a['propertyTaxRate']['value'], 0.04)   # a decimal per year, never a percent
            self.assertLess(a['homeAppreciationAnnual']['value'], 0.15)
            self.assertGreater(a['ownerCostsWithMortgageMonthly']['value'], a['ownerCostsWithoutMortgageMonthly']['value'])


if __name__ == '__main__':
    unittest.main()
