
# Move Tree Header to Bottom & Auto-Scroll to Foundation

## Problem
1. The tree header ("Hunter | Ranged & Awareness") is currently at the **top** of each tree column
2. With the inverted tree layout (Foundation at bottom, Ultimate at top), users should see the Foundation nodes first
3. The default scroll position shows the top of the tree (Ultimate abilities) instead of the bottom (Foundation abilities)

## Solution
1. Move the tree header to render **below** the ability nodes container (at the bottom of the column)
2. Add a `useEffect` to auto-scroll to the bottom of the ScrollArea when the component mounts or the tree changes
3. Add an extra "Foundation" tier separator below Tier 1 nodes for visual consistency

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/abilities/TreeColumn.tsx` | MODIFY | Move header to bottom of component |
| `src/components/abilities/AbilitiesScreen.tsx` | MODIFY | Add scrollRef and auto-scroll to bottom on mount/tree change |
| `src/lib/abilityTrees/layout.ts` | MODIFY | Add Foundation separator position helper |

---

## Detailed Changes

### 1. `src/components/abilities/TreeColumn.tsx`

**Move the Tree Header from top to bottom:**

Current structure:
```
<div> (container)
  <div> (Tree Header - TOP) ← MOVE THIS
  <div> (Ability Tree Container)
</div>
```

New structure:
```
<div> (container)
  <div> (Ability Tree Container)
  <div> (Tree Header - BOTTOM) ← MOVED HERE
</div>
```

**Changes:**
- Move the header `div` (lines 81-106) to after the ability tree container (after line 178)
- Change header styling from `border-b` to `border-t` (top border instead of bottom)
- Reverse the gradient direction from `from-X/20 via-transparent to-transparent` to flow upward

### 2. `src/components/abilities/AbilitiesScreen.tsx`

**Add auto-scroll to bottom functionality:**

```typescript
// Add ref for ScrollArea
const scrollRef = useRef<HTMLDivElement>(null);

// Add useEffect to scroll to bottom on mount and tree change
useEffect(() => {
  // Small delay to ensure content is rendered
  const timer = setTimeout(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, 50);
  return () => clearTimeout(timer);
}, [selectedTree]); // Re-scroll when tree changes
```

**For mobile (line 167):**
```typescript
<ScrollArea ref={scrollRef} className="h-full">
```

**For desktop (line 185):**
```typescript
// Create individual refs for each tree
const hunterScrollRef = useRef<HTMLDivElement>(null);
const warriorScrollRef = useRef<HTMLDivElement>(null);
const assassinScrollRef = useRef<HTMLDivElement>(null);

// Scroll all three on mount
useEffect(() => {
  const timer = setTimeout(() => {
    [hunterScrollRef, warriorScrollRef, assassinScrollRef].forEach(ref => {
      if (ref.current) {
        const viewport = ref.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }
    });
  }, 50);
  return () => clearTimeout(timer);
}, []);
```

### 3. `src/lib/abilityTrees/layout.ts`

**Add Foundation separator (optional, for visual consistency):**

Update `TIER_LABELS` to include a "Foundation" label that appears below Tier 1:
```typescript
// Already exists, but add position helper for Foundation separator BELOW tier 1
export function getFoundationSeparatorY(isMobile: boolean): number {
  const tierSpacing = isMobile ? 100 : 120;
  const padding = isMobile ? 40 : 60;
  const nodeSize = isMobile ? 64 : 80;
  
  // Position below tier 1 (which is now at the bottom due to inversion)
  // Tier 1 has invertedTier = 5, so y = 4 * tierSpacing + padding + nodeSize/2
  // Foundation separator goes below that
  return 5 * tierSpacing + padding + nodeSize / 2 + 30; // 30px below tier 1
}
```

---

## Visual Result

### Before (Current)
```
┌──────────────────────────────┐
│ HUNTER | Ranged & Awareness  │ ← Header at TOP
├──────────────────────────────┤
│ 🌧️ Rain of Destruction       │ ← User sees Ultimate first
│    (locked)                  │
│ ── ULTIMATE ──────────────── │
│         ...                  │
│    (must scroll down)        │
│ 🏹 Archery    👁️ Predator    │ ← Foundation at BOTTOM
│    Master       Shot         │
└──────────────────────────────┘
```

### After (New)
```
┌──────────────────────────────┐
│    (scroll up to see more)   │
│ 🌧️ Rain of Destruction       │
│ ── ULTIMATE ──────────────── │
│         ...                  │
│ 🏹 Archery    👁️ Predator    │ ← User sees Foundation first
│    Master       Shot         │
│ ── FOUNDATION ─────────────  │
├──────────────────────────────┤
│ HUNTER | Ranged & Awareness  │ ← Header at BOTTOM (visible with Foundation)
└──────────────────────────────┘
```

---

## Technical Notes

1. **ScrollArea Auto-Scroll**: The Radix ScrollArea component uses a viewport element with `data-radix-scroll-area-viewport` attribute. We query for this to set `scrollTop = scrollHeight`.

2. **Timing**: A small `setTimeout(50ms)` ensures the content has rendered before scrolling.

3. **Tree Change on Mobile**: When user swipes between trees, the scroll should also reset to bottom for the new tree.

4. **Header Styling Adjustments**:
   - Change `border-b` → `border-t` 
   - Gradient should fade upward into the tree
   - Keep same content structure (icon, name, subtitle, points)

---

## Testing Checklist

- [ ] On mobile: View defaults to bottom of tree (Foundation nodes visible)
- [ ] On mobile: Swiping between trees resets scroll to bottom
- [ ] On desktop: All three trees scroll to bottom on load
- [ ] Tree header appears below Foundation nodes
- [ ] Header styling looks correct with top border
- [ ] Foundation tier separator label is visible below tier 1 nodes
- [ ] Scroll up reveals Ultimate abilities at top
