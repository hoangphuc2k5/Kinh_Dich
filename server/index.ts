import 'dotenv/config';
import express from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function cleanText(raw: string | undefined | null, maxChars = 800): string {
  if (!raw) return '';
  let text = String(raw);
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\[(\d+)\]/g, ' ');
  text = text.replace(/[�□■▲▼◆◇○△●▫▪▬▭▮▯]/g, ' ');
  text = text.replace(/\s+[_*`]+|[_*`]+\s+/g, ' ').replace(/^[_*`]+|[_*`]+$/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxChars) {
    const cut = text.lastIndexOf(' ', maxChars - 50);
    text = text.slice(0, cut > 0 ? cut : maxChars) + '...';
  }
  return text;
}

const HAO_INDEX_TO_LABEL: Record<number, string[]> = {
  1: ['Sơ Cửu', 'Sơ Lục', 'Sơ'],
  2: ['Cửu Nhị', 'Lục Nhị', 'Nhị'],
  3: ['Cửu Tam', 'Lục Tam', 'Tam'],
  4: ['Cửu Tứ', 'Lục Tứ', 'Tứ'],
  5: ['Cửu Ngũ', 'Lục Ngũ', 'Ngũ'],
  6: ['Thượng Cửu', 'Thượng Lục', 'Thượng'],
};

function matchMovingLine(haoArray: Array<{ ten_hao: string; loi_hao: string }> | undefined, movingLine: number, isYang: boolean): { ten_hao: string; loi_hao: string } | null {
  if (!Array.isArray(haoArray) || !haoArray.length) return null;
  const labels = HAO_INDEX_TO_LABEL[movingLine] || [];
  const matched = haoArray.find((h) => labels.some((label) => h.ten_hao && h.ten_hao.toLowerCase().includes(label.toLowerCase())));
  if (matched) return matched;
  const idx = movingLine - 1;
  if (haoArray[idx]) return haoArray[idx];
  return haoArray[haoArray.length - 1] || null;
}

type HaoText = { ten_hao: string; loi_hao: string };
type SourceEntry = {
  so_thu_tu: number;
  ten_que?: string;
  thoan_tu?: string;
  thoan_truyen?: string;
  dai_tuong?: string;
  tieu_tuong?: string;
  hao?: HaoText[];
  nguon_pdf?: string;
  loai_tai_lieu?: string;
};

type ReadingPayload = {
  hexagramNumber: number;
  changedNumber?: number;
  movingLine?: number;
  lines?: boolean[];
  upper?: string;
  lower?: string;
  body?: string;
  subject?: string;
  bodyElement?: string;
  subjectElement?: string;
  relationship?: string;
  [key: string]: unknown;
};

