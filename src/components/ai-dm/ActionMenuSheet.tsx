import { useState, type ComponentType } from 'react';
import { Backpack, BookOpen, Dices, Sparkles, Sword, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export type ActionMenuChoice = 'dice' | 'actions' | 'spells' | 'story' | 'bag' | 'coming-soon';

interface ActionMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: ActionMenuChoice) => void;
  characterName?: string;
  characterImage?: string;
}

interface ActionTileProps {
  label: string;
  description: string;
  image?: string;
  fallback: ComponentType<{ className?: string }>;
  onClick: () => void;
  characterImage?: string;
  initials?: string;
  /** Art-style title drawn over a bottom gradient; replaces the plain strip. */
  overlayText?: string;
}

function ActionTile({ label, description, image, fallback: Fallback, onClick, characterImage, initials, overlayText }: ActionTileProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = characterImage || image;
  const showingImage = !!source && !imageFailed;
  // The strip only shows when the tile has no artwork of its own to title it.
  const showStrip = !overlayText && !showingImage;

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      aria-label={`${label}: ${description}`}
      style={{ touchAction: 'manipulation' }}
      className="relative aspect-square h-auto min-h-[132px] w-full overflow-hidden rounded-lg border-amber-500/30 bg-card/90 p-0 text-foreground shadow-lg active:scale-[0.98]"
    >
      {source && !imageFailed ? (
        <img
          src={source}
          alt={`${label} action`}
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover opacity-65"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40" aria-hidden="true">
          {initials ? (
            <span className="font-cinzel text-4xl text-amber-200/80">{initials}</span>
          ) : (
            <Fallback className="h-14 w-14 text-amber-300/70" />
          )}
        </div>
      )}
      {overlayText && (
        <div
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
          aria-hidden="true"
        />
      )}
      {overlayText && (
        <span
          className="absolute inset-x-0 bottom-2 px-1 text-center font-cinzel uppercase"
          style={{
            fontSize: 'clamp(0.8rem, 4.2vw, 1.05rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '0.05em',
            color: '#FFE4AA',
            textShadow:
              '0 0 6px rgba(255,183,77,0.9), 0 0 14px rgba(245,158,11,0.55), 0 1px 2px rgba(0,0,0,0.95), 0 -1px 1px rgba(0,0,0,0.8)',
            WebkitTextStroke: '0.5px rgba(30,20,5,0.9)',
          }}
        >
          {overlayText}
        </span>
      )}
      {showStrip && (
        <span className="absolute inset-x-0 bottom-0 bg-background/90 px-2 py-2.5 text-center font-cinzel text-xs text-amber-100">
          {label}
        </span>
      )}
    </Button>
  );
}

export function ActionMenuSheet({ open, onOpenChange, onSelect, characterName, characterImage }: ActionMenuSheetProps) {
  const initials = (characterName || 'Adventurer').trim().charAt(0).toUpperCase();
  const tiles: Array<Omit<ActionTileProps, 'onClick'>> = [
    { label: 'Dice', description: 'Open the dice roller', image: '/action-menu/dice.png', fallback: Dices },
    { label: 'Actions', description: 'Use weapons and abilities', image: '/action-menu/sword.png', fallback: Sword },
    { label: 'Spells', description: 'Cast spells and cantrips', image: '/action-menu/wand.png', fallback: WandSparkles },
    { label: 'Story', description: 'Open your story and quests', image: '/action-menu/book.png', fallback: BookOpen },
    { label: 'Bag & Stats', description: 'Open your items and character stats', fallback: Backpack, characterImage, initials, overlayText: 'BAG & STATS' },
    { label: 'Coming Soon', description: 'Future action slot', image: '/action-menu/slot6.png', fallback: Sparkles },
  ];
  const choices: ActionMenuChoice[] = ['dice', 'actions', 'spells', 'story', 'bag', 'coming-soon'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="z-[65] max-h-[92dvh] overflow-y-auto rounded-t-2xl border-amber-500/30 bg-background/95 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-center font-cinzel text-amber-200">Choose an Action</SheetTitle>
        </SheetHeader>
        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
          {tiles.map((tile, index) => (
            <ActionTile key={choices[index]} {...tile} onClick={() => onSelect(choices[index])} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}