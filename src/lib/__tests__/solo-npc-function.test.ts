import { describe, expect, it } from 'vitest';
import {
  readBuildInput, readBuildResult, readRememberInput, readRememberResult, rememberSystem, MAX_NPCS_PER_SCENE, MAX_SCENE_CHARS,
  judgeSystem, readJudgeInput, readJudgeResult, MAX_JUDGE_LINE_CHARS, MAX_JUDGE_MEMORIES,
} from '../../../supabase/functions/solo-npc/logic';

const npc = (key: string, name: string) => ({ key, name, personality: 'Rule-bound.', attitude: 0, recent: ['Saw Kylar on the Parapet.'] });

describe('solo-npc: remember (D-38)', () => {
  it('reads a scene: trims it, caps the NPCs, drops duplicates and blanks', () => {
    const many = Array.from({ length: 12 }, (_, i) => npc(`k${i}`, `N${i}`));
    const input = readRememberInput({ riderName: 'Kylar Stern', era: 'fw', scene: 'x'.repeat(MAX_SCENE_CHARS + 50), npcs: [npc('dain', 'Dain'), npc('dain', 'Dain again'), { key: '', name: 'X' }, ...many] });
    if (!input) throw new Error("Expected valid result");
    expect(input.scene.length).toBe(MAX_SCENE_CHARS);
    expect(input.npcs.length).toBeLessThanOrEqual(MAX_NPCS_PER_SCENE);
    expect(input.npcs.filter(n => n.key === 'dain')).toHaveLength(1);
    expect(readRememberInput({ scene: '', npcs: [npc('a', 'A')] })).toBeNull();
    expect(readRememberInput({ scene: 'x', npcs: [] })).toBeNull();
  });

  it('the instructions name every NPC by key and the rider', () => {
    const input = readRememberInput({ riderName: 'Kylar Stern', era: "Violet's first year", scene: 'Dain shouts.', npcs: [npc('dain-aetos', 'Dain Aetos')] });
    if (!input) throw new Error("Expected valid result");
    const sys = rememberSystem(input);
    expect(sys).toContain('key "dain-aetos"');
    expect(sys).toContain('Kylar Stern');
  });

  it('keeps only answers for NPCs it asked about, one step at a time, no empty ones', () => {
    const input = readRememberInput({ riderName: 'K', scene: 's', npcs: [npc('a', 'A'), npc('b', 'B'), npc('c', 'C')] });
    if (!input) throw new Error("Expected valid result");
    const out = readRememberResult({ items: [
      { key: 'a', memory: 'Kylar held the line.', attitude_change: 5 },
      { key: 'a', memory: 'again', attitude_change: 1 },
      { key: 'b', memory: '', attitude_change: -1 },
      { key: 'zzz', memory: 'not asked', attitude_change: 1 },
      { key: 'c', memory: 'Kylar mocked her.', attitude_change: -3 },
    ] }, input);
    expect(out).toEqual([
      { key: 'a', memory: 'Kylar held the line.', attitudeChange: 1 },
      { key: 'c', memory: 'Kylar mocked her.', attitudeChange: -1 },
    ]);
    expect(readRememberResult(null, input)).toEqual([]);
  });
});

describe('solo-npc: build (D-38)', () => {
  it('needs a description', () => {
    expect(readBuildInput({ description: ' a ' })).toBeNull();
    expect(readBuildInput({ description: 'A gruff second-year from Calldyr' })?.description).toBe('A gruff second-year from Calldyr');
  });

  it('cleans the model\'s NPC: lengths, attitude range, fight profile', () => {
    const npc = readBuildResult({
      name: 'Corin Vale', role: 'Second-year', look: 'Tall', personality: 'Gruff.', voice: 'Low', wants: 'Respect',
      facts: ['a', 'b', 'c', 'd', 'e'], secrets: ['s'], attitude: 9, fight_kind: 'dragon', fight_challenge: 'hard', can_fight: true,
    });
    if (!npc) throw new Error('Expected valid NPC');
    expect(npc.attitude).toBe(3);
    expect(npc.facts).toHaveLength(4);
    expect(npc.fight).toEqual({ kind: 'rider', challenge: 'hard' });
    expect(readBuildResult({ name: 'X', personality: 'Kind', can_fight: false })?.fight).toBeNull();
    expect(readBuildResult({ name: '', personality: 'x' })).toBeNull();
  });
});

describe('solo-npc: judge (urge meter)', () => {
  const who = (key: string, name: string, memories: string[] = []) => ({ key, name, personality: 'Proud.', attitude: 1, memories });

  it('reads a line: trims it, caps NPCs and memories, drops duplicates and blanks', () => {
    const input = readJudgeInput({
      riderName: 'Kylar', line: 'x'.repeat(MAX_JUDGE_LINE_CHARS + 40), heard: 'Dain: Stand down.', huddle: true,
      npcs: [who('dain', 'Dain', Array.from({ length: 12 }, (_, i) => `memory ${i}`)), who('dain', 'Dain again'), { key: '', name: 'X' }],
    });
    if (!input) throw new Error('Expected valid result');
    expect(input.line.length).toBe(MAX_JUDGE_LINE_CHARS);
    expect(input.npcs).toHaveLength(1);
    expect(input.npcs[0].memories).toHaveLength(MAX_JUDGE_MEMORIES);
    expect(input.huddle).toBe(true);
    expect(readJudgeInput({ line: '', npcs: [who('a', 'A')] })).toBeNull();
    expect(readJudgeInput({ line: 'hello', npcs: [] })).toBeNull();
  });

  it('the instructions list every NPC by key with numbered memories', () => {
    const input = readJudgeInput({ riderName: 'Kylar', line: 'Nice work, squad leader.', npcs: [who('dain-aetos', 'Dain Aetos', ['Kylar broke formation.', 'Kylar lied about the Gauntlet.'])] });
    if (!input) throw new Error('Expected valid result');
    const sys = judgeSystem(input);
    expect(sys).toContain('key "dain-aetos"');
    expect(sys).toContain('(2) Kylar lied about the Gauntlet.');
    expect(sys).not.toContain('middle of a conversation');
  });

  it('keeps only valid answers: known keys, known reads, memory numbers in range, a real side', () => {
    const input = readJudgeInput({ line: 'hm', npcs: [who('a', 'A', ['one', 'two']), who('b', 'B')] });
    if (!input) throw new Error('Expected valid result');
    const out = readJudgeResult({
      tone: 'heated', sides_with: 'a',
      items: [
        { key: 'a', read: 'mockery', strength: 9, memory: 2 },
        { key: 'a', read: 'insult', strength: 1, memory: 0 },
        { key: 'b', read: 'made-up', strength: 2, memory: 5 },
        { key: 'zzz', read: 'insult', strength: 2, memory: 0 },
      ],
    }, input);
    expect(out).toEqual({ tone: 'heated', sidesWith: 'a', items: [{ key: 'a', read: 'mockery', strength: 3, memory: 2 }] });
    expect(readJudgeResult({ tone: 'odd', sides_with: 'nobody', items: [] }, input)).toEqual({ tone: 'neutral', sidesWith: '', items: [] });
    expect(readJudgeResult(null, input)).toBeNull();
  });
});
