// Where a campaign map is kept. The map hook (use-party-campaign-map.ts) does all the map logic
// and talks to storage only through this small interface, so the same hook serves a party's map
// (PARTY_MAP_STORE: exactly the calls it always made) and a solo campaign's map (a second store).

import { supabase } from '@/integrations/supabase/client';
import type { CampaignAtlas } from '@/lib/campaign-atlas';
import type { CampaignMapState } from '@/lib/campaign-map';

export const CAMPAIGN_MAP_STATE_TYPE = 'campaign_map';

type DbError = { message?: string; code?: string } | null;
export interface MapRowChange { deleted: boolean; stateData?: unknown; updatedAt?: string | null; commitMs?: number }
export interface AreaGuideInsert { map_id: string; scope: 'map' | 'location'; location_id: string | null; name: string; content: string; enabled: boolean }

export interface CampaignMapStore {
  /** The one user allowed to write this map (the party's original host, or the solo campaign's owner). */
  resolveHost(scopeId: string): Promise<string | null>;
  load(scopeId: string, hostUserId: string): Promise<{ data: { state_data: unknown; updated_at: string | null } | null; error: DbError }>;
  /** Live updates of the host's row. `onReady` fires once listening has started. Returns the unsubscribe. */
  subscribe(scopeId: string, hostUserId: string, onChange: (change: MapRowChange) => void, onReady: () => void): () => void;
  writeAtlas(scopeId: string, envelope: CampaignAtlas, expectedUpdatedAt: string | null): Promise<{ data: unknown; error: DbError }>;
  upsertLegacy(scopeId: string, userId: string, next: CampaignMapState): Promise<{ data: { updated_at?: string } | null; error: DbError }>;
  clear(scopeId: string, userId: string): Promise<{ error: DbError }>;
  /** Private journey planning on the server. true only on public success. */
  travel(scopeId: string, action: 'launch' | 'sync' | 'cancel'): Promise<boolean>;
  readAreaGuides(scopeId: string, mapId: string): Promise<{ data: Array<{ scope: string; location_id: string | null; name: string; content: string }> | null; error: DbError }>;
  insertAreaGuides(scopeId: string, rows: AreaGuideInsert[]): Promise<{ error: DbError }>;
}

export const PARTY_MAP_STORE: CampaignMapStore = {
  async resolveHost(partyId) {
    const { data } = await supabase.from('parties').select('created_by').eq('id', partyId).maybeSingle();
    return (data as { created_by?: string } | null)?.created_by ?? null;
  },
  async load(partyId, hostUserId) {
    return (supabase.from('party_shared_state') as any)
      .select('state_data, updated_at')
      .eq('party_id', partyId).eq('user_id', hostUserId).eq('state_type', CAMPAIGN_MAP_STATE_TYPE)
      .maybeSingle();
  },
  subscribe(partyId, hostUserId, onChange, onReady) {
    const channel = supabase
      .channel(`campaign-map:${partyId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'party_shared_state', filter: `party_id=eq.${partyId}` }, (payload: any) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { user_id?: string; state_type?: string; state_data?: unknown; updated_at?: string };
        if (row?.state_type !== CAMPAIGN_MAP_STATE_TYPE || row.user_id !== hostUserId) return; // only the host's row counts
        const commit = Date.parse(payload.commit_timestamp || '');
        onChange({
          deleted: payload.eventType === 'DELETE', stateData: row.state_data, updatedAt: row.updated_at ?? null,
          commitMs: Number.isFinite(commit) ? commit : undefined,
        });
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') onReady(); });
    return () => { supabase.removeChannel(channel); };
  },
  async writeAtlas(partyId, envelope, expectedUpdatedAt) {
    return (supabase.rpc as any)('write_campaign_atlas', { _party_id: partyId, _envelope: envelope, _expected_updated_at: expectedUpdatedAt });
  },
  async upsertLegacy(partyId, userId, next) {
    return (supabase.from('party_shared_state') as any)
      .upsert({ party_id: partyId, user_id: userId, state_type: CAMPAIGN_MAP_STATE_TYPE, state_data: next }, { onConflict: 'party_id,user_id,state_type' })
      .select('updated_at').single();
  },
  async clear(partyId, userId) {
    return (supabase.from('party_shared_state') as any)
      .delete().eq('party_id', partyId).eq('user_id', userId).eq('state_type', CAMPAIGN_MAP_STATE_TYPE);
  },
  async travel(partyId, action) {
    const { data, error } = await supabase.functions.invoke('party-travel-director', { body: { partyId, action } });
    return !error && data?.ok === true;
  },
  async readAreaGuides(partyId, mapId) {
    return (supabase.from('party_location_guides') as any)
      .select('scope, location_id, name, content').eq('party_id', partyId).eq('map_id', mapId);
  },
  async insertAreaGuides(partyId, rows) {
    return (supabase.from('party_location_guides') as any).insert(rows.map(r => ({ party_id: partyId, ...r })));
  },
};
