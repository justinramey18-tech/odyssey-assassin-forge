
# Mobile-First Card-Based Home Screen Implementation Plan

## Overview
Transform the current panoramic assassin Home Screen into a mobile-optimized, card-based dashboard with touch-friendly navigation cards providing quick access to all major features.

---

## Current State Analysis

### Components to Modify/Replace

| File | Current State | Action |
|------|---------------|--------|
| `src/components/home/HomeScreen.tsx` | Panoramic panning view with 7 AssassinZones | **Complete rewrite** |
| `src/pages/Index.tsx` | Lines 541-547 handle 4 tabs only | **Extend navigation callback** |
| `tailwind.config.ts` | No badge animation | **Add badge-pulse keyframe** |

### Components to Keep (Unchanged)

| File | Reason |
|------|--------|
| `HomeDataModal.tsx` | Useful for quick action confirmations |
| `HomeModalContents.tsx` | Contains reusable stat displays (CharacterStatsContent, etc.) |
| `ClockWidget.tsx` | Integrate into new header |
| `InstallBanner.tsx` | Keep at top of layout |
| `AssassinZone.tsx` | Keep in codebase but no longer used by HomeScreen |

---

## Architecture

### New HomeScreen Component Structure

```text
HomeScreen.tsx (complete rewrite)
├── InstallBanner (existing)
├── Header Section
│   ├── Back button (onReturnToBuilder)
│   ├── Character avatar + name + level
│   ├── XP progress bar (using existing Progress component)
│   └── ClockWidget (existing)
├── QuickStats Row
│   ├── HP card (Heart icon, red theme)
│   ├── AC card (Shield icon, blue theme)
│   └── Initiative card (Zap icon, yellow theme)
├── Navigation Grid (2-col mobile, 3-col tablet, 4-col desktop)
│   └── 9 NavigationCard components
└── QuickActions Panel
    ├── Short Rest button
    ├── Long Rest button
    └── Level Up button (conditional on XP)
```

### Navigation Card Configuration

| Card | Tab Target | Icon | Color | Badge Logic |
|------|------------|------|-------|-------------|
| Skills | `skills` | `BookOpen` | Blue | None |
| Abilities | `abilities` | `Zap` | Violet | Available ability points |
| Gear | `gear` | `Backpack` | Amber | None |
| Feats | `feats` | `Trophy` | Yellow | Unclaimed achievements |
| Combat | `combat` | `Swords` | Red | None |
| Scribe | `scribe` | `Scroll` | Orange | None |
| Items | `consumables` | `Beaker` | Green | Inventory count |
| Chronicle | `chronicle` | `FileSearch` | Blue-600 | Has undo available |
| Stars | `stars` | `Star` | Purple | None |

---

## Detailed Implementation

### Phase 1: Add Badge Animation to Tailwind

**File: `tailwind.config.ts`**

Add new keyframe and animation:

```typescript
keyframes: {
  // ... existing keyframes
  "badge-pulse": {
    "0%, 100%": { opacity: "1", transform: "scale(1)" },
    "50%": { opacity: "0.8", transform: "scale(1.1)" },
  },
},
animation: {
  // ... existing animations
  "badge-pulse": "badge-pulse 2s ease-in-out infinite",
},
```

### Phase 2: Extend HomeScreen Props Interface

**Current limitation (line 102):**
```typescript
onNavigateToTab: (tab: 'abilities' | 'inventory' | 'achievements' | 'constellation') => void;
```

**New interface:**
```typescript
// Extend to support all tabs
type NavigableTab = 
  | 'skills' 
  | 'abilities' 
  | 'gear' 
  | 'feats' 
  | 'stars' 
  | 'scribe' 
  | 'combat' 
  | 'consumables' 
  | 'chronicle';

interface HomeScreenProps {
  character: Character;
  equipment: CharacterEquipment;
  achievements: Achievement[];
  currentXP: number;
  xpPreset: XPPreset;
  onBack: () => void;
  onNavigateToTab: (tab: NavigableTab) => void; // Extended
  onShortRest: () => void;
  onLongRest: () => void;
  onAddXP: (amount: number, source: string) => void;
  onXPPresetChange: (preset: XPPreset) => void;
  onManualLevelUp: () => void;
  onReturnToBuilder: () => void;
}
```

### Phase 3: Index.tsx Navigation Handler Update

