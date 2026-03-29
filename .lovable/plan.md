

## Plan: Fix Heartbeat Animations + Add Wobble Keyframes

### Problem
The heartbeat consciousness-fade animations are invisible because `ease-in-out` timing smooths out the sharp opacity pulses that occur in the first 28% of each cycle.

### Changes

**File 1: `src/components/empyrean/BurnoutFlameOverlay.tsx`** — 3 line changes

Change `ease-in-out` to `linear` on three animation properties:
- Line 184: `consciousness-fade 6s linear infinite`
- Line 207: `consciousness-tunnel 4.5s linear infinite`
- Line 230: `consciousness-tunnel-heavy 3s linear infinite`

**File 2: `tailwind.config.ts`** — Add 3 new keyframe blocks

Insert after the `consciousness-tunnel-heavy` block (after line 358), before `breathe-happy`:

- `heartbeat-wobble-light`: 0.5px max displacement, wobble during 0-28%, stable rest
- `heartbeat-wobble-medium`: 1px max displacement, wobble during 0-32%, stable rest  
- `heartbeat-wobble-heavy`: 1.8px max displacement, wobble during 0-36%, stable rest

No other changes to either file.

