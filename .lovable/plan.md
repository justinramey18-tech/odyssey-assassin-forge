

# Add Infinity Stone Prompts to Solo and Party DM

## Overview
Create a new full-screen, mobile-first Infinity Stone browser component that integrates into both Solo DM and Party DM chat interfaces. Instead of copying prompts to clipboard, tapping "Use" will auto-populate the player's input field and close the overlay.

## What Changes

### 1. New Component: `InfinityStoneDMDrawer.tsx`
**File:** `src/components/ai-dm/InfinityStoneDMDrawer.tsx`

A full-screen Drawer (using the existing Vaul-based Drawer component) optimized for mobile vertical scrolling:
- Reuses the existing `infinityStones` configuration and `characterPrompts` data from `src/lib/characterPrompts.ts`
- Includes the same intensity filter chips (Favorites, All, Mild, Moderate, Extreme) and favorite-starring from the existing `InfinityStoneDrawer`
- Includes Random and Surprise Me buttons
- Each prompt displays title, description, intensity badge, and a star/favorite toggle
- **"Use" button** (instead of "Copy") that calls `onUsePrompt(processedPrompt)` -- processing includes character name replacement and 4th Wall Time prefix
- Accordion-based stone sections with gem icons and counts
- Closes the drawer automatically after tapping "Use"
- Full vertical scrolling, touch-friendly tap targets (min 44px)

### 2. Solo DM Integration
**File:** `src/components/ai-dm/AIDMScreen.tsx`

- Add a Gem icon button in the input bar area (alongside photo/video attach buttons)
- Wire it to open the `InfinityStoneDMDrawer`
- The `onUsePrompt` callback populates the `input` state via `setInput` (same pattern as Party DM's `handleUsePrompt`)
- Change from Solo DM's current `handleQuickAction` (which sends immediately) to populating the input field so the user can review/edit before sending

### 3. Party DM Integration
**File:** `src/components/ai-dm/PartyDMScreen.tsx`

- Add a Gem icon button next to the existing Quick Actions button in the input area
- Wire it to open the `InfinityStoneDMDrawer`
- Reuse the existing `handleUsePrompt` callback which already populates the input field

## Technical Details

### Component Props
```typescript
interface InfinityStoneDMDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characterName: string;
  onUsePrompt: (prompt: string) => void;
}
```

### Data Reuse
- `characterPrompts` and `CharacterPrompt` from `src/lib/characterPrompts.ts`
- `applyTimePrefix` from `src/lib/fourthWallTime.ts`
- `useFavoritePrompts` from `src/hooks/use-favorite-prompts.ts`
- Stone definitions (id, name, color, categories) inline in the new component (matching existing pattern)

### UI Layout (Mobile-First)
- Full-screen Drawer with `max-h-[85vh]`
- Sticky header with title and intensity filter chips
- Random/Surprise Me action bar
- Accordion sections per stone, each with collapsible prompt lists
- Each prompt row: star button | icon + title + description | intensity badge | green "Use" button with Play icon
- Bottom padding for safe area

### Files Modified
1. **New:** `src/components/ai-dm/InfinityStoneDMDrawer.tsx`
2. **Edit:** `src/components/ai-dm/AIDMScreen.tsx` -- add Gem button + drawer state + import
3. **Edit:** `src/components/ai-dm/PartyDMScreen.tsx` -- add Gem button + drawer state + import

