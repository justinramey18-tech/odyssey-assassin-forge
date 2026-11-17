// Built-in portraits for the canon Fourth Wing cast, keyed by cast key.
import violet from '@/assets/npc-portraits/violet-sorrengail.jpg';
import xaden from '@/assets/npc-portraits/xaden-riorson.jpg';
import liam from '@/assets/npc-portraits/liam-mairi.jpg';
import rhiannon from '@/assets/npc-portraits/rhiannon-matthias.jpg';
import ridoc from '@/assets/npc-portraits/ridoc-gamlyn.jpg';
import sawyer from '@/assets/npc-portraits/sawyer-henrick.jpg';
import imogen from '@/assets/npc-portraits/imogen-cardulo.jpg';
import garrick from '@/assets/npc-portraits/garrick-tavis.jpg';

export const CAST_PORTRAITS: Record<string, string> = {
  'violet-sorrengail': violet, 'xaden-riorson': xaden, 'liam-mairi': liam, 'rhiannon-matthias': rhiannon,
  'ridoc-gamlyn': ridoc, 'sawyer-henrick': sawyer, 'imogen-cardulo': imogen, 'garrick-tavis': garrick,
};

export function castPortrait(key: string): string | undefined {
  return CAST_PORTRAITS[key];
}
