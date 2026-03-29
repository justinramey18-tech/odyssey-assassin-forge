

## Plan: Animate Flame Borders + Intensify Text Waver

### Task 1: Dynamic dancing flames in BurnoutFlameOverlay

The current flame border uses a static image with CSS scale/translate animations — which only makes the image pulse, not look like real fire. To create dancing flames, we'll add a continuously shifting `background-position` animation to the flame image, combined with layered pseudo-random motion.

**Changes to `BurnoutFlameOverlay.tsx`:**
- Add a second animation to each flame edge: a `flame-dance` animation that shifts `background-position` continuously, creating the illusion of moving fire within the border strip
- Layer multiple offset copies of the flame image using CSS `background` with different animation delays to create depth
- Replace the single `<img>` per side with a `<div>` that uses the flame image as a CSS background, allowing `background-position` animation (img tags don't support this)
- Each side gets slightly different animation timings/delays for organic feel

**Changes to `tailwind.config.ts`:**
- Add `flame-dance` keyframe: continuously shifts `background-position` (e.g., `0% { background-position: 0% 0% }` → `100% { background-position: 100% 50% }`)
- Add `flame-dance-vertical` variant for left/right sides

The result: flame images that appear to flow and dance along the border rather than just pulsing in place.

### Task 2: Increase text waver at near-max and max burnout

Currently the text waver caps at `1.5s` duration at 75%+ ratio, with fixed `text-waver` keyframe values. At near-max and max, we want more aggressive distortion.

**Changes to `tailwind.config.ts`:**
- Add `text-waver-intense` keyframe with larger translation (±1.5px), stronger skew (±0.5deg), and more blur (up to 0.6px)
- Add `text-waver-critical` keyframe with even more extreme values (±2.5px translate, ±0.8deg skew, up to 1px blur)

**Changes to `PartyDMScreen.tsx` (lines 1741-1748):**
- At ratio >= 0.95 (max): use `text-waver-critical` at 1s duration
- At ratio >= 0.85 (near-max): use `text-waver-intense` at 1.2s duration
- At ratio >= 0.75: keep existing `text-waver` at 1.5s
- At ratio >= 0.5: keep existing `text-waver` at 3s

### Files modified
1. **`src/components/empyrean/BurnoutFlameOverlay.tsx`** — replace `<img>` with background-div approach, add compound flame-dance animation
2. **`tailwind.config.ts`** — add `flame-dance`, `text-waver-intense`, `text-waver-critical` keyframes
3. **`src/components/ai-dm/PartyDMScreen.tsx`** — add two more waver tiers for near-max/max burnout

