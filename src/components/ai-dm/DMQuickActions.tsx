import { cn } from '@/lib/utils';

interface DMQuickActionsProps {
  onSelect: (prompt: string) => void;
  isLoading: boolean;
  variant: 'starter' | 'inline';
}

const STARTER_ACTIONS = [
  { label: '⚔️ Start a Combat Encounter', prompt: 'Start an exciting combat encounter appropriate for my level and abilities.' },
  { label: '🏰 Explore a Dungeon', prompt: 'I want to explore a mysterious dungeon. Set the scene and describe what I find at the entrance.' },
  { label: '🗣️ Visit a Tavern', prompt: 'I walk into a lively tavern. Describe the scene and the interesting characters I notice.' },
  { label: '🌲 Wilderness Journey', prompt: 'I set out on a journey through the wilderness. What do I encounter along the road?' },
  { label: '🔮 Mystery Quest', prompt: 'A mysterious stranger approaches me with an urgent quest. What do they want?' },
];

const INLINE_ACTIONS = [
  { label: 'Look around', prompt: 'I look around carefully, taking in my surroundings.' },
  { label: 'Attack', prompt: 'I attack!' },
  { label: 'Talk to NPC', prompt: 'I approach and try to talk to them.' },
  { label: 'Check for traps', prompt: 'I carefully check the area for traps or hidden dangers.' },
  { label: 'Cast a spell', prompt: 'I want to cast a spell.' },
  { label: 'Stealth', prompt: 'I try to move stealthily, staying hidden.' },
  { label: 'Investigate', prompt: 'I investigate more closely.' },
  { label: 'Rest', prompt: 'I find a safe spot and take a rest.' },
];

export function DMQuickActions({ onSelect, isLoading, variant }: DMQuickActionsProps) {
  const actions = variant === 'starter' ? STARTER_ACTIONS : INLINE_ACTIONS;

  if (variant === 'starter') {
    return (
      <div className="flex flex-col gap-2 w-full max-w-[300px]">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => onSelect(action.prompt)}
            disabled={isLoading}
            className={cn(
              "px-4 py-3 rounded-xl text-left text-sm",
              "bg-amber-900/20 border border-amber-500/20",
              "hover:bg-amber-900/40 hover:border-amber-500/30 transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "text-amber-200/80"
            )}
            style={{ touchAction: 'manipulation' }}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelect(action.prompt)}
          disabled={isLoading}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0",
            "bg-amber-900/20 border border-amber-500/20",
            "hover:bg-amber-900/40 transition-colors",
            "disabled:opacity-40",
            "text-amber-300/70"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
