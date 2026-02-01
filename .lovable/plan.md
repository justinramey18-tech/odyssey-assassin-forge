
# Background Images for Legendary Star Map Constellations

## Overview
Generate 8 unique background images for each legendary equipment set's constellation star map. These backgrounds will enhance the visual theme of each set while maintaining legibility of the constellation nodes and UI elements.

---

## Image Generation Plan

### Image Specifications
- **Dimensions**: 9:16 portrait aspect ratio (mobile-first, ~1080x1920 or similar)
- **Style**: Dark fantasy, cosmic/nebula atmosphere with set-specific color accents
- **Opacity**: Images will be overlaid with gradients to ensure UI readability
- **Format**: JPG for file size optimization

### 8 Background Images to Generate

| # | Set ID | Set Name | Theme/Prompt Concept | Dominant Colors |
|---|--------|----------|---------------------|-----------------|
| 1 | `merc-with-mouth` | The Merc with a Mouth's Regalia | Dark cosmic nebula with red energy, broken comic panels floating in space, fourth-wall cracks in reality | Red, crimson, black |
| 2 | `chaotic-contracts` | Arsenal of Chaotic Contracts | Swirling chaos magic, scattered contract papers burning, mercenary guild symbols | Amber, orange, dark gold |
| 3 | `regenerative-ridiculousness` | Regalia of Regenerative Ridiculousness | Green healing energy, cellular regeneration patterns, DNA helixes dissolving into mist | Green, emerald, teal |
| 4 | `self-aware-arsenal` | The Mercenary's Self-Aware Arsenal | Purple cosmic awareness, floating speech bubbles, comic book physics effects | Purple, violet, magenta |
| 5 | `violent-comedy` | Vestments of Violent Comedy | Dark comedy stage with spotlights, cartoon explosions frozen in time | Orange, pink, dark red |
| 6 | `unkillable-merc` | The Unkillable Merc's Loadout | Blue immortal energy, souls unable to pass on, ethereal chains | Blue, cyan, steel gray |
| 7 | `absolute-absurdity` | Arsenal of Absolute Absurdity | Reality-warping vortex, meta-textual floating game dice, probability waves | Blue, amber, cosmic purple |
| 8 | `self-aware-slayer` | The Self-Aware Slayer's Kit | Golden narrative threads, script pages floating, story constellation patterns | Yellow, gold, warm white |

---

## File Structure

New files to create in `src/assets/constellations/`:

```text
src/assets/constellations/
├── merc-with-mouth-bg.jpg
├── chaotic-contracts-bg.jpg
├── regenerative-ridiculousness-bg.jpg
├── self-aware-arsenal-bg.jpg
├── violent-comedy-bg.jpg
├── unkillable-merc-bg.jpg
├── absolute-absurdity-bg.jpg
└── self-aware-slayer-bg.jpg
```

---

## Code Changes Required

### 1. Create Background Config File
**New file**: `src/lib/inventory/constellationBackgrounds.ts`

```typescript
// Import all constellation backgrounds
import mercWithMouthBg from '@/assets/constellations/merc-with-mouth-bg.jpg';
import chaoticContractsBg from '@/assets/constellations/chaotic-contracts-bg.jpg';
import regenerativeRidiculousnessBg from '@/assets/constellations/regenerative-ridiculousness-bg.jpg';
import selfAwareArsenalBg from '@/assets/constellations/self-aware-arsenal-bg.jpg';
import violentComedyBg from '@/assets/constellations/violent-comedy-bg.jpg';
import unkillableMercBg from '@/assets/constellations/unkillable-merc-bg.jpg';
import absoluteAbsurdityBg from '@/assets/constellations/absolute-absurdity-bg.jpg';
import selfAwareSlayerBg from '@/assets/constellations/self-aware-slayer-bg.jpg';

export const constellationBackgrounds: Record<string, string> = {
  'merc-with-mouth': mercWithMouthBg,
  'chaotic-contracts': chaoticContractsBg,
  'regenerative-ridiculousness': regenerativeRidiculousnessBg,
  'self-aware-arsenal': selfAwareArsenalBg,
  'violent-comedy': violentComedyBg,
  'unkillable-merc': unkillableMercBg,
  'absolute-absurdity': absoluteAbsurdityBg,
  'self-aware-slayer': selfAwareSlayerBg,
};
```

