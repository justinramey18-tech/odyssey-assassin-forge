// Live NPCs (DECISIONS D-22): the host's NPC Roster. Add NPCs, write their guides and
// secrets, pick their voice model, and put them on stage so players can talk to them in
// the Live Table. Guides and secrets are read only by the host here and by the server.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { buildNpcImagePrompt } from '@/hooks/use-party-npcs';
import { Archive, ArchiveRestore, Brain, Drama, ImagePlus, Loader2, Pencil, Plus, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AvatarCropDialog } from './AvatarCropDialog';
import { NpcScorecard } from './NpcScorecard';
import { NpcQuickBuild } from './NpcQuickBuild';
import { NpcMindPanel } from './NpcMindPanel';
import { NpcPortrait } from './NpcPortrait';
import type { PartyNpc, PartyNpcsApi } from '@/hooks/use-party-npcs';
import {
  NPC_DEFAULT_MODEL,
  NPC_FIELD_MAX,
  NPC_GRUDGE_STYLES,
  NPC_GUIDE_MAX,
  NPC_MOOD_RANGE_MAX,
  NPC_NAME_MAX,
  NPC_SECRETS_MAX,
  cleanNpcName,
  npcModelChoices,
  npcModelLabel,
  npcNameProblem,
  DEFAULT_NPC_SOCIAL_STATS,
  sanitizeNpcSocialStats,
  type NpcSocialStats,
} from '@/lib/live-npcs';
import { DM_MODELS } from '@/lib/dm-models';

interface NpcRosterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: PartyNpcsApi;
  battleModel?: string | null;
  onBattleModelChange?: (id: string | null) => void;
}

interface Draft {
  /** null while adding a new NPC. */
  id: string | null;
  name: string;
  model: string;
  portraitUrl: string | null;
  guide: string;
  secrets: string;
  /** v3 fields */
  wants: string;
  levers: string;
  hardLines: string;
  moodRange: string;
  grudgeStyle: string;
  socialStats: NpcSocialStats;
}

const SOCIAL_FIELDS: { key: keyof NpcSocialStats; label: string }[] = [
  { key: 'wisdom', label: 'Wisdom' },
  { key: 'charisma', label: 'Charisma' },
  { key: 'insight', label: 'Insight' },
  { key: 'deception', label: 'Deception' },
  { key: 'perception', label: 'Perception' },
  { key: 'wisdomSave', label: 'Wisdom Save' },
];
const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** One whole-number modifier box, clamped -10..+20 as it changes and when you leave it. */
function SocialModInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(signed(value));
  useEffect(() => { setText(prev => (Number(prev) === value ? prev : signed(value))); }, [value]);
  const commit = (raw: string) => {
    const n = sanitizeNpcSocialStats({ wisdom: parseInt(raw, 10) }).wisdom;
    onChange(n);
    return n;
  };
  return (
    <label className="block space-y-1">
      <span className="text-[12px] text-white/60">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9+-]/g, '').slice(0, 4);
          setText(raw);
          if (/^[+-]?\d+$/.test(raw)) commit(raw);
        }}
        onBlur={() => setText(signed(commit(text)))}
        className="w-full min-h-[44px] rounded-lg border border-white/15 bg-black/30 px-3 text-center text-base font-semibold text-white focus:outline-none focus:border-amber-400/60"
        style={{ touchAction: 'manipulation' }}
      />
    </label>
  );
}

/** v3: the guide fields shown in the editor. */
const BEHAVIOR_FIELDS: Array<{ key: 'wants' | 'levers' | 'hardLines' | 'moodRange'; label: string; placeholder: string; max: number }> = [
  { key: 'wants', label: 'Wants right now', placeholder: 'Keep his job. Get his men healed. Go home on time for once.', max: NPC_FIELD_MAX },
  { key: 'levers', label: 'What works on them (not secret: they give ground to it)', placeholder: 'Bribes. A genuinely good joke. Respect for his rank.', max: NPC_FIELD_MAX },
  { key: 'hardLines', label: 'Hard lines (never, whatever happens)', placeholder: 'Never betrays his crew. Never lowers the quarantine without orders.', max: NPC_FIELD_MAX },
  { key: 'moodRange', label: 'Mood range', placeholder: 'Swings between weary Gandalf and gleeful Deadpool. Rarely scared.', max: NPC_MOOD_RANGE_MAX },
];

