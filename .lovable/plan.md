

## Plan: Wobble + Heartbeat Haptics in BurnoutFlameOverlay.tsx

Single file: `src/components/empyrean/BurnoutFlameOverlay.tsx`

### Change 1 — Replace `triggerHaptic` function (lines 44-54)
Replace with `triggerHeartbeatHaptic` that uses lub-dub vibration patterns timed to each level's animation cycle (6s/4.5s/3s).

### Change 2 — Replace haptic useEffect (lines 96-116)
- Activates at ratio 0.625 instead of 0.5
- Calls `triggerHeartbeatHaptic`
- Interval matches animation cycle (6000/4500/3000ms)
- Cancels vibration on cleanup with `navigator.vibrate(0)`

### Change 3 — Add wobble animations to consciousness overlay divs
Add comma-separated second animation to each consciousness div:
- **Line 184** (Level 6): add `heartbeat-wobble-light 6s linear infinite`
- **Line 207** (Level 7): add `heartbeat-wobble-medium 4.5s linear infinite`
- **Line 230** (Level 8): add `heartbeat-wobble-heavy 3s linear infinite`

Update comments on lines 178, 201, 224 accordingly.

Nothing else changes — audio, embers, dragon backgrounds, thresholds all untouched.

