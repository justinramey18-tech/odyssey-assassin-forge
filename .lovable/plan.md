
# Mobile-First Abilities Tab Implementation Plan

## Overview
This plan adds comprehensive mobile-first optimizations to the Abilities Tab, building upon the existing architecture. The focus is on touch interactions, performance, and accessibility while leveraging existing hooks (`useIsMobile`, `useSwipe`) and patterns from `MobileCombatLayout`.

---

## Current State Analysis

### Existing Infrastructure to Leverage
| Asset | Location | Usage |
|-------|----------|-------|
| `useIsMobile` hook | `src/hooks/use-mobile.tsx` | 768px breakpoint detection |
| `useSwipe` hook | `src/hooks/use-swipe.ts` | Touch gesture handling |
| Sheet component (bottom) | `src/components/ui/sheet.tsx` | Bottom sheet for mobile details |
| Tree colors | `src/index.css` lines 54-70 | Hunter/Warrior/Assassin CSS vars |
| Tab patterns | `MobileCombatLayout.tsx` | Swipe navigation with slide animations |

### Files to Create (10)
- `src/lib/abilityTrees/layout.ts` - Grid positioning for 24 abilities
- `src/lib/abilityTrees/colors.ts` - Visual config per tree
- `src/lib/abilityTrees/index.ts` - Barrel exports
- `src/components/abilities/AbilitiesScreen.tsx` - Main screen with mobile-first layout
- `src/components/abilities/AbilityNode.tsx` - Touch-optimized ability nodes
- `src/components/abilities/ConnectionLine.tsx` - SVG prerequisite connectors
- `src/components/abilities/TreeColumn.tsx` - Single tree container
- `src/components/abilities/TreeSelector.tsx` - Mobile tab selector
- `src/components/abilities/AbilityDetailsPanel.tsx` - Details with bottom sheet on mobile
- `src/components/abilities/index.ts` - Component exports

### Files to Modify (3)
- `tailwind.config.ts` - Add mobile-optimized animations
- `src/components/navigation/AssassinHeader.tsx` - Add Abilities tab trigger
- `src/pages/Index.tsx` - Add tab content, wire up handlers

---

## Phase 1: Data Layer and Animations

### File: `src/lib/abilityTrees/layout.ts`

Grid positioning for all 24 abilities organized into 5 tiers:

```text
Structure per tree:
Tier 1: 2 abilities (columns 0, 2)
Tier 2: 2 abilities (columns 0, 2)  
Tier 3: 2 abilities (columns 0, 2)
Tier 4: 1 ability (column 1, center)
Tier 5: 1 ability (column 1, center - ultimate)

Hunter: archery_master, predator_shot -> multi_shot, hunters_instinct -> 
        devastating_shot, arrow_retrieval -> ghost_arrows -> rain_of_destruction

Warrior: weapon_master, shield_breaker -> battlecry, warriors_resilience -> 
         ring_of_chaos, second_wind_mastery -> hero_strike -> spartan_rage

Assassin: shadow_dancer, shadow_step -> critical_assassination, poison_tolerance -> 
          venomous_attacks, sixth_sense -> vanish -> deaths_veil
```

Exports:
- `ABILITY_TREE_LAYOUT: Record<string, TreeNodePosition>`
- `getNodePosition(tree, tier, column, isMobile): { x, y }`
- `getConnectionPath(from, to, isMobile): string` (straight lines on mobile, bezier on desktop)

### File: `src/lib/abilityTrees/colors.ts`

Visual configuration using existing CSS variables:

```typescript
export const TREE_VISUAL_CONFIG = {
  hunter: {
    primary: 'hunter',      // hsl(var(--hunter))
    glow: 'hunter-glow',
    dim: 'hunter-dim', 
    icon: Target,
    name: 'Hunter',
    subtitle: 'Ranged & Awareness',
  },
  warrior: {
    primary: 'warrior',
    glow: 'warrior-glow',
    dim: 'warrior-dim',
    icon: Swords,
    name: 'Warrior', 
    subtitle: 'Melee & Defense',
  },
  assassin: {
    primary: 'assassin',
    glow: 'assassin-glow',
    dim: 'assassin-dim',
    icon: Eye,
    name: 'Assassin',
    subtitle: 'Stealth & Crits',
  },
};
```

