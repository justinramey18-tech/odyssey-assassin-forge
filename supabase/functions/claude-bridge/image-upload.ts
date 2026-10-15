// Campaign image upload tools for the bridge. Pure logic: every outside call
// (database, Storage, clock, secret) comes in through `ImageDeps`, so the same
// code runs in the edge function and in unit tests with mocked Storage.

export const IMAGE_BUCKET = 'party-chat-images';
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MiB
export const MAX_DIMENSION = 16384;
export const MAX_PIXELS = 100_000_000;
export const TICKET_VERSION = 1;
export const TICKET_TTL_SECONDS = 24 * 60 * 60;
// Supabase documents signed upload URLs as valid for 2 hours; the lifetime is
// not configurable by the caller.
export const PROVIDER_UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;
const TICKET_PURPOSE = 'odyssey-bridge/campaign-image-ticket/v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_RE = /^[0-9a-f]{64}$/i;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export interface ImageDeps {
  findParty(partyId: string): Promise<{ hostId: string; isActive: boolean } | null>;
  createSignedUpload(bucket: string, path: string): Promise<{ signedUrl: string; token: string }>;
  fetchObject(bucket: string, path: string, maxBytes: number): Promise<
    { status: 'missing' } | { status: 'too_large' } | { status: 'ok'; bytes: Uint8Array; contentType: string }
  >;
  publicUrl(bucket: string, path: string): string;
  checkPublic(url: string): Promise<boolean>;
  ticketSecret(): string | null;
  now(): number; // ms
  randomId(): string;
}

export interface Actor { id: string } // 'bridge-key' or the OAuth owner's user id

type Result = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export const PREPARE_TOOL = {
  name: 'prepare_campaign_image_upload',
  description:
    'Authorize upload of ONE publicly readable campaign map image for a party. Only use when the user asked to upload an image. ' +
    'Returns a one-object signed upload URL (send the exact raw image bytes with the returned method and headers) and a verification ticket. ' +
    'This does NOT install or activate a map; call verify_campaign_image_upload afterwards, then install using the verified public_url.',
  inputSchema: {
    type: 'object',
    properties: {
      party_id: { type: 'string', format: 'uuid', description: 'The party the image belongs to.' },
      content_type: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp'] },
      size_bytes: { type: 'integer', minimum: 1, maximum: MAX_IMAGE_BYTES },
      sha256: { type: 'string', pattern: '^[0-9a-fA-F]{64}$', description: 'Hex SHA-256 of the exact file bytes.' },
    },
    required: ['party_id', 'content_type', 'size_bytes', 'sha256'],
    additionalProperties: false,
  },
};

export const VERIFY_TOOL = {
  name: 'verify_campaign_image_upload',
  description:
    'Check an image uploaded with prepare_campaign_image_upload: confirms size, SHA-256, real image type and dimensions, and public access. ' +
    'Returns the permanent public_url only when every check passes. Read-only; safe to retry. Does not install a map. ' +
    'Note: the file is already in a public bucket once uploaded; this check happens after upload, not before publication.',
  inputSchema: {
    type: 'object',
    properties: { ticket: { type: 'string', description: 'Ticket returned by prepare_campaign_image_upload.' } },
    required: ['ticket'],
    additionalProperties: false,
  },
};

function extraKeys(args: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(args).filter((k) => !allowed.includes(k));
}

export function validatePrepareArgs(args: unknown):
  { ok: true; v: { party_id: string; content_type: string; size_bytes: number; sha256: string } } | { ok: false; error: string } {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return { ok: false, error: 'Arguments must be an object.' };
  const a = args as Record<string, unknown>;
  const extra = extraKeys(a, ['party_id', 'content_type', 'size_bytes', 'sha256']);
  if (extra.length) return { ok: false, error: `Unexpected argument(s): ${extra.join(', ')}` };
  if (typeof a.party_id !== 'string' || !UUID_RE.test(a.party_id)) return { ok: false, error: 'party_id must be a UUID.' };
  if (typeof a.content_type !== 'string' || !(a.content_type in EXT)) return { ok: false, error: 'content_type must be image/png, image/jpeg or image/webp.' };
  if (typeof a.size_bytes !== 'number' || !Number.isInteger(a.size_bytes) || a.size_bytes < 1 || a.size_bytes > MAX_IMAGE_BYTES)
    return { ok: false, error: `size_bytes must be an integer from 1 to ${MAX_IMAGE_BYTES}.` };
  if (typeof a.sha256 !== 'string' || !SHA_RE.test(a.sha256)) return { ok: false, error: 'sha256 must be 64 hex characters.' };
  return { ok: true, v: { party_id: a.party_id.toLowerCase(), content_type: a.content_type, size_bytes: a.size_bytes, sha256: a.sha256.toLowerCase() } };
}

