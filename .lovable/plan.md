

# Fix: Sync Arcana Tab with Quick Actions for All Magic Classes

## The Problem

The Quick Actions drawer is permanently connected to the **Rogue magic system** (`useSpellcasting`), regardless of which class you've chosen. When you pick Warlock, Wizard, Cleric, or any other full caster, the Arcana tab uses a completely separate system (`useClassSpellcasting`), but Quick Actions never reads from it. This causes:

- Spells you learn/prepare/favorite in Arcana don't show up in Quick Actions
- The Add/Remove buttons in Quick Actions write to the wrong system (Rogue), so changes don't persist
- Pact slots, sorcery points, and other class-specific resources don't display correctly
- Everything appears empty or broken for non-Rogue classes

## The Root Cause

In the main app file (`Index.tsx`), there's already a smart adapter called `combatSpellcasting` that automatically picks the right system:
- For Rogues, it uses the Rogue magic hook
- For all other classes, it adapts the class-based hook

The Combat tab already uses this adapter correctly. But the Quick Actions drawer (via `PromptDrawerProvider`) was never updated -- it still always gets the Rogue hook hardcoded.

## The Fix

A simple, low-risk 2-line change in `Index.tsx`: replace `spellcasting={spellcasting}` with `spellcasting={combatSpellcasting}` in both places where `PromptDrawerProvider` is rendered (mobile layout around line 1628 and desktop layout around line 1738).

This reuses the same adapter the Combat tab already depends on, so there's zero new code to write -- just correcting the wiring.

## What This Fixes

- Learn/prepare/favorite a spell in Arcana as any class, and it immediately appears in Quick Actions
- Add/Remove buttons in Quick Actions correctly modify the active spellcasting system
- Warlock pact slots render properly in the slot summary bar
- Sorcerer, Cleric, Druid, Bard, Wizard spells all sync correctly
- Homebrew spells (which are learned via `classSpellcasting.learnSpell`) now show up in Quick Actions

## Technical Details

**File:** `src/pages/Index.tsx`

**Change 1 (mobile layout, ~line 1628):**
- Before: `spellcasting={spellcasting}`
- After: `spellcasting={combatSpellcasting}`

**Change 2 (desktop layout, ~line 1738):**
- Before: `spellcasting={spellcasting}`
- After: `spellcasting={combatSpellcasting}`

No new files, no new dependencies, no interface changes. The `combatSpellcasting` variable already conforms to the same `UseSpellcastingReturn` type that `PromptDrawerProvider` expects.