### 2. Update ConstellationMap Component
**File**: `src/components/constellation/ConstellationMap.tsx`

Modify the `SetConstellation` component to include the background image:

```typescript
// Add import at top
import { constellationBackgrounds } from '@/lib/inventory/constellationBackgrounds';

// Inside SetConstellation component, add background layer:
<div className="relative flex-shrink-0 w-[320px] h-[500px] mx-4 rounded-xl border-2 ...">
  {/* Background Image Layer */}
  <div 
    className="absolute inset-0 rounded-xl bg-cover bg-center opacity-30"
    style={{ 
      backgroundImage: `url(${constellationBackgrounds[setInfo.id]})`,
    }}
  />
  {/* Gradient overlay for legibility */}
  <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-black/60 via-transparent to-black/80" />
  
  {/* Rest of existing content... */}
</div>
```

---

## Image Generation Prompts

### Prompt 1: merc-with-mouth-bg.jpg
> "Dark cosmic nebula background, 9:16 portrait, deep crimson red energy wisps, shattered comic book panels floating in void, cracks in reality showing stars behind, fourth-wall breaking visual metaphor, no characters, dark fantasy atmosphere, subtle red glow, cinematic lighting"

### Prompt 2: chaotic-contracts-bg.jpg  
> "Dark fantasy background, 9:16 portrait, swirling amber and orange chaos magic, burning parchment contracts floating, mercenary guild sigils, chaotic energy vortex, no characters, atmospheric fog, warm orange glow accents on black"

### Prompt 3: regenerative-ridiculousness-bg.jpg
> "Dark cosmic background, 9:16 portrait, green bioluminescent energy, cellular regeneration patterns, DNA helix dissolving into emerald mist, healing factor visualization, no characters, teal and green glow, organic cosmic aesthetic"

### Prompt 4: self-aware-arsenal-bg.jpg
> "Dark surreal background, 9:16 portrait, purple cosmic awareness energy, floating empty speech bubbles, comic book panel borders floating in void, meta-reality aesthetic, violet and magenta glow, no characters, philosophical space"

### Prompt 5: violent-comedy-bg.jpg
> "Dark comedy stage background, 9:16 portrait, dramatic spotlights in darkness, cartoon explosion effects frozen in time, dark humor aesthetic, orange and pink accent lighting, theatrical curtains in shadows, no characters"

### Prompt 6: unkillable-merc-bg.jpg
> "Dark ethereal background, 9:16 portrait, blue immortal energy streams, ghostly souls swirling, ethereal chains breaking, unable to die visualization, cyan and steel blue glow, cosmic immortality theme, no characters"

### Prompt 7: absolute-absurdity-bg.jpg
> "Reality-warping cosmic background, 9:16 portrait, probability waves distorting space, floating D20 dice glowing, meta-textual elements, blue and amber energy clash, impossible geometry, no characters, absurdist cosmic void"

### Prompt 8: self-aware-slayer-bg.jpg
> "Golden narrative thread background, 9:16 portrait, floating script pages glowing, story constellation patterns, warm golden light threading through darkness, author's perspective cosmic view, yellow and warm white glow, no characters"

---

## Technical Implementation Steps

1. **Generate Images**: Use Lovable AI image generation (google/gemini-2.5-flash-image or google/gemini-3-pro-image-preview for higher quality) to create each background
2. **Save Images**: Store in `src/assets/constellations/` directory
3. **Create Config**: Add `constellationBackgrounds.ts` with image imports and mapping
4. **Update Component**: Modify `SetConstellation` in `ConstellationMap.tsx` to display backgrounds
5. **Test**: Verify each constellation map displays its themed background with proper opacity and overlay

---

## Visual Hierarchy Considerations

- Background opacity: 20-35% to not overwhelm constellation nodes
- Gradient overlays ensure title and bonuses remain readable
- Set-specific glow colors will complement the background themes
- Dark vignette edges maintain focus on center constellation
