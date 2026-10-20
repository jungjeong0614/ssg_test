import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Fall back only when all original inputs are absent. Partial inputs are errors.
export async function originalInputsAvailable(paths){
  const present=await Promise.all(paths.map(async file=>{try{await fs.access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}));
  if(present.every(Boolean))return true;
  if(present.some(Boolean))throw new Error(`원본 입력이 일부만 있습니다. 누락: ${paths.filter((_,i)=>!present[i]).map(file=>path.basename(file)).join(', ')}`);
  return false;
}
export async function readEducationalFixture(appRoot,name){
  const root=path.join(appRoot,'fixtures/educational');
  const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
  if(manifest.classification!=='교육용 가상 데이터')throw new Error('교육용 데이터 분류를 확인할 수 없습니다.');
  const content=await fs.readFile(path.join(root,name));
  const hash=createHash('sha256').update(content).digest('hex');
  if(!manifest.files[name]||manifest.files[name]!==hash)throw new Error(`교육용 배포 데이터 검증 실패: ${name}`);
  return JSON.parse(content.toString('utf8'));
}
