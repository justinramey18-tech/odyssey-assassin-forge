import { useState, useCallback, useEffect } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import offeringJointAsset from '@/assets/offering-joint.jpg.asset.json';
import moveBgAsset from '@/assets/move-flow/move-bg.jpg.asset.json';
import moveHeaderPlaqueAsset from '@/assets/move-flow/move-header-plaque.png.asset.json';
import moveCardSoloAsset from '@/assets/move-flow/move-card-solo.jpg.asset.json';
import moveCardSyncAsset from '@/assets/move-flow/move-card-sync.jpg.asset.json';
import moveBtnEveryoneAsset from '@/assets/move-flow/move-btn-everyone.png.asset.json';
import moveBtnContinueAsset from '@/assets/move-flow/move-btn-continue.png.asset.json';
import moveBtnRegenerateAsset from '@/assets/move-flow/move-btn-regenerate.png.asset.json';
import moveBtnBackAsset from '@/assets/move-flow/move-btn-back.png.asset.json';
import moveCheckAsset from '@/assets/move-flow/move-check.png.asset.json';
import moveStanceAgainstMildAsset from '@/assets/move-flow/move-stance-against-mild.png.asset.json';
import moveStanceAgainstFullAsset from '@/assets/move-flow/move-stance-against-full.png.asset.json';
import moveStanceWithMildAsset from '@/assets/move-flow/move-stance-with-mild.png.asset.json';
import moveStanceWithFullAsset from '@/assets/move-flow/move-stance-with-full.png.asset.json';
import moveAlignLawfulGoodAsset from '@/assets/move-flow/move-align-lawful-good.png.asset.json';
import moveAlignNeutralGoodAsset from '@/assets/move-flow/move-align-neutral-good.png.asset.json';
import moveAlignChaoticGoodAsset from '@/assets/move-flow/move-align-chaotic-good.png.asset.json';
import moveAlignLawfulNeutralAsset from '@/assets/move-flow/move-align-lawful-neutral.png.asset.json';
import moveAlignTrueNeutralAsset from '@/assets/move-flow/move-align-true-neutral.png.asset.json';
import moveAlignChaoticNeutralAsset from '@/assets/move-flow/move-align-chaotic-neutral.png.asset.json';
import moveAlignLawfulEvilAsset from '@/assets/move-flow/move-align-lawful-evil.png.asset.json';
import moveAlignNeutralEvilAsset from '@/assets/move-flow/move-align-neutral-evil.png.asset.json';
import moveAlignChaoticEvilAsset from '@/assets/move-flow/move-align-chaotic-evil.png.asset.json';
import bagClose from '@/assets/bag-stats/bag-close.png';
import bagBtnUse from '@/assets/bag-stats/bag-btn-use.png';
import bagPanelFrame from '@/assets/bag-stats/bag-panel-frame.png';
import { RP_FLAVORS, getRpFlavor, type RpFlavor } from '@/lib/rpFlavors';

const moveBg = moveBgAsset.url;
const moveHeaderPlaque = moveHeaderPlaqueAsset.url;
const moveCardSolo = moveCardSoloAsset.url;
const moveCardSync = moveCardSyncAsset.url;
const moveBtnEveryone = moveBtnEveryoneAsset.url;
const moveBtnContinue = moveBtnContinueAsset.url;
const moveBtnRegenerate = moveBtnRegenerateAsset.url;
const moveBtnBack = moveBtnBackAsset.url;
const moveCheck = moveCheckAsset.url;
const moveStanceAgainstMild = moveStanceAgainstMildAsset.url;
const moveStanceAgainstFull = moveStanceAgainstFullAsset.url;
const moveStanceWithMild = moveStanceWithMildAsset.url;
const moveStanceWithFull = moveStanceWithFullAsset.url;

const ALIGN_EMBLEMS: Record<string, string> = {
  'lawful-good': moveAlignLawfulGoodAsset.url,
  'neutral-good': moveAlignNeutralGoodAsset.url,
  'chaotic-good': moveAlignChaoticGoodAsset.url,
  'lawful-neutral': moveAlignLawfulNeutralAsset.url,
  'true-neutral': moveAlignTrueNeutralAsset.url,
  'chaotic-neutral': moveAlignChaoticNeutralAsset.url,
  'lawful-evil': moveAlignLawfulEvilAsset.url,
  'neutral-evil': moveAlignNeutralEvilAsset.url,
  'chaotic-evil': moveAlignChaoticEvilAsset.url,
};

const PANEL_FRAME_STYLE: React.CSSProperties = {
  borderStyle: 'solid',
  borderWidth: '14px',
  borderImageSource: `url(${bagPanelFrame})`,
  borderImageSlice: '90 fill',
  borderImageWidth: '36px',
  borderImageRepeat: 'stretch',
};

