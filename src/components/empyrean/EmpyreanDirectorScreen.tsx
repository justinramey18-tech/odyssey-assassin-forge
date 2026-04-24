import { X, MessageCircle } from 'lucide-react';
import { DirectorChat } from '@/components/empyrean/DirectorChat';
import type { DirectorProposedAction } from '@/hooks/use-director-chat';

interface EmpyreanDirectorScreenProps {
  open: boolean;
  onClose: () => void;
  dragonName?: string;
  characterName?: string;
  dragonNotes?: string;
  onConfirmAction?: (action: DirectorProposedAction) => void | Promise<void>;
}

export function EmpyreanDirectorScreen({
  open,
  onClose,
  dragonName,
  characterName,
  dragonNotes,
  onConfirmAction,
}: EmpyreanDirectorScreenProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[78] flex flex-col bg-gradient-to-b from-[#080510] via-background to-background/95">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-cinzel font-semibold text-foreground truncate">
            Talk to the DM
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content — DirectorChat fills remaining space */}
      <div className="flex-1 min-h-0">
        <DirectorChat
          dragonName={dragonName}
          characterName={characterName}
          dragonNotes={dragonNotes}
          onConfirmAction={onConfirmAction}
        />
      </div>
    </div>
  );
}
