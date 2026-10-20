import './style.css';
import { initOperations } from './operations.js';
import * as XLSX from 'xlsx/xlsx.mjs';
import { filterRows, summarize, importFiles, createReportWorkbook, REPORT_HEADERS } from './data.js';

const app = document.querySelector('#app');
const fmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const amount = value => fmt.format(Number(value) || 0);
const percent = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : `${(Number(value) * 100).toFixed(1)}%`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fileOf = row => row._sourceFile ?? row.source_file ?? '출처 파일 확인 필요';
const rowOf = row => row._sourceRow ?? row.source_row ?? '—';
const NOTES_KEY = 'ssg-sales-notes-v1';
let rows = [], reportHeaders = REPORT_HEADERS, notes = {}, selectedId = null, page = 1;
const pageSize = 30;
let diagnostics = [], duplicates = [], notice = '', noticeType = 'info';
const filters = { store: '', channel: '', week: '', query: '' };
try { const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) notes = saved; }
catch { notice = '저장된 메모를 읽지 못했습니다. 브라우저 저장 설정을 확인해 주세요.'; noticeType = 'error'; }

app.innerHTML = `
  <header class="topbar"><a class="brand" href="/" aria-label="주간 매출 리포트 홈"><span class="brand-mark">S</span><span>SSG <b>운영 인사이트</b></span></a><span class="stage">1단계 · 매출 실적</span></header>
  <main>
    <section class="page-heading"><div><p class="eyebrow">SALES OVERVIEW</p><h1>주간 매출 리포트</h1><p class="subtitle">점포·채널·기준주별 실적을 확인하고, 메모와 보고서를 관리하세요.</p></div><div class="actions"><label class="button secondary" for="file-input">＋ 엑셀 추가</label><input id="file-input" type="file" accept=".xlsx,.xls" multiple class="visually-hidden"><button id="export" class="button primary" disabled>보고양식 내보내기 <span aria-hidden="true">↗</span></button></div></section>
    <div id="notice" role="status" aria-live="polite"></div>
    <section class="filters panel" aria-label="매출 필터"><label>점포<select id="store" aria-label="점포"><option value="">전체 점포</option></select></label><label>채널<select id="channel" aria-label="채널"><option value="">전체 채널</option></select></label><label>기준주<select id="week" aria-label="기준주"><option value="">전체 기준주</option></select></label><label class="search">검색<input id="query" aria-label="검색" type="search" placeholder="브랜드·장르·ID 검색"></label><div class="filter-actions"><button id="quick-filter" class="button secondary" type="button">영업·예제A점·9/7</button><button id="reset" class="reset">초기화</button></div></section>
    <div class="context"><span id="filter-label">전체 데이터</span><span id="count" data-testid="record-count">자료 불러오는 중…</span></div>
    <section id="metrics" class="metrics" aria-label="매출 요약"></section>
    <section class="panel chart-panel"><div class="section-heading"><div><p class="eyebrow">STORE COMPARISON</p><h2>점포별 매출 비교</h2></div><div class="legend"><span><i class="sales-dot"></i>매출</span><span><i class="goal-dot"></i>목표</span><span class="unit">단위: 만원</span></div></div><div id="chart"></div></section>
    <section class="panel table-panel"><div class="section-heading"><div><h2>매출 내역</h2><p class="muted">행을 선택하면 출처와 상세 정보를 확인하고 메모를 남길 수 있습니다.</p></div><span class="unit">단위: 만원</span></div><div class="table-scroll"><table><thead><tr><th>기준주 / ID</th><th>점포 / 브랜드</th><th>채널</th><th class="num">매출</th><th class="num">목표</th><th class="num">목표 차이</th><th class="num">달성률</th><th>메모</th><th>출처</th></tr></thead><tbody id="table-body"></tbody><tfoot id="table-foot"></tfoot></table></div><div class="pagination"><span id="page-label"></span><div><button id="prev" class="button small secondary">이전</button><button id="next" class="button small secondary">다음</button></div></div></section>
    <details id="diagnostics-panel" class="panel diagnostics"><summary>가져오기 및 중복 검사 <span id="diagnostic-count"></span></summary><div id="diagnostic-content"></div></details>
    <footer>원본 파일은 읽기 전용으로 사용합니다. 보고서는 현재 필터의 전체 결과를 새 XLSX 파일로 저장합니다. 메모는 이 브라우저에 저장됩니다.</footer>
  </main>
  <dialog id="record-dialog"><div class="dialog-heading"><div><p class="eyebrow">RECORD DETAIL</p><h2>매출 상세 · 메모</h2></div><button id="close-dialog" class="icon-button" aria-label="상세 닫기">×</button></div><div id="record-detail"></div><label class="memo-label" for="memo">업무 메모</label><textarea id="memo" rows="5" maxlength="10000" placeholder="이 기록에 대한 확인 사항을 남겨주세요."></textarea><p class="muted">record_id별로 저장되며 보고서의 메모 열에 반영됩니다.</p><p id="memo-status" role="status"></p><div class="dialog-actions"><button id="save-note" class="button primary">메모 저장</button></div></dialog>`;

