// Claude Database Bridge — a minimal MCP (Model Context Protocol) streamable-HTTP
// server that gives Claude read/write access to the game data in the `public`
// schema, gated by a private bearer key (CLAUDE_BRIDGE_KEY).
//
// Tools:
//   list_tables — layout of every public table (columns, types, row estimates)
//   run_sql     — run ONE SELECT/INSERT/UPDATE/DELETE statement
//
// Guard rails: DDL blocked, non-public schemas blocked, single statement only,
// rows capped, statement timeout enforced.
//
// Connection format: speaks the full MCP Streamable-HTTP sequence Claude's
// connector uses — initialize (with a session id in the reply), notifications,
// GET listen-stream rejection per spec, DELETE session termination — and adapts
// to requests that arrive with or without a session token.

import pg from 'npm:pg@8.13.1';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'odyssey-db-bridge', version: '1.1.0' };
const MAX_ROWS = 500;
const MAX_RESPONSE_CHARS = 500_000;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

// ---------- SQL guard rails ----------

const FORBIDDEN_KEYWORDS = [
  'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'COPY', 'VACUUM',
  'REINDEX', 'CLUSTER', 'COMMENT', 'LISTEN', 'NOTIFY', 'ANALYZE',
];

const FORBIDDEN_FUNCTIONS = [
  'PG_READ_FILE', 'PG_READ_BINARY_FILE', 'PG_LS_DIR', 'LO_IMPORT', 'LO_EXPORT',
  'PG_SLEEP', 'DBLINK', 'PG_LOGFILE',
];

const BLOCKED_SCHEMAS =
  /\b(auth|storage|vault|realtime|supabase_functions|supabase_storage|pgmq|cron|net|graphql|pgsodium|extensions)\s*\./i;

/** Returns an error message if the SQL violates the guard rails, else null. */
function guardSql(raw: string): string | null {
  const stripped = raw
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim();
  if (!stripped) return 'Empty SQL statement.';

  const withoutTrailing = stripped.replace(/;+\s*$/, '');
  if (withoutTrailing.includes(';')) {
    return 'Only ONE SQL statement per call. Run them one at a time.';
  }
  const upper = withoutTrailing.toUpperCase();

  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(upper)) {
      return `Blocked: ${kw} is not allowed. Only SELECT, INSERT, UPDATE and DELETE on game data are permitted.`;
    }
  }
  for (const fn of FORBIDDEN_FUNCTIONS) {
    if (new RegExp(`\\b${fn}\\s*\\(`).test(upper)) {
      return `Blocked: ${fn} is not allowed.`;
    }
  }
  if (BLOCKED_SCHEMAS.test(withoutTrailing)) {
    return 'Blocked: only the public game-data schema is accessible. System and account schemas are off limits.';
  }
  if (!/\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b/.test(upper)) {
    return 'Only SELECT, INSERT, UPDATE or DELETE statements are permitted.';
  }
  return null;
}

// ---------- Database helpers ----------

let cachedDbUrl: string | null = null;
function dbUrl(): string {
  if (cachedDbUrl) return cachedDbUrl;
  const url = Deno.env.get('SUPABASE_DB_URL');
  if (!url) throw new Error('SUPABASE_DB_URL is not configured');
  cachedDbUrl = /[?&]sslmode=/.test(url) ? url : `${url}${url.includes('?') ? '&' : '?'}sslmode=require`;
  return cachedDbUrl;
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    connectionString: dbUrl(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

function capRows(rows: unknown[]) {
  if (rows.length > MAX_ROWS) {
    return { rows: rows.slice(0, MAX_ROWS), truncated: true, totalRows: rows.length };
  }
  return { rows, truncated: false, totalRows: rows.length };
}

function capText(text: string) {
  return text.length > MAX_RESPONSE_CHARS
    ? text.slice(0, MAX_RESPONSE_CHARS) + '\n… [response truncated]'
    : text;
}

async function listTables(): Promise<unknown> {
  return withClient(async (client) => {
    const cols = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    );
    const counts = await client.query(
      `SELECT relname AS table_name, GREATEST(n_live_tup, 0) AS approx_rows
       FROM pg_stat_user_tables WHERE schemaname = 'public'`
    );
    const rowCount = new Map<string, number>();
    for (const r of counts.rows) rowCount.set(r.table_name, Number(r.approx_rows));

    const tables: Record<string, { columns: { name: string; type: string; nullable: string }[]; approxRows: number }> = {};
    for (const r of cols.rows) {
      const t = (tables[r.table_name] ??= { columns: [], approxRows: rowCount.get(r.table_name) ?? 0 });
      t.columns.push({ name: r.column_name, type: r.data_type, nullable: r.is_nullable });
    }
    return { tableCount: Object.keys(tables).length, tables };
  });
}

async function runSql(sql: string): Promise<unknown> {
  const blocked = guardSql(sql);
  if (blocked) throw new Error(blocked);
  return withClient(async (client) => {
    const res = await client.query(sql);
    const capped = capRows(res.rows ?? []);
    return {
      statement: res.command,
      rowsAffected: res.rowCount ?? 0,
      ...capped,
      fields: (res.fields ?? []).map((f: pg.FieldDef) => f.name),
    };
  });
}

// ---------- MCP tools ----------

const TOOLS = [
  {
    name: 'list_tables',
    description:
      'List every game-data table with its columns, column types and approximate row counts. ' +
      'Call this first to understand how the data is organized before reading or writing.',
    inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'run_sql',
    description:
      'Run exactly ONE SQL statement (SELECT, INSERT, UPDATE or DELETE) against the game data. ' +
      'Schema changes, dropping tables, and system/account schemas are blocked by the server. ' +
      'SELECT is always safe. ALWAYS ask the user to confirm before INSERT, UPDATE or DELETE — ' +
      'writes change the user\'s live game data. Use table names unqualified (e.g. gm_guides); ' +
      'prefixing with "public." is allowed.',
    inputSchema: {
      type: 'object',
      properties: { sql: { type: 'string', description: 'A single SQL statement.' } },
      required: ['sql'],
      additionalProperties: false,
    },
  },
];

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text', text: capText(text) }], isError };
}

