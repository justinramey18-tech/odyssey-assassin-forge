

# Party Trading System -- Full-Screen, Mobile-First

## Overview
Party members can send gear, consumables, loot, and gold to each other in real time. The sender loses the item and the receiver gains it. The entire trade UI is full-screen with native vertical scrolling, matching the existing full-screen pattern used by Homebrew Gear Creator and Stats Drawer.

## Architecture

Reuses the existing `party_actions` table and real-time subscription model (same pattern as healing). New action types: `send_gold`, `send_consumable`, `send_gear`, `send_loot`.

### Trade Flow

```text
Sender taps party member card -> "Send Item" option
  -> Full-screen SendItemScreen opens (fixed inset-0 z-50)
  -> Sender picks category tab (Gold / Consumables / Gear / Loot)
  -> Scrolls vertically through their items
  -> Taps "Send" on an item
  -> Item removed from sender's state immediately
  -> party_actions row inserted
  -> Realtime fires on receiver's client

Receiver sees IncomingTradeNotification (top banner, like heals):
  -> Accept: item added to receiver's state, row updated to 'accepted'
  -> Reject: row updated to 'rejected', sender gets item back via UPDATE subscription
```

## UI Design

### SendItemScreen (full-screen overlay)
- `fixed inset-0 z-50 bg-background flex flex-col` (same as HomebrewGearCreator)
- **Header**: Recipient name + avatar, close (X) button, font-cinzel title "Send to [Name]"
- **Category tabs**: Horizontal tab bar (Gold | Consumables | Gear | Loot)
- **Content area**: `flex-1 min-h-0 overflow-y-auto` with `pb-8` for bottom safe area
  - **Gold tab**: Simple input with current balance shown, "Send Gold" button
  - **Consumables tab**: List of owned consumables with name, quantity, type icon, "Send 1" button
  - **Gear tab**: List of unequipped inventory items with name, rarity, slot, "Send" button
  - **Loot tab**: List of loot items with name, rarity, "Send" button
- Empty states for categories with no items
- Dark Odyssey aesthetic, glassmorphism cards

### IncomingTradeNotification (top banner)
- Same fixed-top pattern as `IncomingHealNotification`
- Shows sender name, item icon/name, item type badge
- For gold: shows amount with coin icon
- Accept / Reject buttons

## Files

### New Files
1. **`src/components/party/SendItemScreen.tsx`** -- Full-screen item picker
   - Props: target member, gold balance, consumables inventory, gear inventory, loot items, callbacks for each send type, onClose
   - Category tabs with vertical scroll per category
   - Each item row has a "Send" button

2. **`src/components/party/IncomingTradeNotification.tsx`** -- Accept/reject trade banner
   - Props: pending trade data, onAccept, onReject
   - Renders as an `IncomingTradeOverlay` wrapper with AnimatePresence (same as heal)

### Modified Files

3. **`src/hooks/use-party-sync.ts`**
   - New state: `pendingTrades` array
   - New functions: `sendTradeAction(targetUserId, tradeType, tradeData)`, `acceptTrade(actionId)`, `rejectTrade(actionId)`
   - New ref: `onIncomingTrade` -- called when a trade is accepted so Index.tsx can add the item
   - New ref: `onTradeRejected` -- called when a trade is rejected so Index.tsx can return the item to sender
   - Extend INSERT subscription to detect `send_gold`, `send_consumable`, `send_gear`, `send_loot` action types
   - Extend UPDATE subscription to handle trade accept/reject notifications

4. **`src/pages/Index.tsx`**
   - Wire trade callbacks:
     - **Sender removal**: On send, call `shop.spendGold()`, `consumables.useItem()`, `setEquipment()` (remove from inventory array), or `loot.deleteLootItem()`
     - **Receiver addition**: Set `onIncomingTrade.current` handler that calls `shop.addGold()`, `consumables.addItem()`, `setEquipment()` (add to inventory array), or `loot.addLootItems()`
     - **Rejection return**: Set `onTradeRejected.current` handler that re-adds the item to sender's state
   - Pass trade-related props to PartyPanel
   - Render `IncomingTradeOverlay` component alongside `IncomingHealOverlay`

5. **`src/components/party/PartyPanel.tsx`**
   - Add state for `sendToMember` (selected target for trade)
   - When tapping a party member card (non-self), show option to open SendItemScreen
   - Render SendItemScreen when `sendToMember` is set

6. **`src/components/party/PartyMemberCard.tsx`**
   - Add an `onSendItem` callback prop
   - Add a small "Send" or gift icon button on non-self member cards

## Technical Details

### Trade Data Shape (stored in party_actions.action_data)
- `send_gold`: `{ amount: number }`
- `send_consumable`: `{ consumable: Consumable, quantity: 1 }` (full object for custom items)
- `send_gear`: `{ item: EquipmentItem }` (full object)
- `send_loot`: `{ item: LootItem }` (full object)

### Duplication Prevention
Items are removed from the sender's local state immediately upon send. If the receiver rejects, the UPDATE subscription handler returns the item to the sender's state.

### Edge Cases
- Sending gold with insufficient balance: validated client-side, Send button disabled
- Sending last consumable: quantity drops to 0, item removed from inventory
- Equipped gear cannot be sent (only unequipped inventory items)
- Rejected trade: item/gold returned to sender via realtime UPDATE handler + toast notification
- Custom/homebrew items: full object stored in action_data so receiver reconstructs correctly

