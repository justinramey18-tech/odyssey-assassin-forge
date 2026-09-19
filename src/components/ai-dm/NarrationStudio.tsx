import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getNarrationAudio } from '@/lib/audioFocus';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  Loader2,
  Mic,
  Pause,
  Play,
  ListMusic,
  RotateCcw,
  Scissors,
  Trash2,
  Undo2,
  Users,
  Merge,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  splitDMResponseParts,
  splitStorySegments,
  segmentKey,
  stripMarkdownForTTS,
  loadVoiceCast,
  subscribeVoiceCast,
  loadSpeechifyVoiceId,
  loadSpeechifyDMVoiceId,
  loadNarrationOverrides,
  addNarrationOverride,
  removeNarrationOverride,
  setNarrationOverrides,
  voiceForSpeaker,
  isSelfRecordedVoice,
  loadStudioState,
  saveStudioState,
  loadDisplacedVoices,
  loadNarrationSpeed,
  type NarrationSegment,
  type NarrationOverride,
  type NarrationStudioState,
  type VoiceCastEntry,
} from '@/lib/tts-utils';
import { narrationKey, type MessageAudioRow, type NarrationPart, type RecordedClipResult } from '@/hooks/use-message-narration';
import { PartyDMAudioRecorder } from './PartyDMAudioRecorder';
import { cn } from '@/lib/utils';

/** Letters-and-digits key, immune to markdown, punctuation and smart quotes. */
const loose = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Splits a piece into sentence-sized chunks so a split point can be picked. */
function splitSentences(text: string): string[] {
  const plain = stripMarkdownForTTS(text).trim();
  const matches = plain.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*\s*|$)/g);
  const list = matches ? matches.map((s) => s.trim()).filter(Boolean) : [plain];
  return list.length > 0 ? list : [plain];
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

interface StudioRow {
  part: string;
  kind: 'table' | 'segment';
  seg?: NarrationSegment;
  displayText: string;
  voiceLabel: string;
  /** Cast voice this recording is covering, if any. */
  covering?: string | null;
  canRevert?: boolean;
  audio?: MessageAudioRow;
}

/** What one undo step restores. */
interface Snapshot {
  overrides: NarrationOverride[];
  studio: NarrationStudioState;
  deleted: Array<{ part: string; blob: Blob; voiceId: string }>;
}

interface NarrationStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  content: string;
  narrationMap: Record<string, MessageAudioRow>;
  generatingPart?: NarrationPart | null;
  playingPart?: NarrationPart | null;
  speakingName?: string | null;
  /** Host/co-host: everything. Others: listen, speeds, record their own voice. */
  canGenerate: boolean;
  onNarrateTable: () => void;
  onPlay: (part: NarrationPart, rate?: number) => void;
  onPlayAll: () => void;
  onDeletePart?: (part: NarrationPart) => void;
  onDeleteAll?: () => void;
  onVoiceSegment?: (passage: string, voiceId: string, label?: string) => Promise<void>;
  onRecordSegment?: (passage: string, blob: Blob, hint?: NarrationSegment) => Promise<RecordedClipResult>;
  /** Swaps a self-recorded piece back to the cast voice it covered. */
  onRevertToCastVoice?: (part: NarrationPart) => Promise<void>;
  onShareVoices?: () => void;
  onRestoreClip?: (part: NarrationPart, blob: Blob, voiceId: string) => Promise<void>;
}

/**
 * Full-screen editor for one DM message's audio. This is the ONLY place
 * voices are assigned, pieces are voiced or recorded, and the story is
 * split, merged and reordered. Play all on the message plays whatever draft
 * is built here.
 */
