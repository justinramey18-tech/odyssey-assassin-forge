// Live NPCs (DECISIONS D-22): the host's NPC Roster. Add NPCs, write their guides and
// secrets, pick their voice model, and put them on stage so players can talk to them in
// the Live Table. Guides and secrets are read only by the host here and by the server.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Archive, ArchiveRestore, Drama, ImagePlus, Loader2, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { AvatarCropDialog } from './AvatarCropDialog';
import { NpcPortrait } from './NpcPortrait';
import type { PartyNpc, PartyNpcsApi } from '@/hooks/use-party-npcs';
import {
  NPC_DEFAULT_MODEL,
  NPC_GUIDE_MAX,
  NPC_NAME_MAX,
  NPC_SECRETS_MAX,
  cleanNpcName,
  npcModelChoices,
  npcModelLabel,
  npcNameProblem,
} from '@/lib/live-npcs';

interface NpcRosterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: PartyNpcsApi;
}

interface Draft {
  /** null while adding a new NPC. */
  id: string | null;
  name: string;
  model: string;
  portraitUrl: string | null;
  guide: string;
  secrets: string;
}

/** The guide of an NPC being edited: still loading, loaded, or failed (then it is never overwritten). */
type GuideState = 'loading' | 'ready' | 'failed';

const fieldClass = 'w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-[14px] text-white/90 placeholder:text-white/30 outline-none focus:border-amber-400/60';

export function NpcRosterPanel({ open, onOpenChange, roster }: NpcRosterPanelProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [guideState, setGuideState] = useState<GuideState>('ready');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
  useEffect(() => { if (!open) { setDraft(null); setCropFile(null); } }, [open]);

  const active = roster.active;
  const archived = roster.npcs.filter(n => n.archived);
  const onStageNames = roster.onStage.map(n => n.name);
  const nameProblem = draft ? npcNameProblem(draft.name, roster.npcs, draft.id) : null;
  const modelInfo = draft ? choices.find(c => c.id === draft.model) : undefined;

  const loadGuideInto = async (npcId: string) => {
    setGuideState('loading');
    try {
      const g = await roster.loadGuide(npcId);
      setDraft(prev => (prev && prev.id === npcId ? { ...prev, guide: g.guide, secrets: g.secrets } : prev));
      setGuideState('ready');
    } catch (err) {
      setGuideState('failed');
      toast.error(err instanceof Error ? err.message : 'Could not load the guide.');
    }
  };

  const startNew = () => {
    setGuideState('ready');
    setDraft({ id: null, name: '', model: NPC_DEFAULT_MODEL, portraitUrl: null, guide: '', secrets: '' });
  };

  const startEdit = (npc: PartyNpc) => {
    setDraft({ id: npc.id, name: npc.name, model: npc.model, portraitUrl: npc.portrait_url, guide: '', secrets: '' });
    void loadGuideInto(npc.id);
  };

  const save = async () => {
    if (!draft || nameProblem || saving || uploading) return;
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
        toast.success(`${npc.name} joined the roster. Turn on "On stage" when they enter the scene.`);
      } else {
        await roster.updateNpc(draft.id, { name: draft.name, model: draft.model, portrait_url: draft.portraitUrl });
        // A guide that failed to load is never saved, so it can't be wiped by accident.
        if (guideState === 'ready') await roster.saveGuide(draft.id, draft.guide, draft.secrets);
        toast.success(guideState === 'ready' ? `${cleanNpcName(draft.name)} saved` : `${cleanNpcName(draft.name)} saved (the guide was not loaded, so it was left as it was)`);
      }
      setDraft(null);
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
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {draft ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-cinzel text-[14px] text-amber-200">{draft.id ? `Edit ${draft.name || 'NPC'}` : 'New NPC'}</h3>
                <button
                  onClick={() => setDraft(null)}
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
                    disabled={uploading}
                    style={{ touchAction: 'manipulation' }}
                    className="min-h-[44px] px-3 rounded-lg border border-white/15 bg-white/5 text-[13px] text-white/80 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {draft.portraitUrl ? 'Change' : 'Add picture'}
                  </button>
                  {draft.portraitUrl && !uploading && (
                    <button
                      onClick={() => setDraft({ ...draft, portraitUrl: null })}
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
                </>
              )}

              <div className="flex gap-2 pt-1 pb-4">
                <button
                  onClick={() => setDraft(null)}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[48px] rounded-lg bg-white/5 text-[14px] text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void save(); }}
                  disabled={!!nameProblem || saving || uploading || guideState === 'loading'}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 min-h-[48px] rounded-lg border border-amber-400/50 bg-amber-500/20 text-[14px] text-amber-100 font-cinzel flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {draft.id ? 'Save' : 'Add to roster'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={startNew}
                style={{ touchAction: 'manipulation' }}
                className="w-full min-h-[48px] rounded-lg border border-dashed border-amber-400/40 bg-amber-500/5 text-[14px] text-amber-200 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> New NPC
              </button>

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
                        <p className="text-[11px] text-white/45 truncate">{npcModelLabel(npc.model)}</p>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            onClick={() => startEdit(npc)}
                            style={{ touchAction: 'manipulation' }}
                            className="min-h-[36px] px-2 rounded-md text-[12px] text-white/70 flex items-center gap-1 active:bg-white/10"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
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
