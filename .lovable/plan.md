

# Add Background Notifications for Party Chat

## Problem
When the app is backgrounded on Android, incoming party chat messages produce no notification. The realtime subscription updates state silently.

## Solution
Reuse the existing Service Worker notification infrastructure (from ready-up notifications) to send a push notification for each incoming chat message from another party member.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/party-notifications.ts` | Add new `sendChatMessageNotification(senderName, messageText)` function |
| `src/hooks/use-party-sync.ts` | Call `sendChatMessageNotification` on INSERT events where `user_id !== currentUserId` |

## Detail

### `src/lib/party-notifications.ts`
Add a new exported async function:

```typescript
export async function sendChatMessageNotification(
  senderName: string,
  messageText: string,
): Promise<void> {
  // In-app toast
  toast(`💬 ${senderName}: ${messageText}`, {
    duration: 4000,
    icon: '💬',
    id: `chat-msg-toast-${Date.now()}`,
  });

  // Background push via Service Worker
  if ('Notification' in window && Notification.permission === 'granted') {
    const payload = {
      title: `💬 ${senderName}`,
      body: messageText,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `chat-msg-${Date.now()}`, // unique tag → stacking
    };

    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg?.active) {
        reg.active.postMessage({ type: 'SHOW_NOTIFICATION', payload });
      } else {
        new Notification(payload.title, payload);
      }
    } catch {
      try { new Notification(payload.title, payload); } catch { /* silent */ }
    }
  }
}
```

### `src/hooks/use-party-sync.ts`
In the realtime INSERT handler (~line 852), after adding the message to state, call the notification if the sender is not the current user:

```typescript
if (payload.eventType === 'INSERT') {
  const msg = payload.new as PartyMessage;
  setPartyMessages(prev => [...prev.slice(-49), msg]);
  
  // Notify for messages from other members
  if (msg.user_id !== user?.id) {
    sendChatMessageNotification(msg.sender_name, msg.message);
  }
}
```

No changes needed to `public/custom-sw.js` or `vite.config.ts` — the existing SW message handler already supports the `SHOW_NOTIFICATION` type used here.

