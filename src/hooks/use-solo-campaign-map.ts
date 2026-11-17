// The campaign map for one solo Empyrean campaign. All map logic is the party map hook; this file
// only supplies where a solo map is kept (solo_campaign_maps, written through
// write_solo_campaign_atlas), installs the starter map the first time, and prepares what the DM
// is told about where the rider is.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePartyCampaignMap } from '@/hooks/use-party-campaign-map';
import type { CampaignMapStore } from '@/lib/campaign-map-store';
import { projectActive, resolveAtlasAt } from '@/lib/campaign-atlas';
import { buildDmLogisticsContext } from '@/lib/campaign-map';
import { composeLocationGuides, resolveGuideScopes, type LocationGuideRow } from '@/lib/location-guides';
import { buildEmpyreanStarterAtlas } from '@/lib/empyreanCanon/continentMap';
import { missingSoloStarterGuides, soloTravelFlags } from '@/lib/solo-map-setup';
import { toast } from 'sonner';

export const SOLO_GUIDE_TABLE = 'solo_location_guides';
const AREA_GUIDE_BUDGET = 12000;

export interface SoloMapOptions {
  enabled: boolean;
  campaignId: string | null;
  /** Server journey actions (the rules engine). */
  travel: (action: 'launch' | 'sync' | 'cancel', extra?: Record<string, unknown>) => Promise<boolean>;
  /** What the server needs to write a journey encounter while the app is closed. */
  getJourneyContext: () => { dmContext: string; dmModel?: string };
  /** Where a brand-new campaign's starter map puts the rider (default Basgiath). Read once, when the starter map is installed. */
  getStartLocationId?: () => string | null;
}

function makeSoloStore(travelRef: { current: SoloMapOptions['travel'] }, ctxRef: { current: SoloMapOptions['getJourneyContext'] }): CampaignMapStore {
  return {
    async resolveHost(campaignId) {
      const { data } = await (supabase.from('ai_dm_campaigns') as any).select('user_id').eq('id', campaignId).maybeSingle();
      return (data as { user_id?: string } | null)?.user_id ?? null;
    },
    async load(campaignId) {
      return (supabase as any).from('solo_campaign_maps').select('state_data, updated_at').eq('campaign_id', campaignId).maybeSingle();
    },
    // No live channel: this map has one writer on the phone. The server's changes (a rest, a
    // journey encounter) are picked up by reload() after each rules call.
    subscribe() { return () => {}; },
    async writeAtlas(campaignId, envelope, expectedUpdatedAt) {
      return (supabase.rpc as any)('write_solo_campaign_atlas', { _campaign_id: campaignId, _envelope: envelope, _expected_updated_at: expectedUpdatedAt });
    },
    async upsertLegacy() {
      return { data: null, error: { message: 'The map is still being set up. Try again in a moment.' } };
    },
    async clear() {
      return { error: { message: "A solo campaign's map can't be cleared, because it keeps the campaign's clock. Change it in Setup." } };
    },
    async travel(_campaignId, action) {
      return travelRef.current(action, action === 'launch' ? ctxRef.current() : {});
    },
    async readAreaGuides(campaignId, mapId) {
      return (supabase as any).from(SOLO_GUIDE_TABLE).select('scope, location_id, name, content').eq('campaign_id', campaignId).eq('map_id', mapId);
    },
    async insertAreaGuides(campaignId, rows) {
      return (supabase as any).from(SOLO_GUIDE_TABLE).insert(rows.map(r => ({ campaign_id: campaignId, ...r })));
    },
  };
}

