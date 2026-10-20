from pathlib import Path
import json, hashlib
import openpyxl
root = Path(__file__).resolve().parents[2]
a = root / 'A_매출비교'
canonical = ['record_id','기준주','점포','브랜드','장르','채널','매출_만원','목표_만원','비용_만원','상태','출처','기준일']
aliases = [canonical,['레코드ID','주차','점포명','브랜드명','카테고리','유통채널','실적(만원)','목표매출(만원)','집行비용(만원)','진행상태','근거자료','확인일'],['기록번호','주간기준일','영업점','행사브랜드','상품군','판매채널','매출액_만원','목표액_만원','사용비용_만원','진행현황','자료출처','기준일자']]
aliases[1][8] = '집행비용(만원)'
result = {'files': [], 'totals': {'rows':0,'sales':0,'goal':0,'cost':0},'ids': [],'reportHeaders':None}
for i, path in enumerate(sorted(a.glob('0[1-3]_*.xlsx'))):
    wb = openpyxl.load_workbook(path,read_only=True,data_only=True)
    values = iter(wb['원본'].values)
    headers = list(next(values))
    maps = {field:headers.index(alias) for field,alias in zip(canonical, aliases[i])}
    rows = [{field:r[pos] for field,pos in maps.items()} for r in values if any(v is not None for v in r)]
    item = {'filename':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':len(rows),'sales':sum(r['매출_만원'] or 0 for r in rows),'goal':sum(r['목표_만원'] or 0 for r in rows),'cost':sum(r['비용_만원'] or 0 for r in rows),'zeroGoalRows':sum(r['목표_만원']==0 for r in rows)}
    result['files'].append(item)
    for key in ('sales','goal','cost'): result['totals'][key] += item[key]
    result['totals']['rows'] += len(rows)
    result['ids'] += [r['record_id'] for r in rows]
    wb.close()
result['uniqueIds'] = len(set(result.pop('ids')))
result['totals']['achievement'] = result['totals']['sales']/result['totals']['goal']
wb = openpyxl.load_workbook(a / '04_보고양식.xlsx',read_only=True,data_only=True)
result['reportHeaders'] = list(next(wb.active.values))
wb.close()
output = root/'results/verification-baseline.json'
if output.exists():
    previous = json.loads(output.read_text(encoding='utf-8'))
    assert previous['files'] == result['files'], 'Original baseline changed'
output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
