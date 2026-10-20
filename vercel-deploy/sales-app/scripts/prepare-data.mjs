import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORT_HEADERS } from '../src/data.js';
import {readEducationalFixture} from './build-inputs.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
{
  const data=await readEducationalFixture(appRoot,'sales.json');
  if(data.rows.length!==480||new Set(data.rows.map(r=>r.record_id)).size!==480||JSON.stringify(data.headers)!==JSON.stringify(REPORT_HEADERS))throw new Error('교육용 매출 데이터 행 수·ID·보고양식 오류');
  await fs.mkdir(path.join(appRoot,'public/data'),{recursive:true});
  await fs.writeFile(path.join(appRoot,'public/data/sales.json'),JSON.stringify(data,null,2),'utf8');
  console.log('원본 파일 없음: 검증된 교육용 배포 데이터 480행 사용');
}
