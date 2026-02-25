

# Plan: Idea 5 — Extract `renderCombatContent()` Into `<CombatSectionContent />`

## The Problem

`renderCombatContent()` (lines 794–911) is a 120-line render function defined *inside* `MobileCombatLayout`. It closes over ~25 variables from the parent scope. It is the largest of the five `render*Content()` functions and contains six distinct subsections: Death Saves, Quick Cast, Sneak Attack info, Attack Queue, Weapons list, Offhand, and Stealth abilities.

Extracting it into its own component file makes `MobileCombatLayout` shorter and gives the combat section a clear, self-documenting props contract.

## Dependency Audit

`renderCombatContent` references these parent-scope variables:

| Category | Variables |
|----------|-----------|
| **Character** | `character.name`, `character.level` |
| **HP/Death** | `currentHP`, `deathSaves`, `onDeathSavesChange`, `onRegainHP` |
| **Spellcasting** | `spellcasting` |
| **Weapons** | `equippedWeapons`, `weaponsMap`, `expandedWeaponId`, `setExpandedWeaponId`, `equipmentImages` |
| **Combat state** | `conditions`, `hasPoisonedWeapon`, `sneakAttackDice`, `combatStats`, `combatSettings` |
| **Action economy** | `actionEconomy.bonusActionUsed`, `actionEconomyState.useBonus()` |
| **Attack queue** | `attackQueue` (sortedQueue, defaultTargetId, actionEconomy, removeFromQueue, reorderAttack, updateAttackTarget, clearQueue) |
| **Targets** | `targetTracker.enemies`, `targetTracker.getTargetForPrompt()` |
| **Abilities** | `stealthAbilities`, `cooldownStateMap`, `abilityImages`, `globalConditions`, `activeSetBonuses`, `concentrationSpell` |
| **Callbacks** | `handleAddToTurn`, `setLastAction`, `handleSpellCastResult`, `handleWeaponRoll`, `handleOffhandRoll`, `handleExecuteQueue`, `handleQueueAttack`, `handleEnhancedAbilityUse`, `cooldownSystem.triggerCooldown` |

That is ~30 individual values. To keep the props interface manageable, I will group them into logical clusters.

## Changes

### File 1 (NEW): `src/components/combat/mobile/CombatSectionContent.tsx`

Create a new component with a grouped props interface:

```typescript
interface CombatSectionContentProps {
  // Character basics
  characterName: string;
  characterLevel: number;
  
  // HP & Death Saves
  currentHP?: number;
  deathSaves?: { successes: number; failures: number };
  onDeathSavesChange?: (saves: { successes: number; failures: number }) => void;
  onRegainHP?: (amount: number) => void;
  
  // Spellcasting (for QuickCastPanel)
  spellcasting?: UseSpellcastingReturn;
  
  // Weapons
  equippedWeapons: WeaponAttack[];
  weaponsMap: { primary: WeaponAttack | null; secondary: WeaponAttack | null; ranged: WeaponAttack | null };
  expandedWeaponId: string | null;
  onToggleWeaponExpand: (id: string | null) => void;
  equipmentImages: Record<string, string>;
  
  // Combat state
  conditions: string[];
  hasPoisonedWeapon: boolean;
  sneakAttackDice: string;
  combatStats: { attackBonus: number; damageBonus: number; ac: number };
  combatSettings: { hasTwoWeaponFightingStyle: boolean; hasDualWielderFeat: boolean };
  bonusActionUsed: boolean;
  
  // Attack queue
  attackQueue: {
    sortedQueue: any[];
    defaultTargetId: string | null;
    actionEconomy: any;
    removeFromQueue: (id: string) => void;
    reorderAttack: (id: string, direction: 'up' | 'down') => void;
    updateAttackTarget: (id: string, targetId: string) => void;
    clearQueue: () => void;
  };
  
  // Targets
  enemies: Enemy[];
  getTargetForPrompt: () => TargetPromptInfo | null;
  
  // Stealth abilities
  stealthAbilities: (Ability & { tier: 1 | 2 | 3 })[];
  cooldownStateMap: Map<string, { isOnCooldown: boolean; remaining: number; total: number }>;
  abilityImages: Record<string, string>;
  globalConditions: ActiveConditionInfo[];
  activeSetBonuses: SetBonusInfo[];
  concentrationSpell: string | null | undefined;
  
  // Callbacks
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', description: string, roll?: string) => void;
  onSetLastAction: (action: string) => void;
  onSpellCastResult: (spellName: string) => void;
  onWeaponRoll: (...args: any[]) => void;
  onOffhandRoll: (...args: any[]) => void;
  onExecuteQueue: () => void;
  onQueueAttack: (...args: any[]) => void;
  onUseAbility: (...args: any[]) => void;
  onUseBonus: () => void;
  onTriggerCooldown: (abilityId: string) => void;
}
```

