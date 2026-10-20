import * as XLSX from 'xlsx/xlsx.mjs';

export const REQUIRED = ['record_id', '기준주', '점포', '브랜드', '장르', '채널', '매출_만원', '목표_만원', '비용_만원', '상태', '출처', '기준일'];
export const REPORT_HEADERS = ['record_id', '채널', '기준주', '점포', '브랜드', '장르', '매출_만원', '목표_만원', '목표차이_만원', '달성률', '비용_만원', '비용차감액_만원', '상태', '메모', '출처', '기준일'];
const aliases = [
  ['record_id', '레코드ID', '기록번호'], ['기준주', '주차', '주간기준일'],
  ['점포', '점포명', '영업점'], ['브랜드', '브랜드명', '행사브랜드'],
  ['장르', '카테고리', '상품군'], ['채널', '유통채널', '판매채널'],
  ['매출_만원', '실적(만원)', '매출액_만원'], ['목표_만원', '목표매출(만원)', '목표액_만원'],
  ['비용_만원', '집행비용(만원)', '사용비용_만원'], ['상태', '진행상태', '진행현황'],
  ['출처', '근거자료', '자료출처'], ['기준일', '확인일', '기준일자'],
];
const blank = value => value === null || value === undefined || String(value).trim() === '';
function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  const text = String(value ?? '').trim();
  const match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/.exec(text);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(+year, +month - 1, +day));
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function normalizeWorkbook(workbook, filename) {
  const errors = [];
  if (!workbook.Sheets['원본']) {
    errors.push(`${filename}: 필수 시트 ‘원본’이 없습니다.`);
    // An invalid sheet is only inspected for useful diagnostics, never accepted as input.
    const first = workbook.Sheets[workbook.SheetNames[0]];
    if (first) {
      const firstHeaders = (XLSX.utils.sheet_to_json(first, { header: 1, raw: true })[0] ?? []).map(value => String(value ?? '').trim());
      const missing = REQUIRED.filter((_, index) => !aliases[index].some(alias => firstHeaders.includes(alias)));
      if (missing.length) errors.push(`${filename}: 첫 시트 필수 열 누락 — ${missing.join(', ')}`);
    }
    return { rows: [], errors };
  }
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets['원본'], { header: 1, defval: null, blankrows: true, raw: true });
  const headers = (matrix[0] ?? []).map(value => String(value ?? '').trim());
  const indexes = aliases.map(options => headers.findIndex(header => options.includes(header)));
  const missing = REQUIRED.filter((_, index) => indexes[index] === -1);
  if (missing.length) return { rows: [], errors: [`${filename}: 필수 열 누락 — ${missing.join(', ')}`] };
  const expectedChannel = /^01_/.test(filename) ? '영업' : /^02_/.test(filename) ? '온라인' : /^03_/.test(filename) ? '팝업' : null;
  const rows = [];
  for (let index = 1; index < matrix.length; index++) {
    const cells = matrix[index];
    if (cells.every(blank)) continue;
    const row = Object.fromEntries(REQUIRED.map((key, field) => [key, cells[indexes[field]] ?? null]));
    const location = `${filename} ${index + 1}행`;
    for (const key of REQUIRED.filter(key => !['매출_만원', '목표_만원', '비용_만원', '기준주', '기준일'].includes(key))) {
      if (blank(row[key])) errors.push(`${location}: ${key} 값이 비어 있습니다.`);
      row[key] = String(row[key] ?? '').trim();
    }
    for (const key of ['매출_만원', '목표_만원', '비용_만원']) {
      if (blank(row[key]) && key === '목표_만원') { row[key] = null; continue; }
      const value = typeof row[key] === 'number' ? row[key] : Number(String(row[key] ?? '').replaceAll(',', '').trim());
      if (blank(row[key]) || !Number.isFinite(value) || typeof row[key] === 'boolean') errors.push(`${location}: ${key}는 만원 단위의 유효한 숫자여야 합니다.`);
      row[key] = value;
    }
    for (const key of ['기준주', '기준일']) {
      const date = isoDate(row[key]);
      if (!date) errors.push(`${location}: ${key} 날짜가 올바르지 않습니다.`);
      row[key] = date;
    }
    if (expectedChannel && row['채널'] !== expectedChannel) errors.push(`${location}: 채널 ‘${row['채널']}’이 파일 기준 ‘${expectedChannel}’과 다릅니다.`);
    row._sourceFile = filename;
    row._sourceRow = index + 1;
    rows.push(row);
  }
  return { rows: errors.length ? [] : rows, errors };
}

export function deduplicate(rows) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];
  for (const row of rows) {
    const first = seen.get(row.record_id);
    if (first) duplicates.push({ id: row.record_id, firstFile: first._sourceFile, firstRow: first._sourceRow, file: row._sourceFile, row: row._sourceRow });
    else { seen.set(row.record_id, row); unique.push(row); }
  }
  return { rows: unique, duplicates };
}

export function filterRows(rows, filters = {}) {
  const query = String(filters.query ?? '').trim().toLocaleLowerCase();
  return rows.filter(row => (!filters.store || row['점포'] === filters.store)
    && (!filters.channel || row['채널'] === filters.channel)
    && (!filters.week || row['기준주'] === filters.week)
    && (!query || REQUIRED.some(key => String(row[key] ?? '').toLocaleLowerCase().includes(query))));
}

export function summarize(rows) {
  const sales = rows.reduce((sum, row) => sum + (row['매출_만원'] ?? 0), 0);
  const goal = rows.reduce((sum, row) => sum + (row['목표_만원'] ?? 0), 0);
  const cost = rows.reduce((sum, row) => sum + (row['비용_만원'] ?? 0), 0);
  return { sales, goal, cost, achievement: goal === 0 || rows.some(row => row['목표_만원'] === null || row['목표_만원'] === undefined) ? null : sales / goal };
}

export function createReportWorkbook(rows, notes = {}, headers = REPORT_HEADERS) {
  const records = rows.map(row => ({ ...row,
    '목표차이_만원': row['목표_만원'] == null ? null : row['매출_만원'] - row['목표_만원'],
    '달성률': row['목표_만원'] ? row['매출_만원'] / row['목표_만원'] : null,
    '비용차감액_만원': row['매출_만원'] - row['비용_만원'],
    '메모': notes[row.record_id] ?? '',
  }));
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...records.map(row => headers.map(key => row[key] ?? null))]);
  sheet['!cols'] = headers.map(key => ({ wch: key === '메모' || key === '출처' ? 30 : key === 'record_id' ? 22 : 15 }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) };
  for (let row = 1; row <= records.length; row++) {
    headers.forEach((key, column) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && typeof cell.v === 'number') cell.z = key === '달성률' ? '0.0%' : '#,##0.##';
    });
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '매출보고');
  return workbook;
}

export async function importFiles(files, currentRows = []) {
  const incoming = [];
  const errors = [];
  for (const file of files) {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const result = normalizeWorkbook(workbook, file.name);
      incoming.push(...result.rows);
      errors.push(...result.errors);
    } catch (error) { errors.push(`${file.name}: 파일을 읽을 수 없습니다. ${error.message}`); }
  }
  if (errors.length) return { rows: currentRows, errors, duplicates: [] };
  return { ...deduplicate([...currentRows, ...incoming]), errors: [] };
}
