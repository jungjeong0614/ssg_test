import fs from 'node:fs/promises';
import * as XLSX from 'xlsx/xlsx.mjs';
import {fileURLToPath} from 'node:url';
import {originalInputsAvailable,readEducationalFixture} from './build-inputs.mjs';
const app = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, app), 'utf8');
const paths=['../C_행사준비/08_행사준비.csv','../B_팝업오픈/07_팝업브리프.md','../D_화면과연결/11_날씨응답_예제.json'].map(name=>fileURLToPath(new URL(name,app)));
const useOriginals=await originalInputsAvailable(paths);
if(!useOriginals){
  const data=await readEducationalFixture(fileURLToPath(app),'operations.json');
  const sample=await readEducationalFixture(fileURLToPath(app),'weather-sample.json');
  if(data.rows.length!==72||new Set(data.rows.map(r=>r.task_id)).size!==72||data.asOf!=='2026-10-20')throw new Error('교육용 운영 데이터 행 수·ID·기준일 오류');
  await fs.mkdir(new URL('public/data/',app),{recursive:true});await fs.mkdir(new URL('server/data/',app),{recursive:true});
  await fs.writeFile(new URL('public/data/operations.json',app),JSON.stringify(data,null,2));
  await fs.writeFile(new URL('public/data/weather-sample.json',app),JSON.stringify(sample,null,2));
  await fs.writeFile(new URL('server/data/weather-sample.json',app),JSON.stringify(sample,null,2));
  console.log('원본 파일 없음: 검증된 교육용 운영 72건·브리프·날씨 예제 사용');
}else{
const csv = await read('../C_행사준비/08_행사준비.csv');
const wb = XLSX.read(csv.replace(/^\uFEFF/,''), {type:'string', raw:true});
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
if(rows.length!==72 || new Set(rows.map(r=>r.task_id)).size!==72) throw new Error('준비표 행 수 또는 task_id 오류');
if(rows.some(r=>r.점검기준일!=='2026-10-20')) throw new Error('준비표 기준일 불일치');
const brief = await read('../B_팝업오픈/07_팝업브리프.md');
const conditions = brief.split('\n').filter(l=>l.startsWith('| ')).map(l=>l.split('|').slice(1,-1).map(x=>x.trim())).filter(([k])=>!['항목','---'].includes(k));
const periodText=conditions.find(([k])=>k==='기간')?.[1]||'';
const periodMatch=/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*?~\s*(\d{1,2})월\s*(\d{1,2})일/.exec(periodText);
if(!periodMatch)throw new Error('브리프 행사 기간을 읽지 못했습니다.');
const [,year,month,day,endMonth,endDay]=periodMatch;
const iso=(y,m,d)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const eventPeriod={start:iso(year,month,day),end:iso(Number(year)+(Number(endMonth)<Number(month)?1:0),endMonth,endDay)};
const sample = await read('../D_화면과연결/11_날씨응답_예제.json');
await fs.mkdir(new URL('public/data/',app),{recursive:true});
await fs.mkdir(new URL('server/data/',app),{recursive:true});
await fs.writeFile(new URL('public/data/operations.json',app),JSON.stringify({asOf:'2026-10-20',eventPeriod,rows,conditions,sources:['B_팝업오픈/07_팝업브리프.md','C_행사준비/08_행사준비.csv']},null,2));
await fs.writeFile(new URL('server/data/weather-sample.json',app),sample);
await fs.writeFile(new URL('public/data/weather-sample.json',app),sample);
console.log(`운영 자료 준비: ${rows.length}건, 브리프 ${conditions.length}항목, 서버 날씨 예제`);
}
