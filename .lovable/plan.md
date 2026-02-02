
# Complete Home Screen Redesign Plan
## Including Live Status Indicator Row

---

## Overview

This comprehensive plan transforms the Home Screen into a focused, dramatic interface with an Assassin's Creed aesthetic. It combines the original redesign elements (3D name plaque, dynamic health bar, enlarged D20, primary navigation cards) with the Live Status Indicator Row and additional UX enhancements.

---

## New Layout Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  [←]                                            [⚙️] [🕐]       │  Minimal utilities header
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│               ╔═════════════════════════════════╗               │
│               ║     CHARACTER NAME              ║               │  3D Plaque Header
│               ║        Lv. 12                   ║               │
│               ╚═════════════════════════════════╝               │
│                                                                 │
│  [🔴 3 Conditions]  [✅ 2 Ready]  [🔮 Conc]  [⏰ 2:31]          │  Live Status Row (NEW)
│                                                                 │
│  ████████████████████░░░░░░░░░░  78/100 HP (+5 Temp)            │  Dynamic Health Bar
│  ┌────────────────────────────────────────────────────────────┐ │
│  │   [Shield] AC: 18        [Zap] Init: +4                    │ │  Compact stat row
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ✨ 3 Points Available                     [Spend Now →]   │ │  Points Widget (conditional)
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                    ┌─────────────┐                              │
│                    │     🎲      │                              │  Enlarged D20 Dice
│                    │    (20)     │                              │
│                    │  Tap to Roll│                              │
│                    └─────────────┘                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │              │  │              │  │              │           │
│  │  QUICK       │  │  THE MAIN    │  │  🏆 CLAIM    │           │  Three Primary Cards
│  │  MENUS       │  │  HUD         │  │  REWARDS     │           │  (third is contextual)
│  │              │  │              │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [☕ Short Rest]   [🌙 Long Rest ●]   [📈 Level Up!]             │  Footer (Long Rest = hold)
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Character Name Plaque (3D Effect)

A metallic/stone plaque with beveled edges and embossed text.

**Styling approach:**
- Multiple layered `text-shadow` for embossed/engraved appearance
- Gradient background simulating metal/stone material  
- Border styling with inner shadow for beveled edge
- Cinzel font, uppercase, wide letter-spacing

**Content:**
- Character name (1.5rem, uppercase)
- Level badge integrated below name
- Optional decorative corner accents

---

### 2. Live Status Indicator Row

A horizontally scrollable row of compact, tappable badges showing real-time game state.

**Badges:**

| Badge | Icon | Primary | Secondary | Color Logic | Visibility |
|-------|------|---------|-----------|-------------|------------|
| Conditions | `Activity` | "{count} Active" | Most severe name | Red (severe), Amber (moderate), Blue (minor) | Always |
| Cooldowns | `Timer` | "{ready} Ready" | "{cooling} cooling" | Cyan if ready > 0, muted if 0 | Always |
| Concentration | `Eye` | "Concentrating" | Spell name | Amber, pulsing animation | Only if active |
| Shop Timer | `Clock` | Countdown "M:SS" | Item name | Red (<1min), Amber (<3min), Cyan (else) | Only if item expires within 5 min |

**Interactions:**
- Tap Conditions badge → Opens Conditions drawer
- Tap Cooldowns badge → Opens Cooldowns drawer  
- Tap Shop Timer badge → Navigates to Shop tab

**Data Sources:**
- `conditions` from `usePromptDrawers()` context
- `cooldownSummary` (new addition to PromptDrawerProvider context)
- `shopItems` passed as prop from Index.tsx

---

### 3. Dynamic Health Bar

A game-style HP bar with animated segments and visual feedback.

**Features:**
- Full-width prominent bar with segmented visual style
- Animated pulse glow when HP changes
- Color gradient transition (emerald → amber → red)
- Temp HP displayed as cyan overlay segments
- Numeric display: "78/100 HP (+5 Temp)"

**Visual states:**
- Healthy (>50%): Emerald glow, stable pulse
- Injured (25-50%): Amber glow, faster pulse
- Critical (<25%): Red glow, urgent pulse animation

**Below the bar:**
- Compact AC and Initiative badges in a row

---

### 4. Available Points Widget (Conditional)

Appears when `availableAbilityPoints > 0`.

**Display:**
- Amber/gold pulsing glow border
- "✨ X Points Available" with sparkle icon
- "Spend Now →" button navigates to Abilities tab
- Hidden when no points available (keeps UI clean)

