
# Universal Glassmorphism Audit & Refactor for Home Screen

## Overview

Perform a comprehensive audit and refactor of ALL UI elements on the Home Screen to ensure they adhere to the established glassmorphism design system. The guiding principle is "See-Through Everything" - no container should be fully opaque, allowing the T-pose background artwork to remain visible through the entire interface.

---

## Current State Analysis

After auditing the codebase, here's what needs attention:

| Component | Current State | Status |
|-----------|--------------|--------|
| Header Bar | Already using `Glass variant="header"` | Done |
| Footer Bar | Already using `Glass variant="header"` | Done |
| Stat Cards | Already using `Glass variant="default"` | Done |
| Navigation Cards | Already using `Glass variant="interactive"` | Done |
| Footer Buttons | Using custom `bg-white/10 border-glass` | Needs Refactor |
| Clock Widget | Using `bg-black/60 backdrop-blur-md` | Needs Refactor |
| Install Banner | Using `bg-gradient-to-r from-primary/90` | Needs Refactor |
| Floating Drawer Triggers | Using inline styles with `rgba(0,0,0,0.3)` | Needs Refactor |
| Drawer Panel (SheetContent) | Using `bg-background/95 backdrop-blur-xl` | Needs Refactor |
| Dialog/Modal Content | Using `bg-background` | Needs Refactor |
| HomeDataModal | Using `bg-black/95 backdrop-blur-xl` | Needs Refactor |
| Tooltip Content | Using `bg-popover` (solid) | Needs Refactor |
| Scroll Area Thumbs | Using `bg-border` (solid) | Needs Refactor |

---

## Phase 1: Core UI Component Refactors

### 1.1 Footer Action Buttons

**File**: `src/components/home/HomeScreen.tsx`

Convert the three footer buttons from custom Button styling to use the Glass component:

| Element | Current | New |
|---------|---------|-----|
| Short Rest Button | `Button variant="outline" + bg-white/10` | `Glass as="button" variant="interactive"` |
| Long Rest Button | `Button variant="outline" + bg-white/10` | `Glass as="button" variant="interactive"` |
| Level Up Button | `Button variant="default"` (solid) | `Glass as="button" variant="interactive"` with accent glow |
| Disabled Level Up | `div opacity-40` | Same structure with disabled Glass styling |

### 1.2 Clock Widget

**File**: `src/components/home/ClockWidget.tsx`

Replace custom inline styles with Glass component:

| Current | New |
|---------|-----|
| `bg-black/60 backdrop-blur-md border border-red-900/40` | `Glass variant="default" rounded="full"` |

### 1.3 Install Banner

**File**: `src/components/home/InstallBanner.tsx`

Replace gradient background with Glass styling:

| Current | New |
|---------|-----|
| `bg-gradient-to-r from-primary/90 to-primary/70 backdrop-blur-md` | `Glass variant="interactive"` with primary accent border |

---

## Phase 2: Floating Drawer System

### 2.1 Draggable Trigger Buttons

**File**: `src/components/drawers/EdgeDrawer.tsx`

Update the `DraggableTrigger` component to use Glass styling:

| Current | New |
|---------|-----|
| Inline `backgroundColor: 'rgba(0, 0, 0, 0.3)'` | Use Glass design tokens via Tailwind classes |
| Inline `borderColor`, `boxShadow` | Apply Glass component styling with accent color overlays |

Implementation approach:
- Add `bg-glass-subtle backdrop-blur-md border-glass shadow-glass-glow` base classes
- Maintain accent color highlights via CSS custom properties or overlay styles
- Keep the edge-detection glow animation as an enhancement on top

### 2.2 Drawer Panel (Sheet)

**File**: `src/components/drawers/EdgeDrawer.tsx`

Update the `SheetContent` styling in the EdgeDrawer:

| Current | New |
|---------|-----|
| `bg-background/95 backdrop-blur-xl` | `bg-glass backdrop-blur-xl border-glass` |
| Header with `background: linear-gradient(...)` | `bg-glass-subtle backdrop-blur-xl` |

---

## Phase 3: Modal & Overlay System

### 3.1 Base Dialog Component

**File**: `src/components/ui/dialog.tsx`

Update `DialogContent` default styles:

| Current | New |
|---------|-----|
| `bg-background` | `bg-glass backdrop-blur-xl border-glass shadow-glass-glow` |

The overlay (`DialogOverlay`) at `bg-black/80` is correct - it should remain as a solid dim layer without blur to create the "glass-on-dimmed-glass" effect.

