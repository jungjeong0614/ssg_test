import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx/xlsx.mjs';
import { normalizeWorkbook, deduplicate, REPORT_HEADERS } from '../src/data.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(appRoot, '../A_매출비교');
const filenames = ['01_영업실적.xlsx', '02_온라인실적.xlsx', '03_팝업실적.xlsx'];
const collected = [];
const sources = [];
for (const filename of filenames) {
  const buffer = await fs.readFile(path.join(sourceRoot, filename));
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const { rows, errors } = normalizeWorkbook(workbook, filename);
  if (errors.length) throw new Error(errors.join('\n'));
  collected.push(...rows);
  sources.push({ file: filename, sheet: '원본', rows: rows.length });
}
const template = XLSX.read(await fs.readFile(path.join(sourceRoot, '04_보고양식.xlsx')), { type: 'buffer' });
const headers = XLSX.utils.sheet_to_json(template.Sheets[template.SheetNames[0]], { header: 1, raw: true })[0];
if (JSON.stringify(headers) !== JSON.stringify(REPORT_HEADERS)) throw new Error('04_보고양식.xlsx의 16개 열이 예상 기준과 일치하지 않습니다.');
const { rows, duplicates } = deduplicate(collected);
if (duplicates.length) throw new Error(`원본 중복 ID ${duplicates.length}건: ${JSON.stringify(duplicates)}`);
await fs.mkdir(path.join(appRoot, 'public/data'), { recursive: true });
await fs.writeFile(path.join(appRoot, 'public/data/sales.json'), JSON.stringify({ rows, headers, sources }, null, 2), 'utf8');
console.log(`원본 읽기 완료: ${rows.length}행 → public/data/sales.json`);
