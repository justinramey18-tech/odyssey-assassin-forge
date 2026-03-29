

## Plan: Adjust Max Burnout Fade Timing

Update the `consciousness-fade` keyframe in `tailwind.config.ts` to use a 10s cycle where ~3s is spent at peak darkness.

### Changes

**`tailwind.config.ts`** — Revise the `consciousness-fade` keyframe:
- Current: `0%→0, 50%→0.85, 100%→0` (symmetric sine wave)
- New: Ramp up by 35%, hold dark from 35%–65% (3s of 10s), ramp down by 100%
  ```
  0%: opacity 0
  35%: opacity 0.85
  65%: opacity 0.85
  100%: opacity 0
  ```

**`src/components/empyrean/BurnoutFlameOverlay.tsx`** — Change the max burnout animation duration from `4s` to `10s`:
- Line with `consciousness-fade_4s` → `consciousness-fade_10s`

### Files modified
1. `tailwind.config.ts`
2. `src/components/empyrean/BurnoutFlameOverlay.tsx`

