// Live NPCs v2 (DECISIONS D-22): one NPC's "mind", host only. What the NPC remembers
// from earlier scenes, how it feels about each seated character, and whether it reacts
// to spells. The AI updates memory and feelings after each Send to DM; the host can
// change or delete anything here.

import { useCallback, useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NpcPortrait } from './NpcPortrait';
import { NPC_ATTITUDES, attitudeLevel } from '@/lib/live-npcs';
import type { NpcMemoryNote, PartyNpc, PartyNpcsApi } from '@/hooks/use-party-npcs';

interface NpcMindPanelProps {
  npc: PartyNpc;
  roster: PartyNpcsApi;
  onBack: () => void;
}

const fieldClass = 'w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-[14px] text-white/90 placeholder:text-white/30 outline-none focus:border-amber-400/60';

export function NpcMindPanel({ npc, roster, onBack }: NpcMindPanelProps) {
  const [seats, setSeats] = useState<Array<{ user_id: string; character_name: string }> | null>(null);
  const [notes, setNotes] = useState<NpcMemoryNote[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [s, n] = await Promise.all([roster.loadSeats(), roster.loadMemories(npc.id)]);
      setSeats(s);
      setNotes(n);
    } catch (err) {
      setFailed(true);
      toast.error(err instanceof Error ? err.message : 'Could not load this NPC.');
    }
  }, [roster, npc.id]);

  useEffect(() => { void load(); void roster.reloadAttitudes(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await action();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(null);
    }
  };

  const aiNotes = (notes || []).filter(n => n.source === 'ai').length;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back to the roster"
          style={{ touchAction: 'manipulation' }}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-md text-white/60 active:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-11 h-11 text-lg" />
        <div className="min-w-0">
          <h3 className="font-cinzel text-[15px] text-amber-200 truncate">{npc.name}'s mind</h3>
          <p className="text-[11px] text-white/45">Only you can see this. The AI updates it after each Send to DM.</p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <span className="min-w-0">
          <span className="block text-[14px] text-white/90">Reacts to spells</span>
          <span className="block text-[11px] text-white/45">When on stage, {npc.name} answers every spell cast at the table (up to 3 NPCs per spell).</span>
        </span>
        <Switch
          checked={npc.reacts_to_spells !== false}
          disabled={busy === 'spells'}
          onCheckedChange={(on) => { void act('spells', () => roster.setReactsToSpells(npc.id, on)); }}
          aria-label={`${npc.name} reacts to spells`}
        />
      </label>

      {failed ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
          <p className="text-[13px] text-red-200">This NPC's memory could not be loaded.</p>
          <button
            onClick={() => { void load(); }}
            style={{ touchAction: 'manipulation' }}
            className="min-h-[40px] px-3 rounded-lg border border-white/15 text-[13px] text-white/80"
          >
            Try again
          </button>
        </div>
      ) : seats === null || notes === null ? (
        <div className="flex items-center gap-2 py-6 justify-center text-[13px] text-white/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h4 className="font-cinzel text-[13px] text-amber-200/90">How {npc.name} feels about the party</h4>
            {seats.length === 0 ? (
              <p className="text-[12px] text-white/45">Nobody is seated yet.</p>
            ) : (
              <ul className="space-y-2">
                {seats.map(seat => {
                  const row = roster.attitudes.find(a => a.npc_id === npc.id && a.user_id === seat.user_id);
                  const current = attitudeLevel(row?.score ?? 0);
                  const key = `att:${seat.user_id}`;
                  return (
                    <li key={seat.user_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] text-white/90 truncate">{seat.character_name}</span>
                        <span className="shrink-0 text-[12px] text-amber-100/90">{current.emoji} {current.label}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={`${npc.name}'s attitude toward ${seat.character_name}`}>
                        {NPC_ATTITUDES.map(level => (
                          <button
                            key={level.score}
                            role="radio"
                            aria-checked={current.score === level.score}
                            aria-label={level.label}
                            disabled={busy === key}
                            onClick={() => {
                              if (current.score === level.score && row) return;
                              void act(key, () => roster.setAttitude(npc.id, seat.user_id, seat.character_name, level.score));
                            }}
                            style={{ touchAction: 'manipulation' }}
                            className={cn(
                              'min-h-[40px] rounded-md border text-[16px] transition-colors disabled:opacity-50',
                              current.score === level.score ? 'border-amber-300/80 bg-amber-500/25' : 'border-white/10 bg-black/30 opacity-70',
                            )}
                          >
                            {level.emoji}
                          </button>
                        ))}
                      </div>
                      {row?.reason && (
                        <p className="text-[11px] text-white/45">
                          {row.updated_by === 'host' ? 'You set this.' : `Why: ${row.reason}`}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[11px] text-white/35">Players see only their own feeling, as a badge on the Talk to chip. The AI moves it at most one step per Send to DM.</p>
          </section>

          <section className="space-y-2">
            <h4 className="font-cinzel text-[13px] text-amber-200/90">What {npc.name} remembers ({notes.length})</h4>
            {notes.length === 0 ? (
              <p className="text-[12px] text-white/45">Nothing yet. After a scene with {npc.name} goes to the DM, the important parts show up here.</p>
            ) : (
              <ul className="space-y-1.5">
                {notes.map(n => (
                  <li key={n.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    {editing?.id === n.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editing.text}
                          maxLength={300}
                          onChange={(e) => setEditing({ id: n.id, text: e.target.value })}
                          rows={3}
                          autoFocus
                          className={cn(fieldClass, 'resize-y leading-snug')}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditing(null)}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[40px] px-3 rounded-lg text-[13px] text-white/60"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={!editing.text.trim() || busy === n.id}
                            onClick={() => {
                              const text = editing.text;
                              void act(n.id, async () => {
                                await roster.updateMemory(n.id, text);
                                setNotes(prev => (prev || []).map(x => (x.id === n.id ? { ...x, note: text.replace(/\s+/g, ' ').trim(), source: 'host' } : x)));
                                setEditing(null);
                              });
                            }}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[40px] px-3 rounded-lg border border-amber-400/50 bg-amber-500/20 text-[13px] text-amber-100 disabled:opacity-40"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="flex-1 min-w-0 text-[13px] leading-snug text-white/85">
                          <span className={cn('mr-1.5 rounded px-1 py-px text-[9px] uppercase tracking-wider', n.source === 'host' ? 'bg-sky-500/20 text-sky-200' : 'bg-amber-500/15 text-amber-200/80')}>
                            {n.source === 'host' ? 'You' : 'AI'}
                          </span>
                          {n.note}
                        </p>
                        <button
                          onClick={() => setEditing({ id: n.id, text: n.note })}
                          aria-label="Edit this memory"
                          style={{ touchAction: 'manipulation' }}
                          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-white/50 active:bg-white/10"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            void act(n.id, async () => {
                              await roster.deleteMemory(n.id);
                              setNotes(prev => (prev || []).filter(x => x.id !== n.id));
                            }, 'Forgotten');
                          }}
                          disabled={busy === n.id}
                          aria-label="Forget this"
                          style={{ touchAction: 'manipulation' }}
                          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-white/50 active:bg-white/10 disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                value={newNote}
                maxLength={300}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={`Something ${npc.name} should remember`}
                className={cn(fieldClass, 'min-h-[44px]')}
              />
              <button
                disabled={!newNote.trim() || busy === 'add'}
                onClick={() => {
                  const text = newNote;
                  void act('add', async () => {
                    const row = await roster.addMemory(npc.id, text);
                    setNotes(prev => [...(prev || []), row]);
                    setNewNote('');
                  });
                }}
                aria-label="Add this memory"
                style={{ touchAction: 'manipulation' }}
                className="shrink-0 min-w-[48px] min-h-[44px] rounded-lg border border-amber-400/50 bg-amber-500/20 text-amber-100 flex items-center justify-center disabled:opacity-40"
              >
                {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] text-white/35">
              {aiNotes} AI {aiNotes === 1 ? 'note' : 'notes'}. Past 40, the oldest AI notes drop off. Notes you write or edit never do.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
