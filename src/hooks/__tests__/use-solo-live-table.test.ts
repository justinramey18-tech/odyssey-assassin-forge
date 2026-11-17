import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => {
  const builder: any = {};
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit', 'gte', 'lte', 'gt', 'lt', 'not', 'match', 'filter']) builder[m] = () => builder;
  builder.maybeSingle = async () => ({ data: null, error: null });
  builder.single = async () => ({ data: null, error: null });
  builder.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  const channel: any = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: () => builder,
      channel: () => channel,
      removeChannel: () => {},
      auth: { getUser: async () => ({ data: { user: null } }), getSession: async () => ({ data: { session: null } }) },
    },
  };
});

import { heardLine, stageFromStory, tableHeard, useSoloLiveTable, SOLO_CHAOS_LEVEL } from '@/hooks/use-solo-live-table';
import { linesToKeep } from '@/hooks/use-arena-round-chat';
import { buildRoster, type RosterEntry } from '@/lib/solo-npcs';
import { CANON_ERAS } from '@/lib/empyreanCanon/castNpcs';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';
import type { RoundChatMessage } from '@/hooks/use-round-chat';

const roster = buildRoster([], CANON_ERAS[0]);
const someone = roster[0];

describe('solo Live Table stage', () => {
  it('puts NPCs named in the latest DM post on stage', () => {
    expect(stageFromStory(`${someone.name} waits by the gate.`, roster)).toEqual([someone.key]);
  });
  it('leaves the stage empty when nobody is named', () => {
    expect(stageFromStory('Rain falls on the empty courtyard.', roster)).toEqual([]);
  });
  it('keeps dead NPCs off the stage', () => {
    const dead = roster.map(e => (e.key === someone.key ? { ...e, status: 'dead' as const } : e));
    expect(stageFromStory(`${someone.name} waits by the gate.`, dead)).toEqual([]);
  });
});

const msg = (id: string, over: Partial<RoundChatMessage>): RoundChatMessage => ({
  id, party_id: 'arena-practice', user_id: 'rider', character_name: 'Xeyle', content: '', in_character: true,
  round_id: 'solo-live-table', consumed: false, selected: false, created_at: `2026-11-17T00:00:${id.padStart(2, '0')}Z`, npc_id: null, ...over,
});

