#!/usr/bin/env python3
"""Import selected 2022 county rows from the official DOL workbook, no third-party libraries.
Usage: python3 import-ndcp.py /path/NDCP2022.xlsx
Prices are weekly nominal 2022 USD; refresh converts to monthly and CPI-adjusts.
"""
import hashlib,json,pathlib,sys,zipfile,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[3]
areas=json.loads((ROOT/'packages/data/out/areas.json').read_text());wanted={(a['state'],a['county']) for a in areas}
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};raw=pathlib.Path(sys.argv[1]).read_bytes();rows={}
with zipfile.ZipFile(__import__('io').BytesIO(raw)) as z:
 ss=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
 for _,r in ET.iterparse(z.open('xl/worksheets/sheet1.xml'),events=('end',)):
  if not r.tag.endswith('}row'):continue
  cells={}
  for c in r.findall('s:c',ns):
   col=''.join(x for x in c.attrib['r'] if x.isalpha())
   if col not in ('A','B','C','D','E','HL','HN','HP','EL'):continue
   v=c.find('s:v',ns);v=v.text if v is not None else ''
   cells[col]=ss[int(v)] if c.attrib.get('t')=='s' else v
  if cells.get('E')=='2022':
   county=cells.get('C','').replace(' County','').replace(' Parish','');key=(cells.get('B'),county)
   if key in wanted:
    prices={k:float(cells[col]) for k,col in [('infant','HL'),('toddler','HN'),('preschool','HP'),('schoolAge','EL')] if cells.get(col) not in (None,'','-9','-1')}
    if len(prices)==4 and all(v>0 for v in prices.values()):rows['|'.join(key)]={'weekly':prices,'countyFIPS':cells['D'].zfill(5),'year':2022}
  r.clear()
p=ROOT/'packages/data/out/source-cache.json';cache=json.loads(p.read_text());cache['ndcp']={'url':'https://www.dol.gov/sites/dolgov/files/WB/NDCP2022.xlsx','sha256':hashlib.sha256(raw).hexdigest(),'rows':rows};p.write_text(json.dumps(cache,indent=2)+'\n');print('Imported',len(rows),'counties of',len(wanted))
