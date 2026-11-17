import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

import { heardLine, isWhisper, stageFromStory, tableHeard, useSoloLiveTable, SOLO_CHAOS_LEVEL, WHISPER_MARK } from '@/hooks/use-solo-live-table';
import { linesToKeep } from '@/hooks/use-arena-round-chat';
import { buildRoster, type RosterEntry } from '@/lib/solo-npcs';
import { CANON_ERAS } from '@/lib/empyreanCanon/castNpcs';
import type { SoloNpcs } from '@/hooks/use-solo-npcs';
import type { RoundChatMessage } from '@/hooks/use-round-chat';
import type { JudgedLine } from '@/lib/npc-urge';
import type { JudgeAsk } from '@/lib/solo-judge';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

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

// ── Urge meter (D-40): NPCs speak on their own ──
// Only Date is faked (the stage-entry cooldown is 45s); timers and awaits stay real.
describe('urge meter: NPCs speak on their own', () => {
  const rosterEntry = (key: string): RosterEntry => {
    const found = roster.find(e => e.key === key);
    if (!found) throw new Error(`The canon roster has no ${key}`);
    return found;
  };
  const jackE = rosterEntry('jack-barlowe');
  const imogenE = rosterEntry('imogen-cardulo');
  const trinaE = rosterEntry('trina');

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => { vi.useRealTimers(); });

  function setupUrge(over: { story: string; storageKey?: string; paused?: boolean; reply?: (name: string, n: number) => string } = { story: '' }) {
    const asked: Array<{ name: string; line: string; mind: string; controls?: string; model?: string }> = [];
    const voiceNPC = vi.fn(async (name: string | string[], line: string, _s?: unknown, mind?: string, _off?: boolean, controls?: string, model?: string) => {
      asked.push({ name: String(name), line, mind: mind || '', controls, model });
      await new Promise(r => setTimeout(r, 5));
      return over.reply ? over.reply(String(name), asked.length) : `**${name}:** "Answer ${asked.length}."`;
    });
    const hook = renderHook(() => useSoloLiveTable({
      userId: 'rider', riderName: 'Xeyle', npcs: fakeNpcs(roster), latestDmText: over.story,
      voiceNPC, sendToDm: vi.fn(async () => true), busy: false, storageKey: over.storageKey, paused: over.paused,
    }));
    return { ...hook, asked, voiceNPC };
  }

  it('an insult to his face makes Jack speak unprompted, on the cheap model, with the reason', async () => {
    const h = setupUrge({ story: `${jackE.name} smirks from the doorway.` });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Jack, you are useless', true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].name).toBe('Jack Barlowe');
    expect(h.asked[0].model).toBe('google/gemini-2.5-flash');
    // An unprompted line never carries the roll or join controls.
    expect(h.asked[0].controls).toBeUndefined();
    expect(h.asked[0].mind).toContain('WHY YOU SPEAK');
    expect(h.asked[0].mind).toContain('useless');
    await waitFor(() => expect(h.result.current.chat.messages.some(m => m.npc_id === 'jack-barlowe')).toBe(true));
    const jackLine = h.result.current.chat.messages.find(m => m.npc_id === 'jack-barlowe');
    expect(jackLine).toBeDefined();
    expect(jackLine?.selected).toBe(false);
  });

  it('"Only when spoken to", the table switch, and pause each keep them quiet', async () => {
    for (const change of ['spoken-to', 'off', 'paused'] as const) {
      const h = setupUrge({ story: `${jackE.name} smirks from the doorway.`, paused: change === 'paused' });
      act(() => {
        h.result.current.setTableOpen(true);
        if (change === 'spoken-to') h.result.current.urge.setNpc('jack-barlowe', 'spoken-to');
        if (change === 'off') h.result.current.urge.setEnabled(false);
      });
      vi.setSystemTime(Date.now() + 60_000);
      await act(async () => { await h.result.current.postRiderLine('Jack, you are useless', true); });
      await new Promise(r => setTimeout(r, 40));
      expect(h.asked.length).toBe(0);
      h.unmount();
    }
  });

  it('nobody wakes while the table is closed', async () => {
    const h = setupUrge({ story: `${jackE.name} smirks from the doorway.` });
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Jack, you are useless', true); });
    await new Promise(r => setTimeout(r, 40));
    expect(h.asked.length).toBe(0);
  });

  it('a near-threshold urge shows a tell; hush clears it; invite makes them speak at once', async () => {
    const h = setupUrge({ story: `${trinaE.name} waits by the gate.` });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Thank you, Trina, that was truly brave', true); });
    await waitFor(() => expect(h.result.current.tells['trina']).toBeTruthy());
    expect(h.asked.length).toBe(0);
    act(() => h.result.current.hushNpc('trina'));
    expect(h.result.current.tells['trina']).toBeUndefined();
    act(() => h.result.current.inviteNpc('trina'));
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].name).toBe('Trina');
    expect(h.asked[0].model).toBe('google/gemini-2.5-flash');
  });

  it('an unprompted line can wake one reaction, and the reaction wakes nobody (no chains)', async () => {
    const h = setupUrge({
      story: `${jackE.name} and ${imogenE.name} glare across the yard.`,
      reply: (name, n) => (n === 1 ? `**Jack:** "Imogen and her traitor friends should be afraid."` : `**${name}:** "Answer ${n}."`),
    });
    // Huddles off: this checks the plain one-reaction rule (with them on, these two would start a huddle).
    act(() => h.result.current.urge.setHuddles(false));
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Jack, the marked ones are useless', true); });
    await waitFor(() => expect(h.asked.length).toBe(2));
    expect(h.asked.map(a => a.name)).toEqual(['Jack Barlowe', 'Imogen Cardulo']);
    await new Promise(r => setTimeout(r, 40));
    expect(h.asked.length).toBe(2);
  });

  it('an addressed NPC answers once, on the DM model, and never doubles up unprompted', async () => {
    const h = setupUrge({ story: `${jackE.name} smirks from the doorway.` });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.onSendToNpcs('Jack, you are useless', ['jack-barlowe']); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].model).toBeUndefined();
    // A direct answer keeps Lovable's roll and join controls.
    expect(h.asked[0].controls).toContain('SOLO TABLE CONTROLS');
    await new Promise(r => setTimeout(r, 40));
    expect(h.asked.length).toBe(1);
  });

  it('the talkativeness switches are kept per campaign', () => {
    const a = setupUrge({ story: '', storageKey: 'solo-live-table:camp-urge' });
    act(() => a.result.current.urge.setNpc('jack-barlowe', 'chatty'));
    a.unmount();
    const b = setupUrge({ story: '', storageKey: 'solo-live-table:camp-urge' });
    expect(b.result.current.urge.perNpc['jack-barlowe']).toBe('chatty');
    const other = setupUrge({ story: '', storageKey: 'solo-live-table:camp-other' });
    expect(other.result.current.urge.perNpc['jack-barlowe']).toBeUndefined();
  });
});

