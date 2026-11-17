import type { CampaignAtlas } from '@/lib/campaign-atlas';
import { BASGIATH_MAP_IMAGE, CONTINENT_MAP_IMAGE, buildEmpyreanStarterAtlas, type StarterGuide } from '@/lib/empyreanCanon/continentMap';

export type GuideIdentity = { map_id: string; scope: string; location_id: string | null };
export function missingSoloStarterGuides(campaignId: string, atlas: CampaignAtlas, rows: GuideIdentity[]): StarterGuide[] {
  const root = atlas.maps.find(m => m.state.imageUrl === CONTINENT_MAP_IMAGE);
  const grounds = atlas.maps.find(m => m.state.imageUrl === BASGIATH_MAP_IMAGE || m.state.imageUrl === '/maps/basgiath-grounds.svg');
  if (!root || !grounds) return [];
  const ids = [root.id, grounds.id];
  let i = 0;
  const starter = buildEmpyreanStarterAtlas(campaignId, { makeId: () => ids[i++] ?? crypto.randomUUID() });
  return starter.guides.filter(g => !rows.some(r => r.map_id === g.mapId && r.scope === g.scope && r.location_id === g.locationId))
    .filter(g => g.scope === 'map' || atlas.maps.find(m => m.id === g.mapId)?.state.locations.some(l => l.id === g.locationId));
}

export function soloTravelFlags(state: { activeTravel?: { startedAt: number | null; pace?: string } } | null) {
  const t = state?.activeTravel;
  const traveling = !!t && t.startedAt !== null && Number.isFinite(t.startedAt);
  return { traveling, flying: traveling && t?.pace === 'flying' };
}