### File: `tailwind.config.ts` - Add Animations

New keyframes for ability interactions:

```typescript
keyframes: {
  // Desktop animations (full effects)
  "ability-pulse": {
    "0%, 100%": { boxShadow: "0 0 0 0 currentColor" },
    "50%": { boxShadow: "0 0 20px 4px currentColor" },
  },
  "ability-unlock": {
    "0%": { transform: "scale(1)", filter: "brightness(1)" },
    "50%": { transform: "scale(1.2)", filter: "brightness(1.5)" },
    "100%": { transform: "scale(1)", filter: "brightness(1)" },
  },
  "tier-glow": {
    "0%, 100%": { opacity: "0.6" },
    "50%": { opacity: "1" },
  },
  "connection-flow": {
    "0%": { strokeDashoffset: "20" },
    "100%": { strokeDashoffset: "0" },
  },
  
  // Mobile-optimized animations (simpler, better performance)
  "ability-pulse-mobile": {
    "0%, 100%": { opacity: "1" },
    "50%": { opacity: "0.8" },
  },
  "ability-unlock-mobile": {
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.1)" },
    "100%": { transform: "scale(1)" },
  },
},
animation: {
  "ability-pulse": "ability-pulse 2s ease-in-out infinite",
  "ability-unlock": "ability-unlock 0.4s ease-out",
  "tier-glow": "tier-glow 1.5s ease-in-out infinite",
  "connection-flow": "connection-flow 1s linear infinite",
  "ability-pulse-mobile": "ability-pulse-mobile 3s ease-in-out infinite",
  "ability-unlock-mobile": "ability-unlock-mobile 0.3s ease-out",
},
```

---

## Phase 2: Touch-Optimized Components

### File: `src/components/abilities/AbilityNode.tsx`

Touch-optimized circular node with WCAG 2.1 compliant touch targets:

Props interface:
```typescript
interface AbilityNodeProps {
  ability: Ability;
  currentTier: 0 | 1 | 2 | 3;
  isLocked: boolean;
  isAvailable: boolean;
  isSelected: boolean;
  treeColor: string;
  isMobile: boolean;
  onSelect: () => void;
}
```

Mobile optimizations:
1. **Touch target sizing**: 64x64px on mobile (48px minimum for WCAG AAA), 80x80px on desktop
2. **Touch action**: `touchAction: 'manipulation'` to prevent iOS double-tap zoom
3. **Haptic feedback**: `navigator.vibrate()` on tap with different patterns:
   - 10ms for locked (light feedback)
   - 20ms for unlock action (medium)
   - 30ms for upgrade action (heavy)
4. **Tier badge positioning**: Inside node at top-right corner (avoids connection line overlap)
5. **Animation selection**: Uses `animate-ability-pulse-mobile` on mobile devices

Visual states:
| State | Desktop | Mobile |
|-------|---------|--------|
| Locked | `opacity-40 grayscale border-dashed` | Same |
| Available | `animate-ability-pulse` | `animate-ability-pulse-mobile` |
| Tier 1 | `shadow-[0_0_15px]` | `shadow-[0_0_10px]` |
| Tier 2 | `shadow-[0_0_25px]` + inset | `shadow-[0_0_15px]` |
| Tier 3 | Gold accents + shimmer | Gold border only (no shimmer) |

Accessibility:
```typescript
<div
  role="button"
  tabIndex={0}
  aria-label={`${ability.name}, Tier ${currentTier} of 3, ${isLocked ? 'Locked' : 'Available'}`}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') onSelect();
  }}
  style={{ touchAction: 'manipulation' }}
>
```

### File: `src/components/abilities/ConnectionLine.tsx`

SVG prerequisite connectors with mobile simplification:

```typescript
interface ConnectionLineProps {
  fromId: string;
  toId: string;
  isActive: boolean;
  treeColor: string;
  isMobile: boolean;
}
```

Path calculation:
- **Desktop**: Bezier curves for smooth diagonal connections
- **Mobile**: Straight lines for better performance

