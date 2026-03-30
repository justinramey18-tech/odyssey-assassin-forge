

## Scaled Ground! Roll Damage

### What changes
The Ground! mechanic currently deals a flat 1 HP on every failed roll. This update makes each roll (1-19) deal unique damage based on a smooth curve where **Nat 1 = 20% of max HP** and **19 = minimum damage (1 HP)**, with every number in between mapped to a distinct value. A red damage indicator (e.g. "-3 HP") will appear below the roll result.

### Damage formula
Smooth linear interpolation from roll 1 to roll 19:
- `damage = Math.ceil(maxHP * 0.2 * (20 - roll) / 19)`
- Nat 1 → `ceil(maxHP * 0.2)` (e.g. 2 HP at 10 max, 4 HP at 20 max)
- Roll 19 → 1 HP (minimum floor)
- Every roll in between gets a unique value on the curve

### Files to change

**`src/components/empyrean/GroundButton.tsx`**
1. Change `onFailedRoll: () => void` to `onFailedRoll: (damage: number) => void`
2. Add a `getGroundingDamage(roll, maxHP)` helper that computes damage per the formula above, with a `Math.max(1, ...)` floor
3. Store `lastDamage` in state alongside `lastRoll`
4. On failed roll, compute damage and pass it to `onFailedRoll(damage)`
5. In the roll result display, show a red `-X HP` subtitle below the roll number for failed rolls (similar positioning to the "Grounded" text on Nat 20)

**`src/components/empyrean/BurnoutFlameOverlay.tsx`**
1. Update the `onFailedRoll` callback to accept and forward the damage value:
   `onFailedRoll={(damage) => onHPChange?.(damage * -1, 'damage')}`
   (Note: currently passes `-1` hardcoded — will now use the dynamic damage)

### Damage display UI
- Red text below the roll number: `text-red-400 font-cinzel text-lg`
- Shows for all failed rolls (1-19), e.g. "-2 HP"
- Animates in with the same timing as the roll result (1.5s display)