**File: `src/pages/Index.tsx` (lines 541-547)**

Update the onNavigateToTab handler to support all tabs:

```typescript
onNavigateToTab={(tab) => {
  setShowHomeScreen(false);
  // Direct mapping for all tabs
  setActiveTab(tab as typeof activeTab);
}}
```

This works because the new tab names match the activeTab union type directly.

### Phase 4: Complete HomeScreen Rewrite

**File: `src/components/home/HomeScreen.tsx`**

The new implementation will have these major sections:

#### 4.1 Header Section

```text
+----------------------------------------+
| [←]  [Avatar] CharacterName   LV.15    |
|      ━━━━━━━━━ 1,250 / 6,500 XP  [🕐]  |
+----------------------------------------+
```

Features:
- Back button using existing `onReturnToBuilder`
- Avatar with level badge (reuse pattern from HomeModalContents)
- XP progress bar using existing `Progress` component
- ClockWidget positioned on right

#### 4.2 Quick Stats Row

```text
+----------+----------+----------+
|    ❤️    |    🛡️    |    ⚡    |
|   45/64  |    16    |   +3    |
|    HP    |    AC    |  Init   |
+----------+----------+----------+
```

Features:
- Three equal-width cards using CSS grid
- Icon with colored background tint
- Large value text
- Small label text
- Uses `useEquipmentStats` hook for AC calculation

#### 4.3 Navigation Grid

```text
Mobile (2-col):           Desktop (4-col):
+-------+--------+        +------+------+------+------+
| Skills|Abilities        |Skills|Abilit|Gear  |Feats |
+-------+--------+        +------+------+------+------+
| Gear  | Feats |         |Combat|Scribe|Items |Chron |
+-------+--------+        +------+------+------+------+
|Combat | Scribe|         |Stars |      |      |      |
+-------+--------+        +------+------+------+------+
| Items |Chronicle
+-------+--------+
| Stars |
+-------+
```

Each card features:
- Minimum 120px height (exceeds 48px WCAG touch target)
- Icon with background tint matching theme color
- Label text
- Optional notification badge with pulse animation
- `touchAction: 'manipulation'` for iOS
- Haptic feedback on tap
- Scale on hover (desktop) / press (mobile)

#### 4.4 Notification Badge Logic

```typescript
const getBadge = (tabId: string): string | number | undefined => {
  switch (tabId) {
    case 'abilities':
      const available = getAbilityPointsForLevel(character.level) - 
        getTotalPointsSpent(character.abilities);
      return available > 0 ? available : undefined;
    
    case 'feats':
      const unclaimed = achievements.filter(
        a => a.currentValue >= a.maxValue && !a.claimedMilestones?.includes(100)
      ).length;
      return unclaimed > 0 ? unclaimed : undefined;
    
    case 'consumables':
      // Would need consumables prop - keep simple for now
      return undefined;
    
    case 'chronicle':
      const hasUndo = localStorage.getItem('odyssey-chronicle-undo');
      return hasUndo ? '!' : undefined;
    
    default:
      return undefined;
  }
};
```

#### 4.5 Quick Actions Panel

```text
Mobile (bottom bar):
+------------------+------------------+
| ☕ Short Rest    | 🌙 Long Rest     |
+------------------+------------------+

Desktop (sidebar):
+------------------------+
| Quick Actions          |
| [☕ Short Rest]        |
| [🌙 Long Rest]         |
| [⬆️ Level Up] (if XP) |
+------------------------+
```

#### 4.6 Touch Optimizations

| Optimization | Implementation |
|--------------|----------------|
| Touch targets | 120px min-height for cards, 48px for buttons |
| Haptic feedback | `navigator.vibrate(10)` on card tap |
| Prevent double-tap zoom | `touchAction: 'manipulation'` on all interactive elements |
| Active state | `active:scale-95` for press feedback |
| Hover state | `hover:scale-105 hover:shadow-lg` for desktop |

---

## Responsive Layout

### Breakpoint Strategy

**Mobile (<768px):**
- Header: Stacked layout (avatar above name on smaller screens)
- Quick Stats: 3-column horizontal row
- Navigation: 2-column grid
- Quick Actions: Fixed bottom bar

**Tablet (768-1024px):**
- Header: Horizontal layout
- Quick Stats: 3-column with larger cards
- Navigation: 3-column grid
- Quick Actions: Bottom bar

