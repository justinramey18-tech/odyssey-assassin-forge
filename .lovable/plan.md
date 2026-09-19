# Fix Claude connector: "requested path is invalid"

## What happened
The bridge itself is fine — it is live, locked, and answering. The error comes from the address typed into Claude's connector settings: it is missing the middle portion of the URL. My tests show the exact error you saw only appears when the address is too short; every full-length variation reaches the bridge correctly.

## The fix (one setting to correct in Claude)
In Claude → Settings → Connectors, edit the "Odyssey Database" connector and make sure the URL is exactly this, all one line, no spaces, no missing pieces:

```text
https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/claude-bridge
```

The part most likely missing or mangled is `functions/v1/` in the middle. The address is not just `...supabase.co/claude-bridge` — that short version produces exactly the error you saw.

Also confirm the header is still there:
- Name: `Authorization`
- Value: the word `Bearer`, one space, then your key

Save the connector and let Claude retry.

## What I'll do after you fix it
1. Watch the bridge's traffic log while Claude connects.
2. Confirm I can see Claude's handshake arrive (the log will show activity).
3. If it still fails, capture the exact new error and adjust the bridge to accept whatever address style Claude uses.

## No code changes needed
Nothing in the app is broken — this is a one-line settings correction on the Claude side.
