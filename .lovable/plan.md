
# Refined Implementation Plan: Ability Cooldown System with Critical Fixes

## Answers to Priority 1 Blockers

### 1. Short Rest Cooldown Logic: **Option A - Base Cooldown Only**

Using **base cooldown** for Short Rest resets is the correct D&D-consistent approach because:
- D&D 5e ability recovery is tied to the ability's inherent power level, not character optimization
- Ghost Arrows with base 45min stays as a "Long Rest only" recovery even at Tier 3
- This prevents "gaming" the system by tier-upgrading specifically to get Short Rest resets

### 2. Ability Tier Retrieval: **Use Character State**

The tier data is already stored in `character.abilities` as `CharacterAbility[]` with `{ abilityId: string, currentTier: 0|1|2|3 }`. The cooldown hook will receive this from the parent component.

### 3. Notification Permission: **Request in Settings Toggle**

Permission will be requested only when the user explicitly enables notifications in the settings toggle - not on app load.

---

## Architecture Updates

### Phase 1: Data Layer

**New File: `src/lib/cooldowns/types.ts`**
```typescript
export interface CooldownConfig {
  abilityId: string;
  displayName: string;
  tree: 'hunter' | 'warrior' | 'assassin';
  baseCooldown: number; // in seconds (converted from minutes)
  tierReductions: { tier1: 0; tier2: 0.125; tier3: 0.25 };
  isPassive: boolean;
}

export interface AbilityCooldownState {
  abilityId: string;
  tier: 1 | 2 | 3;
  lastUsed: number | null;
  availableAt: number | null;
  isOnCooldown: boolean;
  usageCount: number;
  effectiveCooldown: number;
}

export interface CooldownModifier {
  source: 'gear' | 'buff' | 'debuff';
  type: 'percentage' | 'flat';
  value: number;
  expiresAt: number | null;
}

export interface SessionState {
  sessionStart: number | null;
  isPaused: boolean;
  pausedAt: number | null;
  totalPausedTime: number;
}

export interface CooldownSettings {
  enabled: boolean;
  autoPause: boolean;
  notifications: boolean;
  soundEffects: boolean;
  timeFormat: 'mm:ss' | 'descriptive' | 'short';
}

export interface SessionStatistics {
  sessionStart: number;
  sessionEnd: number;
  duration: number;
  totalPausedTime: number;
  activeDuration: number;
  abilitiesUsed: Record<string, {
    name: string;
    count: number;
    totalCooldownTime: number;
  }>;
  mostUsedAbility: string;
  totalAbilityActivations: number;
}
```

**New File: `src/lib/cooldowns/config.ts`**

TTRPG-adjusted cooldown configuration (in seconds, converted from minutes):

| Tree | Ability ID | Display Name | Base Cooldown | Short Rest Eligible |
|------|-----------|--------------|---------------|---------------------|
| Hunter | `predator_shot` | Predator Shot | 480s (8m) | Yes |
| Hunter | `multi_shot` | Multi-Shot | 900s (15m) | Yes |
| Hunter | `devastating_shot` | Devastating Shot | 1200s (20m) | Yes |
| Hunter | `ghost_arrows` | Ghost Arrows | 2700s (45m) | No |
| Hunter | `rain_of_destruction` | Rain of Destruction | 3600s (60m) | No |
| Warrior | `shield_breaker` | Shield Breaker | 600s (10m) | Yes |
| Warrior | `battlecry` | Battlecry | 1080s (18m) | Yes |
| Warrior | `ring_of_chaos` | Ring of Chaos | 900s (15m) | Yes |
| Warrior | `hero_strike` | Hero Strike | 1800s (30m) | No |
| Warrior | `spartan_rage` | Spartan Rage | 9000s (150m) | No |
| Assassin | `shadow_step` | Shadow Step | 720s (12m) | Yes |
| Assassin | `venomous_attacks` | Venomous Attacks | 720s (12m) | Yes |
| Assassin | `critical_assassination` | Critical Assassination | 1080s (18m) | Yes |
| Assassin | `vanish` | Vanish | 2100s (35m) | No |
| Assassin | `deaths_veil` | Death's Veil | 3600s (60m) | No |

Passives (no cooldown tracking): `archery_master`, `hunters_instinct`, `arrow_retrieval`, `weapon_master`, `warriors_resilience`, `second_wind_mastery`, `shadow_dancer`, `poison_tolerance`, `sixth_sense`

Includes helper functions:
- `calculateEffectiveCooldown(abilityId, tier, modifiers)` - with memoization
- `SHORT_REST_THRESHOLD = 1800` (30 minutes in seconds)
- `isShortRestEligible(abilityId)` - checks base cooldown < 1800

