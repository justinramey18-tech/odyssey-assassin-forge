import { cn } from '@/lib/utils';
import { getPersonalityConfig } from './personalities';
import { getModeConfig } from './modes';
import { Personality, OracleMode } from './types';

interface QuickPromptBarProps {
  personality: Personality;
  mode: OracleMode;
  onPromptClick: (prompt: string) => void;
  disabled?: boolean;
  bookmarkActive?: boolean;
  bookmarkMessageCount?: number;
}

export function QuickPromptBar({ personality, mode, onPromptClick, disabled, bookmarkActive, bookmarkMessageCount }: QuickPromptBarProps) {
  const personalityConfig = getPersonalityConfig(personality);
  const modeConfig = getModeConfig(mode);
  const prompts = modeConfig.quickPrompts;

  const handlePromptClick = (prompt: string) => {
    if (prompt.includes('Catch me up from my bookmark') && bookmarkActive) {
      const enhancedPrompt = `Catch me up from my bookmark. I have ${bookmarkMessageCount ?? 0} messages to review. Use bullet points for key events and end with current situation — keep it tight and itemized, no prose.`;
      onPromptClick(enhancedPrompt);
    } else {
      onPromptClick(prompt);
    }
  };

  return (
    <div className="px-3 py-2 shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {modeConfig.icon} {modeConfig.name} prompts
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {prompts.map((prompt, index) => {
          const isBookmarkPrompt = prompt.includes('Catch me up from my bookmark');
          const isDisabled = disabled || (isBookmarkPrompt && !bookmarkActive);

          return (
            <button
              key={index}
              onClick={() => !isDisabled && handlePromptClick(prompt)}
              disabled={isDisabled}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs',
                'border transition-all duration-200',
                'hover:scale-105 active:scale-95',
                isDisabled && 'opacity-50 cursor-not-allowed',
                isBookmarkPrompt && bookmarkActive && 'ring-2 ring-amber-400/50'
              )}
              style={{
                borderColor: isBookmarkPrompt && bookmarkActive
                  ? '#F59E0B50'
                  : `${modeConfig.color}50`,
                color: personalityConfig.color,
                backgroundColor: isBookmarkPrompt && bookmarkActive
                  ? '#F59E0B15'
                  : `${modeConfig.color}15`,
              }}
            >
              {prompt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
