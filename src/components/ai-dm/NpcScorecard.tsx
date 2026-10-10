// Live NPCs (DECISIONS D-22): how each NPC is landing with the table, for the host.
// Counted from what is still in the Live Table, so clearing the chat starts it over.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { computeNpcScorecard, type ScoreLine, type ScoreReaction, type ScoreRecord } from '@/lib/live-npcs';
import type { PartyNpcsApi } from '@/hooks/use-party-npcs';
import { NpcPortrait } from './NpcPortrait';

interface ScoreData {
  lines: ScoreLine[];
  reactions: ScoreReaction[];
  records: ScoreRecord[];
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function NpcScorecard({ roster }: { roster: Pick<PartyNpcsApi, 'partyId' | 'npcs'> }) {
  const { partyId, npcs } = roster;
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    setError(null);
    try {
      const [lines, reactions, records] = await Promise.all([
        (supabase.from('party_round_chat') as any)
          .select('id, npc_id, content, consumed')
          .eq('party_id', partyId)
          .order('created_at', { ascending: false })
          .limit(2000),
        (supabase.from('party_round_chat_reactions') as any)
          .select('message_id, emoji')
          .eq('party_id', partyId)
          .limit(5000),
        (supabase.from('party_npc_replies') as any)
          .select('npc_id, reply_message_id, fell_back, error, latency_ms, cost_usd')
          .eq('party_id', partyId)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);
      const failed = [lines, reactions, records].find(r => r.error);
      if (failed) throw new Error(failed.error?.message || 'Could not load the scorecard.');
      setData({ lines: lines.data || [], reactions: reactions.data || [], records: records.data || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the scorecard.');
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { void load(); }, [load]);

  const scores = useMemo(() => {
    if (!data) return [];
    const all = computeNpcScorecard({ npcs: npcs.map(n => ({ id: n.id, name: n.name })), ...data });
    // Archived NPCs only when they still have lines at the table.
    return all.filter(s => !npcs.find(n => n.id === s.npcId)?.archived || s.lines > 0 || s.asked > 0);
  }, [data, npcs]);

  // The crowd favourite: most reactions per line, with at least 3 lines so one lucky line can't win.
  const favouriteId = useMemo(() => {
    const ranked = scores.filter(s => s.lines >= 3 && s.reactions > 0).sort((a, b) => b.reactionsPerLine - a.reactionsPerLine);
    return ranked[0]?.npcId ?? null;
  }, [scores]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-white/55">How each NPC is landing with the table.</p>
        <button
          onClick={() => { void load(); }}
          disabled={loading}
          aria-label="Refresh the scorecard"
          style={{ touchAction: 'manipulation' }}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-md border border-white/10 text-white/60 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[13px] text-red-200">{error}</p>}

      {!data && loading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-[13px] text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Counting…
        </div>
      ) : data && scores.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-white/45">No NPCs yet.</p>
      ) : (
        <ul className="space-y-2">
          {scores.map(s => {
            const npc = npcs.find(n => n.id === s.npcId);
            const favourite = s.npcId === favouriteId;
            return (
              <li
                key={s.npcId}
                className={cn(
                  'rounded-xl border p-3 space-y-1.5',
                  favourite ? 'border-amber-300/60 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]',
                )}
              >
                <div className="flex items-center gap-3">
                  <NpcPortrait url={npc?.portrait_url} name={s.name} className="w-10 h-10 text-base" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-white truncate flex items-center gap-1.5">
                      {s.name}
                      {favourite && <Trophy className="w-4 h-4 text-amber-300 shrink-0" aria-label="Crowd favourite" />}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {s.lines} line{s.lines === 1 ? '' : 's'} at the table{s.lines > s.aiLines ? ` (${s.lines - s.aiLines} typed by you)` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[18px] font-cinzel text-amber-200 leading-none">{s.reactionsPerLine.toFixed(1)}</p>
                    <p className="text-[10px] text-white/45">reactions / line</p>
                  </div>
                </div>
                {s.topEmojis.length > 0 && (
                  <p className="text-[13px] text-white/80">
                    {s.topEmojis.map(e => `${e.emoji} ${e.count}`).join('   ')}
                  </p>
                )}
                <p className="text-[12px] text-white/60">
                  Asked {s.asked} · answered back {s.answeredBack} · sent to the DM {s.sentPercent}%
                </p>
                {(s.fellBack > 0 || s.failed > 0 || s.avgLatencyMs !== null || s.costUsd > 0) && (
                  <p className="text-[11px] text-white/40">
                    {[
                      s.avgLatencyMs !== null ? `answers in ${seconds(s.avgLatencyMs)}` : '',
                      s.fellBack > 0 ? `${s.fellBack} on the backup model` : '',
                      s.failed > 0 ? `${s.failed} got no answer` : '',
                      s.costUsd > 0 ? `$${s.costUsd.toFixed(4)} on Venice` : '',
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="pb-4 text-[11px] leading-relaxed text-white/35">
        Counted from the lines still in the Live Table, so clearing the chat starts the count over. "Answered back" counts players replying to an NPC's line. "Backup model" means the NPC's own model failed or ran out of credit and Gemini 2.5 Flash answered.
      </p>
    </div>
  );
}