function readRawMdExcerpt(nguonPdf: string | undefined, soThuTu: number, movingLine: number): string {
  if (!nguonPdf) return '';
  const mdPath = resolve('data', 'markdown-processed', nguonPdf);
  if (!existsSync(mdPath)) return '';
  try {
    const raw = readFileSync(mdPath, 'utf8');
    const heading = new RegExp(`^#{1,6}\\s*${String(soThuTu).padStart(1, '0')}[.、\\s-]`, 'm');
    const nextHeading = /^\s*#{1,6}\s/m;
    const startMatch = raw.match(heading);
    if (!startMatch || typeof startMatch.index !== 'number') return '';
    const from = startMatch.index;
    const rest = raw.slice(from + (startMatch[0]?.length || 0));
    const endMatch = rest.match(nextHeading);
    const to = endMatch && typeof endMatch.index === 'number' ? from + (startMatch[0]?.length || 0) + endMatch.index : raw.length;
    let section = raw.slice(from, to);
    section = section.replace(/<[^>]+>/g, ' ').replace(/[�□■▲▼◆◇○△●▫▪▬▭▮▯]/g, ' ');
    section = section.replace(/\r?\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim();
    const haoLines = (HAO_INDEX_TO_LABEL[movingLine] || []).map((l) => l.replace(/\s+/g, '\\s*')).join('|');
    if (haoLines) {
      const haoRe = new RegExp(`(${haoLines})`, 'i');
      const haoIdx = section.search(haoRe);
      if (haoIdx > 0) {
        const left = Math.max(0, haoIdx - 400);
        const right = Math.min(section.length, haoIdx + 700);
        section = section.slice(left, right);
        if (left > 0) section = '...' + section;
        if (right < section.length) section = section + '...';
      }
    }
    if (section.length > 1500) section = section.slice(0, 1500) + '...';
    return section.trim();
  } catch {
    return '';
  }
}

function enrichReading(reading: ReadingPayload, sourceEntry: SourceEntry | undefined) {
  const movingLine = reading.movingLine ?? 0;
  const isYang = Array.isArray(reading.lines) ? Boolean(reading.lines[movingLine - 1]) : true;
  const matchedHao = matchMovingLine(sourceEntry?.hao, movingLine, isYang);
  const rawExcerpt = sourceEntry?.nguon_pdf
    ? readRawMdExcerpt(sourceEntry.nguon_pdf, sourceEntry.so_thu_tu, movingLine)
    : '';
  const sourceExcerpt = sourceEntry ? {
    so_thu_tu: sourceEntry.so_thu_tu,
    ten_que: cleanText(sourceEntry.ten_que, 120),
    nguon: sourceEntry.nguon_pdf ? sourceEntry.nguon_pdf.replace(/\.md$/i, '') : undefined,
    thoan_tu: cleanText(sourceEntry.thoan_tu, 600),
    thoan_truyen: cleanText(sourceEntry.thoan_truyen, 400),
    dai_tuong: cleanText(sourceEntry.dai_tuong, 300),
    hao_dong: matchedHao ? {
      ten_hao: cleanText(matchedHao.ten_hao, 40),
      loi_hao: cleanText(matchedHao.loi_hao, 500),
    } : null,
    trich_doan_md_goc: cleanText(rawExcerpt, 1400) || undefined,
  } : null;
  return {
    stt: reading.hexagramNumber,
    stt_bien: reading.changedNumber,
    hao_dong_vi_tri: movingLine,
    hao_dong_ban_chat: isYang ? 'Dương (Cửu)' : 'Âm (Lục)',
    quan_he_the_dung: reading.relationship,
    the: reading.bodyElement ? `${reading.body} · ${reading.bodyElement}` : undefined,
    dung: reading.subjectElement ? `${reading.subject} · ${reading.subjectElement}` : undefined,
    nguon_tai_lieu: sourceExcerpt,
  };
}

function buildUserPrompt(question: string, readingsCount: number, contextBlocks: string[]): string {
  const cleanQ = cleanText(question, 500);
  const countWarning = readingsCount === 1
    ? '=== DỮ LIỆU GỐC: ĐƯỢC GIEO 1 QUẢ (tuyệt đối không được nói thành "nhiều quẻ", "4 quẻ", hay bất kỳ con số nào khác 1) ==='
    : `=== DỮ LIỆU GỐC: ĐƯỢC GIEO ${readingsCount} QUẢ (số lượng CHÍNH XÁC = ${readingsCount} — TUYỆT ĐỐI CẤM NÓI SAI THÀNH 4, 3, hay bất kỳ con số nào khác ${readingsCount}) ===`;
  const independentNote = readingsCount >= 2
    ? `LƯU Ý SỐ 1 — CỰC QUAN TRỌNG, BẮT BUỘC ĐỌC TRƯỚC KHI VIẾT: ${readingsCount} quẻ [QUẢ 1] → [QUẢ ${readingsCount}] dưới đây đều là NHỮNG LẦN GIEO ĐỘC LẬP, tương ứng ${readingsCount} VỊ TRÍ KHÁC NHAU TRÊN BÀN TRẢI. **ĐÂY KHÔNG PHẢI** "quẻ gốc / quẻ biến / quẻ hỗ / biến hỗ" của cùng 1 lần gieo. Mỗi quẻ i đều có "quẻ biến" của riêng nó (đã ghi rõ trong block [QUẢ i]), nhưng bạn TUYỆT ĐỐI KHÔNG ĐƯỢC viết "QUẢ 2 biến từ QUẢ 1", hay "QUẢ 3 là quẻ hỗ của QUẢ 1". Chúng là các trải riêng biệt, chỉ liên kết với nhau về mặt ngũ hành & tính chất luận lý, không có quan hệ biến đổi gốc-phát sinh.`
    : '';
  return [
    countWarning,
    '',
    independentNote,
    independentNote ? '' : '',
    `CÂU HỎI: ${cleanQ}`,
    '',
    `TỔNG SỐ QUẢ ĐƯỢC GIEO: ${readingsCount} quẻ. Mở đầu BẮT BUỘC: "Dưới đây là luận giải cho chuỗi ${readingsCount} quẻ được gieo:" rồi mới đi vào chi tiết.`,
    '',
    `NGUỒN DỮ LIỆU ĐÃ LỌC (${readingsCount} quẻ theo đúng thứ tự gieo vị trí 1 → ${readingsCount}):`,
    '---',
    ...contextBlocks,
    '---',
    'YÊU CẦU LUẬN GIẢI (TUYỆT ĐỐI TUÂN THỦ):',
    `0. Luôn xác nhận số lượng quẻ ngay đầu câu: "Dưới đây là luận giải cho chuỗi ${readingsCount} quẻ được gieo:" — sau đó mới đi vào từng mục. Tuyệt đối không được nói "4 quẻ", "3 quẻ", hay bất kỳ con số nào khác ${readingsCount}. Nếu vi phạm đây là lỗi nghiêm trọng.`,
    readingsCount >= 2 ? `0b. Lặp lại LƯU Ý SỐ 1: ${readingsCount} quẻ đều là vị trí độc lập trên bàn trải (5 vòng tròn / 7 chữ thập). Hãy phân tích từng vị trí QUẢ 1 → QUẢ ${readingsCount}, sau đó mới chỉ ra liên kết ngũ hành giữa chúng. KHÔNG BAO GIỜ gọi chúng là "gốc/biến/hỗ" của nhau.` : '',
    '1. Bám sát các đoạn trích dẫn gốc ở trên, không bịa lời kinh hoặc tự suy diễn ngoài nguồn.',
    `2. Phân tích rõ Thể / Dụng, quan hệ ngũ hành (sinh / khắc / hòa), và ý nghĩa HÀO ĐỘNG (vị trí + bản chất âm/dương + lời hào) cho TỪNG quẻ một — TỪNG QUẢ 1 MỤC RIÊNG, TIÊU ĐỀ **QUẢ 1**, **QUẢ 2**, …, **QUẢ ${readingsCount}**.`,
    `3. Mạch liên kết: Vì có ${readingsCount} quẻ vị trí độc lập, hãy chỉ ra: xu hướng dòng thời gian (QUẢ 1 = đầu → QUẢ ${readingsCount} = cuối); so sánh ngũ hành sinh khắc giữa các vị trí; nếu N=7 thì có thể liên hệ 7 vị trí kinh điển: 1=Môn thân 2=Môn đối 3=Quỷ tiêu 4=Sinh khí 5=Văn khúc 6=Phúc đức 7=Tổng kết (nếu không chắc thì chỉ nói theo thứ tự 1→${readingsCount}).`,
    '4. Áp dụng vào câu hỏi cụ thể của người hỏi, không chung chung.',
    '5. Kết luận bằng lời khuyên thực tế, mang tính chiêm nghiệm triết lý, rõ ràng đây chỉ là tham khảo chứ không phải tiên đoán chắc chắn.',
    `6. Trả lời ĐỦ 5 PHẦN (Mở đầu → Phần 1..4 → Phần 5 KIỂM TRA), không cắt ngang giữa chừng. Với ${readingsCount} quẻ, mỗi mục QUẢ chỉ cần 1-2 đoạn cô đọng; luôn dành đủ dung lượng cho PHẦN 2, PHẦN 3, PHẦN 4 và PHẦN 5.`,
    '7. CUỐI CÙNG BẮT BUỘC PHẢI CÓ đoạn "KIỂM TRA SỐ QUẢ ĐÃ LUẬN GIẢI: 1,2,…,N (tổng cộng = N/N ✅)" — nếu thiếu 1 quẻ nào thì viết bổ sung NGAY TRƯỚC đoạn kiểm tra.',
  ].filter(Boolean).join('\n');
}

type DeepSeekMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
};

