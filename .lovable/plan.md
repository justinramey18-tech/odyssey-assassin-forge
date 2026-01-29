

# BackgroundWrapper Implementation Plan

## Overview
Create a reusable `BackgroundWrapper` component and apply it consistently across all tabs (except Gear, which uses dynamic legendary set backgrounds). This will centralize background management while preserving each tab's unique overlay opacity settings.

---

## Phase 1: Create BackgroundWrapper Component

### File: `src/components/ui/BackgroundWrapper.tsx`

A reusable wrapper component with the following props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `imagePath` | `string` | required | Path to background image |
| `overlayOpacity` | `number` | 60 | Opacity 0-100 for dark overlay |
| `tintColor` | `string` | - | Optional accent tint (e.g., "red", "amber", "purple") |
| `tintOpacity` | `number` | 20 | Opacity for accent tint layer |
| `fixed` | `boolean` | true | Whether to use `bg-fixed` for parallax effect |
| `children` | `ReactNode` | required | Content to render on top |

### Component Structure

```text
+--------------------------------------------+
|  [Background Image Layer - fixed/absolute] |
|  +----------------------------------------+|
|  |     [Dark Overlay Layer]               ||
|  |  +------------------------------------+||
|  |  |   [Optional Tint Layer]            |||
|  |  | +--------------------------------+ |||
|  |  | |        Children (z-10)         | |||
|  |  | +--------------------------------+ |||
|  |  +------------------------------------+||
|  +----------------------------------------+|
+--------------------------------------------+
```

---

## Phase 2: Apply to Each Tab

### Combat Tab
- **File**: `src/components/combat/CombatTabScreen.tsx`
- **Action**: Remove inline background code, wrap content with `BackgroundWrapper`
- **Settings**: `overlayOpacity={70}`, `tintColor="red"`, `tintOpacity={30}`
- **Note**: Preserve all existing HUD elements, scan lines, corner brackets

### Skills Tab  
- **File**: `src/pages/Index.tsx` (TabsContent for "skills")
- **Action**: Replace inline background divs with `BackgroundWrapper`
- **Settings**: `overlayOpacity={65}`, `tintColor="purple"`, `tintOpacity={20}`

### Feats Tab
- **File**: `src/components/achievements/AchievementsScreen.tsx`
- **Action**: Remove inline background code, wrap with `BackgroundWrapper`
- **Settings**: `overlayOpacity={60}`, `tintColor="purple"`, `tintOpacity={15}`

### Stars Tab
- **File**: `src/components/constellation/ConstellationScreen.tsx`
- **Action**: Add new background layer (currently no static image)
- **Settings**: `overlayOpacity={40}` (lighter to see stars)
- **Requirement**: Need a `stars-background.jpg` image OR keep current animated starfield

### Scribe Tab
- **File**: `src/components/scribe/NarrativeForgeScreen.tsx`
- **Action**: Replace inline background code with `BackgroundWrapper`
- **Settings**: `overlayOpacity={75}`, `tintColor="amber"`, `tintOpacity={25}`

### Home Dashboard
- **File**: `src/components/home/HomeScreen.tsx`
- **Action**: Keep existing panoramic panning system (unique behavior)
- **Note**: HomeScreen uses a different interaction pattern with four-directional scrolling - a static `BackgroundWrapper` would break this functionality

---

## Phase 3: Asset Path Configuration

Since your assets are in `src/assets/` (imported as ES modules) rather than `public/backgrounds/`, the wrapper will use imported paths:

| Tab | Import Path | Current Status |
|-----|-------------|----------------|
| Combat | `@/assets/combat-background.jpg` | Exists |
| Skills | `@/assets/skills-background-new.jpg` | Exists |
| Feats | `@/assets/feats-background.jpg` | Exists |
| Scribe | `@/assets/scribe-background.jpg` | Exists |
| Stars | `@/assets/stars-background.jpg` | **Missing - needs creation** |
| Home | N/A (keeps existing panoramic) | Special case |

---

## Files to Create

1. `src/components/ui/BackgroundWrapper.tsx` - New reusable component

## Files to Modify

1. `src/components/combat/CombatTabScreen.tsx` - Wrap with BackgroundWrapper
2. `src/pages/Index.tsx` - Replace Skills tab inline background
3. `src/components/achievements/AchievementsScreen.tsx` - Wrap with BackgroundWrapper
4. `src/components/scribe/NarrativeForgeScreen.tsx` - Wrap with BackgroundWrapper
5. `src/components/constellation/ConstellationScreen.tsx` - Add optional background

---

## Decision Point: Stars Tab

The Stars/Constellation tab currently uses an animated starfield effect with 50 random pulsing particles. Two options:

**Option A - Keep Current Design (Recommended)**
- The animated particles create a cosmic "looking into space" atmosphere
- No static background needed
- Skip BackgroundWrapper for this tab

**Option B - Add Space Background**
- Upload a dark nebula/starfield image as `src/assets/stars-background.jpg`
- Apply BackgroundWrapper with 40% overlay
- Keep animated particles on top for depth

---

## Technical Details

### BackgroundWrapper Implementation

```tsx
interface BackgroundWrapperProps {
  imagePath: string;
  overlayOpacity?: number;
  tintColor?: 'red' | 'amber' | 'purple' | 'cyan' | 'green';
  tintOpacity?: number;
  fixed?: boolean;
  children: React.ReactNode;
  className?: string;
}
```

The component will:
1. Render background image with `bg-cover bg-center` and optional `bg-fixed`
2. Apply a gradient overlay: `from-background/${top} via-background/${mid} to-background/${bottom}`
3. Apply optional colored tint layer with directional gradient
4. Render children with `relative z-10` to ensure content visibility

### Gradient Formula
Based on current implementations, the overlay uses a 3-stop vertical gradient:
- Top: `overlayOpacity * 0.9` (darker at top)
- Middle: `overlayOpacity * 0.6` (lighter in middle for visibility)
- Bottom: `overlayOpacity * 0.95` (darkest at bottom)

