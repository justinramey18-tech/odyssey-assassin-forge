# Fix Claude connector: "requested path is invalid"

## Confirmed facts
- The full bridge address works when called directly.
- The short address produces the exact error you reported.
- You confirmed Claude has the full address and provides custom header fields.
- Claude's attempt is not visibly reaching the bridge, so changing the address again would not solve the underlying problem.

## Plan
1. Add safe connection diagnostics to the bridge. These will record the request method, requested path, and connection format, but never the private key or message contents.
2. Make the bridge accept Claude's full discovery and connection handshake, including its initial browser-style check and both supported response formats.
3. Return clear standards-based responses instead of a generic rejection when Claude probes the bridge before connecting.
4. Redeploy and test the same sequence Claude uses: discovery, initialization, tool listing, reading, authorization rejection, and blocked dangerous commands.
5. Have you retry the connector while watching the bridge traffic. If no request arrives, use Claude's temporary `ofid_...` reference number to identify this as a Claude-side connector failure rather than changing the app again.

## Safety
- The private bridge key remains required for all data access.
- Diagnostics will not store the key, database contents, or Claude conversation text.
- Existing read/write limits and protections remain unchanged.

## Technical details
- Update only `supabase/functions/claude-bridge/index.ts`.
- Add sanitized request logging and standards-compatible GET/POST response negotiation for Streamable HTTP/SSE.
- Preserve bearer authentication, the current tools, blocked schemas and commands, row limits, and timeouts.
