

## Problem: Timer Expiry Telegram Notifications Never Fire

### Root Cause

In `supabase/functions/party-timer-generate/index.ts`, the Telegram notification call (line 820) is placed **after** a guard on line 800 that skips the party entirely if no players have submitted ready prompts:

```text
Line 800:  if (promptErr || !prompts || prompts.length === 0) continue;  ← skips everything
...
Line 820:  // Telegram notification  ← never reached
```

When you set a timer and close the app without submitting a prompt, the function detects the expired timer but immediately `continue`s past it because there are no ready prompts. The Telegram notification is never sent.

### Secondary Issue (QStash)

The QStash-based timer callback is also failing with a region error (`schedule-timer-callback` logs show a 404). This means only the 1-minute cron fallback triggers `party-timer-generate`. This doesn't directly cause the missing notification but adds latency.

### Plan

**File: `supabase/functions/party-timer-generate/index.ts`**

1. Move the Telegram `timer_expired` notification **above** the prompt check (before line 800), so it fires whenever the timer has expired — regardless of whether prompts exist.
2. Adjust the notification message to be generic (not referencing prompt count) since we may not have prompts yet.
3. Keep the existing `continue` on line 800 intact so AI generation still requires prompts.

The change is approximately:
- After confirming the timer is expired (line 787) and before the prompt query (line 792), insert the Telegram notification block.
- Remove the original notification block from lines 820-838.
- Update the message body to say something like "The round timer has run out!" without referencing player count.

This is a single-file, ~20 line change in the edge function.