```typescript
const pathData = useMemo(() => {
  if (isMobile) {
    // Simple straight line on mobile
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  // Bezier curve on desktop
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}, [from, to, isMobile]);
```

Visual states:
- Inactive: `stroke-muted-foreground/30 stroke-dasharray="4 4"`
- Active: `stroke-{tree}-glow stroke-width="3"` with flow animation (desktop only)

### File: `src/components/abilities/TreeSelector.tsx`

Mobile tab selector with large touch targets:

```typescript
interface TreeSelectorProps {
  selected: 'hunter' | 'warrior' | 'assassin';
  onChange: (tree: 'hunter' | 'warrior' | 'assassin') => void;
}
```

Implementation using existing Tabs component:
```typescript
<Tabs value={selected} onValueChange={onChange} className="w-full">
  <TabsList className="w-full grid grid-cols-3 h-14">
    {['hunter', 'warrior', 'assassin'].map(tree => (
      <TabsTrigger 
        key={tree}
        value={tree}
        className={cn(
          "flex flex-col gap-0.5 h-full",
          `data-[state=active]:bg-${tree}/20 data-[state=active]:text-${tree}-foreground`
        )}
      >
        <TreeIcon className="w-5 h-5" />
        <span className="text-xs font-medium">{treeName}</span>
      </TabsTrigger>
    ))}
  </TabsList>
</Tabs>
```

Swipe indicator dots below tabs showing current position.

### File: `src/components/abilities/TreeColumn.tsx`

Single tree container with mobile-responsive layout:

```typescript
interface TreeColumnProps {
  tree: 'hunter' | 'warrior' | 'assassin';
  abilities: Ability[];
  characterAbilities: CharacterAbility[];
  isMobile: boolean;
  onSelectAbility: (id: string) => void;
  selectedAbilityId: string | null;
}
```

Layout adjustments:
| Property | Desktop | Mobile |
|----------|---------|--------|
| Tier spacing | 120px | 100px |
| Node size | 80px | 64px |
| Column spacing | 100px | 80px |
| Container padding | 60px | 40px |

Header shows invested points:
```text
[Tree Icon] HUNTER           12/24 pts
            Ranged & Awareness
```

---

## Phase 3: Details Panel with Mobile Bottom Sheet

### File: `src/components/abilities/AbilityDetailsPanel.tsx`

Props interface:
```typescript
interface AbilityDetailsPanelProps {
  ability: Ability | null;
  currentTier: 0 | 1 | 2 | 3;
  characterLevel: number;
  availablePoints: number;
  prerequisiteMet: boolean;
  onUpgrade: () => void;
  onEquip: (slot: number) => void;
  onClose: () => void;
  isMobile: boolean;
}
```

Content sections:
1. **Header** - Icon, name, tree badge, type badge
2. **Current Effect** - Tier indicator, current tier description, cooldown
3. **Next Tier Preview** - Benefits of upgrading (if not maxed)
4. **Prerequisites** - Shows required ability if `ability.prerequisite` exists
5. **Synergies** - Badge list of synergizing abilities
6. **Level Requirement Alert** - Warning if `ability.minLevel > characterLevel`
7. **Action Buttons** - Upgrade button, equip slots (active abilities only)

Mobile confirmation for low points:
```typescript
const [showConfirm, setShowConfirm] = useState(false);

const handleUpgradeClick = () => {
  if (isMobile && availablePoints <= 2) {
    setShowConfirm(true);
  } else {
    onUpgrade();
  }
};

{showConfirm && (
  <Alert className="mt-4">
    <AlertTitle>Confirm Upgrade</AlertTitle>
    <AlertDescription>
      You have {availablePoints} points remaining. Upgrade {ability.name}?
    </AlertDescription>
    <div className="flex gap-2 mt-2">
      <Button size="sm" onClick={() => { onUpgrade(); setShowConfirm(false); }}>
        Confirm
      </Button>
      <Button size="sm" variant="outline" onClick={() => setShowConfirm(false)}>
        Cancel
      </Button>
    </div>
  </Alert>
)}
```

---

## Phase 4: Main Screen with Responsive Layout

### File: `src/components/abilities/AbilitiesScreen.tsx`