describe('what an NPC hears at the table', () => {
  it('names each speaker, drops reply links and marks table talk', () => {
    expect(heardLine(msg('1', { content: 'Where is Xaden?' }))).toBe('Xeyle: Where is Xaden?');
    expect(heardLine(msg('2', { content: '[reply:aaaaaaaa-0000-4000-8000-000000000001]\n**Dain:** "Not here." *Shrugs.*', npc_id: 'dain', character_name: 'Dain Aetos' })))
      .toBe('Dain Aetos: **Dain:** "Not here." *Shrugs.*');
    expect(heardLine(msg('3', { content: 'brb', in_character: false }))).toMatch(/^Xeyle \(out of character/);
    expect(heardLine(msg('4', { content: '   ' }))).toBeNull();
  });
  it('keeps order, leaves out the line being answered, and keeps the newest when long', () => {
    const lines = [msg('1', { content: 'one' }), msg('2', { content: 'two' }), msg('3', { content: 'three' })];
    expect(tableHeard(lines, '3')).toBe('Xeyle: one\nXeyle: two');
    const many = Array.from({ length: 40 }, (_, i) => msg(String(i + 1), { content: `line ${i + 1} ${'x'.repeat(300)}` }));
    const heard = tableHeard(many);
    expect(heard).toContain('line 40');
    expect(heard).not.toContain('line 1 ');
    expect(heard.length).toBeLessThanOrEqual(3100);
  });
});

describe('a saved table keeps every unsent line and the latest sent ones', () => {
  it('drops only old sent lines', () => {
    const lines = [
      ...Array.from({ length: 50 }, (_, i) => msg(String(i + 1), { consumed: true })),
      msg('51', { consumed: false }),
    ];
    const kept = linesToKeep(lines, 40);
    expect(kept.length).toBe(41);
    expect(kept[0].id).toBe('11');
    expect(kept[kept.length - 1].id).toBe('51');
  });
});

function fakeNpcs(entries: RosterEntry[]): SoloNpcs {
  return {
    ready: true, era: CANON_ERAS[0], setEra: () => {}, roster: entries,
    entry: (key: string) => entries.find(e => e.key === key),
    mention: () => null, setStatus: async () => {}, remove: async () => {},
    build: async () => null, building: false, onStory: () => {},
  };
}

describe('solo Live Table hook', () => {
  const [a, b, c] = roster;
  const story = `${a.name}, ${b.name} and ${c.name} stand in the courtyard.`;
  beforeEach(() => localStorage.clear());

  function setup(over: { busy?: boolean; replied?: boolean; storageKey?: string } = {}) {
    const asked: Array<{ name: string; line: string; mind: string }> = [];
    const voiceNPC = vi.fn(async (name: string | string[], line: string, _s?: unknown, mind?: string) => {
      asked.push({ name: String(name), line, mind: mind || '' });
      await new Promise(r => setTimeout(r, 5));
      return `**${name}:** "Answer ${asked.length}."`;
    });
    const sendToDm = vi.fn(async () => over.replied ?? true);
    const hook = renderHook(({ busy }) => useSoloLiveTable({
      userId: 'rider', riderName: 'Xeyle', npcs: fakeNpcs([a, b, c]), latestDmText: story,
      voiceNPC, sendToDm, busy, storageKey: over.storageKey,
    }), { initialProps: { busy: over.busy ?? false } });
    return { ...hook, asked, voiceNPC, sendToDm };
  }

  it('NPCs answer one at a time in the order given, and the second hears the first', async () => {
    const { result, asked } = setup();
    await act(async () => { await result.current.onSendToNpcs('Who saw it?', [c.key, a.key]); });
    await waitFor(() => expect(asked.length).toBe(2));
    expect(asked.map(x => x.name)).toEqual([c.name, a.name]);
    expect(asked[1].mind).toContain('AT THE TABLE JUST NOW');
    expect(asked[1].mind).toContain(`${c.name}: **${c.name}:** "Answer 1."`);
    await waitFor(() => expect(result.current.chat.messages.filter(m => m.npc_id).length).toBe(2));
    const answers = result.current.chat.messages.filter(m => m.npc_id);
    expect(answers.map(m => m.character_name)).toEqual([c.name, a.name]);
    expect(answers[0].content.startsWith('[reply:')).toBe(true);
  });

  it('speaking as an NPC uses its identity and regeneration replaces the original line', async () => {
    const { result, asked } = setup();
    await act(async () => { expect(await result.current.onSpeakAsNpc('I am here.', a.key)).toBe(true); });
    expect(result.current.chat.messages[0].npc_id).toBe(a.key);
    expect(result.current.chat.messages[0].user_id).toBe(`npc:${a.key}`);
    await act(async () => { await result.current.onSendToNpcs('Hello?', [a.key]); });
    await waitFor(() => expect(result.current.chat.messages).toHaveLength(3));
    const original = result.current.chat.messages[2];
    act(() => result.current.onRegenerateNpcLine(original.id, a.key));
    await waitFor(() => expect(asked).toHaveLength(2));
    await waitFor(() => expect(result.current.chat.messages.find(m => m.id === original.id)?.content).toContain('Answer 2'));
    expect(result.current.chat.messages).toHaveLength(3);
  });

  it('accepting a solo NPC offer adds a local acceptance and removes the used offer', async () => {
    const { result } = setup();
    let id = '';
    await act(async () => { id = result.current.chat.appendLine({ content: 'Come with me.\n⟪JOIN⟫{"to":"rider","name":"Xeyle"}⟪/JOIN⟫', characterName: a.name, npcId: a.key }); });
    await act(async () => { await result.current.onNpcJoin(id, a.key); });
    expect(result.current.chat.messages.find(m => m.id === id)?.content).not.toContain('⟪JOIN⟫');
    expect(result.current.chat.messages.at(-1)?.content).toContain(`Xeyle accepts ${a.name}'s offer`);
  });

  it('an NPC-requested roll posts a check card with the final roll and gets an answer', async () => {
    const { result, asked } = setup();
    const request = { to: 'rider', name: 'Xeyle', check: 'Insight', save: false, dc: 12 };
    let id = '';
    await act(async () => { id = result.current.chat.appendLine({ content: `Look closer.\n⟪ROLL⟫${JSON.stringify(request)}⟪/ROLL⟫`, characterName: a.name, npcId: a.key }); });
    await act(async () => { await result.current.onNpcRoll(id, a.key, request); });
    await waitFor(() => expect(asked).toHaveLength(1));
    const player = result.current.chat.messages.find(m => !m.npc_id);
    expect(player?.content).toContain('"replyTo":"' + id + '"');
    expect(player?.content).toContain('"dc":12');
  });

  it('an answer waits while the DM is writing, then goes', async () => {
    const { result, asked, rerender } = setup({ busy: true });
    await act(async () => { await result.current.onSendToNpcs('Hello?', [a.key]); });
    await new Promise(r => setTimeout(r, 400));
    expect(asked.length).toBe(0);
    rerender({ busy: false });
    await waitFor(() => expect(asked.length).toBe(1));
  });

  it('Let them talk: picked order, each line answers the last, and the rider speaking stops it', async () => {
    const { result, asked } = setup();
    await act(async () => { expect(await result.current.onStartScene([b.key, a.key], 'the challenge', 4)).toBe(true); });
    await waitFor(() => expect(asked.length).toBe(4));
    expect(asked.map(x => x.name)).toEqual([b.name, a.name, b.name, a.name]);
    expect(asked[0].line).toBe('the challenge');
    expect(asked[1].line).toContain(`${b.name}:`);
    expect(asked[3].mind).toContain('the last one');
    await waitFor(() => expect(result.current.sceneRunning).toBe(false));

    const second = setup();
    await act(async () => { await second.result.current.onStartScene([a.key, b.key], '', 4); });
    await waitFor(() => expect(second.asked.length).toBe(1));
    await act(async () => { await second.result.current.chat.postLine('Stop arguing.', true); });
    await waitFor(() => expect(second.result.current.sceneRunning).toBe(false));
    expect(second.asked.length).toBeLessThan(4);
  });

  it('Send to DM marks lines sent only when the DM replied, with the table rules', async () => {
    const failed = setup({ replied: false });
    let id = '';
    await act(async () => { id = (await failed.result.current.chat.postLine('I draw my dagger.', true)) || ''; });
    await act(async () => { await failed.result.current.chat.toggleSelected(id); });
    await act(async () => { await failed.result.current.onSendToDMNow(); });
    expect(failed.sendToDm).toHaveBeenCalledTimes(1);
    const [prompt, rules] = failed.sendToDm.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(prompt).toBe('[Xeyle]: I draw my dagger.');
    expect(rules).toMatchObject({ mode: 'live', chaosLevel: SOLO_CHAOS_LEVEL, hasInCharacter: true, hasNpcLines: false, hasTableTalk: false });
    expect(failed.result.current.chat.messages.find(m => m.id === id)?.consumed).toBe(false);

    const ok = setup({ replied: true });
    await act(async () => { id = (await ok.result.current.chat.postLine('I draw my dagger.', true)) || ''; });
    await act(async () => { await ok.result.current.chat.toggleSelected(id); });
    await act(async () => { await ok.result.current.onSendToDMNow(); });
    expect(ok.result.current.chat.messages.find(m => m.id === id)?.consumed).toBe(true);
  });

  it('keeps the table on the phone per campaign', async () => {
    const first = setup({ storageKey: 'solo-live-table:camp-1' });
    await act(async () => { await first.result.current.chat.postLine('Remember me.', true); });
    first.unmount();
    const again = setup({ storageKey: 'solo-live-table:camp-1' });
    expect(again.result.current.chat.messages.map(m => m.content)).toEqual(['Remember me.']);
    const other = setup({ storageKey: 'solo-live-table:camp-2' });
    expect(other.result.current.chat.messages).toEqual([]);
  });
});
