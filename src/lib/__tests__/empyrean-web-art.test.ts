// The progression web's painted art: every spoke, branch and capstone has its medallion, no two
// share one, and a medallion is cut out of its sheet at the right place.
import { describe, expect, it } from 'vitest';
import { WEB_SPOKES } from '../../../supabase/functions/empyrean-rules/web';
import {
  WEB_BRANCH_ART, WEB_CAPSTONE_ART, WEB_MEDALLION_RADIUS, WEB_SHEET_COLS, WEB_SHEET_ROWS, WEB_SHEET_SIZE, WEB_SHEETS, WEB_SPOKE_ART,
  WEB_TOKEN_ART, webArtStyle, webNodeArt, type WebArtRef,
} from '../empyrean-web-art';

const key = (r: WebArtRef) => `${r[0]}:${r[1]}`;

describe('progression web art', () => {
  it('every spoke and every branch of the real web has an emblem, and every branch has a capstone medallion', () => {
    expect(WEB_SPOKES.map(s => s.id).sort()).toEqual(Object.keys(WEB_SPOKE_ART).sort());
    const branches = WEB_SPOKES.flatMap(s => (s.branches ?? []).map(b => b.id));
    expect(branches.length).toBe(26);
    expect(branches.slice().sort()).toEqual(Object.keys(WEB_BRANCH_ART).sort());
    expect(branches.slice().sort()).toEqual(Object.keys(WEB_CAPSTONE_ART).sort());
  });

  it('no two things share a medallion: 62 for the nodes and 5 tokens, each in a cell from 1 to 9 of a real sheet', () => {
    const all = [...Object.values(WEB_SPOKE_ART), ...Object.values(WEB_BRANCH_ART), ...Object.values(WEB_CAPSTONE_ART), ...Object.values(WEB_TOKEN_ART)];
    expect(all.length).toBe(10 + 26 + 26 + 5);
    expect(new Set(all.map(key)).size).toBe(all.length);
    for (const [sheet, cell] of all) {
      expect(typeof WEB_SHEETS[sheet]).toBe('string');
      expect(cell).toBeGreaterThanOrEqual(1);
      expect(cell).toBeLessThanOrEqual(9);
    }
    // A rider-half thing is on a rider sheet and a dragon-half thing on a dragon sheet.
    for (const s of WEB_SPOKES) {
      expect(WEB_SPOKE_ART[s.id][0].startsWith(s.half)).toBe(true);
      for (const b of s.branches ?? []) {
        expect(WEB_BRANCH_ART[b.id][0].startsWith(s.half)).toBe(true);
        expect(WEB_CAPSTONE_ART[b.id][0].startsWith(s.half)).toBe(true);
      }
    }
  });

  it('all 180 nodes wear art: a trunk node its spoke, a branch node its branch, and each branch exactly one capstone of its own', () => {
    let nodes = 0;
    let capstones = 0;
    for (const s of WEB_SPOKES) {
      for (const b of s.branches ?? []) expect(s.nodes.filter(n => n.branch === b.id && n.tier === 'capstone').length).toBe(1);
      for (const n of s.nodes) {
        nodes += 1;
        const art = webNodeArt(n, s.id);
        if (!n.branch) expect(art).toEqual(WEB_SPOKE_ART[s.id]);
        else if (n.tier === 'capstone') { capstones += 1; expect(art).toEqual(WEB_CAPSTONE_ART[n.branch]); }
        else expect(art).toEqual(WEB_BRANCH_ART[n.branch]);
      }
    }
    expect(nodes).toBe(180);
    expect(capstones).toBe(26);
  });

  it('a node the art does not know falls back, and one with nothing painted gets none', () => {
    expect(webNodeArt({ tier: 'capstone', branch: 'new-branch' }, 'blade')).toEqual(WEB_SPOKE_ART.blade);
    expect(webNodeArt({ tier: 'small', branch: 'edge' }, 'nowhere')).toEqual(WEB_BRANCH_ART.edge);
    expect(webNodeArt({ tier: 'small', branch: null }, 'nowhere')).toBeNull();
    expect(webNodeArt({ tier: 'small', branch: 'new-branch' }, 'nowhere')).toBeNull();
  });

  it('cuts a medallion out of its sheet: the whole disc fills the element, whatever its size', () => {
    expect(WEB_SHEET_COLS.length).toBe(3);
    expect(WEB_SHEET_ROWS.length).toBe(3);
    // Neighbouring medallions never overlap, and none runs off the sheet.
    expect(WEB_SHEET_COLS[1] - WEB_SHEET_COLS[0]).toBeGreaterThan(2 * WEB_MEDALLION_RADIUS);
    expect(WEB_SHEET_COLS[0] - WEB_MEDALLION_RADIUS).toBeGreaterThanOrEqual(0);
    expect(WEB_SHEET_ROWS[2] + WEB_MEDALLION_RADIUS).toBeLessThanOrEqual(WEB_SHEET_SIZE);
    const size = 2 * WEB_MEDALLION_RADIUS;
    expect(webArtStyle(['rider-1', 1], size)).toMatchObject({ backgroundSize: '1024px 1024px', backgroundPosition: '-34.5px -34px', backgroundRepeat: 'no-repeat' });
    expect(webArtStyle(['rider-1', 5], size).backgroundPosition).toBe('-376.5px -376.5px');
    expect(webArtStyle(['rider-1', 9], size).backgroundPosition).toBe('-717.5px -717.5px');
    // Half the size: everything halves.
    expect(webArtStyle(['dragon-3', 6], size / 2)).toMatchObject({ backgroundSize: '512px 512px', backgroundPosition: '-358.75px -188.25px' });
    expect(String(webArtStyle(['dragon-3', 6], 52).backgroundImage)).toContain('url(');
  });
});
