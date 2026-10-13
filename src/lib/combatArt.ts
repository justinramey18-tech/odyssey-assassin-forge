// Art for the combat mini-games (Counter Clash and Tug & Slip).
// Each entry is the URL of an uploaded image or clip, or null until one is uploaded. Every piece has a drawn
// fallback, so the mini-games work and look finished with no art at all.
// Everything is made on pure black (or a transparent background) and drawn with mix-blend-mode: screen, so the black
// disappears and only the glow shows. Images: WebP or PNG. Clips: short MP4/WebM. Phones set to reduce motion get the
// still image instead of the clip.

import clashRingAsset from '@/assets/combat/clash-ring.webp.asset.json';
import clashPerfectAsset from '@/assets/combat/clash-perfect.webp.asset.json';
import clashPerfectClipAsset from '@/assets/combat/clash-perfect.mp4.asset.json';
import clashBlockAsset from '@/assets/combat/clash-block.webp.asset.json';
import clashBaitAsset from '@/assets/combat/clash-bait.webp.asset.json';
import clashSlashAsset from '@/assets/combat/clash-slash.webp.asset.json';
import clashCounterAsset from '@/assets/combat/clash-counter.webp.asset.json';
import clashCounterClipAsset from '@/assets/combat/clash-counter.mp4.asset.json';
import tugRopeAsset from '@/assets/combat/tug-rope.webp.asset.json';
import tugKnotAsset from '@/assets/combat/tug-knot.webp.asset.json';
import tugNeedleAsset from '@/assets/combat/tug-needle.webp.asset.json';
import tugFreeAsset from '@/assets/combat/tug-free.webp.asset.json';
import tugFreeClipAsset from '@/assets/combat/tug-free.mp4.asset.json';
import tugFumbleAsset from '@/assets/combat/tug-fumble.webp.asset.json';

export interface CombatArt {
  /** Counter Clash: the target ring (square, empty middle). */
  clashRing: string | null;
  /** Counter Clash: burst behind "PERFECT!" (image and clip). */
  clashPerfect: string | null;
  clashPerfectClip: string | null;
  /** Counter Clash: spark behind "Blocked". */
  clashBlock: string | null;
  /** Counter Clash: crack behind "Took the bait!" and "Wrong side!". */
  clashBait: string | null;
  /** Counter Clash: slash for a swing that lands (drawn pointing right; turned toward each side). */
  clashSlash: string | null;
  clashSlashClip: string | null;
  /** Counter Clash: burst behind the "COUNTER!" banner (image and clip). */
  clashCounter: string | null;
  clashCounterClip: string | null;
  /** Tug & Slip: rope texture (wide strip, repeats sideways). */
  tugRope: string | null;
  /** Tug & Slip: the knot / grip on the rope. */
  tugKnot: string | null;
  /** Tug & Slip: the needle (tall, thin). */
  tugNeedle: string | null;
  /** Tug & Slip: burst behind "BREAK FREE!" (image and clip). */
  tugFree: string | null;
  tugFreeClip: string | null;
  /** Tug & Slip: spark behind "Fumble". */
  tugFumble: string | null;
}

export const COMBAT_ART: CombatArt = {
  clashRing: clashRingAsset.url,
  clashPerfect: clashPerfectAsset.url,
  clashPerfectClip: clashPerfectClipAsset.url,
  clashBlock: clashBlockAsset.url,
  clashBait: clashBaitAsset.url,
  clashSlash: clashSlashAsset.url,
  clashSlashClip: null,
  clashCounter: clashCounterAsset.url,
  clashCounterClip: clashCounterClipAsset.url,
  tugRope: tugRopeAsset.url,
  tugKnot: tugKnotAsset.url,
  tugNeedle: tugNeedleAsset.url,
  tugFree: tugFreeAsset.url,
  tugFreeClip: tugFreeClipAsset.url,
  tugFumble: tugFumbleAsset.url,
};

/** True when the phone asks for less motion: show still images, not clips. */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The clip to play, or null to show the still image (no clip uploaded, or reduced motion). */
export function clipOrNull(clip: string | null): string | null {
  return clip && !prefersReducedMotion() ? clip : null;
}

let preloaded = false;
/** Fetches every uploaded image and clip once, so the first clash or pin shows its art without a delay. */
export function preloadCombatArt(): void {
  if (preloaded || typeof window === 'undefined') return;
  preloaded = true;
  for (const url of Object.values(COMBAT_ART)) {
    if (!url) continue;
    try {
      if (/\.(mp4|webm)(\?|$)/i.test(url)) {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.muted = true;
        v.src = url;
      } else {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
      }
    } catch { /* preloading is only a speed-up */ }
  }
}
