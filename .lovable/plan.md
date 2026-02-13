

# Fix: Party Pill Button Should Not Toggle Mode Without Confirmation

## Problem

On the homescreen, the green "Party" pill button acts as an instant mode toggle. Clicking it while in party mode immediately switches to solo mode, which the user experiences as an unexpected "leave party mode" action. There is no confirmation step, and the pill visually looks like a status badge rather than a destructive toggle.

## Solution

Add a confirmation dialog when switching **from party to solo** mode (the destructive direction). Switching from solo back to party does not need confirmation since it restores functionality.

This applies to both locations where the toggle exists:
1. **HomeScreen** pill button (primary fix)
2. **Settings** Game tab toggle (consistency fix)

## Changes

### 1. `src/components/home/HomeScreen.tsx`

**Lines 523-527**: Wrap the `onPlayModeChange` call in a confirmation check. When the current mode is `party` and the user clicks to switch to `solo`:
- Show an `AlertDialog` confirmation with title "Switch to Solo Mode?" and description explaining that party sync will be paused
- Only call `onPlayModeChange('solo')` if confirmed
- When switching from `solo` to `party`, proceed immediately (no confirmation needed)

Add state: `const [showSoloConfirm, setShowSoloConfirm] = useState(false);`

Replace the onClick handler:
```
onClick={() => {
  triggerHaptic('light');
  if (playMode === 'party') {
    setShowSoloConfirm(true); // Show confirmation
  } else {
    onPlayModeChange('party'); // Rejoin immediately
  }
}}
```

Add an `AlertDialog` component nearby with:
- Title: "Switch to Solo Mode?"
- Description: "Party sync will be paused. You won't send or receive updates from party members until you switch back."
- Cancel button
- Confirm button that calls `onPlayModeChange('solo')`

### 2. `src/components/settings/SettingsContent.tsx`

**Line 579**: Apply the same confirmation pattern to the Settings toggle for consistency. Add state and an `AlertDialog` so switching from party to solo requires confirmation there too.

### Imports to Add

Both files will need:
```typescript
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
```

## Technical Details

- No new files created
- No backend changes
- Two files modified: `HomeScreen.tsx` and `SettingsContent.tsx`
- Uses existing `AlertDialog` component (already in the project)
- Solo-to-party direction remains instant (no confirmation needed)

