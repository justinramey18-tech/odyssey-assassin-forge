import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';

// Execute the actual entrypoint with synthetic auth, storage and QStash responses.
const source = readFileSync('supabase/functions/schedule-timer-callback/index.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '');
const compiled = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
const partyId = '00000000-0000-4000-8000-000000000001';
const travelEventId = '00000000-0000-4000-8000-000000000005';
const scheduledAt = '2099-01-01T00:00:00.000Z';
async function request(body: Record<string, unknown>, options: {
  travel?: Record<string, unknown>; host?: string; signedIn?: boolean; readError?: boolean; queueFails?: boolean;
} = {}) {
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const queryCalls: unknown[][] = [];
  const query = (table: string) => {
    const q = {
      select: (fields: string) => { queryCalls.push(['select', table, fields]); return q; },
      eq: (field: string, value: unknown) => { queryCalls.push(['eq', table, field, value]); return q; },
      maybeSingle: async () => table === 'parties'
        ? { data: { created_by: options.host ?? 'host' } }
        : { data: options.travel ?? { has_event: true, status: 'planned', scheduled_at: null, qstash_message_id: null }, error: options.readError ? {} : null },
    };
    return q;
  };
  const fetch = vi.fn(async () => new Response(JSON.stringify({ messageId: 'synthetic-receipt' }), { status: options.queueFails ? 503 : 200 }));
  runInNewContext(compiled, {
    serve: (fn: typeof handler) => { handler = fn; },
    createClient: () => ({ from: query, auth: { getClaims: async () => ({ data: options.signedIn === false ? null : { claims: { sub: 'host' } }, error: null }) } }),
    Deno: { env: { get: (name: string) => name === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'synthetic-only' } },
    Response, Date, fetch, console: { log: vi.fn(), error: vi.fn() },
  });
  if (!handler) throw new Error('Missing timer handler');
  const response = await handler(new Request('https://synthetic.invalid', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-only', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { response, fetch, queryCalls, data: await response.json() };
}
const launch = { partyId, travelEventId, scheduledAt, launchTravelEvent: true };
describe('launch-safe QStash publication', () => {
  it('publishes planned travel with five retries and no private fields', async () => {
    const x = await request(launch);
    expect(x.response.status).toBe(200);
    expect(x.data).toEqual({ ok: true, messageId: 'synthetic-receipt' });
    expect(x.fetch).toHaveBeenCalledOnce();
    const [url, init] = x.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://qstash.upstash.io/v2/publish');
    expect(init.headers).toMatchObject({ 'Upstash-Retries': '5', 'Upstash-Url': 'https://synthetic.invalid/functions/v1/party-timer-generate' });
    expect(JSON.parse(String(init.body))).toEqual({ partyId, travelEventId, triggerSecret: 'synthetic-only' });
    expect(x.queryCalls).toContainEqual(['eq', 'party_travel_events', 'party_id', partyId]);
    expect(x.queryCalls).toContainEqual(['eq', 'party_travel_events', 'id', travelEventId]);
    // The mock exposes no write methods: any database mutation fails this request.
  });
  it.each([
    ['no-event', { has_event: false, status: 'planned', scheduled_at: null, qstash_message_id: null }],
    ['already scheduled', { has_event: true, status: 'scheduled', scheduled_at: null, qstash_message_id: null }],
    ['existing time', { has_event: true, status: 'planned', scheduled_at: scheduledAt, qstash_message_id: null }],
    ['existing receipt', { has_event: true, status: 'planned', scheduled_at: null, qstash_message_id: 'old' }],
  ])('rejects %s pre-arm events', async (_name, travel) => {
    const x = await request(launch, { travel });
    expect(x.response.status).toBe(409); expect(x.fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...launch, scheduledAt: '2000-01-01T00:00:00Z' },
    { ...launch, scheduledAt: 'invalid' },
    { ...launch, partyId: 'join-code' },
    { ...launch, travelEventId: 'invalid' },
    { ...launch, launchTravelEvent: 'true' },
  ])('rejects invalid launch inputs %#', async body => {
    const x = await request(body); expect(x.response.status).toBe(400); expect(x.fetch).not.toHaveBeenCalled();
  });
  it('requires signed-in identity', async () => {
    const x = await request(launch, { signedIn: false }); expect(x.response.status).toBe(401); expect(x.fetch).not.toHaveBeenCalled();
  });
  it('rejects anyone except the original host', async () => {
    const x = await request(launch, { host: 'other-host' }); expect(x.response.status).toBe(403); expect(x.fetch).not.toHaveBeenCalled();
  });
  it('does not publish when the private read fails', async () => {
    const x = await request(launch, { readError: true }); expect(x.response.status).toBe(409); expect(x.fetch).not.toHaveBeenCalled();
  });
  it('preserves matching scheduled travel behavior', async () => {
    const x = await request({ partyId, travelEventId, scheduledAt }, { travel: { status: 'scheduled', scheduled_at: scheduledAt } });
    expect(x.response.status).toBe(200); expect(x.fetch).toHaveBeenCalledOnce();
  });
  it('still rejects mismatched existing schedules', async () => {
    const x = await request({ partyId, travelEventId, scheduledAt }, { travel: { status: 'scheduled', scheduled_at: '2098-01-01' } });
    expect(x.response.status).toBe(409); expect(x.fetch).not.toHaveBeenCalled();
  });
  it('preserves normal timer delay, eventId and two retries', async () => {
    const x = await request({ partyId, delaySeconds: 20, eventId: 'normal-event' });
    expect(x.response.status).toBe(200);
    const [, init] = x.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'Upstash-Retries': '2', 'Upstash-Delay': '20s' });
    expect(JSON.parse(String(init.body))).toEqual({ partyId, eventId: 'normal-event', triggerSecret: 'synthetic-only' });
  });
  it('returns publication failure without claiming a receipt', async () => {
    const x = await request(launch, { queueFails: true }); expect(x.response.status).toBe(502); expect(x.data.messageId).toBeUndefined();
  });
});