/** The guide of an NPC being edited: still loading, loaded, or failed (then it is never overwritten). */
type GuideState = 'loading' | 'ready' | 'failed';

const fieldClass = 'w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-[14px] text-white/90 placeholder:text-white/30 outline-none focus:border-amber-400/60';

export function NpcRosterPanel({ open, onOpenChange, roster, battleModel, onBattleModelChange }: NpcRosterPanelProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [guideState, setGuideState] = useState<GuideState>('ready');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<'roster' | 'scores' | 'build'>('roster');
  /** v2: the NPC whose memory and feelings are open. */
  const [mindId, setMindId] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [painting, setPainting] = useState(false);
  const promptEditedRef = useRef(false);
  const editSessionRef = useRef(0);
  const paintingSessionRef = useRef<number | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const closeEdit = () => {
    editSessionRef.current += 1;
    paintingSessionRef.current = null;
    setPainting(false);
    setDraft(null);
  };

  useEffect(() => () => { editSessionRef.current += 1; }, []);

  const choices = useMemo(() => npcModelChoices(), []);
  const groups = useMemo(() => {
    const map = new Map<string, typeof choices>();
    for (const c of choices) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [choices]);

  // Closing the roster drops an unsaved edit.
  useEffect(() => { if (!open) { closeEdit(); setCropFile(null); setMindId(null); } }, [open]);

  const active = roster.active;
  const archived = roster.npcs.filter(n => n.archived);
  const onStageNames = roster.onStage.map(n => n.name);
  const nameProblem = draft ? npcNameProblem(draft.name, roster.npcs, draft.id) : null;
  const modelInfo = draft ? choices.find(c => c.id === draft.model) : undefined;
  const mindNpc = mindId ? roster.npcs.find(n => n.id === mindId) ?? null : null;

  const loadGuideInto = async (npcId: string) => {
    const session = editSessionRef.current;
    setGuideState('loading');
    try {
      const g = await roster.loadGuide(npcId);
      if (openRef.current && editSessionRef.current === session && !promptEditedRef.current) {
        const npc = roster.npcs.find(n => n.id === npcId);
        setImagePrompt(buildNpcImagePrompt({ name: npc?.name ?? '', guide: g.guide, moodRange: g.moodRange, attack: '' }));
      }
      setDraft(prev => (prev && prev.id === npcId ? {
        ...prev,
        guide: g.guide,
        secrets: g.secrets,
        wants: g.wants,
        levers: g.levers,
        hardLines: g.hardLines,
        moodRange: g.moodRange,
        grudgeStyle: g.grudgeStyle,
      } : prev));
      setGuideState('ready');
    } catch (err) {
      setGuideState('failed');
      toast.error(err instanceof Error ? err.message : 'Could not load the guide.');
    }
  };

  const startNew = () => {
    closeEdit();
    setGuideState('ready');
    setDraft({ id: null, name: '', model: NPC_DEFAULT_MODEL, portraitUrl: null, guide: '', secrets: '', wants: '', levers: '', hardLines: '', moodRange: '', grudgeStyle: 'normal', socialStats: { ...DEFAULT_NPC_SOCIAL_STATS } });
  };

  const startEdit = (npc: PartyNpc) => {
    closeEdit();
    promptEditedRef.current = false;
    setImagePrompt(buildNpcImagePrompt({ name: npc.name, guide: '', moodRange: '', attack: '' }));
    setDraft({ id: npc.id, name: npc.name, model: npc.model, portraitUrl: npc.portrait_url, guide: '', secrets: '', wants: '', levers: '', hardLines: '', moodRange: '', grudgeStyle: 'normal', socialStats: sanitizeNpcSocialStats(npc.social_stats) });
    void loadGuideInto(npc.id);
  };

  const save = async () => {
    if (!draft || nameProblem || saving || uploading || paintingSessionRef.current !== null) return;
    setSaving(true);
    try {
      if (!draft.id) {
        const npc = await roster.addNpc({
          name: draft.name,
          model: draft.model,
          portraitUrl: draft.portraitUrl,
          guide: draft.guide,
          secrets: draft.secrets,
        });
        const fields = { wants: draft.wants, levers: draft.levers, hardLines: draft.hardLines, moodRange: draft.moodRange, grudgeStyle: draft.grudgeStyle };
        if (fields.wants.trim() || fields.levers.trim() || fields.hardLines.trim() || fields.moodRange.trim() || fields.grudgeStyle !== 'normal') {
          await roster.saveGuide(npc.id, draft.guide, draft.secrets, fields);
        }
        await roster.setSocialStats(npc.id, draft.socialStats);
        toast.success(`${npc.name} joined the roster. Turn on "On stage" when they enter the scene.`);
      } else {
        await roster.updateNpc(draft.id, { name: draft.name, model: draft.model, portrait_url: draft.portraitUrl });
        // Social stats are roster data, so they save even when the guide did not load.
        await roster.setSocialStats(draft.id, draft.socialStats);
        // A guide that failed to load is never saved, so it can't be wiped by accident.
        if (guideState === 'ready') {
          await roster.saveGuide(draft.id, draft.guide, draft.secrets, {
            wants: draft.wants, levers: draft.levers, hardLines: draft.hardLines, moodRange: draft.moodRange, grudgeStyle: draft.grudgeStyle,
          });
        }
        toast.success(guideState === 'ready' ? `${cleanNpcName(draft.name)} saved` : `${cleanNpcName(draft.name)} saved (the guide was not loaded, so it was left as it was)`);
      }
      closeEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const run = async (npc: PartyNpc, action: () => Promise<unknown>, done?: string) => {
    setBusyId(npc.id);
    try {
      await action();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusyId(null);
    }
  };

  const uploadCropped = async (file: File) => {
    setUploading(true);
    try {
      const url = await roster.uploadPortrait(file);
      setDraft(prev => (prev ? { ...prev, portraitUrl: url } : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const generatePortrait = async () => {
    if (!draft?.id || !roster.partyId || paintingSessionRef.current !== null || saving || uploading || !imagePrompt.trim()) return;
    const npcId = draft.id;
    const name = draft.name;
    const session = editSessionRef.current;
    paintingSessionRef.current = session;
    setPainting(true);
    const isCurrent = () => openRef.current && editSessionRef.current === session;
    try {
      const { data, error } = await supabase.functions.invoke('venice-image-generate', {
        body: { mode: 'npc-portrait', partyId: roster.partyId, npcId, prompt: imagePrompt.trim().slice(0, 1500) },
      });
      if (!isCurrent()) return;
      const url = (data as { imageUrl?: string } | null)?.imageUrl;
      if (error || typeof url !== 'string' || !url.trim()) {
        throw new Error((data as { error?: string } | null)?.error || 'Portrait generation failed. Try again.');
      }
      setDraft(prev => (isCurrent() && prev?.id === npcId ? { ...prev, portraitUrl: url } : prev));
      toast.success(`Portrait ready for ${name || 'this NPC'}`);
    } catch (err) {
      if (isCurrent()) toast.error(err instanceof Error ? err.message : 'Portrait generation failed. Try again.');
    } finally {
      if (isCurrent()) {
        paintingSessionRef.current = null;
        setPainting(false);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-vaul-no-drag
        className="h-[92vh] p-0 bg-[#0b0b10] border-t border-amber-500/30 rounded-t-2xl overflow-hidden flex flex-col"
      >
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-white/10">
          <SheetTitle className="font-cinzel text-amber-300 text-[15px] flex items-center gap-2 pr-8">
            <Drama className="w-5 h-5" /> NPC Roster
          </SheetTitle>
          <SheetDescription className="text-[12px] text-white/50 mt-0.5">
            Put an NPC on stage and players can talk to them in the Live Table.
          </SheetDescription>
          <p className="mt-1.5 text-[12px] text-white/70">
            {onStageNames.length ? <>On stage now: <span className="text-amber-200">{onStageNames.join(', ')}</span></> : 'Nobody is on stage.'}
          </p>
          {!draft && !mindNpc && (
            <div role="tablist" aria-label="NPC Roster view" className="mt-2 grid grid-cols-3 rounded-lg border border-white/10 bg-white/5 p-0.5">
              {(['roster', 'scores', 'build'] as const).map(v => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'min-h-[38px] rounded-md text-[13px] transition-colors',
                    view === v ? 'bg-amber-800/45 text-amber-100 border border-amber-400/40' : 'text-white/55 border border-transparent',
                  )}
                >
                  {v === 'roster' ? 'Roster' : v === 'scores' ? 'Scorecard' : 'Quick Build'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {mindNpc && !draft ? (
            <NpcMindPanel npc={mindNpc} roster={roster} onBack={() => setMindId(null)} />
          ) : draft ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-cinzel text-[14px] text-amber-200">{draft.id ? `Edit ${draft.name || 'NPC'}` : 'New NPC'}</h3>
                <button
                  onClick={closeEdit}
                  aria-label="Close without saving"
                  style={{ touchAction: 'manipulation' }}
                  className="w-10 h-10 flex items-center justify-center rounded-md text-white/50 active:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-[12px] text-white/60">Name</span>
                <input
                  value={draft.name}
                  maxLength={NPC_NAME_MAX}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Grukk the smith"
                  className={fieldClass}
                />
                {draft.name.trim() && nameProblem && <span className="block text-[12px] text-red-300">{nameProblem}</span>}
              </label>

              <div className="space-y-1">
                <span className="text-[12px] text-white/60">Portrait</span>
                <div className="flex items-center gap-3">
                  <NpcPortrait url={draft.portraitUrl} name={draft.name || '?'} className="w-14 h-14 text-xl" />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || painting}
                    style={{ touchAction: 'manipulation' }}
                    className="min-h-[44px] px-3 rounded-lg border border-white/15 bg-white/5 text-[13px] text-white/80 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {draft.portraitUrl ? 'Change' : 'Add picture'}
                  </button>
                  {draft.portraitUrl && !uploading && (
                    <button
                      onClick={() => setDraft({ ...draft, portraitUrl: null })}
                      disabled={painting}
                      style={{ touchAction: 'manipulation' }}
                      className="min-h-[44px] px-3 rounded-lg text-[13px] text-white/50"
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) setCropFile(f);
                    }}
                  />
                </div>
                {draft.id && (
                  <div className="space-y-2 pt-2">
                    <label className="block space-y-1">
                      <span className="text-xs text-muted-foreground">Portrait description</span>
                      <Textarea
                        aria-label="Portrait description"
                        value={imagePrompt}
                        maxLength={1500}
                        rows={4}
                        disabled={painting || saving}
                        onChange={e => {
                          promptEditedRef.current = true;
                          setImagePrompt(e.target.value.slice(0, 1500));
                        }}
                        className="min-h-[48px] w-full resize-y"
                      />
                      <span className="block text-right text-xs text-muted-foreground">{imagePrompt.length} / 1,500</span>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { void generatePortrait(); }}
                      disabled={!roster.partyId || painting || saving || uploading || !!cropFile || !imagePrompt.trim()}
                      style={{ touchAction: 'manipulation' }}
                      className="min-h-[48px] w-full gap-2"
                    >
                      {painting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {painting ? 'Painting portrait…' : 'Generate Image'}
                    </Button>
                  </div>
                )}
              </div>

              <label className="block space-y-1">
                <span className="text-[12px] text-white/60">Voice model</span>
                <select
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  className={cn(fieldClass, 'min-h-[44px]')}
                >
                  {!choices.some(c => c.id === draft.model) && <option value={draft.model}>{npcModelLabel(draft.model)}</option>}
                  {groups.map(([group, list]) => (
                    <optgroup key={group} label={group}>
                      {list.map(c => (
                        <option key={c.id} value={c.id}>{c.id === NPC_DEFAULT_MODEL ? `${c.label} (default)` : c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="block text-[11px] text-white/40">
                  {modelInfo ? `${modelInfo.description}.` : 'A model that is no longer offered.'} If it fails or runs out of credit, Gemini 2.5 Flash answers instead.
                </span>
              </label>

              {guideState === 'loading' ? (
                <div className="flex items-center gap-2 py-6 justify-center text-[13px] text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading the guide…
                </div>
              ) : guideState === 'failed' ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
                  <p className="text-[13px] text-red-200">The guide could not be loaded, so it is hidden and will not be changed when you save.</p>
                  <button
                    onClick={() => draft.id && void loadGuideInto(draft.id)}
                    style={{ touchAction: 'manipulation' }}
                    className="min-h-[40px] px-3 rounded-lg border border-white/15 text-[13px] text-white/80"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <label className="block space-y-1">
                    <span className="flex justify-between text-[12px] text-white/60">
                      <span>Guide (only you and the server read it)</span>
                      <span className={cn(draft.guide.length > NPC_GUIDE_MAX * 0.9 && 'text-amber-300')}>{draft.guide.length.toLocaleString()} / {NPC_GUIDE_MAX.toLocaleString()}</span>
                    </span>
                    <textarea
                      value={draft.guide}
                      maxLength={NPC_GUIDE_MAX}
                      onChange={(e) => setDraft({ ...draft, guide: e.target.value })}
                      rows={8}
                      placeholder="Who they are, how they talk, what they want, who they know and how they feel about the party."
                      className={cn(fieldClass, 'resize-y leading-snug')}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between text-[12px] text-white/60">
                      <span>Secrets (guarded; given up only when earned)</span>
                      <span className={cn(draft.secrets.length > NPC_SECRETS_MAX * 0.9 && 'text-amber-300')}>{draft.secrets.length.toLocaleString()} / {NPC_SECRETS_MAX.toLocaleString()}</span>
                    </span>
                    <textarea
                      value={draft.secrets}
                      maxLength={NPC_SECRETS_MAX}
                      onChange={(e) => setDraft({ ...draft, secrets: e.target.value })}
                      rows={4}
                      placeholder="What they know and hide. Clever players can still pry it loose."
                      className={cn(fieldClass, 'resize-y leading-snug')}
                    />
                  </label>

                  {/* v3: how they behave. Only you and the server read these. */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                    <p className="text-[12px] text-white/60">How they behave (only you and the server read this)</p>
                    {BEHAVIOR_FIELDS.map(fd => (
                      <label key={fd.key} className="block space-y-1">
                        <span className="flex justify-between text-[12px] text-white/60">
                          <span>{fd.label}</span>
                          {draft[fd.key].length > fd.max * 0.8 && <span className="text-amber-300">{draft[fd.key].length} / {fd.max}</span>}
                        </span>
                        <textarea
                          value={draft[fd.key]}
                          maxLength={fd.max}
                          onChange={(e) => setDraft({ ...draft, [fd.key]: e.target.value })}
                          rows={2}
                          placeholder={fd.placeholder}
                          className={cn(fieldClass, 'resize-y leading-snug')}
                        />
                      </label>
                    ))}
                    <label className="block space-y-1">
                      <span className="text-[12px] text-white/60">Feelings over time</span>
                      <select
                        value={draft.grudgeStyle}
                        onChange={(e) => setDraft({ ...draft, grudgeStyle: e.target.value })}
                        className={cn(fieldClass, 'min-h-[44px]')}
                      >
                        {NPC_GRUDGE_STYLES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                      <span className="block text-[11px] text-white/40">{NPC_GRUDGE_STYLES.find(g => g.id === draft.grudgeStyle)?.hint}</span>
                    </label>
                  </div>
                </>
              )}

              {/* Social rolls: what this NPC rolls against players' social checks. */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                <p className="text-[12px] text-white/60">Social rolls</p>
                <div className="grid grid-cols-2 gap-2">
                  {SOCIAL_FIELDS.map(fd => (
                    <SocialModInput
                      key={fd.key}
                      label={fd.label}
                      value={draft.socialStats[fd.key]}
                      onChange={(n) => setDraft(prev => (prev ? { ...prev, socialStats: { ...prev.socialStats, [fd.key]: n } } : prev))}
                    />
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-white/40">
                  Persuasion and Deception oppose Insight. Insight opposes Deception. Intimidation opposes Wisdom Save.
                  Perception, Wisdom and Charisma are stored for future NPC checks.
                </p>
              </div>

              <div className="flex gap-2 pt-1 pb-4">
                <button
                  onClick={closeEdit}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[48px] rounded-lg bg-white/5 text-[14px] text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void save(); }}
                  disabled={!!nameProblem || saving || uploading || painting || guideState === 'loading'}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[48px] rounded-lg border border-amber-400/50 bg-amber-500/20 text-[14px] text-amber-100 font-cinzel flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {draft.id ? 'Save' : 'Add to roster'}
                </button>
              </div>
            </div>
          ) : view === 'build' ? (
            <NpcQuickBuild roster={roster} onCreated={() => setView('roster')} />
          ) : view === 'scores' ? (
            <NpcScorecard roster={roster} />
          ) : (
            <>
              {onBattleModelChange && (
                <label className="block space-y-1 rounded-lg border border-white/10 bg-white/5 p-3">
                  <span className="text-[12px] text-amber-200 font-cinzel">Battle narrator</span>
                  <select
                    value={battleModel ?? ''}
                    onChange={(e) => onBattleModelChange(e.target.value || null)}
                    style={{ touchAction: 'manipulation' }}
                    className={cn(fieldClass, 'min-h-[44px]')}
                  >
                    <option value="">Same as the DM</option>
                    {DM_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.description ? `${m.label} — ${m.description}` : m.label}</option>
                    ))}
                  </select>
                  <span className="block text-[11px] text-white/50">Writes the battle scene when you send a fight to the DM. Pick your best prose model (for example Claude Opus 5.5); everyday turns stay on the DM model.</span>
                </label>
              )}
              <button
                onClick={startNew}
                style={{ touchAction: 'manipulation' }}
                className="w-full min-h-[48px] rounded-lg border border-dashed border-amber-400/40 bg-amber-500/5 text-[14px] text-amber-200 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> New NPC
              </button>

              <StandInPicker roster={roster} />

              {!roster.loaded ? (
                <div className="flex items-center gap-2 py-6 justify-center text-[13px] text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading the roster…
                </div>
              ) : active.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-white/45">No NPCs yet. Add the first one above.</p>
              ) : (
                <ul className="space-y-2">
                  {active.map(npc => (
                    <li
                      key={npc.id}
                      className={cn(
                        'rounded-xl border p-3 flex items-center gap-3',
                        npc.on_stage ? 'border-amber-400/50 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]',
                      )}
                    >
                      <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-12 h-12 text-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-white truncate">{npc.name}</p>
                        <p className="text-[11px] text-white/45 truncate">{npc.player_user_id ? 'Player stand-in · ' : ''}{npcModelLabel(npc.model)}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            onClick={() => startEdit(npc)}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[36px] px-2 rounded-md text-[12px] text-white/70 flex items-center gap-1 active:bg-white/10"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => setMindId(npc.id)}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[36px] px-2 rounded-md text-[12px] text-amber-200/80 flex items-center gap-1 active:bg-white/10"
                          >
                            <Brain className="w-3.5 h-3.5" /> Mind
                          </button>
                          <button
                            onClick={() => { void run(npc, () => roster.archiveNpc(npc.id), `${npc.name} archived. Restore them any time.`); }}
                            disabled={busyId === npc.id}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[36px] px-2 rounded-md text-[12px] text-white/50 flex items-center gap-1 active:bg-white/10 disabled:opacity-40"
                          >
                            <Archive className="w-3.5 h-3.5" /> Archive
                          </button>
                        </div>
                      </div>
                      <label className="shrink-0 flex flex-col items-center gap-1">
                        <Switch
                          checked={npc.on_stage}
                          disabled={busyId === npc.id}
                          onCheckedChange={(on) => { void run(npc, () => roster.setOnStage(npc.id, on)); }}
                          aria-label={npc.on_stage ? `Take ${npc.name} off stage` : `Put ${npc.name} on stage`}
                        />
                        <span className={cn('text-[10px]', npc.on_stage ? 'text-amber-200' : 'text-white/40')}>{npc.on_stage ? 'On stage' : 'Off stage'}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}

              {archived.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    style={{ touchAction: 'manipulation' }}
                    className="min-h-[40px] text-[12px] text-white/45"
                  >
                    {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
                  </button>
                  {showArchived && (
                    <ul className="space-y-1.5">
                      {archived.map(npc => (
                        <li key={npc.id} className="flex items-center gap-3 rounded-lg border border-white/5 p-2 opacity-70">
                          <NpcPortrait url={npc.portrait_url} name={npc.name} className="w-9 h-9 text-sm" />
                          <span className="flex-1 min-w-0 truncate text-[13px] text-white/70">{npc.name}</span>
                          <button
                            onClick={() => { void run(npc, () => roster.restoreNpc(npc.id), `${npc.name} is back on the roster.`); }}
                            disabled={busyId === npc.id}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[40px] px-3 rounded-md border border-white/10 text-[12px] text-white/70 flex items-center gap-1 disabled:opacity-40"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="pt-2 pb-4 text-[11px] leading-relaxed text-white/35">
                Players see an NPC's name and portrait, never the guide or secrets. NPCs guard their secrets, but a player who earns it in the conversation can still pry one loose. An NPC can't change HP, gold, items or quests: only your DM posts do.
              </p>
            </>
          )}
        </div>

        <AvatarCropDialog
          open={!!cropFile}
          file={cropFile}
          kind="ic"
          onCancel={() => setCropFile(null)}
          onConfirm={async (cropped) => {
            setCropFile(null);
            await uploadCropped(cropped);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}


/** Host: put an away player's character on stage, played from their AFK guide. */
function StandInPicker({ roster }: { roster: PartyNpcsApi }) {
  const [seats, setSeats] = useState<Array<{ user_id: string; character_name: string }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { roster.loadSeats().then(setSeats).catch(() => setSeats([])); }, [roster.loadSeats]);
  if (!seats.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <p className="text-[12px] text-white/60">Away players: put their character on stage. They talk like any NPC, using their AFK guide, and step down when the player comes back.</p>
      {seats.map(seat => {
        const live = roster.npcs.find(n => n.player_user_id === seat.user_id && n.on_stage && !n.archived);
        return (
          <div key={seat.user_id} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 truncate text-[13px] text-white/85">{seat.character_name}</span>
            <button
              disabled={busy === seat.user_id || !!live}
              onClick={async () => {
                setBusy(seat.user_id);
                try { const npc = await roster.addStandIn(seat); toast.success(`${npc.name} is on stage.`); }
                catch (err) { toast.error(err instanceof Error ? err.message : 'Could not add them.'); }
                finally { setBusy(null); }
              }}
              style={{ touchAction: 'manipulation' }}
              className="min-h-[44px] px-3 rounded-lg border border-amber-400/40 bg-amber-500/10 text-[12px] text-amber-100 flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy === seat.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Drama className="w-4 h-4" />}
              {live ? 'On stage' : 'Add to stage'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
