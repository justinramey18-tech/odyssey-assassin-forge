

# Prestige Tree Tier Lock Visual Enhancement - Implementation Plan

## Overview
Implement visual tier-locking indicators in the Legacy (Prestige) tab to clearly show when Intermediate and Advanced tiers are inaccessible because Foundation abilities haven't been completed.

## Current State

The tier-gating **logic** is already correctly implemented in `use-prestige-tree.ts`:
- `isTierUnlockedForBranch(branch, tier)` - checks if a tier is accessible
- `getTierUnlockProgress(branch, tier)` - returns completion progress with `requiredTierName` and `targetTierName`
- `canUnlockAbility()` returns proper lock reasons like "Intermediate locked. Complete all Foundation abilities (2/4)"

**The problem**: The UI doesn't visually distinguish between:
1. **Tier locked** (previous tier incomplete) - should show lock overlay, non-interactive
2. **Available but not purchased** (tier accessible, missing points/prereqs) - should be clickable
3. **Already unlocked** - should show completion state

---

## Phase 1: Add `isTierLocked` Prop to PrestigeAbilityNode

**File**: `src/components/prestigeTree/PrestigeAbilityNode.tsx`

### Changes

1. Add new prop to interface:
```typescript
interface PrestigeAbilityNodeProps {
  // ... existing props
  isTierLocked?: boolean;  // NEW - entire tier is inaccessible
}
```

2. Add distinct visual state for tier-locked nodes:
   - Heavy blur overlay (bg-black/70 backdrop-blur-sm)
   - Centered lock icon (replaces ability icon entirely)
   - Opacity reduction to 0.3 (vs 0.5 for "can't afford")
   - Disable all hover effects and interactions
   - Remove pointer events

3. Update button element:
```typescript
<button
  onClick={!isTierLocked ? onClick : undefined}
  disabled={isTierLocked || (!isUnlocked && !canUnlock)}
  className={cn(
    // ... existing styles
    isTierLocked && [
      "opacity-30",
      "cursor-not-allowed",
      "pointer-events-none",
    ]
  )}
>
```

4. Add tier-lock overlay inside the button:
```typescript
{isTierLocked && (
  <div className="absolute inset-0 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center z-20">
    <Lock className="w-5 h-5 text-slate-500" />
  </div>
)}
```

### Visual States Summary

| State | Opacity | Border | Icon | Hover | Clickable |
|-------|---------|--------|------|-------|-----------|
| Unlocked | 1.0 | Branch glow | Ability icon (colored) | - | Yes (view details) |
| Can Unlock | 1.0 | Amber dashed | Ability icon (amber) | Scale up | Yes |
| Cannot Unlock Yet | 0.5 | Slate | Lock icon | None | Yes (view reason) |
| Tier Locked | 0.3 | None | Lock overlay | None | No |

---

## Phase 2: Update PrestigeBranchColumn to Calculate Tier Accessibility

**File**: `src/components/prestigeTree/PrestigeBranchColumn.tsx`

### Changes

1. Add new props to interface:
```typescript
interface PrestigeBranchColumnProps {
  // ... existing props
  isTierUnlockedForBranch: (branch: PrestigeBranch, tier: 1 | 2 | 3) => boolean;
  getTierUnlockProgress: (branch: PrestigeBranch, tier: 1 | 2 | 3) => {
    unlockedCount: number;
    totalRequired: number;
    requiredTierName: string;
    targetTierName: string;
  };
}
```

2. Calculate tier accessibility inside component:
```typescript
// Calculate tier accessibility for this branch
const isTier2Accessible = isTierUnlockedForBranch(branch, 2);
const isTier3Accessible = isTierUnlockedForBranch(branch, 3);

// Get progress for each tier
const tier1Progress = getTierUnlockProgress(branch, 1);
const tier2Progress = getTierUnlockProgress(branch, 2);
const tier3Progress = getTierUnlockProgress(branch, 3);
```

