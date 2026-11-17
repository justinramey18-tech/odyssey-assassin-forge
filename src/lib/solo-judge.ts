// Solo Empyrean urge meter: asks the solo-npc function's "judge" how one rider line lands on
// the NPCs present (sarcasm, veiled threats, taking a side, a memory it touches).
// It only reports: nothing is saved. Any failure returns null and play carries on without it.
import { supabase } from '@/integrations/supabase/client';
import type { JudgedItem, JudgedLine, JudgeRead, JudgeTone } from '@/lib/npc-urge';

export interface JudgeAsk {
  riderName: string;
  line: string;
  /** Recent table lines, oldest first. */
  heard: string;
  /** The NPCs listed are mid-conversation and the rider cut in. */
  huddle: boolean;
  npcs: Array<{ key: string; name: string; personality: string; attitude: number; memories: string[] }>;
}

const READS: JudgeRead[] = ['none', 'insult', 'mockery', 'threat', 'praise', 'flirt', 'secret_probe', 'support', 'challenge'];
const TONES: JudgeTone[] = ['neutral', 'heated', 'calm', 'joking'];

/** Check the answer's shape before anything uses it. Pure, for tests. */
export function readJudged(data: unknown): JudgedLine | null {
  const judged = (data as { judged?: unknown } | null)?.judged;
  if (!judged || typeof judged !== 'object') return null;
  const j = judged as { tone?: unknown; sidesWith?: unknown; items?: unknown };
  const items: JudgedItem[] = [];
  for (const raw of Array.isArray(j.items) ? j.items : []) {
    const it = raw as { key?: unknown; read?: unknown; strength?: unknown; memory?: unknown };
    const read = READS.find(r => r === it?.read);
    if (typeof it?.key !== 'string' || !read) continue;
    const s = Number(it.strength);
    items.push({ key: it.key, read, strength: s >= 3 ? 3 : s === 2 ? 2 : 1, memory: Number.isInteger(it.memory) && Number(it.memory) > 0 ? Number(it.memory) : 0 });
  }
  return { tone: TONES.find(t => t === j.tone) ?? 'neutral', sidesWith: typeof j.sidesWith === 'string' ? j.sidesWith : '', items };
}

export async function askJudge(ask: JudgeAsk): Promise<JudgedLine | null> {
  try {
    const { data, error } = await supabase.functions.invoke('solo-npc', { body: { action: 'judge', ...ask } });
    if (error) return null;
    return readJudged(data);
  } catch {
    return null;
  }
}
