import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'node:fs';
import {
  cleanText,
  enrichReading,
  buildUserPrompt,
  requestDeepSeek,
  missingAnswerParts,
  getSystemPrompt,
  dataPath,
  type ReadingPayload,
  type SourceEntry,
  type DeepSeekMessage,
} from './_lib.js';

export const config = {
  maxDuration: 300,
};

function setCommonHeaders(response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  setCommonHeaders(response);

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { question, readings } = (request.body || {}) as { question?: string; readings?: ReadingPayload[] };
  if (!question?.trim() || !Array.isArray(readings)) {
    return response.status(400).json({ error: 'Vui lòng nhập câu hỏi và gieo ít nhất một quẻ.' });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return response.json({
      text: '⚠️ Chưa cấu hình DEEPSEEK_API_KEY trong Vercel Environment Variables. Vào Project Settings → Environment Variables, thêm DEEPSEEK_API_KEY, sau đó Redeploy.',
    });
  }

  let timeout: NodeJS.Timeout | undefined;

  try {
    const sourceDataPath = dataPath('data/64-que.json');
    const sourceData: SourceEntry[] = existsSync(sourceDataPath)
      ? JSON.parse(readFileSync(sourceDataPath, 'utf8'))
      : [];

    const referencesPath = dataPath('data/tai-lieu-tham-khao.json');
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
    const systemPrompt = getSystemPrompt(readings.length);

    const controller = new AbortController();
    const timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS) || 240000;
    timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    if (timeout) clearTimeout(timeout);
    console.error('[api/interpret] error:', err);
    const error = err as Error & { status?: number; cause?: unknown };
    if (error.status === 429) {
      return response.status(429).json({ error: 'DeepSeek đang giới hạn tần suất. Vui lòng thử lại sau ít phút.' });
    }
    const message = error.message || '';
    if (message.includes('timeout') || message.includes('AbortError') || error.name === 'AbortError') {
      return response.status(504).json({ error: 'Luận giải AI mất quá nhiều thời gian. Vui lòng thử lại sau (timeout).' });
    }
    return response.status(502).json({
      error: 'Không thể kết nối dịch vụ luận giải lúc này. Vui lòng thử lại sau.',
      detail: process.env.NODE_ENV === 'development' ? message : undefined,
    });
  }
}