---

### 5. Enlarged D20 Section

The dice trigger as a focal point of the screen.

**Sizing:**
- Increase from current `w-10 h-10` to approximately `w-24 h-24`
- Centered in layout
- "Tap to Roll" label beneath

**Animations:**
- Subtle rotation wobble on idle
- Pulsing cyan glow ring
- Scale bounce on tap

---

### 6. Primary Navigation Cards (3 Cards)

Large, Assassin's Creed-styled cards with decorative borders.

**Card 1: Quick Menus** (replaces "Drawers")
- Opens existing drawer menu sheet
- Icon: `PanelLeft`
- Cyan accent color

**Card 2: The Main HUD** (replaces "Combat")
- Navigates to Combat tab
- Icon: `Swords`
- Red accent color for combat theme

**Card 3: Contextual (Dynamic)**
Priority-based selection:
1. If unclaimed achievements: "🏆 Claim Rewards" → Feats tab
2. If chronicle undo available: "📜 Review Changes" → Chronicle tab
3. If new shop items: "🛒 Shop Updated" → Shop tab
4. Default: "⚔️ Gear" → Gear tab

**Styling:**
- Angular corners (Assassin's Creed aesthetic)
- Thin gold/bronze border with corner flourishes
- Semi-transparent dark background
- Hover/active glow effect

---

### 7. Footer Quick Actions (Enhanced)

**Short Rest:** Single tap works immediately (low-risk)

**Long Rest:** Requires press-and-hold (0.8 seconds)
- Circular progress indicator during hold
- Prevents accidental game-state changes
- Toast shows what was restored

**Level Up:** Existing pulsing button when XP threshold met

---

## Files to Create

### New Components:

1. **`src/components/home/CharacterNamePlaque.tsx`**
   - Props: `name: string`, `level: number`
   - 3D embossed text with metal/stone plaque styling

2. **`src/components/home/DynamicHealthBar.tsx`**
   - Props: `currentHP`, `maxHP`, `tempHP`, `ac`, `initiative`, `onTap`
   - Segmented bar with animations and stat row

3. **`src/components/home/EnlargedD20Section.tsx`**
   - Props: `onClick: () => void`
   - Wrapper for enlarged dice with label and animations

4. **`src/components/home/StatusIndicatorRow.tsx`**
   - Props: `activeConditionCount`, `mostSevereCondition`, `hasConcentration`, `concentrationSpellName`, `readyCooldownCount`, `coolingCooldownCount`, `soonestExpiringItem`, `onConditionsClick`, `onCooldownsClick`, `onShopClick`
   - Horizontal scrollable badge row

5. **`src/components/home/AvailablePointsWidget.tsx`**
   - Props: `availablePoints: number`, `onSpendClick: () => void`
   - Conditional amber pulsing widget

6. **`src/components/home/PrimaryNavigationCards.tsx`**
   - Props: `onQuickMenusClick`, `onCombatClick`, `onContextualClick`, `contextualCard`
   - Three-card grid with decorative styling

---

## Files to Modify

### 1. `src/components/drawers/PromptDrawerProvider.tsx`

Add cooldown summary to context value:

```typescript
interface PromptDrawerContextValue {
  // ... existing properties
  
  // Cooldown summary (NEW)
  cooldownSummary: {
    readyCount: number;
    coolingCount: number;
  };
}
```

Compute counts from existing cooldowns Map in the provider.

### 2. `src/components/home/HomeScreen.tsx`

Complete restructure:
- Remove current header layout (avatar, XP bar in header)
- Remove quick stats grid (replaced by health bar section)
- Remove 2x5 navigation grid (replaced by 3-card layout)
- Import and integrate all new components
- Use `usePromptDrawers()` for conditions/cooldowns data
- Accept new props for shop items

### 3. `src/pages/Index.tsx`

Pass additional props to HomeScreen:
- `shopItems: shop.items` (already available via `useShop()`)
- Navigation handler for shop tab

### 4. `src/index.css`

Add new keyframes and utilities:

```css
/* Health bar animations */
@keyframes health-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.2); }
}

@keyframes health-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Concentration badge pulse */
@keyframes concentration-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* Shop timer urgent pulse */
@keyframes urgent-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.02); }
}

/* Points widget glow */
@keyframes points-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(251, 191, 36, 0.3); }
  50% { box-shadow: 0 0 16px rgba(251, 191, 36, 0.6); }
}

/* Dice idle wobble */
@keyframes dice-wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(3deg); }
  75% { transform: rotate(-3deg); }
}

/* Entry sequence animations */
@keyframes slide-down-bounce {
  0% { opacity: 0; transform: translateY(-20px); }
  60% { transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes expand-from-center {
  0% { opacity: 0; transform: scaleX(0); }
  100% { opacity: 1; transform: scaleX(1); }
}

/* 3D plaque text shadow utility */
.text-3d-plaque {
  text-shadow: 
    1px 1px 0 rgba(0,0,0,0.5),
    -1px -1px 0 rgba(255,255,255,0.15),
    2px 2px 6px rgba(0,0,0,0.8);
}

/* Plaque background gradient */
.bg-plaque {
  background: linear-gradient(145deg, 
    hsl(30 20% 25%) 0%, 
    hsl(30 15% 18%) 50%,
    hsl(30 20% 22%) 100%);
  box-shadow: 
    inset 0 2px 4px rgba(255,255,255,0.1),
    inset 0 -2px 4px rgba(0,0,0,0.3),
    0 4px 12px rgba(0,0,0,0.5);
}
```

---

## Animation Entry Sequence

When entering the Home Screen:

1. Background fades in (0.2s)
2. Character Name Plaque slides down from top (0.3s delay)
3. Status Indicator Row fades in (0.35s delay)
4. Health Bar expands from center (0.4s delay)
5. Points Widget fades in if visible (0.45s delay)
6. D20 Dice scales up with bounce (0.5s delay)
7. Navigation cards stagger in from bottom (0.1s each, starting at 0.6s)
8. Footer fades in last (0.9s delay)

Use framer-motion `variants` with `staggerChildren` for orchestration.

---

## Live Countdown Logic (Shop Timer Badge)

Real-time countdown for expiring shop items:

```typescript
const [timeRemaining, setTimeRemaining] = useState<number>(0);

useEffect(() => {
  if (!soonestExpiringItem) return;
  
  const updateTime = () => {
    const remaining = Math.max(0, 
      new Date(soonestExpiringItem.expiresAt).getTime() - Date.now()
    );
    setTimeRemaining(Math.floor(remaining / 1000));
  };
  
  updateTime();
  const interval = setInterval(updateTime, 1000);
  return () => clearInterval(interval);
}, [soonestExpiringItem]);

const formatCountdown = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
```

---

## Implementation Sequence

1. Add CSS animations and utilities to `index.css`
2. Create `CharacterNamePlaque` component (3D embossed header)
3. Create `StatusIndicatorRow` component (live status badges)
4. Update `PromptDrawerProvider` to expose `cooldownSummary`
5. Create `DynamicHealthBar` component (animated HP bar with stats)
6. Create `AvailablePointsWidget` component (conditional points reminder)
7. Create `EnlargedD20Section` component (centered dice trigger)
8. Create `PrimaryNavigationCards` component (3-card AC-styled layout)
9. Restructure `HomeScreen.tsx` to integrate all components
10. Update `Index.tsx` to pass shop items prop

---

## Testing Criteria

**Character Name Plaque:**
- Displays character name and level with 3D effect
- Animations play on screen entry

**Status Indicator Row:**
- Conditions badge shows count and updates on add/remove
- Cooldowns badge shows ready/cooling counts accurately
- Concentration badge only appears when spell active
- Shop timer countdown updates every second
- Color changes at 3min and 1min thresholds
- Tapping badges opens correct drawer/navigates correctly

**Dynamic Health Bar:**
- Visual updates when HP changes
- Color transitions at 50% and 25% thresholds
- Temp HP displays correctly
- AC and Init show equipment stat values

**Available Points Widget:**
- Only visible when `availableAbilityPoints > 0`
- Pulses with amber glow
- "Spend Now" navigates to Abilities tab

**Enlarged D20:**
- Centered and prominent
- Wobble animation on idle
- Opens dice roller on tap

**Navigation Cards:**
- Quick Menus opens drawer sheet
- The Main HUD navigates to Combat
- Contextual card changes based on app state

**Long Rest Hold:**
- Requires 0.8s press to activate
- Shows progress indicator during hold
- Toast confirms what was restored

---

## Preserved Functionality

- All existing navigation still accessible via Quick Menus drawer
- HP widget popover with full damage/heal controls  
- Dice roller overlay
- Rest and level-up actions in footer
- Install banner at top
- Background image visibility (transparent containers)
- Drawer sheet with all 8 quick-access options
