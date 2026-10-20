import fs from 'node:fs/promises';
export const CACHE_MS=10*60*1000;
export const TIMEOUT_MS=5000;
const LOCATION={id:'seoul',name:'서울 중구 참고 좌표',note:'예제A점의 실제 위치가 아닙니다.',lat:37.5636,lon:126.9828,timezone:'Asia/Seoul'};
const samplePath=new URL('../fixtures/educational/weather-sample.json',import.meta.url);
export function createWeatherService({fetchImpl=fetch,now=Date.now,timeoutMs=TIMEOUT_MS,readKey=()=>process.env.OPENWEATHER_API_KEY,readSample=async()=>JSON.parse(await fs.readFile(samplePath,'utf8'))}={}){
  let cache=null,cacheKey='',pending=null,pendingKey='';
  const fallback=async(reason,message)=>({...await readSample(),mode:'sample',status:'예제 날씨',reason,message,requestedAt:new Date(now()).toISOString(),cached:false,cacheExpiresAt:null,connection:'fallback',sampleSource:'D_화면과연결/11_날씨응답_예제.json'});
  const perform=async key=>{
    const controller=new AbortController();let timer;
    try{
      const work=async()=>{
        const get=async endpoint=>{
          const url=new URL(`https://api.openweathermap.org/data/2.5/${endpoint}`);
          for(const [k,v] of Object.entries({lat:LOCATION.lat,lon:LOCATION.lon,appid:key,units:'metric',lang:'kr'}))url.searchParams.set(k,v);
          const response=await fetchImpl(url,{signal:controller.signal});
          if(!response.ok){const error=new Error('provider');error.status=response.status;throw error;}
          return response.json();
        };
        const [current,forecast]=await Promise.all([get('weather'),get('forecast')]);
        if(!Number.isFinite(current?.dt)||!Number.isFinite(current?.main?.temp)||!Number.isFinite(current?.main?.feels_like)||!Number.isFinite(current?.main?.humidity)||!Number.isFinite(current?.wind?.speed)||!current?.weather?.[0]?.description||!Array.isArray(forecast?.list)||!forecast.list.length||!Number.isFinite(forecast?.city?.timezone))throw new Error('invalid-response');
        const groups=new Map();
        for(const slot of forecast.list){
          if(!Number.isFinite(slot.dt)||!Number.isFinite(slot.main?.temp_min)||!Number.isFinite(slot.main?.temp_max)||!Number.isFinite(slot.pop)||!slot.weather?.[0]?.description)throw new Error('invalid-response');
          const date=new Date((slot.dt+forecast.city.timezone)*1000).toISOString().slice(0,10);
          const day=groups.get(date)||{date,min:Infinity,max:-Infinity,pop:0,description:slot.weather[0].description,conditionId:slot.weather[0].id,slots:0};
          day.min=Math.min(day.min,slot.main.temp_min);day.max=Math.max(day.max,slot.main.temp_max);day.pop=Math.max(day.pop,slot.pop);day.slots++;groups.set(date,day);
        }
        const days=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
        if(days.length<5)throw new Error('invalid-response');
        const fetchedAt=new Date(now()).toISOString();
        return {mode:'live',status:'실제 날씨',reason:null,message:'OpenWeather 현재·5일 예보 연결 성공',connection:'live',location:LOCATION,source:{name:'OpenWeather',url:'https://openweathermap.org/'},fetchedAt,requestedAt:fetchedAt,observedAt:new Date(current.dt*1000).toISOString(),cached:false,cacheExpiresAt:new Date(now()+CACHE_MS).toISOString(),current:{temp:current.main.temp,feelsLike:current.main.feels_like,humidity:current.main.humidity,wind:current.wind.speed,description:current.weather[0].description,conditionId:current.weather[0].id},forecast:days,forecastNote:'3시간 예보 구간을 현지 날짜로 집계한 5일. 첫날·마지막 날은 일부 시간대일 수 있습니다.'};
      };
      const result=await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const e=new Error('timeout');e.name='TimeoutError';reject(e);},timeoutMs);})]);
      cache=result;cacheKey=key;return result;
    }catch(e){
      controller.abort();
      const timeout=e.name==='TimeoutError'||e.name==='AbortError';
      const reason=timeout?'timeout':e.status?`provider-${e.status}`:e.message==='invalid-response'?'invalid-response':'network-error';
      const message=timeout?'공급자 응답 시간 제한(5초)을 초과했습니다.':e.status?`OpenWeather가 HTTP ${e.status}로 응답했습니다.`:e.message==='invalid-response'?'공급자 응답 형식 또는 예보 일수가 올바르지 않습니다.':'날씨 공급자에 연결하지 못했습니다.';
      return fallback(reason,message);
    }finally{clearTimeout(timer);}
  };
  return async()=>{
    const key=String(readKey()||'').trim();
    if(!key){cache=null;cacheKey='';return fallback('missing-key','서버 OPENWEATHER_API_KEY가 설정되지 않았습니다.');}
    if(cache&&cacheKey===key&&now()-Date.parse(cache.fetchedAt)<CACHE_MS)return {...cache,cached:true,requestedAt:new Date(now()).toISOString()};
    if(pending&&pendingKey===key)return pending;
    pendingKey=key;const work=perform(key);pending=work;
    try{return await work;}finally{if(pending===work){pending=null;pendingKey='';}}
  };
}
export const getWeather=createWeatherService();
export async function weatherHandler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.end(JSON.stringify({error:'GET만 지원합니다.'}));return;}
  try{res.statusCode=200;res.end(JSON.stringify(await getWeather()));}
  catch{res.statusCode=503;res.end(JSON.stringify({mode:'unavailable',message:'날씨 예제 자료도 읽을 수 없습니다.'}));}
}
