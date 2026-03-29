

## Fix: 75% Burnout Fade Covers Full Chat Area Uniformly

### Problem
The 75% burnout consciousness fade appears to only darken edges because its peak effective opacity is too low (`0.25 × 0.85 = ~0.21`), making the vignette overlay visually dominant. The fade div itself covers the full area but is barely perceptible in the center.

### Changes

**`src/components/empyrean/BurnoutFlameOverlay.tsx`** (line 209):
- Increase inline `opacity` from `0.25` to `0.45` so the black overlay is clearly visible across the entire chat area, not just at edges where the vignette compounds