Main container with progressive enhancement:

```typescript
interface AbilitiesScreenProps {
  character: Character;
  availablePoints: number;
  onUpgradeAbility: (id: string) => void;
  onDowngradeAbility: (id: string) => void;
  onEquipAbility: (id: string, slot: number) => void;
  onBack: () => void;
}
```

State management:
```typescript
const isMobile = useIsMobile();
const [selectedTree, setSelectedTree] = useState<'hunter' | 'warrior' | 'assassin'>('hunter');
const [selectedAbility, setSelectedAbility] = useState<string | null>(null);
const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

// Use existing useSwipe hook
const treeOrder = ['hunter', 'warrior', 'assassin'] as const;

const handleSwipeLeft = useCallback(() => {
  const idx = treeOrder.indexOf(selectedTree);
  if (idx < 2) {
    setSlideDirection('left');
    setSelectedTree(treeOrder[idx + 1]);
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => setSlideDirection(null), 300);
  }
}, [selectedTree]);

const handleSwipeRight = useCallback(() => {
  const idx = treeOrder.indexOf(selectedTree);
  if (idx > 0) {
    setSlideDirection('right');
    setSelectedTree(treeOrder[idx - 1]);
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => setSlideDirection(null), 300);
  }
}, [selectedTree]);

const { handlers: swipeHandlers, swiping, swipeOffset } = useSwipe(
  handleSwipeLeft,
  handleSwipeRight,
  { threshold: 60, velocityThreshold: 0.4 }
);
```

Layout structure:

**Mobile Layout (<768px):**
```text
+----------------------------------------+
| [←] ABILITIES          5 pts available |
+----------------------------------------+
| [Hunter] [Warrior] [Assassin] tabs     |
|          ● ○ ○ swipe dots              |
+----------------------------------------+
|                                        |
|    Swipeable single tree column        |
|    (TreeColumn with isMobile=true)     |
|                                        |
+----------------------------------------+

[Bottom Sheet when ability selected]
```

**Tablet Layout (768-1024px):**
```text
+----------------------------------------+
| [←] ABILITIES          5 pts available |
+----------------------------------------+
|  Tree 1 (scroll)  |   Tree 2 (scroll)  |
|                   |                    |
|  Horizontal scroll with snap           |
+----------------------------------------+

[Bottom Sheet when ability selected]
```

**Desktop Layout (>1024px):**
```text
+-----------------------------------------------------------+
| [←] ABILITIES              5 / 25 pts ★★★★★☆☆☆...        |
+---------------+---------------+---------------+------------+
|    HUNTER     |   WARRIOR     |   ASSASSIN    |  DETAILS   |
|   12 pts      |    8 pts      |    5 pts      |   PANEL    |
|               |               |               |            |
|  [Tier 1]     |  [Tier 1]     |  [Tier 1]     | [Selected  |
|   ●   ●       |   ●   ●       |   ●   ●       |  ability   |
|   |   |       |   |   |       |   |   |       |  info]     |
|  [Tier 2]     |  [Tier 2]     |  [Tier 2]     |            |
|   etc...      |   etc...      |   etc...      | [Upgrade]  |
+---------------+---------------+---------------+------------+
```

Mobile-specific optimizations:
1. **Lazy load non-visible trees**: Only render selected tree on mobile
2. **Skeleton loading**: Show placeholder while tree renders
3. **Reduced animations**: Use `animate-ability-pulse-mobile`
4. **Simplified header**: Number instead of star rating for points

Header component (responsive):
```typescript
<header className={cn(
  "flex items-center justify-between p-4 border-b",
  isMobile && "flex-col gap-2"
)}>
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="sm" onClick={onBack}>
      <ArrowLeft className="w-4 h-4" />
      {!isMobile && <span className="ml-2">Back</span>}
    </Button>
    <h1 className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>
      ABILITIES
    </h1>
  </div>
  
  <div className={cn(
    "flex items-center gap-2",
    isMobile && "w-full justify-center"
  )}>
    <span className="text-sm text-muted-foreground">Available:</span>
    <span className="text-2xl font-bold text-yellow-400">
      {availablePoints}
    </span>
    {isMobile ? (
      <span className="text-sm text-muted-foreground">pts</span>
    ) : (
      <div className="flex gap-1">
        {Array.from({ length: totalPoints }).map((_, i) => (
          <Star
            key={i}
            className={cn("w-4 h-4", i < availablePoints
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted-foreground"
            )}
          />
        ))}
      </div>
    )}
  </div>
</header>
```

