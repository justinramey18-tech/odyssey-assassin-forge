// Built-in artwork for solo Empyrean: dragon portraits by scale color, foe portraits by kind,
// battle backdrops by arena, and scene art. Pure lookups; nothing here is saved.
import dragonRed from '@/assets/dragons/dragon-deep-red.jpg';
import dragonBlue from '@/assets/dragons/dragon-deep-blue.jpg';
import dragonPurple from '@/assets/dragons/dragon-deep-purple.jpg';
import dragonGold from '@/assets/dragons/dragon-deep-gold.jpg';
import dragonOnyx from '@/assets/dragons/dragon-onyx.jpg';
import dragonGreen from '@/assets/dragons/dragon-dark-green.jpg';
import dragonSilver from '@/assets/dragons/dragon-silver.jpg';
import dragonOrange from '@/assets/dragons/dragon-dark-orange.jpg';
import dragonBrown from '@/assets/dragons/dragon-brown.jpg';
import venin from '@/assets/enemies/venin.jpg';
import wyvern from '@/assets/enemies/wyvern.jpg';
import flier from '@/assets/enemies/gryphon-flier.jpg';
import arenaMats from '@/assets/battle-arenas/arena-sparring-mats.jpg';
import arenaField from '@/assets/battle-arenas/arena-flight-field.jpg';
import arenaOutpost from '@/assets/battle-arenas/arena-border-outpost.jpg';
import parapet from '@/assets/empyrean-scenes/parapet.jpg';
import campQuarters from '@/assets/empyrean-scenes/camp-quarters.jpg';
import memorialWall from '@/assets/empyrean-scenes/memorial-wall.jpg';
import threshingField from '@/assets/empyrean-scenes/threshing-field.jpg';
import flameDagger from '@/assets/empyrean-scenes/flame-dagger-insignia.png';
import { CAST_PORTRAITS } from '@/lib/empyreanCanon/castPortraits';
import { CAST_A } from '@/lib/empyreanCanon/castNpcs/castA';
import { CAST_B } from '@/lib/empyreanCanon/castNpcs/castB';

export const DRAGON_PORTRAITS: Record<string, string> = {
  'deep-red': dragonRed, 'deep-blue': dragonBlue, 'deep-purple': dragonPurple, 'deep-gold': dragonGold,
  'onyx': dragonOnyx, 'dark-green': dragonGreen, 'silver': dragonSilver, 'dark-orange': dragonOrange, 'brown': dragonBrown,
};

/** The rider's dragon portrait for its scale color; onyx when the color is unknown. */
export function dragonPortrait(colorId: string | null | undefined): string {
  return (colorId && DRAGON_PORTRAITS[colorId]) || dragonOnyx;
}

const FOE_PORTRAITS: Record<string, string> = { venin, wyvern, flier };

/** A cast member's portrait when the foe's name matches their name or an alias (whole word). */
export function castPortraitForName(name: string | null | undefined): string | undefined {
  const n = (name ?? '').toLowerCase().trim();
  if (!n) return undefined;
  for (const npc of [...CAST_A, ...CAST_B]) {
    const names = [npc.name, ...npc.aliases].map(x => x.toLowerCase());
    if (names.some(x => n === x || new RegExp(`\\b${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(n))) return CAST_PORTRAITS[npc.key];
  }
  return undefined;
}

/** A foe's portrait: a named cast member first, then the creature kind. */
export function foePortrait(kind: string, name?: string | null): string | undefined {
  return castPortraitForName(name) ?? FOE_PORTRAITS[kind];
}

/** Battle backdrop by arena and whether the fight is real. */
export function arenaBackdrop(arena: string, lethal: boolean): string {
  if (arena === 'mat') return arenaMats;
  if (arena === 'air') return arenaField;
  return lethal ? arenaOutpost : parapet;
}

export const EMPYREAN_SCENE_ART = { campQuarters, memorialWall, threshingField, parapet, flameDagger };