**New File: `src/lib/cooldowns/notifications.ts`**

Notification system with:
- `requestNotificationPermission()` - Returns permission status
- `sendCooldownReadyNotification(abilityName)` - Browser push + in-app toast
- `playCooldownReadySound(settings)` - Audio with graceful autoplay failure handling

---

### Phase 2: State Management Hook

**New File: `src/hooks/use-cooldowns.ts`**

**Parameters:**
```typescript
function useCooldowns(
  characterAbilities: CharacterAbility[], // From character state
  isHonestMode: boolean,
  enforceCooldowns: boolean
)
```

**Key Implementation Details:**

**Tier Retrieval Helper (Blocker #2 Fix):**
```typescript
const getAbilityTier = useCallback((abilityId: string): 1 | 2 | 3 => {
  const charAbility = characterAbilities.find(ca => ca.abilityId === abilityId);
  const tier = charAbility?.currentTier || 1;
  return Math.max(1, Math.min(3, tier)) as 1 | 2 | 3;
}, [characterAbilities]);
```

**Simplified triggerCooldown (auto-retrieves tier):**
```typescript
const triggerCooldown = useCallback((abilityId: string) => {
  const tier = getAbilityTier(abilityId);
  const effective = calculateEffectiveCooldown(abilityId, tier, modifiers);
  const now = Date.now();
  
  setCooldowns(prev => new Map(prev).set(abilityId, {
    abilityId,
    tier,
    lastUsed: now,
    availableAt: now + (effective * 1000),
    isOnCooldown: true,
    usageCount: (prev.get(abilityId)?.usageCount || 0) + 1,
    effectiveCooldown: effective,
  }));
}, [getAbilityTier, modifiers]);
```

**Short Rest Reset (Blocker #1 Fix - Base cooldown only):**
```typescript
const resetShortRestCooldowns = useCallback(() => {
  setCooldowns(prev => {
    const updated = new Map(prev);
    Object.entries(COOLDOWN_CONFIGS).forEach(([id, config]) => {
      if (config.baseCooldown < SHORT_REST_THRESHOLD && !config.isPassive) {
        const existing = updated.get(id);
        if (existing) {
          updated.set(id, { ...existing, isOnCooldown: false, availableAt: null });
        }
      }
    });
    return updated;
  });
  
  toast.success("Short rest complete. Quick abilities refreshed!");
}, []);
```

**Modifier Expiration Cleanup (Enhancement #4):**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    setModifiers(prev => {
      const active = prev.filter(mod => !mod.expiresAt || mod.expiresAt > now);
      if (active.length < prev.length) {
        toast.info("Temporary cooldown modifier expired.");
      }
      return active;
    });
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

**Cooldown Completion with Audio (Enhancement #5):**
```typescript
useEffect(() => {
  if (!settings.enabled) return;
  
  cooldowns.forEach((state, id) => {
    if (state.availableAt && state.availableAt <= Date.now() && state.isOnCooldown) {
      setCooldowns(prev => {
        const updated = new Map(prev);
        updated.set(id, { ...state, isOnCooldown: false });
        return updated;
      });
      
      const config = COOLDOWN_CONFIGS[id];
      if (config) {
        sendCooldownReadyNotification(config.displayName);
        playCooldownReadySound(settings);
      }
    }
  });
}, [cooldowns, settings]);
```

**Memoized Effective Cooldowns (Optimization #10):**
```typescript
const effectiveCooldowns = useMemo(() => {
  const map = new Map<string, number>();
  cooldowns.forEach((state, id) => {
    map.set(id, calculateEffectiveCooldown(id, state.tier, modifiers));
  });
  return map;
}, [cooldowns, modifiers]);
```

**Debounced LocalStorage (Optimization #11):**
```typescript
const debouncedSave = useMemo(
  () => debounce((state: CooldownSaveState) => {
    localStorage.setItem('odyssey-cooldown-state', JSON.stringify(state));
  }, 5000),
  []
);
```

**Page Refresh Restoration (Edge Case #8):**
```typescript
useEffect(() => {
  const saved = localStorage.getItem('odyssey-cooldown-state');
  if (!saved) return;
  
  const { cooldowns: savedCooldowns, session, modifiers: savedMods } = JSON.parse(saved);
  const now = Date.now();
  
  Object.entries(savedCooldowns).forEach(([id, state]) => {
    if (state.isOnCooldown && state.availableAt) {
      if (state.availableAt <= now) {
        // Expired while offline - show ready notification
        const config = COOLDOWN_CONFIGS[id];
        if (config) {
          toast.success(`⚡ ${config.displayName} is ready!`);
        }
        setCooldowns(prev => new Map(prev).set(id, { ...state, isOnCooldown: false }));
      } else {
        // Still cooling - restore
        setCooldowns(prev => new Map(prev).set(id, state));
      }
    }
  });
}, []);
```

**Anti-Cheat Time Manipulation Detection:**
```typescript
useEffect(() => {
  if (!settings.enabled || !isHonestMode || !enforceCooldowns) return;
  
  let lastCheck = Date.now();
  const interval = setInterval(() => {
    const now = Date.now();
    const expectedDiff = 60000;
    const actualDiff = now - lastCheck;
    
    // Allow for system sleep/wake (>10s discrepancy threshold)
    if (Math.abs(actualDiff - expectedDiff) > 10000 && actualDiff < expectedDiff) {
      pauseAllCooldowns();
      toast.error("Time discrepancy detected. Cooldowns paused.");
    }
    
    lastCheck = now;
  }, 60000);
  
  return () => clearInterval(interval);
}, [settings.enabled, isHonestMode, enforceCooldowns]);
```

**Session Statistics (Enhancement #6):**
```typescript
const generateSessionStats = useCallback((): SessionStatistics => {
  const now = Date.now();
  const duration = sessionState.sessionStart ? now - sessionState.sessionStart : 0;
  
  const abilitiesUsed: Record<string, any> = {};
  let totalActivations = 0;
  let mostUsedCount = 0;
  let mostUsedAbility = '';
  
  cooldowns.forEach((state, id) => {
    if (state.usageCount > 0) {
      const config = COOLDOWN_CONFIGS[id];
      abilitiesUsed[id] = {
        name: config?.displayName || id,
        count: state.usageCount,
        totalCooldownTime: state.effectiveCooldown * state.usageCount,
      };
      totalActivations += state.usageCount;
      
      if (state.usageCount > mostUsedCount) {
        mostUsedCount = state.usageCount;
        mostUsedAbility = config?.displayName || id;
      }
    }
  });
  
  return {
    sessionStart: sessionState.sessionStart || 0,
    sessionEnd: now,
    duration,
    totalPausedTime: sessionState.totalPausedTime,
    activeDuration: duration - sessionState.totalPausedTime,
    abilitiesUsed,
    mostUsedAbility,
    totalAbilityActivations: totalActivations,
  };
}, [cooldowns, sessionState]);
```

**Return Value:**
```typescript
return {
  // State
  cooldowns,
  modifiers,
  sessionState,
  settings,
  
  // Core operations
  triggerCooldown,
  resetCooldown,
  resetAllCooldowns,
  resetShortRestCooldowns,
  
  // Pause/Resume
  pauseAllCooldowns,
  resumeAllCooldowns,
  
  // Getters
  isOnCooldown,
  getRemainingTime,
  getEffectiveCooldown,
  formatRemainingTime,
  
  // Session
  generateSessionStats,
  
  // Settings
  updateSettings,
};
```

---

### Phase 3: UI Components

**`src/components/cooldowns/CooldownOverlay.tsx`**

SVG progress ring overlay with:
- Tree-colored gradients (hunter=green, warrior=amber, assassin=purple)
- Time-based color transitions: >50% red, 25-50% amber, <25% yellow+pulse
- "READY" state with Sparkles icon and green glow
- Countdown text in selected format

**`src/components/cooldowns/CooldownBadge.tsx`**

Compact badge for equipped slots:
- Shows remaining time or checkmark
- Color-coded by urgency
- Pulse animation when nearly ready

**`src/components/cooldowns/CooldownProgress.tsx`**

Linear progress bar for drawer list items with percentage fill and time label.

**`src/components/drawers/CooldownDrawer.tsx`**

6th floating drawer (cyan Timer icon) with:
- Header: Session duration + Pause/Resume controls
- Accordion sections:
  - ✅ READY (count) - Abilities available now
  - ⏳ COOLING DOWN (count) - With progress bars
  - 💤 PASSIVE (count) - Collapsed by default
- Session Stats button for statistics modal

---

### Phase 4: Settings Integration

**Modifications to `src/components/settings/SettingsModal.tsx`**

Add new "Cooldowns" tab with:

**Notification Permission Flow (Blocker #3 Fix):**
```typescript
const handleNotificationToggle = async (enabled: boolean) => {
  if (enabled) {
    const permission = await requestNotificationPermission();
    
    if (permission !== 'granted') {
      toast.error("Notification permission denied. Enable in browser settings.");
      return; // Don't toggle setting
    }
    
    toast.success("Notifications enabled! You'll be alerted when abilities are ready.");
  }
  
  updateCooldownSettings({ ...cooldownSettings, notifications: enabled });
};
```

**Settings UI:**
- Enable Cooldown Tracking (Switch)
- Auto-Pause When App Hidden (Switch)
- Desktop Notifications (Switch with permission request)
- Sound Effects (Switch)
- Time Display Format (Select: mm:ss / descriptive / short)
- Reset All Cooldowns button (disabled in Honest Mode + enforceCooldowns)

**Honest Mode Bypass Prevention (Edge Case #9):**
```typescript
<Button 
  variant="destructive" 
  onClick={resetAllCooldowns}
  disabled={isHonestMode && enforceCooldowns}
  className="relative"
>
  <RotateCcw className="w-4 h-4 mr-2" />
  Reset All Cooldowns
  {isHonestMode && enforceCooldowns && <Lock className="w-4 h-4 ml-2" />}
</Button>

{isHonestMode && enforceCooldowns && (
  <p className="text-xs text-amber-400 mt-2">
    ⚠️ Manual resets disabled in Honest Mode. Use rest mechanics.
  </p>
)}
```

---

### Phase 5: Game Mode Integration

**Modifications to `src/lib/gameModes.ts`**

Add new rule to `HonestModeRules`:
```typescript
export interface HonestModeRules {
  // ... existing rules
  enforceCooldowns: boolean; // Prevents manual cooldown resets
}

const DEFAULT_HONEST_RULES: HonestModeRules = {
  // ... existing defaults
  enforceCooldowns: true,
};
```

**Modifications to `src/hooks/use-game-mode.ts`**

Add new derived state:
```typescript
const enforceCooldowns = checkRule('enforceCooldowns');

return {
  // ... existing returns
  enforceCooldowns,
};
```

---

### Phase 6: Component Integration

**`src/pages/Index.tsx`**

1. Initialize cooldown hook:
```typescript
const cooldownSystem = useCooldowns(
  character.abilities,
  isHonestMode,
  enforceCooldowns
);
```

2. Wire rest handlers:
```typescript
const handleShortRest = () => {
  cooldownSystem.resetShortRestCooldowns();
  toast({ title: "Short Rest Complete", ... });
};

const handleLongRest = () => {
  cooldownSystem.resetAllCooldowns();
  toast({ title: "Long Rest Complete", ... });
};
```

3. Add cooldownState to SaveData for auto-save.

4. Pass cooldown context to components via props or context.

**`src/components/character/EquippedLoadout.tsx`**

1. Receive cooldown functions via props or context
2. Wrap ability use with cooldown enforcement:
```typescript
const handleUseAbility = (ability: Ability) => {
  if (isOnCooldown(ability.id)) {
    toast.error(`${ability.name} on cooldown! Ready in ${formatRemainingTime(getRemainingTime(ability.id))}`);
    return;
  }
  
  // Existing roll logic...
  triggerCooldown(ability.id); // Auto-retrieves tier
  
  // Continue with modal...
};
```

3. Add cooldown preview display (Enhancement #7):
```typescript
<div className="text-xs text-muted-foreground mt-1">
  Cooldown: {formatRemainingTime(getEffectiveCooldown(ability.id))}
</div>
```

4. Add CooldownBadge to equipped slots.

**`src/components/drawers/PromptDrawerProvider.tsx`**

Add 6th drawer trigger:
```typescript
{
  id: 'cooldowns',
  label: 'Timers',
  icon: <Timer className="w-4 h-4" />,
  accentColor: '#06b6d4', // cyan-500
  onClick: () => { closeAllDrawers(); setCooldownsOpen(true); },
  'data-tutorial-id': 'drawer-cooldowns',
}
```

**`src/components/combat/mobile/MobileAbilityList.tsx`**

Add cooldown overlay and enforcement to ability cards.

---

## Files Summary

### New Files (10)
| File | Purpose |
|------|---------|
| `src/lib/cooldowns/types.ts` | Type definitions including SessionStatistics |
| `src/lib/cooldowns/config.ts` | TTRPG cooldown timings + helpers |
| `src/lib/cooldowns/notifications.ts` | Notification + audio helpers |
| `src/lib/cooldowns/index.ts` | Barrel exports |
| `src/hooks/use-cooldowns.ts` | Main state hook with all fixes |
| `src/components/cooldowns/CooldownOverlay.tsx` | Ability card overlay |
| `src/components/cooldowns/CooldownBadge.tsx` | Compact slot badge |
| `src/components/cooldowns/CooldownProgress.tsx` | Progress bar component |
| `src/components/cooldowns/index.ts` | Component exports |
| `src/components/drawers/CooldownDrawer.tsx` | Dashboard drawer |

### Modified Files (10)
| File | Changes |
|------|---------|
| `src/lib/gameModes.ts` | Add `enforceCooldowns` rule |
| `src/hooks/use-game-mode.ts` | Expose `enforceCooldowns` |
| `src/hooks/use-auto-save.ts` | Add cooldown state to SaveData |
| `src/pages/Index.tsx` | Initialize hook, wire rest handlers |
| `src/components/settings/SettingsModal.tsx` | Add Cooldowns tab |
| `src/components/drawers/PromptDrawerProvider.tsx` | Add 6th drawer trigger |
| `src/components/drawers/index.ts` | Export CooldownDrawer |
| `src/components/character/EquippedLoadout.tsx` | Cooldown enforcement + preview |
| `src/components/combat/mobile/MobileAbilityList.tsx` | Cooldown overlays |
| `src/components/combat/mobile/MobileCombatLayout.tsx` | Pass cooldown context |

---

## Implementation Order

### Day 1: Foundation
1. Create types.ts with all interfaces
2. Create config.ts with TTRPG timings
3. Create notifications.ts with permission helpers
4. Update gameModes.ts with enforceCooldowns rule
5. Update use-game-mode.ts to expose new rule

### Day 2: Core Hook
6. Implement use-cooldowns.ts with:
   - Tier retrieval from character abilities
   - Short Rest logic using base cooldown
   - Modifier expiration cleanup
   - Session statistics
   - Memoization and debouncing
   - Anti-cheat detection

### Day 3: UI Components
7. Build CooldownOverlay with progress ring
8. Build CooldownBadge for slots
9. Build CooldownProgress for lists
10. Build CooldownDrawer with pause controls

### Day 4: Integration
11. Add 6th drawer trigger to PromptDrawerProvider
12. Integrate cooldowns into EquippedLoadout
13. Integrate cooldowns into MobileAbilityList
14. Add Cooldowns tab to SettingsModal with permission flow
15. Wire rest handlers in Index.tsx

### Day 5: Testing & Polish
16. Add cooldown state to auto-save
17. Test expired cooldowns on refresh
18. Test Honest Mode enforcement
19. Test time manipulation detection
20. Verify all time formats display correctly

---

## Expanded Testing Checklist

### Blocker Fixes
- [ ] Short Rest only resets abilities with base cooldown < 30min
- [ ] Tier is correctly retrieved from character.abilities
- [ ] Notification permission requested only on settings toggle enable

### Core Functionality
- [ ] Cooldowns trigger on ability use from EquippedLoadout
- [ ] Cooldowns trigger on ability use from Combat HUD
- [ ] Timers count down at 1-second intervals
- [ ] Pause/resume works when app loses focus
- [ ] Manual pause button functions correctly
- [ ] Cooldowns restore correctly after page refresh

### Rest Integration
- [ ] Short Rest resets: predator_shot, multi_shot, devastating_shot, shield_breaker, battlecry, ring_of_chaos, shadow_step, venomous_attacks, critical_assassination
- [ ] Short Rest does NOT reset: ghost_arrows, rain_of_destruction, hero_strike, spartan_rage, vanish, deaths_veil
- [ ] Long Rest resets ALL cooldowns

### Tier & Modifier Calculations
- [ ] Tier 2 applies 12.5% reduction
- [ ] Tier 3 applies 25% reduction
- [ ] Tier upgrades mid-cooldown don't break timers
- [ ] Modifier expiration automatically removes buffs/debuffs

### Time Display
- [ ] 60-minute cooldowns display correctly in all formats
- [ ] Format toggle updates display immediately

### Notifications
- [ ] Permission denial doesn't break settings toggle
- [ ] Notifications fire when cooldowns complete
- [ ] Audio playback blocks fail gracefully

### Session & Statistics
- [ ] Session stats calculate correctly with paused time excluded
- [ ] Usage counts track per-ability

### Honest Mode
- [ ] Manual reset button disabled when enforceCooldowns active
- [ ] Anti-cheat doesn't false-positive on system sleep/wake
- [ ] Time manipulation (clock set back) is detected

### UI
- [ ] 6th drawer trigger appears correctly
- [ ] Combat HUD shows cooldown states
- [ ] Equipped loadout blocks usage during cooldown
- [ ] Cooldown preview shows effective time before use
- [ ] Drawer displays correct ability groupings
