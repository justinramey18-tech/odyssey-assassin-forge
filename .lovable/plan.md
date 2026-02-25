

# Plan: Idea 4 — Delete Local ActionEconomy Fallback, Make `actionEconomyState` Required

## Summary

Remove the local `ActionEconomy` fallback state from `MobileCombatLayout.tsx` and make `actionEconomyState` a required prop. This eliminates all `if (actionEconomyState)` branching in four handler functions, reducing ~60 lines of dead-path code. The prop is already **always** passed from `Index.tsx → CombatTabScreen → MobileCombatLayout`, so the fallback path is never actually executed in production.

Think of it as removing a backup oxygen tank that's been strapped to the gurney but never connected to the patient — it adds weight and confusion but provides zero actual redundancy.

---

## Changes

### File 1: `src/components/combat/mobile/MobileCombatLayout.tsx`

**A. Props interface (line 97)** — Change `actionEconomyState` from optional to required:
```typescript
// BEFORE
actionEconomyState?: UseActionEconomyReturn;

// AFTER
actionEconomyState: UseActionEconomyReturn;
```

**B. Delete local fallback state (lines 260–272)** — Remove all six lines of local state and the three derived variable assignments. Replace with direct destructuring:
```typescript
// BEFORE (lines 260-272)
const [localActionEconomy, setLocalActionEconomy] = useState<ActionEconomy>({...});
const [localTurnActions, setLocalTurnActions] = useState<TurnAction[]>([]);
const actionEconomy = actionEconomyState?.economy ?? localActionEconomy;
const setActionEconomy = actionEconomyState?.setEconomy ?? setLocalActionEconomy;
const turnActions = actionEconomyState?.turnActions ?? localTurnActions;

// AFTER
const actionEconomy = actionEconomyState.economy;
const setActionEconomy = actionEconomyState.setEconomy;
const turnActions = actionEconomyState.turnActions;
```

**C. Simplify `handleAddToTurn` (lines 425–446)** — Remove the `if/else` branch, call the hook method directly:
```typescript
// AFTER
const handleAddToTurn = useCallback((
  actionType: 'action' | 'bonus' | 'reaction',
  description: string,
  roll?: string
) => {
  actionEconomyState.addTurnAction({ type: actionType, description, roll });
}, [actionEconomyState]);
```

**D. Simplify `handleResetTurn` (lines 717–731)** — Remove the `if/else`, call directly:
```typescript
// AFTER
const handleResetTurn = useCallback(() => {
  actionEconomyState.resetTurn();
  setLastAction('TURN RESET');
}, [actionEconomyState]);
```

**E. Simplify `handleRemoveAction` (lines 734–750)** — Remove the `if/else`:
```typescript
// AFTER
const handleRemoveAction = useCallback((index: number) => {
  actionEconomyState.removeTurnAction(index);
}, [actionEconomyState]);
```

**F. Simplify `handleRemoveActionByDescription` (lines 753–777)** — Remove the `else` branch:
```typescript
// AFTER
const handleRemoveActionByDescription = useCallback((description: string) => {
  const index = turnActions.findIndex(a => a.description === description);
  if (index !== -1) {
    actionEconomyState.removeTurnAction(index);
  }
}, [actionEconomyState, turnActions]);
```

**G. Simplify offhand `onUseBonus` callback (line 946)** — Remove the nullish coalescing fallback:
```typescript
// BEFORE
onUseBonus={() => actionEconomyState?.useBonus?.() ?? setActionEconomy({...actionEconomy, bonusActionUsed: true})}

// AFTER
onUseBonus={() => actionEconomyState.useBonus()}
```

**H. Simplify reaction handler (line 1061)** — Use the hook's `useReaction` method instead of manually calling `setActionEconomy`:
```typescript
// BEFORE
setActionEconomy(prev => ({ ...prev, reactionUsed: true }));

// AFTER
actionEconomyState.useReaction();
```

### File 2: `src/components/combat/CombatTabScreen.tsx`

**Props interface (line 52)** — Change from optional to required to match:
```typescript
// BEFORE
actionEconomyState?: UseActionEconomyReturn;

// AFTER
actionEconomyState: UseActionEconomyReturn;
```

No other changes needed in this file — the prop is already passed through to `MobileCombatLayout` at line 280, and `Index.tsx` already provides it at line 2378.

---

## What Gets Removed

| Item | Lines saved |
|------|-------------|
| Local `useState` declarations (2) | 8 lines |
| Derived variable fallbacks (3) | 3 lines |
| `handleAddToTurn` else branch | 10 lines |
| `handleResetTurn` else branch | 8 lines |
| `handleRemoveAction` else branch | 12 lines |
| `handleRemoveActionByDescription` else branch | 14 lines |
| Offhand `onUseBonus` fallback | 1 line simplified |
| Reaction `setActionEconomy` call | 1 line simplified |
| **Total** | **~55 lines removed** |

---

## Risk Assessment

**Low risk.** `Index.tsx` always instantiates `useActionEconomy()` and passes it as `actionEconomy` to `CombatTabScreen`, which passes it through to `MobileCombatLayout`. The fallback path was defensive code from before the hook existed — it is never exercised.

---

## Testing Criteria

1. Open the Combat tab on mobile — verify action economy bar displays correctly
2. Use a weapon attack — verify the Action slot marks as used and a turn action appears
3. Use an offhand attack — verify Bonus Action marks as used
4. Use a reaction — verify Reaction marks as used
5. Reset turn — verify all slots clear and turn actions disappear
6. Remove a single turn action — verify the corresponding slot restores to available
7. End turn via the ActionEconomyBar — verify reset and initiative advancement still work
8. Verify no console errors or warnings

