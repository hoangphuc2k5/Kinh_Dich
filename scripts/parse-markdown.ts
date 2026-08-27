import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Que = { so_thu_tu: number; ten_que: string; thoan_tu: string; thoan_truyen: string; dai_tuong: string; tieu_tuong: string; hao: { ten_hao: string; loi_hao: string }[]; nguon_pdf: string; loai_tai_lieu: '64-que' | 'tham-khao' };
const input = join(process.cwd(), 'data', 'markdown-processed'); const output = join(process.cwd(), 'data', '64-que.json');
const supplementInput = join(process.cwd(), 'Que', '64-que-kinh-dich.md');
const supplementOutput = join(process.cwd(), 'src', 'data', 'que-supplement.json');
const heading = /^(#{1,6})\s*(?:(\d{1,2})[.、-]\s*)?(.+)$/;
const trigramWord = /(?:CÀN|KHÔN|ĐOÀI|LY|HỎA|CHẤN|LÔI|TỐN|PHONG|KHẢM|THỦY|CẤN|SƠN|TRẠCH|ĐỊA|THIÊN|BÁT THUẦN)/i;
function parseFile(file: string): Que[] {
  const lines = readFileSync(join(input, file), 'utf8').split(/\r?\n/); const result: Que[] = []; let current: Que | undefined; let section = ''; let buffer: string[] = [];
  const mainSource = /^dịch kinh tường giải/i.test(file);
  const flush = () => { if (current && section && section !== 'hao') current[section as 'thoan_tu' | 'thoan_truyen' | 'dai_tuong' | 'tieu_tuong'] = buffer.join(' ').trim(); buffer = []; };
  for (const line of lines) {
    const match = line.match(heading);
    if (match) {
      flush(); const number = Number(match[2]); const title = match[3].trim();
      const isHexagram = Boolean(number && number >= 1 && number <= 64 && trigramWord.test(title));
      if (isHexagram && mainSource) { current = { so_thu_tu: number!, ten_que: title.replace(/\*\*/g, '').trim(), thoan_tu: '', thoan_truyen: '', dai_tuong: '', tieu_tuong: '', hao: [], nguon_pdf: file, loai_tai_lieu: '64-que' }; result.push(current); section = 'thoan_tu'; } else if (current) {
        const normalized = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        section = normalized.includes('thoan tu') ? 'thoan_tu' : normalized.includes('thoan truyen') ? 'thoan_truyen' : normalized.includes('dai tuong') ? 'dai_tuong' : normalized.includes('tieu tuong') ? 'tieu_tuong' : normalized.includes('hao') ? 'hao' : '';
      }
    } else if (current && line.trim()) {
      const plain = line.trim().replace(/^>\s*/, '').replace(/^[_*`]+|[_*`]+$/g, '').replace(/^<u>|<\/u>$/g, '').trim();
      const hao = plain.match(/^(Sơ Lục|Sơ Cửu|Lục Nhị|Cửu Nhị|Lục Tam|Cửu Tam|Lục Tứ|Cửu Tứ|Lục Ngũ|Cửu Ngũ|Thượng Lục|Thượng Cửu)\s*[:：.-]?\s*(.*)$/i);
      if (hao) current.hao.push({ ten_hao: hao[1], loi_hao: hao[2] });
      else {
        const label = plain.match(/^(Thoán từ|Thoán truyện|Đại tượng|Tiểu tượng)\s*[:：.-]?\s*(.*)$/i);
        if (label) { flush(); section = label[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(' ', '_'); if (label[2]) buffer.push(label[2]); }
        else buffer.push(plain);
      }
    }
  }
  flush(); return result;
}
function parseSupplement() {
  if (!existsSync(supplementInput)) return [];
  const result: Array<{ so_thu_tu: number; ten_que: string; giai_nghia: Record<string, string> }> = [];
  let current: { so_thu_tu: number; ten_que: string; giai_nghia: Record<string, string> } | undefined;
  for (const line of readFileSync(supplementInput, 'utf8').split(/\r?\n/)) {
    const heading = line.match(/^###\s*(\d{1,2})\.\s*(.+)$/);
    if (heading) { current = { so_thu_tu: Number(heading[1]), ten_que: heading[2].trim(), giai_nghia: {} }; result.push(current); continue; }
    const item = line.match(/^[-*]\s*\*\*([^*]+?)\s*[:：]\*\*\s*(.+)$/);
    if (current && item) current.giai_nghia[item[1].trim()] = item[2].trim();
  }
  mkdirSync(join(process.cwd(), 'src', 'data'), { recursive: true }); writeFileSync(supplementOutput, JSON.stringify(result, null, 2), 'utf8');
  const incomplete = result.filter((record) => Object.keys(record.giai_nghia).length !== 19).map((record) => `${record.so_thu_tu} (${Object.keys(record.giai_nghia).length}/19)`);
  console.log(`Parsed supplemental meanings for ${result.length} hexagrams.`); if (incomplete.length) console.warn(`Incomplete supplemental entries: ${incomplete.join(', ')}`);
  return result;
}
mkdirSync(input, { recursive: true });
const files = existsSync(input) ? readdirSync(input).filter((file) => file.endsWith('.md')) : [];
const parsed = files.flatMap(parseFile); const records = [...new Map(parsed.filter((record) => record.loai_tai_lieu === '64-que').map((record) => [record.so_thu_tu, record])).values()].sort((a, b) => a.so_thu_tu - b.so_thu_tu);
const references = files.filter((file) => !/^dịch kinh tường giải/i.test(file)).map((file) => ({ nguon_pdf: file, loai_tai_lieu: 'tham-khao', ten_que: '', noi_dung: readFileSync(join(input, file), 'utf8') }));
mkdirSync(join(process.cwd(), 'data'), { recursive: true }); writeFileSync(output, JSON.stringify(records, null, 2), 'utf8');
writeFileSync(join(process.cwd(), 'data', 'tai-lieu-tham-khao.json'), JSON.stringify(references, null, 2), 'utf8');
parseSupplement();
const missing = Array.from({ length: 64 }, (_, index) => index + 1).filter((number) => !records.some((record) => record.so_thu_tu === number));
console.log(`Parsed ${records.length} hexagrams from ${files.length} Markdown files.`); if (missing.length) console.warn(`Missing hexagrams: ${missing.join(', ')}`);