### 3.2 Base Sheet Component

**File**: `src/components/ui/sheet.tsx`

Update `SheetContent` default styles:

| Current | New |
|---------|-----|
| `bg-background` | `bg-glass backdrop-blur-xl border-glass` |

The overlay at `bg-black/80` is correct and should remain unchanged.

### 3.3 HomeDataModal

**File**: `src/components/home/HomeDataModal.tsx`

Update to use Glass component:

| Current | New |
|---------|-----|
| `bg-black/95 backdrop-blur-xl` | `Glass variant="default"` with accent border |

---

## Phase 4: Tooltip & Micro-Components

### 4.1 Tooltip Content

**File**: `src/components/ui/tooltip.tsx`

Update `TooltipContent` to use glassmorphism:

| Current | New |
|---------|-----|
| `bg-popover` (solid) | `bg-glass-subtle backdrop-blur-md border-glass shadow-glass-glow` |
| `text-popover-foreground` | `text-white` for contrast |

### 4.2 Scroll Area

**File**: `src/components/ui/scroll-area.tsx`

Update scrollbar styling for glass aesthetic:

| Current | New |
|---------|-----|
| Thumb: `bg-border` | `bg-white/30 hover:bg-white/40` |
| Track: transparent | `bg-white/5` (very subtle) |

---

## Phase 5: Glass Component Enhancement

### 5.1 Add New Variant

**File**: `src/components/ui/glass.tsx`

Add a `subtle` variant for smaller elements like tooltips and badges:

```text
Variants to add:
- subtle: "bg-glass-subtle/80 backdrop-blur-sm shadow-glass-glow"
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/home/HomeScreen.tsx` | Convert footer buttons to Glass component |
| `src/components/home/ClockWidget.tsx` | Replace inline styles with Glass component |
| `src/components/home/InstallBanner.tsx` | Apply Glass styling to banner container |
| `src/components/home/HomeDataModal.tsx` | Use Glass component for modal body |
| `src/components/drawers/EdgeDrawer.tsx` | Update trigger and drawer panel to use Glass tokens |
| `src/components/ui/dialog.tsx` | Add Glass styling to DialogContent |
| `src/components/ui/sheet.tsx` | Add Glass styling to SheetContent |
| `src/components/ui/tooltip.tsx` | Apply glassmorphism to TooltipContent |
| `src/components/ui/scroll-area.tsx` | Update scrollbar colors for glass aesthetic |
| `src/components/ui/glass.tsx` | Add `subtle` variant for micro-components |

---

## Visual Consistency Matrix

After refactoring, every container on the Home Screen will use this consistent system:

| Element Type | Glass Variant | Blur Level | Opacity |
|--------------|---------------|------------|---------|
| Headers/Footers | `header` | `backdrop-blur-xl` | 50% |
| Static Cards | `default` | `backdrop-blur-md` | 40% |
| Interactive Cards/Buttons | `interactive` | `backdrop-blur-lg` | 50% (60% on hover) |
| Floating Triggers | `interactive` | `backdrop-blur-md` | 40% |
| Modals/Dialogs | `default` | `backdrop-blur-xl` | 50% |
| Drawers | `header` | `backdrop-blur-xl` | 50% |
| Tooltips | `subtle` (new) | `backdrop-blur-sm` | 40% |
| Scrollbar Thumb | N/A | N/A | `bg-white/30` |

---

## Acceptance Criteria Checklist

Upon completion, the following conditions will be verified:

- No opaque containers: Zero solid-colored container elements on the Home Screen
- Constant visibility: Background artwork visible (blurred) through every UI panel
- Universal consistency: Frosted glass aesthetic applied from header to tooltip
- Readability preserved: All text and icons at 100% opacity with text shadows for contrast
- Interactivity clear: All interactive elements use proper hover/focus states
- Design system compliance: All styles reference Glass component or design tokens

---

## Implementation Priority

1. Footer action buttons (HomeScreen.tsx)
2. Clock Widget (ClockWidget.tsx)
3. Floating drawer triggers (EdgeDrawer.tsx)
4. Install Banner (InstallBanner.tsx)
5. Drawer panel styling (EdgeDrawer.tsx)
6. Dialog base component (dialog.tsx)
7. Sheet base component (sheet.tsx)
8. HomeDataModal (HomeDataModal.tsx)
9. Tooltip component (tooltip.tsx)
10. Scroll area styling (scroll-area.tsx)
11. Glass component enhancement (glass.tsx)
