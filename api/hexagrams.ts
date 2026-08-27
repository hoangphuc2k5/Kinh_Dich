import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'node:fs';
import { dataPath } from './_lib';

export default function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

    const dataPathResolved = dataPath('data/64-que.json');
    if (!existsSync(dataPathResolved)) {
      return response.status(500).json({ error: `Không tìm thấy kho dữ liệu quẻ (đã thử ${dataPathResolved}).` });
    }
    const content = readFileSync(dataPathResolved, 'utf8');
    response.json(JSON.parse(content));
  } catch (err) {
    console.error('[api/hexagrams] error:', err);
    response.status(500).json({
      error: 'Không đọc được kho dữ liệu quẻ.',
      detail: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined,
    });
  }
}
