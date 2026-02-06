

# Combat Primer Step - Enhanced Implementation Plan

## Overview
Add a new **"Combat Primer"** step to the Character Builder Wizard between Equipment and Summary. This comprehensive informational step introduces new players to the Combat tab's mechanics, UI layout, and assassin-specific tactics before they start playing.

## Step Position
| Current Position | Step Name |
|-----------------|-----------|
| 0 | Identity |
| 1 | Ability Scores |
| 2 | Game Mode |
| 3 | Magic Path |
| 4 | Skill Trees |
| 5 | Equipment |
| **6 (NEW)** | **Combat Primer** |
| 7 | Summary |

**Total steps: 8** (increased from 7)

---

## Content Sections (Expanded)

### Section 1: Action Economy Overview
Visual mockup of the ActionEconomyBar with detailed explanations:

| Resource | Icon | Color | Description | Examples |
|----------|------|-------|-------------|----------|
| **ACTION** | Sword | Red | Your main activity each turn | Attack, Dash, Dodge, Use Object, Cast spell |
| **BONUS ACTION** | Zap | Amber | Quick supplementary actions | Cunning Action (Hide/Dash/Disengage), Two-Weapon Fighting, some spells |
| **REACTION** | Shield | Cyan | Triggered responses (1/round) | Opportunity Attack, Uncanny Dodge, Shield spell |
| **MOVEMENT** | Footprints | Green | 30ft per turn (typical) | Split before/after actions, difficult terrain costs 2x |

**Interactive Element**: Tappable segments that show "READY" vs "USED" states with visual dimming.

---

### Section 2: Sneak Attack Rules (Interactive Demo)
The defining Rogue mechanic—explain clearly when it triggers:

**Requirements Checklist (toggleable)**:
```
☐ Using a Finesse weapon (e.g., Shortsword, Dagger)
   OR Ranged weapon (e.g., Shortbow, Hand Crossbow)

AND ONE of:
☐ Have Advantage on the attack roll
   - You are Hidden/Invisible
   - Target is Surprised  
   - Ally feature grants advantage
   
☐ OR an ally is within 5ft of the target
   - Ally must not be incapacitated
   - You don't need advantage

AND:
☐ You don't have Disadvantage
   - Darkness, Poisoned, Restrained can cause this
```

**Visual Indicator**: Shows real-time eligibility based on checked conditions
- ✅ "SNEAK ATTACK ELIGIBLE" (green glow)
- ❌ "NOT ELIGIBLE: Need advantage or ally adjacent" (red, with reason)

**Damage Preview**: Show scaling based on selected level:
- Level 1-2: +1d6
- Level 3-4: +2d6
- Level 5-6: +3d6
- etc.

---

### Section 3: Combat Tab Navigation
Preview the 5-tab consolidated layout from `CombatBottomNav`:

| Tab | Icon | Color | What's Inside |
|-----|------|-------|---------------|
| **COMBAT** | Crosshair | Red | Weapon attacks, equipped weapons from Gear, stealth abilities, target tracker |
| **ACTIONS** | Zap | Amber | All unlocked abilities with filter chips (All/Action/Bonus/Reaction) |
| **MAGIC** | Wand | Indigo | Spells, spell slots, concentration tracking, material components |
| **ITEMS** | Backpack | Green | Consumables (potions, poisons, scrolls) with 10-second undo |
| **LOG** | FileText | Primary | Combat action history with AI DM prompts, "Copy All" for narrative |

**Navigation Tip**: "Swipe left/right to switch tabs quickly, or tap the bottom nav."

---

### Section 4: Tactical Situation Panel
Explain the SituationStrip and combat modifiers:

**Combat Conditions (toggleable in-combat)**:
- **Hidden/Invisible**: Advantage on first attack, enemies have disadvantage to hit you
- **Have Advantage**: Roll 2d20, take higher result. Enables Sneak Attack.
- **Ally within 5ft**: Enables Sneak Attack even without advantage
- **Target Surprised**: Auto-crit on hit. Assassinate available.
- **Target Unaware**: Advantage on attack rolls
- **Have Disadvantage**: Roll 2d20, take lower. BLOCKS Sneak Attack.
- **In Dim Light/Darkness**: Can attempt to hide. Advantage on stealth.
- **Poisoned Weapon**: Extra poison damage on hit

**Preset Scenarios Quick-Select**:
- Standard Combat
- Hidden/Stealth Active
- Surprise Round
- Flanking Position
- Defensive/Escaping

---

### Section 5: Assassin Signature Abilities
Key class features to watch for:

