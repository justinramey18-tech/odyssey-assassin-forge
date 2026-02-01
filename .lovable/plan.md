
# Navigation Redesign - Category Tabs with Swipe Sub-Navigation

## Overview
Restructure the main navigation from 12+ individual tabs to 4 main tabs: **Home** (unchanged), **Fighting**, **Inventory**, and **Utility**. Each category tab contains sub-tabs that users can swipe through using upper-thumb swipe gestures.

---

## Navigation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN NAVIGATION BAR                          │
├────────────┬────────────┬────────────┬─────────────────────────┤
│    Home    │  Fighting  │  Inventory │        Utility          │
│  (green)   │   (red)    │   (amber)  │        (cyan)           │
└────────────┴────────────┴────────────┴─────────────────────────┘
                  ↓              ↓               ↓
         ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
         │ • Combat      │ │ • Consumables │ │ • Scribe      │
         │ • Skills      │ │ • Gear        │ │ • Chronicle   │
         │ • Abilities   │ │ • Stars       │ │ • Cloud       │
         │ • Arcana      │ │ • Feats       │ │ • Settings    │
         │ • Legacy      │ │               │ │               │
         └───────────────┘ └───────────────┘ └───────────────┘
              ↕ swipe          ↕ swipe          ↕ swipe
```

---

## User Interaction Flow

1. **Tap main category tab** (Fighting/Inventory/Utility)
2. **See sub-tab indicator strip** below header showing current sub-tab
3. **Swipe up/down** in the sub-tab indicator area to navigate between sub-tabs
4. **Content area updates** to show selected sub-tab's screen

---

## Technical Implementation

### New Files to Create

#### 1. `src/components/navigation/CategoryNavigation.tsx`
Primary navigation bar with 4 main tabs:
- Home (green glow, house icon) - triggers `onHomeClick` callback
- Fighting (red glow, swords icon) - opens sub-nav
- Inventory (amber glow, backpack icon) - opens sub-nav  
- Utility (cyan glow, wrench icon) - opens sub-nav

Features:
- Assassin's Creed styling (angular borders, gradient lines)
- Active state glows matching category color
- Single row, no horizontal scroll needed

#### 2. `src/components/navigation/SubTabStrip.tsx`
Sub-tab indicator and swipe target for each category:

```typescript
interface SubTabStripProps {
  category: 'fighting' | 'inventory' | 'utility';
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
}
```

Features:
- Horizontal strip below main nav showing: `◀ Current Tab Name (2/5) ▶`
- Swipe up/down in this area changes sub-tab
- Touch-friendly height (48px minimum)
- Category-specific color theming
- Dot indicators or progress bar for position

#### 3. `src/components/navigation/types.ts`
Type definitions for the category system:

```typescript
export type MainCategory = 'home' | 'fighting' | 'inventory' | 'utility';

export interface SubTabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const FIGHTING_TABS: SubTabConfig[] = [
  { id: 'combat', label: 'Combat', icon: Crosshair, color: 'text-red-400' },
  { id: 'skills', label: 'Skills', icon: Swords, color: 'text-red-400' },
  { id: 'abilities', label: 'Abilities', icon: Zap, color: 'text-violet-400' },
  { id: 'arcana', label: 'Arcana', icon: Wand2, color: 'text-indigo-400' },
  { id: 'legacy', label: 'Legacy', icon: Crown, color: 'text-purple-400' },
];

export const INVENTORY_TABS: SubTabConfig[] = [
  { id: 'consumables', label: 'Consumables', icon: FlaskConical, color: 'text-emerald-400' },
  { id: 'gear', label: 'Gear', icon: Backpack, color: 'text-amber-400' },
  { id: 'stars', label: 'Stars', icon: Sparkles, color: 'text-cyan-400' },
  { id: 'feats', label: 'Feats', icon: Trophy, color: 'text-purple-400' },
];