3. Pass `isTierLocked` to each node:
```typescript
// Tier 1 nodes - always accessible
<PrestigeAbilityNode
  isTierLocked={false}
  // ... other props
/>

// Tier 2 nodes
<PrestigeAbilityNode
  isTierLocked={!isTier2Accessible}
  // ... other props
/>

// Tier 3 nodes
<PrestigeAbilityNode
  isTierLocked={!isTier3Accessible}
  // ... other props
/>
```

---

## Phase 3: Add Tier Section Headers with Progress

**File**: `src/components/prestigeTree/PrestigeBranchColumn.tsx`

### New Tier Header Component

Replace static tier labels with enhanced headers:

```typescript
function TierHeader({
  tierName,
  isAccessible,
  progress,
  isMobile,
}: {
  tierName: string;
  isAccessible: boolean;
  progress: { unlockedCount: number; totalRequired: number };
  isMobile: boolean;
}) {
  const isComplete = progress.unlockedCount === progress.totalRequired;
  const percentage = progress.totalRequired > 0 
    ? Math.round((progress.unlockedCount / progress.totalRequired) * 100)
    : 0;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2",
      "py-2 mb-4"
    )}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-widest">
          {tierName}
        </span>
        
        {/* Status Badge */}
        {!isAccessible && (
          <Badge variant="secondary" className="text-[8px] gap-1 px-1.5 py-0.5">
            <Lock className="w-2 h-2" />
            Locked
          </Badge>
        )}
        
        {isAccessible && !isComplete && (
          <Badge variant="outline" className="text-[8px] px-1.5 py-0.5">
            {progress.unlockedCount}/{progress.totalRequired}
          </Badge>
        )}
        
        {isComplete && (
          <Badge className="text-[8px] gap-1 px-1.5 py-0.5 bg-green-600">
            <Check className="w-2 h-2" />
          </Badge>
        )}
      </div>

      {/* Progress Bar (Tier 2/3 only) */}
      {progress.totalRequired > 0 && (
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="w-16 sm:w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500 ease-out",
                isComplete ? "bg-green-500" : isAccessible ? "bg-amber-500" : "bg-slate-600"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground/50 w-8">
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}
```

### Layout with Headers

```typescript
{/* Tier 1 - Foundation */}
<TierHeader
  tierName="Foundation"
  isAccessible={true}
  progress={tier1Progress}
  isMobile={isMobile}
/>
<div className="relative z-10 flex justify-center gap-4 mb-6">
  {tier1.map((ability) => (
    <PrestigeAbilityNode
      key={ability.id}
      ability={ability}
      isTierLocked={false}
      // ... other props
    />
  ))}
</div>

{/* Tier 2 - Intermediate */}
<TierHeader
  tierName="Intermediate"
  isAccessible={isTier2Accessible}
  progress={tier2Progress}
  isMobile={isMobile}
/>
{/* Lock message if tier is locked */}
{!isTier2Accessible && (
  <div className="text-center text-[10px] text-amber-400/60 mb-4">
    Complete all Foundation abilities ({tier1Progress.unlockedCount}/{tier1Progress.totalRequired})
  </div>
)}
<div className="relative z-10 flex justify-center gap-4 mb-6">
  {tier2.map((ability) => (
    <PrestigeAbilityNode
      key={ability.id}
      ability={ability}
      isTierLocked={!isTier2Accessible}
      // ... other props
    />
  ))}
</div>

{/* Similar pattern for Tier 3 */}
```

---

## Phase 4: Update PrestigeConnectionLines for Tier Lock State

**File**: `src/components/prestigeTree/PrestigeConnectionLines.tsx`

### Changes

1. Add new props:
```typescript
interface PrestigeConnectionLinesProps {
  // ... existing props
  isTier2Accessible: boolean;
  isTier3Accessible: boolean;
}
```