function missingAnswerParts(text: string, readingsCount: number): string[] {
  const normalized = text.normalize('NFC').toUpperCase();
  const missing: string[] = [];
  for (let index = 1; index <= readingsCount; index += 1) {
    if (!new RegExp(`QUẢ\\s*${index}\\b`).test(normalized)) missing.push(`QUẢ ${index}`);
  }
  if (readingsCount > 1 && !normalized.includes('MẠCH LIÊN KẾT')) missing.push('PHẦN 2 — MẠCH LIÊN KẾT');
  if (!normalized.includes('ÁP DỤNG VÀO CÂU HỎI') && !normalized.includes('ÁP DỤNG VÀO CÂU HỎI CỤ THỂ')) missing.push('PHẦN 3 — ÁP DỤNG');
  if (!normalized.includes('LỜI KHUYÊN THỰC TẾ')) missing.push('PHẦN 4 — LỜI KHUYÊN');
  if (!normalized.includes('KIỂM TRA SỐ QUẢ')) missing.push('PHẦN 5 — KIỂM TRA');
  return missing;
}

async function requestDeepSeek(messages: DeepSeekMessage[], maxTokens: number, signal: AbortSignal): Promise<{ text: string; finishReason?: string }> {
  const endpoint = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const result = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.08,
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!result.ok) {
    const error = new Error(result.status === 429 ? 'RATE_LIMIT' : 'UPSTREAM_ERROR');
    (error as Error & { status?: number }).status = result.status;
    throw error;
  }
  const data = await result.json() as DeepSeekResponse;
  return {
    text: data.choices?.[0]?.message?.content || '',
    finishReason: data.choices?.[0]?.finish_reason,
  };
}

