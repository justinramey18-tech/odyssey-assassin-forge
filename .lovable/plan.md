
# Gear Selection Screen - Inline Layout Refactor

## Problem
Currently, when clicking on a gear slot card, an `InventoryDrawer` (bottom sheet drawer) opens covering the navigation header. The user wants this selection screen to appear **under the header tabs** with vertical scrolling, similar to how the Consumables tab works.

## Reference (Screenshot Analysis)
The screenshot shows the desired layout:
- Main header with character stats visible at top
- Navigation tabs visible: HOME | FIGHTING | GEAR ▼ | UTILITY
- Below tabs: "Select HEAD" title with slot icon
- Scrollable list of items with:
  - Rarity-colored left border (amber/gold for legendary)
  - Icon square with matching background
  - Item name in rarity color
  - Stats indicator (🛡️ +3)
  - Star rating (★★★)
  - Level indicator (Lv 20)

## Solution

Replace the drawer-based item selection with an **inline selection screen** that:
1. Renders in place of the EquipmentList when selecting items
2. Shows under the header tabs with vertical scrolling
3. Uses the same visual style as the reference (matching the consumables pattern)
4. Supports thumb swipe scrolling via native touch scroll

## Architecture Change

**Current Flow:**
```
InventoryScreen
  └── EquipmentList (always visible)
  └── InventoryDrawer (overlay when selecting)
```

**New Flow:**
```
InventoryScreen
  ├── [viewMode: 'equipment'] → EquipmentList
  └── [viewMode: 'selecting'] → ItemSelectionList (inline, replaces equipment list)
```

---

## Files to Modify/Create

### 1. `src/components/inventory/ItemSelectionScreen.tsx` (NEW FILE)
**Purpose**: Inline item selection screen that replaces the drawer

```typescript
// Key features:
- Header row with back button + "Select {SLOT}" title
- ScrollArea for vertical touch scrolling
- Item cards matching the reference screenshot design:
  - Rarity border on left
  - Icon with colored background
  - Item name + stats row
  - Stars + Level row
  - Lock overlay for locked items
- Empty state for no compatible items
```

**Structure:**
```typescript
interface ItemSelectionScreenProps {
  slotType: EquipmentSlotType;
  slotLabel: string;
  slotIcon: string;
  inventory: EquipmentItem[];
  onSelectItem: (item: EquipmentItem) => void;
  onBack: () => void;
  isItemLocked?: (item: EquipmentItem) => boolean;
  getItemLockInfo?: (item: EquipmentItem) => {...};
}

// Renders:
<div className="min-h-[calc(100vh-10vh)] flex flex-col">
  {/* Header Row */}
  <div className="flex items-center gap-3 px-4 py-4 border-b">
    <Button variant="ghost" onClick={onBack}>
      <ChevronLeft />
    </Button>
    <SlotIcon />
    <h1 className="font-cinzel text-xl uppercase">
      Select {slotLabel}
    </h1>
  </div>
  
  {/* Scrollable Item List */}
  <ScrollArea className="flex-1">
    <div className="p-4 space-y-3">
      {compatibleItems.map(item => (
        <ItemSelectionCard key={item.id} ... />
      ))}
    </div>
  </ScrollArea>
</div>
```

---

### 2. `src/components/inventory/ItemSelectionCard.tsx` (NEW FILE)
**Purpose**: Individual item card matching the reference design

**Visual design from screenshot:**
```
┌─────────────────────────────────────────┐
│ │   ┌────┐                              │
│ │   │ 🎭 │  MASK OF PERPETUAL COMMENTARY│
│ │   └────┘  🛡️ +3                       │
│ │           ★★★  Lv 20                  │
└─────────────────────────────────────────┘
  ↑ Rarity border (amber for legendary)
```

```typescript
// Key styling:
- border-l-4 with rarity color
- Touch target 48px+ height
- Rarity-tinted icon background
- Item name in rarity color (uppercase, Cinzel font)
- Stats + stars + level row
- Active press state (scale-95)
```

---

### 3. `src/components/inventory/InventoryScreen.tsx` (MODIFY)
**Changes needed:**

1. Add new state for view mode:
```typescript
const [viewMode, setViewMode] = useState<'equipment' | 'selecting'>('equipment');
```

2. Modify slot tap handlers to switch view mode instead of opening drawer:
```typescript
const handleSlotTap = useCallback((slotType: EquipmentSlotType) => {
  const item = equipment.slots[slotType];
  if (item) {
    // Show item detail for equipped items
    setSelectedSlot(slotType);
    setSelectedItem(item);
    setShowItemDetail(true);
  } else {
    // Switch to selection mode for empty slots
    setSelectedSlot(slotType);
    setViewMode('selecting');
  }
}, [equipment.slots]);

const handleSwap = useCallback((slotType: EquipmentSlotType) => {
  setSelectedSlot(slotType);
  setViewMode('selecting'); // Instead of setShowInventoryDrawer(true)
}, []);
```

