
# Combat Tab UX Overhaul - Mobile-First Design

## What We're Building

A complete refresh of the Combat tab that makes it easier to manage your turn during combat. The key improvements focus on making everything visible at a glance, reducing the number of taps needed, and ensuring nothing gets hidden or cut off on smaller screens.

---

## The 6 Major Improvements

### 1. Floating Turn Tracker (Always Visible)
**What it does:** A small, persistent bar that floats just above the bottom navigation showing your Action, Bonus Action, Reaction, and Movement status at all times - no matter which tab you're viewing.

**Why it helps:** Currently, you can only see your action economy when viewing a specific header area. This means constantly scrolling or switching tabs to check what you have left.

**User Experience:**
- Small pill-shaped indicators: ⚔️ ✓ | ⚡ ✓ | 🛡️ ✓ | 🦶 20/30
- Tapping any indicator opens a quick toggle sheet
- Fades slightly when scrolling, brightens when you stop
- Color-coded: Green = available, Gray = used

---

### 2. End Turn Button with AI Summary
**What it does:** A prominent "END TURN" button that appears once you've used at least one action. Tapping it:
- Resets your action economy for the next round
- Advances the round counter
- Optionally triggers AI synthesis of what you did

**Why it helps:** Currently there's no clear way to "finish" your turn. The reset button exists but doesn't feel like a natural end-of-turn action.

**User Experience:**
- Appears as a glowing button in the floating tracker when actions are used
- Long-press option: "End & Synthesize" to generate AI narrative
- Haptic feedback on tap
- Brief celebration animation on round advancement

---

### 3. Quick Situation Chips (Always Visible)
**What it does:** The three most important combat toggles - Hidden, Advantage, and Near Enemy - are promoted to always-visible chips in a thin bar below the top header.

**Why it helps:** Currently these are buried inside a collapsible "Situation Strip" that most users keep collapsed. But these three toggles directly affect damage output (Sneak Attack eligibility).

**User Experience:**
- Three tappable chips: `🌑 Hidden` `⬆️ Advantage` `👥 Near Ally`
- Active chips glow green, inactive are dimmed
- Single tap to toggle
- Swipe down on chip area reveals full Situation Strip

---

### 4. Consolidated Tab Navigation (7 → 5 Tabs)
**What it does:** Combine related tabs to reduce cognitive load:
- ATK + HIDE → **COMBAT** (attacks and stealth together)
- SKILL + REACT → **ACTIONS** (all abilities in one place)
- MAGIC stays as **MAGIC**
- ITEMS stays as **ITEMS**
- LOG stays as **LOG**

**Why it helps:** 7 tabs is overwhelming on mobile. Users often don't know which tab has what they need. Grouping related actions reduces confusion.

**User Experience:**
- Wider touch targets (5 buttons instead of 7)
- Sub-category pills within combined tabs (e.g., "Attacks | Stealth" toggle within COMBAT)
- Swipe still works between main tabs
- Badge counts combine (e.g., "COMBAT" shows total weapons + stealth abilities)

---

### 5. Smart Turn Guidance (Optional AI Helper)
**What it does:** A small "💡" indicator that suggests your best next action based on:
- What actions you have remaining
- What abilities are off cooldown
- Current tactical situation (hidden, advantage, etc.)

**Why it helps:** New players often don't know what to do with their bonus action or forget they have reactions available.

**User Experience:**
- Subtle pulsing indicator when a suggestion is available
- Tapping shows: "Suggestion: Use Cunning Action to Hide (Bonus Action)"
- Can be disabled in settings
- Non-intrusive - just a hint, not automation

---

### 6. Overflow Guards & Mobile Safety
**What it does:** Technical improvements to ensure nothing gets cut off or hidden:
- All content areas have proper safe-area padding (notches, home indicators)
- Scrollable areas have visible scroll indicators
- Long text truncates with "..." and expand option
- Bottom navigation never overlaps content
- Action Economy bar is always reachable

**Why it helps:** Currently, on smaller phones or with notches, some UI elements can get hidden behind system UI or overlap each other.

