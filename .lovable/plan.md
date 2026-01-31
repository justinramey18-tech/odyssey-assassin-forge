

# Production-Ready App Reset Button - Final Implementation

## Overview

Add a **Danger Zone** section with a destructive reset button to the Settings Modal's Character tab. This clears all React state and localStorage, returning the app to its first-launch state.

---

## Verified Codebase Analysis

| Item | Finding | Impact |
|------|---------|--------|
| `resetAllAppData` import | Already exists in Index.tsx (line 49) | No import needed |
| Toast in SettingsModal | Uses `toast` from `sonner` (line 14) | Use `toast.error()` syntax |
| Achievement structure | Flat array, no nested objects | Shallow copy sufficient |
| `createInitialEquipment()` | Factory function, returns new object | No mutation risk |
| `useConsumables` | Reads from localStorage on mount | Clearing storage resets it |
| Intro splash flow | Shows when `showHomeScreen && showIntroSplash` | Wizard takes precedence |

---

## Files to Modify

### File 1: `src/components/settings/SettingsModal.tsx`

#### A. Add Imports (After line 2)

Add `AlertTriangle` to existing lucide-react import:
```typescript
import { Settings, User, Dices, Gamepad2, RotateCcw, Star, Lock, FileText, Copy, Check, RefreshCw, Camera, BookOpen, AlertTriangle } from 'lucide-react';
```

