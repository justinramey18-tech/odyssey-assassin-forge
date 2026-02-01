

# Updated Background Images for Legendary Star Map Constellations

## Overview
Generate 8 unique background images for each legendary equipment set's constellation star map, now featuring an Assassin's Creed assassin wearing thematically appropriate armor for each set.

---

## Revised Image Generation Prompts

### Prompt 1: merc-with-mouth-bg.jpg
> "Dark cosmic nebula background, 9:16 portrait, an Assassin's Creed assassin wearing crimson red and black armor with Deadpool-inspired design elements, hood up, standing dramatically against shattered comic book panels floating in void, cracks in reality showing stars behind, deep red energy wisps, fourth-wall breaking visual metaphor, dark fantasy atmosphere, subtle red glow, cinematic lighting, back view or three-quarter view"

### Prompt 2: chaotic-contracts-bg.jpg  
> "Dark fantasy background, 9:16 portrait, an Assassin's Creed assassin wearing amber and burnt orange mercenary armor with chaos magic runes, hood up, surrounded by swirling chaos magic, burning parchment contracts floating around them, mercenary guild sigils glowing, chaotic energy vortex, atmospheric fog, warm orange glow accents on black, dramatic pose"

### Prompt 3: regenerative-ridiculousness-bg.jpg
> "Dark cosmic background, 9:16 portrait, an Assassin's Creed assassin wearing emerald green armor with organic cellular patterns and DNA helix motifs, hood up, green bioluminescent energy emanating from their form, healing factor visualization swirling around them, teal and green glow, organic cosmic aesthetic, regenerative energy tendrils"

### Prompt 4: self-aware-arsenal-bg.jpg
> "Dark surreal background, 9:16 portrait, an Assassin's Creed assassin wearing violet and magenta armor with meta-textual comic panel designs, hood up, purple cosmic awareness energy radiating from them, floating empty speech bubbles around, comic book panel borders floating in void, meta-reality aesthetic, philosophical space atmosphere"

### Prompt 5: violent-comedy-bg.jpg
> "Dark comedy stage background, 9:16 portrait, an Assassin's Creed assassin wearing theatrical orange and dark red armor with comedy/tragedy mask motifs, hood up, standing on a dark stage with dramatic spotlights, cartoon explosion effects frozen around them, dark humor aesthetic, pink accent lighting, theatrical curtains in shadows"

### Prompt 6: unkillable-merc-bg.jpg
> "Dark ethereal background, 9:16 portrait, an Assassin's Creed assassin wearing cyan and steel blue immortal armor with ethereal chain designs, hood up, blue immortal energy streams flowing through and around them, ghostly souls swirling, breaking free from ethereal chains, unable to die visualization, cosmic immortality theme, spectral glow"

### Prompt 7: absolute-absurdity-bg.jpg
> "Reality-warping cosmic background, 9:16 portrait, an Assassin's Creed assassin wearing blue and amber armor with impossible geometry patterns and dice motifs, hood up, probability waves distorting space around them, floating glowing D20 dice, meta-textual elements, reality bending around their form, absurdist cosmic void, surreal lighting"

### Prompt 8: self-aware-slayer-bg.jpg
> "Golden narrative thread background, 9:16 portrait, an Assassin's Creed assassin wearing warm gold and white armor with script page and quill designs, hood up, golden narrative threads weaving through and around them, floating glowing script pages, story constellation patterns in the sky, author's perspective cosmic view, warm golden light threading through darkness"

---

## Updated 8 Background Images Summary

| # | Set ID | Assassin Armor Theme |
|---|--------|---------------------|
| 1 | `merc-with-mouth` | Crimson/black Deadpool-inspired assassin armor |
| 2 | `chaotic-contracts` | Amber/orange mercenary armor with chaos runes |
| 3 | `regenerative-ridiculousness` | Emerald green armor with cellular/DNA patterns |
| 4 | `self-aware-arsenal` | Violet/magenta meta-textual comic armor |
| 5 | `violent-comedy` | Orange/dark red theatrical armor with mask motifs |
| 6 | `unkillable-merc` | Cyan/steel blue immortal armor with chain designs |
| 7 | `absolute-absurdity` | Blue/amber armor with impossible geometry and dice |
| 8 | `self-aware-slayer` | Gold/white armor with script and narrative elements |

---

## File Structure (Unchanged)

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

## Code Changes Required (Unchanged from Original Plan)

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

## Implementation Steps

1. **Generate Images**: Use Lovable AI image generation (google/gemini-3-pro-image-preview for higher quality) to create each background with the themed assassin
2. **Save Images**: Store in `src/assets/constellations/` directory
3. **Create Config**: Add `constellationBackgrounds.ts` with image imports and mapping
4. **Update Component**: Modify `SetConstellation` in `ConstellationMap.tsx` to display backgrounds
5. **Test**: Verify each constellation map displays its themed assassin background with proper opacity and overlay

---

## Visual Hierarchy Considerations

- Background opacity: 20-35% to not overwhelm constellation nodes
- Assassin figures positioned to not interfere with node placement (center or lower portions)
- Gradient overlays ensure title and bonuses remain readable
- Set-specific glow colors will complement the assassin armor themes
- Dark vignette edges maintain focus on center constellation