async function callTool(name: string, args: Record<string, unknown>) {
  try {
    if (name === 'list_tables') {
      return textResult(JSON.stringify(await listTables(), null, 1));
    }
    if (name === 'run_sql') {
      const sql = typeof args.sql === 'string' ? args.sql : '';
      if (!sql.trim()) return textResult('Missing required argument: sql.', true);
      console.log(`[claude-bridge] run_sql: ${sql.length} chars, starts: ${sql.trim().slice(0, 60)}`);
      return textResult(JSON.stringify(await runSql(sql), null, 1));
    }
    return textResult(`Unknown tool: ${name}`, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[claude-bridge] tool ${name} failed: ${message}`);
    return textResult(message, true);
  }
}

// ---------- JSON-RPC / MCP dispatch ----------

type RpcMessage = { jsonrpc: string; id?: number | string | null; method: string; params?: Record<string, unknown> };

async function handleRpc(msg: RpcMessage): Promise<unknown | undefined> {
  const { id, method, params = {} } = msg;

  // Notifications have no id — nothing to reply to.
  if (id === undefined || id === null) return undefined;

  if (method === 'initialize') {
    // Lenient negotiation: honor the client's requested version when given.
    const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION;
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: requested,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      },
    };
  }
  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }
  if (method === 'tools/call') {
    const name = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    const result = await callTool(name, args);
    return { jsonrpc: '2.0', id, result };
  }
  // Resources/prompts are not offered; answer with the standard empty result
  // shape so clients that probe for them keep working.
  if (method === 'resources/list') return { jsonrpc: '2.0', id, result: { resources: [] } };
  if (method === 'prompts/list') return { jsonrpc: '2.0', id, result: { prompts: [] } };
  return {
    jsonrpc: '2.0', id,
    error: { code: -32601, message: `Method not supported: ${method}` },
  };
}

// ---------- Session handling (Streamable HTTP) ----------
// The bridge is stateless for RPC purposes, but it issues a session id on
// initialize so clients that REQUIRE the Mcp-Session-Id handshake keep working.
// Requests carrying any session token (or none) are accepted either way.

const issuedSessions = new Set<string>();

function newSessionId(): string {
  const id = crypto.randomUUID().replace(/-/g, '');
  issuedSessions.add(id);
  // Keep the in-memory set from growing without bound across warm invocations.
  if (issuedSessions.size > 1000) {
    const drop = issuedSessions.values().next().value;
    if (drop) issuedSessions.delete(drop);
  }
  return id;
}

// ---------- Sanitized diagnostics ----------
// Records HOW clients connect (method, path, response-format preference, auth
// shape, outcome) so connection problems can be diagnosed. Never logs the
// bridge key, request bodies, or message contents.

function logRequest(req: Request) {
  const url = new URL(req.url);
  console.log(
    `[claude-bridge] ${req.method} ${url.pathname} accept=${req.headers.get('accept') ?? '-'} ` +
    `content-type=${req.headers.get('content-type') ?? '-'} ` +
    `mcp-session=${req.headers.get('mcp-session-id') ? 'yes' : 'no'} ` +
    `auth=${req.headers.get('authorization') ? 'present' : 'missing'}`
  );
}

function logOutcome(status: number, reason?: string) {
  console.log(`[claude-bridge] outcome status=${status}${reason ? ` reason=${reason}` : ''}`);
}

/** Describes the authorization header's SHAPE only — never its value. */
function authShape(auth: string): string {
  if (!auth) return 'missing';
  if (/^bearer\s/i.test(auth)) return 'bearer-scheme';
  if (/^\S+$/.test(auth)) return 'raw-token';
  return 'other-shape';
}

/** True when the client prefers a Server-Sent Events stream for responses. */
function wantsSse(req: Request): boolean {
  const accept = req.headers.get('accept') ?? '';
  return accept.includes('text/event-stream') && !accept.includes('application/json');
}

/** Wrap one JSON-RPC message in a single SSE `message` event frame. */
function sseFrame(payload: unknown, sessionId?: string): Response {
  const data = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new Response(data, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
  });
}

Deno.serve(async (req) => {
  logRequest(req);

  // Private-key gate: every request must carry the bridge key. Accepts the
  // "Bearer <key>" form (case-insensitive scheme) or the bare key, since some
  // connectors send the header differently. Never logs either value.
  const auth = req.headers.get('Authorization') ?? '';
  const expected = Deno.env.get('CLAUDE_BRIDGE_KEY') ?? '';
  const keyOk =
    !!expected &&
    (auth === `Bearer ${expected}` ||
      auth.toLowerCase() === `bearer ${expected}` ||
      auth === expected);
  if (!keyOk) {
    const shape = authShape(auth);
    if (!expected) {
      logOutcome(500, 'bridge-key-not-configured');
      return json({ error: 'Server not configured' }, 500);
    }
    logOutcome(401, `bad-key auth-shape=${shape}`);
    return json({ error: 'Unauthorized' }, 401);
  }

  const requestSession = req.headers.get('mcp-session-id') ?? undefined;

  if (req.method === 'GET') {
    // MCP Streamable HTTP: GET opens the optional server-to-client listen
    // stream. This server is stateless with nothing to push, so per the spec
    // answer 405 with the required Allow header instead of a bare error.
    logOutcome(405, 'no-server-listen-stream');
    return json(
      { jsonrpc: '2.0', error: { code: -32000, message: 'This bridge does not offer a server listen stream; send requests as POST.' } },
      405,
      { 'Allow': 'POST, DELETE' },
    );
  }
  if (req.method === 'DELETE') {
    // MCP Streamable HTTP session termination — acknowledge and close.
    logOutcome(204, 'session-terminated');
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    logOutcome(405, 'method-not-allowed');
    return json({ error: 'Method not allowed' }, 405, { 'Allow': 'POST, GET, DELETE' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logOutcome(400, 'unreadable-request-body');
    return json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }, 400);
  }

  const messages: RpcMessage[] = Array.isArray(body) ? body as RpcMessage[] : [body as RpcMessage];
  for (const msg of messages) {
    if (msg && typeof msg.method === 'string') {
      console.log(`[claude-bridge] rpc method=${msg.method} id=${msg.id ?? 'notification'}`);
    }
  }

  const isInitialize = messages.some(
    (m) => m && typeof m === 'object' && (m as RpcMessage).method === 'initialize'
  );
  // Fresh connections get a session id so clients that require one stay happy.
  const sessionForReply = isInitialize ? newSessionId() : requestSession;

  const replies: unknown[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg.method !== 'string') {
      replies.push({ jsonrpc: '2.0', id: (msg as RpcMessage)?.id ?? null, error: { code: -32600, message: 'Invalid request' } });
      continue;
    }
    const reply = await handleRpc(msg);
    if (reply !== undefined) replies.push(reply);
  }

  if (replies.length === 0) {
    // Notification-only batch (e.g. notifications/initialized).
    logOutcome(202, 'notification-only');
    return new Response(null, {
      status: 202,
      headers: { ...corsHeaders, ...(sessionForReply ? { 'Mcp-Session-Id': sessionForReply } : {}) },
    });
  }
  const payload = Array.isArray(body) ? replies : replies[0];
  // Honor the client's negotiated response format: SSE frame when the client
  // only accepts text/event-stream, plain JSON otherwise.
  logOutcome(200, 'ok');
  if (wantsSse(req)) return sseFrame(payload, sessionForReply);
  return json(payload, 200, sessionForReply ? { 'Mcp-Session-Id': sessionForReply } : {});
});
