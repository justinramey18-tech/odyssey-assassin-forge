import { useState } from 'react';
import { Character, CharacterAbility, getAbilityPointsForLevel, getTotalPointsSpent } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { WizardStepOne } from '@/components/character/WizardStepOne';
import { WizardStepTwo } from '@/components/character/WizardStepTwo';
import { PointsSummary } from '@/components/character/PointsSummary';
import { EquippedLoadout } from '@/components/character/EquippedLoadout';
import { ActionWheelButton } from '@/components/character/ActionWheelButton';
import { InventoryScreen } from '@/components/inventory/InventoryScreen';
import { AchievementsScreen } from '@/components/achievements/AchievementsScreen';
import { ConstellationScreen } from '@/components/constellation/ConstellationScreen';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Swords, Backpack, Trophy, Sparkles } from 'lucide-react';
import { 
  CharacterEquipment, 
  EquipmentItem,
  createInitialEquipment,
} from '@/lib/inventory/index';

const Index = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<'abilities' | 'inventory' | 'achievements' | 'constellation'>('abilities');
  const [character, setCharacter] = useState<Character>({
    name: '',
    level: 1,
    abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
    equippedAbilities: [],
  });
  
  // Shared equipment state for constellation view
  const [equipment, setEquipment] = useState<CharacterEquipment>(() => createInitialEquipment());

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
{step === 2 && (activeTab === 'abilities' || activeTab === 'achievements') && (
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
      <main className={step === 2 && (activeTab === 'abilities' || activeTab === 'achievements') ? 'pt-4' : ''}>
        {step === 1 && (
          <WizardStepOne
            initialName={character.name}
            initialLevel={character.level}
            onComplete={handleBasicInfoComplete}
          />
        )}

        {step === 2 && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'abilities' | 'inventory' | 'achievements' | 'constellation')} className="w-full">
            {/* Tab Navigation - Fixed at top with Assassin's Creed / Deadpool theme */}
            <div className="sticky top-0 z-40 bg-gradient-to-b from-background via-background/98 to-background/90 backdrop-blur-md border-b border-red-900/30 px-4 py-3">
              {/* Decorative top line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              
              <TabsList className="grid w-full grid-cols-4 max-w-xl mx-auto bg-black/40 border border-red-900/40 p-1 rounded-none relative overflow-hidden">
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-500/70" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-500/70" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-500/70" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-500/70" />
                
                <TabsTrigger 
                  value="abilities" 
                  className="gap-1.5 data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-600/30 data-[state=active]:to-red-900/20 data-[state=active]:text-red-400 data-[state=active]:border-b-2 data-[state=active]:border-red-500 rounded-none font-cinzel uppercase tracking-wider text-[10px] transition-all"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Skills</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="inventory" 
                  className="gap-1.5 data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-amber-900/20 data-[state=active]:text-amber-400 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none font-cinzel uppercase tracking-wider text-[10px] transition-all"
                >
                  <Backpack className="w-3.5 h-3.5" />
                  <span>Gear</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="achievements" 
                  className="gap-1.5 data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-purple-900/20 data-[state=active]:text-purple-400 data-[state=active]:border-b-2 data-[state=active]:border-purple-500 rounded-none font-cinzel uppercase tracking-wider text-[10px] transition-all"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Feats</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="constellation" 
                  className="gap-1.5 data-[state=active]:bg-gradient-to-b data-[state=active]:from-cyan-600/30 data-[state=active]:to-cyan-900/20 data-[state=active]:text-cyan-400 data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 rounded-none font-cinzel uppercase tracking-wider text-[10px] transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Stars</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Decorative bottom accent */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            </div>

            {/* Abilities Tab Content */}
            <TabsContent value="abilities" className="mt-0 pb-4">
              <div className="container max-w-2xl mx-auto px-4 pb-4">
                <div className="mb-6 p-4 rounded-lg border border-border/50 bg-card/30">
                  <EquippedLoadout
                    character={character}
                    onEquip={handleEquipAbility}
                    onUnequip={handleUnequipAbility}
                  />
                </div>
              </div>

              <WizardStepTwo
                character={character}
                remainingPoints={remainingPoints}
                onUpgrade={handleUpgradeAbility}
                onDowngrade={handleDowngradeAbility}
              />
            </TabsContent>

            {/* Inventory Tab Content */}
            <TabsContent value="inventory" className="mt-0">
              <InventoryScreen
                characterName={character.name}
                level={character.level}
                onBack={() => setActiveTab('abilities')}
                equipment={equipment}
                onEquipmentChange={setEquipment}
              />
            </TabsContent>

            {/* Achievements Tab Content */}
            <TabsContent value="achievements" className="mt-0">
              <AchievementsScreen
                characterName={character.name}
                onBack={() => setActiveTab('abilities')}
              />
            </TabsContent>

            {/* Constellation Tab Content */}
            <TabsContent value="constellation" className="mt-0">
              <ConstellationScreen
                characterName={character.name}
                equippedItems={Object.values(equipment.slots).filter(Boolean) as EquipmentItem[]}
                onBack={() => setActiveTab('abilities')}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Floating Action Wheel - only visible in step 2 abilities/achievements tab */}
        {step === 2 && (activeTab === 'abilities' || activeTab === 'achievements') && (
          <ActionWheelButton characterName={character.name} />
        )}
      </main>
    </div>
  );
};

export default Index;