#### B. Add AlertDialog Import (After line 20)

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
```

#### C. Update Props Interface (Line 22)

Add new prop:
```typescript
interface SettingsModalProps {
  characterName: string;
  onEditCharacter: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prestigeData?: {
    totalPrestigePoints: number;
    prestigeLevel: number;
  };
  onPrestigeRespec?: () => void;
  onResetComplete?: () => void;  // NEW PROP
  // ... existing props ...
}
```

#### D. Destructure New Prop (Line 41)

```typescript
export function SettingsModal({ 
  characterName, 
  // ... existing props ...
  onResetComplete,  // NEW
}: SettingsModalProps) {
```

#### E. Add State for Reset Dialog (After line 62)

```typescript
const [showResetDialog, setShowResetDialog] = useState(false);
```

#### F. Add Reset Handler (After line 156)

```typescript
const handleReset = () => {
  try {
    // Close dialogs first to prevent animation glitches
    setShowResetDialog(false);
    setOpen(false);
    
    // Trigger parent state reset (which clears localStorage)
    if (onResetComplete) {
      onResetComplete();
    }
  } catch (error) {
    console.error('[AppReset] Reset failed:', error);
    toast.error('Reset failed. Please refresh the page and try again.');
  }
};
```

#### G. Add Danger Zone Section (After line 454)

Insert after the "Character editing opens the setup wizard" text, inside the Character TabsContent:

```typescript
{/* Danger Zone - App Reset */}
<div className="mt-6 border-2 border-destructive/50 rounded-lg p-4 bg-destructive/5 space-y-4">
  <div className="flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <h4 className="font-display font-semibold text-destructive">
        Danger Zone
      </h4>
      <p className="text-xs text-muted-foreground mt-1">
        Permanently delete all data and start fresh.
      </p>
    </div>
  </div>

  <div className="bg-background/50 rounded-md p-3 space-y-1.5">
    <p className="text-xs font-semibold text-foreground">This will delete:</p>
    <ul className="text-xs text-muted-foreground space-y-1 ml-3">
      <li className="flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-destructive/70" />
        Character ({characterName || 'Unnamed'})
      </li>
      <li className="flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-destructive/70" />
        All levels, XP, and ability upgrades
      </li>
      <li className="flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-destructive/70" />
        Equipment, achievements, and consumables
      </li>
      {prestigeData && prestigeData.prestigeLevel > 0 && (
        <li className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-destructive/70" />
          Prestige Level {prestigeData.prestigeLevel}
        </li>
      )}
    </ul>
  </div>

  <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
    <AlertDialogTrigger asChild>
      <Button 
        variant="destructive" 
        size="sm"
        className="w-full gap-2"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Reset Entire App
      </Button>
    </AlertDialogTrigger>
    
    <AlertDialogContent className="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Reset Application?
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-3 pt-2">
            <p className="text-sm">
              You are about to <span className="font-semibold text-destructive">permanently delete</span> all data:
            </p>
            
            <div className="bg-muted/50 rounded-md p-3">
              <p className="font-semibold text-sm text-foreground">
                {characterName || 'Unnamed Character'}
              </p>
              {prestigeData && prestigeData.prestigeLevel > 0 && (
                <p className="text-xs text-amber-400 mt-1">
                  Prestige Level {prestigeData.prestigeLevel}
                </p>
              )}
            </div>

            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
              <p className="text-xs font-semibold text-destructive">
                This cannot be undone
              </p>
            </div>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      
      <AlertDialogFooter className="gap-2 sm:gap-0">
        <AlertDialogCancel className="mt-0">
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={handleReset}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Yes, Delete Everything
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</div>
```

---

### File 2: `src/pages/Index.tsx`

#### A. Add handleResetApp Function (After line 584)

```typescript
const handleResetApp = () => {
  try {
    // 1. Reset all React state FIRST (prevents hooks reading stale data)
    
    // Reset character to default
    setCharacter({
      name: '',
      level: 1,
      abilities: allAbilities.map(a => ({ abilityId: a.id, currentTier: 0 as const })),
      equippedAbilities: [],
    });

    // Reset XP
    setCurrentXP(0);
    setXPPreset('standard');

    // Reset equipment (factory returns new object each call)
    setEquipment(createInitialEquipment());

    // Reset achievements (shallow copy is sufficient)
    setAchievements(achievementCategories.map(a => ({ ...a })));

    // Reset prestige data
    setPrestigeData({
      prestigeLevel: 0,
      prestigeXP: 0,
      totalPrestigePoints: 0,
    });

    // 2. Reset UI state
    setActiveTab('skills');
    setShowHomeScreen(false);
    setShowWizard(true);
    // Note: showIntroSplash will be reset when localStorage is cleared below

    // 3. Clear all localStorage (after state reset to prevent race conditions)
    resetAllAppData();
    
    // Ensure intro splash flag is also cleared for true first-launch experience
    localStorage.removeItem('odyssey-intro-seen');

    // 4. Success feedback
    toast({
      title: "App Reset Complete",
      description: "All data cleared. Create a new character to begin.",
      className: "border-blue-500 bg-blue-500/10",
      duration: 4000,
    });

  } catch (error) {
    console.error('[AppReset] Reset failed:', error);
    toast({
      title: "Reset Failed",
      description: "An error occurred. Please refresh the page and try again.",
      variant: "destructive",
    });
  }
};
```

#### B. Update First SettingsModal Instance (Line 664)

Add `onResetComplete` prop:
```typescript
<SettingsModal 
  characterName={character.name} 
  onEditCharacter={() => setShowWizard(true)}
  open={showSettingsModal}
  onOpenChange={setShowSettingsModal}
  prestigeData={{
    totalPrestigePoints: prestigeData.totalPrestigePoints,
    prestigeLevel: prestigeData.prestigeLevel,
  }}
  onResetComplete={handleResetApp}
/>
```

#### C. Update Second SettingsModal Instance (Line 740)

Add `onResetComplete` prop:
```typescript
<SettingsModal 
  characterName={character.name} 
  onEditCharacter={() => setShowWizard(true)}
  open={showSettingsModal}
  onOpenChange={setShowSettingsModal}
  prestigeData={{
    totalPrestigePoints: prestigeData.totalPrestigePoints,
    prestigeLevel: prestigeData.prestigeLevel,
  }}
  onResetComplete={handleResetApp}
  character={character}
  abilities={allAbilities}
  unlockedAbilities={unlockedAbilities}
  equippedGear={equipment.slots}
  prestigeLevel={prestigeData.prestigeLevel > 0 ? prestigeData.prestigeLevel : undefined}
  aggregatedStats={{
    totalAC: aggregatedStats.totalAC,
    totalAttackBonus: aggregatedStats.totalAttackBonus,
    damage: aggregatedStats.damage,
    strength: aggregatedStats.strength,
    dexterity: aggregatedStats.dexterity,
    constitution: aggregatedStats.constitution,
    intelligence: aggregatedStats.intelligence,
    wisdom: aggregatedStats.wisdom,
    charisma: aggregatedStats.charisma,
  }}
/>
```

---

## Technical Decisions

### 1. State Reset Before localStorage Clear

State updates execute before localStorage is cleared. This prevents:
- Race conditions where hooks read stale storage data
- Auto-save effects writing stale data back

### 2. Intro Splash Flow After Reset

After reset:
1. `showWizard = true` - Wizard displays first (line 587 takes precedence)
2. `odyssey-intro-seen` cleared - After wizard completion, intro splash will show
3. Intro splash - User clicks "Begin Journey" to reach home screen

### 3. No Redundant Modal Closing

SettingsModal's `handleReset` closes dialogs via `setOpen(false)`. Parent's `handleResetApp` does NOT call `setShowSettingsModal(false)` to avoid duplicate state updates.

### 4. Consumables Reset

`useConsumables` hook reads from localStorage on mount. After reset:
1. localStorage is cleared
2. Wizard renders (which doesn't use consumables)
3. When consumables are next accessed, hook reads empty storage

---

## What NOT to Change

- The existing `resetAllAppData()` utility
- URL parameter reset functionality (`?reset=true`)
- Auto-save logic
- Any other tabs or components
- XP progression widget, game mode settings

---

## Testing Checklist

- [ ] "Danger Zone" appears at bottom of Character tab in Settings
- [ ] Clicking "Reset Entire App" opens confirmation dialog
- [ ] Dialog shows character name and prestige level (if any)
- [ ] "Cancel" closes dialog without changes
- [ ] "Yes, Delete Everything" triggers reset
- [ ] Character creation wizard appears immediately
- [ ] localStorage is empty (check DevTools > Application)
- [ ] Success toast appears
- [ ] After completing wizard, intro splash screen shows
- [ ] No console errors during reset
- [ ] Refreshing page shows wizard (not stale data)

