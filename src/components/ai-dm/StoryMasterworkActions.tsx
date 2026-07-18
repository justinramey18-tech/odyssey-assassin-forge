import { useState, useCallback } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { MasterworkSkeleton } from '@/components/empyrean/EmpyreanContextualActions';
import { cn } from '@/lib/utils';

interface ActionItem {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

type MasterworkState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; pills: ActionItem[] }
  | { status: 'error'; message: string };

interface StoryMasterworkActionsProps {
  disabled?: boolean;
  onAction: (prompt: string) => void;
  fetchStoryPills: () => Promise<ActionItem[]>;
}

export function StoryMasterworkActions({ disabled, onAction, fetchStoryPills }: StoryMasterworkActionsProps) {
  const [state, setState] = useState<MasterworkState>({ status: 'idle' });

  const generate = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const pills = await fetchStoryPills();
      setState({ status: 'loaded', pills });
    } catch (e: any) {
      setState({ status: 'error', message: e?.message || 'Could not generate suggestions.' });
    }
  }, [fetchStoryPills]);

  const revert = useCallback(() => setState({ status: 'idle' }), []);

  if (state.status === 'idle') {
    return (
      <button
        onClick={generate}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300/80 hover:text-amber-300 text-xs transition-colors disabled:opacity-40"
        style={{ touchAction: 'manipulation' }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Suggest my next move
      </button>
    );
  }

  if (state.status === 'loading') {
    return <MasterworkSkeleton count={4} accent="amber" />;
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-300/80">
        <span>{state.message}</span>
        <button onClick={generate} className="underline shrink-0" style={{ touchAction: 'manipulation' }}>Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-amber-300/50 uppercase tracking-wide">Suggested moves</span>
        <button
          onClick={revert}
          className="flex items-center gap-1 text-[10px] text-amber-300/50 hover:text-amber-300"
          style={{ touchAction: 'manipulation' }}
        >
          <RotateCcw className="w-3 h-3" />
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {state.pills.map((pill) => (
          <button
            key={pill.id}
            onClick={() => !disabled && onAction(pill.prompt)}
            disabled={disabled}
            className={cn(
              'text-left px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-950/20 hover:bg-amber-900/30 text-xs text-amber-100/90 transition-colors disabled:opacity-40',
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <span className="mr-1">{pill.emoji}</span>
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );
}