function stanceIcon(label?: string): string | null {
  const normalized = label?.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized === 'against · mild') return moveStanceAgainstMild;
  if (normalized === 'against · full send') return moveStanceAgainstFull;
  if (normalized === 'with · mild') return moveStanceWithMild;
  if (normalized === 'with · full send') return moveStanceWithFull;
  return null;
}

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
        <div className="relative overflow-hidden bg-[#0b0b0e] flex h-full w-full max-w-lg flex-col">
          <img src={moveBg} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/65 to-black/45" />

          <div className="relative z-10 flex items-center gap-1 px-2 pt-[max(0.375rem,env(safe-area-inset-top))] min-h-[52px]">
            {mode !== null && !loading && (
              <button
                onClick={back}
                className="min-h-[48px] flex items-center active:scale-95 transition-transform"
                style={{ touchAction: 'manipulation' }}
                aria-label="Back"
              >
                <img src={moveBtnBack} alt="" draggable={false} className="h-10 w-auto" />
              </button>
            )}
            {!loading && flavorId && (
              <button
                onClick={() => generate(flavorId, mode || 'solo', targetIds)}
                className="min-h-[48px] flex items-center active:scale-95 transition-transform"
                style={{ touchAction: 'manipulation' }}
                aria-label="Regenerate"
              >
                <img src={moveBtnRegenerate} alt="" draggable={false} className="h-10 w-auto" />
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={close}
              className="min-w-[48px] min-h-[48px] flex items-center justify-center active:scale-95 transition-transform"
              style={{ touchAction: 'manipulation' }}
              aria-label="Close"
            >
              <img src={bagClose} alt="" draggable={false} className="h-11 w-11" />
            </button>
          </div>

          <div className="relative z-10 mx-auto aspect-[900/320] w-[94%] max-w-[440px]">
            <img src={moveHeaderPlaque} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 h-full w-full select-none" />
            <h2 className="absolute flex items-center justify-center gap-1.5 text-center font-cinzel text-[13px] leading-tight tracking-[0.06em] text-amber-100 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]" style={{ left: '14%', right: '14%', top: '38%', bottom: '24%' }}>
              {flavorId && ALIGN_EMBLEMS[flavorId] && <img src={ALIGN_EMBLEMS[flavorId]} alt="" className="h-6 w-6 shrink-0" />}
              <span className="truncate">{headerTitle}</span>
            </h2>
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {mode === null ? (
              <div className="space-y-3">
                <button
                  onClick={() => pickMode('solo')}
                  style={{ touchAction: 'manipulation' }}
                  className="block w-full max-w-[300px] mx-auto active:scale-[0.98] transition-transform"
                  aria-label="Do my own thing"
                >
                  <img src={moveCardSolo} alt="" draggable={false} className="block w-full rounded-xl shadow-[0_4px_18px_rgba(0,0,0,0.6)]" />
                  <span className="mt-1.5 block text-center text-[11px] leading-snug text-white/60">Moves built purely on the story so far. Ignores what the others are typing.</span>
                </button>
                <button
                  onClick={() => pickMode('sync')}
                  disabled={!hasCandidates}
                  style={{ touchAction: 'manipulation' }}
                  className="block w-full max-w-[300px] mx-auto active:scale-[0.98] transition-transform disabled:opacity-45 disabled:grayscale disabled:active:scale-100"
                  aria-label="Synergize with others"
                >
                  <img src={moveCardSync} alt="" draggable={false} className="block w-full rounded-xl shadow-[0_4px_18px_rgba(0,0,0,0.6)]" />
                  <span className="mt-1.5 block text-center text-[11px] leading-snug text-white/60">
                    {hasCandidates
                      ? liveTableCandidates.some(candidate => candidate.fromLastRound)
                        ? 'Uses what the others said in the last round so you can build on it — or cut across it.'
                        : 'Reads what the others just said at the table so you can back them up — or cut across them.'
                      : 'Nobody has said anything yet'}
                  </span>
                </button>
              </div>
            ) : showTargets ? (
              <div className="space-y-3">
                <button
                  onClick={() => setTargetIds(liveTableCandidates.map(c => c.userId))}
                  style={{ touchAction: 'manipulation' }}
                  className="block w-[84%] max-w-[340px] mx-auto active:scale-[0.98] transition-transform"
                  aria-label="Everyone who spoke"
                >
                  <img src={moveBtnEveryone} alt="" draggable={false} className="block w-full" />
                </button>
                {liveTableCandidates.map((c) => {
                  const selected = targetIds.includes(c.userId);
                  return (
                    <button
                      key={c.userId}
                      onClick={() => toggleTarget(c.userId)}
                      style={{ ...PANEL_FRAME_STYLE, touchAction: 'manipulation' }}
                      className={`relative w-full flex items-start gap-3 text-left min-h-[104px] active:scale-[0.98] transition-transform ${selected ? 'shadow-[0_0_18px_rgba(251,191,36,0.35)]' : ''}`}
                      aria-pressed={selected}
                    >
                      <span className="w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 border-amber-500/70 bg-black/40 flex items-center justify-center text-base font-semibold text-white/70">
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
                      {selected && <img src={moveCheck} alt="" className="absolute -right-2 -top-2 h-9 w-9" />}
                    </button>
                  );
                })}
                <button
                  onClick={() => setTargetsDone(true)}
                  disabled={!canContinue}
                  style={{ touchAction: 'manipulation' }}
                  className="block w-[84%] max-w-[340px] mx-auto active:scale-[0.98] transition-transform disabled:opacity-40 disabled:grayscale disabled:active:scale-100"
                  aria-label="Continue"
                >
                  <img src={moveBtnContinue} alt="" draggable={false} className="block w-full" />
                </button>
              </div>
            ) : showFlavors ? (
              <div className="space-y-3">
                {showContext && (
                  <div className="relative flex min-h-12 items-center gap-2 px-3 py-2">
                    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                    {mode === 'sync' && selectedCandidates.slice(0, 2).map(candidate => (
                      <span key={candidate.userId} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/70 bg-muted text-xs text-muted-foreground">
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
                    className="group flex flex-col items-center justify-start text-center gap-1 rounded-xl px-1.5 py-2 min-h-[104px] hover:bg-white/[0.04] active:scale-[0.95] transition-transform"
                  >
                    {ALIGN_EMBLEMS[f.id]
                      ? <img src={ALIGN_EMBLEMS[f.id]} alt="" draggable={false} className="h-[62px] w-[62px] transition-[filter] duration-150 group-active:brightness-125 group-active:drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
                      : <span className="text-xl leading-none">{f.emoji}</span>}
                    <span className={`text-[11px] font-cinzel leading-tight ${f.titleColor}`}>
                      {f.law}
                      <br />
                      {f.moral}
                    </span>
                    <span className="text-[9px] text-white/45 leading-tight">{f.blurb}</span>
                  </button>
                ))}
                </div>
              </div>
            ) : (
              <>
                {showContext && (
                  <div className="relative flex min-h-12 items-center gap-2 px-3 py-2">
                    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                    {mode === 'sync' && selectedCandidates.slice(0, 2).map(candidate => (
                      <span key={candidate.userId} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500/70 bg-muted text-xs text-muted-foreground">
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
                    {flavorId && ALIGN_EMBLEMS[flavorId]
                      ? <img src={ALIGN_EMBLEMS[flavorId]} alt="" className="h-16 w-16 animate-pulse" />
                      : <Loader2 className="w-6 h-6 animate-spin" />}
                    <span className="font-cinzel text-xs text-amber-200/70">Reading the scene...</span>
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
                    className="relative"
                    style={PANEL_FRAME_STYLE}
                  >
                    <div className="px-1 pt-1.5 pb-1 flex items-start gap-2.5">
                      {stanceIcon(pill.label)
                        ? <img src={stanceIcon(pill.label) || ''} alt="" className="h-10 w-10 shrink-0" />
                        : flavorId && ALIGN_EMBLEMS[flavorId]
                          ? <img src={ALIGN_EMBLEMS[flavorId]} alt="" className="h-10 w-10 shrink-0" />
                          : <span className="text-lg leading-none mt-0.5">{pill.emoji}</span>}
                      <div className="flex-1 min-w-0">
                        {pill.label && (
                          <span className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f7e3b5] ${
                            pill.label.toLowerCase().startsWith('against')
                              ? 'bg-gradient-to-b from-[#8b1a1a] to-[#5c0f0f]'
                              : pill.label.toLowerCase().startsWith('with')
                                ? 'bg-gradient-to-b from-teal-700 to-teal-900'
                                : 'bg-gradient-to-b from-amber-700 to-amber-900'
                          } ${pill.label.toLowerCase().endsWith('full send') ? 'shadow-[0_0_8px_rgba(251,146,60,0.7)]' : ''}`}>
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
                      className="mx-auto mt-1.5 flex min-h-[48px] items-center justify-center active:scale-95 transition-transform"
                      style={{ touchAction: 'manipulation' }}
                      aria-label="Use this suggestion"
                    >
                      <img src={bagBtnUse} alt="" draggable={false} className="h-10 w-auto" />
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

          <div className="relative z-10 px-4 py-2 bg-black/55">
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
