# Make the Claude bridge speak Claude's exact connection format

## Problem

When you reconnect the connector, Claude reaches the secure bridge but its connection
attempt stops before the handshake completes, so Claude reports an invalid path. The
bridge currently only understands one strict request style; Claude's connector sends a
slightly different sequence.

## Change

Update ONLY the secure Claude bridge so it adapts to the exact connection format Claude
sends, while keeping every protection it already has:

1. **Full Streamable-HTTP handshake** — accept Claude's discovery-style requests and
   always answer with the exact headers Claude expects, including the session header on
   the reply so Claude can keep talking to the bridge.
2. **Session-aware flow** — remember Claude's session token per connection and accept
   requests that arrive with or without it, so neither style is rejected.
3. **Response format** — reply in whichever style Claude's request asks for (plain
   stream or plain reply), exactly as its connection format dictates.
4. **Keep the lock on** — the same private key check stays; wrong keys are still turned
   away. Schema changes, account/system data, destructive commands, multi-part
   statements, oversized replies and slow queries all remain blocked.
5. Read (listing data, SELECT) stays instant; writes (INSERT/UPDATE/DELETE) still
   require Claude to ask you for confirmation first.

## After the change

- Redeploy the bridge.
- Test the full connection sequence from here, simulating exactly how Claude connects,
  including the handshake, tool listing, a sample read, and a blocked destructive write.
- You then reconnect the existing connector in Claude — no delete-and-recreate needed
  unless a later test proves the stored key itself is wrong.

## Files affected

- The secure Claude bridge only. No game screens, campaign data, or account
  information will be changed.
