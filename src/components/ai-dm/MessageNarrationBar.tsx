import { Download, Highlighter, ListMusic, Loader2, Mic, Pause, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  splitDMResponseParts,
  splitStorySegments,
  segmentKey,
  loadVoiceCast,
  subscribeVoiceCast,
  type VoiceCastEntry,
  loadSpeechifyVoiceId,
  loadSpeechifyDMVoiceId,
  loadNarrationOverrides,
  addNarrationOverride,
  clearNarrationOverrides,
  voiceForSpeaker,
  stripTableTalkTags,
  isSelfRecordedVoice,
} from '@/lib/tts-utils';
import { MessageNarrationButton } from './MessageNarrationButton';
import { PartyDMAudioRecorder } from './PartyDMAudioRecorder';
import { narrationKey, type CastProgress, type MessageAudioRow, type NarrationPart } from '@/hooks/use-message-narration';
import { cn } from '@/lib/utils';

/**
 * Comparison key for matching a DOM text selection against raw message text:
 * lowercase letters and digits only.
 *
 * The screen shows the message AFTER ReactMarkdown has rendered it, so the
 * visible words contain no asterisks, underscores, backticks or link syntax,
 * and quotes/dashes may differ. Reducing both sides to letters and digits makes
 * the comparison survive all of that.
 */
function looseKey(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}


interface MessageNarrationBarProps {
  messageId: string;
  content: string;
  /** Every saved clip for this party, keyed by `${messageId}:${part}`. */
  narrationMap: Record<string, MessageAudioRow>;
  /** Which part is currently generating / playing for this message, if any. */
  generatingPart?: NarrationPart | null;
  playingPart?: NarrationPart | null;
  castProgress?: CastProgress | null;
  speakingName?: string | null;
  canDelete?: boolean;
  /** Host/co-host only. Ignored until the gating step wires it up. */
  canGenerate?: boolean;
  onNarrate: (messageId: string, text: string, part: NarrationPart) => void;
  onNarrateCast: (messageId: string, content: string) => void;
  onPlay: (messageId: string, part: NarrationPart) => void;
  onPlayAll: (messageId: string, content: string) => void;
  onDelete?: (messageId: string, part: NarrationPart) => void;
  onDeleteAll?: (messageId: string) => void;
  /** Saves a mic recording for the highlighted passage. */
  onRecordSegment?: (messageId: string, content: string, passage: string, blob: Blob) => Promise<void>;
  /**
   * Synthesizes ONLY the highlighted passage in the chosen voice.
   * When supplied, picking a voice generates that one clip immediately.
   */
  onVoiceSegment?: (messageId: string, content: string, passage: string, voiceId: string, label?: string) => Promise<void>;
  /** Packages this message's clips into one audio file on the device. */
  onDownloadFile?: (messageId: string, content: string) => void;
  /** True while this message's file is being prepared. */
  isDownloading?: boolean;
  downloadProgress?: { done: number; total: number } | null;

}


/**
 * Speechify controls under a DM response: the DM's table-talk aside, the story
 * narration (auto-split into character voices), a full voice-cast pass, a
 * highlight-a-passage voice picker, and a Play all that runs every clip in
 * story order.
 */