| Feature | Level | Trigger | Effect |
|---------|-------|---------|--------|
| **Sneak Attack** | 1+ | Hit with finesse/ranged + advantage or ally adjacent | +Xd6 damage (X = ceil(level/2)) |
| **Cunning Action** | 2+ | Bonus action | Dash, Disengage, or Hide as bonus action |
| **Uncanny Dodge** | 5+ | Reaction when hit | Halve damage from one attack |
| **Evasion** | 7+ | DEX save for half damage | Take no damage on success, half on fail |
| **Assassinate** | 3+ (Assassin) | Target surprised + advantage | Auto-crit on hit |

**Tip Box**: "Your abilities unlock as you level up. Check the ACTIONS tab to see what's available!"

---

### Section 6: Turn Wizard AI Guidance
Highlight the TurnWizardPanel feature:

> 🧭 **TURN WIZARD**
> 
> Not sure what to do? The **Turn Wizard** analyzes your current situation and suggests optimal actions:
> - Detects if you're hidden (suggests Sneak Attack)
> - Warns when HP is low (suggests Hide or Disengage)
> - Reminds you about unused actions and abilities
> - Shows ready reactions you can use if triggered
>
> *Suggestions appear at the top of the COMBAT tab and can be dismissed.*

**Example Suggestions**:
- 🎯 **Strike from Shadows!** — "You have advantage - use Sneak Attack for massive damage"
- 🌙 **Hide First** — "Cunning Action: Hide for advantage on your attack"
- ❤️ **Critical HP! Take Cover** — "Consider using Cunning Action to Disengage"

---

### Section 7: Combat Log & AI DM Prompts
Explain the logging system:

**What Gets Logged**:
- Every weapon attack with hit roll and damage
- Every ability used with tier and effect
- Every spell cast with slot level
- Every reaction triggered
- Every item consumed

**AI DM Integration**:
- Each logged action includes a rich, narrative AI DM prompt
- Tap any entry to expand and see the full prompt
- **Copy Prompt**: Send individual actions to your AI DM
- **Copy All**: Aggregate entire combat into chronological narrative
- **AI Synthesize**: Generate unified narrative summary (with Deadpool mode!)

---

### Section 8: Reactions Quick Reference
Preview the reaction system:

**Default Enabled Reactions**:
| Reaction | Trigger | Effect |
|----------|---------|--------|
| Opportunity Attack | Enemy leaves your reach | One melee attack |
| Uncanny Dodge | You're hit by visible attacker | Halve the damage |
| Sneak Attack (Reaction) | Hit with opportunity attack | Add Sneak Attack if eligible |

**Configurable Reactions** (toggled in Settings):
- Shield spell (+5 AC)
- Absorb Elements (resist + counter damage)
- Counterspell (interrupt casting)
- Hellish Rebuke (fiery retaliation)
- Sentinel Attack (punish those who ignore you)

---

### Section 9: Enemy/Target Tracker
Introduce the target tracking system:

> 🎯 **TARGET TRACKER**
> 
> Track the enemies you're fighting:
> - Add enemies with Name, HP, AC, creature type
> - Set current target for AI prompt context
> - Apply conditions (Poisoned, Prone, etc.)
> - Track damage dealt and remaining HP
> - Auto-populated from Chronicle Sync

**Why Track Targets?**
"AI DM prompts automatically include your target's stats, health status, and conditions for richer narrative generation."

---

### Section 10: End Turn Flow
Explain the turn cycle:

1. **Start of Turn**: Resources reset (if new round)
2. **Take Actions**: Use Action, Bonus Action, Movement
3. **Reactions**: Available if triggered on enemy turns
4. **End Turn**: 
   - Tap **END** button to finish turn
   - *Long-press* for **AI SYNC**: Generate turn summary narrative

**Round Counter**: Tracks current combat round (R1, R2, etc.)

---

## Files to Modify

### 1. `src/components/wizard/types.ts`
- Add `'combatPrimer'` to the `WizardStep` union type
- Add `'combatPrimer'` to the `WIZARD_STEPS` array (after `'equipment'`)
- Add `combatPrimer: 'Combat Primer'` to the `WIZARD_STEP_LABELS` record

### 2. `src/components/wizard/hooks/use-wizard-state.ts`
- Update `GO_NEXT` reducer case: change `Math.min(6, nextStep)` to `Math.min(7, nextStep)`
- Update `isLastStep` computed value: change `state.currentStep === 6` to `state.currentStep === 7`

### 3. `src/components/wizard/hooks/use-wizard-validation.ts`
- Add new validation function `validateCombatPrimerStep()` that always returns valid
- Update `validateStep()` switch:
  - Add `case 6` for Combat Primer (always valid)
  - Change Summary from `case 6` to `case 7`

