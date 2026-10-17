import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
import { eventClock } from '../../../supabase/functions/_shared/travel-event-clock';
import { eligibleJourney, object, type Journey } from '../../../supabase/functions/_shared/travel-planning';
const compile = (path: string) => transpileModule(readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, ''),
  { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
const launchCode = compile('supabase/functions/_shared/travel-launch.ts');
const syncCode = compile('supabase/functions/_shared/travel-sync.ts');
async function launchTravel(db: unknown, partyId: string, token: string, journey: Journey, expected: unknown, event: Record<string, unknown>) {
  const syncExports: Record<string, any> = {};
  const env = { fetch: globalThis.fetch, Date, Deno: { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'synthetic-only' } } };
  runInNewContext(syncCode, { ...env, exports: syncExports });
  const exports: Record<string, any> = {};
  runInNewContext(launchCode, { ...env, exports, eventClock, object, cancelQstash: syncExports.cancelQstash });
  return await exports.launchTravel(db,partyId,token,journey,expected,event);
}

const staged = () => ({
  routes: [{ id: 'road', fromLocationId: 'start', toLocationId: 'end', distanceSource: 'manual', distanceMiles: 10 }],
  locations: [{ id: 'start' }, { id: 'end' }], currentLocationId: null,
  journeyPlan: { destinationLocationId: 'end', pace: 'normal', currentLegIndex: 0, totalMiles: 10,
    legs: [{ routeId: 'road', fromLocationId: 'start', toLocationId: 'end', reversed: false }] },
  activeTravel: { routeId: 'road', reversed: false, startProgress: 0, endProgress: 1, startedAt: null,
    realDurationMs: 60000, gameMinutes: 60, startCampaignMinute: 100, pace: 'normal' },
});
const planned = () => ({ id: 'event', has_event: true, status: 'planned', scheduled_at: null, qstash_message_id: null,
  destination_location_id: 'end', target_leg_index: 0, target_route_id: 'road', target_reversed: false, target_route_progress: 0.5 });
function setup(outcome: 'true' | 'false' | 'error' | 'throw' = 'true', queueFails = false) {
  vi.spyOn(Date, 'now').mockReturnValue(100000);
  vi.stubGlobal('Deno', { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'synthetic-only' } });
  const fetch = vi.fn(async (_url: string, _options: RequestInit) => new Response(JSON.stringify({ messageId: 'receipt' }), { status: queueFails ? 503 : 200 }));
  vi.stubGlobal('fetch', fetch);
  const rpc = vi.fn(async (_name: string, _args: unknown) => {
    if (outcome === 'throw') throw new Error('lost connection');
    return { data: outcome === 'true', error: outcome === 'error' ? {} : null };
  });
  const map = staged(), j = eligibleJourney(map, Date.now());
  if (!j) throw new Error('Missing staged journey');
  return { fetch, rpc, map, j };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('server-owned travel launch', () => {
  it('arms a durable no-event outcome without publishing', async () => {
    const x = setup();
    expect(await launchTravel({ rpc: x.rpc }, 'party', 'token', x.j, x.map, { id: 'event', has_event: false, status: 'no_event' }))
      .toEqual({ ok: true, planned: false });
    expect(x.rpc).toHaveBeenCalledWith('arm_private_travel_launch', { _event_id: 'event', _expected_map: x.map, _started_at: 105000, _schedule: null });
    expect(x.fetch).not.toHaveBeenCalled(); expect(x.map.activeTravel.startedAt).toBeNull();
  });
  it('publishes before atomically arming the exact expected map and projection', async () => {
    const x = setup();
    expect(await launchTravel({ rpc: x.rpc }, 'party', 'token', x.j, x.map, planned())).toEqual({ ok: true, planned: true });
    const [url, options] = x.fetch.mock.calls[0];
    expect(url).toBe('https://synthetic.invalid/functions/v1/schedule-timer-callback');
    expect(JSON.parse(String(options.body))).toEqual({ partyId: 'party', travelEventId: 'event', scheduledAt: new Date(135000).toISOString(), launchTravelEvent: true });
    expect(x.rpc).toHaveBeenCalledWith('arm_private_travel_launch', { _event_id: 'event', _expected_map: x.map, _started_at: 105000,
      _schedule: { expected_tranche_started_at: 105000, scheduled_at: new Date(135000).toISOString(), target_tranche_fraction: 0.5,
        target_campaign_minute: 130, target_route_progress: 0.5, qstash_message_id: 'receipt' } });
    expect(x.fetch.mock.invocationCallOrder[0]).toBeLessThan(x.rpc.mock.invocationCallOrder[0]);
    expect(x.map.activeTravel.startedAt).toBeNull();
  });
  it('leaves travel staged when publication fails', async () => {
    const x = setup('true', true);
    await expect(launchTravel({ rpc: x.rpc }, 'party', 'token', x.j, x.map, planned())).rejects.toThrow('Travel scheduling unavailable');
    expect(x.rpc).not.toHaveBeenCalled(); expect(x.map.activeTravel.startedAt).toBeNull();
  });
  it.each(['false', 'error', 'throw'] as const)('cancels the receipt when arm returns %s', async outcome => {
    const x = setup(outcome);
    await expect(launchTravel({ rpc: x.rpc }, 'party', 'token', x.j, x.map, planned())).rejects.toThrow('Travel launch failed');
    expect(x.fetch).toHaveBeenLastCalledWith('https://qstash.upstash.io/v2/messages/receipt', { method: 'DELETE', headers: { Authorization: 'Bearer synthetic-only' } });
    expect(x.map.activeTravel.startedAt).toBeNull();
  });
  it('fails closed for targets outside the current tranche', async () => {
    const x = setup();
    await expect(launchTravel({ rpc: x.rpc }, 'party', 'token', x.j, x.map, { ...planned(), target_leg_index: 1, target_route_id: 'later' })).rejects.toThrow('Travel scheduling unavailable');
    expect(x.fetch).not.toHaveBeenCalled(); expect(x.rpc).not.toHaveBeenCalled();
  });
  it('rejects previously armed rows rather than publishing again', async () => {
    const x = setup();
    await expect(launchTravel({ rpc: x.rpc }, 'party', 'token', x.j, x.map, { ...planned(), status: 'scheduled' })).rejects.toThrow('journey changed');
    expect(x.fetch).not.toHaveBeenCalled(); expect(x.rpc).not.toHaveBeenCalled();
  });
});