// Live NPCs (DECISIONS D-22): one NPC's "mind", host only. Its mood right now, how it feels
// about each seated character (and whether it knows their name), what it remembers (what
// happened, unfinished business, what it said about itself), and whether it reacts to
// spells. The AI updates these after each Send to DM; the host can change or delete anything.

import { useCallback, useEffect, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { NpcPortrait } from './NpcPortrait';
import { NPC_ATTITUDES, NPC_MEMORY_KINDS, NPC_MOODS, attitudeLevel, npcMoodOf, readableFunctionError } from '@/lib/live-npcs';
import type { NpcCombatStats, NpcMemoryNote, NpcSkill, NpcSkillType, NpcSpeed, PartyNpc, PartyNpcsApi } from '@/hooks/use-party-npcs';
import { NPC_SKILL_INFO } from '@/hooks/use-party-npcs';
import { supabase } from '@/integrations/supabase/client';

interface NpcMindPanelProps {
  npc: PartyNpc;
  roster: PartyNpcsApi;
  onBack: () => void;
}

type MemoryKind = 'event' | 'thread' | 'self';

const fieldClass = 'w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-[14px] text-white/90 placeholder:text-white/30 outline-none focus:border-amber-400/60';

/** "today", "yesterday", "4 days ago", or null when they never spoke. */
function lastSeenText(iso: string | null | undefined): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

export function NpcMindPanel({ npc, roster, onBack }: NpcMindPanelProps) {
  const [seats, setSeats] = useState<Array<{ user_id: string; character_name: string }> | null>(null);
  const [notes, setNotes] = useState<NpcMemoryNote[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newKind, setNewKind] = useState<MemoryKind>('event');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Only the hook's stable loaders go in the dependency lists. The roster object itself is
  // rebuilt on every render of the party screen, so depending on it re-ran this load
  // forever (each attitude reload re-rendered the screen), flooding the database.
  const { loadSeats, loadMemories, reloadAttitudes } = roster;

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [s, n] = await Promise.all([loadSeats(), loadMemories(npc.id)]);
      setSeats(s);
      setNotes(n);
    } catch (err) {
      setFailed(true);
      toast.error(err instanceof Error ? err.message : 'Could not load this NPC.');
    }
  }, [loadSeats, loadMemories, npc.id]);

  // Load once when the screen opens (and again only if a different NPC is opened).
  useEffect(() => { void load(); void reloadAttitudes(); }, [load, reloadAttitudes]);

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

  const aiNotes = (notes || []).filter(n => n.source === 'ai' && (n.kind || 'event') === 'event').length;
  const currentMood = npcMoodOf(npc.mood) ?? npcMoodOf('calm');

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

      <section className="space-y-2">
        <h4 className="font-cinzel text-[13px] text-amber-200/90">
          Mood right now: {currentMood ? `${currentMood.emoji} ${currentMood.label}` : 'Calm'}
        </h4>
        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={`${npc.name}'s mood`}>
          {NPC_MOODS.map(m => (
            <button
              key={m.id}
              role="radio"
              aria-checked={currentMood?.id === m.id}
              disabled={busy === 'mood'}
              onClick={() => {
                if (currentMood?.id === m.id) return;
                void act('mood', () => roster.setMood(npc.id, m.id));
              }}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                'min-h-[44px] rounded-md border text-[12px] flex flex-col items-center justify-center gap-0.5 disabled:opacity-50',
                currentMood?.id === m.id ? 'border-amber-300/80 bg-amber-500/25 text-white' : 'border-white/10 bg-black/30 text-white/60',
              )}
            >
              <span className="text-[16px] leading-none">{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/35">Players see the mood as a small emoji on {npc.name}'s lines. It shifts as they talk; set it by hand to steer the next line.</p>
      </section>

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

      {!npc.player_user_id && (
        <NpcCombatSection
          npc={npc}
          busy={busy === 'combat'}
          onSave={(stats) => act('combat', () => roster.setCombatStats(npc.id, stats))}
          onRevived={() => { void roster.reload(); }}
        />
      )}

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
                  const seen = lastSeenText(row?.last_seen_at);
                  return (
                    <li key={seat.user_id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] text-white/90 truncate">{seat.character_name}</span>
                        <span className="shrink-0 text-[12px] text-amber-100/90">{current.emoji} {current.label}</span>
                      </div>
                      <p className="text-[11px] text-white/45">
                        {row?.knows_name ? 'Knows their name' : "Doesn't know their name yet"}
                        {' · '}
                        {seen ? `Last spoke ${seen}` : 'Never met'}
                      </p>
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
            <p className="text-[11px] text-white/35">Players see only their own feeling, as a badge on the Talk to chip. The AI moves it at most one step per Send to DM, and feelings fade over time apart (set how in the NPC's editor).</p>
          </section>

          <section className="space-y-2">
            <h4 className="font-cinzel text-[13px] text-amber-200/90">What {npc.name} remembers ({notes.length})</h4>
            {notes.length === 0 ? (
              <p className="text-[12px] text-white/45">Nothing yet. After a scene with {npc.name} goes to the DM, the important parts show up here.</p>
            ) : (
              <ul className="space-y-1.5">
                {notes.map(n => {
                  const kind = NPC_MEMORY_KINDS.find(k => k.id === (n.kind || 'event')) ?? NPC_MEMORY_KINDS[0];
                  return (
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
                            <span className="mr-1.5 rounded px-1 py-px text-[9px] uppercase tracking-wider bg-white/10 text-white/60">
                              {kind.label}
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
                              }, kind.id === 'thread' ? 'Settled' : 'Forgotten');
                            }}
                            disabled={busy === n.id}
                            aria-label={kind.id === 'thread' ? 'Mark settled' : 'Forget this'}
                            style={{ touchAction: 'manipulation' }}
                            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-white/50 active:bg-white/10 disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex gap-1" role="radiogroup" aria-label="Kind of memory to add">
              {NPC_MEMORY_KINDS.map(k => (
                <button
                  key={k.id}
                  role="radio"
                  aria-checked={newKind === k.id}
                  onClick={() => setNewKind(k.id)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'flex-1 min-h-[36px] rounded-md border text-[12px]',
                    newKind === k.id ? 'border-amber-300/80 bg-amber-500/25 text-white' : 'border-white/10 text-white/55',
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newNote}
                maxLength={300}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={newKind === 'thread' ? `A question or promise still hanging` : newKind === 'self' ? `Something ${npc.name} said about itself` : `Something ${npc.name} should remember`}
                className={cn(fieldClass, 'min-h-[44px]')}
              />
              <button
                disabled={!newNote.trim() || busy === 'add'}
                onClick={() => {
                  const text = newNote;
                  const kind = newKind;
                  void act('add', async () => {
                    const row = await roster.addMemory(npc.id, text, kind);
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
              {aiNotes} AI {aiNotes === 1 ? 'note' : 'notes'} about what happened. Past 40, the oldest AI notes drop off. Notes you write or edit never do. Unfinished business closes by itself when the story settles it.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

const DEFAULT_COMBAT: NpcCombatStats = { maxHp: 30, ac: 13, attackBonus: 4, damage: '1d8+2', speed: 'medium' };
const SPEEDS: Array<{ id: NpcSpeed; label: string; every: string }> = [
  { id: 'trivial', label: 'Trivial', every: '2 min' },
  { id: 'easy', label: 'Easy', every: '90 s' },
  { id: 'medium', label: 'Medium', every: '60 s' },
  { id: 'hard', label: 'Hard', every: '40 s' },
  { id: 'deadly', label: 'Deadly', every: '20 s' },
];
const DAMAGE_RE = /^\s*\d{1,2}\s*d\s*(2|3|4|6|8|10|12|20|100)\s*([+-]\s*\d{1,3})?\s*$/i;

function wholeIn(raw: string, min: number, max: number): number | null {
  if (!/^\s*-?\d+\s*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Host-only combat stat block for one NPC (Live NPC Combat). */
function NpcCombatSection({ npc, busy, onSave, onRevived }: {
  npc: PartyNpc;
  busy: boolean;
  onSave: (stats: NpcCombatStats | null) => Promise<void>;
  onRevived: () => void;
}) {
  const saved = npc.combat_stats ?? null;
  const [on, setOn] = useState(!!saved);
  const [maxHp, setMaxHp] = useState(String((saved ?? DEFAULT_COMBAT).maxHp));
  const [ac, setAc] = useState(String((saved ?? DEFAULT_COMBAT).ac));
  const [attackBonus, setAttackBonus] = useState(String((saved ?? DEFAULT_COMBAT).attackBonus));
  const [damage, setDamage] = useState((saved ?? DEFAULT_COMBAT).damage);
  const [speed, setSpeed] = useState<NpcSpeed>((saved ?? DEFAULT_COMBAT).speed);
  const [problem, setProblem] = useState('');
  const [reviving, setReviving] = useState(false);
  type SkillRow = { key: number; type: NpcSkillType | ''; name: string; custom: boolean; bonus: string; damage: string; power: string };
  const rowFrom = (k: NpcSkill, i: number): SkillRow => ({
    key: i, type: k.type, name: k.name ?? '',
    custom: k.bonus != null || !!k.damage || k.power != null,
    bonus: k.bonus != null ? String(k.bonus) : '', damage: k.damage ?? '', power: k.power != null ? String(k.power) : '',
  });
  const [skills, setSkills] = useState<SkillRow[]>(() => (saved?.skills ?? []).slice(0, 4).map(rowFrom));
  const [skillKey, setSkillKey] = useState(100);
  const patchSkill = (key: number, p: Partial<SkillRow>) => setSkills(prev => prev.map(r => (r.key === key ? { ...r, ...p } : r)));

  const fillFrom = (s: NpcCombatStats) => {
    setMaxHp(String(s.maxHp)); setAc(String(s.ac)); setAttackBonus(String(s.attackBonus)); setDamage(s.damage); setSpeed(s.speed);
  };

  const toggle = (next: boolean) => {
    setOn(next);
    setProblem('');
    if (next) fillFrom(saved ?? DEFAULT_COMBAT);
    else void onSave(null);
  };

  const save = () => {
    const hp = wholeIn(maxHp, 1, 999);
    if (hp === null) return setProblem('Max HP must be a whole number from 1 to 999.');
    const armor = wholeIn(ac, 5, 30);
    if (armor === null) return setProblem('AC must be a whole number from 5 to 30.');
    const bonus = wholeIn(attackBonus, -5, 20);
    if (bonus === null) return setProblem('Attack bonus must be a whole number from -5 to 20.');
    if (!DAMAGE_RE.test(damage)) return setProblem('Damage must look like 2d6+3 (dice: d2, d3, d4, d6, d8, d10, d12, d20 or d100).');
    const cleanedSkills: NpcSkill[] = [];
    for (const r of skills) {
      if (!r.type) continue;
      const name = r.name.trim().slice(0, 40) || NPC_SKILL_INFO[r.type].label;
      const attacky = r.type === 'strike' || r.type === 'heavy' || r.type === 'sweep' || r.type === 'signature';
      const powered = r.type === 'mend' || r.type === 'shield';
      let sb: number | null = null; let sd: string | null = null; let sp: number | null = null;
      if (r.custom && attacky) {
        if (r.bonus.trim()) {
          sb = wholeIn(r.bonus, -5, 20);
          if (sb === null) return setProblem(`${name}: attack bonus must be a whole number from -5 to 20.`);
        }
        if (r.damage.trim()) {
          if (!DAMAGE_RE.test(r.damage)) return setProblem(`${name}: damage must look like 2d6+3.`);
          sd = r.damage.replace(/\s+/g, '');
        }
      }
      if (r.custom && powered && r.power.trim()) {
        sp = wholeIn(r.power, 1, 999);
        if (sp === null) return setProblem(`${name}: power must be a whole number from 1 to 999.`);
      }
      cleanedSkills.push({ type: r.type, name, bonus: sb, damage: sd, power: sp });
    }
    setProblem('');
    void onSave({ maxHp: hp, ac: armor, attackBonus: bonus, damage: damage.replace(/\s+/g, ''), speed, skills: cleanedSkills });
  };

  const revive = async () => {
    setReviving(true);
    try {
      const { error } = await supabase.functions.invoke('npc-combat', { body: { action: 'revive', partyId: npc.party_id, npcId: npc.id } });
      if (error) {
        const { message } = await readableFunctionError(error, `${npc.name} could not be revived.`);
        toast.error(message);
        return;
      }
      onRevived();
    } finally {
      setReviving(false);
    }
  };

  const numField = (label: string, value: string, set: (v: string) => void, min: number, max: number) => (
    <label className="block space-y-1">
      <span className="block text-[12px] text-white/60">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={e => set(e.target.value)}
        className={cn(fieldClass, 'min-h-[44px]')}
      />
    </label>
  );

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
      {(npc.combat_state === 'ko' || npc.combat_state === 'dead') && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2">
          <span className="text-[13px] text-red-200">{npc.combat_state === 'ko' ? 'Knocked out in a fight' : 'Killed in a fight'}</span>
          <button
            onClick={() => { void revive(); }}
            disabled={reviving}
            style={{ touchAction: 'manipulation' }}
            className="min-h-[44px] px-4 rounded-lg border border-amber-400/50 bg-amber-500/20 text-[13px] text-amber-100 disabled:opacity-40 flex items-center gap-1.5"
          >
            {reviving && <Loader2 className="w-4 h-4 animate-spin" />}
            Revive
          </button>
        </div>
      )}

      <label className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-cinzel text-[13px] text-amber-200/90">Combat</span>
          <span className="block text-[14px] text-white/90">Can be fought</span>
        </span>
        <Switch checked={on} disabled={busy} onCheckedChange={toggle} aria-label={`${npc.name} can be fought`} />
      </label>

      {on && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {numField('Max HP', maxHp, setMaxHp, 1, 999)}
            {numField('AC', ac, setAc, 5, 30)}
            {numField('Attack bonus', attackBonus, setAttackBonus, -5, 20)}
          </div>
          <label className="block space-y-1">
            <span className="block text-[12px] text-white/60">Damage</span>
            <input value={damage} onChange={e => setDamage(e.target.value)} placeholder="2d6+3" className={cn(fieldClass, 'min-h-[44px]')} />
          </label>
          <div className="space-y-1">
            <span className="block text-[12px] text-white/60">Speed</span>
            <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={`${npc.name}'s speed`}>
              {SPEEDS.map(s => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={speed === s.id}
                  onClick={() => setSpeed(s.id)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'min-h-[44px] rounded-md border text-[11px] flex flex-col items-center justify-center leading-tight',
                    speed === s.id ? 'border-amber-300/80 bg-amber-500/25 text-white' : 'border-white/10 bg-black/30 text-white/60',
                  )}
                >
                  <span>{s.label}</span>
                  <span className="text-[10px] opacity-70">{s.every}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="block font-cinzel text-[13px] text-amber-200/90">Skills (up to 4)</span>
            {skills.map(r => {
              const used = new Set(skills.filter(o => o.key !== r.key).map(o => o.type));
              const attacky = r.type === 'strike' || r.type === 'heavy' || r.type === 'sweep' || r.type === 'signature';
              const powered = r.type === 'mend' || r.type === 'shield';
              return (
                <div key={r.key} className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={r.type}
                      onChange={e => patchSkill(r.key, { type: e.target.value as NpcSkillType })}
                      className={cn(fieldClass, 'min-h-[44px] flex-1')}
                      aria-label="Skill type"
                    >
                      <option value="" disabled>Pick a type</option>
                      {(Object.keys(NPC_SKILL_INFO) as NpcSkillType[]).map(t => (
                        <option key={t} value={t} disabled={used.has(t)}>{NPC_SKILL_INFO[t].label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setSkills(prev => prev.filter(o => o.key !== r.key))}
                      style={{ touchAction: 'manipulation' }}
                      aria-label="Remove skill"
                      className="min-h-[44px] min-w-[44px] rounded-lg border border-white/10 text-white/60 flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {r.type && <p className="text-[11px] text-white/50">{NPC_SKILL_INFO[r.type].hint}</p>}
                  <input
                    value={r.name}
                    maxLength={40}
                    onChange={e => patchSkill(r.key, { name: e.target.value.slice(0, 40) })}
                    placeholder="Bayonet Lunge"
                    className={cn(fieldClass, 'min-h-[44px]')}
                    aria-label="Skill name"
                  />
                  {(attacky || powered) && (
                    <label className="flex items-center justify-between gap-3 min-h-[44px]">
                      <span className="text-[13px] text-white/70">Custom numbers</span>
                      <Switch checked={r.custom} onCheckedChange={v => patchSkill(r.key, { custom: v })} aria-label="Custom numbers" />
                    </label>
                  )}
                  {r.custom && attacky && (
                    <div className="grid grid-cols-2 gap-2">
                      {numField('Attack bonus', r.bonus, v => patchSkill(r.key, { bonus: v }), -5, 20)}
                      <label className="block space-y-1">
                        <span className="block text-[12px] text-white/60">Damage</span>
                        <input value={r.damage} onChange={e => patchSkill(r.key, { damage: e.target.value })} placeholder="2d8+3" className={cn(fieldClass, 'min-h-[44px]')} />
                      </label>
                    </div>
                  )}
                  {r.custom && powered && numField('Power', r.power, v => patchSkill(r.key, { power: v }), 1, 999)}
                </div>
              );
            })}
            {skills.length < 4 && (
              <button
                onClick={() => { setSkills(prev => [...prev, { key: skillKey, type: '', name: '', custom: false, bonus: '', damage: '', power: '' }]); setSkillKey(k => k + 1); }}
                style={{ touchAction: 'manipulation' }}
                className="w-full min-h-[44px] rounded-lg border border-dashed border-white/20 text-[13px] text-white/70 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add skill
              </button>
            )}
            <p className="text-[11px] text-white/45">No skills = one plain attack. NPCs announce each skill a few seconds before it happens.</p>
          </div>
          {problem && <p className="text-[12px] text-red-300">{problem}</p>}
          <button
            onClick={save}
            disabled={busy}
            style={{ touchAction: 'manipulation' }}
            className="w-full min-h-[44px] rounded-lg border border-amber-400/50 bg-amber-500/20 text-[14px] text-amber-100 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      )}
      <p className="text-[11px] text-white/45">Players can only start a fight by attacking. Once it starts, {npc.name} attacks on its own at this speed.</p>
    </section>
  );
}
