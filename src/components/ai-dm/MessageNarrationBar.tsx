import { Highlighter, ListMusic, Loader2, Mic, Pause, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  splitDMResponseParts,
  splitStorySegments,
  segmentKey,
  loadVoiceCast,
  loadSpeechifyVoiceId,
  loadSpeechifyDMVoiceId,
  loadNarrationOverrides,
  addNarrationOverride,
  clearNarrationOverrides,
  voiceForSpeaker,
  isSelfRecordedVoice,
} from '@/lib/tts-utils';
import { MessageNarrationButton } from './MessageNarrationButton';
import { PartyDMAudioRecorder } from './PartyDMAudioRecorder';
import { narrationKey, type CastProgress, type MessageAudioRow, type NarrationPart } from '@/hooks/use-message-narration';
import { cn } from '@/lib/utils';


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
  onNarrate: (messageId: string, text: string, part: NarrationPart) => void;
  onNarrateCast: (messageId: string, content: string) => void;
  onPlay: (messageId: string, part: NarrationPart) => void;
  onPlayAll: (messageId: string, content: string) => void;
  onDelete?: (messageId: string, part: NarrationPart) => void;
  onDeleteAll?: (messageId: string) => void;
  /** Saves a mic recording for the highlighted passage. */
  onRecordSegment?: (messageId: string, content: string, passage: string, blob: Blob) => Promise<void>;
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
  onNarrate,
  onNarrateCast,
  onPlay,
  onPlayAll,
  onDelete,
  onDeleteAll,
  onRecordSegment,
}: MessageNarrationBarProps) {
  // Bumped whenever a manual voice override changes, to re-split the story.
  const [overrideVersion, setOverrideVersion] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [savingRecording, setSavingRecording] = useState(false);

  // Another player's recording can change how this message splits.
  useEffect(() => {
    const onSync = () => setOverrideVersion((v) => v + 1);
    window.addEventListener('odyssey-narration-overrides', onSync);
    return () => window.removeEventListener('odyssey-narration-overrides', onSync);
  }, []);


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
  const cast = useMemo(() => loadVoiceCast(), [overrideVersion]);

  const hasTableTalk = tableTalk.trim().length > 0;
  const hasVoicedSegments = segments.some((s) => s.voiceId || (s.speaker && voiceForSpeaker(s.speaker)));

  const tableAudio = narrationMap[narrationKey(messageId, 'table')];
  const storyAudio = narrationMap[narrationKey(messageId, 'story')];
  const segmentClips = segments.filter((s) => !!narrationMap[narrationKey(messageId, segmentKey(s))]).length;

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

  const assignVoice = (voiceId: string, label: string) => {
    addNarrationOverride(messageId, { text: pendingText, voiceId, label });
    setPickerOpen(false);
    setPendingText('');
    setOverrideVersion((v) => v + 1);
    toast.success(`Passage assigned to ${label}`, { description: 'Tap Narrate story to voice it.' });
  };

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {hasTableTalk && (
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

        <MessageNarrationButton
          tone="story"
          generateLabel={hasTableTalk ? 'Narrate story' : 'Narrate'}
          playLabel={hasTableTalk ? 'Story' : 'Play'}
          hasAudio={hasVoicedSegments ? segmentClips > 0 : !!storyAudio}
          isGenerating={generatingPart === 'story' || (isCasting && hasVoicedSegments)}
          isPlaying={playingPart === 'story'}
          voicedByName={storyAudio?.created_by_name}
          canDelete={canDelete}
          onGenerate={() => onNarrate(messageId, story || content, 'story')}
          onPlay={() => (hasVoicedSegments ? onPlayAll(messageId, content) : onPlay(messageId, 'story'))}
          onDelete={onDelete ? () => onDelete(messageId, 'story') : undefined}
        />

        {/* Full voice cast: DM aside + one clip per speaker segment */}
        {hasVoicedSegments && (
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

      {overrides.length > 0 && (
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
        <div className="rounded-lg border border-sky-500/25 bg-sky-950/25 p-2 space-y-1.5">
          <p className="text-[10px] text-sky-200/70 line-clamp-2">"{pendingText}"</p>
          <div className="flex flex-wrap gap-1.5">
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
              onClick={() => { setPickerOpen(false); setPendingText(''); }}
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