describe('urge upgrades: memory, whispers, taste, rank, questions, energy', () => {
  const rosterEntry = (key: string): RosterEntry => {
    const found = roster.find(e => e.key === key);
    if (!found) throw new Error(`The canon roster has no ${key}`);
    return found;
  };
  const jackE = rosterEntry('jack-barlowe');
  const trinaE = rosterEntry('trina');
  const violetE = rosterEntry('violet-sorrengail');
  const lilithE = rosterEntry('lilith-sorrengail');

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => { vi.useRealTimers(); });

  function setupUp(over: { story: string; storageKey?: string; reply?: (name: string, n: number) => string }) {
    const asked: Array<{ name: string; mind: string }> = [];
    const voiceNPC = vi.fn(async (name: string | string[], _line: string, _s?: unknown, mind?: string) => {
      asked.push({ name: String(name), mind: mind || '' });
      await new Promise(r => setTimeout(r, 5));
      return over.reply ? over.reply(String(name), asked.length) : `**${name}:** "Answer ${asked.length}."`;
    });
    const hook = renderHook(() => useSoloLiveTable({
      userId: 'rider', riderName: 'Xeyle', npcs: fakeNpcs(roster), latestDmText: over.story,
      voiceNPC, sendToDm: vi.fn(async () => true), busy: false, storageKey: over.storageKey,
    }));
    return { ...hook, asked };
  }
  const settle = () => new Promise(r => setTimeout(r, 40));

  it('meter levels are remembered per campaign and fade after an hour away', async () => {
    const story = `${trinaE.name} waits by the gate.`;
    const first = setupUp({ story, storageKey: 'solo-live-table:camp-levels' });
    act(() => first.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await first.result.current.postRiderLine('Thank you, Trina, that was truly brave', true); });
    await waitFor(() => expect(first.result.current.tells['trina']).toBeTruthy());
    first.unmount();

    const back = setupUp({ story, storageKey: 'solo-live-table:camp-levels' });
    await waitFor(() => expect(back.result.current.tells['trina']).toBeTruthy());
    back.unmount();
    const other = setupUp({ story, storageKey: 'solo-live-table:camp-other-levels' });
    await settle();
    expect(other.result.current.tells['trina']).toBeUndefined();
    other.unmount();

    vi.setSystemTime(Date.now() + 3_700_000);
    const late = setupUp({ story, storageKey: 'solo-live-table:camp-levels' });
    await settle();
    expect(late.result.current.tells['trina']).toBeUndefined();
  });

  it('a whisperer whispers: marked, unheard by the others, and nobody reacts to it', async () => {
    const h = setupUp({
      story: `${violetE.name} and ${jackE.name} stand by the mat.`,
      reply: (name, n) => (n === 1 ? `**Violet:** "Jack is a useless coward, keep clear of him."` : `**${name}:** "Answer ${n}."`),
    });
    act(() => { h.result.current.setTableOpen(true); h.result.current.urge.setNpc('jack-barlowe', 'chatty'); });
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Violet, you are brilliant, tell me about the scribes', true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].name).toBe('Violet Sorrengail');
    await waitFor(() => expect(h.result.current.chat.messages.some(m => m.npc_id === 'violet-sorrengail')).toBe(true));
    const whisper = h.result.current.chat.messages.find(m => m.npc_id === 'violet-sorrengail');
    expect(whisper?.content).toContain(WHISPER_MARK);
    expect(whisper ? isWhisper(whisper) : false).toBe(true);
    // Jack was insulted by name in the whisper, but he never heard it.
    await settle();
    expect(h.asked.length).toBe(1);
    expect(tableHeard(h.result.current.chat.messages, undefined, 'jack-barlowe')).not.toContain('useless coward');
    expect(tableHeard(h.result.current.chat.messages, undefined, 'violet-sorrengail')).toContain('useless coward');
    await act(async () => { await h.result.current.onSendToNpcs('Jack, what are you staring at', ['jack-barlowe']); });
    await waitFor(() => expect(h.asked.length).toBe(2));
    expect(h.asked[1].mind).not.toContain('useless coward');
  });

  it('learned taste: sealing an offered line makes them chattier, deleting it or a hush quieter, and reset clears it', async () => {
    const h = setupUp({ story: `${jackE.name} smirks from the doorway.`, storageKey: 'solo-live-table:camp-taste' });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Jack, you are useless', true); });
    await waitFor(() => expect(h.result.current.chat.messages.some(m => m.npc_id === 'jack-barlowe')).toBe(true));
    const first = h.result.current.chat.messages.find(m => m.npc_id === 'jack-barlowe');
    expect(first).toBeDefined();
    await act(async () => { await h.result.current.chat.toggleSelected(first?.id ?? ''); });
    await waitFor(() => expect(h.result.current.urge.learned['jack-barlowe']).toBeCloseTo(0.95));
    // Unsealing and sealing again does not count twice.
    await act(async () => { await h.result.current.chat.toggleSelected(first?.id ?? ''); });
    await act(async () => { await h.result.current.chat.toggleSelected(first?.id ?? ''); });
    expect(h.result.current.urge.learned['jack-barlowe']).toBeCloseTo(0.95);

    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Jack, you are pathetic', true); });
    await waitFor(() => expect(h.result.current.chat.messages.filter(m => m.npc_id === 'jack-barlowe').length).toBe(2));
    const second = h.result.current.chat.messages.filter(m => m.npc_id === 'jack-barlowe')[1];
    await act(async () => { await h.result.current.chat.deleteMessage(second.id); });
    await waitFor(() => expect(h.result.current.urge.learned['jack-barlowe']).toBeCloseTo(1.045));
    act(() => h.result.current.hushNpc('jack-barlowe'));
    expect(h.result.current.urge.learned['jack-barlowe']).toBeCloseTo(1.15, 2);
    h.unmount();

    const back = setupUp({ story: `${jackE.name} smirks from the doorway.`, storageKey: 'solo-live-table:camp-taste' });
    expect(back.result.current.urge.learned['jack-barlowe']).toBeCloseTo(1.15, 2);
    act(() => back.result.current.urge.setNpc('jack-barlowe', 'chatty'));
    act(() => back.result.current.urge.reset());
    expect(back.result.current.urge.learned).toEqual({});
    expect(back.result.current.urge.perNpc['jack-barlowe']).toBe('chatty');
  });

  it('clearing the whole table teaches nothing', async () => {
    const h = setupUp({ story: `${jackE.name} smirks from the doorway.` });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Jack, you are useless', true); });
    await waitFor(() => expect(h.result.current.chat.messages.some(m => m.npc_id === 'jack-barlowe')).toBe(true));
    await act(async () => { await h.result.current.chat.clearAllMessages(); });
    await settle();
    expect(h.result.current.urge.learned).toEqual({});
  });

  it('rank: a cadet who would speak holds back while the General is on stage', async () => {
    const line = 'Trina, you fool';
    const alone = setupUp({ story: `${trinaE.name} waits by the gate, a dagger at her hip.` });
    act(() => alone.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await alone.result.current.postRiderLine(line, true); });
    await waitFor(() => expect(alone.asked.length).toBe(1));
    alone.unmount();

    const watched = setupUp({ story: `${trinaE.name} waits by the gate, a dagger at her hip. ${lilithE.name} watches.` });
    act(() => watched.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await watched.result.current.postRiderLine(line, true); });
    await settle();
    expect(watched.asked.length).toBe(0);
    expect(watched.result.current.tells['trina']).toBeTruthy();
  });

  it('an ignored question makes the NPC press; a plain answer does not', async () => {
    for (const asks of [true, false]) {
      const h = setupUp({
        story: `${trinaE.name} waits by the gate.`,
        reply: (name, n) => (n === 1 && asks ? `**Trina:** "Where were you last night?"` : `**${name}:** "Answer ${n}."`),
      });
      act(() => h.result.current.setTableOpen(true));
      await act(async () => { await h.result.current.onSendToNpcs('Trina, good morning', ['trina']); });
      await waitFor(() => expect(h.asked.length).toBe(1));
      await settle();
      vi.setSystemTime(Date.now() + 50_000);
      for (const text of ['I look at the sky', 'I check my boots', 'I hum a tune', 'I stretch my arms']) {
        await act(async () => { await h.result.current.postRiderLine(text, true); });
      }
      await settle();
      if (asks) {
        expect(h.asked.length).toBe(2);
        expect(h.asked[1].mind).toContain('you asked a question and it was ignored');
      } else {
        expect(h.asked.length).toBe(1);
      }
      h.unmount();
    }
  });

  it('answering the question (by name) clears it', async () => {
    const h = setupUp({
      story: `${trinaE.name} waits by the gate.`,
      reply: (name, n) => (n === 1 ? `**Trina:** "Where were you last night?"` : `**${name}:** "Answer ${n}."`),
    });
    act(() => h.result.current.setTableOpen(true));
    await act(async () => { await h.result.current.onSendToNpcs('Trina, good morning', ['trina']); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    await settle();
    await act(async () => { await h.result.current.onSendToNpcs('Trina, I was asleep', ['trina']); });
    await waitFor(() => expect(h.asked.length).toBe(2));
    await settle();
    vi.setSystemTime(Date.now() + 50_000);
    for (const text of ['I look at the sky', 'I check my boots', 'I hum a tune', 'I stretch my arms']) {
      await act(async () => { await h.result.current.postRiderLine(text, true); });
    }
    await settle();
    expect(h.asked.length).toBe(2);
  });

  it('table energy: after a tense DM post a small nudge is enough to speak', async () => {
    const line = 'Thank you, Trina';
    const calm = setupUp({ story: `${trinaE.name} waits by the gate.` });
    act(() => calm.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await calm.result.current.postRiderLine(line, true); });
    await settle();
    expect(calm.asked.length).toBe(0);
    calm.unmount();

    const tense = setupUp({ story: `${trinaE.name} waits by the gate. Blood on the stones, a scream, and someone is dead.` });
    act(() => tense.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await tense.result.current.postRiderLine(line, true); });
    await waitFor(() => expect(tense.asked.length).toBe(1));
  });
});