export function validateVerifyArgs(args: unknown): { ok: true; ticket: string } | { ok: false; error: string } {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return { ok: false, error: 'Arguments must be an object.' };
  const a = args as Record<string, unknown>;
  const extra = extraKeys(a, ['ticket']);
  if (extra.length) return { ok: false, error: `Unexpected argument(s): ${extra.join(', ')}` };
  if (typeof a.ticket !== 'string' || a.ticket.length < 10 || a.ticket.length > 4096) return { ok: false, error: 'ticket is required.' };
  return { ok: true, ticket: a.ticket };
}

// ---------- ticket (HMAC-SHA256, stateless so it survives cold starts) ----------

const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch { return null; }
}
async function hmacKey(secret: string): Promise<CryptoKey> {
  // Purpose-labelled derivation: the raw secret is never used directly as the ticket key.
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derived = new Uint8Array(await crypto.subtle.sign('HMAC', base, enc.encode(TICKET_PURPOSE)));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export interface TicketClaims {
  v: number; ctx: 'campaign-image'; party_id: string; host_id: string; actor: string;
  bucket: string; path: string; content_type: string; size_bytes: number; sha256: string; exp: number;
}

export async function signTicket(claims: TicketClaims, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function readTicket(ticket: string, secret: string): Promise<TicketClaims | null> {
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;
  const sig = fromB64url(parts[1]);
  if (!sig) return null;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(parts[0]));
  if (!valid) return null;
  const raw = fromB64url(parts[0]);
  if (!raw) return null;
  try { return JSON.parse(new TextDecoder().decode(raw)) as TicketClaims; } catch { return null; }
}

// ---------- image structure checks (header + structure parse, not a full pixel decode) ----------

export interface ImageInfo { type: string; width: number; height: number }

function u32be(b: Uint8Array, o: number) { return ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]; }
function u16be(b: Uint8Array, o: number) { return (b[o] << 8) | b[o + 1]; }
function u16le(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8); }
function u24le(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16); }
function u32le(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

function parsePng(b: Uint8Array): ImageInfo | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 45 || !sig.every((v, i) => b[i] === v)) return null;
  if (u32be(b, 8) !== 13 || String.fromCharCode(...b.slice(12, 16)) !== 'IHDR') return null;
  // Walk chunks to make sure the file is structurally complete (IDAT present, ends with IEND).
  let o = 8, sawIdat = false, sawEnd = false;
  while (o + 12 <= b.length) {
    const len = u32be(b, o);
    const type = String.fromCharCode(...b.slice(o + 4, o + 8));
    if (o + 12 + len > b.length) return null;
    if (type === 'IDAT') sawIdat = true;
    o += 12 + len;
    if (type === 'IEND') { sawEnd = true; break; }
  }
  if (!sawIdat || !sawEnd) return null;
  return { type: 'image/png', width: u32be(b, 16), height: u32be(b, 20) };
}

function parseJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null;
    const m = b[o + 1];
    if (m === 0xff) { o++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
    if (m === 0xd9 || m === 0xda) return null; // reached data/end before a frame header
    const len = u16be(b, o + 2);
    if (len < 2 || o + 2 + len > b.length) return null;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (len < 7) return null;
      const height = u16be(b, o + 5), width = u16be(b, o + 7);
      // Must end with an End-Of-Image marker.
      if (b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9) return null;
      return { type: 'image/jpeg', width, height };
    }
    o += 2 + len;
  }
  return null;
}

function parseWebp(b: Uint8Array): ImageInfo | null {
  const s = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (b.length < 30 || s(0, 4) !== 'RIFF' || s(8, 4) !== 'WEBP') return null;
  if (u32le(b, 4) + 8 !== b.length) return null;
  const chunk = s(12, 4);
  if (chunk === 'VP8 ') {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { type: 'image/webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return { type: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { type: 'image/webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return null;
}

export function inspectImage(b: Uint8Array): ImageInfo | null {
  const info = parsePng(b) ?? parseJpeg(b) ?? parseWebp(b);
  if (!info) return null;
  if (info.width < 1 || info.height < 1 || info.width > MAX_DIMENSION || info.height > MAX_DIMENSION) return null;
  if (info.width * info.height > MAX_PIXELS) return null;
  return info;
}

async function sha256Hex(b: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b));
  return Array.from(d, (x) => x.toString(16).padStart(2, '0')).join('');
}

// ---------- tools ----------

