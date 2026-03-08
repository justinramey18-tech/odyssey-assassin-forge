import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Shuffle, Play, Star, List } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { type CharacterPrompt, DEADPOOL_PROMPT_IDS, PROMPT_HINTS } from '@/lib/characterPrompts';
import { moodCategories, getRandomMoodPrompts, getMoodPrompts } from '@/lib/moodMappings';
import { AlignmentBadge } from '@/components/alignment/AlignmentBadge';
import { useFavoritePrompts } from '@/hooks/use-favorite-prompts';

interface MoodGatewayProps {
  allPrompts: CharacterPrompt[];
  onUsePrompt: (prompt: CharacterPrompt) => void;
  onBrowseAll: () => void;
  accentColor?: string;
}

export function MoodGateway({ allPrompts, onUsePrompt, onBrowseAll, accentColor = '#eab308' }: MoodGatewayProps) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [displayedPrompts, setDisplayedPrompts] = useState<CharacterPrompt[]>([]);
  const { toggleFavorite, isFavorite } = useFavoritePrompts();

  const selectMood = useCallback((moodId: string) => {
    setSelectedMood(moodId);
    setDisplayedPrompts(getRandomMoodPrompts(moodId, allPrompts, 6));
  }, [allPrompts]);

  const shufflePrompts = useCallback(() => {
    if (!selectedMood) return;
    setDisplayedPrompts(getRandomMoodPrompts(selectedMood, allPrompts, 6));
    toast.success('Shuffled!');
  }, [selectedMood, allPrompts]);

  const totalForMood = useMemo(() => {
    if (!selectedMood) return 0;
    return getMoodPrompts(selectedMood, allPrompts).length;
  }, [selectedMood, allPrompts]);

  // Mood grid view
  if (!selectedMood) {
    return (
      <div className="space-y-4 pt-2">
        <p className="text-center text-sm text-white/60 font-cinzel">What kind of moment?</p>

        <div className="grid grid-cols-2 gap-2.5">
          {moodCategories.map((mood) => {
            const count = getMoodPrompts(mood.id, allPrompts).length;
            return (
              <button
                key={mood.id}
                onClick={() => selectMood(mood.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-4 rounded-xl min-h-[80px]',
                  'border transition-all duration-200',
                  'hover:scale-[1.03] active:scale-[0.98]',
                )}
                style={{
                  backgroundColor: `${mood.color}10`,
                  borderColor: `${mood.color}30`,
                }}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <span className="text-sm font-medium" style={{ color: mood.color }}>{mood.name}</span>
                <span className="text-[10px] text-white/30">{count} prompts</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onBrowseAll}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-medium border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
        >
          <List className="w-4 h-4" />
          Browse All Prompts
        </button>
      </div>
    );
  }

  // Mood results view
  const mood = moodCategories.find(m => m.id === selectedMood);

  return (
    <div className="space-y-3 pt-2">
      {/* Header with back + mood info */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelectedMood(null)}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{mood?.emoji}</span>
            <span className="text-base font-cinzel font-medium" style={{ color: mood?.color }}>{mood?.name}</span>
            <span className="text-[10px] text-white/30 px-2 py-0.5 rounded-full bg-white/5">
              {displayedPrompts.length} of {totalForMood}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">{mood?.description}</p>
        </div>
        <button
          onClick={shufflePrompts}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          title="Show different prompts"
        >
          <Shuffle className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Prompt cards */}
      <div className="space-y-1.5">
        {displayedPrompts.map((prompt) => {
          const isStarred = isFavorite(prompt.id);
          const isDeadpool = DEADPOOL_PROMPT_IDS.has(prompt.id);
          const hint = PROMPT_HINTS.get(prompt.id);

          return (
            <div
              key={prompt.id}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
            >
              <button
                onClick={() => { toggleFavorite(prompt.id); toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites'); }}
                className="shrink-0 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-yellow-500/20 transition-colors"
              >
                <Star className={cn('w-4 h-4', isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-white/30 hover:text-yellow-400')} />
              </button>
              <div className="flex-1 min-w-0 py-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base shrink-0">{prompt.icon}</span>
                  <span className="text-sm text-white/90 font-medium">{prompt.title}</span>
                  <AlignmentBadge promptId={prompt.id} />
                  {isDeadpool && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-red-500/20 text-red-400">🃏</span>
                  )}
                </div>
                {prompt.description && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{prompt.description}</p>}
                {hint && <p className="text-[11px] text-amber-400/50 italic mt-0.5">💡 Try when: {hint}</p>}
              </div>
              <button
                onClick={() => onUsePrompt(prompt)}
                className="shrink-0 flex items-center gap-1 px-3 min-h-[44px] rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: `${accentColor}15`,
                  borderColor: `${accentColor}40`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                <Play className="w-3.5 h-3.5" />
                Use
              </button>
            </div>
          );
        })}
      </div>

      {/* Browse All from results */}
      <button
        onClick={onBrowseAll}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-xl text-sm font-medium border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
      >
        <List className="w-4 h-4" />
        Browse All Prompts
      </button>
    </div>
  );
}
