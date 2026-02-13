

# Fix Roll Quality Descriptions in AI DM Prompts

## Problem

Roll quality labels in AI DM prompts use incorrect math, leading to absurd descriptions like calling a 19 attack roll a "Glancing Blow." The root cause is comparing **total roll values** (die + modifier) against thresholds that don't account for D&D 5e probability correctly.

**Example of the bug (QuickActionsDrawer.tsx line 182):**
```
effectiveTotal >= maxVal * 0.7 + roll.modifier ? 'Solid Hit' : 'Glancing Blow'
```
For a d20+5 roll of 19 (raw 14): threshold = 20*0.7+5 = 19. A raw 14 barely passes. A raw 13 (total 18) gets called "Glancing Blow" -- completely wrong for 5e where AC 18 is very high.

## Solution: Use the Natural Die Value

In 5e, what matters for narrative quality is the **natural die roll** (before modifiers), not the total. A natural 17 on a d20 is excellent regardless of modifier. The fix extracts the natural die value and uses 5e-accurate thresholds.

### D20 Attack/Check Quality Tiers (natural die value)
- **Natural 20**: Critical Hit
- **Natural 1**: Critical Miss  
- **18-19**: Excellent (near-perfect precision)
- **14-17**: Strong (confident, well-executed)
- **8-13**: Average (competent but unremarkable)
- **2-7**: Poor (clumsy, strained, barely effective)

### Ability Dice Quality Tiers (d6/d8/d10 -- percentage of max)
- **Max value on any die**: Critical Success
- **All 1s**: Critical Failure
- **75%+ of max**: Strong
- **40-74% of max**: Average
- **Below 40%**: Weak

## Files to Modify

### 1. Create `src/lib/rollQuality.ts` (NEW)
Centralized utility with two functions:
- `getD20RollQuality(rolls, rollMode)` -- returns quality label for d20-based rolls using the **natural effective die**
- `getAbilityRollQuality(rolls, die)` -- returns quality label for ability dice (d6/d8/d10) using percentage of max

Both return a `RollQuality` object: `{ label, tier, narrativeGuide }` where `tier` is `'critical_hit' | 'critical_miss' | 'excellent' | 'strong' | 'average' | 'poor'` and `narrativeGuide` is a prompt-ready sentence.

### 2. `src/lib/rpPromptGenerator.ts`
Replace the `isHighRoll` / `rollQuality` logic (lines 33-39) with `getAbilityRollQuality()`. Update the Scene Direction section (lines 82-90) to use the centralized narrative guides.

### 3. `src/components/drawers/QuickActionsDrawer.tsx`
Replace the broken `quality` calculation on line 182 in `generateWeaponRollPrompt` with `getD20RollQuality()`. Update the narration line (line 202) to use the quality's narrative guide.

### 4. `src/components/combat/CombatTabScreen.tsx`
Update `generateWeaponPrompt` (lines 393-435) to add roll quality context using `getD20RollQuality()`. The current prompt says "Describe the attack based on the roll result" with no actual quality guidance -- add a narrative direction line based on the quality tier.

### 5. `src/components/combat/mobile/CombatAbilityCard.tsx`
Replace the hardcoded threshold checks (lines 215-219: `roll.total >= 15`, `>= 8`) with `getAbilityRollQuality()` for accurate narrative guidance.

### 6. `src/lib/combat/attackQueuePrompts.ts`
Add roll quality context to `formatSingleAttack` and `generateQueuedAttackPrompt` so multi-attack and queued attack prompts also get accurate quality labels.

### 7. `src/lib/diceRollerConfig.ts`
Update the "Describe Damage" prompt template (lines 99-106) -- the damage thresholds (1-5 low, 6-15 medium, 16+ high) are too simplistic and should note they scale with level and dice count.

## No Changes Required
- `SlotDrawer.tsx` gear prompts -- these are item description prompts, not roll-based
- `SpellCastSheet.tsx` / `SpellDetailsSheet.tsx` -- spell prompts use spell descriptions, not roll quality
- Backend / edge functions -- all changes are frontend prompt text

