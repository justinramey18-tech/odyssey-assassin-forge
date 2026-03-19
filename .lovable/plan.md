

## Plan: Enhanced Ready-Up Telegram Notifications

### What changes

Modify the `setReady` function in `src/hooks/use-party-dm.ts` to:

1. **Check the player's prompt text** from `currentPrompts` (via `myPrompt.prompt`)
2. **Detect AFK guide usage** by checking if the prompt starts with `<<` (the autopilot delimiter)
3. **Build the notification body** based on three cases:
   - **Autopilot (AFK guide)**: `"[Name] got lazy. They're using their afk guide. The A.I. is now having to do all the heavy lifting. If it turns out bad, blame yourself and your afk guide. (X/Y ready)"`
   - **Has a prompt**: `"[Name] has readied up!\n\n📝 [prompt text] (X/Y ready)"`
   - **No prompt (empty ready)**: `"[Name] has readied up! (X/Y ready)"` (current behavior)

### File: `src/hooks/use-party-dm.ts`

Update lines ~717-724 to read the prompt from `myPrompt`, detect `<<...>>` wrapping, and compose the appropriate message body before calling `sendTelegramNotification`.

### Technical detail

- `myPrompt` is already resolved at line 680. At the notification point (line 717), we re-read it from the updated `currentPrompts` or use the known prompt value.
- For the autopilot case, the prompt is `<<guide text>>` — we just check `prompt.startsWith('<<')`.
- The prompt text included in the notification will be the raw text (stripped of `<<>>` delimiters for autopilot, shown as-is for normal prompts). Truncated to ~200 chars to avoid excessively long Telegram messages.