export function useSoloCampaignMap(opts: SoloMapOptions) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setUserId(data.session?.user?.id ?? null); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id ?? null));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const travelRef = useRef(opts.travel); travelRef.current = opts.travel;
  const ctxRef = useRef(opts.getJourneyContext); ctxRef.current = opts.getJourneyContext;
  const startRef = useRef(opts.getStartLocationId); startRef.current = opts.getStartLocationId;
  const store = useMemo(() => makeSoloStore(travelRef, ctxRef), []);
  const campaignId = opts.enabled && userId ? opts.campaignId : null;
  const map = usePartyCampaignMap(campaignId, userId, store);

  // ── area guides for this campaign (small; the owner can read them) ──
  const [guideRows, setGuideRows] = useState<LocationGuideRow[]>([]);
  const scopeRef = useRef(campaignId); scopeRef.current = campaignId;
  const guideRequestRef = useRef(0);
  const reloadGuides = useCallback(async () => {
    const request = ++guideRequestRef.current;
    if (!campaignId) { setGuideRows([]); return; }
    const { data, error } = await (supabase as any).from(SOLO_GUIDE_TABLE)
      .select('id, map_id, scope, location_id, name, content, enabled').eq('campaign_id', campaignId).eq('enabled', true);
    if (scopeRef.current === campaignId && request === guideRequestRef.current && !error) setGuideRows((data || []) as LocationGuideRow[]);
  }, [campaignId]);
  useEffect(() => { setGuideRows([]); void reloadGuides(); }, [reloadGuides]);

  // ── the starter map, once per campaign ──
  const [setupRetry, setSetupRetry] = useState(0);
  const { loading, rawState, hostUserId, reload } = map;
  useEffect(() => {
    if (!campaignId || loading || !hostUserId || hostUserId !== userId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => !cancelled && scopeRef.current === campaignId;
    void (async () => {
      try {
        if (!rawState) {
          const starter = buildEmpyreanStarterAtlas(campaignId, { startLocationId: startRef.current?.() ?? null });
          const { error } = await store.writeAtlas(campaignId, starter.atlas, null);
          if (!current()) return;
          await reload();
          if (error) throw error;
          return; // the saved atlas supplies the actual map IDs on the next pass
        }
        if (!map.atlas) return;
        const { data, error } = await (supabase as any).from(SOLO_GUIDE_TABLE)
          .select('map_id, scope, location_id').eq('campaign_id', campaignId);
        if (!current()) return;
        if (error) throw error;
        const missing = missingSoloStarterGuides(campaignId, map.atlas, data || []);
        for (const g of missing) {
          if (!current()) return;
          const { error: insertError } = await (supabase as any).from(SOLO_GUIDE_TABLE).insert({
            campaign_id: campaignId, map_id: g.mapId, scope: g.scope, location_id: g.locationId, name: g.name, content: g.content, enabled: true,
          });
          if (insertError && insertError.code !== '23505') throw insertError;
        }
        if (current()) await reloadGuides();
      } catch {
        if (!current()) return;
        toast.error('Map setup is incomplete', { description: 'Missing map notes will retry shortly.' });
        timer = setTimeout(() => { if (current()) setSetupRetry(n => n + 1); }, 15000);
      }
    })();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [campaignId, loading, rawState, map.atlas, hostUserId, userId, store, reload, reloadGuides, setupRetry]);

  const { atlas, serverNow } = map;
  /** The private notes for where the rider is right now (this place, its map, and the maps above it). */
  const areaGuides = useCallback((): string => {
    if (!atlas) return '';
    const scopes = resolveGuideScopes(resolveAtlasAt(atlas, serverNow()));
    if (!scopes.ok) return '';
    return composeLocationGuides(scopes.scopes, guideRows).slice(0, AREA_GUIDE_BUDGET);
  }, [atlas, guideRows, serverNow]);
  /** The map half of the GAME FACTS block: place, journey and position, computed for this moment. */
  const mapFacts = useCallback((): string => {
    if (!atlas) return '';
    const now = serverNow();
    const resolved = resolveAtlasAt(atlas, now);
    const active = projectActive(resolved);
    const scopes = resolveGuideScopes(resolved);
    const facts = active.imageUrl || active.locations.length ? buildDmLogisticsContext(active, now) : '';
    return [scopes.ok ? `RIDER'S AREA: ${scopes.pathLabel}` : '', facts,
      'Only the app moves the rider on the map. If the story calls for travel, tell the player to use the Map; never narrate an arrival the facts above do not show.']
      .filter(Boolean).join('\n');
  }, [atlas, serverNow]);
  /** Where the rider stands, for the rules (random events differ by kind of place). */
  const place = useCallback((): { name?: string; kind?: string } | undefined => {
    const here = rawState?.locations.find(l => l.id === rawState.currentLocationId);
    return here ? { name: here.name, kind: here.kind } : undefined;
  }, [rawState]);
  const { flying, traveling } = soloTravelFlags(rawState);

  return { map, ready: !!campaignId && !!rawState, flying, traveling, areaGuides, mapFacts, place, reloadGuides };
}

export type SoloCampaignMapApi = ReturnType<typeof useSoloCampaignMap>;
