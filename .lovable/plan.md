

# Combat Tab: Continuous Vertical Scroll Redesign

## What This Changes

Right now, the Combat screen works like separate "pages" -- tapping a tab (Combat, Actions, Magic, Items, Log) swipes away the current content and replaces it with a different set of content. You can only see one tab's content at a time.

**After this change**, all five sections will be stacked on top of each other in one long scrollable page. You scroll down through Combat content, then Actions content appears below that, then Magic, then Items, then Log at the very bottom. Tapping a tab in the bottom navigation bar will instantly jump you to that section instead of switching pages.

## How It Will Feel

- Open the Combat tab and you start at the top (Combat section with weapons, stealth abilities, etc.)
- Scroll down naturally and you flow into Actions, then Magic, then Items, then Log
- The bottom nav bar stays fixed at the bottom of the screen
- Tapping any tab label (e.g., "MAGIC") smoothly scrolls you up or down to that section's header
- Each section has a clear visual header/divider so you know where one ends and the next begins
- You cannot scroll past the bottom of the Log section (it's the end of the page)

## What Gets Removed

- The swipe-left/swipe-right gesture to switch between tabs (no longer needed since everything is on one page)
- The slide animation when switching tabs
- The tab-switching logic that hides/shows content

## What Stays the Same

- The bottom navigation bar appearance and icons (Combat, Actions, Magic, Items, Log)
- The top bar with HP, AC, round info
- All the shared header elements (Situation Strip, Dice Roller, Target Tracker, Initiative Tracker, Action Economy Bar, Turn Wizard)
- All the actual content inside each section (weapon cards, ability cards, spell list, items grid, combat log)
- The floating action button, dice modal, and smart prompt sheet

---

## Technical Details

### File: `src/components/combat/mobile/MobileCombatLayout.tsx`

**1. Remove swipe navigation**
- Remove the `useSwipe` hook call and related state (`slideDirection`, `swipeOffset`, `swiping`)
- Remove the swipe handler callbacks (`handleSwipeLeft`, `handleSwipeRight`)
- Remove the `TAB_ORDER` constant (no longer needed for swipe indexing)

**2. Replace `renderTabContent()` with `renderAllSections()`**
- Instead of a switch/case that shows one tab, render all five sections stacked vertically
- Each section gets a `ref` (using `useRef`) and an `id` attribute so we can scroll to it
- Each section gets a visible header label (e.g., "COMBAT", "ACTIONS", "MAGIC", "ITEMS", "LOG") styled as a divider

**3. Add section refs and scroll-to behavior**
- Create refs: `combatRef`, `actionsRef`, `spellsRef`, `itemsRef`, `logRef`
- Create a `scrollContainerRef` for the main scrollable area
- When a bottom nav tab is tapped, call `sectionRef.current.scrollIntoView({ behavior: 'smooth' })` to jump to that section
- Keep `activeTab` state to highlight the currently selected tab in the bottom nav

**4. Update the bottom nav `onTabChange` handler**
- Instead of `setActiveTab(tab)` switching content, it now sets the active tab AND triggers `scrollIntoView` on the corresponding ref

**5. Update the main content JSX**
- Replace the swipe wrapper `<div {...swipeHandlers}>` with a simple scrollable container
- Inside it, render all sections sequentially with section headers between them
- The last section (Log) gets no extra bottom padding beyond what's needed to clear the bottom nav

### File: `src/components/combat/mobile/CombatBottomNav.tsx`
- No structural changes needed -- it already accepts `activeTab` and `onTabChange` props
- The behavior change is entirely in how `MobileCombatLayout` responds to `onTabChange`

### Section Header Style
Each section will have a small sticky-ish label like:
```
--- ACTIONS -------
```
Styled with the existing font-mono, color-coded to match the tab icon colors (red for Combat, amber for Actions, indigo for Magic, green for Items, primary for Log), with a subtle top border to visually separate sections.

### Scroll Position Tracking (Optional Enhancement)
To auto-highlight the correct tab as the user scrolls naturally (not just when tapping), an `IntersectionObserver` can watch each section header. When a section enters the viewport, the bottom nav updates to highlight that tab. This keeps the nav bar accurate without the user needing to tap it.

