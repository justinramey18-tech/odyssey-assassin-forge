
# Attack Queue System with Multi-Target Support

## Overview
This plan adds an **Attack Queue** system to the Combat tab that allows players to:
1. Select specific enemies as targets for each attack
2. Queue multiple attacks on the same enemy
3. Queue attacks on multiple different enemies with an ordering mechanism
4. Generate AI DM prompts that include the selected target(s) for each attack

---

## Technical Architecture

### Core Concept: Attack Queue

Instead of single-shot attacks, players will build an "Attack Queue" containing ordered attacks, each with an assigned target. When ready, they can execute the entire queue to generate a combined AI prompt.

```text
┌─────────────────────────────────────────────┐
│             ATTACK QUEUE                    │
├─────────────────────────────────────────────┤
│ 1. Shortsword → Goblin #1        [×] [▲▼]  │
│ 2. Shortsword + Sneak → Goblin #1 [×] [▲▼]  │
│ 3. Dagger (offhand) → Orc        [×] [▲▼]  │
├─────────────────────────────────────────────┤
│    [Clear Queue]    [Execute Attacks]       │
└─────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### 1. New Type Definitions
**File:** `src/lib/combat/attackQueue.ts` (NEW)

```typescript
interface QueuedAttack {
  id: string;
  weapon: WeaponAttack;
  rollType: 'normal' | 'sneak' | 'assassinate';
  targetId: string | null;      // Enemy ID or null for "no specific target"
  targetName: string | null;    // Cached name for display
  order: number;                // Position in queue
  isOffhand?: boolean;
}

