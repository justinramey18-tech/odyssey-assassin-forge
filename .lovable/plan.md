

# Generate Theme-Appropriate Skill Tree Backgrounds

## Overview
Create three unique AI-generated background images for each skill tree (Hunter, Warrior, Assassin), designed mobile-first with portrait orientation to match the inverted tree layout.

---

## Image Specifications

### Dimensions (Mobile-First)
- **Primary**: 720 x 1280 px (9:16 portrait)
- **Output Format**: WEBP for optimal performance
- **Style**: Dark fantasy, atmospheric, suitable for UI overlay

### Visual Themes Per Tree

| Tree | Color Theme | Scene Description |
|------|-------------|-------------------|
| **Hunter** | Forest greens, ethereal teal | Moonlit ancient forest, mist between towering trees, glowing bioluminescent plants, bow and arrows motif, owl silhouettes |
| **Warrior** | Crimson reds, blood orange | Greek colosseum at dusk, burning braziers, stone columns with battle scars, shield and sword silhouettes, war drums atmosphere |
| **Assassin** | Deep purple, shadow black | Shadowy rooftop cityscape, crescent moon, smoke/fog, hidden blades imagery, hooded figure silhouette, poison vials |

---

## Implementation Plan

### 1. Create Edge Function for Image Generation

**File**: `supabase/functions/generate-tree-backgrounds/index.ts`

```typescript
// Use Lovable AI API (google/gemini-2.5-flash-image) 
// Generate 3 images with specific prompts per tree
// Upload to Supabase Storage bucket
// Return public URLs
```

### 2. AI Prompts (Detailed)

**Hunter Tree:**
```
Dark fantasy forest scene at night, portrait orientation, deep green and teal color palette. 
Ancient massive trees with twisted roots, soft moonlight filtering through dense canopy. 
Ethereal mist swirling at the base, bioluminescent mushrooms and glowing fireflies. 
Subtle owl silhouettes perched on branches. 
Atmospheric and mysterious, suitable for UI overlay.
Dark edges fading to black for text legibility.
Style: concept art, painterly, AC Odyssey aesthetic.
```

**Warrior Tree:**
```
Dark fantasy Greek arena at sunset, portrait orientation, crimson and blood red color palette.
Ancient stone colosseum with cracked pillars and battle-worn architecture.
Burning braziers casting orange-red glow, smoke rising.
Dramatic clouds, war banners, crossed swords and shields carved in stone.
Intense and powerful atmosphere.
Dark vignette edges for UI overlay.
Style: concept art, painterly, God of War aesthetic.
```

**Assassin Tree:**
```
Dark fantasy shadowy cityscape at night, portrait orientation, deep purple and black color palette.
Rooftops with ancient Middle Eastern architecture, crescent moon through clouds.
Swirling shadows and smoke, subtle purple magical energy.
Hooded figure silhouette in distance, hidden blade motif subtly integrated.
Mysterious and dangerous atmosphere.
Heavy dark vignette for UI overlay.
Style: concept art, painterly, Assassin's Creed aesthetic.
```

### 3. Storage Setup

**Create Supabase Storage bucket**: `tree-backgrounds`
- Public access for CDN delivery
- Store generated images with paths:
  - `hunter-tree-mobile.webp`
  - `warrior-tree-mobile.webp`
  - `assassin-tree-mobile.webp`

### 4. Update TreeColumn Component

**File**: `src/components/abilities/TreeColumn.tsx`

Add background image layer behind ability nodes:
```typescript
// Import background URLs from config or directly
const treeBackgrounds: Record<AbilityTree, string> = {
  hunter: 'https://[storage-url]/tree-backgrounds/hunter-tree-mobile.webp',
  warrior: 'https://[storage-url]/tree-backgrounds/warrior-tree-mobile.webp',
  assassin: 'https://[storage-url]/tree-backgrounds/assassin-tree-mobile.webp',
};

// Add background layer in JSX
<div 
  className="absolute inset-0 bg-cover bg-center z-0"
  style={{ backgroundImage: `url(${treeBackgrounds[tree]})` }}
/>
<div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-0" />
```

### 5. Create Background Config File

**File**: `src/lib/abilityTrees/backgrounds.ts`

```typescript
import { AbilityTree } from '@/lib/types';

export const TREE_BACKGROUNDS: Record<AbilityTree, {
  mobile: string;
  desktop?: string;
  fallbackGradient: string;
}> = {
  hunter: {
    mobile: '/tree-backgrounds/hunter-tree-mobile.webp',
    fallbackGradient: 'linear-gradient(180deg, hsl(140 30% 8%) 0%, hsl(140 20% 4%) 100%)',
  },
  warrior: {
    mobile: '/tree-backgrounds/warrior-tree-mobile.webp',
    fallbackGradient: 'linear-gradient(180deg, hsl(0 30% 10%) 0%, hsl(0 20% 5%) 100%)',
  },
  assassin: {
    mobile: '/tree-backgrounds/assassin-tree-mobile.webp',
    fallbackGradient: 'linear-gradient(180deg, hsl(270 30% 10%) 0%, hsl(270 20% 5%) 100%)',
  },
};
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/generate-tree-backgrounds/index.ts` | CREATE | Edge function to generate and store images |
| `src/lib/abilityTrees/backgrounds.ts` | CREATE | Background URL configuration |
| `src/components/abilities/TreeColumn.tsx` | MODIFY | Add background image layer |
| `src/components/abilities/AbilitiesScreen.tsx` | MODIFY | Pass background context if needed |

---

## Execution Steps

1. **Create Storage Bucket**: Set up `tree-backgrounds` bucket in Supabase Storage
2. **Build Edge Function**: Create image generation function using Lovable AI API
3. **Generate Images**: Call the edge function to create all 3 backgrounds
4. **Update Components**: Integrate backgrounds into TreeColumn
5. **Add Fallbacks**: CSS gradient fallbacks while images load

---

## Image Generation API Usage

Using `google/gemini-2.5-flash-image` via Lovable AI Gateway:
```typescript
const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-image',
    messages: [{ role: 'user', content: prompt }],
    modalities: ['image', 'text'],
  }),
});
```

---

## Testing Checklist

- [ ] Hunter background generates with green forest theme
- [ ] Warrior background generates with red arena theme
- [ ] Assassin background generates with purple shadow theme
- [ ] Images load correctly in TreeColumn on mobile
- [ ] Fallback gradients display while images load
- [ ] UI elements (nodes, lines, text) remain legible over backgrounds
- [ ] Performance acceptable on mobile devices (image size < 200KB each)