2. Update line interface to track target tier:
```typescript
interface ConnectionLine {
  // ... existing fields
  targetTier: 1 | 2 | 3;  // NEW - tier of the destination node
}
```

3. Populate targetTier when building lines:
```typescript
for (const ability of abilities) {
  // ...
  lines.push({
    // ... existing fields
    targetTier: ability.tier,
  });
}
```

4. Update line rendering to show tier lock state:
```typescript
{lines.map((line, index) => {
  const config = BRANCH_VISUAL_CONFIG[line.branch];
  
  // Determine if target tier is accessible
  const isTierAccessible = 
    line.targetTier === 1 ? true :
    line.targetTier === 2 ? isTier2Accessible :
    isTier3Accessible;
  
  // Line is dimmed if tier is locked
  const isTierLocked = !isTierAccessible;
  
  return (
    <g key={`${line.fromId}-${line.toId}-${index}`}>
      <line
        x1={`${line.fromPos.x}%`}
        y1={`${line.fromPos.y}%`}
        x2={`${line.toPos.x}%`}
        y2={`${line.toPos.y}%`}
        stroke={
          isTierLocked ? '#1f2937' :  // Very dim for locked tiers
          line.isActive ? config.glowColor : '#374151'
        }
        strokeWidth={isTierLocked ? 1 : line.isActive ? 2 : 1}
        strokeDasharray={isTierLocked ? '2 4' : line.isActive ? undefined : '4 4'}
        opacity={isTierLocked ? 0.15 : line.isActive ? 0.8 : 0.3}
        style={{
          transition: 'stroke 0.3s, opacity 0.3s',
        }}
      />
      
      {/* Glow effect only for active, accessible lines */}
      {line.isActive && !isMobile && !isTierLocked && (
        <line /* glow line */ />
      )}
    </g>
  );
})}
```

---

## Phase 5: Update PrestigeTreeScreen to Pass Tier Helpers

**File**: `src/components/prestigeTree/PrestigeTreeScreen.tsx`

### Changes

1. Destructure tier helpers from hook:
```typescript
const {
  isLegacyUnlocked,
  unlockProgress,
  unlockedSet,
  spentOnTree,
  branchProgress,
  canUnlockAbility,
  unlockAbility,
  isAbilityUnlocked,
  isTierUnlockedForBranch,    // ADD
  getTierUnlockProgress,      // ADD
} = prestigeTree;
```

2. Pass to PrestigeBranchColumn:
```typescript
<PrestigeBranchColumn
  key={branch}
  branch={branch}
  unlockedSet={unlockedSet}
  canUnlockAbility={canUnlockAbility}
  onNodeClick={handleNodeClick}
  isMobile={isMobile}
  isTierUnlockedForBranch={isTierUnlockedForBranch}  // ADD
  getTierUnlockProgress={getTierUnlockProgress}      // ADD
  className="border border-purple-900/20 rounded-xl bg-black/20"
/>
```

---

## Phase 6: Enhance PrestigeAbilityDetails Sheet

**File**: `src/components/prestigeTree/PrestigeAbilityDetails.tsx`

### Changes

1. Detect tier-lock vs other lock reasons:
```typescript
// Detect different lock types from unlock reason
const isTierLocked = unlockReason?.toLowerCase().includes('locked') && 
  (unlockReason?.includes('Foundation') || unlockReason?.includes('Intermediate'));

const isPrestigeLevelLocked = unlockReason?.includes('Prestige Level');

const isMissingPoints = unlockReason?.includes('more ability point');

const isMissingPrereqs = unlockReason?.includes('Requires:');
```