const app = express(); app.use(express.json({ limit: '3mb' }));

app.get('/api/hexagrams', (_request, response) => {
  try { response.json(JSON.parse(readFileSync(resolve('data/64-que.json'), 'utf8'))); }
  catch { response.status(500).json({ error: 'Không đọc được kho dữ liệu quẻ.' }); }
});

app.post('/api/interpret', async (request, response) => {
  const { question, readings } = request.body as { question?: string; readings?: ReadingPayload[] };
  if (!question?.trim() || !Array.isArray(readings)) return response.status(400).json({ error: 'Vui lòng nhập câu hỏi và gieo ít nhất một quẻ.' });
  if (!process.env.DEEPSEEK_API_KEY) return response.json({ text: 'Chưa cấu hình DeepSeek API. Kết quả an quẻ đã sẵn sàng; hãy thêm DEEPSEEK_API_KEY vào .env để bật luận giải AI.' });

  // Declared here (outside try) so it's still in scope inside the catch block below.
  let timeout: NodeJS.Timeout | undefined;

  try {
    const sourceDataPath = resolve('data/64-que.json');
    const sourceData: SourceEntry[] = existsSync(sourceDataPath)
      ? JSON.parse(readFileSync(sourceDataPath, 'utf8'))
      : [];

    const referencesPath = resolve('data/tai-lieu-tham-khao.json');
    const references: Array<{ nguon_pdf?: string; noi_dung?: string }> = existsSync(referencesPath)
      ? JSON.parse(readFileSync(referencesPath, 'utf8'))
      : [];

    const contextBlocks: string[] = [];
    readings.forEach((reading, idx) => {
      const sourceEntry = sourceData.find((item) => item.so_thu_tu === reading.hexagramNumber);
      const enriched = enrichReading(reading, sourceEntry);
      const src = enriched.nguon_tai_lieu;
      const block = [
        `[QUẺ ${idx + 1}] Số ${enriched.stt} (Quẻ biến: ${enriched.stt_bien || '—'})`,
        src?.ten_que ? `Tên quẻ: ${src.ten_que}` : '',
        `Hào động: vị trí ${enriched.hao_dong_vi_tri} · ${enriched.hao_dong_ban_chat}`,
        enriched.quan_he_the_dung ? `Quan hệ Thể-Dụng: ${enriched.quan_he_the_dung}` : '',
        enriched.the ? `Thể: ${enriched.the}` : '',
        enriched.dung ? `Dụng: ${enriched.dung}` : '',
        src?.nguon ? `Nguồn tài liệu: ${src.nguon}` : '',
        src?.thoan_tu ? `— Thoán từ: ${src.thoan_tu}` : '',
        src?.thoan_truyen ? `— Thoán truyện: ${src.thoan_truyen}` : '',
        src?.dai_tuong ? `— Đại tượng: ${src.dai_tuong}` : '',
        src?.hao_dong?.ten_hao ? `— Lời hào động (${src.hao_dong.ten_hao}): ${src.hao_dong.loi_hao || '(đang thiếu lời hào)'}` : '',
        src?.trich_doan_md_goc ? `— Trích đoạn gốc từ file MD (quanh hào động): ${src.trich_doan_md_goc}` : '',
      ].filter(Boolean).join('\n');
      contextBlocks.push(block);
    });

    if (references.length) {
      const refBlurb = references
        .slice(0, 2)
        .map((r) => `[Tham khảo: ${r.nguon_pdf?.replace(/\.md$/i, '') || 'Nguồn khác'}] ${cleanText(r.noi_dung, 1200)}`)
        .join('\n\n');
      if (refBlurb) contextBlocks.push(`TÀI LIỆU THAM KHẢO BỔ SUNG (đã cắt gọn):\n${refBlurb}`);
    }

    const userPrompt = buildUserPrompt(question, readings.length, contextBlocks);
    const systemPrompt = `Bạn là nhà luận giải Kinh Dịch (Mai Hoa Dịch Số) có học vấn, điềm đạm, phân tích dựa trên văn bản gốc được cung cấp. TUYỆT ĐỐI 1 — LƯU Ý CỰC KỲ QUAN TRỌNG VỀ DỮ LIỆU ĐẦU VÀO: Toàn bộ "QUẢ 1, QUẢ 2, …, QUẢ N" được liệt kê trong NGUỒN DỮ LIỆU đều là những QUẢ ĐƯỢC GIEO ĐỘC LẬP, TỪNG LẦN MỘT, theo 1 trải N quẻ tại N VỊ TRÍ KHÁC NHAU trên bàn trải (ví dụ trải 5 hình vòng tròn, trải 7 hình chữ thập). **ĐÂY KHÔNG PHẢI LÀ** "Quẻ gốc / Quẻ biến / Quẻ hỗ / Biến hỗ" của cùng 1 lần gieo duy nhất. Mỗi QUẺ i đều CÓ QUẢ BIẾN CỦA RIÊNG NÓ (thuộc tính bên trong mỗi quẻ), nhưng bạn TUYỆT ĐỐI KHÔNG ĐƯỢC gọi QUẢ 2 là "quẻ biến của QUẢ 1", không được gọi QUẢ 3 là "quẻ hỗ của QUẢ 1" — chúng là 2 trải quẻ HOÀN TOÀN RIÊNG BIỆT, vị trí 1 và 2 và 3 trên bàn trải. Bám sát chặt chẽ các đoạn trích dẫn gốc được cung cấp; nếu nguồn thiếu hãy nói rõ là "dữ liệu hiện có chưa ghi nhận". TUYỆT ĐỐI 2 — KHÔNG NÓI SAI SỐ LƯỢNG QUẢ: nếu dữ liệu gốc nói có N quẻ thì TOÀN BỘ câu trả lời đều phải nói đúng N quẻ. Ví dụ N=5 mà bạn nói "4 quẻ" là lỗi SỬA NGAY; N=7 mà bạn nói "6 quẻ" cũng là lỗi sửa ngay. TUYỆT ĐỐI 3 — PHẢI LUẬN GIẢI ĐỦ N QUẢ, TỪNG QUẢ 1 MỤC RIÊNG CÓ TIÊU ĐỀ **QUẢ 1** đến **QUẢ N** BÔI ĐẬM. BẤT KỲ QUẢ NÀO CÓ TRONG NGUỒN MÀ BỊ BỎ QUÁ LÀ LỖI; NGAY CẢ NGHĨA ĐÔI CŨNG PHẢI NÓI NGẮN GỌN, KHÔNG ĐƯỢC BỎ TRỐN. TUYỆT ĐỐI 4 — QUẢ CUỐI CÙNG (QUẢ N) LÀ QUẢ "VỊ TRÍ KẾT QUẢ CUỐI" CỦA TOÀN BỘ TRẢI QUẢ, DO ĐÓ PHẢI ĐƯỢC VIẾT ĐẦY ĐỦ VÀ RÕ NHẤT, TUYỆT ĐỐI KHÔNG ĐƯỢC BỎ. CẤU TRÚC CÂU TRẢ LỜI BẮT BUỘC — BẠN PHẢI VIẾT ĐÚNG TIÊU ĐỀ MARKDOWN SAO CHO Y HỆT, KHÔNG ĐƯỢC TỰ PHÁT MINH TIÊU ĐỀ KHÁC (ví dụ không được viết "Từng quẻ", "Quẻ gốc"…):

### MỞ ĐẦU
Dưới đây là luận giải cho chuỗi [N] quẻ được gieo:

### PHẦN 1 — Ý NGHĨA TỪNG QUẢ + HÀO ĐỘNG (PHẢI CÓ ĐỦ [N] MỤC CON RIÊNG BIỆT)
#### **QUẢ 1**  
Nội dung giải nghĩa QUẢ 1: tên quẻ, Thể-Dụng, ngũ hành, ý nghĩa thoán từ, hào động chi tiết (dựa vào nguồn), quẻ biến của RIÊNG QUẢ NÀY (nếu nói đến).
#### **QUẢ 2**  
Nội dung giải nghĩa QUẢ 2 (định dạng y hệt QUẢ 1).
#### **QUẢ 3**  
Nội dung giải nghĩa QUẢ 3.
#### **QUẢ 4**  
Nội dung giải nghĩa QUẢ 4.
#### **QUẢ 5**  
Nội dung giải nghĩa QUẢ 5 (Nếu N ≥ 5 thì bắt buộc phải có mục này).
#### **QUẢ 6**  
Nội dung giải nghĩa QUẢ 6 (Nếu N ≥ 6 thì bắt buộc phải có mục này).
#### **QUẢ 7**  
Nội dung giải nghĩa QUẢ 7 — viết chi tiết & rõ nhất vì đây là vị trí kết quả cuối cùng (Nếu N ≥ 7 thì bắt buộc phải có mục này).
…(tiếp tục QUẢ 8, 9… nếu có)

### PHẦN 2 — MẠCH LIÊN KẾT GIỮA CÁC QUẢ
So sánh sinh / khắc / hòa ngũ hành của TỪNG QUẢ so với câu hỏi; chỉ ra xu hướng theo dòng thời gian QUẢ 1 (bắt đầu) → QUẢ N (kết thúc); liên hệ vị trí trải (N=5: 5 vị trí vòng tròn; N=7: 7 vị trí hình chữ thập thường là 1=Môn thân 2=Môn đối 3=Quỷ tiêu 4=Sinh khí 5=Văn khúc 6=Phúc đức 7=Tổng kết; nếu không chắc thì chỉ nói theo thứ tự 1→N); chỉ ra điểm mạnh / điểm yếu xuyên suốt. **QUAN TRỌNG: KHÔNG ĐƯỢC NÓI "QUẢ 2 BIẾN TỪ QUẢ 1" — CHÚNG LÀ 2 TRẢI ĐỘC LẬP, chỉ so sánh TÍNH CHẤT VỚI NHAU.**

### PHẦN 3 — ÁP DỤNG VÀO CÂU HỎI CỤ THỂ
Liên hệ trực tiếp nội dung câu hỏi người dùng đã đặt, không chung chung, trích dẫn những ý chính từ PHẦN 1 & PHẦN 2.

### PHẦN 4 — LỜI KHUYÊN THỰC TẾ
3-7 lời khuyên cụ thể, hành động được ngay, tích cực nhưng thận trọng; nhấn mạnh đây chỉ là góc nhìn tham khảo, quyết định cuối thuộc về người hỏi.

### PHẦN 5 — KIỂM TRA SỐ QUẢ ĐÃ LUẬN GIẢI (BẮT BUỘC PHẢI CÓ ĐOẠN CUỐI NÀY)
Sau khi viết xong 4 phần trên, HÃY ĐẾM LẠI SỐ MỤC **QUẢ 1…QUẢ N** bạn đã viết ở PHẦN 1. Nếu thực tế ít hơn N → bạn PHẢI VIẾT BỔ SUNG NGAY CÁC QUẢ CÒN THIẾU (trong PHẦN 1) NGAY TRƯỚC đoạn kiểm tra này. Sau đó viết:
"KIỂM TRA SỐ QUẢ ĐÃ LUẬN GIẢI: 1, 2, 3, …, [N] (tổng cộng = [N]/[N] ✅)"

Trả lời tiếng Việt, dùng sắc thái trang trọng, chiêm nghiệm nhưng dễ hiểu; KHÔNG CẮT NGANG GIỮA CHỮA NÀO, viết dài cho hết ý cho đến khi hoàn thành 5 phần trên. Không bịa lời kinh, không đưa ra tiên đoán chắc chắn 100%.`;

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), Number(process.env.DEEPSEEK_TIMEOUT_MS) || 180000);

    const messages: DeepSeekMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    let answer = '';
    let finishReason: string | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await requestDeepSeek(messages, 8192, controller.signal);
      answer += result.text;
      finishReason = result.finishReason;
      const missing = missingAnswerParts(answer, readings.length);
      if (!missing.length && finishReason !== 'length') break;
      if (attempt === 2) break;
      messages.push({ role: 'assistant', content: result.text });
      messages.push({
        role: 'user',
        content: `Câu trả lời vừa bị thiếu hoặc bị cắt. Hãy viết tiếp ngay, chỉ bổ sung các mục sau: ${missing.join('; ') || 'phần còn lại của mục đang viết'}. Không nhắc lại phần đã có, không mở đầu lại. Kết thúc bằng mục KIỂM TRA SỐ QUẢ ĐÃ LUẬN GIẢI với đúng ${readings.length} quẻ.`,
      });
    }
    clearTimeout(timeout);
    return response.json({ text: answer || 'DeepSeek không trả về nội dung luận giải.' });

  } catch (err) {
    clearTimeout(timeout);
    console.error('Interpret error:', err);
    const status = (err as Error & { status?: number }).status;
    if (status === 429) return response.status(429).json({ error: 'DeepSeek đang giới hạn tần suất. Vui lòng thử lại sau ít phút.' });
    return response.status(502).json({ error: 'Không thể kết nối dịch vụ luận giải lúc này. Vui lòng thử lại sau.' });
  }
});

app.listen(Number(process.env.PORT) || 8787, () => console.log('Mai Hoa API listening on port 8787'));