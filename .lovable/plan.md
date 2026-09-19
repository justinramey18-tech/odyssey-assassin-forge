# Connect Claude to the app's database via the custom bridge

## What we know

- The bridge (`claude-bridge`) is built, deployed, and answers correctly: no key or wrong key gets turned away with 401; the right key opens MCP tools (`list_tables`, `run_sql`) with safety limits.
- The built-in Supabase connector Claude keeps referencing can never see this database — Lovable Cloud projects are not attached to any personal Supabase account, so it will always show "0 projects." Stop trying that connector.
- The last authenticated attempt reached the bridge but was rejected for a wrong key (`bad-key` in the logs). The URL and protocol are correct.

## Steps (mostly on your side, in Claude)

1. In Claude, do NOT use the "Supabase" built-in connector. Use **Add custom connector** (a.k.a. custom MCP connector) instead.
2. Connector settings:
   - URL: `https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/claude-bridge`
   - Authorization header value: the word `Bearer`, one space, then the exact key you entered in the secure form here — no extra spaces or line breaks.
3. If you are unsure the key saved correctly, I will reopen the secure key form here so you can re-enter it, then I will redeploy the bridge.
4. Retry the existing custom connector (delete/re-add only if the retry fails).
5. I will then read the bridge's activity log and report exactly what Claude sent and why it was accepted or rejected — the log shows outcomes like `ok`, `bad-key`, or `blocked-sql`, never the key itself.

## If it connects

You will see tools named `list_tables` and `run_sql` in Claude, and Claude can read and write your app's data within the bridge's safety limits (no structure changes, no account/auth data, capped result sizes).

## If it still fails

I will adjust the bridge to match whatever Claude's connector reports, based on the logged failure reason.
