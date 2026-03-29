

## Plan: Scope Consciousness Fade to Chat Window + Reduce 75% Intensity

### Problem
Both fade overlays use `fixed inset-0`, covering the entire screen. The 75% effect is also too intense (inline `opacity: 0.45` multiplied with the keyframe's peak of `0.85`).

### Changes

**`src/components/empyrean/BurnoutFlameOverlay.tsx`** (lines 206-217):
- Change both fade divs from `fixed inset-0` to `absolute inset-0` so they're scoped to the overlay's parent container (the chat window)
- Reduce the 75% effect: lower inline opacity to `0.25` and slow the animation to `8s` cycle
- Keep the 95% effect as-is with `absolute inset-0`

### Files modified
1. `src/components/empyrean/BurnoutFlameOverlay.tsx` — 2 lines changed

