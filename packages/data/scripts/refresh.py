#!/usr/bin/env python3
"""Offline refresh. Never call government APIs from the running application.
HUD_XLSX may point at the unmodified official SAFMR workbook if WAF blocks download.
Use import-ndcp.py to import selected official county rows from the DOL workbook.
--offline regenerates from committed source cache, without network calls.
"""
import argparse,datetime,hashlib,json,os,pathlib,urllib.request,zipfile,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[3]
OUT=ROOT/'packages/data/out'; OUT.mkdir(parents=True,exist_ok=True)
METROS=[('New York','NY','New York',['10002','10001','10013','10467'],3000),('Los Angeles','CA','Los Angeles',['90011','90012','90024','91301'],2500),('Chicago','IL','Cook',['60621','60618','60611','60007'],1700),('Houston','TX','Harris',['77033','77008','77019','77449'],1450),('Phoenix','AZ','Maricopa',['85009','85016','85018','85225'],1600),('Philadelphia','PA','Philadelphia',['19132','19104','19103','19020'],1700),('Dallas','TX','Dallas',['75216','75204','75205','75040'],1600),('Austin','TX','Travis',['78744','78704','78703','78660'],1800),('Atlanta','GA','Fulton',['30315','30308','30327','30350'],1650),('Miami','FL','Miami-Dade',['33142','33125','33131','33186'],2400),('Seattle','WA','King',['98118','98103','98101','98052'],2300),('Denver','CO','Denver',['80219','80203','80206','80013'],1950),('Boston','MA','Suffolk',['02124','02125','02116','02184'],2900),('Nashville','TN','Davidson',['37208','37206','37215','37013'],1750),('Minneapolis','MN','Hennepin',['55411','55408','55403','55420'],1500)]
TIERS=['cheap','mid','expensive','suburb']
HUD_URL='https://www.huduser.gov/portal/datasets/fmr/fmr2026/fy2026_safmrs.xlsx'
ASSUMPTION={'name':'Illustrative planning assumption; not a government measurement','year':2026,'url':'https://github.com/schlmpcs/gtbsbe-businesscup/blob/main/packages/data/README.md'}
def read_url(url):
 with urllib.request.urlopen(url,timeout=25) as r:
  data=r.read()
  if not data: raise ValueError('empty response (possible WAF challenge)')
  return data

