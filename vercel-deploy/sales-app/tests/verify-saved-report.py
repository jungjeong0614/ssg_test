from pathlib import Path
import openpyxl,json
root=Path(__file__).resolve().parents[2]
path=root/'results/verification-filtered-report.xlsx'
wb=openpyxl.load_workbook(path,read_only=True,data_only=True)
rows=list(wb.active.values)
assert len(rows)==11,len(rows)
assert len(rows[0])==16
assert rows[1][13]=='새 파일 저장 확인'
assert rows[1][9] is None, rows[1]
source=openpyxl.load_workbook(root/'A_매출비교/01_영업실적.xlsx',read_only=True,data_only=True)
source_rows=list(source['원본'].values)
source_headers=source_rows[0]
expected=[dict(zip(source_headers,row)) for row in source_rows[1:] if row[source_headers.index('점포')]==rows[1][3] and row[source_headers.index('기준주')]==source_rows[1][source_headers.index('기준주')]]
assert len(expected)==10
assert sum(row[6] for row in rows[1:])==sum(row['매출_만원'] for row in expected)
source.close()
for row in rows[1:]:
    assert row[8]==row[6]-row[7]
    assert row[11]==row[6]-row[10]
    assert row[9] is None if row[7]==0 else abs(row[9]-row[6]/row[7])<1e-12
wb.close()
summary={'savedFile':str(path),'rows':len(rows)-1,'columns':len(rows[0]),'sales':sum(row[6] for row in rows[1:]),'goal':sum(row[7] for row in rows[1:]),'noteVerified':True,'zeroGoalBlank':True,'calculationsVerified':True}
(root/'results/verification-saved-file.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
