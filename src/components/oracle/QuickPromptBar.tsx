import { cn } from '@/lib/utils';
import { getPersonalityConfig } from './personalities';
import { getModeConfig } from './modes';
import { Personality, OracleMode } from './types';

interface QuickPromptBarProps {
  personality: Personality;
  mode: OracleMode;
  onPromptClick: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPromptBar({ personality, mode, onPromptClick, disabled }: QuickPromptBarProps) {
  const personalityConfig = getPersonalityConfig(personality);
  const modeConfig = getModeConfig(mode);

  // Use mode-specific prompts as primary, with personality color styling
  const prompts = modeConfig.quickPrompts;

  return (
    <div className="px-3 py-2 shrink-0">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {modeConfig.icon} {modeConfig.name} prompts
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {prompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => !disabled && onPromptClick(prompt)}
            disabled={disabled}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs',
              'border transition-all duration-200',
              'hover:scale-105 active:scale-95',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{
              borderColor: `${modeConfig.color}50`,
              color: personalityConfig.color,
              backgroundColor: `${modeConfig.color}15`,
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
