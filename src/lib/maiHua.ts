import { Solar } from 'lunar-javascript';

export const TRIGRAMS = ['乾', '兌', '離', '震', '巽', '坎', '艮', '坤'] as const;
export type Trigram = typeof TRIGRAMS[number];
export const TRIGRAM_NAMES: Record<Trigram, string> = {
  乾: 'Càn', 兌: 'Đoài', 離: 'Ly', 震: 'Chấn',
  巽: 'Tốn', 坎: 'Khảm', 艮: 'Cấn', 坤: 'Khôn',
};
export type DivinationMethod = 'numbers' | 'random' | 'datetime';

const ELEMENTS: Record<Trigram, string> = {
  乾: 'Kim', 兌: 'Kim', 離: 'Hỏa', 震: 'Mộc',
  巽: 'Mộc', 坎: 'Thủy', 艮: 'Thổ', 坤: 'Thổ',
};
const GENERATES: Record<string, string> = { Mộc: 'Hỏa', Hỏa: 'Thổ', Thổ: 'Kim', Kim: 'Thủy', Thủy: 'Mộc' };
const CONTROLS: Record<string, string> = { Mộc: 'Thổ', Thổ: 'Thủy', Thủy: 'Hỏa', Hỏa: 'Kim', Kim: 'Mộc' };

export const HEXAGRAM_NAMES = [
  'Càn vi Thiên', 'Khôn vi Địa', 'Thủy Lôi Truân', 'Sơn Thủy Mông', 'Thủy Thiên Nhu', 'Thiên Thủy Tụng', 'Địa Thủy Sư', 'Thủy Địa Tỷ',
  'Phong Thiên Tiểu Súc', 'Thiên Trạch Lý', 'Địa Thiên Thái', 'Thiên Địa Bĩ', 'Thiên Hỏa Đồng Nhân', 'Hỏa Thiên Đại Hữu', 'Địa Sơn Khiêm', 'Lôi Địa Dự',
  'Trạch Lôi Tùy', 'Sơn Phong Cổ', 'Địa Trạch Lâm', 'Phong Địa Quan', 'Hỏa Lôi Phệ Hạp', 'Sơn Hỏa Bí', 'Sơn Địa Bác', 'Địa Lôi Phục',
  'Thiên Lôi Vô Vọng', 'Sơn Thiên Đại Súc', 'Sơn Lôi Di', 'Trạch Phong Đại Quá', 'Khảm vi Thủy', 'Ly vi Hỏa', 'Trạch Sơn Hàm', 'Lôi Phong Hằng',
  'Thiên Sơn Độn', 'Lôi Thiên Đại Tráng', 'Hỏa Địa Tấn', 'Địa Hỏa Minh Di', 'Phong Hỏa Gia Nhân', 'Hỏa Trạch Khuê', 'Thủy Sơn Kiển', 'Lôi Thủy Giải',
  'Sơn Trạch Tổn', 'Phong Lôi Ích', 'Trạch Thiên Quải', 'Thiên Phong Cấu', 'Trạch Địa Tụy', 'Địa Phong Thăng', 'Trạch Thủy Khốn', 'Thủy Phong Tỉnh',
  'Trạch Hỏa Cách', 'Hỏa Phong Đỉnh', 'Chấn vi Lôi', 'Cấn vi Sơn', 'Phong Sơn Tiệm', 'Lôi Trạch Quy Muội', 'Lôi Hỏa Phong', 'Hỏa Sơn Lữ',
  'Tốn vi Phong', 'Đoài vi Trạch', 'Phong Thủy Hoán', 'Thủy Trạch Tiết', 'Phong Trạch Trung Phu', 'Lôi Sơn Tiểu Quá', 'Thủy Hỏa Ký Tế', 'Hỏa Thủy Vị Tế',
] as const;

const NAME_TO_TRIGRAM: Record<string, Trigram> = {
  'Thiên': '乾', 'Càn': '乾', '乾': '乾',
  'Địa': '坤', 'Khôn': '坤', '坤': '坤',
  'Trạch': '兌', 'Đoài': '兌', '兌': '兌',
  'Hỏa': '離', 'Ly': '離', '離': '離',
  'Lôi': '震', 'Chấn': '震', '震': '震',
  'Phong': '巽', 'Tốn': '巽', '巽': '巽',
  'Thủy': '坎', 'Khảm': '坎', '坎': '坎',
  'Sơn': '艮', 'Cấn': '艮', '艮': '艮',
};

function parseTrigramsFromName(name: string): { upper: Trigram; lower: Trigram } {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 3 && parts[1] === 'vi') {
    const pure = NAME_TO_TRIGRAM[parts[0]] ?? '坤';
    return { upper: pure, lower: pure };
  }
  if (parts.length >= 2) {
    const upper = NAME_TO_TRIGRAM[parts[0]] ?? '坤';
    const lower = NAME_TO_TRIGRAM[parts[1]] ?? '坤';
    return { upper, lower };
  }
  return { upper: '坤', lower: '坤' };
}

