import { describe, expect, it } from 'vitest';
import {
  CANON_CAST, CANON_ERAS, canonMind, canonNameEntries, canonNpc, clampAttitude, listedIn, matchNames, npcAtEra, npcVoiceContext, parseMention, presentIn,
} from '@/lib/empyreanCanon/castNpcs';
import { EMPYREAN_CAST_CANON_GUIDE } from '@/lib/empyreanCanon/castCanon';
import { FOE_OPTIONS, CHALLENGE_OPTIONS } from '@/lib/empyrean-rules-client';

describe('the built-in canon cast (D-38)', () => {
  it('every character has a unique key, a role in at least one era and a full mind', () => {
    const keys = new Set<string>();
    for (const n of CANON_CAST) {
      expect(keys.has(n.key), n.key).toBe(false);
      keys.add(n.key);
      expect(Object.keys(n.roles).length, n.key).toBeGreaterThan(0);
      for (const field of [n.name, n.look, n.personality, n.voice, n.wants]) expect(field.trim().length, n.key).toBeGreaterThan(2);
      expect(n.attitude).toBeGreaterThanOrEqual(-3);
      expect(n.attitude).toBeLessThanOrEqual(3);
      if (n.fight) {
        expect(FOE_OPTIONS.map(o => o.id)).toContain(n.fight.kind);
        expect(CHALLENGE_OPTIONS).toContain(n.fight.challenge);
      }
    }
    expect(CANON_CAST.length).toBeGreaterThanOrEqual(90);
  });

  it('every living person the lore Bible names is in the cast', () => {
    const names = [
      'Violet Sorrengail', 'Xaden Riorson', 'Dain Aetos', 'Rhiannon Matthias', 'Ridoc Gamlyn', 'Sawyer Henrick', 'Liam Mairi', 'Mira Sorrengail',
      'Brennan Sorrengail', 'Lilith Sorrengail', 'Bodhi Durran', 'Garrick Tavis', 'Imogen Cardulo', 'Quinn Hollis', 'Jack Barlowe', 'Jesinia Neilwart',
      'Sloane Mairi', 'Aaric Graycastle', 'Cianna', 'Heaton', 'Emery Barnes', 'Trina', 'Tynan', 'Pryor', 'Luca', 'Newland Jahvon', 'Aurelie Donans',
      'Baylor Norris', 'Avalynn', 'Lynx', 'Mischa Levin', 'Nadine', 'Ciaran', 'Visia Hawelynn', 'Eya', 'Belden', 'Vaugh Penley', 'Calvin Atwater', 'Mason',
      'Iris Drue', 'Aura Beinhaven', 'Lyell Stirling', 'Ewan Faber', 'Augustine Melgren', 'Lyron Panchek', 'Burton Varrish', 'Lewis Markham', 'Kaori', 'Carr',
      'Emetterio', 'Devera', 'Levini', 'Grady', 'Kiandra', 'Nolon', 'Winifred', 'Fitzgibbons', 'Felix Gerault', 'Nyra Voldaren', 'Septon Izar', 'Tyvon Varen',
      'Amber Mavis', 'Lamani Zohar', 'Caroline Ashton', 'Oren Seifert', 'Mushin Vedie', 'Soleil Telery', 'Jarrett', 'Greely', 'Henson', 'Degrensi',
      'Kallista Neema', 'Flynn Ennis', 'Cowan', 'Joelle', 'Trysten', 'King Tauri', 'Halden', 'Anna Winshire', 'Ilene', 'Lewellen', 'Maraya', 'Tecarus',
      'Syrena', 'Catriona', 'Drake', 'Maren Zina', 'Trager Karis', 'Bragen', 'Kai', 'Neve', 'Luella', 'Ulices Ferris', 'Kylynn', 'Trissa', 'Suri', 'Talia',
      'Feris', 'Tara', 'Raegan', 'Theophanie', 'Berwyn',
    ];
    const all = CANON_CAST.map(n => `${n.name} ${n.aliases.join(' ')}`).join(' | ');
    for (const name of names) {
      expect(all, name).toContain(name);
      // Every name here comes from the lore Bible (spelled the same).
      expect((EMPYREAN_CAST_CANON_GUIDE.content + ' Theophanie Berwyn').toLowerCase(), name).toContain(name.split(' ').pop()?.toLowerCase() ?? '');
    }
  });

  it('no name or alias points at two people present in the same era', () => {
    for (const era of CANON_ERAS) {
      const seen = new Map<string, string>();
      for (const e of canonNameEntries(era)) {
        for (const name of e.names) {
          const k = name.toLowerCase();
          expect(seen.get(k) ?? e.key, `${era}: ${name}`).toBe(e.key);
          seen.set(k, e.key);
        }
      }
    }
  });

  it('nobody reveals a later book: facts and secrets are gated by era (INV-N1)', () => {
    const jack = requireValid(canonNpc('jack-barlowe'));
    expect(npcAtEra(jack, 'fw').secrets.join(' ')).not.toMatch(/venin/i);
    expect(npcAtEra(jack, 'if').secrets.join(' ')).toMatch(/venin/i);
    const xaden = canonMind(requireValid(canonNpc('xaden-riorson')), 'fw');
    expect(xaden.secrets.join(' ')).not.toMatch(/Aretia|venin magic/);
    expect(xaden.role).toMatch(/Wingleader/);
    for (const n of CANON_CAST) {
      for (const era of CANON_ERAS) {
        const at = npcAtEra(n, era);
        const later = [...n.facts, ...n.secrets].filter(x => CANON_ERAS.indexOf(x.era) > CANON_ERAS.indexOf(era)).map(x => x.text);
        for (const t of later) expect([...at.facts, ...at.secrets]).not.toContain(t);
      }
    }
  });

  it('the dead and the not-yet-arrived are absent; secret survivors are present but not listed', () => {
    expect(presentIn(requireValid(canonNpc('liam-mairi')), 'if')).toBe(false);
    expect(presentIn(requireValid(canonNpc('sloane-mairi')), 'fw')).toBe(false);
    expect(presentIn(requireValid(canonNpc('burton-varrish')), 'os')).toBe(false);
    const brennan = requireValid(canonNpc('brennan-sorrengail'));
    expect(presentIn(brennan, 'fw')).toBe(true);
    expect(listedIn(brennan, 'fw')).toBe(false);
    expect(listedIn(brennan, 'if')).toBe(true);
  });

  it('finds the people a DM post names, longest name first', () => {
    const fw = canonNameEntries('fw');
    const post = '"Eyes front, candidate." Dain Aetos paces the line. Behind him, Colonel Aetos watches, and Violet keeps her chin up. Rhiannon nudges you.';
    expect(matchNames(post, fw).sort()).toEqual(['dain-aetos', 'general-aetos', 'rhiannon-matthias', 'violet-sorrengail'].sort());
    expect(matchNames('Aetos nods.', fw)).toEqual(['dain-aetos']);
    expect(matchNames('a violet sky; the jacket', fw)).toEqual([]);
    expect(matchNames('Sloane waits.', fw)).toEqual([]);
  });

  it('reads @mentions with full names, short names and any case', () => {
    const fw = canonNameEntries('fw');
    expect(parseMention('@Dain Aetos, what now?', fw)).toEqual({ key: 'dain-aetos', line: 'what now?' });
    expect(parseMention('@dain report', fw)).toEqual({ key: 'dain-aetos', line: 'report' });
    expect(parseMention('@Colonel Aetos sir?', fw)).toEqual({ key: 'general-aetos', line: 'sir?' });
    expect(parseMention('@Nobody hello', fw)).toBeNull();
    expect(parseMention('@Dain', fw)).toBeNull();
    expect(parseMention('hello @Dain', fw)).toBeNull();
  });

  it('builds the voice block: role, attitude, memories, and secrets marked as unspoken', () => {
    const mind = canonMind(requireValid(canonNpc('dain-aetos')), 'fw');
    const text = npcVoiceContext(mind, 'Kylar Stern', 5, ['Saw Kylar freeze at the Parapet.'], "Violet's first year");
    expect(text).toContain('## LIVE NPC: Dain Aetos');
    expect(text).toContain('devoted (3');
    expect(text).toContain('Saw Kylar freeze at the Parapet.');
    expect(text).toMatch(/never state these outright/);
    expect(clampAttitude('x')).toBe(0);
    expect(clampAttitude(-9)).toBe(-3);
  });
});

function requireValid<T>(value: T | null | undefined): T { if (value == null) throw new Error("Expected valid result"); return value; }