3. Modify render to conditionally show selection screen:
```typescript
return (
  <div className="min-h-[calc(100vh-10vh)] relative flex flex-col">
    {/* Background layers... */}
    
    {viewMode === 'selecting' && selectedSlot ? (
      <ItemSelectionScreen
        slotType={selectedSlot}
        slotLabel={getSlotLabel(selectedSlot)}
        slotIcon={getSlotIcon(selectedSlot)}
        inventory={equipment.inventory}
        onSelectItem={handleEquipFromInventory}
        onBack={() => setViewMode('equipment')}
        isItemLocked={isItemLocked}
        getItemLockInfo={getItemLockInfo}
      />
    ) : (
      <>
        {/* Title Header Row */}
        {/* EquipmentList */}
        {/* Stats Footer */}
      </>
    )}
    
    {/* Sheets/Drawers (keep for item details) */}
  </div>
);
```

4. Update `handleEquipFromInventory` to return to equipment view:
```typescript
const handleEquipFromInventory = useCallback((item: EquipmentItem) => {
  // ... existing logic ...
  setViewMode('equipment'); // Return to equipment list
  setSelectedSlot(null);
}, [...]);
```

5. Remove or deprecate `showInventoryDrawer` state and `InventoryDrawer` usage

---

### 4. `src/components/inventory/index.ts` (MODIFY)
Add exports for new components:
```typescript
export * from './ItemSelectionScreen';
export * from './ItemSelectionCard';
```

---

## Technical Details

### Scroll Behavior
```typescript
// Use native overflow scrolling for smooth thumb swipes
<ScrollArea className="flex-1 touch-pan-y">
  <div className="p-4 space-y-3">
    {items.map(...)}
  </div>
</ScrollArea>
```

### Touch Targets (Mobile)
All item cards will have:
- Minimum height: 64px (well above 44px Apple HIG)
- Full-width tap area
- `active:scale-[0.98]` for press feedback

### Item Filtering
Same logic as current drawer - filter by slot type:
```typescript
const compatibleItems = inventory.filter(item => {
  if (slotType === 'ring1' || slotType === 'ring2') {
    return item.slotType === 'ring1' || item.slotType === 'ring2';
  }
  return item.slotType === slotType;
});
```

### Animation
```typescript
// Smooth transition between views
<AnimatePresence mode="wait">
  {viewMode === 'selecting' ? (
    <motion.div
      key="selecting"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <ItemSelectionScreen ... />
    </motion.div>
  ) : (
    <motion.div key="equipment" ...>
      {/* Equipment list */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## Visual Design Specifications

### Item Selection Card (from reference)
| Element | Style |
|---------|-------|
| Container | `rounded-lg border border-amber-900/30 bg-card/50` |
| Left border | `border-l-4` with rarity color |
| Icon container | `w-12 h-12 rounded-lg` with rarity bg tint |
| Item name | `font-cinzel text-sm uppercase tracking-wide` in rarity color |
| Stats | `text-xs text-muted-foreground` with emoji icons |
| Stars | Filled star icons in rarity color |
| Level | `text-xs text-muted-foreground` |
| Tap state | `active:scale-[0.98] active:bg-white/5` |

### Rarity Colors (matching existing)
- Common: `text-muted-foreground`
- Uncommon: `text-green-400`
- Rare: `text-blue-400`
- Epic: `text-purple-400`
- Legendary: `text-amber-400` (matches screenshot)
- Artifact: `text-orange-500`

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/inventory/ItemSelectionScreen.tsx` | **CREATE** | Inline selection screen component |
| `src/components/inventory/ItemSelectionCard.tsx` | **CREATE** | Individual item card component |
| `src/components/inventory/InventoryScreen.tsx` | **MODIFY** | Add view mode toggle, replace drawer with inline screen |
| `src/components/inventory/index.ts` | **MODIFY** | Export new components |

---

## Benefits

1. **Consistent UX**: All screens now display under the header tabs
2. **Better Navigation**: Users stay oriented with visible nav
3. **Touch Optimized**: Native vertical scrolling with momentum
4. **Visual Clarity**: Matches the Consumables pattern established in the app
5. **No Overlay Confusion**: Selection doesn't obscure the rest of the UI

---

## Testing Checklist

- [ ] Tap empty gear slot → Shows inline selection screen
- [ ] Tap equipped gear slot → Shows item detail sheet (unchanged)
- [ ] Swipe right on slot to swap → Shows inline selection screen
- [ ] Select item from list → Equips and returns to equipment view
- [ ] Back button → Returns to equipment view
- [ ] Locked items → Show lock overlay with progress
- [ ] Vertical scroll → Smooth thumb swipe scrolling
- [ ] Ring slots → Show both ring1 and ring2 items
- [ ] Empty inventory → Shows "No compatible items" message