export function MessageNarrationBar({
  messageId,
  content,
  narrationMap,
  generatingPart,
  playingPart,
  castProgress,
  speakingName,
  canDelete,
  canGenerate = false,

  onNarrate,
  onNarrateCast,
  onPlay,
  onPlayAll,
  onDelete,
  onDeleteAll,
  onRecordSegment,
  onVoiceSegment,
  onDownloadFile,
  isDownloading,
  downloadProgress,

}: MessageNarrationBarProps) {
  // Bumped whenever a manual voice override changes, to re-split the story.
  const [overrideVersion, setOverrideVersion] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);
  // Floating "Voice selection" chip anchored under the highlighted passage.
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left: number } | null>(null);


  // Another player's recording can change how this message splits.
  useEffect(() => {
    const onSync = () => setOverrideVersion((v) => v + 1);
    window.addEventListener('odyssey-narration-overrides', onSync);
    return () => window.removeEventListener('odyssey-narration-overrides', onSync);
  }, []);

  // The rendered message strips markdown syntax, [VOICE:...] markers and
  // cinematic comments, so the raw content is NOT what the reader selected.
  // Strip the same tags the display strips, then reduce to a loose key.
  const haystack = useMemo(() => {
    const withoutCinematics = (content || '').replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '');
    return looseKey(stripTableTalkTags(withoutCinematics));
  }, [content]);

  // Watch text selection; only react when the highlighted words belong to THIS message.
  useEffect(() => {
    const check = () => {
      const sel = typeof window !== 'undefined' ? window.getSelection() : null;
      const text = sel?.toString().trim() || '';
      const needle = looseKey(text);

      if (!sel || sel.rangeCount === 0 || text.length < 3 || needle.length < 3) {
        setSelection(null);
        return;
      }

      // The selection must physically live inside THIS message's rendered body.
      // Without this, a common word matches several messages at once and every
      // one of them shows a chip stacked at the same spot.
      const body = typeof document !== 'undefined'
        ? document.querySelector(`[data-odyssey-message="${CSS.escape(messageId)}"]`)
        : null;
      if (body && sel.anchorNode && !body.contains(sel.anchorNode)) {
        setSelection(null);
        return;
      }

      if (!haystack.includes(needle)) {
        setSelection(null);
        return;
      }

      // Anchor to the END of the selection (where the drag handle is) rather
      // than the bounding box of every line it spans.
      const range = sel.getRangeAt(0);
      const rects = Array.from(range.getClientRects());
      const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setSelection(null);
        return;
      }

      // Keep the chip on screen: flip it above the selection when placing it
      // below would push it past the bottom of the viewport.
      const below = rect.bottom + 6;
      const top = below > window.innerHeight - 56 ? Math.max(8, rect.top - 44) : below;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 150));

      setSelection({ text, top, left });
    };

    document.addEventListener('selectionchange', check);
    window.addEventListener('scroll', check, true);
    window.addEventListener('resize', check);
    return () => {
      document.removeEventListener('selectionchange', check);
      window.removeEventListener('scroll', check, true);
      window.removeEventListener('resize', check);
    };
  }, [haystack, messageId]);

  const { tableTalk, story } = useMemo(() => splitDMResponseParts(content || ''), [content]);
  const segments = useMemo(
    () => splitStorySegments(story || content || '', messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [story, content, messageId, overrideVersion],
  );
  const overrides = useMemo(
    () => loadNarrationOverrides(messageId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messageId, overrideVersion],
  );
  // The cast is editable from the Voices tab while this bar stays mounted, so
  // it must be state that re-reads on change - a useMemo keyed on
  // overrideVersion never updated, because adding a character does not touch
  // narration overrides.
  const [cast, setCast] = useState<VoiceCastEntry[]>(loadVoiceCast);

  useEffect(() => subscribeVoiceCast(() => setCast(loadVoiceCast())), []);

  // Belt and braces: re-read the moment the picker opens, so the list is
  // correct even if a save somehow did not broadcast.
  useEffect(() => {
    if (pickerOpen) setCast(loadVoiceCast());
  }, [pickerOpen]);

  const hasTableTalk = tableTalk.trim().length > 0;
  const hasVoicedSegments = segments.some((s) => s.voiceId || (s.speaker && voiceForSpeaker(s.speaker)));

  const tableAudio = narrationMap[narrationKey(messageId, 'table')];
  const storyAudio = narrationMap[narrationKey(messageId, 'story')];
  const segmentClips = segments.filter((s) => !!narrationMap[narrationKey(messageId, segmentKey(s))]).length;

  const storyHasAudio = hasVoicedSegments ? segmentClips > 0 : !!storyAudio;
  // Players who cannot generate may still highlight a passage to record their
  // own voice, so the highlight tools stay available when a recorder exists.
  const canHighlight = canGenerate || !!onRecordSegment;
  const isCasting = generatingPart === 'cast';

  const isPlayingAny = !!playingPart;
  const playAllReady = (segmentClips > 0 && (!hasTableTalk || !!tableAudio))
    || (hasTableTalk && !!tableAudio && !!storyAudio);

  const openPicker = () => {
    const selected = (typeof window !== 'undefined' ? window.getSelection()?.toString() : '')?.trim() || '';
    if (selected.length < 3) {
      toast.info('Highlight a passage first', { description: 'Select the words you want voiced, then tap this again.' });
      return;
    }
    setPendingText(selected);
    setPickerOpen(true);
  };

  const openPickerWith = (text: string, anchor?: { top: number; left: number }) => {
    setPendingText(text);
    setPickerAnchor(anchor ?? null);
    setPickerOpen(true);
    setSelection(null);
    if (typeof window !== 'undefined') window.getSelection()?.removeAllRanges();
  };


  const assignVoice = (voiceId: string, label: string) => {
    const passage = pendingText;
    setPickerOpen(false);
    setPickerAnchor(null);
    setPendingText('');

    if (onVoiceSegment) {
      // Voice ONLY the highlighted words. generateSegment registers the
      // override itself, so it must not be added again here.
      void onVoiceSegment(messageId, content, passage, voiceId, label)
        .finally(() => setOverrideVersion((v) => v + 1));
      return;
    }

    // Fallback when no generator was supplied: assign the voice only.
    addNarrationOverride(messageId, { text: passage, voiceId, label });
    setOverrideVersion((v) => v + 1);
    toast.success(`Passage assigned to ${label}`, { description: 'Tap Narrate story to voice it.' });
  };


  return (
    <div className="mt-1.5 space-y-1.5">
      {selection && !pickerOpen && canHighlight && (
        <div
          className="fixed z-[70]"
          style={{ top: selection.top, left: selection.left }}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openPickerWith(selection.text, { top: selection.top, left: selection.left })}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-[11px] shadow-lg border border-sky-500/40 bg-sky-950/95 text-sky-100 hover:bg-sky-900 transition-colors"
          >
            <Highlighter className="w-3 h-3" />
            Voice selection
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {hasTableTalk && (canGenerate || !!tableAudio) && (
          <MessageNarrationButton
            tone="table"
            generateLabel="Narrate DM"
            playLabel="DM"
            hasAudio={!!tableAudio}
            isGenerating={generatingPart === 'table'}
            isPlaying={playingPart === 'table'}
            voicedByName={tableAudio?.created_by_name}
            canDelete={canDelete}
            onGenerate={() => onNarrate(messageId, tableTalk, 'table')}
            onPlay={() => onPlay(messageId, 'table')}
            onDelete={onDelete ? () => onDelete(messageId, 'table') : undefined}
          />
        )}

        {(canGenerate || storyHasAudio) && (
          <MessageNarrationButton
            tone="story"
            generateLabel={hasTableTalk ? 'Narrate story' : 'Narrate'}
            playLabel={hasTableTalk ? 'Story' : 'Play'}
            hasAudio={storyHasAudio}
            isGenerating={generatingPart === 'story' || (isCasting && hasVoicedSegments)}
            isPlaying={playingPart === 'story'}
            voicedByName={storyAudio?.created_by_name}
            canDelete={canDelete}
            onGenerate={() => onNarrate(messageId, story || content, 'story')}
            onPlay={() => (hasVoicedSegments ? onPlayAll(messageId, content) : onPlay(messageId, 'story'))}
            onDelete={onDelete ? () => onDelete(messageId, 'story') : undefined}
          />
        )}


        {/* Full voice cast: DM aside + one clip per speaker segment */}
        {hasVoicedSegments && (canGenerate || segmentClips > 0) && (
          <button
            onClick={() => (segmentClips > 0 ? onPlayAll(messageId, content) : onNarrateCast(messageId, content))}
            disabled={isCasting}
            style={{ touchAction: 'manipulation' }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] transition-colors',
              'border border-violet-500/30 bg-violet-900/20 text-violet-200/85 hover:bg-violet-900/40',
              isCasting && 'opacity-70',
            )}
            title="Generate each speaker's dialogue in their assigned voice"
          >
            {isCasting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
            {isCasting
              ? `Voicing ${castProgress?.done ?? 0}/${castProgress?.total ?? 0}${castProgress?.speaker ? ` · ${castProgress.speaker}` : ''}`
              : segmentClips > 0 ? 'Play cast' : 'Voice cast'}
          </button>
        )}

        <button
          onClick={openPicker}
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-sky-500/30 bg-sky-900/20 text-sky-200/85 hover:bg-sky-900/40 transition-colors"
          title="Highlight text in this response, then pick the voice that reads it"
        >
          <Highlighter className="w-3 h-3" />
          Voice selection
        </button>

        {playAllReady && (
          <button
            onClick={() => onPlayAll(messageId, content)}
            style={{ touchAction: 'manipulation' }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] transition-colors',
              'border border-emerald-500/30 bg-emerald-900/20 text-emerald-200/85 hover:bg-emerald-900/40',
            )}
            title="Play every clip in story order"
          >
            {isPlayingAny ? <Pause className="w-3 h-3" /> : <ListMusic className="w-3 h-3" />}
            {isPlayingAny ? (speakingName ? `Stop · ${speakingName}` : 'Stop') : 'Play all'}
          </button>
        )}

        {/* Save the finished narration to the phone as one audio file */}
        {onDownloadFile && playAllReady && (
          <button
            onClick={() => !isDownloading && onDownloadFile(messageId, content)}
            disabled={isDownloading}
            style={{ touchAction: 'manipulation' }}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] transition-colors border',
              'border-border/40 bg-muted/10 text-muted-foreground hover:text-foreground disabled:opacity-60',
            )}
            title="Download this narration as an audio file"
          >
            {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            {isDownloading
              ? `Preparing ${downloadProgress?.done ?? 0}/${downloadProgress?.total ?? 0}…`
              : 'Download'}
          </button>
        )}



        {canDelete && onDeleteAll && segmentClips > 0 && !isCasting && (
          <button
            onClick={() => onDeleteAll(messageId)}
            style={{ touchAction: 'manipulation' }}
            className="px-2 py-1.5 rounded-full text-[10px] border border-border/40 text-muted-foreground hover:text-foreground"
            title="Delete every saved clip for this message"
          >
            Clear audio
          </button>
        )}
      </div>

      {canGenerate && overrides.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-sky-300/70">
          <span>
            {overrides.length} hand-picked voice{overrides.length === 1 ? '' : 's'}
            {overrides.some((o) => isSelfRecordedVoice(o.voiceId))
              && ` · ${overrides.filter((o) => isSelfRecordedVoice(o.voiceId)).length} recorded`}
          </span>

          <button
            onClick={() => { clearNarrationOverrides(messageId); setOverrideVersion((v) => v + 1); }}
            style={{ touchAction: 'manipulation' }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground hover:text-foreground"
          >
            <X className="w-2.5 h-2.5" /> Reset
          </button>
        </div>
      )}

      {pickerOpen && (
        <div
          className={cn(
            'rounded-lg border border-sky-500/25 p-2 space-y-1.5',
            pickerAnchor
              ? 'fixed z-[70] w-[min(320px,calc(100vw-16px))] max-h-[50vh] overflow-y-auto bg-sky-950/95 shadow-xl'
              : 'bg-sky-950/25',
          )}
          style={pickerAnchor ? { top: pickerAnchor.top, left: pickerAnchor.left } : undefined}
        >
          <p className="text-[10px] text-sky-200/70 line-clamp-2">"{pendingText}"</p>

          <div className="flex flex-wrap gap-1.5">
            {canGenerate && (
              <>
                {cast.map((entry) => (
                  <button
                    key={entry.name}
                    onClick={() => assignVoice(entry.voiceId, entry.name)}
                    style={{ touchAction: 'manipulation' }}
                    className="px-2.5 py-1.5 rounded-full text-[11px] border border-violet-500/30 bg-violet-900/20 text-violet-200/85"
                  >
                    {entry.name}
                  </button>
                ))}
                <button
                  onClick={() => assignVoice(loadSpeechifyVoiceId(), 'Narrator')}
                  style={{ touchAction: 'manipulation' }}
                  className="px-2.5 py-1.5 rounded-full text-[11px] border border-border/40 text-muted-foreground"
                >
                  Narrator
                </button>
                <button
                  onClick={() => assignVoice(loadSpeechifyDMVoiceId(), 'DM')}
                  style={{ touchAction: 'manipulation' }}
                  className="px-2.5 py-1.5 rounded-full text-[11px] border border-amber-500/30 bg-amber-900/20 text-amber-200/85"
                >
                  DM voice
                </button>
              </>
            )}

            {onRecordSegment && (
              <button
                onClick={() => setRecorderOpen(true)}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-rose-500/30 bg-rose-900/20 text-rose-200/85"
                title="Record this passage in your own voice"
              >
                <Mic className="w-3 h-3" />
                Record my voice
              </button>
            )}
            <button
              onClick={() => { setPickerOpen(false); setPickerAnchor(null); setPendingText(''); }}
              style={{ touchAction: 'manipulation' }}
              className="px-2.5 py-1.5 rounded-full text-[11px] border border-border/40 text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {onRecordSegment && (
        <PartyDMAudioRecorder
          open={recorderOpen}
          onOpenChange={setRecorderOpen}
          isUploading={savingRecording}
          scriptText={pendingText}

          onSubmit={async (file) => {
            setSavingRecording(true);
            try {
              await onRecordSegment(messageId, content, pendingText, file);
              setPickerOpen(false);
              setPendingText('');
              setOverrideVersion((v) => v + 1);
            } finally {
              setSavingRecording(false);
            }
          }}
        />
      )}

    </div>
  );
}
