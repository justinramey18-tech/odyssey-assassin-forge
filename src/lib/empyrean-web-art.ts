// Solo Empyrean progression web: the painted art. Where each image lives, and which medallion on
// which sheet belongs to which spoke, branch and capstone.
// Every sheet is 1024 by 1024 with nine round medallions on one shared lattice (measured on the art
// installed at c2a8817: the centres are within 2 pixels of it on all eight sheets). If a sheet is
// regenerated, check it still sits on the lattice and that its nine medallions are in the same order.
import type { CSSProperties } from 'react';

import panel from '@/assets/empyrean-web-panel.jpg';
import backdrop from '@/assets/empyrean-web-backdrop.jpg';
import rider1 from '@/assets/empyrean-web-rider-1.jpg';
import rider2 from '@/assets/empyrean-web-rider-2.jpg';
import rider3 from '@/assets/empyrean-web-rider-3.jpg';
import rider4 from '@/assets/empyrean-web-rider-4.jpg';
import rider5 from '@/assets/empyrean-web-rider-5.jpg';
import dragon1 from '@/assets/empyrean-web-dragon-1.jpg';
import dragon2 from '@/assets/empyrean-web-dragon-2.jpg';
import dragon3 from '@/assets/empyrean-web-dragon-3.jpg';

/** The wall panel in the hall (1080 by 2160) and the carved stone behind the web (1536 by 1536, its boss in the exact centre). */
export const WEB_PANEL_ART: string = panel;
export const WEB_BACKDROP_ART: string = backdrop;

export type WebSheet = 'rider-1' | 'rider-2' | 'rider-3' | 'rider-4' | 'rider-5' | 'dragon-1' | 'dragon-2' | 'dragon-3';
export const WEB_SHEETS: Record<WebSheet, string> = {
  'rider-1': rider1, 'rider-2': rider2, 'rider-3': rider3, 'rider-4': rider4, 'rider-5': rider5,
  'dragon-1': dragon1, 'dragon-2': dragon2, 'dragon-3': dragon3,
};
export const WEB_SHEET_SIZE = 1024;
/** The centre of each column and each row of medallions, and a medallion's radius with its rim, in sheet pixels. */
export const WEB_SHEET_COLS = [170.5, 512.5, 853.5] as const;
export const WEB_SHEET_ROWS = [170, 512.5, 853.5] as const;
export const WEB_MEDALLION_RADIUS = 136;

/** One medallion: its sheet and its cell (1 is top left, 3 is top right, 9 is bottom right). */
export type WebArtRef = readonly [sheet: WebSheet, cell: number];

/** A spoke's emblem (iron rim). Its trunk nodes wear it. */
export const WEB_SPOKE_ART: Record<string, WebArtRef> = {
  vitality: ['rider-1', 1], channel: ['rider-1', 2], blade: ['rider-1', 3], tempo: ['rider-1', 4], saddle: ['rider-1', 5],
  vigor: ['dragon-1', 1], 'fang-and-flame': ['dragon-1', 2], wing: ['dragon-1', 3], scale: ['dragon-1', 4], loyalty: ['dragon-1', 5],
};
/** A branch's emblem (iron rim). Its small and big nodes wear it. */
export const WEB_BRANCH_ART: Record<string, WebArtRef> = {
  tough: ['rider-1', 9], ward: ['rider-2', 1], regen: ['rider-2', 2], adren: ['rider-2', 3], blood: ['rider-2', 4],
  reserve: ['rider-2', 5], power: ['rider-2', 6], control: ['rider-2', 7], recover: ['rider-2', 8], mastery: ['rider-2', 9],
  edge: ['rider-3', 1], precise: ['rider-3', 2], init: ['rider-3', 3], evade: ['rider-3', 4], guide: ['rider-3', 5], mount: ['rider-3', 6],
  mend: ['dragon-1', 8], endure: ['dragon-1', 9], bite: ['dragon-2', 1], flame: ['dragon-2', 2], swoop: ['dragon-2', 3], flight: ['dragon-2', 4],
  hide: ['dragon-2', 5], guard: ['dragon-2', 6], fierce: ['dragon-2', 7], devoted: ['dragon-2', 8],
};
/** A branch's capstone has art of its own (gold rim), listed by its branch. */
export const WEB_CAPSTONE_ART: Record<string, WebArtRef> = {
  tough: ['rider-4', 1], ward: ['rider-4', 2], regen: ['rider-4', 3], adren: ['rider-4', 4], blood: ['rider-4', 5],
  reserve: ['rider-4', 6], power: ['rider-4', 7], control: ['rider-4', 8], recover: ['rider-4', 9], mastery: ['rider-5', 1],
  edge: ['rider-5', 2], precise: ['rider-5', 3], init: ['rider-5', 4], evade: ['rider-5', 5], guide: ['rider-5', 6], mount: ['rider-5', 7],
  mend: ['dragon-3', 1], endure: ['dragon-3', 2], bite: ['dragon-3', 3], flame: ['dragon-3', 4], swoop: ['dragon-3', 5], flight: ['dragon-3', 6],
  hide: ['dragon-3', 7], guard: ['dragon-3', 8], fierce: ['dragon-3', 9], devoted: ['dragon-2', 9],
};
/** The hub of each half, the two currencies, and an empty disc. */
export const WEB_TOKEN_ART: Record<'riderHub' | 'xp' | 'blank' | 'dragonHub' | 'kin', WebArtRef> = {
  riderHub: ['rider-1', 6], xp: ['rider-1', 7], blank: ['rider-1', 8], dragonHub: ['dragon-1', 6], kin: ['dragon-1', 7],
};

/** The art a node wears: its own if it is its branch's capstone, else its branch's emblem, else its spoke's.
 *  Null: nothing painted for it yet (the screen then draws the plain node). */
export function webNodeArt(node: { tier: string; branch?: string | null }, spokeId: string): WebArtRef | null {
  const spoke = WEB_SPOKE_ART[spokeId] ?? null;
  if (!node.branch) return spoke;
  return (node.tier === 'capstone' ? WEB_CAPSTONE_ART[node.branch] : undefined) ?? WEB_BRANCH_ART[node.branch] ?? spoke;
}

/** Draws one medallion as the background of a round element `size` pixels across. */
export function webArtStyle(ref: WebArtRef, size: number): CSSProperties {
  const [sheet, cell] = ref;
  const i = Math.max(0, Math.min(8, Math.round(cell) - 1));
  const scale = size / (2 * WEB_MEDALLION_RADIUS);
  const left = (WEB_SHEET_COLS[i % 3] - WEB_MEDALLION_RADIUS) * scale;
  const top = (WEB_SHEET_ROWS[Math.floor(i / 3)] - WEB_MEDALLION_RADIUS) * scale;
  const side = Math.round(WEB_SHEET_SIZE * scale * 100) / 100;
  return {
    backgroundImage: `url(${WEB_SHEETS[sheet]})`,
    backgroundSize: `${side}px ${side}px`,
    backgroundPosition: `${-Math.round(left * 100) / 100}px ${-Math.round(top * 100) / 100}px`,
    backgroundRepeat: 'no-repeat',
  };
}
