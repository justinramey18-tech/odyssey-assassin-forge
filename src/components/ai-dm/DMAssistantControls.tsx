// Controls for the Human DM Assistant panel: settings (models, personality,
// World Bible), the NPC picker, the rehearsal banner (one or more NPCs), a finished scene's
// "add to draft" actions, and the tone buttons for an aimed paragraph.

import { Switch } from '@/components/ui/switch';
import { BookOpen, Plus, X } from 'lucide-react';
import { ART, Medal } from './DMAssistantArt';
import { DM_MODELS } from '@/lib/dm-models';
import {
  PERSONAS,
  TONE_PROMPTS,
  modelNeedsMissingKey,
  type AssistantMode,
  type AssistantPersona,
  type QuickPrompt,
} from '@/lib/dm-assistant';
import type { DigestStatus } from '@/hooks/use-dm-assistant';

const PROVIDER_LABEL: Record<string, string> = {
  lovable: 'Built in',
  anthropic: 'Claude',
  'openai-direct': 'OpenAI (your key)',
  perplexity: 'Perplexity (your key)',
  'xai-direct': 'Grok (your key)',
  venice: 'Venice',
};

const DIGEST_LABEL: Record<DigestStatus, string> = {
  'no-guides': 'No guides enabled',
  none: 'Bible digest builds on your first message',
  stale: 'Guides changed: digest rebuilds on your next message',
  building: 'Reading your World Bible once…',
  ready: 'Bible digest ready',
  error: 'Digest failed: full guides were sent',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const tap = { touchAction: 'manipulation' as const };

export function AssistantSettings({
  models,
  onModelChange,
  persona,
  onPersonaChange,
  digestStatus,
  onRebuildDigest,
  fullBible,
  onFullBibleChange,
  busy,
}: {
  models: Record<AssistantMode, string>;
  onModelChange: (mode: AssistantMode, id: string) => void;
  persona: AssistantPersona;
  onPersonaChange: (persona: AssistantPersona) => void;
  digestStatus: DigestStatus;
  onRebuildDigest: () => void;
  fullBible: boolean;
  onFullBibleChange: (on: boolean) => void;
  busy: boolean;
}) {
  const groups = Object.keys(PROVIDER_LABEL)
    .map(provider => ({ provider, models: DM_MODELS.filter(m => m.provider === provider) }))
    .filter(g => g.models.length > 0);

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
      {(['brainstorm', 'draft'] as AssistantMode[]).map(m => (
        <label key={m} className="block">
          <span className="block text-[11px] text-white/50 mb-1 px-0.5">
            {m === 'brainstorm' ? 'Brainstorm model (fast is best)' : 'Draft model (best writer)'}
          </span>
          <select
            value={models[m]}
            onChange={e => onModelChange(m, e.target.value)}
            aria-label={m === 'brainstorm' ? 'Brainstorm model' : 'Draft model'}
            className="w-full min-h-[40px] rounded-lg bg-white/5 border border-white/10 text-[13px] text-white/85 px-2"
          >
            {groups.map(g => (
              <optgroup key={g.provider} label={PROVIDER_LABEL[g.provider]}>
                {g.models.map(model => {
                  const locked = modelNeedsMissingKey(model.id);
                  return (
                    <option key={model.id} value={model.id} disabled={locked}>
                      {model.label}{locked ? ' (needs your key)' : ''}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
        </label>
      ))}
      <label className="block">
        <span className="block text-[11px] text-white/50 mb-1 px-0.5">Co-writer personality</span>
        <select
          value={persona}
          onChange={e => onPersonaChange(e.target.value as AssistantPersona)}
          aria-label="Co-writer personality"
          className="w-full min-h-[40px] rounded-lg bg-white/5 border border-white/10 text-[13px] text-white/85 px-2"
        >
          {(Object.keys(PERSONAS) as AssistantPersona[]).map(k => (
            <option key={k} value={k}>{PERSONAS[k].label}</option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-2 text-[11px] text-white/50">
        <BookOpen className="w-3.5 h-3.5 shrink-0 text-amber-300/70" />
        <span className="truncate">{DIGEST_LABEL[digestStatus]}</span>
        {(digestStatus === 'ready' || digestStatus === 'error' || digestStatus === 'stale') && (
          <button onClick={onRebuildDigest} disabled={busy} style={tap} className="shrink-0 underline text-amber-300/80 disabled:opacity-40">
            Rebuild
          </button>
        )}
        <label className="ml-auto shrink-0 flex items-center gap-1.5">
          <span>Full Bible</span>
          <Switch checked={fullBible} onCheckedChange={onFullBibleChange} disabled={busy} aria-label="Send the full guides with the next message" />
        </label>
      </div>
    </div>
  );
}

export function NpcPicker({
  value,
  onChange,
  onStart,
  onCancel,
  recent,
}: {
  value: string;
  onChange: (value: string) => void;
  onStart: (name: string) => void;
  onCancel: () => void;
  recent: string[];
}) {
  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-950/30 p-2 space-y-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onStart(value); }}
          placeholder="Which NPC? e.g. Grukk"
          aria-label="NPC name"
          autoFocus
          className="flex-1 min-w-0 min-h-[40px] rounded-lg bg-white/5 border border-white/10 px-3 text-[13px] text-white/90"
        />
        <button onClick={() => onStart(value)} disabled={!value.trim()} style={tap}
          className="shrink-0 min-h-[40px] px-3 rounded-lg border border-amber-400/40 bg-amber-800/35 text-[13px] text-amber-100 disabled:opacity-40">
          Start
        </button>
        <button onClick={onCancel} aria-label="Cancel" style={tap}
          className="shrink-0 w-10 min-h-[40px] rounded-lg border border-white/10 bg-white/5 text-white/60 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>
      </div>
      {recent.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {recent.map(n => (
            <button key={n} onClick={() => onStart(n)} style={tap}
              className="shrink-0 min-h-[32px] px-3 rounded-full border border-amber-400/30 bg-amber-900/20 text-[12px] text-amber-100/90">
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RehearsalBanner({
  npc,
  cast,
  lines,
  insertAfter,
  busy,
  onSpeaker,
  onAddNpc,
  onAddAsIs,
  onWeave,
  onDone,
}: {
  /** Who answers next. */
  npc: string;
  /** Everyone in the scene. */
  cast: string[];
  /** Lines that will go into the draft (everything said, plus the NPC lines still ticked). */
  lines: number;
  insertAfter: number | null;
  busy: boolean;
  onSpeaker: (name: string) => void;
  onAddNpc: () => void;
  onAddAsIs: () => void;
  onWeave: () => void;
  onDone: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-400/40 bg-[#2a2016] px-2.5 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <Medal src={ART.medalNpc} className="w-6 h-6" />
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {cast.map(name => (
            <button key={name} onClick={() => onSpeaker(name)} disabled={busy} aria-pressed={name === npc} style={tap}
              className={name === npc
                ? 'shrink-0 min-h-[30px] px-2.5 rounded-full border border-amber-300/70 bg-amber-700/50 text-[12px] font-semibold text-amber-50 disabled:opacity-60'
                : 'shrink-0 min-h-[30px] px-2.5 rounded-full border border-amber-400/25 bg-amber-950/40 text-[12px] text-amber-100/70 disabled:opacity-40'}>
              {name}
            </button>
          ))}
          <button onClick={onAddNpc} disabled={busy} aria-label="Add another NPC to this scene" style={tap}
            className="shrink-0 min-h-[30px] px-2 rounded-full border border-dashed border-amber-400/40 text-[12px] text-amber-200/80 flex items-center gap-0.5 disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" /> NPC
          </button>
        </div>
        <button onClick={onDone} style={tap}
          className="shrink-0 min-h-[30px] px-2.5 rounded-md border border-white/15 bg-white/5 text-[12px] text-white/75 flex items-center gap-1">
          <X className="w-3.5 h-3.5" /> Done
        </button>
      </div>
      {cast.length > 1 && (
        <div className="text-[11px] text-amber-100/55 px-0.5">
          <b className="text-amber-100/80">{npc}</b> answers next. Tap a name to switch.
        </div>
      )}
      {lines > 0 && (
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 truncate text-[11px] text-amber-100/60">
            {plural(lines, 'line', 'lines')} ready{insertAfter ? ` · after ¶${insertAfter}` : ''}
          </span>
          <button onClick={onAddAsIs} disabled={busy} style={tap}
            className="shrink-0 min-h-[32px] px-2.5 rounded-md border border-white/15 bg-white/5 text-[12px] text-white/80 disabled:opacity-40">
            Add as-is
          </button>
          <button onClick={onWeave} disabled={busy} style={tap}
            className="shrink-0 min-h-[32px] px-2.5 rounded-md border border-amber-400/40 bg-amber-800/35 text-[12px] text-amber-100 disabled:opacity-40">
            Weave in →
          </button>
        </div>
      )}
    </div>
  );
}

export function SceneActions({
  npc,
  lines,
  insertAfter,
  busy,
  onAddAsIs,
  onWeave,
}: {
  /** The scene's cast, e.g. "Grukk and Mira". */
  npc: string;
  /** Lines that will go into the draft, in order. */
  lines: number;
  insertAfter: number | null;
  busy: boolean;
  onAddAsIs: () => void;
  onWeave: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-400/25 bg-amber-950/30 px-3 py-2 space-y-1.5">
      <div className="text-[11px] text-amber-100/70">
        Scene with {npc} · {plural(lines, 'line', 'lines')}, word for word{insertAfter ? ` · goes after ¶${insertAfter}` : ''}
      </div>
      <div className="flex gap-2">
        <button onClick={onAddAsIs} disabled={busy} style={tap}
          className="flex-1 min-h-[36px] rounded-md border border-white/15 bg-white/5 text-[12px] text-white/80 disabled:opacity-40">
          Add as-is
        </button>
        <button onClick={onWeave} disabled={busy} style={tap}
          className="flex-1 min-h-[36px] rounded-md border border-amber-400/40 bg-amber-800/30 text-[12px] text-amber-100 disabled:opacity-40">
          Weave into draft →
        </button>
      </div>
    </div>
  );
}

/** Shown when a paragraph is aimed: alternate versions plus one-tap tone changes. */
export function AimTools({
  busy,
  onVersions,
  onTone,
}: {
  busy: boolean;
  onVersions: () => void;
  onTone: (prompt: QuickPrompt) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      <button onClick={onVersions} disabled={busy} style={tap}
        className="shrink-0 min-h-[34px] px-3 rounded-full border border-teal-400/40 bg-teal-900/30 text-[12px] text-teal-100 flex items-center gap-1.5 disabled:opacity-40">
        <Medal src={ART.medalVersions} className="w-5 h-5" /> 3 versions
      </button>
      {TONE_PROMPTS.map(q => (
        <button key={q.label} onClick={() => onTone(q)} disabled={busy} style={tap}
          className="shrink-0 min-h-[34px] px-3 rounded-full border border-amber-400/35 bg-amber-800/25 text-[12px] text-amber-100 disabled:opacity-40">
          {q.label}
        </button>
      ))}
    </div>
  );
}