### 4. `src/components/wizard/CharacterWizard.tsx`
- Update `IMPLEMENTED_STEPS` constant from `7` to `8`
- Import the new `CombatPrimerStep` component
- Update `renderStep()` switch:
  - Add `case 6:` for `CombatPrimerStep`
  - Change Summary from `case 6:` to `case 7:`
- Update navigation footer condition: hide on step 7 (Summary) instead of step 6

### 5. `src/components/wizard/steps/CombatPrimerStep.tsx` (NEW FILE)
Create comprehensive step component with:
- Multiple collapsible accordion sections
- Interactive Sneak Attack eligibility demo
- Visual mockups matching actual combat UI
- Level-aware damage previews
- Tab navigation preview cards

### 6. `src/components/wizard/steps/index.ts`
- Export the new `CombatPrimerStep` component

---

## Component Architecture

```
CombatPrimerStep
  ├── PrimerHeader
  │   └── Icon, Title, Skip link
  ├── AccordionRoot (expandable sections)
  │   ├── ActionEconomySection
  │   │   └── 4 color-coded segments with descriptions
  │   ├── SneakAttackSection
  │   │   ├── Requirements checklist (interactive)
  │   │   ├── Eligibility indicator
  │   │   └── Damage scaling table
  │   ├── CombatTabsSection
  │   │   └── 5 tab preview cards
  │   ├── TacticalSituationSection
  │   │   └── Condition modifiers list
  │   ├── TurnWizardSection
  │   │   └── Example suggestions
  │   ├── ReactionsSection
  │   │   └── Default reactions table
  │   └── CombatLogSection
  │       └── AI DM integration explanation
  └── ValidationFeedback (if any)
```

---

## State & Props

### Component Props
```typescript
interface CombatPrimerStepProps {
  state: WizardState;
  validation?: StepValidation;
}
```

### Local State (Interactive Demo)
```typescript
// Sneak Attack eligibility demo
const [hasAdvantage, setHasAdvantage] = useState(false);
const [allyNearby, setAllyNearby] = useState(false);
const [usingFinesseRanged, setUsingFinesseRanged] = useState(true);
const [hasDisadvantage, setHasDisadvantage] = useState(false);

const sneakAttackEligible = useMemo(() => {
  if (!usingFinesseRanged) return { eligible: false, reason: 'Need Finesse or Ranged weapon' };
  if (hasDisadvantage) return { eligible: false, reason: 'Disadvantage blocks Sneak Attack' };
  if (hasAdvantage) return { eligible: true, reason: 'Advantage grants Sneak Attack' };
  if (allyNearby) return { eligible: true, reason: 'Ally adjacent enables Sneak Attack' };
  return { eligible: false, reason: 'Need advantage or ally within 5ft of target' };
}, [hasAdvantage, allyNearby, usingFinesseRanged, hasDisadvantage]);
```

### Validation
```typescript
function validateCombatPrimerStep(state: WizardState): StepValidation {
  // Informational step - always valid
  return {
    isValid: true,
    errors: [],
    warnings: [],
  };
}
```

---

## Visual Design

### Consistent Styling
- Dark fantasy aesthetic with parchment cards
- `wizardBackground` image with overlay
- Framer-motion animations for section reveals
- Lucide icons throughout

### Color Palette (Matches Combat HUD)
- Action: `red-400` / `red-500/20`
- Bonus Action: `amber-400` / `amber-500/20`
- Reaction: `cyan-400` / `cyan-500/20`
- Movement: `green-400` / `green-500/20`
- Magic: `indigo-400` / `indigo-500/20`
- Primary: `primary` (gold)

### Mobile Optimization
- Accordion sections to reduce scroll length
- Large touch targets for interactive elements
- Scroll-friendly vertical layout
- Skip link prominently placed

---

## Implementation Order

1. Update `types.ts` with new step identifier
2. Update `use-wizard-state.ts` navigation bounds
3. Update `use-wizard-validation.ts` with new validation case
4. Create `CombatPrimerStep.tsx` component with all sections
5. Update `steps/index.ts` to export new component
6. Update `CharacterWizard.tsx` to render new step
7. Test full wizard flow with new step

---

## Test Criteria

- [ ] Wizard progresses through all 8 steps correctly
- [ ] Combat Primer step always validates as "valid"
- [ ] Interactive Sneak Attack demo updates eligibility in real-time
- [ ] Accordion sections expand/collapse smoothly
- [ ] Skip link works for experienced players
- [ ] Level from Identity step affects damage preview
- [ ] Mobile layout scrolls without issues
- [ ] "Continue" button works on Combat Primer step
- [ ] Summary step is now step 7 and works correctly

