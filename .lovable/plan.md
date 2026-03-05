

## Plan: Flatten Dice Roller + Add Descriptions + Move Odds

**Single file change:** `src/components/ai-dm/DMDiceRoller.tsx`

### 1. Remove tab system
- Delete `Tab` type (line 12), `tab` state (line 149), `tabs` array (lines 219-223), tab selector UI (lines 366-384).
- Remove all `{tab === '...' &&` conditionals — render all sections inline.

### 2. New layout order (single scrollable view)
All sections render sequentially inside the existing `px-3 py-2 space-y-2` container:

1. **Roll mode toggle** (Normal / Advantage / Disadvantage) — unchanged
2. **D20 & Quick Rolls** — Roll d20 button, Initiative, ability score grid, quick dice row (existing d20 tab content, no header needed since it's at the top)
3. **Section header: `⚔ SKILL CHECKS`** → full skills grid (remove `max-h-[180px]` constraint), 2-col layout
4. **Section header: `🛡 SAVING THROWS`** → full saves grid, 2-col layout
5. **Section header: `🎰 DICE ODDS`** → odds selector always visible (remove toggle button + `showOddsPanel` state + AnimatePresence wrapper), render odds grid inline

### 3. Add descriptions to skills and saves

**Skills** — Add a small description map for all 18 skills. Each skill button gets a second line of gray helper text:

| Skill | Description |
|-------|------------|
| Acrobatics | Flips, balance, tumbling |
| Animal Handling | Calm or control a beast |
| Arcana | Recall magical lore |
| Athletics | Climb, jump, swim |
| Deception | Mislead with lies |
| History | Recall past events |
| Insight | Read someone's motives |
| Intimidation | Threaten or coerce |
| Investigation | Search for clues |
| Medicine | Stabilize or diagnose |
| Nature | Recall nature lore |
| Perception | Spot hidden things |
| Performance | Entertain an audience |
| Persuasion | Influence with charm |
| Religion | Recall divine lore |
| Sleight of Hand | Pick pockets, conceal |
| Stealth | Move unseen or unheard |
| Survival | Track, forage, navigate |

**Saves** — Each save button gets a helper line:

| Save | Description |
|------|------------|
| Strength | Resist being pushed or held |
| Dexterity | Dodge blasts and traps |
| Constitution | Endure poison or fatigue |
| Intelligence | See through illusions |
| Wisdom | Resist charms and fear |
| Charisma | Defy banishment effects |

### 4. Section header styling
```
text-[10px] font-mono uppercase tracking-wider text-white/40 border-b border-white/5 pb-1 mt-2
```

### 5. Skill/save button layout update
Each button becomes slightly taller to fit the description line. Description text: `text-[8px] text-white/30 truncate`.

