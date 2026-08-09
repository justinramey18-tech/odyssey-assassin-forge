import { Loader2, Pause, Play, Volume2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageNarrationButtonProps {
  hasAudio: boolean;
  isGenerating: boolean;
  isPlaying: boolean;
  voicedByName?: string | null;
  canDelete?: boolean;
  onGenerate: () => void;
  onPlay: () => void;
  onDelete?: () => void;
}

export function MessageNarrationButton({
  hasAudio,
  isGenerating,
  isPlaying,
  voicedByName,
  canDelete,
  onGenerate,
  onPlay,
  onDelete,
}: MessageNarrationButtonProps) {
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <button
        onClick={hasAudio ? onPlay : onGenerate}
        disabled={isGenerating}
        style={{ touchAction: 'manipulation' }}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] transition-colors',
          'border border-amber-500/25 bg-amber-900/20 text-amber-200/80',
          'hover:bg-amber-900/40 disabled:opacity-50',
        )}
        title={hasAudio ? (isPlaying ? 'Pause narration' : 'Play saved narration') : 'Narrate this message'}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Voicing…
          </>
        ) : hasAudio ? (
          <>
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Pause' : 'Play'}
          </>
        ) : (
          <>
            <Volume2 className="w-3 h-3" />
            Narrate
          </>
        )}
      </button>

      {hasAudio && voicedByName && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
          voiced by {voicedByName}
        </span>
      )}

      {hasAudio && canDelete && onDelete && (
        <button
          onClick={onDelete}
          style={{ touchAction: 'manipulation' }}
          className="p-1.5 rounded-full text-muted-foreground hover:text-destructive transition-colors"
          title="Remove saved narration"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
