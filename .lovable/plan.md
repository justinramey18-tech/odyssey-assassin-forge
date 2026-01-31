

# Stop Keyboard from Auto-Opening in Stats Drawer

## The Problem

When you open the **Stats** panel from the Drawers menu on your phone, the keyboard pops up automatically. This is annoying because you probably just want to look at your stats, not type anything right away.

## Why This Happens

The Stats panel uses a slide-out drawer component. When this drawer opens, it's designed to automatically focus on the first thing you can type into. Since there's an input box for "HP Amount" near the top of the Stats panel, your phone sees it get focused and helpfully opens the keyboard.

## The Fix

We'll tell the drawer "don't automatically focus on anything when you open" — this is a simple one-line addition.

---

## What We'll Change

**File:** `src/components/drawers/EdgeDrawer.tsx`

This file controls how all the side drawers (Stats, Scribe, Abilities, etc.) behave. We'll add a small instruction that says:

> "When this drawer opens, don't automatically jump to any input fields"

### The Change:

Add a simple setting to the drawer content that prevents auto-focus:

- **Before**: Drawer opens → automatically focuses first input → keyboard appears
- **After**: Drawer opens → nothing is focused → keyboard stays closed

You'll still be able to tap on any input field when you actually want to type — it just won't happen automatically.

---

## What You'll Notice

✅ Open Stats drawer → keyboard stays closed  
✅ Tap on the HP amount box → keyboard opens (when you want it)  
✅ All other drawers (Scribe, Abilities, etc.) will also benefit from this fix