export function NarrationStudio({
  open,
  onOpenChange,
  messageId,
  content,
  narrationMap,
  generatingPart,
  playingPart,
  speakingName,
  canGenerate,
  onNarrateTable,
  onPlay,
  onPlayAll,
  onDeletePart,
  onDeleteAll,
  onVoiceSegment,
  onRecordSegment,
  onRevertToCastVoice,
  onShareVoices,
  onRestoreClip,
}: NarrationStudioProps) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [cast, setCast] = useState<VoiceCastEntry[]>(loadVoiceCast);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [voiceSheetFor, setVoiceSheetFor] = useState<string | 'batch' | null>(null);
  const [assignOnly, setAssignOnly] = useState(false);
  const [splitFor, setSplitFor] = useState<string | null>(null);
  const [recordFor, setRecordFor] = useState<string | null>(null);
  const [savingRecording, setSavingRecording] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<Record<string, MessageAudioRow>>({});
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const historyRef = useRef<Snapshot[]>([]);
  const [, setHistoryTick] = useState(0);

  useEffect(() => subscribeVoiceCast(() => setCast(loadVoiceCast())), []);

  useEffect(() => {
    const onSync = () => bump();
    window.addEventListener('odyssey-narration-overrides', onSync);
    return () => window.removeEventListener('odyssey-narration-overrides', onSync);
  }, [bump]);

  // Fresh message, fresh undo history.
  useEffect(() => {
    if (open) {
      historyRef.current = [];
      setHistoryTick((t) => t + 1);
      setSelected(new Set());
      setVoiceSheetFor(null);
      setSplitFor(null);
      setSavedRecordings({});
    }
  }, [open, messageId]);

  const { tableTalk, story } = useMemo(() => splitDMResponseParts(content || ''), [content]);
  const segments = useMemo(
    () => splitStorySegments(story || content || '', messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [story, content, messageId, version],
  );
  const overrides = useMemo(
    () => loadNarrationOverrides(messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messageId, version],
  );
  const studio = useMemo(
    () => loadStudioState(messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messageId, version],
  );

  const defaultParts = useMemo(() => {
    const parts: string[] = [];
    if (tableTalk.trim()) parts.push('table');
    for (const seg of segments) parts.push(segmentKey(seg));
    return parts;
  }, [tableTalk, segments]);

  /** Stored order, filtered to pieces that still exist, stragglers appended. */
  const orderedParts = useMemo(() => {
    const stored = studio.order || [];
    const kept = stored.filter((p) => defaultParts.includes(p));
    const missing = defaultParts.filter((p) => !kept.includes(p));
    return [...kept, ...missing];
  }, [studio, defaultParts]);

  const overrideLabelFor = useCallback((seg: NarrationSegment): string | null => {
    const want = loose(seg.text);
    const ov = overrides.find((o) => {
      const l = loose(o.text);
      return l === want || l.includes(want) || want.includes(l);
    });
    return ov?.label || null;
  }, [overrides]);

  /** Cast takes that a mic recording is currently covering, by piece. */
  const displaced = useMemo(
    () => loadDisplacedVoices(messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messageId, version],
  );

  const rows = useMemo<StudioRow[]>(() => {
    const byPart = new Map<string, StudioRow>();
    if (tableTalk.trim()) {
      byPart.set('table', {
        part: 'table',
        kind: 'table',
        displayText: stripMarkdownForTTS(tableTalk),
        voiceLabel: 'DM',
        audio: narrationMap[narrationKey(messageId, 'table')],
      });
    }
    for (const seg of segments) {
      const part = segmentKey(seg);
      const recorded = isSelfRecordedVoice(seg.voiceId);
      const cover = recorded ? displaced[part] : undefined;
      byPart.set(part, {
        part,
        kind: 'segment',
        seg,
        displayText: stripMarkdownForTTS(seg.text),
        voiceLabel: recorded
          ? (overrideLabelFor(seg) || 'Recorded')
          : seg.manual
            ? (overrideLabelFor(seg) || 'Picked voice')
            : seg.speaker || 'Narrator',
        covering: cover ? (cover.previousLabel || 'cast voice') : null,
        canRevert: !!cover,
        audio: narrationMap[narrationKey(messageId, part)] || savedRecordings[part],
      });
    }
    return orderedParts.map((p) => byPart.get(p)).filter((r): r is StudioRow => !!r);
  }, [tableTalk, segments, narrationMap, messageId, orderedParts, overrideLabelFor, displaced, savedRecordings]);

  const resolvedVoiceFor = useCallback((seg: NarrationSegment): { voiceId: string; label: string } => {
    if (seg.voiceId && !isSelfRecordedVoice(seg.voiceId)) {
      return { voiceId: seg.voiceId, label: overrideLabelFor(seg) || seg.speaker || 'Picked voice' };
    }
    const castVoice = seg.speaker ? voiceForSpeaker(seg.speaker) : null;
    if (castVoice) return { voiceId: castVoice, label: seg.speaker || 'Cast voice' };
    return { voiceId: loadSpeechifyVoiceId(), label: 'Narrator' };
  }, [overrideLabelFor]);

  const takeSnapshot = useCallback((): Snapshot => ({
    overrides: loadNarrationOverrides(messageId),
    studio: loadStudioState(messageId),
    deleted: [],
  }), [messageId]);

  const pushHistory = useCallback((snap: Snapshot) => {
    historyRef.current = [...historyRef.current.slice(-29), snap];
    setHistoryTick((t) => t + 1);
  }, []);

  const undo = useCallback(async () => {
    const snap = historyRef.current[historyRef.current.length - 1];
    if (!snap) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryTick((t) => t + 1);
    setNarrationOverrides(messageId, snap.overrides);
    saveStudioState(messageId, snap.studio);
    for (const clip of snap.deleted) {
      try {
        await onRestoreClip?.(clip.part, clip.blob, clip.voiceId);
      } catch (error) {
        console.warn('[NarrationStudio] could not restore clip:', error);
      }
    }
    onShareVoices?.();
    bump();
    toast.success('Undone');
  }, [messageId, onRestoreClip, onShareVoices, bump]);

  const saveOrder = useCallback((parts: string[]) => {
    const current = loadStudioState(messageId);
    const isDefault = parts.length === defaultParts.length && parts.every((p, i) => p === defaultParts[i]);
    saveStudioState(messageId, { ...current, order: isDefault ? undefined : parts });
    bump();
  }, [messageId, defaultParts, bump]);

  /** Replaces old parts with new ones in the stored order, in place. */
  const replaceInOrder = useCallback((oldParts: string[], newParts: string[]) => {
    const base = [...orderedParts];
    const idx = base.findIndex((p) => oldParts.includes(p));
    const without = base.filter((p) => !oldParts.includes(p));
    const at = idx === -1 ? without.length : Math.min(
      without.length,
      base.slice(0, idx).filter((p) => !oldParts.includes(p)).length,
    );
    without.splice(at, 0, ...newParts);
    saveOrder(without);
  }, [orderedParts, saveOrder]);

  const move = useCallback((part: string, dir: -1 | 1) => {
    if (!canGenerate) return;
    pushHistory(takeSnapshot());
    const parts = [...orderedParts];
    const i = parts.indexOf(part);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= parts.length) return;
    [parts[i], parts[j]] = [parts[j], parts[i]];
    saveOrder(parts);
  }, [canGenerate, orderedParts, pushHistory, takeSnapshot, saveOrder]);

  const setRate = useCallback((part: string, rate: number) => {
    const current = loadStudioState(messageId);
    const rates = { ...(current.rates || {}) };
    if (rate === 1) delete rates[part];
    else rates[part] = rate;
    saveStudioState(messageId, { ...current, rates });
    // Changing the speed of the piece that is playing right now applies instantly.
    // 1x means "no per-piece speed", which plays at the global narration speed.
    if (playingPart === part) {
      const effective = rate === 1 ? loadNarrationSpeed() : rate;
      const audio = getNarrationAudio();
      audio.defaultPlaybackRate = effective;
      audio.playbackRate = effective;
    }
    bump();
  }, [messageId, playingPart, bump]);

  /** Removes any stored override whose text matches this piece. */
  const removeMatchingOverride = useCallback((seg: NarrationSegment) => {
    const want = loose(seg.text);
    for (const ov of loadNarrationOverrides(messageId)) {
      const l = loose(ov.text);
      if (l === want || l.includes(want) || want.includes(l)) {
        removeNarrationOverride(messageId, ov.text);
      }
    }
  }, [messageId]);

  const voicePiece = useCallback(async (seg: NarrationSegment, voiceId: string, label: string) => {
    pushHistory(takeSnapshot());
    removeMatchingOverride(seg);
    if (assignOnly) {
      addNarrationOverride(messageId, { text: seg.text.trim(), voiceId, label });
      onShareVoices?.();
      bump();
      toast.success(`Assigned to ${label}`, { description: 'It will be voiced on the next narration run.' });
      return;
    }
    if (!onVoiceSegment) return;
    try {
      await onVoiceSegment(seg.text.trim(), voiceId, label);
    } finally {
      onShareVoices?.();
      bump();
    }
  }, [assignOnly, messageId, onShareVoices, onVoiceSegment, pushHistory, takeSnapshot, removeMatchingOverride, bump]);

  const voiceBatch = useCallback(async (voiceId: string, label: string) => {
    if (!onVoiceSegment && !assignOnly) return;
    const targets = rows.filter((r) => r.kind === 'segment' && r.seg && selected.has(r.part) && !isSelfRecordedVoice(r.seg.voiceId));
    if (targets.length === 0) return;
    pushHistory(takeSnapshot());
    setBatchProgress({ done: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        const seg = targets[i].seg!;
        removeMatchingOverride(seg);
        if (assignOnly) {
          addNarrationOverride(messageId, { text: seg.text.trim(), voiceId, label });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await onVoiceSegment!(seg.text.trim(), voiceId, label);
        }
        setBatchProgress({ done: i + 1, total: targets.length });
      }
      onShareVoices?.();
      setSelected(new Set());
      toast.success(assignOnly ? `Assigned ${targets.length} pieces to ${label}` : `Voiced ${targets.length} pieces as ${label}`);
    } finally {
      setBatchProgress(null);
      bump();
    }
  }, [assignOnly, messageId, onVoiceSegment, onShareVoices, rows, selected, pushHistory, takeSnapshot, removeMatchingOverride, bump]);

  const splitPiece = useCallback((row: StudioRow, beforeIndex: number) => {
    if (!row.seg) return;
    const seg = row.seg;
    const chunks = splitSentences(seg.text);
    if (beforeIndex < 1 || beforeIndex >= chunks.length) return;
    pushHistory(takeSnapshot());
    const oldPart = row.part;
    const voice = resolvedVoiceFor(seg);
    const pieceA = chunks.slice(0, beforeIndex).join(' ');
    const pieceB = chunks.slice(beforeIndex).join(' ');
    removeMatchingOverride(seg);
    addNarrationOverride(messageId, { text: pieceA, voiceId: voice.voiceId, label: voice.label });
    addNarrationOverride(messageId, { text: pieceB, voiceId: voice.voiceId, label: voice.label });

    // Find the keys the two new pieces now produce, and keep them in place.
    const next = splitStorySegments(story || content || '', messageId);
    const la = loose(pieceA);
    const lb = loose(pieceB);
    const keyA = next.find((s) => loose(s.text) === la || loose(s.text).includes(la));
    const keyB = next.find((s) => s !== keyA && (loose(s.text) === lb || loose(s.text).includes(lb)));
    replaceInOrder([oldPart], [keyA ? segmentKey(keyA) : oldPart, keyB ? segmentKey(keyB) : `${oldPart}-b`]);
    setSplitFor(null);
    onShareVoices?.();
    bump();
    toast.success('Piece split in two');
  }, [content, story, messageId, pushHistory, takeSnapshot, resolvedVoiceFor, removeMatchingOverride, replaceInOrder, onShareVoices, bump]);

  const mergeWithNext = useCallback((row: StudioRow) => {
    const i = rows.findIndex((r) => r.part === row.part);
    const next = rows[i + 1];
    if (!row.seg || !next?.seg) return;
    pushHistory(takeSnapshot());
    const partA = row.part;
    const partB = next.part;
    const anchorLoose = loose(row.displayText).slice(0, 24);
    removeMatchingOverride(row.seg);
    removeMatchingOverride(next.seg);
    onShareVoices?.();

    // The pieces fall back to natural paragraph splitting. Find what now
    // holds the first piece's words and keep it where the pair used to sit.
    const after = splitStorySegments(story || content || '', messageId);
    const merged = after.find((s) => loose(stripMarkdownForTTS(s.text)).startsWith(anchorLoose));
    replaceInOrder([partA, partB], merged ? [segmentKey(merged)] : []);
    bump();
    toast.success('Pieces merged back together');
  }, [rows, story, content, pushHistory, takeSnapshot, removeMatchingOverride, replaceInOrder, onShareVoices, bump]);

  const deleteAudio = useCallback(async (row: StudioRow) => {
    if (!row.audio || !onDeletePart) return;
    const snap = takeSnapshot();
    try {
      const res = await fetch(row.audio.audio_url);
      if (res.ok) snap.deleted.push({ part: row.audio.part, blob: await res.blob(), voiceId: row.audio.voice_id || '' });
    } catch { /* undo simply cannot restore this one */ }
    pushHistory(snap);
    const deletedPart = row.audio.part;
    onDeletePart(deletedPart);
    // Forget the local copy too, or the deleted recording keeps showing.
    setSavedRecordings((current) => {
      if (!(deletedPart in current) && !(row.part in current)) return current;
      const next = { ...current };
      delete next[deletedPart];
      delete next[row.part];
      return next;
    });
    bump();
  }, [onDeletePart, pushHistory, takeSnapshot, bump]);

  const resetOrder = useCallback(() => {
    pushHistory(takeSnapshot());
    const current = loadStudioState(messageId);
    saveStudioState(messageId, { ...current, order: undefined });
    bump();
    toast.success('Back to story order');
  }, [messageId, pushHistory, takeSnapshot, bump]);

  if (!open) return null;

  const canRecord = !!onRecordSegment;
  const hasCustomOrder = !!studio.order && studio.order.length > 0;
  const isCasting = generatingPart === 'cast';
  const anyGenerating = !!generatingPart;

  const voiceChoices: Array<{ voiceId: string; label: string }> = [
    ...cast.map((entry) => ({ voiceId: entry.voiceId, label: entry.name })),
    { voiceId: loadSpeechifyVoiceId(), label: 'Narrator' },
    { voiceId: loadSpeechifyDMVoiceId(), label: 'DM voice' },
  ];

  const sheetRow = voiceSheetFor && voiceSheetFor !== 'batch'
    ? rows.find((r) => r.part === voiceSheetFor)
    : null;

  const studioUi = (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border/40">
        <button
          onClick={() => onOpenChange(false)}
          style={{ touchAction: 'manipulation' }}
          className="p-2 -ml-2 rounded-full text-muted-foreground hover:text-foreground"
          title="Back to the story"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-cinzel text-sm text-foreground">Narration Studio</p>
          <p className="text-[10px] text-muted-foreground">Shape how this message sounds, piece by piece</p>
        </div>
        <button
          onClick={() => void undo()}
          disabled={historyRef.current.length === 0}
          style={{ touchAction: 'manipulation' }}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
          title="Undo the last change"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        {canGenerate && hasCustomOrder && (
          <button
            onClick={resetOrder}
            style={{ touchAction: 'manipulation' }}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground"
            title="Back to story order"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {canGenerate && onDeleteAll && (
          <button
            onClick={() => { setSavedRecordings({}); onDeleteAll?.(); }}
            style={{ touchAction: 'manipulation' }}
            className="p-2 rounded-full text-muted-foreground hover:text-destructive"
            title="Delete every clip for this message"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {batchProgress && (
        <div className="px-4 py-2 text-[11px] text-violet-200/80 bg-violet-950/40 border-b border-violet-500/20 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Voicing {batchProgress.done}/{batchProgress.total}…
        </div>
      )}

      {/* Piece list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {rows.map((row, i) => {
          const isPlaying = playingPart === row.part;
          const isGenerating = generatingPart === row.part;
          const rate = row.part ? studio.rates?.[row.part] : undefined;
          const checked = selected.has(row.part);
          const splitting = splitFor === row.part;
          const chunks = splitting && row.seg ? splitSentences(row.seg.text) : [];

          return (
            <div
              key={row.part}
              className={cn(
                'rounded-xl border p-3 space-y-2',
                row.kind === 'table' ? 'border-amber-500/25 bg-amber-950/15' : 'border-border/40 bg-card/40',
                checked && 'border-violet-500/50',
                isPlaying && 'border-emerald-400/70 bg-emerald-950/30 ring-1 ring-emerald-400/30',
              )}
            >
              <div className="flex items-start gap-2">
                {canGenerate && row.kind === 'segment' && (
                  <button
                    onClick={() => setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.part)) next.delete(row.part);
                      else next.add(row.part);
                      return next;
                    })}
                    style={{ touchAction: 'manipulation' }}
                    className={cn(
                      'mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0',
                      checked ? 'border-violet-400 bg-violet-600/40 text-violet-100' : 'border-border/60 text-transparent',
                    )}
                    title="Include in a batch action"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      'text-[10px] font-cinzel uppercase tracking-wider',
                      row.kind === 'table' ? 'text-amber-300/80' : 'text-sky-300/80',
                    )}>
                      {row.kind === 'table' ? 'DM aside' : row.voiceLabel}
                    </span>
                    {row.covering && (
                      <span className="text-[9px] text-rose-200/70">covering {row.covering}</span>
                    )}
                    {row.audio ? (
                      <span className="text-[9px] text-emerald-300/70">
                        has audio{row.audio.created_by_name ? ` · ${row.audio.created_by_name}` : ''}
                      </span>
                    ) : (
                      <span className="text-[9px] text-muted-foreground/60">silent</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-1">{row.displayText}</p>
                </div>

                {canGenerate && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => move(row.part, -1)}
                      disabled={i === 0}
                      style={{ touchAction: 'manipulation' }}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Play earlier"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => move(row.part, 1)}
                      disabled={i === rows.length - 1}
                      style={{ touchAction: 'manipulation' }}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground disabled:opacity-20"
                      title="Play later"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => row.audio && onPlay(row.audio.part, rate)}
                  disabled={!row.audio}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border transition-colors',
                    'border-emerald-500/30 bg-emerald-900/20 text-emerald-200/85 hover:bg-emerald-900/40',
                    !row.audio && 'opacity-40',
                  )}
                  title={row.audio ? 'Hear just this piece' : 'No audio for this piece yet'}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  {isPlaying ? 'Stop' : 'Listen'}
                </button>

                {row.kind === 'table' && canGenerate && (
                  <button
                    onClick={onNarrateTable}
                    disabled={anyGenerating}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-amber-500/30 bg-amber-900/20 text-amber-200/85 hover:bg-amber-900/40 disabled:opacity-50"
                    title={row.audio ? 'Re-voice the DM aside' : 'Voice the DM aside'}
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                    {row.audio ? 'Re-voice' : 'Voice it'}
                  </button>
                )}

                {row.kind === 'segment' && canGenerate && (
                  <button
                    onClick={() => { setVoiceSheetFor(row.part); setAssignOnly(false); }}
                    disabled={isCasting || !!batchProgress}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-violet-500/30 bg-violet-900/20 text-violet-200/85 hover:bg-violet-900/40 disabled:opacity-50"
                    title="Pick the voice for this piece"
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                    Voice
                  </button>
                )}

                {row.kind === 'segment' && canRecord && (
                  <button
                    onClick={() => setRecordFor(row.part)}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-rose-500/30 bg-rose-900/20 text-rose-200/85 hover:bg-rose-900/40"
                    title="Record this piece in your own voice"
                  >
                    <Mic className="w-3 h-3" />
                    {row.canRevert || isSelfRecordedVoice(row.seg?.voiceId) ? 'Re-record' : 'Record'}
                  </button>
                )}

                {row.kind === 'segment' && row.canRevert && onRevertToCastVoice && (
                  <button
                    onClick={() => { void onRevertToCastVoice(row.part).then(bump); }}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-emerald-500/30 bg-emerald-900/20 text-emerald-200/85 hover:bg-emerald-900/40"
                    title={`Play ${row.covering} here again - your recording is kept`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Revert to {row.covering}
                  </button>
                )}

                {row.kind === 'segment' && canGenerate && (
                  <>
                    <button
                      onClick={() => setSplitFor(splitting ? null : row.part)}
                      style={{ touchAction: 'manipulation' }}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border',
                        splitting
                          ? 'border-sky-400/60 bg-sky-900/40 text-sky-100'
                          : 'border-sky-500/30 bg-sky-900/20 text-sky-200/85 hover:bg-sky-900/40',
                      )}
                      title="Split this piece in two"
                    >
                      <Scissors className="w-3 h-3" />
                      Split
                    </button>
                    <button
                      onClick={() => mergeWithNext(row)}
                      disabled={i >= rows.length - 1 || rows[i + 1]?.kind !== 'segment'}
                      style={{ touchAction: 'manipulation' }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-border/40 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Merge with the piece below"
                    >
                      <Merge className="w-3 h-3" />
                      Merge
                    </button>
                  </>
                )}

                {row.audio && canGenerate && onDeletePart && (
                  <button
                    onClick={() => void deleteAudio(row)}
                    style={{ touchAction: 'manipulation' }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] border border-border/40 text-muted-foreground hover:text-destructive"
                    title="Delete this piece's audio (undoable)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                <select
                  value={rate ?? 1}
                  onChange={(e) => setRate(row.part, Number(e.target.value))}
                  className="ml-auto bg-muted/20 border border-border/40 rounded-full px-2 py-1.5 text-[11px] text-foreground"
                  title="Play speed for this piece (this device only)"
                >
                  {SPEED_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}x</option>
                  ))}
                </select>
              </div>

              {/* Split point picker */}
              {splitting && chunks.length > 1 && (
                <div className="rounded-lg border border-sky-500/25 bg-sky-950/25 p-2 space-y-1">
                  <p className="text-[10px] text-sky-200/70">Split before…</p>
                  {chunks.slice(1).map((chunk, ci) => (
                    <button
                      key={ci}
                      onClick={() => splitPiece(row, ci + 1)}
                      style={{ touchAction: 'manipulation' }}
                      className="block w-full text-left px-2 py-1.5 rounded text-[11px] text-sky-100/90 hover:bg-sky-900/40"
                    >
                      ✂ “{chunk.length > 70 ? `${chunk.slice(0, 70)}…` : chunk}”
                    </button>
                  ))}
                  {chunks.length <= 1 && null}
                </div>
              )}
              {splitting && chunks.length <= 1 && (
                <p className="text-[10px] text-muted-foreground/70 px-1">
                  This piece is a single sentence — it cannot be split further.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Batch bar */}
      {canGenerate && selected.size > 0 && (
        <div className="px-3 py-2 border-t border-violet-500/20 bg-violet-950/30 flex items-center gap-2">
          <span className="text-[11px] text-violet-200/85 flex-1">{selected.size} selected</span>
          <button
            onClick={() => { setVoiceSheetFor('batch'); setAssignOnly(false); }}
            disabled={!!batchProgress}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] border border-violet-500/40 bg-violet-900/40 text-violet-100 disabled:opacity-50"
          >
            <Users className="w-3 h-3" /> Voice as…
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ touchAction: 'manipulation' }}
            className="px-2.5 py-1.5 rounded-full text-[11px] border border-border/40 text-muted-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Bottom draft bar */}
      <div className="px-3 py-3 border-t border-border/40 flex items-center gap-2">
        <button
          onClick={onPlayAll}
          style={{ touchAction: 'manipulation' }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm border border-emerald-500/40 bg-emerald-900/30 text-emerald-100 hover:bg-emerald-900/50"
          title="Play the whole message in your custom order"
        >
          {playingPart ? <Pause className="w-4 h-4" /> : <ListMusic className="w-4 h-4" />}
          {playingPart ? (speakingName ? `Stop · ${speakingName}` : 'Stop') : 'Play the draft'}
        </button>
      </div>

      {/* Voice sheet */}
      {voiceSheetFor && (
        <div className="absolute inset-0 z-10 flex items-end bg-black/60" onClick={() => setVoiceSheetFor(null)}>
          <div
            className="w-full rounded-t-2xl border-t border-border/50 bg-background p-4 space-y-2 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-cinzel text-sm">
              {voiceSheetFor === 'batch' ? `Voice ${selected.size} pieces as…` : 'Voice this piece as…'}
            </p>
            {sheetRow && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">“{sheetRow.displayText}”</p>
            )}
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground py-1">
              <input
                type="checkbox"
                checked={assignOnly}
                onChange={(e) => setAssignOnly(e.target.checked)}
                className="w-4 h-4"
              />
              Assign only — don't spend a Speechify call yet
            </label>
            <div className="flex flex-wrap gap-1.5">
              {voiceChoices.map((choice) => (
                <button
                  key={`${choice.label}-${choice.voiceId}`}
                  onClick={() => {
                    const target = voiceSheetFor;
                    setVoiceSheetFor(null);
                    if (target === 'batch') void voiceBatch(choice.voiceId, choice.label);
                    else if (sheetRow?.seg) void voicePiece(sheetRow.seg, choice.voiceId, choice.label);
                  }}
                  style={{ touchAction: 'manipulation' }}
                  className="px-3 py-2 rounded-full text-[12px] border border-violet-500/30 bg-violet-900/20 text-violet-200/85"
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setVoiceSheetFor(null)}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-2 rounded-full text-[12px] border border-border/40 text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recorder */}
      {canRecord && (
        <PartyDMAudioRecorder
          open={!!recordFor}
          onOpenChange={(o) => { if (!o) setRecordFor(null); }}
          isUploading={savingRecording}
          scriptText={rows.find((r) => r.part === recordFor)?.displayText || ''}
          onSubmit={async (file) => {
            const row = rows.find((r) => r.part === recordFor);
            if (!row?.seg || !onRecordSegment) return;
            setSavingRecording(true);
            pushHistory(takeSnapshot());
            try {
              // Hand the exact piece over: no guessing from the words.
              const saved = await onRecordSegment(row.seg.text.trim(), file, row.seg);
              setSavedRecordings((current) => ({ ...current, [saved.part]: saved.row }));
              setRecordFor(null);
              bump();
              toast.success('Recording saved for that piece');
            } catch (error) {
              // Keep the recorder open so the take can be sent again.
              console.error('[NarrationStudio] saving recording failed:', error);
            } finally {
              setSavingRecording(false);
            }
          }}
        />
      )}
    </div>
  );
}
