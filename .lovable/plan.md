

## Plan: Update HP Thresholds & Add Breathing Animation to Geralt Button

### Changes Overview

**1. Update HP thresholds in `GeraltCompanionScreen.tsx`** (lines 123-133)
- Change background image thresholds: >80% = happy, 30-79% = angry, <30% = injured
- Update HP color thresholds to match

**2. Add breathing animation to `EnlargedD20Section.tsx`**
- Accept a new prop `companionHpPct` (number) to know current HP percentage
- Replace `animate-pulse` with a custom CSS breathing animation that scales the button
- Animation speed depends on HP state:
  - Happy (>80%): 20s total cycle (10s expand, 10s contract)
  - Angry (30-79%): 10s total cycle (5s expand, 5s contract)
  - Injured (<30%): 6s total cycle (3s expand, 3s contract)
- Also apply a slow pulsing glow at the same rate

**3. Pass HP data from `HomeScreen.tsx`**
- In `HomeScreen.tsx`, read Geralt's current HP from localStorage using the same storage key pattern (`odyssey_${characterId}_geralt_companion`)
- Pass `companionHpPct` prop to `EnlargedD20Section`
- Listen for storage changes to keep it in sync when the companion screen updates HP

**4. Add custom breathing keyframes in `tailwind.config.ts`**
- Add three breathing animations: `breathe-slow` (20s), `breathe-medium` (10s), `breathe-fast` (6s)
- Keyframes: scale from 1.0 → 1.08 → 1.0 with matching ring glow intensity changes

### Technical Details

**Threshold changes** (`GeraltCompanionScreen.tsx`):
```
hpPct > 80 → happy background
hpPct > 30 → angry background  
else → injured background
```

**Breathing animation** (`EnlargedD20Section.tsx`):
- Determine animation class based on `companionHpPct`:
  - `>80`: `animate-breathe-slow`
  - `>30`: `animate-breathe-medium`
  - else: `animate-breathe-fast`
- Apply to the button wrapper using inline `style` for the animation duration, or via Tailwind custom classes

**Data flow** (`HomeScreen.tsx`):
- Read Geralt state from localStorage on mount and when companion screen closes
- Compute `hpPct = (currentHP / maxHP) * 100`
- Pass to `EnlargedD20Section` as `companionHpPct`

### Files Modified
1. `src/components/companion/GeraltCompanionScreen.tsx` — threshold updates
2. `src/components/home/EnlargedD20Section.tsx` — breathing animation, new prop
3. `src/components/home/HomeScreen.tsx` — read/pass companion HP data
4. `tailwind.config.ts` — breathing keyframes

