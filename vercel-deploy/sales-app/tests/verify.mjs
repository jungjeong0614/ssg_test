import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { REQUIRED, REPORT_HEADERS, normalizeWorkbook, deduplicate, filterRows, summarize, createReportWorkbook, importFiles } from '../src/data.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = path.join(root, 'A_매출비교');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'results/verification-baseline.json'), 'utf8'));
const results = [];
const test = async (name, fn) => { try { await fn(); results.push({ name, pass: true }); console.log(`PASS ${name}`); } catch (e) {results.push({name, pass:false, error:e.stack}); console.error(`FAIL ${name}: ${e.message}`);} };
const sourceNames = fs.readdirSync(folder).filter(f=>/^0[123]_.*\.xlsx$/.test(f)).sort();
const books = sourceNames.map(name=>XLSX.read(fs.readFileSync(path.join(folder,name)),{type:'buffer'}));
const normalized = books.map((book,i)=>normalizeWorkbook(book,sourceNames[i]));
const all = normalized.flatMap(item=>item.rows);
const workbook = aoa => {const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'원본'); return wb;};
const input = (book,name) => new File([XLSX.write(book,{type:'buffer',bookType:'xlsx'})],name);
const sheetValues = wb => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null});
await test('Three original workbooks normalize to 480 unique rows with twelve required fields',()=>{
  assert.equal(REQUIRED.length,12);
  normalized.forEach(r=>{assert.deepEqual(r.errors,[]);assert.equal(r.rows.length,160);r.rows.forEach(row=>REQUIRED.forEach(field=>assert.ok(Object.hasOwn(row,field),field)));});
  assert.equal(all.length,480); assert.equal(new Set(all.map(r=>r.record_id)).size,480);
});
await test('Totals independently match Python openpyxl baseline, amounts remain 만원',()=>{
 const total=summarize(all);
 for(const field of ['sales','goal','cost','achievement']) assert.equal(total[field],baseline.totals[field]);
 normalized.forEach((r,i)=>{const total=summarize(r.rows);for(const key of ['sales','goal','cost'])assert.equal(total[key],baseline.files[i][key]);});
 assert.equal(all[1]['매출_만원'],470);
});
await test('Headers are matched by name when all source columns are reversed',()=>{
 books.forEach((book,i)=>{
   const values=XLSX.utils.sheet_to_json(book.Sheets['원본'],{header:1,defval:null}).map(r=>[...r].reverse());
   const reordered=normalizeWorkbook(workbook(values),sourceNames[i]);
   assert.deepEqual(reordered.errors,[]);
   reordered.rows.forEach((row,j)=>REQUIRED.forEach(key=>assert.deepEqual(row[key],normalized[i].rows[j][key])));
 });
});
await test('Source provenance retained and duplicate record IDs counted once',()=>{
 all.forEach(row=>assert.ok(row['출처']));
 const result=deduplicate([...all,...normalized[0].rows]);
 assert.equal(result.rows.length,480);assert.equal(result.duplicates.length,160);
 assert.equal(summarize(result.rows).sales,baseline.totals.sales);
 assert.equal(result.rows[0],all[0]);
 const diagnostics=JSON.stringify(result.duplicates);
 assert.ok(diagnostics.includes(sourceNames[0]));assert.ok(diagnostics.includes('2'));
});
await test('Store, channel, week and search filters select one consistent row set; reset returns all',()=>{
 const filters={store:all[1]['점포'],channel:all[1]['채널'],week:all[1]['기준주'],query:all[1]['브랜드']};
 const selected=filterRows(all,filters);
 const expected=all.filter(r=>r['점포']===filters.store&&r['채널']===filters.channel&&r['기준주']===filters.week&&r['브랜드'].includes(filters.query));
 assert.deepEqual(selected.map(r=>r.record_id),expected.map(r=>r.record_id));assert.ok(selected.length>0);
 assert.equal(filterRows(all,{}).length,480);
 assert.equal(filterRows(all,{query:'definitely absent 5340'}).length,0);
 const total=summarize(selected);assert.equal(total.sales,selected.reduce((n,r)=>n+r['매출_만원'],0));
 const report=sheetValues(createReportWorkbook(selected));assert.equal(report.length,selected.length+1);
 assert.deepEqual(report.slice(1).map(r=>r[0]),selected.map(r=>r.record_id));
});
await test('Report matches actual 04 template, calculations, note keyed by ID and zero-goal blank',()=>{
 assert.deepEqual(REPORT_HEADERS,baseline.reportHeaders);
 const notes={[all[1].record_id]:'검사 메모 / record_id 연결'};
 const values=sheetValues(createReportWorkbook(all,notes));
 assert.deepEqual(values[0],baseline.reportHeaders);assert.equal(values.length,481);
 const index=Object.fromEntries(values[0].map((key,i)=>[key,i]));
 for(let i=0;i<all.length;i++){
  const r=all[i], out=values[i+1];
  assert.equal(out[index['매출_만원']],r['매출_만원']);
  assert.equal(out[index['목표차이_만원']],r['매출_만원']-r['목표_만원']);
  assert.equal(out[index['비용차감액_만원']],r['매출_만원']-r['비용_만원']);
  if(r['목표_만원']===0) assert.ok(out[index['달성률']]==null||out[index['달성률']]==='');
  else assert.equal(out[index['달성률']],r['매출_만원']/r['목표_만원']);
 }
 assert.equal(values[2][index['메모']],notes[all[1].record_id]);
});
await test('Report XLSX saved under results and successfully read with data and note',()=>{
 const selected=filterRows(all,{store:all[1]['점포'],channel:all[1]['채널'],week:all[1]['기준주']});
 const notes={[selected[0].record_id]:'새 파일 저장 확인'};
 const report=createReportWorkbook(selected,notes);
 const save=path.join(root,'results/verification-filtered-report.xlsx');
 fs.writeFileSync(save,XLSX.write(report,{type:'buffer',bookType:'xlsx'}));
 const read=sheetValues(XLSX.read(fs.readFileSync(save),{type:'buffer'}));
 assert.equal(read.length,selected.length+1);assert.deepEqual(read[0],baseline.reportHeaders);
 assert.equal(read[1][13],notes[selected[0].record_id]);
 assert.equal(read.slice(1).reduce((sum,row)=>sum+row[6],0),summarize(selected).sales);
});
await test('05 missing goal error preserves 480 previously imported rows',async()=>{
 const filename=fs.readdirSync(folder).find(f=>/^05_/.test(f));
 const file=new File([fs.readFileSync(path.join(folder,filename))],filename);
 const result=await importFiles([file],all);
 assert.equal(result.rows.length,480);assert.equal(summarize(result.rows).sales,baseline.totals.sales);
 const diagnostics=JSON.stringify(result.errors);assert.ok(result.errors.length>0);assert.ok(diagnostics.includes(filename));assert.ok(diagnostics.includes('목표'));
});
await test('Channel mismatch includes filename and Excel row and preserves prior valid rows',async()=>{
 const values=XLSX.utils.sheet_to_json(books[0].Sheets['원본'],{header:1,defval:null});
 values[1][values[0].indexOf('채널')]='온라인';
 const result=await importFiles([input(workbook(values),sourceNames[0])],all);
 assert.equal(result.rows.length,480);assert.equal(summarize(result.rows).sales,baseline.totals.sales);
 const diagnostics=JSON.stringify(result.errors);assert.ok(diagnostics.includes(sourceNames[0]));assert.ok(diagnostics.includes('2'));assert.ok(result.errors.length>0);
});
await test('Re-importing the same original prevents double counting with useful duplicate diagnostics',async()=>{
 const result=await importFiles([input(books[0],sourceNames[0])],all);
 assert.equal(result.rows.length,480);assert.equal(result.duplicates.length,160);assert.equal(summarize(result.rows).sales,baseline.totals.sales);
 assert.ok(JSON.stringify(result.duplicates).includes(sourceNames[0]));
});
await test('No-data or zero-total-goal summary returns no ratio, not zero percent',()=>{
 const zero=summarize(all.filter(r=>r['목표_만원']===0));
 assert.ok(zero.achievement==null);assert.ok(summarize([]).achievement==null);
});
await test('Blank goal preserves missing value and exports blank achievement and goal difference',()=>{
 const values=XLSX.utils.sheet_to_json(books[0].Sheets['원본'],{header:1,defval:null});
 values[1][values[0].indexOf('목표_만원')]=null;
 const result=normalizeWorkbook(workbook(values),sourceNames[0]);
 assert.deepEqual(result.errors,[]);assert.equal(result.rows[0]['목표_만원'],null);
 assert.equal(summarize(result.rows).achievement,null);
 const report=sheetValues(createReportWorkbook(result.rows));
 assert.equal(report[1][7],null);assert.equal(report[1][8],null);assert.equal(report[1][9],null);
});
await test('Invalid numeric value gives file and row diagnostics and rejects incoming batch',async()=>{
 const values=XLSX.utils.sheet_to_json(books[0].Sheets['원본'],{header:1,defval:null});
 values[1][values[0].indexOf('매출_만원')]='숫자 아님';
 const result=await importFiles([input(workbook(values),sourceNames[0])],all);
 assert.equal(result.rows,all);assert.ok(result.errors.length);
 const error=JSON.stringify(result.errors);assert.ok(error.includes(sourceNames[0]));assert.ok(error.includes('2행'));assert.ok(error.includes('매출_만원'));
});
await test('Every normalized row has exact input file and physical spreadsheet row provenance',()=>{
 normalized.forEach((result,i)=>result.rows.forEach((row,j)=>{assert.equal(row._sourceFile,sourceNames[i]);assert.equal(row._sourceRow,j+2);}));
 const result=deduplicate([all[0],{...all[0],_sourceFile:'시험입력.xlsx',_sourceRow:99}]);
 assert.deepEqual(result.duplicates,[{id:all[0].record_id,firstFile:sourceNames[0],firstRow:2,file:'시험입력.xlsx',row:99}]);
});
fs.writeFileSync(path.join(root,'results/verification-tests.json'),JSON.stringify({date:new Date().toISOString(),passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
