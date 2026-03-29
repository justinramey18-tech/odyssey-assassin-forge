

## Plan: Exaggerated Consciousness Tunnel-Vision Effect

### What changes

The tunnel-vision overlay at burnout 6/8, 7/8, and 8/8 will animate from fully transparent (all text visible) to fully opaque black (no text visible) in a breathing loop, with faster cycles at higher burnout.

### File 1: `tailwind.config.ts`

Replace the three consciousness keyframe animations:

- **`consciousness-fade`** (used at 5/8 and 6/8): Change to full 0→1→0 opacity cycle. This is the one used at 6/8 — it will go from opacity 0 to opacity 1 and back.
- **`consciousness-tunnel`** (used at 7/8): Same full blackout cycle, opacity 0→1→0.
- **`consciousness-tunnel-heavy`** (used at 8/8): Same full blackout cycle, opacity 0→1→0, with a brief hold at peak.

### File 2: `src/components/empyrean/BurnoutFlameOverlay.tsx`

Restructure the consciousness overlays for levels 6–8:

- **6/8 (ratio 0.625–0.75)**: The existing `consciousness-fade` div gets a more aggressive radial gradient (solid black edges, transparent center ~25%) and uses a **6s** animation cycle. Remove the static `opacity: 0.3` — let the animation control full 0→1 opacity.

- **7/8 (ratio 0.75–0.875)**: The `consciousness-tunnel` div uses a tighter gradient (transparent center ~15%) with a **5s** cycle. Remove the separate `consciousness-fade` div — consolidate into one tunnel overlay that goes full blackout.

- **8/8 (ratio 0.875+)**: The `consciousness-tunnel-heavy` div uses the tightest gradient (transparent center ~8%) with a **4s** cycle. Remove the separate `consciousness-fade` div — same consolidation.

The key difference from before: the animation opacity goes from `0` (fully see-through, all text readable) to `1` (fully opaque, no text visible) on each cycle, creating the dramatic "fading in and out of consciousness" effect.

### Technical details

Keyframe updates in tailwind.config.ts:
```
consciousness-fade:     0%,100% → opacity 0  |  50% → opacity 1
consciousness-tunnel:   0%,100% → opacity 0  |  50% → opacity 1  
consciousness-tunnel-heavy: 0%,100% → opacity 0  |  45%,55% → opacity 1 (hold at peak)
```

In the overlay component, remove inline `opacity` values on the consciousness divs so the animation drives the full range. Each tier's radial gradient determines how much of the center stays visible at peak darkness — the animation just controls the breathing.

