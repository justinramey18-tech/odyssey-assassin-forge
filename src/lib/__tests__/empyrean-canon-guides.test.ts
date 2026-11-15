import { describe, it, expect } from 'vitest';
import {
  EMPYREAN_CANON_GUIDES,
  EMPYREAN_CANON_GUIDE_IDS,
  EMPYREAN_LORE_GUIDES,
  ALL_EMPYREAN_GUIDES,
} from '@/lib/empyreanGMGuides';
import { MAX_GUIDE_CHARS } from '@/lib/gm-guides-storage';
import { buildEmpyreanDMPersona } from '@/lib/empyreanDMPersona';

describe('canon Empyrean guides (D-32)', () => {
  it('puts the five canon guides first in the lore list', () => {
    expect(EMPYREAN_CANON_GUIDE_IDS).toEqual([
      'empyrean-lore-canon-rules',
      'empyrean-lore-timeline',
      'empyrean-lore-basgiath',
      'empyrean-lore-npcs',
      'empyrean-lore-canon-world',
    ]);
    expect(EMPYREAN_LORE_GUIDES.slice(0, 5).map(g => g.id)).toEqual(EMPYREAN_CANON_GUIDE_IDS);
  });

  it('keeps every guide id and name unique', () => {
    const ids = ALL_EMPYREAN_GUIDES.map(g => g.id);
    const names = ALL_EMPYREAN_GUIDES.map(g => g.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('fits each canon guide under the per-guide limit', () => {
    for (const g of EMPYREAN_CANON_GUIDES) {
      expect(g.content.length).toBeGreaterThan(1000);
      expect(g.content.length).toBeLessThanOrEqual(MAX_GUIDE_CHARS);
    }
  });

  it('states the facts the DM used to get wrong', () => {
    const all = EMPYREAN_CANON_GUIDES.map(g => g.content).join('\n');
    expect(all).toContain('Xaden Riorson IS bonded to Sgaeyl, a navy blue daggertail');
    expect(all).toContain('mother General Lilith Sorrengail');
    expect(all).toContain('Second Squad, Flame Section, Fourth Wing');
  });

  it('drops the invented recurring cast from the solo DM persona', () => {
    const persona = buildEmpyreanDMPersona([], [], null, 'Kael', 'Ruadh', 'fire');
    expect(persona).toContain('CANON CAST AND ORIGINAL CHARACTERS');
    for (const invented of ['Dain Wraith', 'Maren Sol', 'Aldric Vane', 'Syrathax', 'Orin Dusk']) {
      expect(persona).not.toContain(invented);
    }
  });
});
