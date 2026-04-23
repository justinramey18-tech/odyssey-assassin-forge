
## Route "Gear & Inventory" to the full Inventory screen

### What you'll see after this prompt

In the Empyrean solo DM, tap **SHEET → Character → Gear & Inventory**. Instead of the small read-only quick-actions popup, the Character Sheet closes, the DM closes, and you land on the full **Inventory** screen with all its slots, generation, equip/swap, loot, shop, etc. Returning to the DM via "The Empyrean Awaits" preserves your campaign and chat. Every other row (Stats, Abilities, Cooldowns, Conditions, Set Bonuses, Signet placeholder) behaves exactly as before.

### What's being changed

**1. `src/components/empyrean/CharacterSheet.tsx`**
- Add an optional `onOpenInventory?: () => void` prop on `CharacterSheet` and forward it into `CharacterTab`.
- In `CharacterTab`, the **Gear & Inventory** row now: closes the Sheet, then calls `onOpenInventory` on the next tick when provided. If the prop is missing, it falls back to opening `QuickActionsDrawer` (current behavior) so the component stays safe in any other context.
- Tweak the row description to "Manage your equipped gear, generate new items, and browse inventory."
- Set Bonuses and every other row stay untouched.

**2. `src/components/empyrean/EmpyreanDMScreen.tsx`**
- Add an optional `onNavigateToTab?: (tab: NavigableTab) => void` prop (imported from `@/components/navigation/types`).
- Pass `onOpenInventory` into `<CharacterSheet>` only when `onNavigateToTab` is provided. The handler navigates to the `inventory` tab and closes the DM.

**3. `src/components/home/HomeScreen.tsx`**
- In the `<EmpyreanDMScreen>` render inside the solo branch of `EmpyreanDMContainer`, forward the existing `onNavigateToTab` prop. No other changes.

### What stays untouched

- `UnifiedInventoryScreen.tsx`, `Index.tsx`, `QuickActionsDrawer.tsx`.
- Party DM and standard AI DM screens (they don't render `CharacterSheet`).
- All other Character tab rows and the Settings / Talk tabs.
- The `onClose` "reason" pattern from the Reconfigure/New Campaign work — unchanged.

### Verification

- Tapping Gear & Inventory in the Sheet lands on the full Inventory tab.
- Set Bonuses still opens the Set Bonus drawer.
- Stats / Abilities / Cooldowns / Conditions still open their drawers.
- Returning to the DM preserves campaign and chat state.
- No TypeScript errors.
