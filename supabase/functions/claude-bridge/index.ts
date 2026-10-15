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
import {
  PREPARE_TOOL, VERIFY_TOOL, prepareCampaignImageUpload, verifyCampaignImageUpload,
  type Actor, type ImageDeps,
} from './image-upload.ts';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'odyssey-db-bridge', version: '1.2.0' };
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
  PREPARE_TOOL,
  VERIFY_TOOL,
];

// ---------- Storage access for image tools (server-only credentials) ----------

function storageEnv() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Image uploads are not configured on the server.');
  return { url: url.replace(/\/$/, ''), key };
}
const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

const imageDeps: ImageDeps = {
  async findParty(partyId) {
    return await withClient(async (c) => {
      const r = await c.query('SELECT created_by::text AS host, is_active FROM public.parties WHERE id = $1', [partyId]);
      if (!r.rows.length) return null;
      return { hostId: String(r.rows[0].host ?? ''), isActive: r.rows[0].is_active === true };
    });
  },
  async createSignedUpload(bucket, path) {
    const { url, key } = storageEnv();
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new Error('Could not create a signed upload address.');
    return { signedUrl: data.signedUrl, token: data.token };
  },
  async fetchObject(bucket, path, maxBytes) {
    const { url, key } = storageEnv();
    const res = await fetch(`${url}/storage/v1/object/authenticated/${bucket}/${encPath(path)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404 || res.status === 400) { await res.body?.cancel(); return { status: 'missing' }; }
    if (!res.ok || !res.body) { await res.body?.cancel(); throw new Error(`Storage read failed (${res.status}).`); }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel(); return { status: 'too_large' }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let o = 0;
    for (const ch of chunks) { bytes.set(ch, o); o += ch.length; }
    return { status: 'ok', bytes, contentType: res.headers.get('content-type') ?? '' };
  },
  publicUrl(bucket, path) {
    return `${storageEnv().url}/storage/v1/object/public/${bucket}/${encPath(path)}`;
  },
  async checkPublic(publicUrl) {
    try {
      const res = await fetch(publicUrl, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
      return res.ok;
    } catch { return false; }
  },
  ticketSecret() { return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null; },
  now: () => Date.now(),
  randomId: () => crypto.randomUUID(),
};

function textResult(text: string, isError = false) {
  return { content: [{ type: 'text', text: capText(text) }], isError };
}

async function callTool(name: string, args: Record<string, unknown>, actor: Actor) {
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
    if (name === PREPARE_TOOL.name || name === VERIFY_TOOL.name) {
      console.log(`[claude-bridge] ${name} called`); // never log tickets, URLs or bytes
      const r = name === PREPARE_TOOL.name
        ? await prepareCampaignImageUpload(args, actor, imageDeps)
        : await verifyCampaignImageUpload(args, actor, imageDeps);
      return r.ok ? textResult(JSON.stringify(r.data, null, 1)) : textResult(r.error, true);
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

async function handleRpc(msg: RpcMessage, actor: Actor): Promise<unknown | undefined> {
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
    const result = await callTool(name, args, actor);
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
  // Two independent keys are accepted (Claude's and ChatGPT's); each only
  // counts when configured.
  const url = new URL(req.url);
  const projectRef = (Deno.env.get('SUPABASE_URL') ?? '').match(/https:\/\/([a-z0-9]+)\./)?.[1] ?? 'sqvcszzbkyzidigsdqgk';
  const issuer = `https://${projectRef}.supabase.co/auth/v1`;
  const resourceUrl = `https://${projectRef}.supabase.co/functions/v1/claude-bridge`;
  const metadataUrl = `${resourceUrl}/.well-known/oauth-protected-resource`;

  // OAuth protected-resource metadata (RFC 9728) so ChatGPT can discover the
  // login server. Public and contains no secrets.
  if (req.method === 'GET' && url.pathname.endsWith('/.well-known/oauth-protected-resource')) {
    return json({ resource: resourceUrl, authorization_servers: [issuer], bearer_methods_supported: ['header'] });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const validKeys = [
    Deno.env.get('CLAUDE_BRIDGE_KEY') ?? '',
    Deno.env.get('CHATGPT_BRIDGE_KEY') ?? '',
  ].filter((k) => k.length > 0);
  const presented = /^bearer /i.test(auth) ? auth.slice(7).trim() : auth;
  let keyOk = validKeys.some((k) => presented === k || auth === k);
  const actor: Actor = { id: 'bridge-key' };

  // OAuth path: a token issued by the app's login server through the approval
  // screen. Must carry a client_id (copied app sessions are refused) and must
  // belong to an approved owner account.
  if (!keyOk && presented.split('.').length === 3) {
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('npm:jose@5.9.6');
      const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
      const { payload } = await jwtVerify(presented, jwks, { issuer, audience: 'authenticated' });
      const owners = (Deno.env.get('BRIDGE_OWNER_USER_IDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const sub = String(payload.sub ?? '');
      if (!payload.client_id) {
        logOutcome(401, 'oauth-no-client-id');
      } else if (!owners.includes(sub)) {
        logOutcome(403, `oauth-not-owner user=${sub}`);
        return json({ error: 'This account is not allowed to use the bridge.' }, 403);
      } else {
        keyOk = true;
        actor.id = sub;
      }
    } catch (e) {
      logOutcome(401, `oauth-verify-failed ${(e as Error)?.name ?? ''}`);
    }
  }

  if (!keyOk) {
    logOutcome(401, `bad-key auth-shape=${authShape(auth)}`);
    return json({ error: 'Unauthorized' }, 401, {
      'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"`,
      'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
    });
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
    const reply = await handleRpc(msg, actor);
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
