import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export default function handler(_request: VercelRequest, response: VercelResponse) {
  try {
    const dataPath = resolve(process.cwd(), 'data/64-que.json');
    if (!existsSync(dataPath)) {
      return response.status(500).json({ error: 'Không tìm thấy kho dữ liệu quẻ.' });
    }
    response.json(JSON.parse(readFileSync(dataPath, 'utf8')));
  } catch {
    response.status(500).json({ error: 'Không đọc được kho dữ liệu quẻ.' });
  }
}
