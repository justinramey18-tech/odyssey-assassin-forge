
# Fix: Chronicle Sync Shop Item Detection

## Problem Identified
The edge function **successfully detected all 5 shop items** (confirmed in logs: `shop: 5`), but they're not appearing in the shop because of two frontend bugs:

1. **`parseAIResponse()` ignores shop items** - The processor has `shopItems: []` with a TODO comment instead of parsing the `shop_items` array from the AI response
2. **`buildReviewableChanges()` skips gold and shop items** - The function only processes XP, achievements, items, and levelUp - not gold or shop categories

## Technical Changes

### 1. Update `src/lib/chronicleSync/processor.ts`

**Location:** Lines 329-352 in `parseAIResponse()` function

Add parsing for `shop_items` array from AI response:

```typescript
// Parse shop items (after achievements parsing)
const shopItems: ParsedShopItem[] = [];
if (Array.isArray(data.shop_items)) {
  for (const item of data.shop_items) {
    if (typeof item.name === 'string' && typeof item.cost_gold === 'number') {
      shopItems.push({
        name: item.name,
        itemType: item.item_type || 'miscellaneous',
        category: item.category,
        costGold: item.cost_gold,
        mechanics: item.mechanics || {},
        rarity: item.rarity || 'common',
        description: item.description || '',
        lore: item.lore || '',
        sourceText: String(item.source_text || '').slice(0, 100),
        confidence: validateConfidence(item.confidence),
      });
    }
  }
}
```

Then update the return statement to use the parsed `shopItems` instead of empty array.

**Required Import:** Add `ParsedShopItem` to the imports from `./types`

---

### 2. Update `src/components/chronicle/ChronicleSyncScreen.tsx`

**Location:** `buildReviewableChanges()` function (lines 79-136)

Add gold and shop item processing after the existing categories:

```typescript
// Gold changes
result.goldChanges.forEach((gold, i) => {
  const icon = gold.action === 'gained' ? '💰' : '💸';
  changes.push({
    id: `gold-${i}`,
    category: 'gold',
    description: `${icon} ${gold.action === 'gained' ? '+' : '-'}${gold.amount} GP`,
    confidence: 'high',
    sourceText: gold.sourceText,
    approved: true, // Auto-approve gold changes
    data: gold,
  });
});

// Shop items
result.shopItems.forEach((item, i) => {
  changes.push({
    id: `shop-${i}`,
    category: 'shop',
    description: `🏪 ${item.name} (${item.costGold} GP)`,
    confidence: item.confidence,
    sourceText: item.sourceText,
    approved: true, // Auto-approve shop items for discovery
    data: item,
  });
});
```

---

### 3. Update Summary Stats Display

**Location:** Lines 462-479 in `ChronicleSyncScreen.tsx`

Update the summary grid to show gold and shop item counts:

```typescript
<div className="grid grid-cols-5 gap-2 text-center">
  {/* Existing XP, Feats, Items, Level columns */}
  ...
  {/* Add Gold column */}
  <div className="bg-yellow-500/10 rounded-lg p-2 border border-yellow-500/20">
    <div className="text-lg font-bold text-yellow-400">
      {summary.totalGold.gained > 0 ? `+${summary.totalGold.gained}` : '-'}
    </div>
    <div className="text-xs text-muted-foreground">Gold</div>
  </div>
  {/* Add Shop column */}
  <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
    <div className="text-lg font-bold text-emerald-400">{parseResult.shopItems.length}</div>
    <div className="text-xs text-muted-foreground">Shop</div>
  </div>
</div>
```

---

### 4. Update `calculateChangeSummary()` in processor.ts

**Location:** Lines 376-419

Add shop item count to the summary return type and calculation:

```typescript
export function calculateChangeSummary(result: ChronicleParseResult): {
  // ...existing fields
  totalShopItems: number;  // NEW
} {
  // ...existing calculations
  const totalShopItems = result.shopItems.length;
  
  return {
    // ...existing fields
    totalShopItems,
  };
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/chronicleSync/processor.ts` | Parse `shop_items` in `parseAIResponse()`, add to imports, update summary |
| `src/components/chronicle/ChronicleSyncScreen.tsx` | Add gold/shop to `buildReviewableChanges()`, update summary display |

---

## Expected Result After Fix

When you parse the shop session log:

1. **Summary Stats** will show: `5 Shop` items detected
2. **Reviewable Changes** will list:
   - 🏪 Shadow Cloak (50 GP)
   - 🏪 Hidden Blade (75 GP)
   - 🏪 Eagle Vision Elixir (30 GP)
   - 🏪 Leap of Faith Boots (60 GP)
   - 🏪 Smoke Bomb Pouch (40 GP)
3. **After approval**, items appear in the Shop tab as purchasable cards
4. **Gold detection** also becomes visible for any gold gains/spending in logs

---

## Testing Criteria

1. Re-parse your test shop log with "Smart Parse" mode
2. Verify summary shows "5 Shop" items
3. Verify all 5 items appear in the reviewable changes list with 🏪 icon
4. Click "Apply Changes"
5. Navigate to Shop tab in Inventory
6. Confirm all 5 items appear as purchasable cards with names, mechanics, lore, and costs
