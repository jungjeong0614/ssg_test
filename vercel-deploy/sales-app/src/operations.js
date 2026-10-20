import {CATEGORIES,selectTasks,classifyTask,rainAlerts} from './operations-data.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='ssg-operations-checks-v1';
const time=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)):'—';

export function initOperations(main){
  const sales=document.createElement('section');sales.id='sales-view';while(main.firstChild)sales.append(main.firstChild);
  const nav=document.createElement('nav');nav.className='workspace-tabs';nav.setAttribute('aria-label','업무 탭');nav.innerHTML='<button id="sales-tab" aria-pressed="true">매출</button><button id="operations-tab" aria-pressed="false">운영</button><button id="weather-tab" aria-pressed="false">날씨</button>';
  const panel=document.createElement('section');panel.id='operations-view';panel.hidden=true;
  const weatherPanel=document.createElement('section');weatherPanel.id='weather-view';weatherPanel.hidden=true;
  weatherPanel.innerHTML='<section class="page-heading"><div><p class="eyebrow">WEATHER</p><h1>현재·5일 날씨</h1><p class="subtitle">서울 중구 참고 좌표</p></div></section><section class="panel ops-weather"><div class="section-heading"><h2>날씨 조회</h2><button class="button secondary" id="weather-refresh">날씨 다시 조회</button></div><div id="weather-content"></div></section>';
  weatherPanel.querySelector('.subtitle').textContent='서울 중구 참고 좌표 · 실제 날씨 날짜는 행사 점검 기준일과 다릅니다.';
  const dialog=document.createElement('dialog');dialog.id='ops-detail-dialog';dialog.setAttribute('aria-labelledby','ops-detail-title');
  main.append(nav,sales,panel,weatherPanel);main.after(dialog);
  let data=null,asOf='2026-10-20',role='',saved={},storageError='',selectedId=null,actualWeather=null,exampleWeather=null,rainMode='actual';
  try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))saved=value;}catch{storageError='브라우저에 저장한 확인·메모를 읽지 못했습니다.';}
  const switchTab=active=>{for(const [id,view] of [['sales',sales],['operations',panel],['weather',weatherPanel]]){view.hidden=id!==active;nav.querySelector(`#${id}-tab`).setAttribute('aria-pressed',String(id===active));}};
  for(const name of ['sales','operations','weather'])nav.querySelector(`#${name}-tab`).onclick=()=>switchTab(name);
  panel.innerHTML='<h1>운영 준비 보드</h1><p role="status">준비표를 불러오는 중…</p>';
  function save(id,patch){
    const next={...saved,[id]:{...saved[id],...patch}};
    try{localStorage.setItem(KEY,JSON.stringify(next));saved=next;const status=dialog.open?dialog.querySelector('#ops-detail-status'):panel.querySelector('#ops-save-status');if(status)status.textContent='이 브라우저에 저장했습니다.';renderBoard();}
    catch{const status=dialog.open?dialog.querySelector('#ops-detail-status'):panel.querySelector('#ops-save-status');if(status)status.textContent='저장하지 못했습니다. 브라우저 저장 설정을 확인해 주세요.';}
  }
  function renderBoard(){
    if(!data)return;
    const rows=selectTasks(data.rows,{role,asOf});const all=selectTasks(data.rows,{asOf});
    panel.querySelector('#ops-count').textContent=`조회 ${rows.length}건 / 미완료 ${all.length}건 · 완료·취소 제외 · 기준일 ${asOf}`;
    panel.querySelector('#ops-board').innerHTML=CATEGORIES.map((category,index)=>{
      const group=rows.filter(r=>classifyTask(r,asOf)===category);
      return `<section class="board-column board-column-${index}" aria-label="${category}"><header><h2>${category}</h2><span>${group.length}건</span></header><div class="board-stack">${group.map(r=>`<button type="button" class="task-card" data-task="${esc(r.task_id)}" aria-label="${esc(r.task_id)} ${esc(r.준비항목)} 상세"><span class="card-id">${esc(r.task_id)}<span>${esc(r.상태)}</span></span><strong>${esc(r.준비항목)}</strong><span class="card-role">${esc(r.담당역할)}</span><span class="card-due">마감 ${esc(r.마감일)||'날짜 확인 필요'}</span><span class="card-check">${saved[r.task_id]?.checked?'확인 체크됨':'확인 전'} · ${esc(r.우선순위)} 우선순위</span>${saved[r.task_id]?.note?`<span class="card-note">메모: ${esc(saved[r.task_id].note)}</span>`:''}</button>`).join('')||'<p class="board-empty">해당 항목 없음</p>'}</div></section>`;
    }).join('');
    panel.querySelector('#ops-asof-label').textContent=asOf;
  }
  function openTask(id,context=''){
    const row=data?.rows.find(r=>r.task_id===id);if(!row)return;selectedId=id;
    dialog.innerHTML=`<div class="dialog-heading"><div><p class="eyebrow">PREPARATION DETAIL</p><h2 id="ops-detail-title">${esc(row.준비항목)}</h2></div><button class="icon-button" id="ops-detail-close" aria-label="준비 상세 닫기">×</button></div>${context?`<p class="rain-detail-context">${esc(context)}</p>`:''}<div class="task-detail-key"><strong>${esc(row.task_id)}</strong><span>마감 ${esc(row.마감일)||'날짜 확인 필요'}</span></div><div class="task-detail-check"><h3>확인사항</h3><p>${esc(row.확인사항)}</p></div><dl><div><dt>담당 역할</dt><dd>${esc(row.담당역할)}</dd></div><div><dt>원본 상태</dt><dd>${esc(row.상태)}</dd></div><div><dt>분류 / 점검 기준일</dt><dd>${classifyTask(row,asOf)||'완료·취소'} / ${asOf}</dd></div><div><dt>업무 영역 / 우선순위</dt><dd>${esc(row.업무영역)} / ${esc(row.우선순위)}</dd></div></dl><label class="detail-check-label"><input id="ops-detail-checked" type="checkbox" ${saved[id]?.checked?'checked':''}> 이 브라우저에서 확인 체크</label><p class="muted">개인 점검 표시이며 원본 상태와 마감 분류는 바뀌지 않습니다.</p><label class="memo-label" for="ops-detail-note">준비 항목 메모</label><textarea id="ops-detail-note" rows="5" maxlength="5000">${esc(saved[id]?.note||'')}</textarea><p id="ops-detail-status" role="status"></p><p class="source-note">출처: C_행사준비/08_행사준비.csv · ${esc(id)}</p>`;
    dialog.querySelector('#ops-detail-close').onclick=()=>dialog.close();
    dialog.querySelector('#ops-detail-checked').onchange=e=>save(selectedId,{checked:e.target.checked});
    dialog.querySelector('#ops-detail-note').oninput=e=>save(selectedId,{note:e.target.value});
    if(!dialog.open)dialog.showModal();
  }
  function renderRain(){
    if(!data)return;const target=panel.querySelector('#rain-alerts');const w=rainMode==='example'?exampleWeather:actualWeather;
    if(!w){target.innerHTML='<p class="muted">예보를 불러오는 중입니다.</p>';return;}
    const alerts=rainAlerts(w,data.eventPeriod),isExample=w.mode!=='live';
    target.innerHTML=`<p class="rain-source ${isExample?'example':''}"><b>${isExample?'교육용 예제 · 실제 예보 아님':'OpenWeather 실제 예보'}</b> · 행사 ${data.eventPeriod.start}~${data.eventPeriod.end}</p><p class="muted">출처: ${esc(w.source.name)}${isExample?' · D_화면과연결/11_날씨응답_예제.json':''} · 조회 ${time(w.requestedAt||w.fetchedAt)} · 자료 기준 ${time(w.observedAt)}${w.reason?` · ${esc(w.message||w.reason)}`:''}</p>${alerts.length?alerts.map(d=>`<article class="rain-alert"><div><strong>${d.date} · 강수확률 ${Math.round(d.pop*100)}%</strong><p>행사 기간과 겹치는 60% 이상 예보 · ${isExample?'교육용 예제':'실제 예보'}</p></div><button class="button secondary" data-rain-task="${d.taskId}" data-rain-date="${d.date}" data-rain-probability="${Math.round(d.pop*100)}">EV071 · 우천 시 반입 동선 확정 열기</button></article>`).join(''):'<p class="rain-empty">현재 제공된 예보 중 행사 기간과 겹치는 강수확률 60% 이상 날짜가 없습니다. 예보가 없는 행사 날짜의 날씨는 판단하지 않습니다.</p>'}<p class="muted">우천 준비 항목은 담당 필터와 무관하게 열 수 있습니다. EV071 담당: 행사 운영 담당.</p>`;
    panel.querySelector('#rain-actual').setAttribute('aria-pressed',String(rainMode==='actual'));panel.querySelector('#rain-example').setAttribute('aria-pressed',String(rainMode==='example'));
  }
  async function loadWeather(){
    const target=weatherPanel.querySelector('#weather-content'),button=weatherPanel.querySelector('#weather-refresh');button.disabled=true;target.textContent='서버에서 날씨를 조회하는 중…';
    try{
      let w;try{const response=await fetch('/api/weather',{signal:AbortSignal.timeout(8000)});w=await response.json();if(!response.ok||!w.current)throw new Error();}
      catch{const response=await fetch('/data/weather-sample.json',{signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error();w={...await response.json(),mode:'sample',reason:'server-unavailable',message:'날씨 서버에 연결하지 못해 교육용 예제로 전환했습니다.',requestedAt:new Date().toISOString(),cached:false,sampleSource:'D_화면과연결/11_날씨응답_예제.json'};}
      actualWeather=w;renderRain();const example=w.mode!=='live';
      target.innerHTML=`<div class="weather-mode ${example?'example':''}"><b>${example?'예제 날씨 · 실제 관측·예보 아님':'OpenWeather 실제 연결'}</b><p>${esc(w.message)}${w.reason?` (${esc(w.reason)})`:''}</p></div><p>${esc(w.location.name)} · ${esc(w.location.note)}</p><p class="muted">시간대: ${esc(w.location.timezone)} · ${w.cached?'10분 캐시 사용':'새 응답'} · 서버 조회 시각: ${time(w.requestedAt)}</p><div class="weather-now"><strong>${esc(w.current.temp)}℃</strong><span>${esc(w.current.description)} · 체감 ${esc(w.current.feelsLike)}℃ · 습도 ${esc(w.current.humidity)}% · 풍속 ${esc(w.current.wind)}m/s</span></div><p class="muted">관측/예제 기준 시각: ${time(w.observedAt)} · 자료 수신 시각: ${time(w.fetchedAt)}${w.cacheExpiresAt?` · 캐시 만료: ${time(w.cacheExpiresAt)}`:''}</p><h3>5일 날씨${example?' (교육용 예제)':''}</h3><div class="forecast-grid">${w.forecast.map(d=>`<article><b>${esc(d.date)}</b><p>${esc(d.description)}</p><strong>${esc(d.min)}~${esc(d.max)}℃</strong><p>최대 강수확률 ${Math.round(d.pop*100)}%</p><small>예보 구간 ${d.slots}개</small></article>`).join('')}</div><p class="muted">${esc(w.forecastNote||'D의 고정된 교육용 예제 날짜입니다. 현재 날짜의 실제 예보가 아닙니다.')}</p><p class="weather-source">출처: ${w.source.url?'<a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a>':esc(w.source.name)}${example?` · ${esc(w.sampleSource)}`:''}</p>`;
    }catch{actualWeather=null;target.innerHTML='<div class="notice error">날씨 서버와 예제 자료를 읽지 못했습니다.</div>';if(data)panel.querySelector('#rain-alerts').textContent='예보를 읽지 못해 우천 경고를 판단할 수 없습니다.';}
    finally{button.disabled=false;}
  }
  fetch('/data/operations.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(value=>{
    data=value;asOf=data.asOf;
    panel.innerHTML=`<section class="page-heading"><div><p class="eyebrow">POP-UP OPERATIONS</p><h1>행사 운영 보드</h1><p class="subtitle">모먼트룸 팝업스토어 · 점검 기준일 <span id="ops-asof-label">${asOf}</span></p></div><button id="marketing-only" class="button primary">마케팅 담당만 보기</button></section><details class="panel brief-panel"><summary>행사 조건 · 책상 위, 작은 숲</summary><dl>${data.conditions.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="muted">출처: ${esc(data.sources[0])} · 교육용 가상 행사</p></details><section class="panel ops-filters"><label for="ops-asof">점검 기준일</label><input id="ops-asof" type="date" value="${asOf}"><label for="ops-role">담당 역할</label><select id="ops-role"><option value="">전체 역할</option>${[...new Set(data.rows.map(r=>r.담당역할))].sort().map(v=>`<option>${esc(v)}</option>`).join('')}</select><button id="ops-reset" class="button secondary">필터 초기화</button><p id="ops-count" data-testid="ops-count"></p></section><p class="muted">모든 카드 열이 같은 기준일·담당 필터를 사용합니다. 카드를 누르면 확인사항·메모를 크게 열 수 있습니다.</p><p id="ops-save-status" role="status">${esc(storageError)}</p><section id="ops-board" class="task-board" aria-label="다섯 마감 분류 카드 보드"></section><section class="panel rain-panel"><div class="section-heading"><div><h2>행사 기간 우천 준비</h2><p class="muted">브리프의 행사 기간과 겹치는 강수확률 60% 이상 예보</p></div><div class="rain-source-controls"><button id="rain-actual" class="button secondary" aria-pressed="true">서버 예보</button><button id="rain-example" class="button secondary" aria-pressed="false">교육용 예제 10/23 · 80%</button></div></div><div id="rain-alerts"></div></section><p class="source-note">출처: ${esc(data.sources[1])} · 원본 상태 보존 · 확인 체크와 메모는 이 브라우저에 저장</p>`;
    panel.querySelector('#ops-role').onchange=e=>{role=e.target.value;renderBoard();};
    panel.querySelector('#ops-asof').onchange=e=>{if(e.target.value){asOf=e.target.value;renderBoard();}else e.target.value=asOf;};
    panel.querySelector('#ops-reset').onclick=()=>{role='';asOf=data.asOf;panel.querySelector('#ops-role').value='';panel.querySelector('#ops-asof').value=asOf;renderBoard();};
    panel.querySelector('#marketing-only').onclick=()=>{role='마케팅 담당';panel.querySelector('#ops-role').value=role;renderBoard();};
    panel.querySelector('#ops-board').onclick=e=>{const button=e.target.closest('[data-task]');if(button)openTask(button.dataset.task);};
    panel.querySelector('#rain-actual').onclick=()=>{rainMode='actual';renderRain();};panel.querySelector('#rain-example').onclick=()=>{rainMode='example';renderRain();};
    panel.querySelector('#rain-alerts').onclick=e=>{const button=e.target.closest('[data-rain-task]');if(button){const w=rainMode==='example'?exampleWeather:actualWeather;openTask(button.dataset.rainTask,`${w.mode==='live'?'OpenWeather 실제 예보':'교육용 예제 · 실제 예보 아님'} · ${button.dataset.rainDate} · 강수확률 ${button.dataset.rainProbability}% · 행사 기간 ${data.eventPeriod.start}~${data.eventPeriod.end}`);}};
    renderBoard();renderRain();
  }).catch(()=>{panel.innerHTML='<h1>행사 운영 보드</h1><p class="notice error">준비표를 읽지 못했습니다. 서버를 다시 실행해 자료를 생성해 주세요.</p>';});
  fetch('/data/weather-sample.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(w=>{exampleWeather={...w,requestedAt:new Date().toISOString()};renderRain();}).catch(()=>{if(data)panel.querySelector('#rain-example').disabled=true;});
  weatherPanel.querySelector('#weather-refresh').onclick=loadWeather;loadWeather();
}
