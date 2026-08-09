import { ListMusic, Loader2, Pause, Play, Users } from 'lucide-react';
import { useMemo } from 'react';
import { splitDMResponseParts, splitStorySegments } from '@/lib/tts-utils';
import { MessageNarrationButton } from './MessageNarrationButton';
import { narrationKey, segmentPart, type CastProgress, type MessageAudioRow, type NarrationPart } from '@/hooks/use-message-narration';
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
}

/**
 * Speechify controls under a DM response: the DM's table-talk aside, the story
 * narration, an optional full voice-cast pass, and a Play all that runs every
 * clip in story order.
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
}: MessageNarrationBarProps) {
  const { tableTalk, story } = useMemo(() => splitDMResponseParts(content || ''), [content]);
  const segments = useMemo(() => splitStorySegments(story || content || ''), [story, content]);
  const hasTableTalk = tableTalk.trim().length > 0;
  const hasCastTags = segments.some((s) => !!s.speaker);

  const tableAudio = narrationMap[narrationKey(messageId, 'table')];
  const storyAudio = narrationMap[narrationKey(messageId, 'story')];
  const segmentClips = segments.filter((_, i) => !!narrationMap[narrationKey(messageId, segmentPart(i))]).length;

  const isCasting = generatingPart === 'cast';
  const isPlayingAny = !!playingPart;
  const playAllReady = (segmentClips > 0 && (!hasTableTalk || !!tableAudio))
    || (hasTableTalk && !!tableAudio && !!storyAudio);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
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
        hasAudio={!!storyAudio}
        isGenerating={generatingPart === 'story'}
        isPlaying={playingPart === 'story'}
        voicedByName={storyAudio?.created_by_name}
        canDelete={canDelete}
        onGenerate={() => onNarrate(messageId, story || content, 'story')}
        onPlay={() => onPlay(messageId, 'story')}
        onDelete={onDelete ? () => onDelete(messageId, 'story') : undefined}
      />

      {/* Full voice cast: DM aside + one clip per speaker segment */}
      {hasCastTags && (
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
  );
}
