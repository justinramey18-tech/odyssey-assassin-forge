import { Star, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PrestigeLevelUpModalProps {
  open: boolean;
  prestigeLevel: number;
  pointsAwarded: number;
  onClose: () => void;
}

export function PrestigeLevelUpModal({ 
  open,
  prestigeLevel, 
  pointsAwarded, 
  onClose,
}: PrestigeLevelUpModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md bg-gradient-to-br from-amber-900 to-orange-900 border-4 border-amber-500">
        <DialogHeader>
          <DialogTitle className="sr-only">Prestige Level Up</DialogTitle>
        </DialogHeader>

        <div className="text-center py-4">
          {/* Star Icon with glow */}
          <div className="relative inline-block mb-4">
            <Star className="w-16 h-16 text-amber-400 fill-amber-400 animate-pulse" />
            <div className="absolute inset-0 blur-xl bg-amber-400/50 rounded-full" />
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-200 animate-pulse" />
            <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-amber-300 animate-pulse delay-150" />
          </div>

          <h2 className="text-3xl font-display font-bold text-amber-300 mb-2">
            Prestige Level {prestigeLevel}
          </h2>
          
          <p className="text-amber-200/90 font-body mb-6">
            You've transcended mortal limitations!
          </p>

          {/* Points Award Box */}
          <div className="bg-black/40 border-2 border-amber-600 rounded-lg p-6 mb-6">
            <div className="text-5xl font-display font-bold text-amber-400 mb-2">
              +{pointsAwarded}
            </div>
            <div className="text-amber-300 font-display">
              Ability Point{pointsAwarded > 1 ? 's' : ''} Earned
            </div>
          </div>

          <Button
            onClick={onClose}
            className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-display font-bold text-lg"
          >
            Continue Your Legend
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
