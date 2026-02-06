
# Plan: Wire Initiative Detection to Combat Initiative Tracker

## Overview
Connect the existing initiative detection patterns in Chronicle Sync to auto-populate the combat initiative tracker, eliminating the need for manual entry when session logs contain initiative roll information.

## Current State Analysis

### What Already Exists
1. **Initiative Pattern Detection** (`src/lib/chronicleSync/patterns/initiative.ts`)
   - Parses text for patterns like "Initiative: 18", "rolls 15 for initiative", "Initiative order: Goblin 12, Player 18"
   - Returns `InitiativeMatch[]` with `singleRoll` for player values and `rolls[]` array for named combatants

2. **Initiative Hook** (`src/hooks/use-initiative.ts`)
   - `setPlayerInitiative(value: number | null)` - sets player's initiative
   - Enemies receive initiative via `updateEnemy(id, { initiative: value })`

3. **Enhanced Patterns System** (`src/lib/chronicleSync/patterns/index.ts`)
   - Already exports `parseInitiativeMatches` in barrel file
   - `parseEnhancedPatterns()` in the patterns barrel already includes initiative parsing

4. **AutoApply Panel Pattern**
   - Other detections (rest, death saves, spell slots, inspiration, temp HP) are already wired to AutoApplyPanel
   - Each category has its own toggle, preview, and apply handler

### What's Missing
- Initiative matches aren't exposed through `enhancedPatterns.ts` (main file)
- No UI in AutoApplyPanel for initiative
- No props/handlers in ChronicleSyncScreen for applying initiative
- No connection from Index.tsx to pass initiative handlers

---

## Implementation Steps

### Step 1: Expose Initiative in Enhanced Patterns
**File:** `src/lib/chronicleSync/enhancedPatterns.ts`

- Add import for `parseInitiativeMatches` and `InitiativeMatch` from patterns barrel
- Add `initiativeRolls: InitiativeMatch[]` to `EnhancedPatternResults` interface
- Call `parseInitiativeMatches(text)` in `parseEnhancedPatterns()` function
- Export the `InitiativeMatch` type for consumers

### Step 2: Update AutoApplyPanel Props and State
**File:** `src/components/chronicle/AutoApplyPanel.tsx`

Add new props:
```typescript
// Current player initiative (null if unset)
playerInitiative: number | null;
// Current enemies with initiative
enemies: Enemy[];
// Handler to set player initiative
onApplyPlayerInitiative?: (value: number) => void;
// Handler to set enemy initiative
onApplyEnemyInitiative?: (enemyId: string, value: number) => void;
```

Add to `pendingChanges` calculation:
- Parse initiative matches from `enhancedResults.initiativeRolls`
- Detect player initiative (unnamed rolls or "You" prefixed)
- Match named rolls to existing enemies using fuzzy matching
- Calculate which values need applying (skip if already set)

Add new UI row for initiative:
- Icon: `Swords` (already used for initiative in other components)
- Show detected player initiative value with preview
- Show count of enemy initiative values to apply
- Apply button that calls both handlers

### Step 3: Update ChronicleSyncScreen Props
**File:** `src/components/chronicle/ChronicleSyncScreen.tsx`

Add new props to interface:
```typescript
playerInitiative: number | null;
onApplyPlayerInitiative?: (value: number) => void;
onApplyEnemyInitiative?: (enemyId: string, value: number) => void;
```

Pass initiative data through enhancedResults:
```typescript
enhancedResults={enhancedResults ? {
  // ...existing
  initiativeRolls: enhancedResults.initiativeRolls,
} : undefined}
```

Wire up the new handlers to AutoApplyPanel.

### Step 4: Wire Up Handlers in Index.tsx
**File:** `src/pages/Index.tsx`

Pass the initiative-related props to ChronicleSyncScreen:
```typescript
playerInitiative={initiative.playerInitiative}
onApplyPlayerInitiative={(value) => {
  initiative.setPlayerInitiative(value);
  toast({
    title: "⚔️ Initiative Set",
    description: `Player initiative: ${value}`,
  });
}}
onApplyEnemyInitiative={(enemyId, value) => {
  targets.updateEnemy(enemyId, { initiative: value });
  const enemy = targets.enemies.find(e => e.id === enemyId);
  toast({
    title: "⚔️ Enemy Initiative Set",
    description: `${enemy?.name || 'Enemy'}: ${value}`,
  });
}}
```

### Step 5: Add Fuzzy Enemy Matching for Initiative
**File:** `src/components/chronicle/AutoApplyPanel.tsx` (within pending changes calculation)

When an initiative match has a name (from "Goblin 15" format):
- Use existing fuzzy matching (from `src/lib/chronicleSync/fuzzyMatch.ts`) to find matching enemy
- Match criteria: name similarity > 0.6, enemy exists in tracker
- Only include in "to apply" list if enemy doesn't already have initiative set

---

## UI Behavior

### Collapsed Preview
When initiative is detected, show badge:
- `⚔️ Init 18` for player initiative
- `⚔️ 3 enemies` for enemy initiatives
- Combined: `⚔️ Init 18 + 3 enemies`

### Expanded Row
```
[ ⚔️ ] Initiative
  You: 18  →  Set
  Goblin: 15  →  Match to "Goblin 1"
  Orc: 12  →  Match to "Orc Warrior"
  
  [Apply All Initiative]
```

### Edge Cases
- If player initiative already set and detected value differs: show "18 → 22 (override)"
- If no matching enemy found for a name: show "Bandit (no match found)" in muted text
- If all initiatives already set: hide the section entirely

---

## Technical Considerations

### Type Updates Required
**File:** `src/lib/chronicleSync/enhancedTypes.ts`

Add to `AutoApplyConfig`:
```typescript
initiative: boolean; // default: true
```

### Pattern Improvements (Optional Future Work)
The current initiative patterns could be enhanced to:
- Better detect "You roll 18 for initiative" as player roll
- Handle "Party rolls initiative" with multiple values
- Detect DM-style "Everyone roll initiative" markers

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/chronicleSync/enhancedPatterns.ts` | Export initiative parsing |
| `src/lib/chronicleSync/enhancedTypes.ts` | Add `initiative` to AutoApplyConfig |
| `src/components/chronicle/AutoApplyPanel.tsx` | Add initiative UI row and logic |
| `src/components/chronicle/ChronicleSyncScreen.tsx` | Pass initiative props |
| `src/pages/Index.tsx` | Wire up initiative handlers |

---

## Testing Criteria

1. **Player Initiative Detection**
   - Paste "You roll initiative: 18" → should show "⚔️ Init 18" in preview
   - Click Apply → player initiative in combat tracker should be 18
   
2. **Enemy Initiative Detection**  
   - Add "Goblin 1" to target tracker
   - Paste "Initiative order: Goblin 15, Orc 12"
   - Should show "Goblin 1: 15" matched in AutoApply panel
   - Apply → Goblin 1's initiative should be set to 15
   
3. **No Duplicates**
   - If player initiative already 18, same value detected should not show
   - Different value should show with "override" indicator

4. **Integration with Combat Start**
   - After applying initiative, "Start Combat" button should be enabled
   - Initiative order should sort correctly (highest first)
