import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type {
  NpcBuildDifficulty, NpcBuildDraft, NpcBuildRole, NpcCombatStats, NpcSkill, NpcSkillType, NpcSpeed, NpcTemplate, PartyNpcsApi,
} from '@/hooks/use-party-npcs';
import { NPC_SKILL_INFO } from '@/hooks/use-party-npcs';

const fieldClass = 'w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-[14px] text-white/90 placeholder:text-white/30 outline-none focus:border-amber-400/60';
const labelClass = 'block text-[11px] uppercase tracking-wide text-white/50 mb-1';
const tm = { touchAction: 'manipulation' as const };

const ROLES: { v: NpcBuildRole; label: string }[] = [
  { v: 'talker', label: 'Talker' }, { v: 'minion', label: 'Minion' }, { v: 'fighter', label: 'Fighter' }, { v: 'boss', label: 'Boss' },
];
const DIFFS: { v: NpcBuildDifficulty; label: string }[] = [
  { v: 'easy', label: 'Easy' }, { v: 'medium', label: 'Medium' }, { v: 'hard', label: 'Hard' }, { v: 'deadly', label: 'Deadly' },
];
const SPEEDS: NpcSpeed[] = ['trivial', 'easy', 'medium', 'hard', 'deadly'];
const GRUDGES = [
  { v: 'forgiving', label: 'Forgiving' }, { v: 'normal', label: 'Normal' }, { v: 'grudge', label: 'Holds grudges' },
];

