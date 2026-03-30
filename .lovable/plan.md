

## Ground Button HP Integration — Uncapped Darkening + Real HP Loss

### Summary
Remove the darkening cap from failed Ground rolls. Instead, tie the darkening to the player's actual HP: each failed roll deals 1 real damage, and the screen darkness is proportional to HP lost (darkness = 1 - currentHP/maxHP). At 0 HP, the screen goes fully black, the Ground button disappears, and the player falls unconscious.

### Changes

**1. Update `BurnoutFlameOverlay` props and component**
- Add `currentHP`, `maxHP`, and `onHPChange` (callback for dealing 1 damage) to the props interface
- Pass `currentHP` and `maxHP` through to `GroundButton`
- Add an `onFailedRoll` callback that calls `onHPChange(-1, 'damage')` when a non-Nat-20 is rolled

**2. Update `GroundButton` component**
- Add `currentHP` and `maxHP` props
- Replace `failedAttempts`-based darkening with HP-based: `darkenOpacity = 1 - (currentHP / maxHP)` — no cap, reaches 1.0 (full black) at 0 HP
- On failed roll, call `onFailedRoll()` instead of incrementing local `failedAttempts` (remove that state)
- When `currentHP <= 0`: hide the Ground button, show a "knocked unconscious" state (fully black screen, no interaction)

**3. Update `EmpyreanDMScreen.tsx`**
- Pass `currentHP`, `maxHP`, and `onHPChange` to `BurnoutFlameOverlay`
- `currentHP` comes from `autoSyncCallbacks.getCurrentHP()`
- `onHPChange` calls `autoSyncCallbacks.onHPChange(-1, 'damage')`

**4. Update `PartyDMScreen.tsx`**
- Same pattern: pass `currentHP`, `maxHP`, and `onHPChange` props through to `BurnoutFlameOverlay`
- Source HP from the existing character status data available in the component

### Technical details
- Darkness formula: `opacity = Math.max(0, 1 - (currentHP / maxHP))` — at full HP it's 0, at 0 HP it's 1.0
- The `onHPChange` callback uses the existing auto-sync HP change system so damage is persisted to the character sheet
- At 0 HP: Ground button hidden, screen fully black, player is unconscious (burnout effects continue underneath but invisible)
- No local `failedAttempts` counter needed — HP is the source of truth

