import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJourneyTranche, freezeTravel, planJourneyRoute, sanitizeCampaignMapState, settleTravelState, trancheToTravel, travelDetail, type CampaignMapState } from '@/lib/campaign-map';

const mock = vi.hoisted(() => ({ invoke: vi.fn(), row: null as unknown, writes: [] as CampaignMapState[], reads: 0, writeError: false }));
const STAMP = '2026-10-17T12:00:00Z';
const ANCHOR = Date.parse(STAMP);
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      let payload: { state_data: CampaignMapState } | undefined;
      const builder = {
        select: () => builder, eq: () => builder,
        upsert: (value: { state_data: CampaignMapState }) => { payload = value; return builder; },
        maybeSingle: async () => {
          if (table === 'parties') return { data: { created_by: 'host' }, error: null };
          mock.reads++;
          return { data: { state_data: mock.row, updated_at: STAMP }, error: null };
        },
        single: async () => {
          if (!payload || mock.writeError) return { data: null, error: { message: 'Save failed' } };
          mock.row = structuredClone(payload.state_data);
          mock.writes.push(structuredClone(payload.state_data));
          return { data: { updated_at: STAMP }, error: null };
        },
      };
      return builder;
    },
    channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
    removeChannel: vi.fn(),
    functions: { invoke: mock.invoke },
  },
}));
import { usePartyCampaignMap } from '@/hooks/use-party-campaign-map';