describe('Tier 3 and huddles: memories, the judge, and NPCs talking among themselves', () => {
  const rosterEntry = (key: string): RosterEntry => {
    const found = roster.find(e => e.key === key);
    if (!found) throw new Error(`The canon roster has no ${key}`);
    return found;
  };
  const trinaE = rosterEntry('trina');
  const xadenE = rosterEntry('xaden-riorson');
  const imogenE = rosterEntry('imogen-cardulo');

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => { vi.useRealTimers(); });

  function setupT3(over: { story: string; entries?: RosterEntry[]; storageKey?: string; scale?: number; judged?: (ask: JudgeAsk) => JudgedLine | null; reply?: (name: string, n: number) => string }) {
    const asked: Array<{ name: string; line: string; mind: string; controls?: string; model?: string }> = [];
    const voiceNPC = vi.fn(async (name: string | string[], line: string, _s?: unknown, mind?: string, _off?: boolean, controls?: string, model?: string) => {
      asked.push({ name: String(name), line, mind: mind || '', controls, model });
      await new Promise(r => setTimeout(r, 3));
      return over.reply ? over.reply(String(name), asked.length) : `**${name}:** "Answer ${asked.length}."`;
    });
    const judge = vi.fn(async (ask: JudgeAsk) => (over.judged ? over.judged(ask) : null));
    const hook = renderHook(() => useSoloLiveTable({
      userId: 'rider', riderName: 'Xeyle', npcs: fakeNpcs(over.entries ?? roster), latestDmText: over.story,
      voiceNPC, sendToDm: vi.fn(async () => true), busy: false, storageKey: over.storageKey, judge, huddleTimeScale: over.scale ?? 0.002,
    }));
    return { ...hook, asked, judge };
  }
  const settle = (ms = 60) => new Promise(r => setTimeout(r, ms));
  const topicLine = 'They say the marked ones cannot be trusted';
  const huddleStory = `${xadenE.name} and ${imogenE.name} stand by the mat.`;

  it('a line that touches a memory makes them speak, and the memory is handed to the AI', async () => {
    const withMemory = roster.map(e => (e.key === 'trina' ? { ...e, memories: ['Xeyle shared her rations on the Gauntlet.'] } : e));
    const h = setupT3({ story: `${trinaE.name} waits by the gate, a dagger at her hip.`, entries: withMemory });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    // name 6 + memory 4 = 10: enough to speak. Without the memory, 6 is not even a tell.
    await act(async () => { await h.result.current.postRiderLine('Trina, remember the Gauntlet and those rations?', true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].mind).toContain('shared her rations');
    // The same memory rests before it can trigger again.
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Trina, the Gauntlet rations again', true); });
    await settle();
    expect(h.asked.length).toBe(1);
  });

  it('the judge reads lines the lists made little of, and its read can wake an NPC', async () => {
    const h = setupT3({
      story: `${trinaE.name} waits by the gate, a dagger at her hip.`,
      judged: () => ({ tone: 'neutral', sidesWith: '', items: [{ key: 'trina', read: 'threat', strength: 3, memory: 0 }] }),
    });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    // Lists: name 6. Judge: a veiled threat, 4. Together 10.
    await act(async () => { await h.result.current.postRiderLine('Trina, it would be a shame if you slipped on the Parapet', true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.judge).toHaveBeenCalledTimes(1);
    expect(h.judge.mock.calls[0][0]).toMatchObject({ huddle: false, line: 'Trina, it would be a shame if you slipped on the Parapet' });
    expect(h.asked[0].mind).toContain('sounded like a threat');
    expect(h.asked[0].controls).toBeUndefined();
  });

  it('the judge is not asked for short lines, lines aimed at nobody, lines the lists caught, too soon after the last, or when off', async () => {
    const h = setupT3({ story: `${trinaE.name} waits by the gate.`, judged: () => ({ tone: 'neutral', sidesWith: '', items: [] }) });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Fine. Whatever.', true); });
    await act(async () => { await h.result.current.postRiderLine('Trina, you are a useless coward today', true); });
    await act(async () => { await h.result.current.postRiderLine('What a lovely quiet morning this is', true); });
    await settle();
    expect(h.judge).not.toHaveBeenCalled();
    act(() => h.result.current.urge.setJudge(false));
    expect(h.result.current.urge.judge).toBe(false);
    await act(async () => { await h.result.current.postRiderLine('Well, you certainly know how to keep watch', true); });
    await settle();
    expect(h.judge).not.toHaveBeenCalled();
    act(() => h.result.current.urge.setJudge(true));
    await act(async () => { await h.result.current.postRiderLine('Well, you certainly know how to keep a watch', true); });
    await waitFor(() => expect(h.judge).toHaveBeenCalledTimes(1));
    // Straight after: not again. A little later: yes.
    await act(async () => { await h.result.current.postRiderLine('And you never once looked up from it', true); });
    await settle();
    expect(h.judge).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 20_000);
    await act(async () => { await h.result.current.postRiderLine('Do you ever look up at all', true); });
    await waitFor(() => expect(h.judge).toHaveBeenCalledTimes(2));
  });

  it('a shared topic starts a huddle: they take turns, on the cheap model, and it winds down by itself', async () => {
    const h = setupT3({ story: huddleStory });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine(topicLine, true); });
    await waitFor(() => expect(h.result.current.huddle?.active).toBe(true));
    expect(h.result.current.huddle?.names.slice().sort()).toEqual(['Imogen', 'Xaden']);
    await waitFor(() => expect(h.result.current.huddle?.active ?? false).toBe(false), { timeout: 3000 });
    // Four lines of steam, nobody speaks twice running, first opens and last lets it drop.
    expect(h.asked).toHaveLength(4);
    for (let i = 1; i < h.asked.length; i++) expect(h.asked[i].name).not.toBe(h.asked[i - 1].name);
    expect(h.asked[0].mind).toContain('## HUDDLE');
    expect(h.asked[0].mind).toContain('Start it');
    expect(h.asked[3].mind).toContain('Let it drop now');
    expect(h.asked.every(a => a.model === 'google/gemini-2.5-flash' && a.controls === undefined)).toBe(true);
    // The finished conversation can be sealed in one tap.
    expect(h.result.current.huddle).toMatchObject({ active: false, canSeal: true });
    act(() => h.result.current.huddleSeal());
    await waitFor(() => expect(h.result.current.huddle).toBeNull());
    expect(h.result.current.chat.messages.filter(m => m.npc_id && m.selected)).toHaveLength(4);
    // No second huddle straight away.
    await act(async () => { await h.result.current.postRiderLine('And the marked ones know it', true); });
    await settle();
    expect(h.result.current.huddle?.active ?? false).toBe(false);
  });

  it('the rider is a third voice: their line is answered, the huddle goes on, and whose side they took is known', async () => {
    const h = setupT3({
      story: huddleStory, scale: 0.03,
      judged: ask => (ask.huddle ? { tone: 'heated', sidesWith: 'xaden-riorson', items: [] } : null),
    });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine(topicLine, true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    await act(async () => { await h.result.current.postRiderLine('Imogen, that is not fair and you know it', true); });
    await waitFor(() => expect(h.result.current.huddle?.active ?? false).toBe(false), { timeout: 3000 });
    const answer = h.asked.find(a => a.mind.includes('just cut in'));
    expect(answer?.name).toBe('Imogen Cardulo');
    expect(answer?.line).toContain('that is not fair');
    // The rider's line added steam: more than the four lines a silent huddle gets.
    expect(h.asked.length).toBeGreaterThan(4);
    expect(h.judge.mock.calls.some(c => c[0].huddle === true)).toBe(true);
    expect(h.asked.some(a => a.name === 'Xaden Riorson' && a.mind.includes('has taken your side'))).toBe(true);
    expect(h.asked.some(a => a.name === 'Imogen Cardulo' && a.mind.includes('taken the other side against you'))).toBe(true);
  });

  it('Enough ends it at once and they learn from it; the People switch turns huddles off', async () => {
    const h = setupT3({ story: huddleStory, storageKey: 'solo-live-table:camp-huddle', scale: 0.03 });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine(topicLine, true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    act(() => h.result.current.huddleEnough());
    expect(h.result.current.huddle?.active ?? false).toBe(false);
    await settle(120);
    expect(h.asked.length).toBeLessThanOrEqual(2);
    const saved = JSON.parse(getScopedItem('solo-live-table:camp-huddle:huddle') ?? '{}') as { appetite?: number };
    expect(saved.appetite).toBeCloseTo(0.85);
    h.unmount();

    const off = setupT3({ story: huddleStory });
    act(() => { off.result.current.setTableOpen(true); off.result.current.urge.setHuddles(false); });
    vi.setSystemTime(Date.now() + 600_000);
    await act(async () => { await off.result.current.postRiderLine(topicLine, true); });
    await settle();
    expect(off.result.current.huddle).toBeNull();
  });

  it('reopening the app does not restart the five tense minutes', async () => {
    const story = `${trinaE.name} waits by the gate. Blood on the stones, a scream, and someone is dead.`;
    const first = setupT3({ story, storageKey: 'solo-live-table:camp-energy' });
    act(() => first.result.current.setTableOpen(true));
    await settle(20);
    first.unmount();
    vi.setSystemTime(Date.now() + 360_000);
    const back = setupT3({ story, storageKey: 'solo-live-table:camp-energy' });
    act(() => back.result.current.setTableOpen(true));
    // 8 points: enough while the room is tense (bar 8), not once the five minutes are up (bar 10).
    await act(async () => { await back.result.current.postRiderLine('Thank you, Trina', true); });
    await settle();
    expect(back.asked).toHaveLength(0);
  });

  it('a silent rider gets turned to, and a closed table never starts one', async () => {
    // An eager rider (appetite 1.5) gets six lines of steam: enough for someone to turn to them.
    setScopedItem('solo-live-table:camp-turn:huddle', JSON.stringify({ appetite: 1.5, paceMs: 14_000, pairs: {} }));
    const eager = setupT3({ story: huddleStory, storageKey: 'solo-live-table:camp-turn' });
    act(() => eager.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await eager.result.current.postRiderLine(topicLine, true); });
    await waitFor(() => expect(eager.result.current.huddle?.active).toBe(true));
    await waitFor(() => expect(eager.result.current.huddle?.active ?? false).toBe(false), { timeout: 3000 });
    expect(eager.asked.some(a => a.mind.includes('Turn to them now'))).toBe(true);
    eager.unmount();

    const closed = setupT3({ story: huddleStory });
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await closed.result.current.postRiderLine(topicLine, true); });
    await settle();
    expect(closed.result.current.huddle).toBeNull();
    expect(closed.asked).toHaveLength(0);
  });
});

