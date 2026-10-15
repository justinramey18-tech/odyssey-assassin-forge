import { describe, it, expect } from 'vitest';
import { freshFeelings, pickNextBehavior, tickFeelings, notifyAlert, variantFor, Feelings } from '../companion-idle';

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function count(temperament: 'feral' | 'sentinel' | 'reckless' | 'cunning', kind: string) {
  const r = seeded(7); let n = 0; const f = { ...freshFeelings() };
  for (let i = 0; i < 2000; i++) { const d = pickNextBehavior(f, { head: 'canid', temperament }, 25, r); if (d && d !== 'sleep' && d.kind === kind) n++; }
  return n;
}

describe('companion idle director', () => {
  it('temperament changes how often behaviours happen', () => {
    expect(count('reckless', 'spark')).toBeGreaterThan(count('sentinel', 'spark'));
    expect(count('sentinel', 'watch')).toBeGreaterThan(count('reckless', 'watch'));
  });
  it('reptiles never do a fur shake; constructs vent instead of yawning', () => {
    expect(variantFor('shake', 'reptile')).toBe('ripple');
    expect(variantFor('sniff', 'reptile')).toBe('tongue');
    expect(variantFor('yawn', 'visor')).toBe('vent');
    expect(variantFor('shake', 'beaked')).toBe('ruffle');
  });
  it('long idle with low energy reaches sleep', () => {
    const r = seeded(3); const f: Feelings = { ...freshFeelings(), energy: 0.1 };
    let slept = false;
    for (let i = 0; i < 20; i++) if (pickNextBehavior(f, { head: 'canid', temperament: 'feral' }, 60, r) === 'sleep') slept = true;
    expect(slept).toBe(true);
  });
  it('never sleeps early in the quiet rhythm', () => {
    const r = seeded(5); const f: Feelings = { ...freshFeelings(), energy: 0.1 };
    for (let i = 0; i < 200; i++) expect(pickNextBehavior(f, { head: 'canid', temperament: 'reckless' }, 5, r)).not.toBe('sleep');
  });
  it('a guardian moment lowers safety, then it recovers', () => {
    const after = notifyAlert(freshFeelings());
    expect(after.safety).toBeLessThan(0.5);
    let f = after; for (let i = 0; i < 300; i++) f = tickFeelings(f, 0.05, 'sentinel', 3, false);
    expect(f.safety).toBeGreaterThan(after.safety);
  });
  it('ignores bad time steps', () => {
    const f = freshFeelings();
    expect(tickFeelings(f, NaN, 'feral', 0, false)).toBe(f);
  });
});