const KING_WEN_LOOKUP: Record<string, number> = {};
HEXAGRAM_NAMES.forEach((name, idx) => {
  const { upper, lower } = parseTrigramsFromName(name);
  KING_WEN_LOOKUP[`${upper}-${lower}`] = idx + 1;
});

export interface HexagramResult {
  upper: Trigram; lower: Trigram; changedUpper: Trigram; changedLower: Trigram;
  hexagramNumber: number; changedNumber: number; movingLine: number;
  lines: boolean[]; changedLines: boolean[]; body: Trigram; subject: Trigram;
  bodyElement: string; subjectElement: string; relationship: string;
  mutualUpper: Trigram; mutualLower: Trigram;
  source: 'numbers' | 'random' | 'datetime'; input: [number, number];
}

const remainder = (value: number, base: number) => ((value - 1) % base + base) % base + 1;
const trigramAt = (value: number) => TRIGRAMS[remainder(value, 8) - 1];
const numberFor = (upper: Trigram, lower: Trigram) => KING_WEN_LOOKUP[`${upper}-${lower}`] ?? 1;
const linesFor = (trigram: Trigram): boolean[] => ({
  乾: [true, true, true], 兌: [true, true, false], 離: [true, false, true], 震: [true, false, false],
  巽: [false, true, true], 坎: [false, true, false], 艮: [false, false, true], 坤: [false, false, false],
}[trigram]);
function trigramFromBits(bits: boolean[]): Trigram {
  const known: Record<string, Trigram> = {
    '111': '乾', '110': '兌', '101': '離', '001': '震', '011': '巽', '010': '坎', '100': '艮', '000': '坤',
  };
  return known[bits.map((bit) => bit ? '1' : '0').join('')] ?? '坤';
}

export function calculateHexagram(upperNumber: number, lowerNumber: number, movingLineNumber: number, source: HexagramResult['source'] = 'numbers'): HexagramResult {
  const upper = trigramAt(upperNumber); const lower = trigramAt(lowerNumber);
  const movingLine = remainder(movingLineNumber, 6);
  const lines = [...linesFor(lower), ...linesFor(upper)];
  const changedLines = lines.map((line, index) => index === movingLine - 1 ? !line : line);
  const changedLower = trigramFromBits(changedLines.slice(0, 3));
  const changedUpper = trigramFromBits(changedLines.slice(3, 6));
  const body = movingLine <= 3 ? upper : lower;
  const subject = movingLine <= 3 ? lower : upper;
  const bodyElement = ELEMENTS[body]; const subjectElement = ELEMENTS[subject];
  const relationship = bodyElement === subjectElement ? 'Tỷ hòa, thuận' :
    GENERATES[bodyElement] === subjectElement ? 'Thể sinh Dụng, hao tổn' :
    GENERATES[subjectElement] === bodyElement ? 'Dụng sinh Thể, tốt' :
    CONTROLS[bodyElement] === subjectElement ? 'Thể khắc Dụng, chậm mà thành' :
    'Dụng khắc Thể, bất lợi';
  return { upper, lower, changedUpper, changedLower, hexagramNumber: numberFor(upper, lower), changedNumber: numberFor(changedUpper, changedLower), movingLine, lines, changedLines, body, subject, bodyElement, subjectElement, relationship, mutualUpper: trigramFromBits(lines.slice(2, 5)), mutualLower: trigramFromBits(lines.slice(1, 4)), source, input: [upperNumber, lowerNumber] };
}

export function castNumbers(first: number, second: number): HexagramResult {
  return calculateHexagram(first, second, first + second, 'numbers');
}

export function castRandom(): HexagramResult {
  const first = Math.floor(Math.random() * 9999) + 1; const second = Math.floor(Math.random() * 9999) + 1;
  return calculateHexagram(first, second, first + second, 'random');
}

export function castDateTime(date = new Date()): HexagramResult {
  const vnOffset = 420;
  const vietnamTime = new Date(date.getTime() + (date.getTimezoneOffset() + vnOffset) * 60000);
  const lunar = Solar.fromYmd(vietnamTime.getFullYear(), vietnamTime.getMonth() + 1, vietnamTime.getDate()).getLunar();

  const zhiNames = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ZHI_ORDER_BY_INDEX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const hour = vietnamTime.getHours();
  const hourZhiIdx = (hour === 23 || hour < 1) ? 0
    : Math.floor((hour + 1) / 2);
  const hourNumber = ZHI_ORDER_BY_INDEX[hourZhiIdx] ?? 1;

  const yearZhiIndex = lunar.getYearZhiIndex();
  const yearNumber = ZHI_ORDER_BY_INDEX[yearZhiIndex] ?? 1;

  const monthNumber = lunar.getMonth();
  const dayNumber = lunar.getDay();

  const upper = yearNumber + monthNumber + dayNumber;
  const lower = upper + hourNumber;
  const moving = lower;

  return calculateHexagram(upper, lower, moving, 'datetime');
}

export function hexagramName(number: number) { return HEXAGRAM_NAMES[(number - 1) % HEXAGRAM_NAMES.length]; }