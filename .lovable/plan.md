

# Enhanced Condition Status Board: Maximum Immersion

## Overview

Building on the base Condition Status Board proposal, here are immersive enhancements that leverage your existing visual language, Oracle integration, and personality-driven theming.

---

## Immersion Enhancements

### 1. Personality-Voiced Condition Descriptions

Instead of static mechanical text, conditions get **flavor descriptions** that match the active Oracle personality:

| Condition | Standard | Thunderhead | JARVIS | Deadpool |
|-----------|----------|-------------|--------|----------|
| **Poisoned** | "Disadvantage on attacks and ability checks" | "Toxins course through your system. I calculate 47.3% reduced combat efficacy until purged." | "Sir, your biological systems are experiencing... interference. I strongly recommend finding an antidote." | "Ugh, you got the spinny-brain poison. Everything looks green and your attacks are gonna be *garbage*. Ask me how I know. 💀" |
| **Frightened** | "Disadvantage while source visible, can't approach" | "Fear responses detected. Neural activity indicates a 89.2% impulse to flee from the source." | "Your amygdala appears to be... overreacting, Sir. Might I suggest looking elsewhere?" | "BIG SCARY THING. LEGS WON'T MOVE TOWARD IT. We've all been there, buddy. *Usually involving clowns.*" |
| **Stunned** | "Incapacitated, can't move, auto-fail Str/Dex saves" | "Motor functions suspended. Zero percent capacity for voluntary action until recovery." | "All systems are currently... offline, Sir. A concerning development." | "BRAIN.EXE HAS STOPPED WORKING. You're basically a very handsome statue right now." |

**Implementation**: Store personality-keyed descriptions in the condition config, and pass the active Oracle personality to the Condition drawer.

---

### 2. Visual Affliction Animations

Borrow from your `InfinityGauntletStyles.css` energy effects for condition severity:

| Severity | Visual Effect |
|----------|---------------|
| **Low** (Grappled, Deafened) | Subtle pulse, muted border glow |
| **Medium** (Poisoned, Frightened) | Slow energy flow animation (green for poison, purple for fear) |
| **High** (Stunned, Incapacitated) | Faster pulse, stronger glow, scan line overlay |
| **Critical** (Paralyzed, Unconscious) | Full "alarm" mode - pulsing red border, electricity arcs, particle effects |

**CSS Addition**: Create `ConditionStyles.css` using your existing `energyPulse`, `electricityArc`, and `shimmer` keyframes.

---

### 3. Condition Source Tracking with NPC Memory

When adding a condition, optionally record the **source**:
- "Giant Spider"
- "Necromancer's Curse"
- "Trap - Hallway C"

This source is:
1. Displayed on the condition card
2. Passed to the Oracle's context so it can reference *who* did this to you
3. Stored for session summary ("You were poisoned 3 times by spiders today")

**Oracle Enhancement**: "You're currently Frightened of the Dragon. Since you can't approach it willingly, consider using your Shortbow or waiting for an ally to break line of sight."

---

### 4. Combat HUD Integration: Condition Strip

A compact, always-visible strip in the Combat HUD showing active conditions:

```text
┌──────────────────────────────────────────────────────────────┐
│ 🟠 Poisoned(3) · 😨 Frightened(10) │ ✨ Invisible(60) · 🎯 Concentrating │
└──────────────────────────────────────────────────────────────┘
```

- Tapping a condition opens quick-dismiss or details
- Color-coded by severity (matches card colors)
- Shows duration in **rounds** (combat context) not minutes
- Concentration effects have a distinct marker

---

### 5. Save Reminder System

For conditions with "Save Ends" duration:

1. At start of turn, toast notification: *"⚖️ Make a WIS save vs. Frightened (Source: Lich)"*
2. Quick action buttons: **[Passed]** or **[Failed]**
3. On **Passed**: Condition auto-removes with satisfying animation
4. On **Failed**: Duration remains, Oracle may comment ("Still frightened. The Thunderhead calculates 2 more save attempts on average.")

---

### 6. Rest Integration

**Short Rest Button Effects:**
- Clears conditions marked as "Short Rest clears" (Exhaustion -1, some spell effects)
- Toast: "Short rest complete. Cleared: [list]"
- Oracle personality comments:
  - Thunderhead: "Biological recovery at 34% efficiency. Optimal, given constraints."
  - JARVIS: "Systems restored to... acceptable parameters, Sir."
  - Deadpool: "Nap time over! You're probably not gonna die. Probably."

**Long Rest Button Effects:**
- Clears all conditions except permanent curses
- Exhaustion resets fully
- Full health restore prompt
- Session summary available

---

### 7. Proactive Oracle Warnings

The Oracle can now provide condition-aware proactive suggestions:

| Trigger | Oracle Alert |
|---------|--------------|
| HP < 25% + Poisoned | "Your HP is critical AND you're poisoned. Healing will be less effective. Consider removing poison first." |
| 1 round left on Invisible | "Invisibility ending next turn. Plan your positioning." |
| Frightened + trying to approach | "You're Frightened of [source]. You cannot willingly move closer. Consider ranged options." |
| Concentration + taking damage | "Your Concentration is at risk. If you fail the save, [effect] ends." |

These appear as **Context Chips** in the Oracle drawer:
- 🩹 `Poisoned (3r)` → Tappable to ask "What should I do about being poisoned?"

---

### 8. Condition Quick-Add from Combat

