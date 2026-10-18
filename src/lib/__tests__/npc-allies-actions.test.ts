import { describe, expect, it, vi } from 'vitest';
import { add, join, part } from '../../../supabase/functions/npc-reply/allies.ts';
import { formatJoinMarker } from '../../../supabase/functions/npc-reply/prompt.ts';
import type { Deps } from '../../../supabase/functions/npc-reply/handler.ts';
import type { NpcRow } from '../../../supabase/functions/npc-reply/repo.ts';

const NPC = '22222222-2222-4222-8222-222222222222';
const LINE = '11111111-1111-4111-8111-111111111111';
const HOST = '44444444-4444-4444-8444-444444444444';
const PLAYER = '33333333-3333-4333-8333-333333333333';
const NOW = Date.parse('2026-10-18T20:11:00Z');
function fixture() {
  const npc: NpcRow = { id: NPC, party_id: 'party', name: 'Mira', model: '', on_stage: true, archived: false };
  const line = { id: LINE, party_id: 'party', npc_id: NPC, consumed: false, content: 'I will come.' + formatJoinMarker({ to: PLAYER, name: 'Anduril' }) };
  const repo = {
    getLine: vi.fn(async () => line), getNpc: vi.fn(async () => npc),
    getPartyHost: vi.fn(async () => HOST), isMember: vi.fn(async () => true),
    enemyInOpenFight: vi.fn(async () => false), countAllies: vi.fn(async () => 0),
    setAlly: vi.fn(async (_id: string, who: string | null, when: string) => ({ ...npc, ally_of: who, ally_since: who ? when : null })),
    postPartyLine: vi.fn(async () => {}), ensureEventMemory: vi.fn(async () => {}),
  };
  return { npc, line, repo, deps: { repo, now: () => NOW } as unknown as Deps };
}
describe('protected NPC ally actions', () => {
  it('only the named player can accept and records the invitation', async () => {
    const { deps, repo } = fixture();
    expect((await join({ userId: HOST, messageId: LINE }, deps)).status).toBe(403);
    expect(repo.setAlly).not.toHaveBeenCalled();
    expect((await join({ userId: PLAYER, messageId: LINE }, deps)).status).toBe(200);
    expect(repo.setAlly).toHaveBeenCalledWith(NPC, PLAYER, '2026-10-18T20:11:00.000Z');
    expect(repo.postPartyLine).toHaveBeenCalledWith('party', HOST, '🤝 Mira joins the party.');
  });
  it('rejects a consumed offer or a player no longer seated', async () => {
    const { deps, line, repo } = fixture();
    line.consumed = true;
    expect((await join({ userId: PLAYER, messageId: LINE }, deps)).status).toBe(409);
    line.consumed = false;
    repo.isMember.mockResolvedValue(false);
    expect((await join({ userId: PLAYER, messageId: LINE }, deps)).status).toBe(403);
    expect(repo.setAlly).not.toHaveBeenCalled();
  });
  it('only the host can add and part ways', async () => {
    const { deps, npc, repo } = fixture();
    expect((await add({ userId: PLAYER, npcId: NPC }, deps)).status).toBe(403);
    expect((await part({ userId: PLAYER, npcId: NPC }, deps)).status).toBe(403);
    expect(repo.setAlly).not.toHaveBeenCalled();
    expect((await add({ userId: HOST, npcId: NPC }, deps)).status).toBe(200);
    npc.ally_since = '2026-10-18T20:00:00Z';
    expect((await part({ userId: HOST, npcId: NPC }, deps)).status).toBe(200);
    expect(repo.setAlly).toHaveBeenLastCalledWith(NPC, null, '2026-10-18T20:11:00.000Z');
  });
  it('blocks enlistment at three allies or during an enemy fight', async () => {
    const { deps, repo } = fixture();
    repo.countAllies.mockResolvedValue(3);
    expect((await add({ userId: HOST, npcId: NPC }, deps)).status).toBe(409);
    repo.countAllies.mockResolvedValue(0);
    repo.enemyInOpenFight.mockResolvedValue(true);
    expect((await add({ userId: HOST, npcId: NPC }, deps)).status).toBe(409);
    expect(repo.setAlly).not.toHaveBeenCalled();
  });
  it('repeat acceptance of an existing ally creates no extra writes', async () => {
    const { deps, npc, repo } = fixture();
    npc.ally_since = '2026-10-18T20:00:00Z';
    expect((await join({ userId: PLAYER, messageId: LINE }, deps)).body.already).toBe(true);
    expect(repo.setAlly).not.toHaveBeenCalled();
    expect(repo.postPartyLine).not.toHaveBeenCalled();
  });
});