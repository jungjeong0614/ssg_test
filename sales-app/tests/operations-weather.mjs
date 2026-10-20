import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {countTasks,selectTasks,classifyTask} from '../src/operations-data.js';
import {createWeatherService,CACHE_MS} from '../server/weather.js';
const data=JSON.parse(await fs.readFile(new URL('../public/data/operations.json',import.meta.url),'utf8'));
const sample=JSON.parse(await fs.readFile(new URL('../server/data/weather-sample.json',import.meta.url),'utf8'));
const results=[];
async function test(name,run){try{await run();results.push({name,pass:true});console.log(`PASS ${name}`);}catch(e){results.push({name,pass:false,error:e.message});console.error(`FAIL ${name}: ${e.message}`);}}
const stamp=Date.parse('2026-10-20T03:00:00Z');
const current={dt:stamp/1000,main:{temp:17,feels_like:16,humidity:65},wind:{speed:3.2},weather:[{id:804,description:'흐림'}]};
const forecast={city:{timezone:32400},list:Array.from({length:40},(_,i)=>({dt:stamp/1000+i*10800,main:{temp_min:11,temp_max:18},pop:0.2,weather:[{id:804,description:'흐림'}]}))};
const mocks={readKey:()=> 'synthetic-test-key',readSample:async()=>sample,now:()=>stamp};
const success=async url=>({ok:true,json:async()=>url.pathname.endsWith('/weather')?current:forecast});
await test('준비표 72건에서 완료24 취소6 제외, 42건을 12/6/12/6/6 분류',()=>{
 assert.equal(data.rows.length,72);assert.equal(data.rows.filter(r=>r.상태==='완료').length,24);assert.equal(data.rows.filter(r=>r.상태==='취소').length,6);assert.equal(selectTasks(data.rows).length,42);
 assert.deepEqual(Object.values(countTasks(data.rows)),[12,6,12,6,6]);
});
await test('담당 역할 필터 및 기준일 변경, 확인 체크와 무관한 분류',()=>{
 for(const role of new Set(data.rows.map(r=>r.담당역할)))assert.ok(selectTasks(data.rows,{role}).every(r=>r.담당역할===role&&!['완료','취소'].includes(r.상태)));
 assert.notDeepEqual(countTasks(data.rows,'2026-10-22'),countTasks(data.rows));
 const task=data.rows.find(r=>classifyTask(r));assert.equal(classifyTask({...task,checked:true}),classifyTask(task));
});
await test('모의 키 미설정: 외부 요청 없이 D 예제·이유·예제 시각 유지',async()=>{
 const service=createWeatherService({...mocks,readKey:()=>'',fetchImpl:()=>{throw new Error('must not call');}});
 const r=await service();assert.equal(r.mode,'sample');assert.equal(r.reason,'missing-key');assert.equal(r.fetchedAt,sample.fetchedAt);assert.deepEqual(r.forecast,sample.forecast);assert.equal(r.requestedAt,new Date(stamp).toISOString());
});
await test('모의 성공: 현재 및 5일, 고정 HTTPS URL, 키 응답 비노출',async()=>{
 const urls=[];const service=createWeatherService({...mocks,fetchImpl:async url=>{urls.push(url);return success(url);}});const r=await service();
 assert.equal(r.mode,'live');assert.equal(r.forecast.length,5);assert.equal(r.current.temp,17);assert.equal(urls.length,2);assert.ok(urls.every(url=>url.host==='api.openweathermap.org'&&url.protocol==='https:'&&url.searchParams.get('units')==='metric'));assert.ok(!JSON.stringify(r).includes('synthetic-test-key'));
});
await test('모의 10분 캐시·동시요청 결합·만료 후 재요청',async()=>{
 let clock=stamp,calls=0;const service=createWeatherService({...mocks,now:()=>clock,fetchImpl:async url=>{calls++;return success(url);}});
 await Promise.all([service(),service()]);assert.equal(calls,2);assert.equal((await service()).cached,true);clock+=CACHE_MS-1;assert.equal((await service()).cached,true);assert.equal(calls,2);clock+=1;assert.equal((await service()).cached,false);assert.equal(calls,4);
});
await test('모의 현지 날짜 경계: UTC와 서울 날짜 구분 및 부분 구간 표시',async()=>{
 const shifted={...forecast,list:forecast.list.map((r,i)=>({...r,dt:Date.parse('2026-10-20T21:00:00Z')/1000+i*10800}))};
 const r=await createWeatherService({...mocks,fetchImpl:async url=>({ok:true,json:async()=>url.pathname.endsWith('/weather')?current:shifted})})();
 assert.equal(r.forecast[0].date,'2026-10-21');assert.equal(r.forecast[0].slots,6);
});
await test('모의 실패 후 회복: 실패는 캐시하지 않고 키 제거 시 성공 캐시도 사용하지 않음',async()=>{
 let broken=true,key='synthetic-test-key';const service=createWeatherService({...mocks,readKey:()=>key,fetchImpl:async url=>broken?{ok:false,status:503}:success(url)});
 assert.equal((await service()).mode,'sample');broken=false;assert.equal((await service()).mode,'live');key='';assert.equal((await service()).reason,'missing-key');
});
for(const status of [401,429,503])await test(`모의 공급자 HTTP ${status}: D 예제와 안전한 오류 사유`,async()=>{
 const r=await createWeatherService({...mocks,fetchImpl:async()=>({ok:false,status})})();assert.equal(r.mode,'sample');assert.equal(r.reason,`provider-${status}`);
});
await test('모의 시간 초과: 응답 대기와 JSON 본문 대기 모두 제한',async()=>{
 for(const fetchImpl of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
 const before=Date.now();const r=await createWeatherService({...mocks,timeoutMs:20,fetchImpl})();assert.equal(r.reason,'timeout');assert.ok(Date.now()-before<1000);}
});
await test('모의 네트워크 및 잘못된 응답: 원문 오류/키를 노출하지 않음',async()=>{
 const service=createWeatherService({...mocks,fetchImpl:async()=>{throw new Error('URL contains synthetic-test-key');}});const r=await service();assert.equal(r.reason,'network-error');assert.ok(!JSON.stringify(r).includes('synthetic-test-key'));
 const invalid=await createWeatherService({...mocks,fetchImpl:async()=>({ok:true,json:async()=>({})})})();assert.equal(invalid.reason,'invalid-response');
});
await test('실제 로컬 HTTP /api/weather: 응답 모드 명시, 키 미설정이면 예제',async()=>{
 const response=await fetch('http://127.0.0.1:5173/api/weather');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);const r=await response.json();assert.ok(['sample','live'].includes(r.mode));assert.equal(r.forecast.length,5);results.push({name:'실제 연결 상태',mode:r.mode,reason:r.reason,requestedAt:r.requestedAt,providerSuccess:r.mode==='live'});
 const denied=await fetch('http://127.0.0.1:5173/api/weather',{method:'POST'});assert.equal(denied.status,405);
});
await fs.writeFile(new URL('../../results/operations-weather-tests.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),passed:results.filter(r=>r.pass).length,failed:results.filter(r=>r.pass===false).length,results},null,2));
if(results.some(r=>r.pass===false))process.exitCode=1;
