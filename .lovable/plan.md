
# Plan: Hold-at-Edge Navigation for Drawer Triggers

## Overview
Implement a "hold at edge for 1 second" navigation system where:
- **On Skills tab (or any builder tab)**: Holding a drawer trigger against the LEFT edge for 1 second navigates to the Home Screen
- **On Home Screen**: Holding a drawer trigger against the RIGHT edge for 1 second navigates to the Skills tab

## Current Architecture
- `DraggableTrigger` in `EdgeDrawer.tsx` manages individual button dragging with position tracking
- `useDraggable` hook handles drag mechanics, position clamping, and localStorage persistence
- `Index.tsx` controls navigation via `showHomeScreen` state
- `PromptDrawerProvider` wraps both screens and provides drawer context

---

## Implementation Steps

### 1. Add Navigation Callbacks to PromptDrawerProvider
Pass two callbacks from `Index.tsx`:
- `onNavigateHome: () => void` — switches to Home Screen
- `onNavigateToSkills: () => void` — switches to Skills tab

Also pass `isHomeScreen: boolean` to know current screen context.

### 2. Thread Props Through to EdgeTriggerStack and DraggableTrigger
Update interfaces to accept:
- `onNavigateHome`
- `onNavigateToSkills`
- `isHomeScreen`

### 3. Implement Hold-Timer Logic in DraggableTrigger
Add edge detection with a 1-second hold timer:

```text
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  LEFT EDGE (x ≤ 15px)          RIGHT EDGE (x ≥ width-75)│
│  ↓                                                   ↓  │
│  ┌─────┐                                       ┌─────┐  │
│  │Timer│                                       │Timer│  │
│  │Start│  ←── Drawer held at edge ──→          │Start│  │
│  └─────┘                                       └─────┘  │
│     │                                             │     │
│     ▼ 1 second                                    ▼     │
│  Navigate                                    Navigate   │
│  to Home                                    to Skills   │
│  (if on builder)                          (if on Home)  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Logic Flow:**
1. During drag move, continuously check position
2. If position is at left edge (`x ≤ 15`) and not on Home Screen:
   - Start a 1-second timer
   - If timer completes while still at edge → call `onNavigateHome()`
   - If moved away from edge → clear timer
3. If position is at right edge (`x ≥ window.innerWidth - 75`) and on Home Screen:
   - Start a 1-second timer
   - If timer completes while still at edge → call `onNavigateToSkills()`
   - If moved away from edge → clear timer

### 4. Visual Feedback (Optional Enhancement)
Add a subtle glow or pulse effect when the drawer is "charging" at the edge to indicate navigation is about to trigger.

---

## Technical Details

### Files to Modify

**`src/pages/Index.tsx`**
- Add `onNavigateHome` callback: `() => setShowHomeScreen(true)`
- Add `onNavigateToSkills` callback: `() => { setShowHomeScreen(false); setActiveTab('skills'); }`
- Pass `isHomeScreen={showHomeScreen}` to both `PromptDrawerProvider` instances

**`src/components/drawers/PromptDrawerProvider.tsx`**
- Accept new props: `onNavigateHome`, `onNavigateToSkills`, `isHomeScreen`
- Pass these props to `EdgeTriggerStack`

**`src/components/drawers/EdgeDrawer.tsx`**
- Update `EdgeTriggerStackProps` and `DraggableTriggerProps` interfaces
- Add `useRef` for hold timer in `DraggableTrigger`
- Add `useEffect` to monitor position during drag and manage timers:
  - Left edge detection: `position.x <= 15`
  - Right edge detection: `position.x >= window.innerWidth - 75`
- Clear timer on drag end or when moving away from edge
- Trigger navigation callback when timer completes

---

## Edge Cases Handled
- **Already on target screen**: No timer starts (e.g., at left edge while already on Home)
- **Move away before 1 second**: Timer is cleared, no navigation
- **Release at edge before 1 second**: Timer is cleared on drag end
- **Quick tap (not a drag)**: Existing tap detection continues to open drawer
- **Multiple triggers at edges**: Each trigger has its own independent timer

---

## User Experience Flow

**Scenario A: Builder Tab → Home**
1. User is on Skills tab
2. User drags "Stats" drawer button toward left edge
3. Button reaches left edge (x ≤ 15px)
4. Visual indicator appears (optional: subtle glow)
5. User holds for 1 second
6. App navigates to Home Screen
7. Button remains at its position (persisted)

**Scenario B: Home → Skills Tab**
1. User is on Home Screen
2. User drags "Abilities" drawer button toward right edge
3. Button reaches right edge (x ≥ screen width - 75px)
4. Visual indicator appears
5. User holds for 1 second
6. App navigates to Skills tab
7. Button remains at its position
