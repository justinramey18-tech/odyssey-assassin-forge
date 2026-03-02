import { cn } from '@/lib/utils';
import { AlignmentBadge } from '@/components/alignment/AlignmentBadge';

interface DMQuickActionsProps {
  onSelect: (prompt: string) => void;
  isLoading: boolean;
  variant: 'starter' | 'inline';
}

const STARTER_ACTIONS = [
  { id: 'dm-combat-encounter', label: '⚔️ Start a Combat Encounter', prompt: 'Start an exciting combat encounter appropriate for my level and abilities.' },
  { id: 'dm-explore-dungeon', label: '🏰 Explore a Dungeon', prompt: 'I want to explore a mysterious dungeon. Set the scene and describe what I find at the entrance.' },
  { id: 'dm-visit-tavern', label: '🗣️ Visit a Tavern', prompt: 'I walk into a lively tavern. Describe the scene and the interesting characters I notice.' },
  { id: 'dm-wilderness-journey', label: '🌲 Wilderness Journey', prompt: 'I set out on a journey through the wilderness. What do I encounter along the road?' },
  { id: 'dm-mystery-quest', label: '🔮 Mystery Quest', prompt: 'A mysterious stranger approaches me with an urgent quest. What do they want?' },
];

const INLINE_ACTIONS = [
  { id: 'dm-look-around', label: 'Look around', prompt: 'I look around carefully, taking in my surroundings.' },
  { id: 'dm-attack', label: 'Attack', prompt: 'I attack!' },
  { id: 'dm-talk-npc', label: 'Talk to NPC', prompt: 'I approach and try to talk to them.' },
  { id: 'dm-check-traps', label: 'Check for traps', prompt: 'I carefully check the area for traps or hidden dangers.' },
  { id: 'dm-cast-spell', label: 'Cast a spell', prompt: 'I want to cast a spell.' },
  { id: 'dm-stealth', label: 'Stealth', prompt: 'I try to move stealthily, staying hidden.' },
  { id: 'dm-investigate', label: 'Investigate', prompt: 'I investigate more closely.' },
  { id: 'dm-rest', label: 'Rest', prompt: 'I find a safe spot and take a rest.' },
];

export function DMQuickActions({ onSelect, isLoading, variant }: DMQuickActionsProps) {
  const actions = variant === 'starter' ? STARTER_ACTIONS : INLINE_ACTIONS;

  if (variant === 'starter') {
    return (
      <div className="flex flex-col gap-2 w-full max-w-[300px]">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onSelect(action.prompt)}
            disabled={isLoading}
            className={cn(
              "px-4 py-3 rounded-xl text-left text-sm flex items-center gap-2",
              "bg-amber-900/20 border border-amber-500/20",
              "hover:bg-amber-900/40 hover:border-amber-500/30 transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "text-amber-200/80"
            )}
            style={{ touchAction: 'manipulation' }}
          >
            <span className="flex-1">{action.label}</span>
            <AlignmentBadge promptId={action.id} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => onSelect(action.prompt)}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0",
            "bg-amber-900/20 border border-amber-500/20",
            "hover:bg-amber-900/40 transition-colors",
            "disabled:opacity-40",
            "text-amber-300/70"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          {action.label}
          <AlignmentBadge promptId={action.id} />
        </button>
      ))}
    </div>
  );
}
