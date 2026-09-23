import { useState, type ComponentType } from 'react';
import { Backpack, BookOpen, Dices, MessageCircle, Sparkles, Sword, WandSparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import directorTileAsset from '@/assets/action-menu/director-tile.jpg.asset.json';
import toolsTileAsset from '@/assets/action-menu/tools-tile.jpg.asset.json';
import tileDice from '@/assets/action-menu/tile-dice.jpg';
import tileAttack from '@/assets/action-menu/tile-attack.jpg';
import tileSpell from '@/assets/action-menu/tile-spell.jpg';
import tileQuest from '@/assets/action-menu/tile-quest.jpg';
import tileMoves from '@/assets/action-menu/tile-moves.jpg';
import actionSheetFrame from '@/assets/action-menu/action-sheet-frame.png';
import { cn } from '@/lib/utils';
const directorTile = directorTileAsset.url;
const toolsTile = toolsTileAsset.url;

export type ActionMenuChoice = 'dice' | 'actions' | 'spells' | 'story' | 'bag' | 'moves' | 'director' | 'tools';

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
  ariaLabel?: string;
  image?: string;
  fallback: ComponentType<{ className?: string }>;
  onClick: () => void;
  characterImage?: string;
  initials?: string;
  /** Art-style title drawn over a bottom gradient; replaces the plain strip. */
  overlayText?: string;
}

function ActionTile({ label, description, ariaLabel, image, fallback: Fallback, onClick, characterImage, initials, overlayText }: ActionTileProps) {
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
      aria-label={ariaLabel ?? `${label}: ${description}`}
      style={{ touchAction: 'manipulation' }}
      className="relative aspect-square h-auto min-h-[132px] w-full overflow-hidden rounded-lg border-amber-500/30 bg-card/90 p-0 text-foreground shadow-lg active:scale-[0.98]"
    >
      {source && !imageFailed ? (
        <img
          src={source}
          alt={`${label} action`}
          onError={() => setImageFailed(true)}
          className={cn('absolute inset-0 h-full w-full object-cover', characterImage ? 'opacity-65' : 'opacity-100')}
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
    { label: 'Dice', description: 'Open the dice roller', image: tileDice, fallback: Dices },
    { label: 'Actions', description: 'Use weapons and abilities', image: tileAttack, fallback: Sword },
    { label: 'Spells', description: 'Cast spells and cantrips', image: tileSpell, fallback: WandSparkles },
    { label: 'Quest Log', description: 'Open your active quests', ariaLabel: 'Quest log', image: tileQuest, fallback: BookOpen },
    { label: 'Bag & Stats', description: 'Open your items and character stats', fallback: Backpack, characterImage, initials, overlayText: 'BAG & STATS' },
    { label: 'Get Moves', description: 'Suggested moves when you are stuck', image: tileMoves, fallback: Sparkles },
    { label: "Director's Channel", description: 'Talk privately with the DM', ariaLabel: "Director's Channel: talk privately with the DM", image: directorTile, fallback: MessageCircle },
    { label: 'Tools', description: 'Campaign tools, guides and downloads', ariaLabel: 'Tools: campaign tools, guides and downloads', image: toolsTile, fallback: Wrench },
  ];
  const choices: ActionMenuChoice[] = ['dice', 'actions', 'spells', 'story', 'bag', 'moves', 'director', 'tools'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="z-[65] max-h-[92dvh] overflow-y-auto border-0 bg-transparent p-0 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-none backdrop-blur-none [&>button:last-child]:right-[34px] [&>button:last-child]:top-[18px] [&>button:last-child]:z-10 [&>button:last-child]:text-amber-300 [&>button:last-child]:opacity-90"
      >
        <div
          className="relative mx-auto w-full max-w-[440px]"
          style={{
            borderStyle: 'solid',
            borderWidth: '108px 26px 30px',
            borderImage: `url(${actionSheetFrame}) 180 52 56 fill / 108px 26px 30px stretch`,
            padding: '4px 2px 2px',
          }}
        >
          <SheetHeader className="absolute inset-x-0 top-[-34px] -translate-y-1/2 space-y-0 p-0 text-center sm:text-center">
            <SheetTitle className="text-center font-cinzel text-[18px] font-bold tracking-[0.06em] text-[#FFE4AA] [text-shadow:0_0_8px_rgba(245,158,11,0.55),0_1px_2px_#000]">
              Choose an Action
            </SheetTitle>
          </SheetHeader>
          <div className="mx-auto grid w-full max-w-[300px] grid-cols-2 gap-2.5">
            {tiles.map((tile, index) => (
              <ActionTile key={choices[index]} {...tile} onClick={() => onSelect(choices[index])} />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}