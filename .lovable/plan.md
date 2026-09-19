# Claude Database Bridge

## Goal
You want Claude (outside this app) to read and change the app's data directly, so you can use it to write better prompts. This app's database is fully managed by Lovable, which keeps the master keys private — that's why Claude's normal database connector can't get in. Instead, we'll build a small, secure doorway into the database that Claude can use.

## What gets built
One private "bridge" — a small secure doorway the app serves. It only responds to requests carrying a private key, and it speaks the same connector language Claude already understands, so you add it in Claude's settings like any other connector.

Claude gets three abilities:
1. **See the layout** — list what data exists and how it's organized (tables and their columns).
2. **Read** — look up and search the actual data (characters, parties, GM guides, messages, etc.).
3. **Write** — add, change, or remove rows, so improved prompts and guides can be saved back.

## Safety rails
- The doorway stays locked unless the request carries your private key. The key lives on the server; you'll paste it into Claude's connector settings once.
- Claude can read and change the game data, but it cannot delete tables, change the database's structure, or touch the login/account system's internals.
- Every request through the bridge is logged, so there's a record of what Claude did.

## Build steps
1. Generate and store the private bridge key in the app's server-side secrets.
2. Create the bridge function (`supabase/functions/claude-bridge/`) with the three abilities above, the key check, and the safety rails.
3. Deploy it and turn off the standard login requirement for it (the private key is the login).
4. Test it end to end: read the table layout, run a real read, and prove a write works (using a scratch table that is removed afterwards).
5. Hand you the connection address and step-by-step instructions for adding it to Claude (name, URL, and the key as a header).

## What you'll do afterwards
In Claude's connector settings, add a custom connector with the address I give you and your key. Then Claude can browse your data and save improved prompts straight into the database.

## One heads-up
Once connected, anything Claude changes is real — it edits your live game data. Read-only questions are always safe; for saves, it's worth asking Claude to confirm before it writes.

## Technical details (for reference)
- New edge function `claude-bridge` implementing a minimal MCP streamable-HTTP server (JSON-RPC over POST with SSE responses), `verify_jwt = false`, auth via `Authorization: Bearer $CLAUDE_BRIDGE_KEY`.
- MCP tools: `list_tables` (public schema tables, columns), `run_sql` (SELECT/INSERT/UPDATE/DELETE via service role in a transaction with `statement_timeout`).
- Guard rails enforced server-side: reject DDL (`DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`), reject any non-`public` schema target (blocks `auth.*`), cap returned rows (e.g. 500) and response size.
- Secret created with the secrets tool; key value shown once for pasting into Claude.
- CORS: allow `https://claude.ai` and `https://api.anthropic.com` origins for the MCP handshake.
