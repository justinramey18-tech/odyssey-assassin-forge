import { cn } from '@/lib/utils';
import { getPersonalityConfig } from './personalities';
import { Personality } from './types';

interface QuickPromptBarProps {
  personality: Personality;
  onPromptClick: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickPromptBar({ personality, onPromptClick, disabled }: QuickPromptBarProps) {
  const config = getPersonalityConfig(personality);

  return (
    <div className="flex gap-2 px-3 py-2 overflow-x-auto">
      {config.quickPrompts.map((prompt, index) => (
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
            borderColor: `${config.color}40`,
            color: config.color,
            backgroundColor: `${config.color}10`,
          }}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