During combat, common conditions can be added with one tap:

**Combat Action → "Apply Condition"** opens a quick picker:
- Recent conditions (last 3 used)
- Common combat conditions (Prone, Grappled, Restrained)
- Custom entry for spells/effects

This lives in the Combat HUD bottom sheet or FAB menu.

---

### 9. Deadpool Commentary on Conditions

Special Deadpool-only flavor text for condition events:

| Event | Deadpool Commentary |
|-------|---------------------|
| Condition added | "Aaand now you're [condition]. Cool cool cool. *This is fine.*" |
| Critical severity | "Oh no. OH NO. *checks notes* Yep, that's bad. That's REAL bad." |
| Condition cleared | "FREEDOM! 🎉 ...For now. They'll probably do it again." |
| Save succeeded | "NAT 20 ENERGY! Your body said 'NOPE' to that nonsense!" |
| Save failed | "Oof. Your dice betrayed you. *Again.* We need to talk to those dice." |

These can optionally appear as toasts or in-drawer commentary when Deadpool is the active personality.

---

### 10. Session Statistics

Track condition data across the session for summary:

- **Most Applied Condition**: Poisoned (7 times)
- **Longest Duration**: Frightened (23 rounds total)
- **Most Common Source**: Giant Spiders (4 conditions)
- **Saves Made/Failed**: 5/3

This feeds into the Chronicle Sync and Session Recap systems.

---

## Implementation Summary

### New Files
| File | Purpose |
|------|---------|
| `src/lib/conditions/types.ts` | Condition interfaces, duration types, severity levels |
| `src/lib/conditions/config.ts` | D&D 5e conditions with personality-keyed descriptions |
| `src/lib/conditions/index.ts` | Barrel export |
| `src/hooks/use-conditions.ts` | State management, localStorage persistence, session tracking |
| `src/components/conditions/ConditionStatusBoard.tsx` | Main drawer content with personality integration |
| `src/components/conditions/ConditionCard.tsx` | Individual condition with animations and source display |
| `src/components/conditions/AddConditionSheet.tsx` | Bottom sheet picker with duration and source input |
| `src/components/conditions/ConditionStrip.tsx` | Compact Combat HUD display |
| `src/components/conditions/ConditionStyles.css` | Severity-based animations (pulse, glow, arcs) |
| `src/components/conditions/index.ts` | Barrel export |

### Modified Files
| File | Change |
|------|--------|
| `src/components/drawers/PromptDrawerProvider.tsx` | Add conditions state, drawer, pass to Oracle |
| `src/components/oracle/types.ts` | Add `activeConditions` and `activeBuffs` to CharacterContext |
| `supabase/functions/oracle-assistant/index.ts` | Include conditions in context summary and personality responses |
| `src/components/home/HomeScreen.tsx` | Add "Conditions" to drawer menu |
| `src/components/combat/mobile/MobileCombatLayout.tsx` | Add ConditionStrip component |

---

## Technical Details

### Condition Data Structure
```typescript
interface ConditionDefinition {
  id: string;
  name: string;
  icon: string;
  category: 'debuff' | 'buff' | 'environmental';
  severity: 'low' | 'medium' | 'high' | 'critical';
  mechanicalEffect: string;
  personalityDescriptions: {
    thunderhead: string;
    jarvis: string;
    deadpool: string;
  };
  saveStat?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  shortRestClears?: boolean;
}

interface ActiveCondition {
  id: string; // Unique instance ID
  conditionId: string;
  name: string;
  source?: string; // "Giant Spider", "Lich's Curse"
  duration: {
    type: 'rounds' | 'minutes' | 'hours' | 'save_ends' | 'indefinite';
    value: number;
    initial: number;
  };
  isConcentration: boolean;
  appliedAt: number;
  notes?: string;
}
```

### Oracle Context Enhancement
```typescript
interface CharacterContext {
  // ...existing fields...
  activeConditions: Array<{
    name: string;
    remainingRounds: number;
    source?: string;
    severity: string;
    saveType?: string;
  }>;
  activeBuffs: Array<{
    name: string;
    remainingMinutes: number;
    concentration: boolean;
  }>;
}
```

### Animation Classes
```css
/* Severity-based condition animations */
.condition-low { /* subtle pulse */ }
.condition-medium { /* slow energy flow */ }
.condition-high { /* faster pulse, glow */ }
.condition-critical { /* alarm mode - pulsing red, electricity */ }

/* Poison-specific (green energy) */
.condition-poison { --condition-color: hsl(120 60% 40%); }

/* Fear-specific (purple energy) */
.condition-fear { --condition-color: hsl(270 60% 50%); }

/* Concentration marker */
.condition-concentration::before { /* eye icon overlay */ }
```

---

## What Makes This More Immersive

| Original Proposal | Enhanced Version |
|-------------------|------------------|
| Static condition descriptions | Personality-voiced descriptions matching active Oracle |
| Basic visual indicators | Animated effects matching Infinity Gauntlet energy style |
| Duration tracking | Source tracking with NPC memory for Oracle context |
| Manual management | Proactive Oracle warnings and save reminders |
| Standalone feature | Deep Combat HUD integration with quick-add |
| Generic feedback | Personality-specific commentary (especially Deadpool) |
| Single session | Session statistics for Chronicle Sync integration |

The conditions system becomes another touchpoint for the Oracle's personality to shine through, making status effects feel like part of your character's story rather than just mechanical bookkeeping.

