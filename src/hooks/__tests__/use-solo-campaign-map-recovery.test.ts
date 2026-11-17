import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
const h = vi.hoisted(() => ({ reads: [] as Array<(value: unknown) => void>, atlas: null as any }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' } } } }), onAuthStateChange: () => ({ data: { sub: { subscription: { unsubscribe() {} } }, subscription: { unsubscribe() {} } } }) },
  from: () => { const chain: any = {}; for (const m of ['select', 'eq']) chain[m] = () => chain; chain.then = (resolve: (v: unknown) => unknown) => new Promise(r => h.reads.push(r)).then(resolve); return chain; },
} }));
vi.mock('@/hooks/use-party-campaign-map', () => ({ usePartyCampaignMap: () => ({ loading: true, rawState: {}, atlas: h.atlas, hostUserId: null, reload: vi.fn(), serverNow: () => 0 }) }));
import { useSoloCampaignMap } from '@/hooks/use-solo-campaign-map';
import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';
describe('solo guide scope', () => {
  beforeEach(() => { h.reads = []; });
  it('does not let a late old-campaign guide response replace the new campaign', async () => {
    h.atlas = buildEmpyreanStarterAtlas('fixture').atlas;
    const opts = { enabled: true, travel: async () => true, getJourneyContext: () => ({ dmContext: '' }) };
    const { rerender, result } = renderHook(({ id }) => useSoloCampaignMap({ ...opts, campaignId: id }), { initialProps: { id: 'old' } });
    await waitFor(() => expect(h.reads).toHaveLength(1));
    rerender({ id: 'new' });
    await waitFor(() => expect(h.reads).toHaveLength(2));
    const row = { map_id: h.atlas.activeMapId, scope: 'map', location_id: null, name: 'Area', enabled: true };
    await act(async () => { h.reads[1]({ data: [{ ...row, content: 'New private notes' }], error: null }); });
    expect(result.current.areaGuides()).toContain('New private notes');
    await act(async () => { h.reads[0]({ data: [{ ...row, content: 'Old private notes' }], error: null }); });
    expect(result.current.areaGuides()).toContain('New private notes');
    expect(result.current.areaGuides()).not.toContain('Old private notes');
  });
});