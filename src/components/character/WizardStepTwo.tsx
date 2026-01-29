import { Character } from '@/lib/types';
import { allAbilities, getAbilitiesByTree } from '@/lib/abilities';
import { AbilityTreeAccordion } from './AbilityTreeAccordion';
import {
  Accordion,
} from '@/components/ui/accordion';

interface WizardStepTwoProps {
  character: Character;
  remainingPoints: number;
  onUpgrade: (abilityId: string) => void;
  onDowngrade: (abilityId: string) => void;
}

export function WizardStepTwo({
  character,
  remainingPoints,
  onUpgrade,
  onDowngrade,
}: WizardStepTwoProps) {
  const getCharacterAbilityTier = (abilityId: string): 0 | 1 | 2 | 3 => {
    const ca = character.abilities.find(a => a.abilityId === abilityId);
    return ca?.currentTier ?? 0;
  };

  const getPointsInTree = (tree: 'hunter' | 'warrior' | 'assassin') => {
    return character.abilities
      .filter(ca => allAbilities.find(a => a.id === ca.abilityId)?.tree === tree)
      .reduce((sum, ca) => sum + ca.currentTier, 0);
  };

  const canUpgrade = (abilityId: string): boolean => {
    if (remainingPoints <= 0) return false;
    
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability) return false;

    const currentTier = getCharacterAbilityTier(abilityId);
    if (currentTier >= 3) return false;

    // Check level requirement
    if (ability.minLevel && character.level < ability.minLevel) return false;

    // Check prerequisite
    if (ability.prerequisite) {
      const prereqTier = getCharacterAbilityTier(ability.prerequisite.abilityId);
      if (prereqTier < ability.prerequisite.tier) return false;
    }

    return true;
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 pb-8">
      <Accordion type="single" collapsible className="space-y-4">
        <AbilityTreeAccordion
          tree="hunter"
          abilities={getAbilitiesByTree('hunter')}
          pointsInTree={getPointsInTree('hunter')}
          characterLevel={character.level}
          characterName={character.name}
          getAbilityTier={getCharacterAbilityTier}
          canUpgrade={canUpgrade}
          onUpgrade={onUpgrade}
          onDowngrade={onDowngrade}
        />

        <AbilityTreeAccordion
          tree="warrior"
          abilities={getAbilitiesByTree('warrior')}
          pointsInTree={getPointsInTree('warrior')}
          characterLevel={character.level}
          characterName={character.name}
          getAbilityTier={getCharacterAbilityTier}
          canUpgrade={canUpgrade}
          onUpgrade={onUpgrade}
          onDowngrade={onDowngrade}
        />

        <AbilityTreeAccordion
          tree="assassin"
          abilities={getAbilitiesByTree('assassin')}
          pointsInTree={getPointsInTree('assassin')}
          characterLevel={character.level}
          characterName={character.name}
          getAbilityTier={getCharacterAbilityTier}
          canUpgrade={canUpgrade}
          onUpgrade={onUpgrade}
          onDowngrade={onDowngrade}
        />
      </Accordion>
    </div>
  );
}