export const UTILITY_TABS: SubTabConfig[] = [
  { id: 'scribe', label: 'Scribe', icon: BookOpen, color: 'text-amber-400' },
  { id: 'chronicle', label: 'Chronicle', icon: Search, color: 'text-blue-400' },
  { id: 'cloud', label: 'Cloud', icon: Cloud, color: 'text-sky-400' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400' },
];
```

#### 4. `src/hooks/use-category-navigation.ts`
Custom hook to manage category and sub-tab state:

```typescript
interface UseCategoryNavigationReturn {
  mainCategory: MainCategory;
  activeSubTab: string;
  setMainCategory: (category: MainCategory) => void;
  navigateToSubTab: (subTabId: string) => void;
  swipeToNextSubTab: () => void;
  swipeToPrevSubTab: () => void;
  getCurrentSubTabs: () => SubTabConfig[];
  getSubTabIndex: () => { current: number; total: number };
}
```

Features:
- Remembers last active sub-tab per category
- Handles swipe direction mapping
- Provides sub-tab metadata for display
- Handles Legacy lock state

---

### Existing Files to Modify

#### 1. `src/components/navigation/AssassinHeader.tsx`
**Complete rewrite** to use new category system:

Changes:
- Replace 12+ individual TabsTriggers with 4 main category buttons
- Home tab remains identical (green, onClick triggers `onHomeClick`)
- Remove all sub-tab triggers from header
- Export main category selection only
- Keep Assassin's Creed border styling

New structure:
```typescript
<header className="sticky top-0 z-50 ...">
  {/* Decorative borders unchanged */}
  
  <TabsList className="h-full flex justify-center ...">
    <TabsTrigger value="home">Home</TabsTrigger>
    <TabsTrigger value="fighting">Fighting</TabsTrigger>
    <TabsTrigger value="inventory">Inventory</TabsTrigger>
    <TabsTrigger value="utility">Utility</TabsTrigger>
  </TabsList>
</header>
```

#### 2. `src/pages/Index.tsx`

**State Changes** (around line 82):
```typescript
// Replace activeTab with category-based state
const [mainCategory, setMainCategory] = useState<MainCategory>('fighting');
const [fightingSubTab, setFightingSubTab] = useState<string>('combat');
const [inventorySubTab, setInventorySubTab] = useState<string>('consumables');
const [utilitySubTab, setUtilitySubTab] = useState<string>('scribe');
```

**Component Integration** (around line 864-1121):
- Wrap content in category containers
- Add `SubTabStrip` below `AssassinHeader`
- Implement swipe handlers for sub-tab navigation
- Render correct content based on category + sub-tab

New render structure:
```typescript
<Tabs value={mainCategory} onValueChange={handleCategoryChange}>
  <AssassinHeader 
    onHomeClick={() => setShowHomeScreen(true)}
    isLegacyUnlocked={prestigeTree.isLegacyUnlocked}
  />
  
  {/* Sub-tab strip - only visible when not on home */}
  {mainCategory !== 'home' && (
    <SubTabStrip
      category={mainCategory}
      activeSubTab={getCurrentSubTab()}
      onSubTabChange={handleSubTabChange}
    />
  )}
  
  {/* Category-specific content with swipe handlers */}
  <div {...swipeHandlers}>
    {renderActiveContent()}
  </div>
</Tabs>
```

#### 3. `src/components/home/HomeScreen.tsx`
**Minor changes** - Update `onNavigateToTab` to navigate to category + sub-tab:

```typescript
// Update card click to set both category and sub-tab
const handleCardClick = (cardId: NavigableTab) => {
  triggerHaptic('light');
  // Map card ID to category + sub-tab
  const mapping = getTabToCategoryMapping(cardId);
  onNavigateToTab(mapping.category, mapping.subTab);
};
```

Add prop update:
```typescript
interface HomeScreenProps {
  // Change from:
  // onNavigateToTab: (tab: NavigableTab) => void;
  // To:
  onNavigateToTab: (category: MainCategory, subTab: string) => void;
}
```

---

## Sub-Tab Swipe Interaction Design

### Swipe Target Zone
The `SubTabStrip` component serves as the primary swipe target:
- Height: 48px (thumb-friendly)
- Full width below main header
- Visual swipe indicators (up/down arrows)

### Swipe Direction
- **Swipe UP** → Next sub-tab (move forward in list)
- **Swipe DOWN** → Previous sub-tab (move back in list)

### Visual Feedback During Swipe
```
┌────────────────────────────────────────────────┐
│         ▲ Swipe up for: Skills                 │
├────────────────────────────────────────────────┤
│  ◀  Combat  ●○○○○  ▶                          │
├────────────────────────────────────────────────┤
│         ▼ Swipe down for: Abilities            │
└────────────────────────────────────────────────┘
```

### Animation
- Slide transition between sub-tabs (200ms ease-out)
- Opacity fade during transition
- Haptic feedback on sub-tab change

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/navigation/types.ts` | **Create** | Type definitions and tab configurations |
| `src/components/navigation/SubTabStrip.tsx` | **Create** | Swipeable sub-tab indicator strip |
| `src/components/navigation/CategoryNavigation.tsx` | **Create** | 4-tab main navigation bar |
| `src/hooks/use-category-navigation.ts` | **Create** | Navigation state management hook |
| `src/components/navigation/index.ts` | **Create** | Module exports |
| `src/components/navigation/AssassinHeader.tsx` | **Modify** | Simplify to 4 main tabs |
| `src/pages/Index.tsx` | **Modify** | Update state and content rendering |
| `src/components/home/HomeScreen.tsx` | **Modify** | Update navigation callback signature |

---

## Settings Tab Handling (Special Case)

The Settings tab in Utility category will trigger the existing `SettingsModal` instead of a full-screen tab:

```typescript
const handleSubTabChange = (subTab: string) => {
  if (subTab === 'settings') {
    setShowSettingsModal(true);
    return; // Don't change active sub-tab
  }
  // Normal sub-tab change
  setActiveSubTab(subTab);
};
```

---

## Cloud Tab Handling (Special Case)

The Cloud tab in Utility category will trigger the existing `CloudSaveModal`:

```typescript
if (subTab === 'cloud') {
  setShowCloudSaveModal(true);
  return;
}
```

---

## Mobile-First Considerations

1. **Touch Targets**: Main category tabs minimum 70px width, sub-tab strip 48px height
2. **Haptic Feedback**: Vibration on category and sub-tab changes
3. **Swipe Gesture**: Uses existing `useSwipe` hook with vertical orientation
4. **Animation**: Framer Motion for smooth transitions between sub-tabs
5. **State Persistence**: Remember last active sub-tab per category in localStorage