Bottom sheet integration (mobile):
```typescript
{isMobile && (
  <Sheet 
    open={!!selectedAbility} 
    onOpenChange={(open) => !open && setSelectedAbility(null)}
  >
    <SheetContent 
      side="bottom" 
      className="h-[75vh] rounded-t-xl overflow-y-auto"
    >
      {/* Drag handle */}
      <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
      <SheetTitle className="sr-only">
        Ability Details
      </SheetTitle>
      <AbilityDetailsPanel
        ability={selectedAbilityData}
        currentTier={currentTier}
        characterLevel={character.level}
        availablePoints={availablePoints}
        prerequisiteMet={prerequisiteMet}
        onUpgrade={() => onUpgradeAbility(selectedAbility!)}
        onEquip={(slot) => onEquipAbility(selectedAbility!, slot)}
        onClose={() => setSelectedAbility(null)}
        isMobile={true}
      />
    </SheetContent>
  </Sheet>
)}
```

---

## Phase 5: Navigation Integration

### File: `src/components/navigation/AssassinHeader.tsx`

Add Abilities tab trigger between Skills and Gear:

```typescript
<TabsTrigger 
  value="abilities" 
  className={cn(
    // Base styles matching existing tabs
    "group relative flex items-center gap-1.5 px-3 py-2 ...",
    // Violet theme for Abilities
    "data-[state=active]:from-violet-600/30 data-[state=active]:to-transparent",
    "data-[state=active]:border-b-2 data-[state=active]:border-b-violet-500"
  )}
>
  <Zap className={cn(
    "w-5 h-5 transition-all duration-300",
    "group-hover:scale-110",
    "group-data-[state=active]:text-violet-400"
  )} />
  <span className={cn(
    "text-sm font-medium",
    "group-data-[state=active]:text-violet-300"
  )}>
    Abilities
  </span>
</TabsTrigger>
```

### File: `src/pages/Index.tsx`

Add abilities to tab union type:
```typescript
const [activeTab, setActiveTab] = useState<
  'skills' | 'abilities' | 'gear' | 'feats' | 'stars' | 'scribe' | 'combat' | 'consumables' | 'chronicle'
>('skills');
```

Add TabsContent:
```typescript
<TabsContent value="abilities" className="mt-0">
  <AbilitiesScreen
    character={character}
    availablePoints={remainingPoints}
    onUpgradeAbility={handleUpgradeAbility}
    onDowngradeAbility={handleDowngradeAbility}
    onEquipAbility={(id, slot) => {
      setCharacter(prev => {
        const newEquipped = [...prev.equippedAbilities];
        newEquipped[slot] = id;
        return { ...prev, equippedAbilities: newEquipped };
      });
    }}
    onBack={() => setActiveTab('skills')}
  />
</TabsContent>
```

---

## Phase 6: Accessibility and Offline Support

### Screen Reader Announcements

Add live region for ability selection:
```typescript
const [announcement, setAnnouncement] = useState('');

useEffect(() => {
  if (selectedAbility) {
    const ability = getAbilityById(selectedAbility);
    if (ability) {
      setAnnouncement(`${ability.name} selected. ${ability.tierEffects[0].description}`);
    }
  }
}, [selectedAbility]);

<div 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
  className="sr-only"
>
  {announcement}
</div>
```

### Mobile Focus Indicators

Enhanced focus styles for touch interfaces:
```css
@media (max-width: 768px) {
  .ability-node:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 4px;
  }
}
```

### Offline Caching

Ability data cached for offline use:
```typescript
useEffect(() => {
  // Cache ability tree data for offline access
  try {
    localStorage.setItem('odyssey-ability-cache', JSON.stringify({
      layout: ABILITY_TREE_LAYOUT,
      abilities: allAbilities.map(a => ({
        id: a.id,
        name: a.name,
        tree: a.tree,
        type: a.type,
        prerequisite: a.prerequisite,
      })),
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Failed to cache ability data:', e);
  }
}, []);
```