interface AttackQueueState {
  attacks: QueuedAttack[];
  selectedTargetId: string | null;  // Currently selected target for next attack
}
```

### 2. Attack Queue Hook
**File:** `src/hooks/use-attack-queue.ts` (NEW)

Manages the attack queue state with functions:
- `addToQueue(weapon, rollType, targetId, isOffhand?)` - Add attack to queue
- `removeFromQueue(id)` - Remove specific attack
- `reorderAttack(id, direction: 'up' | 'down')` - Change attack order
- `setDefaultTarget(targetId)` - Set default target for new attacks
- `clearQueue()` - Clear all queued attacks
- `executeQueue()` - Process all attacks and return combined prompt data
- Persists to localStorage for session continuity

### 3. Target Selection UI Component
**File:** `src/components/combat/mobile/TargetSelector.tsx` (NEW)

A compact, mobile-friendly target selection component:
- Displays as a row of chips/pills showing active enemies
- Current target highlighted with ring/glow
- Tap to select, shows "(No Target)" option
- Displays enemy HP status via color coding

```text
┌────────────────────────────────────────────┐
│ 🎯 TARGET: [None] [Goblin #1✓] [Orc] [Troll] │
└────────────────────────────────────────────┘
```

### 4. Attack Queue Panel
**File:** `src/components/combat/mobile/AttackQueuePanel.tsx` (NEW)

Visual queue management component:
- Lists all queued attacks with target assignments
- Drag handles or up/down buttons for reordering
- Delete button per entry
- "Execute All" button to process queue
- Shows estimated total damage
- Collapsible for space efficiency

### 5. Modify MobileWeaponCard
**File:** `src/components/combat/mobile/MobileWeaponCard.tsx`

**Changes:**
- Add "Queue Attack" mode alongside "Execute Immediately" mode
- Add target selector dropdown/chip row when queueing
- New prop: `onQueueAttack` callback
- New prop: `currentTargetId` for pre-selection
- Visual indication when attack is queued

### 6. Modify MobileCombatLayout
**File:** `src/components/combat/mobile/MobileCombatLayout.tsx`

**Changes:**
- Integrate `useAttackQueue` hook
- Add `AttackQueuePanel` to the Combat tab
- Wire up target selection state
- Pass target context to weapon cards
- Handle queue execution flow

### 7. Enhanced Prompt Generation
**File:** `src/lib/combat/attackQueuePrompts.ts` (NEW)

New function to generate multi-attack prompts:

```typescript
function generateMultiAttackPrompt(
  attacks: ExecutedAttack[],
  characterName: string,
  enemies: Enemy[]
): string
```

Output format includes all attacks with their targets:
```markdown
## ⚔️ MULTI-ATTACK SEQUENCE

**Character:** Σκιά
**Total Attacks:** 3

---

### Attack 1: Shortsword → Goblin #1
**Roll:** 1d20+7 = [18] = **25**
**Damage on Hit:** 1d6+4 piercing
🎯 Target: Goblin #1 (AC 13, Bloodied - 12/25 HP)

---

### Attack 2: Shortsword + Sneak Attack → Goblin #1
**Roll:** 2d20kh1+7 = [19, 8] = **26**
**Damage on Hit:** 1d6+4+4d6 piercing
🎯 Target: Goblin #1 (AC 13, Bloodied)
*Sneak Attack applied - ally within 5ft*

---

### Attack 3: Dagger (Offhand) → Orc
**Roll:** 1d20+7 = [14] = **21**
**Damage on Hit:** 1d4 piercing
🎯 Target: Orc (AC 14, Healthy - 30/30 HP)
*Offhand attack - no ability modifier to damage*

---

### Narration Guide
Σκιά unleashes a flurry of strikes, first focusing on Goblin #1 with two devastating attacks, then spinning to catch the Orc off-guard with a quick dagger slash.
```

---

## UI/UX Design

### Target Selection Flow

1. **Default Target**: When an enemy is set as "current target" in the Target Tracker, it auto-populates as the default for new attacks
2. **Override**: Player can tap a different enemy chip to override for specific attacks
3. **No Target**: "(Any)" option for unspecified targets

### Queue Management

1. **Add to Queue**: Tap weapon → select target → tap "Queue Attack" button
2. **Quick Add**: If default target set, weapon tap can auto-queue
3. **Reorder**: Up/Down arrows or drag handles
4. **Execute**: "Execute All" processes queue, generates combined prompt, clears queue

### Visual States

- **Empty Queue**: Collapsed, shows "No attacks queued"
- **Has Attacks**: Expanded, shows list with reorder controls
- **Executing**: Brief loading state, then shows DiceRollModal with combined results

---

## Integration Points

### Combat Log
Each executed attack in the queue gets its own combat log entry with target information.

### Turn Summary
Queue execution adds all attacks to turn summary at once.

### Action Economy
Queue execution respects action economy:
- First attack uses Action
- Offhand attacks use Bonus Action
- System warns if queue exceeds available actions

---

## Settings Option

Add toggle in Combat Settings:
- **"Enable Attack Queue"**: Default ON
- When OFF, weapons work as they do today (immediate execution)

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `attackQueue.ts` types
2. Create `use-attack-queue.ts` hook
3. Create `TargetSelector.tsx` component

### Phase 2: Queue UI
1. Create `AttackQueuePanel.tsx`
2. Modify `MobileWeaponCard.tsx` to support queueing

### Phase 3: Integration
1. Integrate into `MobileCombatLayout.tsx`
2. Create `attackQueuePrompts.ts` for multi-attack prompts
3. Wire up combat log and turn summary

### Phase 4: Polish
1. Add animations for queue add/remove
2. Add action economy validation
3. Add settings toggle
4. Test end-to-end on mobile

---

## Edge Cases

1. **Enemy Defeated Mid-Queue**: If a target is defeated, remaining attacks on that target show warning but still execute (AI DM can narrate the overkill or miss)

2. **No Enemies Tracked**: Queue still works, attacks have no assigned target (uses generic "the enemy" in prompts)

3. **Queue Limit**: Max 10 attacks in queue to prevent UI overflow

4. **Session Persistence**: Queue persists to localStorage so refreshing doesn't lose queued attacks

---

## Backward Compatibility

- Existing immediate-attack flow remains available
- Users can toggle between "Queue Mode" and "Immediate Mode"
- Default behavior can be set in Combat Settings

---

## Testing Criteria

1. Queue multiple attacks on same enemy - verify prompt shows all attacks
2. Queue attacks on different enemies - verify ordering reflected in prompt
3. Reorder attacks - verify prompt order matches
4. Execute queue - verify combat log entries, turn summary updates
5. Test on mobile viewport - verify touch targets are accessible
6. Test with no enemies tracked - verify graceful fallback
7. Test action economy warnings when over-queueing
