import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, RotateCcw, Check, Loader2, ChevronLeft, User, Users } from 'lucide-react';
import offeringJointAsset from '@/assets/offering-joint.jpg.asset.json';
import { RP_FLAVORS, getRpFlavor, type RpFlavor } from '@/lib/rpFlavors';

interface ActionItem {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

export interface LiveTableCandidate {
  userId: string;
  name: string;
  preview: string;
  avatarUrl?: string;
  /** Marks a candidate whose line came from the most recently resolved round. */
  fromLastRound?: boolean;
}

type SuggestMode = 'solo' | 'sync';

interface StoryMasterworkActionsProps {
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  fetchStoryPills: (flavorId?: string, mode?: SuggestMode, targetIds?: string[]) => Promise<ActionItem[]>;
  /** Players with an in-character line to react to, preferring unsent lines over the latest resolved round. */
  liveTableCandidates?: LiveTableCandidate[];
  /** External control: when both are passed, they replace the internal open state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the card button — render only the picker. */
  hideTrigger?: boolean;
}

export function StoryMasterworkActions({ disabled, onSelect, fetchStoryPills, liveTableCandidates = [], open: openProp, onOpenChange, hideTrigger }: StoryMasterworkActionsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = openProp !== undefined && onOpenChange !== undefined;
  const open = controlled ? openProp : internalOpen;
  const setOpen = useCallback((v: boolean) => {
    if (controlled) onOpenChange!(v);
    else setInternalOpen(v);
  }, [controlled, onOpenChange]);
  const [loading, setLoading] = useState(false);
  const [pills, setPills] = useState<ActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flavorId, setFlavorId] = useState<string | null>(null);
  const [mode, setMode] = useState<SuggestMode | null>(null);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [targetsDone, setTargetsDone] = useState(false);

  const hasCandidates = liveTableCandidates.length > 0;

  // Reset the flow every time the picker opens, whether from the card or externally.
  useEffect(() => {
    if (!open) return;
    setFlavorId(null);
    setMode(null);
    setTargetsDone(false);
    setTargetIds([]);
    setPills([]);
    setError(null);
  }, [open]);

  const generate = useCallback(async (id: string, useMode: SuggestMode, ids: string[]) => {
    setFlavorId(id);
    setLoading(true);
    setError(null);
    setPills([]);
    try {
      const result = await fetchStoryPills(id, useMode, useMode === 'sync' ? ids : undefined);
      setPills(result);
    } catch (e: any) {
      setError(e?.message || 'Could not generate suggestions.');
    } finally {
      setLoading(false);
    }
  }, [fetchStoryPills]);

  const pickMode = useCallback((m: SuggestMode) => {
    setTargetIds([]);
    if (m === 'sync') {
      if (!hasCandidates) return;
      setMode('sync');
      setTargetsDone(false);
      return;
    }
    setMode('solo');
    setTargetsDone(true);
  }, [hasCandidates]);

