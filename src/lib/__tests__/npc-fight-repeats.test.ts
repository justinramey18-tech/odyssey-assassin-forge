import { describe, expect, it } from 'vitest';
import { combatTurn, repeatRetryNote, repeatsEarlierLine, type Deps } from '../../../supabase/functions/npc-reply/handler.ts';
import type { NpcRepo } from '../../../supabase/functions/npc-reply/repo.ts';

// CL-054: the fast fight voice repeated itself (real lines from the Grog and Squid fight, 2026-10-13).
const SQUID = [
  'Hey! No hitting the helpers! You owe me for that!',
  '*Squid braces his SMGs.* You wanna make noise? FINE. Let\'s make *all* the noise!',
];

describe('repeatsEarlierLine', () => {
  it('catches the same line again, with case, punctuation, beats and tags changed', () => {
    expect(repeatsEarlierLine('hey, no hitting the HELPERS... you owe me for that', SQUID)).toBe(true);
    expect(repeatsEarlierLine('[reply:abc]\n*He aims.* You wanna make noise? Fine. Let\'s make all the noise!', SQUID)).toBe(true);
  });
  it('catches a short catchphrase inside a longer line, both ways', () => {
    expect(repeatsEarlierLine('Taste metal, healing-spitter!', ['Taste metal!'])).toBe(true);
    expect(repeatsEarlierLine('Taste metal!', ['Taste metal, healing-spitter!'])).toBe(true);
  });
  it('catches four words in a row reused', () => {
    expect(repeatsEarlierLine('Not the helper! You owe me for that, you big oaf!', SQUID)).toBe(true);
  });
  it('lets a new line through', () => {
    expect(repeatsEarlierLine("Let's make some real noise!", SQUID)).toBe(false);
    expect(repeatsEarlierLine('Ew! Keep your snot to yourself, doctor!', SQUID)).toBe(false);
    expect(repeatsEarlierLine('No!', ['No, no, no.'])).toBe(false);
  });
  it('never counts an action-only line or an empty history', () => {
    expect(repeatsEarlierLine('*Squid ducks behind a crate.*', SQUID)).toBe(false);
    expect(repeatsEarlierLine('Hey! No hitting the helpers!', [])).toBe(false);
  });
  it('lists the earlier lines in the retry note', () => {
    expect(repeatRetryNote(SQUID)).toContain('- Hey! No hitting the helpers! You owe me for that!');
  });
});

describe('combatTurn repeat guard', () => {
  const NPC = '22222222-2222-4222-8222-222222222222';
  const HOST = '44444444-4444-4444-8444-444444444444';
  const PARTY = '55555555-5555-4555-8555-555555555555';
  const NOW = Date.parse('2026-10-13T02:00:00Z');
  const table = SQUID.map((content, i) => ({
    id: `l${i}`, user_id: HOST, character_name: 'Squid', content, in_character: true, npc_id: NPC,
    created_at: new Date(NOW - (60 - i) * 1000).toISOString(),
  }));
  const run = async (answers: string[], move: Record<string, unknown> = { move: 'attack', target: 'Xeyle', hit: false }) => {
    const posted: any[] = [];
    const asked: string[] = [];
    const repo = {
      getNpc: async () => ({ id: NPC, party_id: PARTY, name: 'Squid', model: 'm', on_stage: true, archived: false }),
      getGuide: async () => ({ guide: 'g', secrets: '' }),
      listStageNames: async () => ['Squid'],
      getPartyHost: async () => HOST,
      loadContext: async () => ({ guides: [], anchors: [], summary: '', latestPost: '', roster: [], table }),
      insertNpcLine: async (row: any) => { posted.push(row); return 'reply-id'; },
    } as unknown as NpcRepo;
    const deps: Deps = {
      repo,
      callModel: async (_m: string, _s: string, user: string) => { asked.push(user); return { ok: true, text: answers.shift() ?? '', costUsd: null }; },
      now: () => NOW,
    };
    const r = await combatTurn({ partyId: PARTY, npcId: NPC, turn: move }, deps);
    return { r, posted, asked };
  };

  it('posts a new line on the first try without asking again', async () => {
    const { r, posted, asked } = await run(['Eat lead, spit-doctor!']);
    expect(r.status).toBe(200);
    expect(asked).toHaveLength(1);
    expect(posted[0].content).toContain('Eat lead, spit-doctor!');
  });
  it('asks once more after a repeat and posts the new line', async () => {
    const { posted, asked } = await run(['Hey! No hitting the helpers! You owe me for that!', 'Eat lead!']);
    expect(asked).toHaveLength(2);
    expect(asked[1]).toContain('You already said these lines in this fight');
    expect(posted).toHaveLength(1);
    expect(posted[0].content).toContain('Eat lead!');
  });
  it('stays quiet after two repeats', async () => {
    const { r, posted } = await run(['You owe me for that!', 'You wanna make noise? FINE.']);
    expect(r.status).toBe(200);
    expect(r.body.skipped).toBe('repeat');
    expect(posted).toHaveLength(0);
  });
  it('fails a repeated skill wind-up so the plain warning is posted instead', async () => {
    const { r, posted } = await run(['You owe me for that!', 'You owe me for that!'], { move: 'intent', skill: 'Lead Hail', skillType: 'strike', targets: ['Xeyle'] });
    expect(r.status).toBe(409);
    expect(posted).toHaveLength(0);
  });
});
