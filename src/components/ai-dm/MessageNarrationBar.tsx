import { ListMusic, Loader2, Pause, Play } from 'lucide-react';
import { useMemo } from 'react';
import { splitDMResponseParts } from '@/lib/tts-utils';
import { MessageNarrationButton } from './MessageNarrationButton';
import type { MessageAudioRow, NarrationPart } from '@/hooks/use-message-narration';
import { cn } from '@/lib/utils';

interface MessageNarrationBarProps {
  messageId: string;
  content: string;
  tableAudio?: MessageAudioRow;
  storyAudio?: MessageAudioRow;
  /** Which part is currently generating / playing for this message, if any. */
  generatingPart?: NarrationPart | null;
  playingPart?: NarrationPart | null;
  canDelete?: boolean;
  onNarrate: (messageId: string, text: string, part: NarrationPart) => void;
  onPlay: (messageId: string, part: NarrationPart) => void;
  onPlayAll: (messageId: string) => void;
  onDelete?: (messageId: string, part: NarrationPart) => void;
}

/**
 * Speechify controls under a DM response: one button for the DM's table-talk
 * aside, one for the story narration, and a Play all that runs both in order.
 */
export function MessageNarrationBar({
  messageId,
  content,
  tableAudio,
  storyAudio,
  generatingPart,
  playingPart,
  canDelete,
  onNarrate,
  onPlay,
  onPlayAll,
  onDelete,
}: MessageNarrationBarProps) {
  const { tableTalk, story } = useMemo(() => splitDMResponseParts(content || ''), [content]);
  const hasTableTalk = tableTalk.trim().length > 0;
  const bothReady = !!tableAudio && !!storyAudio;
  const isPlayingAny = !!playingPart;

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

      {hasTableTalk && bothReady && (
        <button
          onClick={() => onPlayAll(messageId)}
          style={{ touchAction: 'manipulation' }}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] transition-colors',
            'border border-emerald-500/30 bg-emerald-900/20 text-emerald-200/85 hover:bg-emerald-900/40',
          )}
          title="Play the DM aside, then the story narration"
        >
          {isPlayingAny ? <Pause className="w-3 h-3" /> : <ListMusic className="w-3 h-3" />}
          {isPlayingAny ? 'Stop' : 'Play all'}
        </button>
      )}
    </div>
  );
}