describe('DM tandem: the DM directs the table, and the table reports back', () => {
  const rosterEntry = (key: string): RosterEntry => {
    const found = roster.find(e => e.key === key);
    if (!found) throw new Error(`The canon roster has no ${key}`);
    return found;
  };
  const trinaE = rosterEntry('trina');
  const dainE = rosterEntry('dain-aetos');
  const xadenE = rosterEntry('xaden-riorson');
  const imogenE = rosterEntry('imogen-cardulo');

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => { vi.useRealTimers(); });

  function setupDm(over: { story: string; storageKey?: string; busy?: boolean; scale?: number }) {
    const asked: Array<{ name: string; line: string; mind: string }> = [];
    const voiceNPC = vi.fn(async (name: string | string[], line: string, _s?: unknown, mind?: string) => {
      asked.push({ name: String(name), line, mind: mind || '' });
      await new Promise(r => setTimeout(r, 3));
      return `**${name}:** "Answer ${asked.length}."`;
    });
    const sent: Array<{ prompt: string; notes: string }> = [];
    const sendToDm = vi.fn(async (prompt: string, rules: { dmNotes?: string }) => { sent.push({ prompt, notes: rules.dmNotes ?? '' }); return true; });
    const hook = renderHook((props: { story: string; busy: boolean }) => useSoloLiveTable({
      userId: 'rider', riderName: 'Xeyle', npcs: fakeNpcs(roster), latestDmText: props.story,
      voiceNPC, sendToDm, busy: props.busy, storageKey: over.storageKey, judge: async () => null, huddleTimeScale: over.scale ?? 0.002,
    }), { initialProps: { story: over.story, busy: over.busy ?? false } });
    return { ...hook, asked, sent };
  }
  const settle = (ms = 60) => new Promise(r => setTimeout(r, ms));
  const onStage = (h: ReturnType<typeof setupDm>) => h.result.current.tableNpcs.filter(n => n.on_stage).map(n => n.id).sort();

  it('the STAGE direction decides who is here; without one the names in the post do', () => {
    const named = `${dainE.name} blocks the door. ${xadenE.name} is still away at Samara.`;
    expect(onStage(setupDm({ story: named }))).toEqual(['dain-aetos', 'xaden-riorson']);
    expect(onStage(setupDm({ story: `${named}\n<!--LIVE:STAGE ${dainE.name}-->` }))).toEqual(['dain-aetos']);
    expect(onStage(setupDm({ story: `${named}\n<!--LIVE:STAGE none-->` }))).toEqual([]);
  });

  it('the ROOM direction sets the mood whatever the words say', async () => {
    const h = setupDm({ story: `${trinaE.name} waits by the gate.\n<!--LIVE:STAGE ${trinaE.name}-->\n<!--LIVE:ROOM tense-->` });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    // 8 points: enough only while the room is tense.
    await act(async () => { await h.result.current.postRiderLine('Thank you, Trina', true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
  });

  it('a CUE waits for the DM to finish and the table to open, then that NPC speaks first, once', async () => {
    const story = `${trinaE.name} waits by the gate.\n<!--LIVE:STAGE ${trinaE.name}-->\n<!--LIVE:CUE ${trinaE.name} | she wants to know where you were last night-->`;
    const h = setupDm({ story, storageKey: 'solo-live-table:camp-cue', busy: true });
    act(() => h.result.current.setTableOpen(true));
    await settle();
    expect(h.asked).toHaveLength(0); // the DM is still writing
    h.rerender({ story, busy: false });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].name).toBe(trinaE.name);
    expect(h.asked[0].mind).toContain('she wants to know where you were last night');
    await settle();
    h.unmount();
    // Reopening the app does not run the same post's directions again.
    const back = setupDm({ story, storageKey: 'solo-live-table:camp-cue' });
    act(() => back.result.current.setTableOpen(true));
    await settle();
    expect(back.asked).toHaveLength(0);

    const closed = setupDm({ story: story.replace('last night', 'this morning') });
    await settle();
    expect(closed.asked).toHaveLength(0);
    act(() => closed.result.current.setTableOpen(true));
    await waitFor(() => expect(closed.asked.length).toBe(1));
  });

  it('a HUDDLE direction starts those two talking about what the DM named', async () => {
    const h = setupDm({ story: `They face each other.\n<!--LIVE:STAGE ${xadenE.name}; ${imogenE.name}-->\n<!--LIVE:HUDDLE ${xadenE.name} + ${imogenE.name} | who let the secret slip-->` });
    act(() => h.result.current.setTableOpen(true));
    await waitFor(() => expect(h.result.current.huddle?.active).toBe(true));
    await waitFor(() => expect(h.asked.length).toBeGreaterThan(0));
    expect(h.asked[0].mind).toContain('who let the secret slip');
  });

  it('a hand-off tells the DM how the huddle went, and that a whisper was private', async () => {
    const h = setupDm({ story: `${xadenE.name} and ${imogenE.name} stand by the mat.`, scale: 0.002 });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('They say the marked ones cannot be trusted', true); });
    await waitFor(() => expect(h.result.current.huddle?.active).toBe(true));
    await waitFor(() => expect(h.result.current.huddle?.active ?? false).toBe(false), { timeout: 3000 });
    act(() => h.result.current.huddleSeal());
    await waitFor(() => expect(h.result.current.chat.messages.filter(m => m.npc_id && m.selected).length).toBe(4));
    await act(async () => { await h.result.current.onSendToDMNow(); });
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].notes).toContain('## LIVE TABLE STATE');
    expect(h.sent[0].notes).toContain('just had it out about "marked"');
    expect(h.sent[0].notes).toContain('Xeyle stayed out of it');
    expect(h.sent[0].notes).not.toContain('whispered');
    // Reported once: the next hand-off does not repeat it.
    let lineId = '';
    await act(async () => { lineId = (await h.result.current.postRiderLine('I walk away', true)) || ''; });
    await act(async () => { await h.result.current.chat.toggleSelected(lineId); });
    await act(async () => { await h.result.current.onSendToDMNow(); });
    expect(h.sent).toHaveLength(2);
    expect(h.sent[1].notes).not.toContain('just had it out');
  });
});

