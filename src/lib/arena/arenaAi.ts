// Arena 2.0: real AI voice for the practice opponent. Uses the same storyteller
// service as the game, with a sparring-only instruction, so nothing is written
// to any story, party or character. Returns null on any failure (caller falls back).
import { supabase } from '@/integrations/supabase/client';

const URL_ = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;

export interface SparTurn { who: 'you' | 'foe' | 'table'; text: string }

export function buildSparPrompt(o: { foeName: string; foePersona?: string; playerName: string; foeHp: number; foeMax: number; myHp: number; myMax: number }): string {
  return [
    `You are ${o.foeName}, a practice sparring opponent in a training arena. ${o.foePersona ? `Persona: ${o.foePersona.slice(0, 400)}` : ''}`.trim(),
    `You are fighting ${o.playerName}. This is training, not a story. There is no Dungeon Master.`,
    `Your health: ${o.foeHp}/${o.foeMax}. ${o.playerName}'s health: ${o.myHp}/${o.myMax}.`,
    'Reply ONLY with one short line of spoken dialogue in character (max 30 words). React to what just happened: taunt misses, respect good hits, coach briefly.',
    'Never narrate, never decide hits, damage, rolls or outcomes, never use quotation marks or your name prefix.',
  ].join('\n');
}

export async function sparLine(system: string, history: SparTurn[], signal?: AbortSignal): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const messages = history.slice(-12).map((t) => ({
      role: t.who === 'foe' ? 'assistant' : 'user',
      content: t.who === 'table' ? `[Fight log] ${t.text}` : t.text,
    }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') messages.push({ role: 'user', content: '[Your turn to speak]' });
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, systemPromptOverride: system, maxTokens: 400, noThinking: true }),
      signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', out = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data: ')) continue;
        const j = line.slice(6);
        if (j === '[DONE]') continue;
        try { out += JSON.parse(j).choices?.[0]?.delta?.content ?? ''; } catch { /* partial */ }
      }
    }
    const clean = out.replace(/^["“]|["”]$/g, '').replace(/<[^>]+>/g, '').trim().slice(0, 240);
    return clean || null;
  } catch {
    return null;
  }
}