2. Update action button section with distinct UI for each lock type:
```typescript
{/* Action Button */}
<div className="absolute bottom-6 left-6 right-6">
  {isUnlocked ? (
    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
      <Unlock className="w-4 h-4 text-green-400" />
      <span className="text-sm text-green-400">Unlocked</span>
    </div>
  ) : canUnlock ? (
    <Button
      onClick={handleUnlock}
      className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold"
    >
      <Unlock className="w-4 h-4 mr-2" />
      Unlock for {ability.prestigeCost} Point{ability.prestigeCost > 1 ? 's' : ''}
    </Button>
  ) : isTierLocked ? (
    // Tier Locked - Distinct amber/red styling
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-amber-400">Tier Locked</span>
      </div>
      <span className="text-xs text-amber-400/70 text-center">{unlockReason}</span>
    </div>
  ) : isPrestigeLevelLocked ? (
    // Prestige Level Locked - Purple styling
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-400">Level Required</span>
      </div>
      <span className="text-xs text-purple-400/70 text-center">{unlockReason}</span>
    </div>
  ) : (
    // Missing points or prerequisites - Default gray
    <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <Lock className="w-4 h-4 text-slate-500" />
      <span className="text-sm text-slate-500">{unlockReason}</span>
    </div>
  )}
</div>
```

---

## Real-Time Update Mechanism

The UI will update instantly when abilities are unlocked:

1. When `unlockAbility()` succeeds, it updates `progress.unlockedAbilities`
2. This triggers React re-render via `useState`
3. `unlockedSet` is recalculated (useMemo dependency on progress)
4. `isTierUnlockedForBranch` uses the new `unlockedSet`
5. `PrestigeBranchColumn` re-renders with updated `isTier2Accessible`/`isTier3Accessible`
6. Lock overlays disappear via React reconciliation
7. CSS transitions provide smooth visual feedback (300ms on opacity/stroke)

---

## Mobile Responsive Considerations

1. **Tier Headers**: Stack vertically on mobile with `flex-col sm:flex-row`
2. **Progress Bars**: Full width on mobile, fixed width on desktop
3. **Lock Overlays**: Same size as nodes (w-12 h-12 on mobile vs w-16 h-16 desktop)
4. **Touch Targets**: Disabled nodes have `pointer-events-none` to prevent accidental taps
5. **Lock Messages**: Centered text with adequate padding for readability

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Empty branch (no abilities) | Console error, tier returns locked |
| Missing previous tier | Console warning, tier allowed to unlock |
| Prestige level requirement | Shows purple "Level Required" UI |
| Prerequisites not met | Shows gray "Requires: X, Y" UI |
| Zero points available | Shows gray "Need X more points" UI |
| Rapid unlock attempts | Debounced via `isUnlocking` state |

---

## Files to Modify

| File | Changes |
|------|---------|
| `PrestigeAbilityNode.tsx` | Add `isTierLocked` prop, blur overlay, disabled styles |
| `PrestigeBranchColumn.tsx` | Add tier helpers props, calculate accessibility, tier headers, lock messages |
| `PrestigeConnectionLines.tsx` | Add tier accessibility props, dim lines to locked tiers |
| `PrestigeTreeScreen.tsx` | Destructure and pass tier helper functions |
| `PrestigeAbilityDetails.tsx` | Detect lock types, distinct UI for tier/prestige/prereq locks |

---

## Testing Checklist

### Per-Branch Testing
- Foundation (Tier 1) abilities always accessible in all 4 branches
- Intermediate (Tier 2) shows lock overlay until ALL Foundation unlocked
- Advanced (Tier 3) shows lock overlay until ALL Intermediate unlocked
- Each branch progresses independently

### Visual States
- Tier-locked nodes: Heavy blur overlay, lock icon, non-interactive
- Available nodes: Amber pulse, cost badge, clickable
- Unlocked nodes: Branch-colored glow, ability icon

### Real-Time Updates
- Unlocking last Foundation ability instantly removes Intermediate lock overlays
- Progress bars update immediately on unlock
- Connection lines brighten when tier becomes accessible

### Edge Cases
- Prestige level requirement shows purple UI in details sheet
- Missing points shows gray UI with specific message
- Mobile view handles all states correctly