describe('delivery: voice, the private note, sameness and actions', () => {
  const rosterEntry = (key: string): RosterEntry => {
    const found = roster.find(e => e.key === key);
    if (!found) throw new Error(`The canon roster has no ${key}`);
    return found;
  };
  const trinaE = rosterEntry('trina');
  const dainE = rosterEntry('dain-aetos');
  const jackE = rosterEntry('jack-barlowe');

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => { vi.useRealTimers(); });

  function setupDelivery(over: { story: string; entries?: RosterEntry[]; storageKey?: string; sparAvailable?: boolean; reply?: (name: string, n: number) => string }) {
    const asked: Array<{ name: string; delivery: string; model?: string }> = [];
    const voiceNPC = vi.fn(async (name: string | string[], _line: string, _s?: unknown, _mind?: string, _off?: boolean, _controls?: string, model?: string, delivery?: string) => {
      asked.push({ name: String(name), delivery: delivery || '', model });
      await new Promise(r => setTimeout(r, 3));
      return over.reply ? over.reply(String(name), asked.length) : `**${name}:** "Answer ${asked.length}."`;
    });
    const sent: string[] = [];
    const sendToDm = vi.fn(async (_prompt: string, rules: { dmNotes?: string }) => { sent.push(rules.dmNotes ?? ''); return true; });
    const hook = renderHook(() => useSoloLiveTable({
      userId: 'rider', riderName: 'Xeyle', npcs: fakeNpcs(over.entries ?? roster), latestDmText: over.story,
      voiceNPC, sendToDm, busy: false, storageKey: over.storageKey, judge: async () => null, huddleTimeScale: 0.002, sparAvailable: over.sparAvailable,
    }));
    return { ...hook, asked, sent };
  }
  const settle = (ms = 60) => new Promise(r => setTimeout(r, ms));
  const onStage = (h: ReturnType<typeof setupDelivery>) => h.result.current.tableNpcs.filter(n => n.on_stage).map(n => n.id).sort();
  const npcLines = (h: ReturnType<typeof setupDelivery>) => h.result.current.chat.messages.filter(m => m.npc_id);

  it('every line is asked for with the NPC\'s voice and mood, and a direct question must get words', async () => {
    const h = setupDelivery({ story: `${dainE.name} blocks the door.` });
    await act(async () => { await h.result.current.onSendToNpcs('Dain, where were you last night?', ['dain-aetos']); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    const d = h.asked[0].delivery;
    expect(d).toContain('## HOW DAIN AETOS SPEAKS AND MOVES');
    expect(d).toContain('quotes regulations');
    expect(d).toContain('Right now you are');
    expect(d).toContain('put a direct question to you');
    expect(d).toContain('about 6 words');
    expect(d).toContain('You have no private note yet');
    expect(d).not.toContain('⟪ACT leave⟫'); // never walks out on a direct question, never the last one at the table
  });

  it('the private note is hidden from the table, carried into their next line, and kept per campaign', async () => {
    const reply = (name: string, n: number) => (n === 1
      ? `**${name}:** "Asleep. Ask anyone." *He does not look up.*\n⟪MIND want: to get Xeyle out of this room | unsaid: I saw you leave | body: at the desk, quill in hand | truth: I was at the vault ⟫`
      : `**${name}:** "Is that all?"`);
    const h = setupDelivery({ story: `${dainE.name} sits at his desk.`, storageKey: 'solo-live-table:camp-mind', reply });
    await act(async () => { await h.result.current.onSendToNpcs('Dain, where were you last night?', ['dain-aetos']); });
    await waitFor(() => expect(npcLines(h).length).toBe(1));
    expect(npcLines(h)[0].content).not.toContain('MIND');
    expect(npcLines(h)[0].content).toContain('He does not look up.');
    await act(async () => { await h.result.current.onSendToNpcs('Dain, try again', ['dain-aetos']); });
    await waitFor(() => expect(h.asked.length).toBe(2));
    expect(h.asked[1].delivery).toContain('- You want: to get Xeyle out of this room');
    expect(h.asked[1].delivery).toContain('- Your body: at the desk, quill in hand');
    expect(h.asked[1].delivery).toContain('- The truth you are keeping: I was at the vault');
    // The DM is told what he is after and what he is hiding, once the line is sealed and sent.
    const first = npcLines(h)[0];
    await act(async () => { await h.result.current.chat.toggleSelected(first.id); });
    await act(async () => { await h.result.current.onSendToDMNow(); });
    expect(h.sent[0]).toContain('is after: to get Xeyle out of this room');
    expect(h.sent[0]).toContain('is hiding from Xeyle: I was at the vault');
    h.unmount();
    const back = setupDelivery({ story: `${dainE.name} sits at his desk.`, storageKey: 'solo-live-table:camp-mind' });
    await act(async () => { await back.result.current.onSendToNpcs('Dain, good morning', ['dain-aetos']); });
    await waitFor(() => expect(back.asked.length).toBe(1));
    expect(back.asked[0].delivery).toContain('- You want: to get Xeyle out of this room');
  });

  it('samey lines get a correction on the next request', async () => {
    const h = setupDelivery({ story: `${trinaE.name} waits by the gate.`, reply: name => `**${name}:** "No. Not today." *She folds her arms.*` });
    for (const line of ['Trina, one', 'Trina, two', 'Trina, three', 'Trina, four']) {
      await act(async () => { await h.result.current.onSendToNpcs(line, ['trina']); });
      await waitFor(() => expect(h.asked.length).toBeGreaterThan(0));
      await settle(20);
    }
    await waitFor(() => expect(h.asked.length).toBe(4));
    expect(h.asked[2].delivery).not.toContain('were all');
    expect(h.asked[3].delivery).toContain('Your last 3 lines were all only a few words');
    expect(h.asked[3].delivery).toContain('movement after the words');
    expect(h.asked[3].delivery).toContain('your arms');
  });

  it('walking out takes them off stage (never the last one), and calling them over brings them back', async () => {
    const story = `${dainE.name} and ${trinaE.name} wait by the mat.`;
    const reply = (name: string) => `**${name}:** "I am done here."\n⟪ACT leave⟫`;
    const h = setupDelivery({ story, reply });
    expect(onStage(h)).toEqual(['dain-aetos', 'trina']);
    await act(async () => { await h.result.current.onSendToNpcs('Dain, sit down', ['dain-aetos']); });
    await waitFor(() => expect(onStage(h)).toEqual(['trina']));
    expect(npcLines(h)[0].content).not.toContain('ACT');
    // One exit per DM post, and never the last one at the table.
    await act(async () => { await h.result.current.onSendToNpcs('Trina, stay', ['trina']); });
    await waitFor(() => expect(h.asked.length).toBe(2));
    await settle();
    expect(onStage(h)).toEqual(['trina']);
    expect(h.asked[1].delivery).not.toContain('⟪ACT leave⟫');
    act(() => h.result.current.callOver('dain-aetos'));
    await waitFor(() => expect(onStage(h)).toEqual(['dain-aetos', 'trina']));
  });

  it('squaring up offers a bout only when the screen can run one, and a hand-over reaches the DM only if sealed', async () => {
    const story = `${jackE.name} circles the mat. ${trinaE.name} watches.`;
    const reply = (name: string, n: number) => (n === 1 ? `**${name}:** "Mat. Now."\n⟪ACT square-up⟫` : `**${name}:** "Take it."\n⟪ACT give: a folded order⟫`);
    const without = setupDelivery({ story, reply });
    await act(async () => { await without.result.current.onSendToNpcs('Jack, back off', ['jack-barlowe']); });
    await waitFor(() => expect(without.asked.length).toBe(1));
    await settle();
    expect(without.result.current.challenge).toBeNull();
    expect(without.asked[0].delivery).not.toContain('⟪ACT square-up⟫');
    without.unmount();

    const h = setupDelivery({ story, reply, sparAvailable: true });
    await act(async () => { await h.result.current.onSendToNpcs('Jack, back off', ['jack-barlowe']); });
    await waitFor(() => expect(h.result.current.challenge).toEqual({ key: 'jack-barlowe', name: jackE.name }));
    expect(h.asked[0].delivery).toContain('⟪ACT square-up⟫');
    act(() => h.result.current.clearChallenge());
    expect(h.result.current.challenge).toBeNull();
    await act(async () => { await h.result.current.onSendToNpcs('Trina, what is that?', ['trina']); });
    await waitFor(() => expect(npcLines(h).length).toBe(2));
    const give = npcLines(h)[1];
    await act(async () => { await h.result.current.chat.toggleSelected(give.id); });
    await act(async () => { await h.result.current.onSendToDMNow(); });
    expect(h.sent[0]).toContain(`${trinaE.name} handed Xeyle: a folded order.`);
    expect(h.sent[0]).not.toContain('squared up'); // that line was not sealed
  });

  it('a line that matters is written by the story\'s own model; small talk stays on the cheap one', async () => {
    const withMemory = roster.map(e => (e.key === 'trina' ? { ...e, memories: ['Xeyle shared her rations on the Gauntlet.'] } : e));
    const h = setupDelivery({ story: `${trinaE.name} waits by the gate, a dagger at her hip.`, entries: withMemory });
    act(() => h.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await h.result.current.postRiderLine('Trina, remember the Gauntlet and those rations?', true); });
    await waitFor(() => expect(h.asked.length).toBe(1));
    expect(h.asked[0].model).toBeUndefined();
    h.unmount();
    const small = setupDelivery({ story: `${jackE.name} smirks from the doorway.` });
    act(() => small.result.current.setTableOpen(true));
    vi.setSystemTime(Date.now() + 60_000);
    await act(async () => { await small.result.current.postRiderLine('Jack, you are useless', true); });
    await waitFor(() => expect(small.asked.length).toBe(1));
    expect(small.asked[0].model).toBe('google/gemini-2.5-flash');
  });
});
