

## Animated Flame Border Tied to Signet Burnout

### What it does

The flame border image frames the narrative chat window in `PartyDMScreen.tsx`, scaling dynamically with the player's signet burnout level:

- **Burnout 0**: No border visible
- **Burnout 1+**: Border appears at 80% transparency, with small, slow-moving flame animation
- **Each additional burnout level**: 10% more opaque, flames grow taller and animate faster
- **Max burnout**: Fully opaque, large aggressive flames

### How it works

**1. Create a `BurnoutFlameOverlay` component**

A new component that receives `burnoutLevel` and `maxBurnout` as props. It:
- Returns `null` when burnout is 0
- Renders 4 edge overlays (top, bottom, left, right) using the flame border image, positioned absolutely around the chat container
- Uses CSS clip-path or overflow + height to control flame size (small flames = short clip, high burnout = tall clip)
- Opacity calculated as: `0.2 + (burnoutLevel / maxBurnout) * 0.7` (20% at level 1, up to ~90% at max)

**2. Animate the flames with CSS**

- A custom `@keyframes flame-flicker` animation that combines:
  - Subtle vertical oscillation (translateY wiggle)
  - Slight scale pulsing (scaleY breathing)
  - Brightness/opacity flickering
- Animation speed tied to burnout: `duration = 3s - (burnoutLevel/maxBurnout * 2)s` — so flames get faster as burnout rises (3s at low, ~1s at max)
- A secondary `flame-sway` keyframe for horizontal drift

**3. Wire it into `PartyDMScreen.tsx`**

- Compute burnout values from `dragonBonds.myDragon` (already available at line ~1587):
  - `bLevel = dragonBonds.myDragon.burnout`
  - `bBond = dragonBonds.myDragon.bond ?? 50`
  - `bMax = bBond >= 76 ? 9 : bBond >= 51 ? 7 : bBond >= 26 ? 5 : 4`
- Place `<BurnoutFlameOverlay level={bLevel} max={bMax} />` inside the `flex-1 min-h-0 relative` messages container (line 1707), as a `pointer-events-none` absolute overlay at `z-10`
- Only render when `isEmpyrean && dragonBonds.isSetup && dragonBonds.myDragon?.signetType`

### Files to change

- **`src/components/empyrean/BurnoutFlameOverlay.tsx`** (new) — the overlay component with flame animation logic
- **`src/components/ai-dm/PartyDMScreen.tsx`** — import and render the overlay in the messages container
- **`tailwind.config.ts`** — add `flame-flicker` and `flame-sway` keyframes/animations

### Flame sizing by level

```text
Level 1-2:  Flame height ~15px, slow pulse (3s), 80% transparent
Level 3-4:  Flame height ~25px, moderate pulse (2.2s), 60% transparent  
Level 5-6:  Flame height ~35px, quick pulse (1.6s), 40% transparent
Level 7-8:  Flame height ~45px, fast pulse (1.2s), 20% transparent
Level 9:    Flame height ~55px, aggressive pulse (0.8s), 10% transparent
```

