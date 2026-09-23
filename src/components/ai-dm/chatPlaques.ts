import type React from 'react';

/** Small horizontal plaque frame used for one-line chat summaries. */
export const PILL = (url: string): React.CSSProperties => ({
  height: 30,
  borderStyle: 'solid',
  borderWidth: '0 26px',
  borderImage: `url(${url}) 0 134 0 134 fill / 0 26px stretch`,
});

/** Wider arcane ribbon frame, used for spell lines. */
export const RIBBON = (url: string): React.CSSProperties => ({
  height: 34,
  borderStyle: 'solid',
  borderWidth: '0 34px',
  borderImage: `url(${url}) 0 150 0 150 fill / 0 34px stretch`,
});

export interface ParsedDiceRoll {
  label: string;
  rolls: { value: string; dropped: boolean }[];
  modifier?: string;
  total: string;
  crit?: 'nat20' | 'nat1';
}

const DICE_RE = /^\s*🎲\s*\*\*(.+?)\*\*:\s*\[([^\]]*)\]\s*([+-]\s*\d+)?\s*=\s*\*\*(-?\d+)\*\*\s*(.*)$/;

/**
 * Reads a dice result line such as
 * `🎲 **Attack (Advantage)**: [17, ~~4~~] +5 = **22** ⭐ **Natural 20!**`
 * and returns its parts, or null when the text is not a dice result.
 */
export function parseDiceRoll(body: string): ParsedDiceRoll | null {
  const m = body.trim().match(DICE_RE);
  if (!m) return null;

  const [, label, rollsRaw, modifierRaw, total, tail] = m;

  const rolls = rollsRaw
    .split(',')
    .map(r => r.trim())
    .filter(Boolean)
    .map(r => {
      const dropped = /^~~.*~~$/.test(r);
      return { value: dropped ? r.replace(/^~~|~~$/g, '').trim() : r, dropped };
    });

  const crit = /natural\s*20/i.test(tail)
    ? ('nat20' as const)
    : /natural\s*1\b/i.test(tail)
      ? ('nat1' as const)
      : undefined;

  return {
    label: label.trim(),
    rolls,
    modifier: modifierRaw ? modifierRaw.replace(/\s+/g, '') : undefined,
    total,
    crit,
  };
}
