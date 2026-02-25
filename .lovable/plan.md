

# Plan: Idea 7 — Extract Combat Action Handlers Into `useCombatActions` Hook

## The Problem

After ideas 5–6 and the section content extractions, `MobileCombatLayout.tsx` is ~1125 lines. The largest remaining complexity is the block of **combat action callback handlers** (lines 449–676, ~230 lines):

- `handleEnhancedAbilityUse` (lines 449–483)
- `handleWeaponRoll` (lines 486–528)
- `handleOffhandRoll` (lines 531–569)
- `handleQueueAttack` (lines 572–580)
- `handleExecuteQueue` (lines 583–676)

These all follow the same pattern: receive roll data → set dice modal state → log to combatLog → call handleAddToTurn. They close over `combatStats`, `combatSettings`, `conditions`, `character`, `targetTracker`, `combatLog`, `attackQueue`, and the dice modal setters.

Extracting them into a `useCombatActions` hook will:
- Remove ~200 lines from the layout component
- Co-locate all roll-handling logic in one testable unit
- Make the dice modal state internal to the hook (it's only set by these handlers and read by the JSX)

## Dependency Audit

The handlers depend on:

| Category | Variables |
|----------|-----------|
| **Dice modal** | `setDiceRoll`, `setDicePrompt`, `setActiveAbility`, `setActiveTier`, `setShowDiceModal` |
| **Status** | `setLastAction` |
| **Character** | `character.name`, `character.level` |
| **Combat** | `combatStats`, `combatSettings`, `conditions`, `hasPoisonedWeapon` |
| **Systems** | `combatLog`, `targetTracker`, `attackQueue`, `cooldownSystem`, `handleAddToTurn` |

The dice modal state (`diceRoll`, `dicePrompt`, `activeAbility`, `activeTier`, `showDiceModal`) is **only written** by these handlers and **only read** by the `DiceRollModal` JSX. Moving these `useState` calls into the hook is safe.

## Changes

### File 1 (NEW): `src/hooks/use-combat-actions.ts`

```typescript
interface UseCombatActionsProps {
  characterName: string;
  characterLevel: number;
  combatStats: { attackBonus: number; damageBonus: number; ac: number };
  combatSettings: { hasTwoWeaponFightingStyle: boolean; hasDualWielderFeat: boolean };
  conditions: string[];
  hasPoisonedWeapon: boolean;
  combatLog: UseCombatLogReturn;
  targetTracker: UseTargetsReturn;
  attackQueue: UseAttackQueueReturn;
  cooldownSystem: UseCooldownsReturn;
  onAddToTurn: (type: 'action' | 'bonus' | 'reaction', desc: string, roll?: string) => void;
}

interface UseCombatActionsReturn {
  // Dice modal state (moved here)
  diceRoll: DiceRoll | null;
  dicePrompt: string;
  activeAbility: Ability | null;
  activeTier: 1 | 2 | 3;
  showDiceModal: boolean;
  setShowDiceModal: (open: boolean) => void;
  lastAction: string;
  setLastAction: (action: string) => void;

  // Handlers
  handleEnhancedAbilityUse: (...) => void;
  handleWeaponRoll: (...) => void;
  handleOffhandRoll: (...) => void;
  handleQueueAttack: (...) => void;
  handleExecuteQueue: () => void;
  handleAbilityUse: (ability: Ability & { tier: 1|2|3 }) => void;
  handleQuickRoll: () => void;
  handleQuickAttack: () => void;
  handleQuickHide: () => void;
}
```

The hook body will contain all the `useState` declarations for the dice modal and `lastAction`, plus all six `useCallback` handlers, moved verbatim from `MobileCombatLayout`.

### File 2: `src/components/combat/mobile/MobileCombatLayout.tsx`

**A.** Add import for `useCombatActions`.

**B.** Remove these `useState` declarations (~6 lines):
- `showDiceModal`, `diceRoll`, `dicePrompt`, `activeAbility`, `activeTier`, `lastAction`

**C.** Remove these handler functions (~230 lines):
- `handleAbilityUse`, `handleEnhancedAbilityUse`, `handleWeaponRoll`, `handleOffhandRoll`, `handleQueueAttack`, `handleExecuteQueue`, `handleQuickRoll`, `handleQuickAttack`, `handleQuickHide`

**D.** Call the hook and destructure:
```typescript
const {
  diceRoll, dicePrompt, activeAbility, activeTier,
  showDiceModal, setShowDiceModal,
  lastAction, setLastAction,
  handleEnhancedAbilityUse, handleWeaponRoll,
  handleOffhandRoll, handleQueueAttack,
  handleExecuteQueue, handleAbilityUse,
  handleQuickRoll, handleQuickAttack, handleQuickHide,
} = useCombatActions({
  characterName: character.name,
  characterLevel: character.level,
  combatStats,
  combatSettings,
  conditions,
  hasPoisonedWeapon,
  combatLog,
  targetTracker,
  attackQueue,
  cooldownSystem,
  onAddToTurn: handleAddToTurn,
});
```

All existing references to these names remain unchanged — destructured names match current names.

## Net Effect

- `MobileCombatLayout.tsx` shrinks by ~230 lines (from ~1125 to ~895).
- All roll-handling and dice modal state is co-located in one hook.
- No behavioral changes — pure extraction.

## Risk Assessment

**Low.** The handlers are self-contained callbacks. The dice modal state is only written by these handlers and read by `DiceRollModal` in the JSX. Moving them into a hook changes nothing about data flow.

One subtlety: `handleQuickAttack` calls `handleWeaponRoll`, and `handleQuickHide` calls `handleAddToTurn`. Both will be internal to the hook, so inter-handler references become simpler (no stale closure risk since they share the same hook scope).

## Testing Criteria

1. Open Combat tab — use a weapon attack, verify dice modal appears with correct prompt
2. Use an offhand attack — verify bonus action logged
3. Queue 2+ attacks and execute — verify multi-attack prompt and combat log entries
4. Use an ability from ACTIONS section — verify enhanced ability use with weapon synergy
5. Tap FAB quick-roll, quick-attack, quick-hide — verify each works
6. No console errors or warnings

