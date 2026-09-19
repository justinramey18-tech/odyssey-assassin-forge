# Connect Claude to your game's data — verification pass

## Where things stand

Your Claude assistant correctly identified why the connection failed before: the old bridge was a plain web endpoint with a password, not a real MCP "connector server," which is the specific language Claude's custom connectors speak. The bridge has since been rebuilt into a true MCP server and is already live — same address, same secret key. It now answers Claude's opening handshake, hands out session tickets, and accepts both response formats Claude can request.

## Steps

1. **You retry the existing connector in Claude.** Do not delete and re-add it. Same address, same key (the header value is the word `Bearer`, one space, then your key). I cannot press this button — it happens on Claude's side.
2. **I read the bridge's diary.** Every attempt now writes a sanitized entry saying exactly how far it got: key accepted or rejected, handshake started, tools listed, etc. Your key is never recorded.
3. **Fix whatever the diary names, if anything.** Likely candidates, in order:
   - Key mismatch → you re-enter the key in Claude's connector settings (nothing to rebuild).
   - Handshake answered but tool listing fails → small bridge adjustment, one-file change.
   - Still "requested path is invalid" with the full address → points to how Claude saved the connector; then deleting and re-adding it once, fresh, is the move.

## If it connects

Claude will see exactly two abilities: **list the game's data areas** and **run guarded questions/changes against your game data**. Structure changes, account/login data, and destructive commands remain blocked no matter what is asked.

## Technical details

- Bridge address: `https://sqvcszzbkyzidigsdqgk.supabase.co/functions/v1/claude-bridge`
- Already deployed as a Streamable HTTP MCP server: `initialize` (issues `Mcp-Session-Id`), `notifications/initialized`, `tools/list`, `tools/call`, `ping`, plus empty `resources/list` and `prompts/list` answers; JSON or SSE replies chosen from Claude's `Accept` header; bearer key accepted in either common header form.
- Guardrails unchanged: single statement, game-data tables only, no structure changes, row/size/time caps, secrets never logged.
- Note on your Claude assistant's other suggestion: its built-in Supabase connector can't reach this project's data — this is a managed Lovable Cloud database with no dashboard or master key to hand out — so the custom bridge remains the right path.
