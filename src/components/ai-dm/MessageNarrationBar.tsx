import { Download, Loader2, Pause, SlidersHorizontal } from 'lucide-react';
import listenToStory from '@/assets/listen-to-story.png.asset.json';
import { useEffect, useMemo, useState } from 'react';
import {
  splitDMResponseParts,
  splitStorySegments,
  segmentKey,
  voiceForSpeaker,
  type NarrationSegment,
} from '@/lib/tts-utils';
import { NarrationStudio } from './NarrationStudio';
import { narrationKey, type CastProgress, type MessageAudioRow, type NarrationPart, type RecordedClipResult } from '@/hooks/use-message-narration';
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
  /** Host/co-host only. Players get listening, speeds and mic recording. */
  canGenerate?: boolean;
  onNarrate: (messageId: string, text: string, part: NarrationPart) => void;
  onNarrateCast: (messageId: string, content: string) => void;
  onPlay: (messageId: string, part: NarrationPart, rate?: number) => void;
  onPlayAll: (messageId: string, content: string) => void;
  onDelete?: (messageId: string, part: NarrationPart) => void;
  onDeleteAll?: (messageId: string) => void;
  /** Saves a mic recording for one piece of the story. */
  onRecordSegment?: (messageId: string, content: string, passage: string, blob: Blob, label?: string, hint?: NarrationSegment) => Promise<RecordedClipResult>;
  /** Swaps a self-recorded piece back to the cast voice it covered. */
  onRevertToCastVoice?: (messageId: string, part: NarrationPart) => Promise<void>;
  /** Synthesizes ONE piece of the story in the chosen voice. */
  onVoiceSegment?: (messageId: string, content: string, passage: string, voiceId: string, label?: string, spokenText?: string) => Promise<void>;
  /** Packages this message's clips into one audio file on the device. */
  onDownloadFile?: (messageId: string, content: string) => void;
  /** True while this message's file is being prepared. */
  isDownloading?: boolean;
  downloadProgress?: { done: number; total: number } | null;
  /** Publishes this device's voice picks for the message to the party. */
  onShareVoices?: (messageId: string) => void;
  /** Re-uploads a deleted clip (the studio's undo uses it). */
  onRestoreClip?: (messageId: string, part: NarrationPart, blob: Blob, voiceId: string) => Promise<void>;
}

/**
 * The two controls under a DM response: Play all and Edit narration.
 * Everything else - assigning voices, Speechify voicing, mic recording,
 * splitting, merging, ordering, per-piece speed - lives in the full-screen
 * Narration Studio this bar opens.
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
  onPlay,
  onPlayAll,
  onDelete,
  onDeleteAll,
  onRecordSegment,
  onRevertToCastVoice,
  onVoiceSegment,
  onDownloadFile,
  isDownloading,
  downloadProgress,
  onShareVoices,
  onRestoreClip,
}: MessageNarrationBarProps) {
  const [studioOpen, setStudioOpen] = useState(false);
  // Re-splits when another player's recording or voice pick lands.
  const [overrideVersion, setOverrideVersion] = useState(0);

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

  const hasTableTalk = tableTalk.trim().length > 0;
  const tableAudio = narrationMap[narrationKey(messageId, 'table')];
  const storyAudio = narrationMap[narrationKey(messageId, 'story')];
  const segmentClips = segments.filter((s) => !!narrationMap[narrationKey(messageId, segmentKey(s))]).length;
  const hasVoicedSegments = segments.some((s) => s.voiceId || (s.speaker && voiceForSpeaker(s.speaker)));

  const playAllReady = (segmentClips > 0 && (!hasTableTalk || !!tableAudio))
    || (hasTableTalk && !!tableAudio && !!storyAudio)
    || (!!storyAudio && segmentClips === 0);

  const isPlayingAny = !!playingPart;
  const isCasting = generatingPart === 'cast';

  return (
    <div className="mt-1.5">
      {/* Listen to Story — picture banner on its own line so the pill row doesn't wrap on narrow screens */}
      {playAllReady && (
        <div className="mb-1.5">
          <button
            onClick={() => onPlayAll(messageId, content)}
            style={{ touchAction: 'manipulation' }}
            className="relative inline-flex h-14 rounded-xl overflow-hidden border border-amber-500/30 shadow-md transition-transform active:scale-95"
            title="Play every clip in your custom order"
            aria-label="Listen to Story"
          >
            <img
              src={listenToStory.url}
              alt="Listen to Story"
              loading="lazy"
              draggable={false}
              className="h-14 w-auto object-cover"
            />
            {isPlayingAny && (
              <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 text-[11px] text-amber-100">
                <Pause className="w-4 h-4 shrink-0" />
                <span className="truncate px-1">{speakingName ? `Stop · ${speakingName}` : 'Stop'}</span>
              </span>
            )}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {isCasting && (
          <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-violet-500/30 bg-violet-900/20 text-violet-200/85">
            <Loader2 className="w-3 h-3 animate-spin" />
            Voicing {castProgress?.done ?? 0}/{castProgress?.total ?? 0}{castProgress?.speaker ? ` · ${castProgress.speaker}` : ''}
          </span>
        )}

        <button
          onClick={() => setStudioOpen(true)}
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] border border-sky-500/30 bg-sky-900/20 text-sky-200/85 hover:bg-sky-900/40 transition-colors"
          title="Open the Narration Studio for this message"
        >
          <SlidersHorizontal className="w-3 h-3" />
          Edit narration
        </button>

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
      </div>

      <NarrationStudio
        open={studioOpen}
        onOpenChange={setStudioOpen}
        messageId={messageId}
        content={content}
        narrationMap={narrationMap}
        generatingPart={generatingPart}
        playingPart={playingPart}
        speakingName={speakingName}
        canGenerate={canGenerate}
        onNarrateTable={() => onNarrate(messageId, tableTalk, 'table')}
        onPlay={(part, rate) => onPlay(messageId, part, rate)}
        onPlayAll={() => onPlayAll(messageId, content)}
        onDeletePart={canDelete && onDelete ? (part) => onDelete(messageId, part) : undefined}
        onDeleteAll={canDelete && onDeleteAll ? () => onDeleteAll(messageId) : undefined}
        onVoiceSegment={canGenerate && onVoiceSegment
          ? (passage, voiceId, label, spokenText) => onVoiceSegment(messageId, content, passage, voiceId, label, spokenText)
          : undefined}
        onRecordSegment={onRecordSegment
          ? (passage, blob, hint) => onRecordSegment(messageId, content, passage, blob, undefined, hint)
          : undefined}
        onRevertToCastVoice={onRevertToCastVoice
          ? (part) => onRevertToCastVoice(messageId, part)
          : undefined}
        onShareVoices={onShareVoices ? () => onShareVoices(messageId) : undefined}
        onRestoreClip={onRestoreClip
          ? (part, blob, voiceId) => onRestoreClip(messageId, part, blob, voiceId)
          : undefined}
      />
    </div>
  );
}