export async function prepareCampaignImageUpload(args: unknown, actor: Actor, deps: ImageDeps): Promise<Result> {
  const parsed = validatePrepareArgs(args);
  if (!parsed.ok) return fail(parsed.error);
  const secret = deps.ticketSecret();
  if (!secret) return fail('Image uploads are not configured on the server.');
  const { party_id, content_type, size_bytes, sha256 } = parsed.v;

  const party = await deps.findParty(party_id);
  if (!party) return fail('Party not found.');
  if (!party.isActive) return fail('Party is not active.');
  if (!UUID_RE.test(party.hostId)) return fail('Party host could not be resolved.');

  const fileId = deps.randomId();
  if (!UUID_RE.test(fileId)) return fail('Could not create a file id.');
  const path = `${party.hostId}/${party_id}/campaign-map/${fileId}.${EXT[content_type]}`;
  const signed = await deps.createSignedUpload(IMAGE_BUCKET, path);
  const exp = Math.floor(deps.now() / 1000) + TICKET_TTL_SECONDS;
  const ticket = await signTicket({
    v: TICKET_VERSION, ctx: 'campaign-image', party_id, host_id: party.hostId, actor: actor.id,
    bucket: IMAGE_BUCKET, path, content_type, size_bytes, sha256, exp,
  }, secret);

  return {
    ok: true,
    data: {
      upload: {
        url: signed.signedUrl,
        method: 'PUT',
        headers: { 'Content-Type': content_type, 'x-upsert': 'false' },
        body: 'The exact raw image bytes (not base64, not multipart).',
        max_bytes: MAX_IMAGE_BYTES,
        provider_url_expires_in_seconds: PROVIDER_UPLOAD_URL_TTL_SECONDS,
        provider_url_expiry_note: 'Storage provider documents signed upload URLs as valid for 2 hours; not adjustable.',
        private: 'Treat this URL as a private, single-use credential. Do not share or log it.',
      },
      ticket,
      ticket_expires_at: new Date(exp * 1000).toISOString(),
      bucket: IMAGE_BUCKET,
      object_path: path,
      next_step: 'Upload the bytes, then call verify_campaign_image_upload with the ticket.',
    },
  };
}

export async function verifyCampaignImageUpload(args: unknown, actor: Actor, deps: ImageDeps): Promise<Result> {
  const parsed = validateVerifyArgs(args);
  if (!parsed.ok) return fail(parsed.error);
  const secret = deps.ticketSecret();
  if (!secret) return fail('Image uploads are not configured on the server.');

  const c = await readTicket(parsed.ticket, secret);
  if (!c) return fail('Ticket is invalid or has been altered.');
  if (c.v !== TICKET_VERSION || c.ctx !== 'campaign-image') return fail('Ticket is for a different purpose or version.');
  if (typeof c.exp !== 'number' || c.exp * 1000 < deps.now()) return fail('Ticket has expired. Prepare a new upload.');
  if (c.actor !== actor.id) return fail('Ticket was issued to a different caller.');
  if (c.bucket !== IMAGE_BUCKET || !(c.content_type in EXT)) return fail('Ticket target is not allowed.');
  if (!UUID_RE.test(c.party_id) || !UUID_RE.test(c.host_id)) return fail('Ticket target is not allowed.');
  const pathRe = new RegExp(`^${c.host_id}/${c.party_id}/campaign-map/[0-9a-f-]{36}\\.${EXT[c.content_type]}$`, 'i');
  if (!pathRe.test(c.path)) return fail('Ticket target is not allowed.');

  const party = await deps.findParty(c.party_id);
  if (!party || party.hostId !== c.host_id) return fail('Party no longer matches this ticket.');

  const obj = await deps.fetchObject(c.bucket, c.path, MAX_IMAGE_BYTES);
  if (obj.status === 'missing') return fail('No uploaded file found yet. Upload the bytes first, then verify.');
  if (obj.status === 'too_large') return fail('Uploaded file is larger than 15 MiB.');
  if (obj.bytes.length !== c.size_bytes) return fail(`Byte count mismatch: expected ${c.size_bytes}, got ${obj.bytes.length}.`);
  if ((await sha256Hex(obj.bytes)) !== c.sha256) return fail('SHA-256 mismatch: the stored file is not the expected file.');
  const info = inspectImage(obj.bytes);
  if (!info) return fail('Stored file is not a valid PNG, JPEG or WebP image of acceptable size.');
  if (info.type !== c.content_type) return fail(`Image type mismatch: file is ${info.type}, expected ${c.content_type}.`);
  const storedType = obj.contentType.split(';')[0].trim().toLowerCase();
  if (storedType !== c.content_type) return fail(`Stored Content-Type is ${storedType || 'missing'}, expected ${c.content_type}.`);

  const public_url = deps.publicUrl(c.bucket, c.path);
  if (!(await deps.checkPublic(public_url))) return fail('File is stored but its public address is not reachable yet.');

  return {
    ok: true,
    data: {
      verified: true, party_id: c.party_id, bucket: c.bucket, object_path: c.path, public_url,
      content_type: info.type, size_bytes: obj.bytes.length, sha256: c.sha256, width: info.width, height: info.height,
    },
  };
}
