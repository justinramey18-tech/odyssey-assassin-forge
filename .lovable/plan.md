

# Unified Inventory Tab with Internal Sub-Tabs

## Overview

Consolidate the 4 separate navigation tabs (Consumables, Shop, Loot, Gear) into a single **"Inventory"** navigation tab that uses internal sub-tabs to switch between sections. This frees up navigation bar space and gives users one place to manage all their items.

## Current Structure
- Navigation bar `INVENTORY_TABS`: consumables, shop, loot, gear, stars, feats
- Each renders its own full-screen component in `Index.tsx`

## New Structure
- Navigation bar `INVENTORY_TABS`: **inventory**, stars, feats
- The `inventory` tab renders a new `UnifiedInventoryScreen` with **4 internal tabs**: Gear, Consumables, Loot, Shop

## Changes

### 1. `src/components/navigation/types.ts`
- Replace the 4 separate entries (consumables, shop, loot, gear) with a single `{ id: 'inventory', label: 'Inventory', icon: Backpack }` entry
- Update `NavigableTab` type and `getTabToCategoryMapping` to map old tab names to `inventory`

### 2. `src/components/inventory/UnifiedInventoryScreen.tsx` (new)
- Container component with 4 internal pill-style tabs at the top: **Gear**, **Consumables**, **Loot**, **Shop**
- Each tab renders the existing component:
  - Gear tab: `<InventoryScreen />`
  - Consumables tab: `<ConsumablesInventoryWidget />` + `<AddConsumableDrawer />`
  - Loot tab: `<LootScreen />`
  - Shop tab: `<ShopScreen />`
- Accepts all props needed by sub-components, passes them through
- Stores active internal tab in local state (persisted to localStorage)
- Accepts an optional `initialTab` prop so external navigation (e.g. combat "go to consumables") can deep-link

### 3. `src/pages/Index.tsx`
- Remove 4 separate `activeTab === 'consumables'/'shop'/'loot'/'gear'` blocks (~lines 2981-3065)
- Replace with single `activeTab === 'inventory'` block rendering `<UnifiedInventoryScreen />`
- Pass all existing props (consumables, loot, shop, equipment, character, etc.)
- Update `handleNavigateToConsumables` to navigate to `inventory` tab with `initialTab='consumables'`
- Update `activeTab` type union to include `'inventory'` instead of the 4 separate ones

### 4. `src/hooks/use-category-navigation.ts`
- Change default `inventorySubTab` from `'consumables'` to `'inventory'`

### 5. Navigation references
- Update `getTabToCategoryMapping` to map legacy tab IDs (consumables, shop, loot, gear) to `{ category: 'inventory', subTab: 'inventory' }`
- Update any `navigateToSubTab('consumables'/'loot'/'gear'/'shop')` calls across the codebase to use `'inventory'`

### 6. Internal tab design
- Horizontal pill bar styled consistently with the app (dark bg, active pill highlighted)
- Icons: Shield (Gear), FlaskConical (Consumables), Package (Loot), Store (Shop)
- Badge counts on each pill (e.g. consumable count, loot count)
- Persist selected internal tab to localStorage key `odyssey-inventory-active-tab`

### 7. Deep-linking support
- `UnifiedInventoryScreen` accepts `activeInternalTab` + `onInternalTabChange` as controlled props
- `Index.tsx` manages this state so external navigation (combat items -> consumables) works
- The `handleNavigateToConsumables` callback sets both the nav tab to `'inventory'` and internal tab to `'consumables'`