**Desktop (>1024px):**
- Header: Full-width with character info
- Quick Stats: 3-column with descriptions
- Navigation: 4-column grid
- Quick Actions: Right sidebar panel

### Grid Classes

```typescript
// Navigation grid
className={cn(
  "grid gap-3",
  "grid-cols-2",        // Mobile base
  "md:grid-cols-3",     // Tablet
  "lg:grid-cols-4"      // Desktop
)}

// Quick stats
className="grid grid-cols-3 gap-3"

// Header
className={cn(
  "flex items-center gap-4",
  isMobile && "flex-col text-center"
)}
```

---

## Files Summary

### Files to Modify (3)

| File | Changes |
|------|---------|
| `src/components/home/HomeScreen.tsx` | Complete rewrite with card-based layout |
| `src/pages/Index.tsx` | Update onNavigateToTab handler (lines 541-547) |
| `tailwind.config.ts` | Add badge-pulse animation |

### Files Unchanged (5)

| File | Reason |
|------|--------|
| `HomeDataModal.tsx` | Keep for potential future use |
| `HomeModalContents.tsx` | Stat display components still valuable |
| `ClockWidget.tsx` | Imported and used in new header |
| `InstallBanner.tsx` | Keep at top of layout |
| `AssassinZone.tsx` | Keep in codebase (not deleted) |

---

## Implementation Order

### Step 1: Tailwind Animation
1. Add `badge-pulse` keyframe and animation to `tailwind.config.ts`

### Step 2: Index.tsx Handler Update
2. Update `onNavigateToTab` handler to support all tabs (lines 541-547)

### Step 3: Complete HomeScreen Rewrite
3. Create new HomeScreen.tsx with:
   - Import existing components (ClockWidget, InstallBanner, useEquipmentStats)
   - Import types and utilities (Character, getAbilityPointsForLevel, etc.)
   - Define navigation card configuration array
   - Implement haptic feedback helper
   - Implement badge calculation logic
   - Create responsive header with avatar, name, level, XP bar
   - Create quick stats row with HP/AC/Initiative
   - Create navigation grid with 9 cards
   - Create quick actions panel
   - Wire up all navigation handlers

---

## Technical Specifications

### Haptic Feedback Helper

```typescript
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};
```

### Navigation Card Component (inline)

```typescript
interface NavigationCardData {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

const navigationCards: NavigationCardData[] = [
  { id: 'skills', label: 'Skills', description: 'Proficiencies & checks', 
    icon: BookOpen, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'abilities', label: 'Abilities', description: 'Unlock & upgrade', 
    icon: Zap, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
  // ... 7 more cards
];
```

### XP Progress Calculation

Reuse existing pattern from HomeModalContents:
```typescript
const xpProgress = (currentXP / nextLevelXP) * 100;
```

---

## Accessibility

### Touch Targets
- All cards: 120px min-height (exceeds WCAG 48px)
- All buttons: 48px height minimum

### Keyboard Navigation
- All cards have `tabIndex={0}`
- Enter/Space triggers navigation
- Focus indicators visible

### Screen Readers
- Cards have descriptive `aria-label`
- Badge counts announced (e.g., "3 ability points available")

---

## Testing Checklist

### Touch Interactions
- [ ] All navigation cards meet 48px minimum touch target
- [ ] Haptic feedback triggers on card tap
- [ ] Double-tap zoom prevented on all interactive elements
- [ ] Active state visible on tap (scale-95)
- [ ] Smooth transitions between home and tabs

### Responsive Layout
- [ ] Mobile: 2-column card grid
- [ ] Tablet: 3-column card grid
- [ ] Desktop: 4-column card grid
- [ ] Character header adapts to screen size
- [ ] Quick stats display correctly at all breakpoints

### Navigation
- [ ] All 9 navigation cards navigate to correct tabs
- [ ] Notification badges display correctly
- [ ] Badge counts update dynamically (ability points, achievements)
- [ ] Short Rest and Long Rest buttons functional
- [ ] Level Up button appears when XP sufficient

### Visual Polish
- [ ] Cards scale on hover (desktop)
- [ ] Cards scale on active (mobile)
- [ ] Notification badges pulse
- [ ] XP progress bar displays correctly
- [ ] Color coding matches feature themes
- [ ] ClockWidget displays in header
