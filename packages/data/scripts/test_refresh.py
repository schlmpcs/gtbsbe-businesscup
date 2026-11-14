import importlib.util,io,json,pathlib,unittest,zipfile
spec=importlib.util.spec_from_file_location('refresh',pathlib.Path(__file__).with_name('refresh.py'));refresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(refresh)
class RefreshTests(unittest.TestCase):
 def test_rejects_invalid_workbook(self):
  with self.assertRaises(zipfile.BadZipFile):refresh.workbook(b'WAF challenge')
 def test_rejects_payment_standard_only(self):
  ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';stream=io.BytesIO()
  with zipfile.ZipFile(stream,'w') as z:
   z.writestr('xl/worksheets/sheet1.xml',f'<worksheet xmlns="{ns}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>ZIP Code</t></is></c><c r="B1" t="inlineStr"><is><t>SAFMR 1BR 90% Payment Standard</t></is></c></row></sheetData></worksheet>')
  with self.assertRaises(ValueError):refresh.workbook(stream.getvalue())
 def test_embedded_matches_canonical(self):
  for name in ['areas.json','cards.json']:
   self.assertEqual((refresh.OUT/name).read_bytes(),(refresh.ROOT/'services/api/internal/catalog/data'/name).read_bytes())
 def test_estimates_never_claim_hud(self):
  for area in json.loads((refresh.OUT/'areas.json').read_text()):
   for rent in area['rentByBedrooms'].values():
    if rent['isEstimate']:self.assertNotIn('HUD',rent['source']['name'])
if __name__=='__main__':unittest.main()
