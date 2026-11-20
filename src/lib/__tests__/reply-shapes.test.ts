import { describe, it, expect } from 'vitest';
import { REPLY_SHAPES, offeredShapes, replyShapeSection } from '@/lib/reply-shapes';

describe('reply shapes', () => {
  it('offers two different shapes each turn', () => {
    for (let t = 0; t < 30; t++) {
      const [a, b] = offeredShapes(t);
      expect(a.id).not.toBe(b.id);
    }
  });
  it('never offers the same shape two turns in a row', () => {
    for (let t = 0; t < 30; t++) {
      const now = offeredShapes(t).map(s => s.id);
      const next = offeredShapes(t + 1).map(s => s.id);
      expect(now.some(id => next.includes(id))).toBe(false);
    }
  });
  it('uses every shape and survives bad input', () => {
    const seen = new Set<string>();
    for (let t = 0; t < REPLY_SHAPES.length; t++) offeredShapes(t).forEach(s => seen.add(s.id));
    expect(seen.size).toBe(REPLY_SHAPES.length);
    expect(offeredShapes(Number.NaN)[0].id).toBe(REPLY_SHAPES[0].id);
    expect(offeredShapes(-3)[0].id).toBe(REPLY_SHAPES[0].id);
  });
  it('writes the section with both shapes', () => {
    const text = replyShapeSection(0);
    expect(text).toContain('## SHAPE OF THIS REPLY');
    expect(text).toContain(REPLY_SHAPES[0].text);
    expect(text).toContain(REPLY_SHAPES[1].text);
  });
});
