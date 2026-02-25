import { UseSpellcastingReturn } from '@/hooks/use-spellcasting';
import { MobileSpellList } from './MobileSpellList';

interface SpellsSectionContentProps {
  spellcasting?: UseSpellcastingReturn;
  characterName: string;
  onSetLastAction: (action: string) => void;
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onLogSpellCast: (spellName: string) => void;
  onSpellCastResult: (spellName: string) => void;
}

export function SpellsSectionContent({
  spellcasting,
  characterName,
  onSetLastAction,
  onAddToTurn,
  onLogSpellCast,
  onSpellCastResult,
}: SpellsSectionContentProps): JSX.Element {
  if (!spellcasting) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4">
        <p className="text-muted-foreground">Spellcasting not available</p>
      </div>
    );
  }

  return (
    <MobileSpellList
      spellcasting={spellcasting}
      characterName={characterName}
      onCast={(result) => {
        if (result.success) {
          onSetLastAction(`${result.spellName.toUpperCase()} CAST`);
          onAddToTurn('action', `Cast ${result.spellName}`);
          onLogSpellCast(result.spellName);
          onSpellCastResult(result.spellName);
        }
      }}
    />
  );
}
