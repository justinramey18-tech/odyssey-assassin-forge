
# Add Swipe Navigation to GM Prompts Category Tabs

## Overview
Add left/right swipe gestures to the category filter tabs in the **Modular GM Prompts** section, allowing users to cycle through categories (All → Core → Abilities → Gear → Systems → Advanced) with horizontal swipes.

## Current State
- The GM Prompts component (`GMGuidePrompts.tsx`) has 6 category tabs: All, Core, Abilities, Gear, Systems, Advanced
- Categories are rendered as buttons inside a horizontal `ScrollArea`
- The `activeCategory` state tracks the currently selected filter
- A `useSwipe` hook already exists in the codebase for handling swipe gestures

## Implementation Plan

### File: `src/components/settings/GMGuidePrompts.tsx`

**1. Add swipe hook integration**
- Import the existing `useSwipe` hook
- Create a combined categories array: `['all', ...PROMPT_CATEGORIES.map(c => c.id)]`
- Calculate current index from `activeCategory`
- Implement `handleSwipeLeft` (next category) and `handleSwipeRight` (previous category) with wrap-around

**2. Attach swipe handlers to the category filter area**
- Wrap the category filter section with swipe touch handlers
- Add visual feedback during swipe (subtle transform based on `swipeOffset`)

**3. Add navigation arrow buttons (optional desktop enhancement)**
- Add ChevronLeft/ChevronRight buttons on either side of the tabs
- Show on both mobile (as touch targets) and desktop (as click targets)

**4. Add category indicator dots or label**
- Show current position in the category cycle (e.g., "2 of 6")
- Provide visual confirmation of navigation

## Technical Details

```typescript
// Combined categories array
const allCategories = useMemo(() => [
  { id: 'all', label: 'All', icon: '🔍' },
  ...PROMPT_CATEGORIES
], []);

// Current index calculation
const currentIndex = allCategories.findIndex(c => c.id === activeCategory);

// Swipe handlers with wrap-around
const handleSwipeLeft = useCallback(() => {
  const nextIndex = (currentIndex + 1) % allCategories.length;
  setActiveCategory(allCategories[nextIndex].id);
}, [currentIndex, allCategories]);

const handleSwipeRight = useCallback(() => {
  const prevIndex = (currentIndex - 1 + allCategories.length) % allCategories.length;
  setActiveCategory(allCategories[prevIndex].id);
}, [currentIndex, allCategories]);

const { handlers, swipeOffset, swiping } = useSwipe(handleSwipeLeft, handleSwipeRight);
```

## UI Enhancement
- Add left/right chevron buttons flanking the category tabs
- Show position indicator (e.g., "Core • 2/6")
- Apply subtle horizontal transform during swipe for tactile feedback

## Files to Modify
- `src/components/settings/GMGuidePrompts.tsx` - Add swipe logic and navigation controls

## Expected Behavior
1. **Swipe left**: Move to next category (All → Core → Abilities → Gear → Systems → Advanced → All...)
2. **Swipe right**: Move to previous category (reverse order)
3. **Tap chevrons**: Same as swipe but via button press
4. **Visual feedback**: Categories smoothly animate on change, current position shown
