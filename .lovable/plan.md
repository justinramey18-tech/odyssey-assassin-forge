

## "Ground!" Button — Burnout 8/8 Grounding Mechanic

### What it does
When burnout reaches 8/8 (ratio = 1.0), a pulsing **"Ground!"** button appears centered on screen, above the tunnel-vision overlay. The player taps it to roll a d20 (using their dice odds setting). The roll result is displayed. On a **Nat 20**, vibration stops and burnout drops by 1 level (to 7/8). Each failed roll progressively darkens the screen, escalating tension.

### Changes

**1. Update `BurnoutFlameOverlay` props and component**
- Add an `onGround` callback prop (called when Nat 20 is rolled)
- Add internal state: `failedAttempts` (number), `lastRoll` (number | null), `isGrounded` (boolean), `showResult` (boolean)
- When `ratio >= 1`, render a centered button with z-index above the tunnel overlay (z-index 70+), styled with `pointer-events: auto`
- Button text: "Ground!" with a pulsing glow animation (amber/fire themed, `font-cinzel`)
- On tap: roll a d20 using `rollDie(20)` from `diceRoller.ts` (or `rollWeightedDie` with the player's dice odds mode via `loadDiceOddsMode()`)
- Display the roll result in an animated number overlay for ~1.5s
- If Nat 20: stop vibration (`navigator.vibrate(0)`), briefly show success feedback (golden flash), then call `onGround()`
- If not Nat 20: increment `failedAttempts`, which adds an extra darkening layer (opacity scales with attempts, capped to maintain some visibility)
- Reset `failedAttempts` and `lastRoll` when ratio drops below 1.0

**2. Update `EmpyreanDMScreen.tsx`**
- Pass `onGround={() => setBurnoutLevel(prev => Math.max(0, prev - 1))}` to `BurnoutFlameOverlay`

**3. Update `PartyDMScreen.tsx`**
- Same: pass `onGround` prop to `BurnoutFlameOverlay` with equivalent burnout decrement logic

### Technical details
- Roll uses `rollWeightedDie(20, loadDiceOddsMode())` from `@/lib/diceOdds` to respect the player's dice odds setting
- Failed-roll darkening: an additional overlay div with opacity `Math.min(0.15 * failedAttempts, 0.5)` — capped so text remains barely readable
- The button has min touch target of 48px, styled as a glowing ember-themed pill
- When grounding succeeds, the button disappears as ratio drops below 1.0, and normal 7/8 effects take over

