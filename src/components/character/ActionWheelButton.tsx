import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InfinityGauntletScreen } from './InfinityGauntletScreen';

interface ActionWheelButtonProps {
  characterName: string;
  isEmbedded?: boolean;
}

export function ActionWheelButton({ characterName, isEmbedded = false }: ActionWheelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const containerClass = isEmbedded 
    ? "relative z-50" 
    : "fixed bottom-6 right-6 z-50";

  return (
    <>
      {/* FAB Button */}
      <div className={containerClass}>
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className={cn(
            'w-14 h-14 rounded-full shadow-lg transition-all duration-300',
            'bg-primary hover:bg-primary/90 glow-gold'
          )}
        >
          <Sparkles className="w-6 h-6" />
        </Button>
      </div>

      {/* Fullscreen Infinity Gauntlet Screen */}
      <InfinityGauntletScreen
        characterName={characterName}
        open={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