---

## Implementation Order

### Day 1: Data Layer and Animations
1. Create `src/lib/abilityTrees/layout.ts` with positioning for all 24 abilities
2. Create `src/lib/abilityTrees/colors.ts` with visual config
3. Create barrel exports
4. Add animations to `tailwind.config.ts` (both desktop and mobile variants)

### Day 2: Core Components
5. Create `AbilityNode.tsx` with touch targets and haptic feedback
6. Create `ConnectionLine.tsx` with mobile-simplified paths
7. Create `TreeColumn.tsx` with responsive spacing
8. Create `TreeSelector.tsx` for mobile tabs

### Day 3: Details Panel and Main Screen
9. Create `AbilityDetailsPanel.tsx` with upgrade confirmation
10. Create `AbilitiesScreen.tsx` with progressive enhancement layout
11. Integrate swipe navigation using existing `useSwipe` hook
12. Add bottom sheet for mobile details

### Day 4: Integration and Polish
13. Add Abilities tab to `AssassinHeader.tsx`
14. Add TabsContent to `Index.tsx`
15. Wire up upgrade/downgrade/equip handlers
16. Add accessibility features (ARIA, focus indicators)

### Day 5: Testing and Optimization
17. Test all visual states across breakpoints
18. Test touch gestures and haptic feedback
19. Test prerequisite validation
20. Performance testing on mobile devices
21. Offline caching verification

---

## Testing Checklist

### Touch Interactions
- [ ] Nodes have minimum 48x48px touch targets on mobile
- [ ] `touchAction: manipulation` prevents double-tap zoom
- [ ] Haptic feedback triggers on tap (10/20/30ms patterns)
- [ ] Swipe left/right navigates between trees
- [ ] Swipe down closes bottom sheet

### Responsive Layout
- [ ] Mobile (<768px): Single tree with tab selector
- [ ] Tablet (768-1024px): Two trees with horizontal scroll
- [ ] Desktop (>1024px): Three trees with fixed sidebar
- [ ] Header adapts (stacked on mobile, horizontal on desktop)
- [ ] Points display: number on mobile, stars on desktop

### Visual States
- [ ] Locked nodes: gray, dashed border, 40% opacity
- [ ] Available nodes: pulse animation (simplified on mobile)
- [ ] Tier 1-3: progressive glow (reduced on mobile)
- [ ] Connection lines: straight on mobile, bezier on desktop
- [ ] Bottom sheet has drag handle indicator

### Accessibility
- [ ] All nodes have ARIA labels
- [ ] Keyboard navigation works (Enter/Space to select)
- [ ] Screen reader announcements on selection
- [ ] Focus indicators visible on mobile
- [ ] Upgrade confirmation for low points

### Performance
- [ ] Only selected tree renders on mobile
- [ ] Simplified animations on mobile devices
- [ ] No jank during swipe gestures
- [ ] Skeleton loaders during lazy load

---

## Technical Notes

### Existing Hook Usage
- `useIsMobile()` from `src/hooks/use-mobile.tsx` for breakpoint detection
- `useSwipe()` from `src/hooks/use-swipe.ts` for gesture handling (already used in MobileCombatLayout)
- Pattern: Match the MobileCombatLayout swipe implementation exactly

### Haptic Feedback Implementation
```typescript
const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
  if ('vibrate' in navigator) {
    navigator.vibrate({ light: 10, medium: 20, heavy: 30 }[type]);
  }
};
```

### Connection Line Derivation
Lines derived from existing `ability.prerequisite` field:
- `rain_of_destruction.prerequisite = { abilityId: 'multi_shot', tier: 3 }`
- Draws line from `multi_shot` node to `rain_of_destruction` node

### Points Calculation
Uses existing functions from `src/lib/types.ts`:
- `getAbilityPointsForLevel(level)` - Total earned
- `getTotalPointsSpent(abilities)` - Sum of all tiers
- `remainingPoints = earned - spent`
