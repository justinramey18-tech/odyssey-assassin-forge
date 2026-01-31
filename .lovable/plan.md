

# Reorder Home Screen Navigation Cards

## What We're Doing

Rearranging the navigation buttons on your Home dashboard to match your preferred order.

---

## Current Order vs New Order

| Position | Currently | After Change |
|----------|-----------|--------------|
| 1 | Skills | **Drawers** |
| 2 | Abilities | **Combat** |
| 3 | Gear | **Items** |
| 4 | Feats | **Abilities** |
| 5 | Combat | **Gear** |
| 6 | Scribe | **Stars** |
| 7 | Items | **Feats** |
| 8 | Chronicle | **Skills** |
| 9 | Stars | **Chronicle** |
| 10 | Drawers (separate) | **Scribe** |

---

## How It Will Work

**File to edit:** `src/components/home/HomeScreen.tsx`

### Step 1: Add Drawers to the main navigation list
- Currently, Drawers is rendered as a special separate button after all other cards
- We'll add it as the **first item** in the cards list with a special marker so it opens the quick-access menu instead of navigating to a tab

### Step 2: Reorder the cards array
The list will be reorganized to:
```
1. Drawers (opens menu)
2. Combat (battle tracker)
3. Items/Consumables (potions & scrolls)
4. Abilities (unlock & upgrade)
5. Gear (equipment & inventory)
6. Stars (constellation view)
7. Feats (achievements & progress)
8. Skills (proficiencies & checks)
9. Chronicle (session log sync)
10. Scribe (AI narrative tools)
```

### Step 3: Update the rendering logic
- Check if a card is the "Drawers" type
- If yes → open the quick-access bottom sheet menu
- If no → navigate to that tab as usual

---

## What You'll See

When you open the Home Screen, the grid will show:
- **Top row**: Drawers, Combat
- **Second row**: Items, Abilities
- **Third row**: Gear, Stars
- **Fourth row**: Feats, Skills
- **Fifth row**: Chronicle, Scribe

This puts your most-used features (Drawers and Combat) front and center at the top.

