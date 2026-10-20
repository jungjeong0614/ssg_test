export const CATEGORIES=['지연','오늘 마감','2일 내 임박','이후','날짜 확인 필요'];
export function classifyTask(row,asOf=row.점검기준일){
  if(['완료','취소'].includes(row.상태)) return null;
  if(!row.마감일) return '날짜 확인 필요';
  const days=(Date.parse(`${row.마감일}T00:00:00Z`)-Date.parse(`${asOf}T00:00:00Z`))/86400000;
  if(!Number.isFinite(days)) return '날짜 확인 필요';
  return days<0?'지연':days===0?'오늘 마감':days<=2?'2일 내 임박':'이후';
}
export function selectTasks(rows,{role='',category='',asOf='2026-10-20'}={}){
  return rows.filter(row=>classifyTask(row,asOf)&&(!role||row.담당역할===role)&&(!category||classifyTask(row,asOf)===category));
}
export function countTasks(rows,asOf='2026-10-20'){
  const result=Object.fromEntries(CATEGORIES.map(c=>[c,0]));
  for(const row of rows){const c=classifyTask(row,asOf);if(c)result[c]++;}return result;
}
export function rainAlerts(weather,period){
  if(!period?.start||!period?.end)return [];
  return (weather?.forecast||[]).filter(day=>day.date>=period.start&&day.date<=period.end&&Number.isFinite(day.pop)&&day.pop>=0.6).map(day=>({...day,taskId:'EV071',mode:weather.mode,source:weather.source,observedAt:weather.observedAt}));
}
