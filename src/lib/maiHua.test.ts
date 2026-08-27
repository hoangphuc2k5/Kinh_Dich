import { describe, expect, it } from 'vitest';
import { calculateHexagram, castNumbers, hexagramName } from './maiHua';

describe('Mai Hoa Dịch Số core', () => {
  it('maps remainder zero to the eighth trigram and sixth line', () => {
    const result = calculateHexagram(8, 16, 12);
    expect(result.upper).toBe('坤'); expect(result.lower).toBe('坤'); expect(result.movingLine).toBe(6);
  });
  it('uses the moving line to choose body and subject', () => {
    expect(calculateHexagram(1, 2, 2).body).toBe('乾');
    expect(calculateHexagram(1, 2, 5).body).toBe('兌');
  });
  it('changes exactly one line', () => {
    const result = castNumbers(31, 14);
    expect(result.changedLines.filter((line, i) => line !== result.lines[i])).toHaveLength(1);
  });
  it('calculates stable hexagram numbers and names', () => {
    const result = calculateHexagram(1, 1, 1);
    expect(result.hexagramNumber).toBe(1); expect(hexagramName(result.hexagramNumber)).toContain('Càn');
  });
  it('supports five independent casts', () => {
    const results = Array.from({ length: 5 }, (_, index) => castNumbers(index + 1, index + 2));
    expect(new Set(results.map((result) => result.hexagramNumber)).size).toBeGreaterThan(1);
  });
  it('classifies all five body-subject element relationships', () => {
    expect(calculateHexagram(3, 4, 1).relationship).toContain('Dụng sinh Thể');
    expect(calculateHexagram(3, 7, 1).relationship).toContain('Thể sinh Dụng');
    expect(calculateHexagram(1, 3, 1).relationship).toContain('Dụng khắc Thể');
    expect(calculateHexagram(1, 4, 1).relationship).toContain('Thể khắc Dụng');
    expect(calculateHexagram(1, 2, 4).relationship).toContain('Tỷ hòa');
  });
});