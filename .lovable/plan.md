# Diagnose Claude connector retry

## What the retry showed

Claude reached the secure bridge using the correct address and included an authorization entry. The request stopped before the bridge received Claude’s connection handshake, so deleting and recreating the connector is not yet justified.

## Plan

1. Add safe diagnostic outcomes that distinguish an incorrect saved key, unreadable request, and unsupported connection message without recording the key or request contents.
2. Redeploy the bridge with those diagnostics while preserving all database protections and read/write limits.
3. Have you reconnect the existing connector once more and inspect the resulting outcome.
4. If the existing connector is sending a stale or malformed authorization value, then delete and recreate it with the same address and `Bearer ` followed by your key. Otherwise, adapt the bridge to the exact connection format Claude sends.
5. Confirm Claude can connect, list the available database tools, read game data, and request confirmation before making changes.

## Files affected

- The secure Claude bridge only.
- No game screens, campaign data, or account information will be changed.