  const toggleTarget = useCallback((id: string) => {
    setTargetIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  /** Step back one screen without closing the panel. */
  const back = useCallback(() => {
    if (flavorId) {
      setFlavorId(null);
      setPills([]);
      setError(null);
      return;
    }
    if (mode === 'sync' && targetsDone) {
      setTargetsDone(false);
      return;
    }
    setMode(null);
    setTargetsDone(false);
    setTargetIds([]);
  }, [flavorId, mode, targetsDone]);

  const close = useCallback(() => {
    setOpen(false);
    setFlavorId(null);
    setMode(null);
    setTargetsDone(false);
    setTargetIds([]);
    setPills([]);
    setError(null);
  }, [setOpen]);

  const choose = useCallback((prompt: string) => {
    onSelect(prompt);
    setOpen(false);
  }, [onSelect, setOpen]);

  const showTargets = mode === 'sync' && !targetsDone && !flavorId;
  const showFlavors = mode !== null && !showTargets && !flavorId;
  const canContinue = targetIds.length > 0;
  const selectedCandidates = liveTableCandidates.filter(candidate => targetIds.includes(candidate.userId));
  const selectedNames = selectedCandidates.map(candidate => candidate.name).join(', ');
  const contextLabel = mode === 'sync' && selectedNames ? `Reacting to: ${selectedNames}` : 'Your own move';
  const showContext = showFlavors || !!flavorId;

  const headerTitle = flavorId
    ? (getRpFlavor(flavorId)?.label || 'Suggested Moves')
    : showTargets
      ? 'Who are you reacting to?'
      : mode === null
        ? 'How do you want to play it?'
        : 'What kind of move?';

  return (
    <>
      {!hideTrigger && (
      <div className="relative w-full">
        <span
          className="absolute -inset-[2px] rounded-xl bg-green-500/70 animate-pulse"
          aria-hidden="true"
        />
        <button
          onClick={() => { setOpen(true); setFlavorId(null); setMode(null); setTargetsDone(false); setTargetIds([]); }}
          disabled={disabled}
          className="relative isolate w-full flex flex-col justify-between items-center text-center min-h-[220px] py-5 px-4 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-100 hover:text-amber-50 text-xs leading-snug transition-colors disabled:opacity-40 overflow-hidden"
          style={{ touchAction: 'manipulation' }}
        >
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${offeringJointAsset.url})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/20 to-black/80" aria-hidden="true" />
          <div className="flex items-start gap-2 justify-center w-full">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <span className="relative max-w-[260px]">
              Are you a pothead? Too high to roleplay? Not high enough?
            </span>
          </div>
          <span className="relative max-w-[260px]">
            No worries! Tap me and ill generate you some moves to choose from!{' '}
            <span className="font-bold text-amber-300">CLICK HERE!!!</span>
          </span>
        </button>
      </div>
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-stretch justify-center">
        <div className="flex h-full w-full max-w-lg flex-col bg-background">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-background">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm font-cinzel text-amber-300 truncate">
                {headerTitle}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mode !== null && !loading && (
                <button
                  onClick={back}
                  className="flex items-center gap-1 text-[11px] text-amber-300/60 hover:text-amber-300 px-2 py-1 rounded"
                  style={{ touchAction: 'manipulation' }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}
              {!loading && flavorId && (
                <button
                  onClick={() => generate(flavorId, mode || 'solo', targetIds)}
                  className="flex items-center gap-1 text-[11px] text-amber-300/60 hover:text-amber-300 px-2 py-1 rounded"
                  style={{ touchAction: 'manipulation' }}
                  title="Regenerate"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              )}
              <button
                onClick={close}
                className="p-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-900/30"
                style={{ touchAction: 'manipulation' }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {mode === null ? (
              <div className="space-y-3">
                <button
                  onClick={() => pickMode('solo')}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full flex items-start gap-3 text-left rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-4 min-h-[104px] active:scale-[0.98] transition-transform"
                >
                  <User className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-cinzel text-amber-200">Do my own thing</span>
                    <span className="block text-[11px] text-white/50 mt-1 leading-snug">
                      Moves built purely on the story so far. Ignores what the others are typing.
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => pickMode('sync')}
                  disabled={!hasCandidates}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full flex items-start gap-3 text-left rounded-xl border border-sky-500/30 bg-sky-950/20 px-4 py-4 min-h-[104px] active:scale-[0.98] transition-transform disabled:border-muted disabled:bg-muted/30 disabled:opacity-45 disabled:active:scale-100"
                >
                  <Users className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-cinzel text-sky-200">Synergize with others</span>
                    <span className="block text-[11px] text-white/50 mt-1 leading-snug">
                      {hasCandidates
                        ? liveTableCandidates.some(candidate => candidate.fromLastRound)
                          ? 'Uses what the others said in the last round so you can build on it — or cut across it.'
                          : 'Reads what the others just said at the table so you can back them up — or cut across them.'
                        : 'Nobody has said anything yet'}
                    </span>
                  </span>
                </button>
              </div>
            ) : showTargets ? (
              <div className="space-y-3">
                <button
                  onClick={() => setTargetIds(liveTableCandidates.map(c => c.userId))}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full py-2.5 rounded-lg border border-sky-500/30 bg-sky-950/20 text-[12px] font-cinzel text-sky-200"
                >
                  Everyone who spoke
                </button>
                {liveTableCandidates.map((c) => {
                  const selected = targetIds.includes(c.userId);
                  return (
                    <button
                      key={c.userId}
                      onClick={() => toggleTarget(c.userId)}
                      style={{ touchAction: 'manipulation' }}
                      className={`w-full flex items-start gap-3 text-left rounded-xl border px-3 py-3 min-h-[104px] active:scale-[0.98] transition-transform ${
                        selected
                          ? 'border-amber-400/70 ring-2 ring-amber-400/40 bg-amber-950/30'
                          : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <span className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-white/15 bg-black/40 flex items-center justify-center text-base font-semibold text-white/70">
                        {c.avatarUrl
                          ? <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                          : (c.name.charAt(0).toUpperCase() || '?')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="block min-w-0 truncate text-sm font-cinzel text-amber-200">{c.name}</span>
                          {c.fromLastRound && (
                            <span className="shrink-0 rounded border border-sky-500/25 bg-sky-950/40 px-1.5 py-0.5 text-[9px] uppercase text-sky-200/70">
                              from last round
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-white/55 mt-1 leading-snug line-clamp-3">
                          {c.preview}
                        </span>
                      </span>
                      {selected && <Check className="w-4 h-4 text-amber-300 shrink-0 mt-1" />}
                    </button>
                  );
                })}
                <button
                  onClick={() => setTargetsDone(true)}
                  disabled={!canContinue}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full py-3 rounded-lg bg-amber-900/40 border border-amber-500/30 text-amber-100 text-sm font-cinzel disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            ) : showFlavors ? (
              <div className="space-y-3">
                {showContext && (
                  <div className="flex min-h-12 items-center gap-2 border-y border-amber-500/20 bg-muted/40 px-3 py-2">
                    {mode === 'sync' && selectedCandidates.slice(0, 2).map(candidate => (
                      <span key={candidate.userId} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-muted text-xs text-muted-foreground">
                        {candidate.avatarUrl
                          ? <img src={candidate.avatarUrl} alt="" className="h-full w-full object-cover" />
                          : (candidate.name.charAt(0).toUpperCase() || '?')}
                      </span>
                    ))}
                    <span className="min-w-0 truncate text-xs font-cinzel text-amber-200">{contextLabel}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                {RP_FLAVORS.map((f: RpFlavor) => (
                  <button
                    key={f.id}
                    onClick={() => generate(f.id, mode, targetIds)}
                    style={{ touchAction: 'manipulation' }}
                    className={`flex flex-col items-center justify-start text-center gap-1 rounded-xl border px-2 py-3 min-h-[104px] active:scale-[0.97] transition-transform ${f.accent}`}
                  >
                    <span className="text-xl leading-none">{f.emoji}</span>
                    <span className={`text-[11px] font-cinzel leading-tight ${f.titleColor}`}>
                      {f.law}
                      <br />
                      {f.moral}
                    </span>
                    <span className="text-[9px] text-white/40 leading-tight">{f.blurb}</span>
                  </button>
                ))}
                </div>
              </div>
            ) : (
              <>
                {showContext && (
                  <div className="flex min-h-12 items-center gap-2 border-y border-amber-500/20 bg-muted/40 px-3 py-2">
                    {mode === 'sync' && selectedCandidates.slice(0, 2).map(candidate => (
                      <span key={candidate.userId} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-amber-500/30 bg-muted text-xs text-muted-foreground">
                        {candidate.avatarUrl
                          ? <img src={candidate.avatarUrl} alt="" className="h-full w-full object-cover" />
                          : (candidate.name.charAt(0).toUpperCase() || '?')}
                      </span>
                    ))}
                    <span className="min-w-0 truncate text-xs font-cinzel text-amber-200">{contextLabel}</span>
                  </div>
                )}
                {loading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-amber-300/60">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs">Reading the scene...</span>
                  </div>
                )}

                {error && !loading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <p className="text-sm text-red-300/80 text-center">{error}</p>
                    <button
                      onClick={() => flavorId && generate(flavorId, mode || 'solo', targetIds)}
                      className="text-xs text-amber-300 underline"
                      style={{ touchAction: 'manipulation' }}
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!loading && !error && pills.map((pill) => (
                  <div
                    key={pill.id}
                    className="rounded-xl border border-amber-900/30 bg-amber-950/20 overflow-hidden"
                  >
                    <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                      <span className="text-lg leading-none mt-0.5">{pill.emoji}</span>
                      <div className="flex-1 min-w-0">
                        {pill.label && (
                          <span className="mb-2 inline-flex rounded border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200/90">
                            {pill.label}
                          </span>
                        )}
                        <p className="text-sm text-white/85 whitespace-pre-wrap break-words leading-relaxed">
                          {pill.prompt}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => choose(pill.prompt)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-amber-900/30 hover:bg-amber-900/50 border-t border-amber-900/30 text-amber-200 text-xs font-semibold transition-colors"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Use this
                    </button>
                  </div>
                ))}

                {!loading && !error && pills.length === 0 && (
                  <div className="flex items-center justify-center py-16">
                    <p className="text-xs text-white/40">No suggestions available.</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="px-4 py-2 border-t border-amber-900/30 bg-background">
            <p className="text-[10px] text-white/40 text-center">
              Choosing a suggestion drops it into your input — you can still edit before you ready up.
            </p>
          </div>
        </div>
        </div>,
        document.body,
      )}
    </>
  );
}
