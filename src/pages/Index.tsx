import { useState } from 'react';
import { Character, CharacterAbility, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { WizardStepOne } from '@/components/character/WizardStepOne';
import { WizardStepTwo } from '@/components/character/WizardStepTwo';
import { PointsSummary } from '@/components/character/PointsSummary';
import { EquippedLoadout } from '@/components/character/EquippedLoadout';

const Index = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [character, setCharacter] = useState<Character>({
    name: '',
    level: 1,
    abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
    equippedAbilities: [],
  });

  const totalPoints = getAbilityPointsForLevel(character.level);
  const spentPoints = getTotalPointsSpent(character.abilities);
  const remainingPoints = totalPoints - spentPoints;

  const handleBasicInfoComplete = (name: string, level: number) => {
    setCharacter(prev => ({
      ...prev,
      name,
      level,
    }));
    setStep(2);
  };

  const handleUpgradeAbility = (abilityId: string) => {
    if (remainingPoints <= 0) return;

    setCharacter(prev => ({
      ...prev,
      abilities: prev.abilities.map(ca =>
        ca.abilityId === abilityId && ca.currentTier < 3
          ? { ...ca, currentTier: (ca.currentTier + 1) as 0 | 1 | 2 | 3 }
          : ca
      ),
    }));
  };

  const handleDowngradeAbility = (abilityId: string) => {
    setCharacter(prev => {
      // Remove from equipped if being fully removed
      const currentTier = prev.abilities.find(ca => ca.abilityId === abilityId)?.currentTier ?? 0;
      const newEquipped = currentTier === 1 
        ? prev.equippedAbilities.filter(id => id !== abilityId)
        : prev.equippedAbilities;
      
      return {
        ...prev,
        abilities: prev.abilities.map(ca =>
          ca.abilityId === abilityId && ca.currentTier > 0
            ? { ...ca, currentTier: (ca.currentTier - 1) as 0 | 1 | 2 | 3 }
            : ca
        ),
        equippedAbilities: newEquipped,
      };
    });
  };

  const handleResetAbilities = () => {
    setCharacter(prev => ({
      ...prev,
      abilities: prev.abilities.map(ca => ({ ...ca, currentTier: 0 as const })),
      equippedAbilities: [],
    }));
  };

  const handleEquipAbility = (slotIndex: number, abilityId: string) => {
    setCharacter(prev => {
      const newEquipped = [...prev.equippedAbilities];
      newEquipped[slotIndex] = abilityId;
      return { ...prev, equippedAbilities: newEquipped };
    });
  };

  const handleUnequipAbility = (slotIndex: number) => {
    setCharacter(prev => {
      const newEquipped = [...prev.equippedAbilities];
      newEquipped[slotIndex] = '';
      return { ...prev, equippedAbilities: newEquipped.filter(Boolean) };
    });
  };

  const handleExportJSON = () => {
    const exportData = {
      character: {
        name: character.name,
        level: character.level,
      },
      abilities: {
        pointsSpent: {
          hunter: character.abilities
            .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'hunter')
            .reduce((sum, ca) => sum + ca.currentTier, 0),
          warrior: character.abilities
            .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'warrior')
            .reduce((sum, ca) => sum + ca.currentTier, 0),
          assassin: character.abilities
            .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === 'assassin')
            .reduce((sum, ca) => sum + ca.currentTier, 0),
        },
        unlockedAbilities: character.abilities
          .filter(ca => ca.currentTier > 0)
          .map(ca => ({
            id: ca.abilityId,
            name: allAbilities.find(a => a.id === ca.abilityId)?.name,
            tier: ca.currentTier,
            tree: allAbilities.find(a => a.id === ca.abilityId)?.tree,
          })),
        equippedLoadout: character.equippedAbilities
          .filter(Boolean)
          .map(id => ({
            id,
            name: allAbilities.find(a => a.id === id)?.name,
          })),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'assassin'}-build.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with points summary - always visible in step 2 */}
      {step === 2 && (
        <PointsSummary
          character={character}
          totalPoints={totalPoints}
          spentPoints={spentPoints}
          remainingPoints={remainingPoints}
          onBack={() => setStep(1)}
          onReset={handleResetAbilities}
          onExport={handleExportJSON}
        />
      )}

      {/* Main content */}
      <main className={step === 2 ? 'pt-4' : ''}>
        {step === 1 && (
          <WizardStepOne
            initialName={character.name}
            initialLevel={character.level}
            onComplete={handleBasicInfoComplete}
          />
        )}

        {step === 2 && (
          <div className="container max-w-2xl mx-auto px-4 pb-4">
            <div className="mb-6 p-4 rounded-lg border border-border/50 bg-card/30">
              <EquippedLoadout
                character={character}
                onEquip={handleEquipAbility}
                onUnequip={handleUnequipAbility}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <WizardStepTwo
            character={character}
            remainingPoints={remainingPoints}
            onUpgrade={handleUpgradeAbility}
            onDowngrade={handleDowngradeAbility}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
