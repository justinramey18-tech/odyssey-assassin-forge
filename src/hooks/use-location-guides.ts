// Request-time private area guides for the party GM. Memory-only: nothing is cached across requests
// or written to storage, and nothing here is handed to ordinary player props, broadcasts or logs.

import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CAMPAIGN_MAP_STATE_TYPE, buildDmLogisticsContext } from '@/lib/campaign-map';
import { isAtlasEnvelope, parseAtlas, projectActive, resolveAtlasAt, type CampaignAtlas } from '@/lib/campaign-atlas';
import {
  checkGuideBudget, combineGuides, composeLocationGuides, resolveGuideScopes, type LocationGuideRow,
} from '@/lib/location-guides';

export type AreaContextResult =
  | { ok: true; guides: string; mapFacts: string | null; pathLabel: string | null }
  | { ok: false; error: string };

const MAX_TRIES = 3;

export function useLocationGuides(opts: {
  partyId: string | null | undefined;
  hostUserId: string | null | undefined;
  currentUserId: string | null | undefined;
  serverNow: () => number;
  coreGuides: string;
}) {
  const { partyId, hostUserId, currentUserId } = opts;
  const scopeKey = `${currentUserId ?? ''}|${partyId ?? ''}|${hostUserId ?? ''}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const seqRef = useRef(0);

  // Account/party/host change: invalidate anything in flight.
  useEffect(() => { seqRef.current++; }, [scopeKey]);
  useEffect(() => {
    const onFocus = () => { seqRef.current++; };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const readAtlas = useCallback(async (): Promise<{ ok: true; atlas: CampaignAtlas | null; legacyFacts: string | null } | { ok: false; error: string }> => {
    const { partyId: p, hostUserId: h, serverNow } = optsRef.current;
    const { data, error } = await (supabase.from('party_shared_state') as any)
      .select('state_data').eq('party_id', p).eq('user_id', h).eq('state_type', CAMPAIGN_MAP_STATE_TYPE).maybeSingle();
    if (error) return { ok: false, error: 'Could not read the campaign map. Try again.' };
    const raw = data?.state_data;
    if (!raw || !isAtlasEnvelope(raw)) return { ok: true, atlas: null, legacyFacts: null };
    const parsed = parseAtlas(raw);
    if (!parsed.ok) return { ok: false, error: `The campaign map is damaged: ${parsed.error}` };
    void serverNow;
    return { ok: true, atlas: parsed.value, legacyFacts: null };
  }, []);

  /** Resolve once per GM request, before anything is consumed or posted. */
  const prepare = useCallback(async (): Promise<AreaContextResult> => {
    const seq = ++seqRef.current;
    const scope = scopeRef.current;
    const stale = () => scope !== scopeRef.current;
    const { partyId: p, hostUserId: h, serverNow, coreGuides } = optsRef.current;
    if (!p || !h) return { ok: true, guides: '', mapFacts: null, pathLabel: null };

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const first = await readAtlas();
      if (stale()) return { ok: false, error: 'The party changed. Try again.' };
      if (!first.ok) return first;
      if (!first.atlas) return { ok: true, guides: '', mapFacts: null, pathLabel: null }; // legacy map: no scoped guides

      const atlas = resolveAtlasAt(first.atlas, serverNow());
      const scopes = resolveGuideScopes(atlas);
      if (!scopes.ok) return { ok: false, error: `Can't tell which area the party is in: ${scopes.error}` };

      const { data: allowed, error: authErr } = await supabase.rpc('can_read_party_location_guides', { _party_id: p });
      if (stale()) return { ok: false, error: 'The party changed. Try again.' };
      if (authErr) return { ok: false, error: 'Could not check access to the area guides. Try again.' };
      if (allowed !== true) return { ok: false, error: 'Only the host or a co-host can run the DM while area guides are in use.' };

      const mapIds = [...new Set(scopes.scopes.map(s => s.mapId))];
      const { data: rows, error: rowErr } = await (supabase.from('party_location_guides') as any)
        .select('id, map_id, scope, location_id, name, content, enabled')
        .eq('party_id', p).eq('enabled', true).in('map_id', mapIds);
      if (stale()) return { ok: false, error: 'The party changed. Try again.' };
      if (rowErr) return { ok: false, error: 'Could not load the area guides. Try again.' };

      // Confirm the map didn't move while we were reading.
      const second = await readAtlas();
      if (stale()) return { ok: false, error: 'The party changed. Try again.' };
      if (!second.ok) return second;
      if (!second.atlas || second.atlas.revision !== first.atlas.revision) continue;
      if (seq !== seqRef.current && attempt === MAX_TRIES - 1) break;

      const area = composeLocationGuides(scopes.scopes, (rows || []) as LocationGuideRow[]);
      const budgetErr = checkGuideBudget(combineGuides(coreGuides, area));
      if (budgetErr) return { ok: false, error: budgetErr };
      const active = projectActive(atlas);
      const facts = active.imageUrl || active.locations.length ? buildDmLogisticsContext(active, serverNow()) : '';
      const mapFacts = [`PARTY AREA: ${scopes.pathLabel}`, facts].filter(Boolean).join('\n');
      return { ok: true, guides: area, mapFacts, pathLabel: scopes.pathLabel };
    }
    return { ok: false, error: 'The map changed while the DM was getting ready. Try again.' };
  }, [readAtlas]);

  return { prepare };
}