const initialMap = (city = false) => sanitizeCampaignMapState({
  currentLocationId: 'a', campaignMinute: 120, realMinutesPerGameHour: 1,
  ...(city ? { travelScale: 'city' } : {}),
  locations: ['a', 'b'].map((id, i) => ({ id, name: id, x: i, y: 0, discovered: true, kind: 'town' })),
  routes: [{ id: 'ab', fromLocationId: 'a', toLocationId: 'b', distanceMiles: 60, distanceSource: 'manual', terrainFactor: 1, path: [] }],
});
function pausedMap(city = false): CampaignMapState {
  const base = initialMap(city);
  const plan = planJourneyRoute(base, 'b');
  if (!plan) throw new Error('Expected test route');
  const tranche = buildJourneyTranche(base, plan);
  if (!tranche) throw new Error('Expected test tranche');
  const running = { ...trancheToTravel(tranche, plan.pace, 120, 1), startedAt: ANCHOR };
  const frozen = freezeTravel(running, ANCHOR + running.realDurationMs / 4);
  const detail = travelDetail(frozen, ANCHOR);
  return { ...base, currentLocationId: null, journeyPlan: plan, activeTravel: frozen, currentRoutePosition: { routeId: detail.routeId, progress: detail.forwardProgress } };
}
async function open() {
  const hook = renderHook(() => usePartyCampaignMap('party', 'host'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await waitFor(() => expect(hook.result.current.canWrite).toBe(true));
  return hook;
}
type ActionResult = { ok: true } | { ok: false; error: string };
beforeEach(() => {
  mock.row = initialMap(); mock.writes = []; mock.reads = 0; mock.writeError = false;
  mock.invoke.mockReset();
  mock.invoke.mockImplementation(async () => ({ data: { ok: true }, error: null }));
});
afterEach(cleanup);

describe('durable overland client launch', () => {
  it.each(['begin', 'continue', 'resume'] as const)('%s stages only once and waits for launch confirmation', async (action) => {
    if (action === 'resume') mock.row = pausedMap();
    if (action === 'continue') {
      const paused = pausedMap();
      const travel = paused.activeTravel;
      if (!travel) throw new Error('Expected travel');
      mock.row = settleTravelState({ ...paused, activeTravel: { ...travel, pausedFraction: 1 } }, ANCHOR);
    }
    let resolveLaunch: ((value: { data: unknown; error: unknown }) => void) | undefined;
    mock.invoke.mockImplementation(() => new Promise(resolve => { resolveLaunch = resolve; }));
    const { result } = await open();
    let completed = false;
    let pending: Promise<ActionResult> | undefined;
    await act(async () => {
      pending = (action === 'begin' ? result.current.startJourney('b') : action === 'continue' ? result.current.continueJourney() : result.current.resumeTravel());
      void pending.then(() => { completed = true; });
      await Promise.resolve();
    });
    expect(mock.writes).toHaveLength(1);
    expect(mock.writes[0].activeTravel?.startedAt).toBeNull();
    expect(completed).toBe(false);
    expect(mock.invoke).toHaveBeenCalledWith('party-travel-director', { body: { partyId: 'party', action: 'launch' } });
    const saved = mock.row as CampaignMapState;
    mock.row = { ...saved, activeTravel: { ...saved.activeTravel, startedAt: ANCHOR } };
    const reads = mock.reads;
    if (!resolveLaunch || !pending) throw new Error('Expected pending launch');
    let outcome: ActionResult | undefined;
    await act(async () => { resolveLaunch?.({ data: { ok: true, privatePlan: 'must never escape' }, error: null }); outcome = await pending; });
    expect(outcome).toEqual({ ok: true });
    expect(mock.reads).toBe(reads + 1);
    expect(mock.writes).toHaveLength(1);
    expect(result.current.getViewState()?.state.activeTravel?.startedAt).toBe(ANCHOR);
  });

  it.each(['response', 'exception', 'malformed'] as const)('failed %s remains paused with no clock advance or private error', async (kind) => {
    if (kind === 'exception') mock.invoke.mockRejectedValue(new Error('secret trigger'));
    else mock.invoke.mockResolvedValue(kind === 'response' ? { data: { error: 'secret trigger' }, error: { message: 'private premise' } } : { data: { planned: true }, error: null });
    const { result } = await open();
    let outcome: ActionResult | undefined;
    await act(async () => { outcome = await result.current.startJourney('b'); });
    expect(outcome?.ok).toBe(false);
    expect(JSON.stringify(outcome)).not.toMatch(/secret|trigger|premise/);
    expect(mock.invoke).toHaveBeenCalledTimes(1);
    expect(mock.writes).toHaveLength(1);
    const view = result.current.getViewState(ANCHOR + 100_000_000);
    expect(view?.paused).toBe(true);
    expect(view?.campaignMinute).toBe(120);
    expect(view?.state.journeyPlan?.destinationLocationId).toBe('b');
  });

  it('failed resume preserves the exact paused fraction, position and clock', async () => {
    const original = pausedMap(); mock.row = original;
    mock.invoke.mockResolvedValue({ data: { ok: false }, error: null });
    const { result } = await open();
    await act(async () => { expect((await result.current.resumeTravel()).ok).toBe(false); });
    expect(mock.writes[0].activeTravel).toEqual(original.activeTravel);
    expect(mock.writes[0].currentRoutePosition).toEqual(original.currentRoutePosition);
    expect(mock.writes[0].campaignMinute).toBe(120);
    expect(result.current.getViewState()?.paused).toBe(true);
  });

  it.each(['begin', 'continue', 'resume'] as const)('city %s retains two-write anchoring and never calls the director', async (action) => {
    mock.row = action === 'resume' ? pausedMap(true) : initialMap(true);
    if (action === 'continue') {
      const base = initialMap(true); const plan = planJourneyRoute(base, 'b');
      if (!plan) throw new Error('Expected city plan');
      mock.row = { ...base, journeyPlan: plan };
    }
    const { result } = await open();
    await act(async () => {
      const outcome = action === 'begin' ? await result.current.startJourney('b') : action === 'continue' ? await result.current.continueJourney() : await result.current.resumeTravel();
      expect(outcome).toEqual({ ok: true });
    });
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(mock.writes).toHaveLength(2);
    expect(mock.writes[0].activeTravel?.startedAt).toBeNull();
    expect(mock.writes[1].activeTravel?.startedAt).toBe(ANCHOR);
  });

  it('does not request launch when staging fails', async () => {
    const { result } = await open(); mock.writeError = true;
    await act(async () => { expect((await result.current.startJourney('b')).ok).toBe(false); });
    expect(mock.invoke).not.toHaveBeenCalled();
    expect(mock.writes).toHaveLength(0);
  });

  it.each(['pause', 'cancel'] as const)('%s stops movement without waiting for cleanup', async (action) => {
    const paused = pausedMap(); const travel = paused.activeTravel;
    if (!travel) throw new Error('Expected test travel');
    mock.row = { ...paused, activeTravel: { ...travel, startedAt: ANCHOR } };
    mock.invoke.mockImplementation(() => new Promise(() => {}));
    const { result } = await open();
    await act(async () => { expect(await (action === 'pause' ? result.current.pauseTravel() : result.current.cancelTravel())).toEqual({ ok: true }); });
    const view = result.current.getViewState();
    expect(view?.traveling).toBe(false);
    expect(mock.invoke).toHaveBeenCalledWith('party-travel-director', { body: { partyId: 'party', action: action === 'pause' ? 'sync' : 'cancel' } });
  });
});