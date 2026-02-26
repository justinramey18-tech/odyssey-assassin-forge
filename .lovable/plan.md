

# Stacking Notifications + "All Ready" Alert

## Changes

**File: `src/lib/party-notifications.ts`**

Two changes in `sendReadyUpNotification`:

1. **Unique tags for stacking**: Change `tag: 'ready-up'` to `tag: 'ready-up-${Date.now()}'` so each notification gets a unique tag and Android stacks them in the notification bar instead of replacing.

2. **"All Players Ready" notification**: When `readyCount >= totalCount`, send a distinct notification with:
   - Title: "🎯 All Players Ready!"
   - Body includes a timestamp (e.g., "All 4 players readied up at 7:32 PM!")
   - In-app toast uses 🎯 icon with longer 6s duration
   - Individual ready-ups keep the ⚔️ icon

The in-app toast `id` also becomes unique per notification (`ready-up-toast-${Date.now()}`) so multiple toasts can stack, except the "all ready" toast which uses a fixed id `all-ready-toast` to replace any prior "all ready" toast.

No other files need changes — the detection logic in `use-party-dm.ts` already passes the correct `readyCount` and `totalCount` to this function.

