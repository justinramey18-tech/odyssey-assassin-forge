

# Target/Enemy Tracker Implementation

## Overview
Add a Target/Enemy Tracker system that allows players to manage a list of enemies during combat, assign a current target, and automatically include target information in all AI DM prompts for richer narrative context.

---

## Core Features

### 1. Enemy Data Model
Each enemy will have:
- `id`: Unique identifier
- `name`: Enemy name (e.g., "Goblin 1", "Orc Warlord")
- `currentHP`: Current hit points
- `maxHP`: Maximum hit points
- `ac`: Armor Class
- `notes`: Optional notes (e.g., "immune to fire", "low AC but high HP")
- `isCurrentTarget`: Boolean for target selection

### 2. Hook: `use-targets.ts`
A new custom hook following the `use-conditions.ts` pattern:
- localStorage persistence with key `dnd-combat-targets`
- CRUD operations: add, remove, update enemy
- Target selection: setCurrentTarget
- Damage tracking: dealDamage, healEnemy
- Clear on combat end
- Maximum of 10 enemies (to prevent clutter)

### 3. UI Component: Target Tracker Panel
Location: Integrated into the Combat tab's SituationStrip or as a new collapsible section
- Collapsed view: Shows current target name and HP bar
- Expanded view: List of all enemies with HP/AC
- Quick actions: Tap to target, swipe to remove
- Add enemy sheet with name, HP, AC inputs

### 4. Prompt Integration
Update the `CombatPromptContext` to include:
- `currentTarget`: The selected target's info
- Update `generateWeaponPrompt()` to include target context
- Update `CombatAbilityCard` prompt generation to include target
- Update `SmartPromptSheet` to reference targets in synthesis

---

## Technical Implementation

### New Files

| File | Purpose |
|------|---------|
| `src/lib/combat/targetTypes.ts` | Target/Enemy type definitions |
| `src/hooks/use-targets.ts` | Target management hook with localStorage |
| `src/components/combat/mobile/TargetTrackerPanel.tsx` | Main UI component |
| `src/components/combat/mobile/AddEnemySheet.tsx` | Bottom sheet for adding enemies |
| `src/components/combat/mobile/EnemyCard.tsx` | Individual enemy display card |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/combat/promptContext.ts` | Add `TargetInfo` interface and `formatTargetForPrompt()` |
| `src/components/combat/mobile/MobileCombatLayout.tsx` | Integrate hook, pass target to components |
| `src/components/combat/mobile/MobileWeaponCard.tsx` | Accept target prop, include in prompt |
| `src/components/combat/mobile/CombatAbilityCard.tsx` | Accept target prop, include in prompt |
| `src/components/combat/mobile/SmartPromptSheet.tsx` | Include target list in synthesis request |
| `src/components/combat/mobile/index.ts` | Export new components |

---

## Detailed Component Designs

### Target Tracker Panel
```text
+------------------------------------------------+
| 🎯 TARGET: Orc Warlord (AC 16)                |
| [████████░░] 45/60 HP                          |
| [Change Target ▼] [+ Add Enemy]               |
+------------------------------------------------+
```

When expanded:
```text
+------------------------------------------------+
| 🎯 ENEMIES IN COMBAT                    [−]   |
+------------------------------------------------+
| ● Orc Warlord (AC 16)  [████████░░] 45/60    |
|   ⭐ CURRENT TARGET                           |
+------------------------------------------------+
| ○ Goblin 1 (AC 13)     [██████████] 12/12    |
+------------------------------------------------+
| ○ Goblin 2 (AC 13)     [░░░░░░░░░░] 0/12 💀  |
|   DEFEATED                                    |
+------------------------------------------------+
| [+ Add Enemy]                                 |
+------------------------------------------------+
```

### Add Enemy Sheet
- Name input (required)
- HP slider or input (default: 20, range 1-500)
- AC slider (default: 13, range 5-25)
- Optional notes textarea
- "Add Enemy" button
- Quick presets: Minion (10 HP, AC 10), Standard (30 HP, AC 13), Elite (60 HP, AC 16)

---

## Prompt Integration Examples

### Weapon Attack Prompt (Enhanced)
```markdown
## ⚔️ ATTACK

**Character:** Wade Wilson
**Weapon:** Katana
**Roll:** 1d20+8 = [17] = **25**

### 🎯 Target
**Enemy:** Orc Warlord (AC 16)
**HP Status:** 45/60 (bloodied)
*The warlord is wounded but still fighting fiercely.*

**Damage on Hit:** 1d8+5 slashing

*"That's gonna leave a mark, big guy!"*
```

### Ability Prompt (Enhanced)
Adds target context section with:
- Target name and AC
- HP status (healthy/bloodied/near death/unconscious)
- Any notes about the target
- Narrative hints based on target state

---

## Hook API Design

```typescript
interface UseTargetsReturn {
  // State
  enemies: Enemy[];
  currentTarget: Enemy | null;
  
  // Actions
  addEnemy: (input: NewEnemyInput) => boolean;
  removeEnemy: (id: string) => void;
  updateEnemy: (id: string, updates: Partial<Enemy>) => void;
  setCurrentTarget: (id: string | null) => void;
  
  // Combat helpers
  dealDamage: (id: string, amount: number) => void;
  healEnemy: (id: string, amount: number) => void;
  
  // Computed
  enemyCount: number;
  defeatedCount: number;
  activeEnemies: Enemy[];
  
  // Utility
  clearAll: () => void;
  getTargetForPrompt: () => TargetPromptInfo | null;
}
```

---

## Integration Points

### 1. MobileCombatLayout Integration
- Initialize `useTargets()` hook
- Pass `currentTarget` to weapon cards, ability cards
- Include in SmartPromptSheet synthesis
- Display TargetTrackerPanel below SituationStrip

### 2. Prompt Context Update
Add to `CombatPromptContext`:
```typescript
currentTarget: {
  name: string;
  ac: number;
  currentHP: number;
  maxHP: number;
  notes?: string;
} | null;
```

New helper function:
```typescript
function formatTargetForPrompt(target: TargetPromptInfo | null): string
```

### 3. Combat Log Enhancement
Include target name in logged actions for better synthesis context.

---

## User Experience Flow

1. **Start Combat**: User taps "+" to add first enemy
2. **Quick Add**: Enter name, HP, AC → enemy appears in list
3. **Target Selection**: Tap enemy to mark as current target
4. **Attack Flow**: Weapon cards now show "vs. [Target Name]"
5. **Damage Tracking**: After declaring hit, tap enemy HP to reduce
6. **Defeat**: When HP reaches 0, enemy marked as defeated
7. **Target Switch**: Tap different enemy to change target
8. **End Combat**: "Clear All" removes all enemies

---

## Estimated Changes

| Component | Lines Changed |
|-----------|---------------|
| New `targetTypes.ts` | ~40 lines |
| New `use-targets.ts` | ~200 lines |
| New `TargetTrackerPanel.tsx` | ~200 lines |
| New `AddEnemySheet.tsx` | ~150 lines |
| New `EnemyCard.tsx` | ~120 lines |
| Modified `promptContext.ts` | +30 lines |
| Modified `MobileCombatLayout.tsx` | +40 lines |
| Modified `MobileWeaponCard.tsx` | +25 lines |
| Modified `CombatAbilityCard.tsx` | +25 lines |
| Modified `SmartPromptSheet.tsx` | +15 lines |

**Total: ~845 lines of new/modified code**

