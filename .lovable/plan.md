# Finish the Claude bridge: a key you can actually copy

## Where things stand
The bridge is built, deployed and tested. It can list your data layout, read data, and save changes, and it correctly refuses schema changes, account-system access, and multi-command requests.

The one thing missing is the key. The key I generated is stored encrypted and can never be displayed — not to you, not to me. So there is nothing for you to paste into Claude.

## The fix
Swap it for a key that you choose, so you have the value in hand.

1. Remove the unviewable auto-generated key.
2. Open the secure key form so you can enter your own long random password for `CLAUDE_BRIDGE_KEY`. Make it long and random — a password manager's generator, 40+ characters, letters and numbers. Keep a copy.
3. Redeploy the bridge so it starts using your key.
4. Re-run the same checks: wrong key refused, data layout readable, a real read works, and dangerous commands still blocked.
5. Give you the connection address and the exact steps for adding it in Claude.

## What you'll then do in Claude
Add a custom connector using the address I give you, with your key sent as the authorization value. Claude will then see two abilities: one to view your data layout, and one to read or change data.

## Reminder
Anything Claude saves is real, live game data. Questions and lookups are always safe; for saves, ask Claude to show you the change before it makes it.

## Technical details
- `secrets--delete_secret` on `CLAUDE_BRIDGE_KEY`, then `secrets--add_secret` so the user supplies the value through the secure form.
- Redeploy `claude-bridge` to pick up the new env value.
- Re-verify with curl: 401 on wrong bearer, `initialize`, `tools/list`, `list_tables`, a `SELECT`, plus the `DROP` / `auth.` / multi-statement rejections.
- Endpoint: `https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/claude-bridge`, header `Authorization: Bearer <your key>`.
