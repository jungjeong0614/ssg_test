import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readEducationalFixture} from './build-inputs.mjs';
const app = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, app), 'utf8');
{
  const data=await readEducationalFixture(fileURLToPath(app),'operations.json');
  const sample=await readEducationalFixture(fileURLToPath(app),'weather-sample.json');
  if(data.rows.length!==72||new Set(data.rows.map(r=>r.task_id)).size!==72||data.asOf!=='2026-10-20')throw new Error('교육용 운영 데이터 행 수·ID·기준일 오류');
  await fs.mkdir(new URL('public/data/',app),{recursive:true});await fs.mkdir(new URL('server/data/',app),{recursive:true});
  await fs.writeFile(new URL('public/data/operations.json',app),JSON.stringify(data,null,2));
  await fs.writeFile(new URL('public/data/weather-sample.json',app),JSON.stringify(sample,null,2));
  await fs.writeFile(new URL('server/data/weather-sample.json',app),JSON.stringify(sample,null,2));
  console.log('원본 파일 없음: 검증된 교육용 운영 72건·브리프·날씨 예제 사용');
}
