import { Lock, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlayerLockedOutScreenProps {
  onOpenOnboarding: () => void;
}

export function PlayerLockedOutScreen({ onOpenOnboarding }: PlayerLockedOutScreenProps) {
  return (
    <div className="fixed inset-0 z-[78] bg-background/95 backdrop-blur-sm flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
          <Lock className="w-7 h-7 text-amber-300" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-cinzel text-foreground">Finish Your Character</h2>
          <p className="text-sm text-muted-foreground">
            The campaign has started. Complete your character to join the rest of the party.
          </p>
        </div>
        <Button
          onClick={onOpenOnboarding}
          className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white gap-2"
        >
          <Play className="w-4 h-4" />
          Build my character
        </Button>
      </div>
    </div>
  );
}
