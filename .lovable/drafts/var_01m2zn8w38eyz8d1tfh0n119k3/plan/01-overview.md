# Weapon image cards in Quick Actions

## Goal
Replace the three plain weapon rows with fixed Primary, Secondary, and Ranged picture cards. Each card reads the currently equipped item and shows its live damage, attack bonus, ability bonuses, properties, rarity, action cost, and first enchantment.

## What will change
- Store the three supplied pictures as app assets and map each one to its matching weapon slot.
- Carry the existing equipped item details into Quick Actions without changing how equipment is saved.
- Always show the three cards in Primary → Secondary → Ranged order.
- Keep the current attack roll, action-cost spending, removal event, and roll preview unchanged.
- Empty slots remain visible as dimmed cards saying “Nothing equipped,” with no controls.
