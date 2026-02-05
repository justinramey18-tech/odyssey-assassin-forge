import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  Dices, 
  Sword, 
  Eye, 
  Copy,
  X,
  ChevronUp
} from 'lucide-react';
import { CombatTab } from './CombatBottomNav';

interface CombatFABProps {
  activeTab: CombatTab;
  onQuickRoll: () => void;
  onQuickAttack: () => void;
  onQuickHide: () => void;
  onCopySummary: () => void;
}

export function CombatFAB({
  activeTab,
  onQuickRoll,
  onQuickAttack,
  onQuickHide,
  onCopySummary,
}: CombatFABProps) {
  const [expanded, setExpanded] = useState(false);

  // Determine primary action based on active tab
  const getPrimaryAction = () => {
    switch (activeTab) {
      case 'combat':
        return { icon: Sword, action: onQuickAttack, label: 'Quick Attack' };
      case 'actions':
        return { icon: Eye, action: onQuickHide, label: 'Quick Hide' };
      default:
        return { icon: Dices, action: onQuickRoll, label: 'Quick Roll' };
    }
  };

  const primary = getPrimaryAction();
  const PrimaryIcon = primary.icon;

  // Speed dial actions
  const speedDialActions = [
    { icon: Sword, action: onQuickAttack, label: 'Attack', color: 'bg-red-500' },
    { icon: Eye, action: onQuickHide, label: 'Hide', color: 'bg-purple-500' },
    { icon: Copy, action: onCopySummary, label: 'Copy', color: 'bg-cyan-500' },
  ];

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-center gap-2">
      {/* Speed Dial Actions - Show when expanded */}
      {expanded && (
        <div className="flex flex-col gap-2 animate-fade-in">
          {speedDialActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => {
                  action.action();
                  setExpanded(false);
                }}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95",
                  action.color
                )}
                style={{
                  animation: `slide-up 0.2s ease-out ${index * 0.05}s both`
                }}
              >
                <Icon className="w-5 h-5 text-white" />
              </button>
            );
          })}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => {
          if (expanded) {
            setExpanded(false);
          } else {
            primary.action();
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setExpanded(!expanded);
        }}
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95",
          "bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-400/50",
          expanded && "rotate-45"
        )}
      >
        {expanded ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <PrimaryIcon className="w-7 h-7 text-white" />
        )}
      </button>

      {/* Expand indicator */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="absolute -top-2 right-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center"
        >
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