**Technical Details:**
- Add `pb-safe` (safe-area-inset-bottom) to all scrollable content
- Add `scroll-padding-bottom` to account for floating elements
- Implement `max-h-[calc(100vh-TopBar-BottomNav-FloatingTracker)]` constraints
- Add `overscroll-contain` to prevent scroll chaining
- Ensure minimum touch targets of 44px

---

## Visual Layout (Mobile)

```text
┌─────────────────────────────────┐
│  ☰  R3 Your Turn  ↻  ⚙️        │ ← Top Bar (fixed)
├─────────────────────────────────┤
│  ❤️ 45/67  🛡️ 18  ⚔️ +9        │ ← Stats Row
├─────────────────────────────────┤
│  🌑 Hidden   ⬆️ Adv   👥 Ally  │ ← Quick Situation Chips (NEW)
├─────────────────────────────────┤
│                                 │
│        [ Scrollable             │
│          Tab Content ]          │ ← Main content area
│                                 │
│                                 │
├─────────────────────────────────┤
│ ⚔️✓  ⚡✓  🛡️○  🦶15  [END TURN]│ ← Floating Turn Tracker (NEW)
├─────────────────────────────────┤
│ COMBAT  ACTIONS  MAGIC  ITEMS  │ ← Bottom Nav (5 tabs)
└─────────────────────────────────┘
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `FloatingTurnTracker.tsx` | Persistent action economy overlay |
| `QuickSituationChips.tsx` | Always-visible situation toggles |
| `EndTurnButton.tsx` | Turn finalization with optional AI synthesis |
| `TurnGuidanceHint.tsx` | Smart suggestion indicator |

## Files to Modify

| File | Changes |
|------|---------|
| `MobileCombatLayout.tsx` | Integrate new components, adjust scroll constraints |
| `CombatBottomNav.tsx` | Reduce to 5 tabs, update tab definitions |
| `CombatTopBar.tsx` | Streamline, remove redundant elements |
| `ActionEconomyBar.tsx` | Refactor into FloatingTurnTracker |
| `SituationStrip.tsx` | Extract quick chips, make strip expandable-only |
| `MobileCombatStyles.css` | Add overflow guards, safe-area utilities |

---

## Implementation Phases

### Phase 1: Overflow Guards & Safety (Foundation)
- Add safe-area padding to all containers
- Implement scroll constraints with proper calculations
- Add `overscroll-contain` to content areas
- Ensure 44px minimum touch targets
- Fix any current clipping issues

### Phase 2: Floating Turn Tracker
- Create the floating component
- Position above bottom nav with proper z-index
- Implement tap-to-toggle quick actions
- Add End Turn button with animations
- Wire up round advancement logic

### Phase 3: Quick Situation Chips
- Extract top 3 toggles from SituationStrip
- Create always-visible chip bar
- Implement swipe-to-expand for full strip
- Update visual styling for better visibility

### Phase 4: Tab Consolidation
- Merge ATK+HIDE into COMBAT with sub-pills
- Merge SKILL+REACT into ACTIONS with sub-pills
- Update tab array and navigation logic
- Adjust badge count calculations
- Test swipe navigation between 5 tabs

### Phase 5: Smart Turn Guidance
- Create suggestion engine (pure logic, no AI needed)
- Add hint indicator to floating tracker
- Implement suggestion sheet
- Add settings toggle to disable

---

## Accessibility & Performance

- All interactive elements: minimum 44x44px touch targets
- Color-coded elements also have icons/shapes for colorblind users
- Reduced motion mode respects prefers-reduced-motion
- Lazy-load tab content for faster initial render
- Haptic feedback uses existing `triggerHaptic` utility

---

## What Success Looks Like

After implementation, a typical combat turn will feel like:
1. Glance at Quick Chips → tap to toggle Hidden ✓
2. Tap COMBAT → pick weapon → roll attack ✓
3. See floating tracker update → Action used ✓
4. Tap ACTIONS → use Cunning Action (bonus) ✓
5. Floating tracker shows 1 action left → tap END TURN ✓
6. Round advances, everything resets, ready for next turn ✓

Total taps reduced from ~12 to ~6 for a typical two-action turn.