function currentRows() { return filterRows(rows, filters); }
function showNotice(message, type = 'info') { notice = message; noticeType = type; paintNotice(); }
function paintNotice() { const el = document.querySelector('#notice'); el.className = notice ? `notice ${noticeType}` : ''; el.textContent = notice; }
function options() {
  for (const [id,key,title] of [['store','점포','전체 점포'],['channel','채널','전체 채널'],['week','기준주','전체 기준주']]) {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">${title}</option>` + [...new Set(rows.map(r => String(r[key] ?? '')))].filter(Boolean).sort((a,b) => a.localeCompare(b,'ko')).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    el.value = filters[id];
  }
}
function render() {
  const visible = currentRows(), summary = summarize(visible);
  const missingGoal = visible.some(r => r['목표_만원'] == null);
  const maxPage = Math.max(1, Math.ceil(visible.length/pageSize)); page = Math.min(page,maxPage);
  document.querySelector('#count').textContent = `조회 ${amount(visible.length)}건 / 전체 ${amount(rows.length)}건 · 금액 단위: 만원`;
  document.querySelector('#filter-label').textContent = [filters.store,filters.channel,filters.week,filters.query && `“${filters.query}”`].filter(Boolean).join(' · ') || '전체 데이터';
  document.querySelector('#metrics').innerHTML = `<article class="metric featured"><span>매출 합계 <small>만원</small></span><strong data-testid="sales-total">${amount(summary.sales)}</strong><p>현재 조건의 매출 실적</p></article><article class="metric"><span>목표 합계 <small>만원</small></span><strong data-testid="goal-total">${missingGoal ? '—' : amount(summary.goal)}</strong><p>목표 차이 <b class="${summary.sales-summary.goal<0?'negative':'positive'}">${!missingGoal && summary.sales-summary.goal>0?'+':''}${missingGoal ? '—' : amount(summary.sales-summary.goal)} 만원</b></p></article><article class="metric"><span>합계 달성률</span><strong data-testid="achievement">${percent(summary.achievement)}</strong><p>합계 매출 ÷ 합계 목표</p></article>`;
  const grouped = new Map();
  for (const row of visible) { const entry = grouped.get(row['점포']) || {sales:0,goal:0,count:0,missingGoal:false}; entry.sales += Number(row['매출_만원'])||0; entry.goal += Number(row['목표_만원'])||0; entry.count++; entry.missingGoal ||= row['목표_만원'] == null; grouped.set(row['점포'],entry); }
  const stores = [...grouped].sort((a,b)=>b[1].sales-a[1].sales), max = Math.max(1,...stores.flatMap(([,v])=>[v.sales,v.goal]));
  document.querySelector('#chart').innerHTML = stores.length ? stores.map(([name,v])=>`<div class="chart-row"><div class="chart-name">${esc(name)}<small>${v.count}건</small></div><div class="bar-pair"><div class="bar-track"><div class="bar sales-bar" style="width:${Math.max(0,v.sales)/max*100}%"></div><span>${amount(v.sales)}</span></div><div class="bar-track"><div class="bar goal-bar" style="width:${Math.max(0,v.goal)/max*100}%"></div><span>${v.missingGoal ? '—' : amount(v.goal)}</span></div></div><div class="chart-rate">${percent(v.goal && !v.missingGoal ? v.sales/v.goal : null)}<small>달성률</small></div></div>`).join('') : '<div class="empty">조건에 맞는 매출이 없습니다. 필터를 변경해 주세요.</div>';
  document.querySelector('#table-body').innerHTML = visible.slice((page-1)*pageSize,page*pageSize).map(r=>`<tr><td>${esc(r['기준주'])}<small>${esc(r.record_id)}</small></td><td><b>${esc(r['점포'])}</b><small>${esc(r['브랜드'])} · ${esc(r['장르'])}</small></td><td><span class="tag">${esc(r['채널'])}</span></td><td class="num">${amount(r['매출_만원'])}</td><td class="num">${r['목표_만원'] == null ? '—' : amount(r['목표_만원'])}</td><td class="num ${Number(r['매출_만원'])-Number(r['목표_만원'])<0?'negative':'positive'}">${r['목표_만원'] == null ? '—' : amount(Number(r['매출_만원'])-Number(r['목표_만원']))}</td><td class="num">${percent(Number(r['목표_만원']) ? Number(r['매출_만원'])/Number(r['목표_만원']) : null)}</td><td><button class="note-button" data-record="${esc(r.record_id)}" aria-label="${esc(r.record_id)} 상세 메모">${notes[r.record_id] ? '메모 있음' : '상세 / 메모'}</button></td><td class="source">${esc(fileOf(r))}<small>원본 ${esc(rowOf(r))}행 · ${esc(r['출처'])}</small></td></tr>`).join('') || '<tr><td colspan="9" class="empty">조건에 맞는 기록이 없습니다.</td></tr>';
  document.querySelector('#table-foot').innerHTML = `<tr><td colspan="3">필터 결과 합계 · ${visible.length}건</td><td class="num">${amount(summary.sales)}</td><td class="num">${missingGoal ? '—' : amount(summary.goal)}</td><td class="num">${missingGoal ? '—' : amount(summary.sales-summary.goal)}</td><td class="num">${percent(summary.achievement)}</td><td colspan="2"></td></tr>`;
  document.querySelector('#page-label').textContent = `${page} / ${maxPage} 페이지 · 페이지당 ${pageSize}건`;
  document.querySelector('#prev').disabled = page<=1; document.querySelector('#next').disabled = page>=maxPage;
  document.querySelector('#export').disabled = !visible.length;
  document.querySelector('#diagnostic-count').textContent = `오류 ${diagnostics.length} · 중복 ${duplicates.length}`;
  document.querySelector('#diagnostic-content').innerHTML = diagnostics.length || duplicates.length ? `<ul>${diagnostics.map(e=>`<li class="negative">${esc(typeof e === 'string' ? e : e.message || JSON.stringify(e))}</li>`).join('')}${duplicates.map(d=>`<li>중복 ID <b>${esc(d.id)}</b>: ${esc(d.file)} ${esc(d.row)}행 제외 · 먼저 읽은 ${esc(d.firstFile)} ${esc(d.firstRow)}행 유지</li>`).join('')}</ul><p class="muted">정상 로드된 데이터는 유지되며 중복 행은 합계와 내보내기에 추가되지 않습니다.</p>` : '<p class="muted">현재 중복 ID와 가져오기 오류가 없습니다. 원본 3개 파일의 자료를 통합해 사용합니다.</p>';
  paintNotice();
}
function openRecord(id) {
  const r = rows.find(r=>String(r.record_id)===String(id)); if (!r) return; selectedId = r.record_id;
  document.querySelector('#record-detail').innerHTML = `<p class="record-id">${esc(r.record_id)}</p><dl>${['기준주','점포','브랜드','장르','채널','상태','기준일','출처'].map(k=>`<div><dt>${k}</dt><dd>${esc(r[k])}</dd></div>`).join('')}<div><dt>매출 / 목표</dt><dd>${amount(r['매출_만원'])} / ${r['목표_만원'] == null ? '—' : amount(r['목표_만원'])} 만원</dd></div><div><dt>비용 / 비용차감액</dt><dd>${amount(r['비용_만원'])} / ${amount(Number(r['매출_만원'])-Number(r['비용_만원']))} 만원</dd></div><div class="wide"><dt>원본 위치</dt><dd>${esc(fileOf(r))} · 원본 시트 ${esc(rowOf(r))}행</dd></div></dl>`;
  document.querySelector('#memo').value = notes[selectedId] || ''; document.querySelector('#memo-status').textContent = '';
  document.querySelector('#record-dialog').showModal();
}
for (const id of ['store','channel','week','query']) document.getElementById(id).addEventListener(id==='query'?'input':'change',e=>{filters[id]=e.target.value; page=1; render();});
document.querySelector('#reset').addEventListener('click',()=>{Object.keys(filters).forEach(k=>{filters[k]='';document.getElementById(k).value='';});page=1;render();});
document.querySelector('#quick-filter').addEventListener('click',()=>{
  Object.assign(filters, {store:'예제A점', channel:'영업', week:'2026-09-07', query:''});
  for (const [key,value] of Object.entries(filters)) document.getElementById(key).value=value;
  page=1;
  render();
});
document.querySelector('#prev').addEventListener('click',()=>{page--;render();});
document.querySelector('#next').addEventListener('click',()=>{page++;render();});
document.querySelector('#table-body').addEventListener('click',e=>{const b=e.target.closest('[data-record]');if(b)openRecord(b.dataset.record);});
document.querySelector('#close-dialog').addEventListener('click',()=>document.querySelector('#record-dialog').close());
document.querySelector('#save-note').addEventListener('click',()=>{
  const updated = {...notes,[selectedId]:document.querySelector('#memo').value};
  try { localStorage.setItem(NOTES_KEY,JSON.stringify(updated)); notes=updated; document.querySelector('#memo-status').textContent='메모를 저장했습니다.';render(); }
  catch { document.querySelector('#memo-status').textContent='메모 저장에 실패했습니다. 브라우저 저장 공간 또는 설정을 확인해 주세요.'; }
});
document.querySelector('#file-input').addEventListener('change',async e=>{
  const input=e.target; if (!input.files.length) return; input.disabled=true;
  try { const result=await importFiles([...input.files],rows); rows=result.rows; diagnostics=result.errors||[]; duplicates=result.duplicates||[];options();page=1;showNotice(`가져오기 완료 · 통합 ${rows.length}건 · 오류 ${diagnostics.length}건 · 중복 ${duplicates.length}건`, diagnostics.length?'error':'info');render();if(diagnostics.length||duplicates.length) document.querySelector('#diagnostics-panel').open=true; }
  catch(err) {showNotice(`파일을 가져오지 못했습니다. ${err.message}`,'error');}
  finally {input.value='';input.disabled=false;}
});
document.querySelector('#export').addEventListener('click',()=>{
  try { const visible=currentRows();const wb=createReportWorkbook(visible,notes,reportHeaders);const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);const filename=`매출비교_보고서_${stamp}.xlsx`;XLSX.writeFile(wb,filename);showNotice(`${visible.length}건을 04 보고양식의 열 순서로 내보냈습니다. 파일: ${filename} · 브라우저 다운로드 위치를 확인해 주세요.`); }
  catch(err) {showNotice(`보고서를 저장하지 못했습니다. ${err.message}`,'error');}
});
async function boot() {
  try { const res=await fetch('/data/sales.json');if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json();rows=data.rows||[];reportHeaders=data.headers||REPORT_HEADERS;diagnostics=data.errors||[];duplicates=data.duplicates||[];options();render(); }
  catch(err) {showNotice(`원본 통합 데이터를 불러오지 못했습니다. ${err.message}`,'error');render();}
}
initOperations(document.querySelector('main'));
render();boot();





