import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {originalInputsAvailable,readEducationalFixture} from '../scripts/build-inputs.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const app=path.join(root,'sales-app');
const clean=path.join(root,'results',`vercel-clean-${Date.now()}`);
const target=path.join(clean,'sales-app');
fs.mkdirSync(target,{recursive:true});
for(const name of ['package.json','vercel.json','api'])fs.cpSync(path.join(root,name),path.join(clean,name),{recursive:true});
for(const name of ['src','scripts','fixtures','server','vite.config.js','package.json','package-lock.json','index.html'])fs.cpSync(path.join(app,name),path.join(target,name),{recursive:true,filter:source=>source!==path.join(app,'server/data')});
fs.symlinkSync(path.join(app,'node_modules'),path.join(target,'node_modules'),process.platform==='win32'?'junction':'dir');
assert.ok(!fs.existsSync(path.join(clean,'A_매출비교')));
assert.ok(!fs.existsSync(path.join(clean,'.env.local')));
const npm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const build=spawnSync(process.execPath,[npm,'run','build'],{cwd:clean,encoding:'utf8'});
process.stdout.write(build.stdout||'');process.stderr.write(build.stderr||'');
assert.equal(build.status,0,'원본 없는 환경에서 빌드가 성공해야 합니다.');
const sales=JSON.parse(fs.readFileSync(path.join(target,'dist/data/sales.json')));
const tasks=JSON.parse(fs.readFileSync(path.join(target,'dist/data/operations.json')));
assert.equal(sales.rows.length,480);assert.equal(new Set(sales.rows.map(r=>r.record_id)).size,480);
assert.equal(sales.rows.reduce((sum,r)=>sum+r.매출_만원,0),385287);
assert.equal(sales.rows.reduce((sum,r)=>sum+r.목표_만원,0),386120);
assert.equal(tasks.rows.length,72);assert.equal(tasks.rows.filter(r=>!['완료','취소'].includes(r.상태)).length,42);
assert.equal(tasks.rows.filter(r=>r.담당역할==='마케팅 담당'&&!['완료','취소'].includes(r.상태)).length,7);
assert.equal(sales.headers.length,16);
await assert.rejects(originalInputsAvailable([path.join(target,'index.html'),path.join(clean,'missing-original.xlsx')]),/일부만/);
const fixturePath=path.join(target,'fixtures/educational/sales.json'),original=fs.readFileSync(fixturePath);
try{fs.writeFileSync(fixturePath,'{}');await assert.rejects(readEducationalFixture(target,'sales.json'),/검증 실패/);}finally{fs.writeFileSync(fixturePath,original);}
const previous=process.env.OPENWEATHER_API_KEY;delete process.env.OPENWEATHER_API_KEY;
let response;const res={statusCode:200,setHeader(){},end(body){response=JSON.parse(body);}};
try{const {default:handler}=await import(pathToFileURL(path.join(clean,'api/weather.mjs')).href);await handler({method:'GET'},res);}finally{if(previous!==undefined)process.env.OPENWEATHER_API_KEY=previous;}
assert.equal(res.statusCode,200);assert.equal(response.mode,'sample');assert.equal(response.reason,'missing-key');assert.equal(response.forecast.length,5);
const result={passed:true,cleanCheckout:clean,originalInputsIncluded:false,localSecretsIncluded:false,salesRows:480,sales:385287,goal:386120,operationsRows:72,openTasks:42,marketingOpenTasks:7,reportColumns:16,partialInputRejected:true,corruptFixtureRejected:true,vercelApiFallbackVerified:true};
fs.writeFileSync(path.join(root,'results/vercel-build-verification.json'),JSON.stringify(result,null,2));
console.log('PASS clean Vercel-style build: no A-E originals or secrets; 480 sales / 72 tasks / API fallback / integrity checks');
