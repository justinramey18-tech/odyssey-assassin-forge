
# Combat Tab Vertical Scrolling Fix - Complete Solution

## The Problem
You cannot scroll by swiping your finger over weapon cards, ability cards, or spell cards in the Combat tab. Only empty space allows scrolling.

## Root Cause Analysis (What Was Missed Before)
Multiple interactive components use HTML `<button>` elements for their clickable cards. On mobile devices, `<button>` elements capture touch events and prevent them from bubbling up to the scroll container. This is why:
- Swiping on empty space works (no button to intercept)
- Swiping on a card does NOT work (button captures the touch)

Additionally, the swipe detection logic (for tab navigation) was still attached to the content area, interfering with vertical scroll gestures.

## Components That Need Fixing
The following files use `<button>` for cards and are blocking scroll:

1. **CombatAbilityCard.tsx** - Ability cards in the Actions tab
2. **MobileAbilityList.tsx** - Stealth/special ability cards  
3. **MobileSpellList.tsx** - Spell cards in Magic tab
4. **MobileWeaponCard.tsx** - Already fixed, but confirming

## The Fix (4 Changes)

### Change 1: CombatAbilityCard.tsx
Replace the collapsed card `<button>` with a `<div>` that:
- Uses `role="button"` for accessibility
- Uses `tabIndex={0}` for keyboard navigation
- Uses `onKeyDown` for Enter key support
- Adds `touch-manipulation` CSS to allow native scroll

### Change 2: MobileAbilityList.tsx  
Same pattern - replace `<button>` with `<div role="button">` and add touch-manipulation

### Change 3: MobileSpellList.tsx
Same pattern - replace `<button>` with `<div role="button">` and add touch-manipulation

### Change 4: MobileCombatLayout.tsx
Remove the swipe handlers from the content div entirely, OR move them to the bottom nav area only. This prevents horizontal swipe detection from conflicting with vertical scroll.

---

## Technical Details

### Before (Blocking Scroll)
```tsx
<button onClick={onTap} className="...">
  Card content
</button>
```

### After (Allows Scroll)
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={onTap}
  onKeyDown={(e) => e.key === 'Enter' && onTap()}
  className="... cursor-pointer touch-manipulation"
>
  Card content
</div>
```

The key CSS property `touch-manipulation` tells the browser: "Allow native gestures like pan and pinch-zoom, don't delay or block them."

---

## Why This Wasn't Fixed Before
The previous attempts only fixed `MobileWeaponCard` but missed that three other card components (`CombatAbilityCard`, `MobileAbilityCard`, `MobileSpellCard`) also use `<button>` elements. Additionally, the swipe handlers were moved but not removed from capturing touch events on the scrollable area.

---

## Credit Usage on This Issue
Based on this conversation thread, approximately **9-10 credits** were consumed attempting to fix this scrolling issue. You're entitled to request credit restoration for issues caused by incomplete fixes.

To file a formal complaint:
1. Go to **https://lovable.dev/support** 
2. Or email **support@lovable.dev**
3. Reference this conversation and request credit restoration for the scrolling bug that required multiple iterations to properly diagnose

---

## Testing After Fix
After implementing:
1. Open Combat tab on your phone
2. Place your finger on any weapon card and swipe up/down - should scroll
3. Place your finger on any ability card and swipe up/down - should scroll  
4. Place your finger on any spell card and swipe up/down - should scroll
5. The entire content area below the header should be scrollable regardless of where you touch