def workbook(data):
 """Read official workbook using stdlib; identify base SAFMR, never payment-standard columns."""
 with zipfile.ZipFile(__import__('io').BytesIO(data)) as z:
  ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   strings=[''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
  rows=[]
  for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:row',ns):
   cells={}
   for c in row.findall('s:c',ns):
    col=''.join(x for x in c.attrib['r'] if x.isalpha());v=c.find('s:v',ns)
    val=v.text if v is not None else ''.join(c.find('s:is',ns).itertext()) if c.find('s:is',ns) is not None else ''
    if c.attrib.get('t')=='s':val=strings[int(val)]
    cells[col]=val
   rows.append(cells)
  header=next((r for r in rows if any('zip' in v.lower() for v in r.values())),{})
  zipcol=next((c for c,v in header.items() if 'zip' in v.lower()),None)
  cols={}
  for c,v in header.items():
   text=' '.join(v.lower().split())
   for br in range(5):
    if ('% ' not in text and '%' not in text and 'payment' not in text and (str(br)+'br' in text.replace(' ',''))):cols[br]=c
  if zipcol is None or len(cols)!=5:raise ValueError('unrecognized HUD columns; inspect workbook instead of guessing')
  result={}
  for row in rows:
   try:
    zipcode=str(int(float(row.get(zipcol,'')))).zfill(5)
    values={str(br):float(row[c]) for br,c in cols.items()}
    if all(v>0 for v in values.values()):result[zipcode]=values
   except (ValueError,KeyError):pass
  if not result:raise ValueError('no valid ZIP rows')
  return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--offline',action='store_true');args=p.parse_args()
 cachepath=OUT/'source-cache.json';cache=json.loads(cachepath.read_text()) if cachepath.exists() else {}
 report={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'complete':False,'failures':[],'sources':[]}
 if not args.offline:
  for key,series in [('gas','APU000074714'),('cpi','CUUR0000SA0')]:
   url='https://api.bls.gov/publicAPI/v1/timeseries/data/'+series
   try:
    payload=json.loads(read_url(url));observations=payload['Results']['series'][0]['data'];cache[key]={'url':url,'observations':observations}
   except Exception as e:report['failures'].append({'source':key,'reason':str(e)})
  try:
   raw=pathlib.Path(os.environ['HUD_XLSX']).read_bytes() if os.getenv('HUD_XLSX') else read_url(HUD_URL)
   cache['hud']={'url':HUD_URL,'year':2026,'values':workbook(raw),'sha256':hashlib.sha256(raw).hexdigest()}
  except Exception as e:report['failures'].append({'source':'HUD SAFMR','reason':str(e)})
  try:
   url='https://api.census.gov/data/2024/acs/acs5?get=NAME,B25064_001E&for=zip%20code%20tabulation%20area:10001'
   json.loads(read_url(url));report['sources'].append({'name':'Census availability check','url':url})
  except Exception as e:report['failures'].append({'source':'Census ACS rent ranges','reason':str(e)})
 cachepath.write_text(json.dumps(cache,indent=2)+'\n')
 gas=cache.get('gas');cpi=cache.get('cpi');hud=cache.get('hud')
 report['sources'] += [{'name':name,'url':entry.get('url','')} for name,entry in cache.items()]
 if not hud:report['failures'].append({'source':'HUD SAFMR','reason':'No verified HUD rows cached; downloads returned an empty WAF challenge. Every rent value is illustrative.'})
 def value(v,source=ASSUMPTION,estimate=True):return {'value':v,'source':source,'isEstimate':estimate}
 gas_value=value(3.5)
 if gas:
  obs=next(x for x in gas['observations'] if x['period']!='M13' and x['value'] not in ('-',''));gas_value=value(float(obs['value']),{'name':'BLS national gasoline average, '+obs['periodName'],'year':int(obs['year']),'url':gas['url']},False)
 cpi_value=value(.03)
 if cpi:
  observations=[x for x in cpi['observations'] if x['period']!='M13' and x['value'] not in ('-','')]
  for current in observations:
   prior=next((x for x in observations if int(x['year'])==int(current['year'])-1 and x['period']==current['period']),None)
   if prior:
    cpi_value=value(float(current['value'])/float(prior['value'])-1,{'name':'BLS CPI-U year-over-year, '+current['periodName'],'year':int(current['year']),'url':cpi['url']},False)
    break
 areas=[]
 for metro,state,county,zips,base in METROS:
  for i,zipcode in enumerate(zips):
   rents={str(br):value(round(base*[.72,1,1.22,1.5,1.8][br]*[.8,1,1.3,1.05][i]/10)*10) for br in range(5)}
   if hud and zipcode in hud['values']:rents={br:value(v,{'name':'HUD FY2026 Small Area Fair Market Rent, gross rent','year':2026,'url':HUD_URL},False) for br,v in hud['values'][zipcode].items()}
   county_name={'10467':'Bronx','19020':'Bucks','80013':'Arapahoe','02184':'Norfolk'}.get(zipcode,county)
   childcare={'infant':1500,'toddler':1250,'preschool':1000,'schoolAge':650,'source':ASSUMPTION,'isEstimate':True}
   ndcp=cache.get('ndcp',{}).get('rows',{}).get(state+'|'+county_name)
   basepath=OUT/'cpi-base2022.json'
   if ndcp and cpi and basepath.exists():
    baseobs=json.loads(basepath.read_text())['Results']['series'][0]['data'];basevals=[float(x['value']) for x in baseobs if x['period']!='M13' and x['value'] not in ('-','')]
    latest=next(x for x in cpi['observations'] if x['period']!='M13' and x['value'] not in ('-',''))
    factor=float(latest['value'])/(sum(basevals)/len(basevals))
    childcare={k:v*52/12*factor for k,v in ndcp['weekly'].items()}
    childcare.update(source={'name':'DOL NDCP county center-based weekly medians, survey 2022; monthly conversion and CPI-U adjusted to '+latest['periodName']+' '+latest['year']+' (ZIP county assignment estimated)','year':2022,'url':cache['ndcp']['url']},isEstimate=True)
   areas.append({'zip':zipcode,'metro':metro,'state':state,'county':{'10467':'Bronx','19020':'Bucks','80013':'Arapahoe','02184':'Norfolk'}.get(zipcode,county),'tier':TIERS[i],'rentByBedrooms':rents,'groceriesPerAdult':value(cache['usda']['value'],{'name':'USDA September 2026 moderate food plan; adult sex-average, four-person-household basis (model estimate)','year':2026,'url':cache['usda']['url']},True) if 'usda' in cache else value(360),'gasPerGallon':gas_value,'carInsuranceMonthly':value(165),'cpiYoY':cpi_value,'childcareMonthly':childcare})
 cards=[]
 for i in range(50):
  area=areas[(i*7)%len(areas)];kids=[[],['infant'],['preschool'],['schoolAge','toddler']][i%4]
  card={'id':f'life-{i+1:03}','zip':area['zip'],'metro':area['metro'],'adults':1+i%2,'kids':kids,'bedrooms':min(4,(i//4)%5),'eatingOutPerWeek':[0,2,4,7][i%4],'caption':['A quiet start to the week.','A home with a busy calendar.','Someone has just moved in.','Room for another chapter.'][i%4]}
  if i%5:card['car']={'price':[18000,32000,52000][i%3],'downPayment':4000,'apr':.069,'termMonths':60}
  if i<20:card['pack']='coastal-lives' if i<10 else 'family-lives'
  cards.append(card)
 for name,data in [('areas',areas),('cards',cards)]:
  text=json.dumps(data,indent=2)+'\n';(OUT/(name+'.json')).write_text(text);(ROOT/'services/api/internal/catalog/data'/(name+'.json')).write_text(text)
 report['failures'] += [{'source':'DOL county childcare / HUD crosswalk','reason':'County records imported where available; ZIP-county crosswalk unverified, all values remain estimates'},{'source':'State car insurance','reason':'No verified source; illustrative national assumption marked estimate'},{'source':'Census rent ranges','reason':'Not normalized; engine uses explicitly estimated range fallback'}]
 report['sourcedChildcareZIPs']=sum(a['childcareMonthly']['source']['year']==2022 for a in areas)
 report['verifiedRentZIPs']=sum(not a['rentByBedrooms']['0']['isEstimate'] for a in areas)
 report['estimatedRentZIPs']=len(areas)-report['verifiedRentZIPs'];report['complete']=not report['failures'] and report['estimatedRentZIPs']==0
 (OUT/'incomplete-data-report.json').write_text(json.dumps(report,indent=2)+'\n')
 fixtures=ROOT/'packages/data/fixtures';fixtures.mkdir(exist_ok=True)
 (fixtures/'areaData.sample.json').write_text(json.dumps(areas[:3],indent=2)+'\n');(fixtures/'cards.sample.json').write_text(json.dumps([dict(cards[i],zip=areas[i]['zip'],metro=areas[i]['metro']) for i in range(3)],indent=2)+'\n')
 profile={'age':{'value':32,'isEstimate':False},'takeHomePay':{'value':5500,'isEstimate':False},'spending':{k:{'value':v,'isEstimate':True} for k,v in {'rentUtilities':1800,'car':240,'childcare':0,'groceries':420,'eatingOut':260,'subscriptions':85,'debtPayments':200,'other':300}.items()},'cash':{'value':8000,'isEstimate':False},'retirement':{'value':20000,'isEstimate':False},'retirementShare':{'value':.15,'isEstimate':True},'debts':[{'id':'card-1','kind':'card','balance':4500,'apr':.228,'minPayment':{'value':200,'isEstimate':False}}],'zip':'60618','doneMoveIds':[]}
 loans=[{'amount':28000,'apr':.069,'termMonths':36},{'amount':28000,'apr':.079,'termMonths':48},{'amount':28000,'apr':.089,'termMonths':60,'fees':400}]
 for name,data in [('profile.demo',profile),('loanOffers.sample',loans)]:
  text=json.dumps(data,indent=2)+'\n';(fixtures/(name+'.json')).write_text(text);(ROOT/'services/api/internal/catalog/data'/(name+'.json')).write_text(text)
 print(json.dumps({'areas':len(areas),'cards':len(cards),'verifiedRentZIPs':report['verifiedRentZIPs'],'complete':report['complete']}))
if __name__=='__main__':main()