function Chip({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={tm}
      aria-pressed={on}
      className={cn(
        'min-h-[44px] rounded-lg border px-2 text-[13px] transition-colors',
        on ? 'bg-amber-800/45 text-amber-100 border-amber-400/50' : 'bg-white/5 text-white/60 border-white/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

function uniqueName(base: string, taken: Set<string>): string {
  const clean = base.trim() || 'NPC';
  if (!taken.has(clean.toLowerCase())) return clean;
  let n = 2;
  while (taken.has(`${clean} ${n}`.toLowerCase())) n++;
  return `${clean} ${n}`;
}

export function NpcQuickBuild({ roster, onCreated }: { roster: PartyNpcsApi; onCreated: () => void }) {
  const [description, setDescription] = useState('');
  const [useScene, setUseScene] = useState(false);
  const [count, setCount] = useState(1);
  const [role, setRole] = useState<NpcBuildRole>('fighter');
  const [difficulty, setDifficulty] = useState<NpcBuildDifficulty>('medium');
  const [fight, setFight] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<{ key: number; d: NpcBuildDraft }[]>([]);
  const nextKey = useRef(1);
  const [onStage, setOnStage] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  const [tplOpen, setTplOpen] = useState(false);
  const [templates, setTemplates] = useState<NpcTemplate[] | null>(null);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<NpcTemplate | null>(null);

  const canBuild = (description.trim().length > 0 || useScene) && !building;

  const pickRole = (r: NpcBuildRole) => {
    setRole(r);
    setFight(r !== 'talker');
  };

  const addDrafts = (list: NpcBuildDraft[]) => {
    setDrafts(prev => {
      const taken = new Set<string>([
        ...roster.npcs.map(n => n.name.toLowerCase()),
        ...prev.map(p => p.d.name.trim().toLowerCase()),
      ]);
      const added = list.map(d => {
        const name = uniqueName(d.name, taken);
        taken.add(name.toLowerCase());
        return { key: nextKey.current++, d: { ...d, name } };
      });
      return [...prev, ...added];
    });
  };

  const build = async () => {
    if (!canBuild) return;
    setBuilding(true);
    setError(null);
    try {
      const result = await roster.buildNpcs({ description: description.trim(), useScene, count, role, difficulty, fight });
      if (!result.length) setError('The builder sent back no NPCs. Try again.');
      else addDrafts(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The NPC builder could not answer. Try again.');
    } finally {
      setBuilding(false);
    }
  };

  const update = (key: number, patch: Partial<NpcBuildDraft>) =>
    setDrafts(prev => prev.map(p => (p.key === key ? { ...p, d: { ...p.d, ...patch } } : p)));
  const updateStats = (key: number, patch: Partial<NpcCombatStats>) =>
    setDrafts(prev => prev.map(p => (p.key === key && p.d.combatStats ? { ...p, d: { ...p.d, combatStats: { ...p.d.combatStats, ...patch } } } : p)));

  const createAll = async () => {
    if (creating || !drafts.length) return;
    const list = drafts;
    let ok = 0;
    for (let i = 0; i < list.length; i++) {
      setCreating(`Creating ${i + 1} of ${list.length}…`);
      try {
        await roster.createFromDraft(list[i].d, { onStage });
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `${list[i].d.name} could not be created.`);
      }
    }
    setCreating(null);
    toast.success(`${ok} NPC${ok === 1 ? '' : 's'} ready`);
    setDrafts([]);
    onCreated();
  };

  const openTemplates = async () => {
    const next = !tplOpen;
    setTplOpen(next);
    if (!next) return;
    setTplLoading(true);
    setTplError(null);
    try {
      setTemplates(await roster.listTemplates());
    } catch (e) {
      setTplError(e instanceof Error ? e.message : 'Templates could not load.');
    } finally {
      setTplLoading(false);
    }
  };

  const deleteTemplate = async (t: NpcTemplate) => {
    try {
      await roster.deleteTemplate(t.id);
      setTemplates(prev => (prev ? prev.filter(x => x.id !== t.id) : prev));
      toast.success('Template deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Template could not be deleted.');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Templates */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <button type="button" onClick={openTemplates} style={tm} className="w-full min-h-[44px] flex items-center justify-between px-3 text-[14px] text-amber-100 font-cinzel">
          From a template
          {tplOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {tplOpen && (
          <div className="px-3 pb-3 space-y-2">
            {tplLoading && <p className="text-[12px] text-white/50 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</p>}
            {tplError && <p className="text-[12px] text-red-300">{tplError}</p>}
            {!tplLoading && !tplError && templates?.length === 0 && <p className="text-[12px] text-white/50">No templates yet. Save a draft as a template to reuse it.</p>}
            {templates?.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-white/90 truncate">{t.name}</p>
                  {t.data?.combatStats && (
                    <p className="text-[11px] text-white/50">Max HP {t.data.combatStats.maxHp} · {t.data.combatStats.speed}</p>
                  )}
                </div>
                <button type="button" style={tm} onClick={() => addDrafts([{ ...t.data }])} className="min-h-[44px] px-3 rounded-lg border border-amber-400/40 text-amber-100 text-[13px]">Use</button>
                <button type="button" style={tm} aria-label={`Delete ${t.name}`} onClick={() => setConfirmDelete(t)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Describe them</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value.slice(0, 1000))}
            rows={3}
            className={cn(fieldClass, 'resize-none')}
            placeholder="Two Phalanx hoplites at a gate. One young and jittery, one stern veteran."
          />
          <p className="text-[11px] text-white/40 text-right">{description.length}/1000</p>
        </div>
        <Chip on={useScene} onClick={() => setUseScene(v => !v)} className="w-full">Use current scene</Chip>
        <div>
          <label className={labelClass}>How many</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map(n => <Chip key={n} on={count === n} onClick={() => setCount(n)}>{n}</Chip>)}
          </div>
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <div className="grid grid-cols-4 gap-2">
            {ROLES.map(r => <Chip key={r.v} on={role === r.v} onClick={() => pickRole(r.v)}>{r.label}</Chip>)}
          </div>
        </div>
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="text-[14px] text-white/80">Can fight</span>
          <Switch checked={fight} onCheckedChange={setFight} />
        </div>
        {fight && (
          <div>
            <label className={labelClass}>Difficulty</label>
            <div className="grid grid-cols-4 gap-2">
              {DIFFS.map(d => <Chip key={d.v} on={difficulty === d.v} onClick={() => setDifficulty(d.v)}>{d.label}</Chip>)}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={build}
          disabled={!canBuild}
          style={tm}
          className="w-full min-h-[48px] rounded-lg bg-amber-700/70 border border-amber-400/50 text-amber-50 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {building ? <><Loader2 className="w-4 h-4 animate-spin" /> Building…</> : <><Wand2 className="w-4 h-4" /> Build</>}
        </button>
        {error && <p className="text-[12px] text-red-300">{error}</p>}
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          {drafts.map(({ key, d }) => (
            <DraftCard
              key={key}
              draft={d}
              partyId={roster.partyId ?? null}
              onChange={patch => update(key, patch)}
              onStats={patch => updateStats(key, patch)}
              onRemove={() => setDrafts(prev => prev.filter(p => p.key !== key))}
              onSaveTemplate={async () => {
                try {
                  const t = await roster.saveTemplate(d);
                  setTemplates(prev => (prev ? [t, ...prev] : prev));
                  toast.success('Template saved');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Template could not be saved.');
                }
              }}
            />
          ))}
          <div className="flex items-center justify-between min-h-[44px]">
            <span className="text-[14px] text-white/80">Put on stage</span>
            <Switch checked={onStage} onCheckedChange={setOnStage} />
          </div>
          <button
            type="button"
            onClick={createAll}
            disabled={!!creating}
            style={tm}
            className="w-full min-h-[48px] rounded-lg bg-amber-700/70 border border-amber-400/50 text-amber-50 text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> {creating}</> : 'Create all'}
          </button>
          <button type="button" onClick={() => setDrafts([])} disabled={!!creating} style={tm} className="w-full min-h-[44px] text-[13px] text-white/50 underline">
            Start over
          </button>
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>“{confirmDelete?.name}” will be gone for good. NPCs already made from it stay.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const t = confirmDelete; setConfirmDelete(null); if (t) void deleteTemplate(t); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DraftCard({ draft, partyId, onChange, onStats, onRemove, onSaveTemplate }: {
  draft: NpcBuildDraft;
  partyId: string | null;
  onChange: (p: Partial<NpcBuildDraft>) => void;
  onStats: (p: Partial<NpcCombatStats>) => void;
  onRemove: () => void;
  onSaveTemplate: () => Promise<void>;
}) {
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [painting, setPainting] = useState(false);
  const s = draft.combatStats;
  const imagePrompt = draft.imagePrompt ?? buildNpcImagePrompt(draft);
  const generatePortrait = async () => {
    if (!partyId || painting || !imagePrompt.trim()) return;
    setPainting(true);
    try {
      const { data, error } = await supabase.functions.invoke('venice-image-generate', {
        body: { mode: 'npc-portrait', partyId, prompt: imagePrompt.trim() },
      });
      const url = (data as { imageUrl?: string } | null)?.imageUrl;
      if (error || !url) throw new Error((data as { error?: string } | null)?.error || 'Portrait generation failed');
      onChange({ portraitUrl: url });
      toast.success(`Portrait ready for ${draft.name || 'this NPC'}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Portrait generation failed');
    } finally {
      setPainting(false);
    }
  };
  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  };
  const area = (label: string, field: keyof NpcBuildDraft, rows = 2) => (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        value={String(draft[field] ?? '')}
        onChange={e => onChange({ [field]: e.target.value } as Partial<NpcBuildDraft>)}
        rows={rows}
        className={cn(fieldClass, 'resize-none')}
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-amber-400/25 bg-black/30 p-3 space-y-3">
      <input value={draft.name} onChange={e => onChange({ name: e.target.value.slice(0, 60) })} className={cn(fieldClass, 'font-cinzel text-amber-100')} aria-label="Name" />
      {area('Guide', 'guide', 3)}
      {area('Attack style', 'attack', 1)}
      <div className="space-y-2">
        <label className={labelClass}>Portrait description</label>
        <div className="flex gap-3 items-start">
          <NpcPortrait url={draft.portraitUrl ?? null} name={draft.name || '?'} className="w-16 h-16 text-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <textarea
              value={imagePrompt}
              onChange={e => onChange({ imagePrompt: e.target.value.slice(0, 1500) })}
              rows={4}
              disabled={painting}
              className={cn(fieldClass, 'resize-none')}
              aria-label="Portrait description"
            />
            <p className="text-[11px] text-white/40 text-right">{imagePrompt.length}/1500</p>
          </div>
        </div>
        <button
          type="button"
          onClick={generatePortrait}
          disabled={!partyId || painting || !imagePrompt.trim()}
          style={tm}
          className="w-full min-h-[48px] rounded-lg border border-amber-400/40 bg-amber-500/10 text-[14px] text-amber-100 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {painting ? <><Loader2 className="w-4 h-4 animate-spin" /> Painting portrait…</> : (draft.portraitUrl ? 'Generate a new image' : 'Generate Image')}
        </button>
      </div>
      {s && (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div><label className={labelClass}>Max HP</label><input inputMode="numeric" value={s.maxHp} onChange={e => onStats({ maxHp: Math.max(1, num(e.target.value, s.maxHp)) })} className={cn(fieldClass, 'px-2')} /></div>
            <div><label className={labelClass}>AC</label><input inputMode="numeric" value={s.ac} onChange={e => onStats({ ac: Math.max(0, num(e.target.value, s.ac)) })} className={cn(fieldClass, 'px-2')} /></div>
            <div><label className={labelClass}>Atk +</label><input inputMode="numeric" value={s.attackBonus} onChange={e => onStats({ attackBonus: num(e.target.value, s.attackBonus) })} className={cn(fieldClass, 'px-2')} /></div>
            <div><label className={labelClass}>Damage</label><input value={s.damage} onChange={e => onStats({ damage: e.target.value.slice(0, 20) })} className={cn(fieldClass, 'px-2')} placeholder="2d8+3" /></div>
          </div>
          <div>
            <label className={labelClass}>Speed</label>
            <div className="grid grid-cols-5 gap-1">
              {SPEEDS.map(sp => <Chip key={sp} on={s.speed === sp} onClick={() => onStats({ speed: sp })} className="px-0 text-[11px] capitalize">{sp}</Chip>)}
            </div>
          </div>
          <SkillsEditor skills={s.skills ?? []} onChange={skills => onStats({ skills })} />
        </div>
      )}
      <button type="button" onClick={() => setMore(v => !v)} style={tm} className="min-h-[44px] flex items-center gap-1 text-[13px] text-amber-200/80">
        {more ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {more ? 'Less' : 'More'}
      </button>
      {more && (
        <div className="space-y-3">
          {area('Secrets', 'secrets')}
          {area('Wants', 'wants')}
          {area('What works on them', 'levers')}
          {area('Hard lines', 'hardLines')}
          {area('Mood range', 'moodRange', 1)}
          <div>
            <label className={labelClass}>Feelings over time</label>
            <div className="grid grid-cols-3 gap-2">
              {GRUDGES.map(g => <Chip key={g.v} on={draft.grudgeStyle === g.v} onClick={() => onChange({ grudgeStyle: g.v })}>{g.label}</Chip>)}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onRemove} style={tm} className="min-h-[44px] rounded-lg border border-white/15 text-white/70 text-[13px]">Remove</button>
        <button
          type="button"
          disabled={saving}
          onClick={async () => { setSaving(true); try { await onSaveTemplate(); } finally { setSaving(false); } }}
          style={tm}
          className="min-h-[44px] rounded-lg border border-amber-400/40 text-amber-100 text-[13px] flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save as template
        </button>
      </div>
    </div>
  );
}

function SkillsEditor({ skills, onChange }: { skills: NpcSkill[]; onChange: (s: NpcSkill[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const list = skills.slice(0, 4);
  const set = (i: number, p: Partial<NpcSkill>) => onChange(list.map((k, j) => (j === i ? { ...k, ...p } : k)));
  const types = Object.keys(NPC_SKILL_INFO) as NpcSkillType[];
  const firstFree = types.find(t => !list.some(k => k.type === t));
  return (
    <div className="space-y-2">
      <label className={labelClass}>Skills</label>
      <div className="flex flex-wrap gap-1.5">
        {list.map((k, i) => (
          <button
            key={`${k.type}-${i}`}
            type="button"
            style={tm}
            onClick={() => setEditing(editing === i ? null : i)}
            className={cn('min-h-[44px] rounded-full border px-3 text-[12px]',
              editing === i ? 'border-amber-400/60 bg-amber-800/40 text-amber-100' : 'border-white/15 bg-white/5 text-white/80')}
          >
            {NPC_SKILL_INFO[k.type]?.label ?? k.type}{k.name ? ` · ${k.name}` : ''}
          </button>
        ))}
        {list.length < 4 && firstFree && (
          <button
            type="button"
            style={tm}
            onClick={() => {
              const type: NpcSkillType = list.some(k => k.type === 'strike') ? firstFree : 'strike';
              onChange([...list, { type, name: '' }]);
              setEditing(list.length);
            }}
            className="min-h-[44px] rounded-full border border-dashed border-white/25 px-3 text-[12px] text-white/70"
          >
            + Add skill
          </button>
        )}
      </div>
      {editing !== null && list[editing] && (
        <div className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-2">
          <select
            value={list[editing].type}
            onChange={e => set(editing, { type: e.target.value as NpcSkillType })}
            className={cn(fieldClass, 'min-h-[44px]')}
            aria-label="Skill type"
          >
            {types.map(t => (
              <option key={t} value={t} disabled={t !== list[editing].type && list.some(k => k.type === t)}>{NPC_SKILL_INFO[t].label}</option>
            ))}
          </select>
          <p className="text-[11px] text-white/50">{NPC_SKILL_INFO[list[editing].type]?.hint}</p>
          <input
            value={list[editing].name}
            maxLength={40}
            onChange={e => set(editing, { name: e.target.value.slice(0, 40) })}
            placeholder="Bayonet Lunge"
            className={fieldClass}
            aria-label="Skill name"
          />
          <button
            type="button"
            style={tm}
            onClick={() => { onChange(list.filter((_, j) => j !== editing)); setEditing(null); }}
            className="w-full min-h-[44px] rounded-lg border border-white/15 text-[13px] text-white/70 flex items-center justify-center gap-1"
          >
            <Trash2 className="w-4 h-4" /> Remove skill
          </button>
        </div>
      )}
    </div>
  );
}