The component body will be the exact JSX currently inside `renderCombatContent()`, referencing props instead of closure variables.

### File 2: `src/components/combat/mobile/MobileCombatLayout.tsx`

**A.** Add import for `CombatSectionContent`.

**B.** Delete `renderCombatContent` function definition (lines 794–911, ~120 lines).

**C.** Replace the call site (line 1221) with the new component:
```typescript
{/* was: {renderCombatContent()} */}
<CombatSectionContent
  characterName={character.name}
  characterLevel={character.level}
  currentHP={currentHP}
  deathSaves={deathSaves}
  onDeathSavesChange={onDeathSavesChange}
  onRegainHP={onRegainHP}
  spellcasting={spellcasting}
  equippedWeapons={equippedWeapons}
  weaponsMap={weaponsMap}
  expandedWeaponId={expandedWeaponId}
  onToggleWeaponExpand={(id) => setExpandedWeaponId(expandedWeaponId === id ? null : id)}
  equipmentImages={equipmentImages}
  conditions={conditions}
  hasPoisonedWeapon={hasPoisonedWeapon}
  sneakAttackDice={sneakAttackDice}
  combatStats={combatStats}
  combatSettings={combatSettings}
  bonusActionUsed={actionEconomy.bonusActionUsed}
  attackQueue={attackQueue}
  enemies={targetTracker.enemies}
  getTargetForPrompt={targetTracker.getTargetForPrompt}
  stealthAbilities={stealthAbilities}
  cooldownStateMap={cooldownStateMap}
  abilityImages={abilityImages}
  globalConditions={globalConditions}
  activeSetBonuses={activeSetBonuses}
  concentrationSpell={concentrationSpell}
  onAddToTurn={handleAddToTurn}
  onSetLastAction={setLastAction}
  onSpellCastResult={handleSpellCastResult}
  onWeaponRoll={handleWeaponRoll}
  onOffhandRoll={handleOffhandRoll}
  onExecuteQueue={handleExecuteQueue}
  onQueueAttack={handleQueueAttack}
  onUseAbility={handleEnhancedAbilityUse}
  onUseBonus={() => actionEconomyState.useBonus()}
  onTriggerCooldown={cooldownSystem.triggerCooldown}
/>
```

### File 3: `src/components/combat/mobile/index.ts`

Add the new export:
```typescript
export { CombatSectionContent } from './CombatSectionContent';
```

## Net Effect

- `MobileCombatLayout.tsx` shrinks by ~90 lines (120 lines of function body removed, ~30 lines of JSX props added at call site).
- The combat section gains a self-documenting props interface that explicitly lists every dependency.
- No behavioral changes — pure refactor.

## Risk Assessment

**Very low.** This is a mechanical extraction — the JSX moves from a closure function to a component with explicit props. No logic changes. The same values are passed; they just travel via props instead of closure capture.

## Testing Criteria

1. Open the Combat tab — verify all six subsections render (Death Saves when HP=0, Quick Cast, Sneak Attack info, Attack Queue, Weapons, Offhand, Stealth abilities)
2. Use a weapon attack — verify roll triggers and action economy updates
3. Use an offhand attack — verify bonus action marks as used
4. Expand/collapse weapon cards — verify accordion behavior persists
5. Queue and execute attacks — verify attack queue panel works
6. No console errors or warnings

