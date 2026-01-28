

# Odyssey Assassin Character Sheet Generator

A dark fantasy-themed D&D 5e character builder focused on the unique three-tree ability progression system.

---

## Overview

A guided wizard that walks users through creating an Assassin character with the Odyssey skill system, featuring the Hunter, Warrior, and Assassin ability trees with point allocation and tier upgrades.

---

## Design Theme

**Dark Fantasy Aesthetic**
- Deep, moody color palette with dark backgrounds and glowing accents
- Greek mythology influences (Artemis, Ares, Hermes iconography)
- Parchment/ancient scroll textures for card elements
- Glowing tier indicators (gold for maxed, silver for unlocked, dim for locked)
- Tree-specific accent colors: Hunter (forest green glow), Warrior (crimson glow), Assassin (purple shadow glow)

---

## Core Features

### 1. Character Creation Wizard
A step-by-step flow guiding the user through character creation:

**Step 1: Basic Info**
- Character name, level (1-20)
- Auto-calculates available ability points based on level

**Step 2: Ability Tree Allocation**
- The heart of the Odyssey system
- Visual point allocation across three trees
- Accordion panels for each tree (Hunter 🏹, Warrior ⚔️, Assassin 🗡️)
- Spend points to unlock abilities (Tier 1) or upgrade them (Tier 2-3)
- Clear display of points remaining vs. spent per tree

### 2. Ability Tree Interface
Each tree displayed as an expandable accordion panel showing:

**For each ability:**
- Name with icon and tier indicator (●●○ style)
- Brief effect description that updates based on current tier
- Upgrade button (shows cost, disabled if maxed or insufficient points)
- Visual distinction between Active vs Passive abilities
- Lock icon for unowned abilities

**Tree-specific styling:**
- Hunter: Green-tinted cards with bow/arrow iconography
- Warrior: Red-tinted cards with sword/shield iconography  
- Assassin: Purple-tinted cards with shadow/dagger iconography

### 3. Ability Detail Modal
Tap any ability to see full details:
- All three tier effects clearly listed
- Current tier highlighted, future tiers shown but dimmed
- Action type (Action, Bonus Action, Reaction, Passive)
- Usage limits (at-will, short rest, long rest)
- Synergies with other abilities noted

### 4. Point Summary Display
Persistent header/footer showing:
- Total points available for current level
- Points spent (broken down by tree)
- Unspent points remaining
- Visual progress bars for each tree

---

## User Flow

1. **Enter character name and select level** → Points auto-calculated
2. **Browse ability trees** → Expand accordions to explore abilities
3. **Spend points** → Click upgrade buttons to unlock/improve abilities
4. **View details** → Tap abilities for full effect descriptions
5. **Review build** → Summary shows final point allocation

---

## Data & Export

- **JSON Export**: Download character build as JSON file
- **JSON Import**: Load a previously exported character
- No account/backend required - all data handled client-side

---

## Future Expansion Hooks

After core ability system is solid, we can add:
- Character stats (ability scores, HP, AC)
- Equipped ability loadout slots
- Adrenaline & Divine Patron systems
- Combat quick reference
- Equipment & inventory tracking

