// Private area/location guides for nested campaign maps.
// Which guides apply is decided ONLY from the party's effective position in the atlas (never the
// locally viewed map). Order is deterministic, outer to inner:
//   root map guide → entrance location ancestors + entrance → child map guide → … →
//   active map's current-location ancestors + current location (not while on a road).
// Sibling/neighbor guides are never included. Rows are matched by map id AND location id.

import { MAX_TOTAL_CHARS } from '@/lib/gm-guides-storage';
import { breadcrumbs, getNode, validateAtlasGraph, type CampaignAtlas } from '@/lib/campaign-atlas';

export interface LocationGuideRow {
  id: string;
  map_id: string;
  scope: 'map' | 'location';
  location_id: string | null;
  name: string;
  content: string;
  enabled: boolean;
}

export interface GuideScope { mapId: string; mapName: string; scope: 'map' | 'location'; locationId: string | null; label: string }

export type ScopeResult = { ok: true; scopes: GuideScope[]; pathLabel: string } | { ok: false; error: string };

/** Location ancestors (outer first) then the location itself, inside one map. Errors on loops/missing links. */
function locationChain(atlas: CampaignAtlas, mapId: string, locationId: string): GuideScope[] | string {
  const node = getNode(atlas, mapId);
  if (!node) return 'A map on the party path is missing.';
  const byId = new Map(node.state.locations.map(l => [l.id, l]));
  const chain: GuideScope[] = [];
  const seen = new Set<string>();
  let cur = byId.get(locationId);
  if (!cur) return `"${node.name}" is missing the place the party is at.`;
  while (cur) {
    if (seen.has(cur.id)) return `"${node.name}" has places inside each other in a loop.`;
    seen.add(cur.id);
    chain.unshift({ mapId, mapName: node.name, scope: 'location', locationId: cur.id, label: `${node.name} › ${cur.name}` });
    if (!cur.parentLocationId) break;
    const next = byId.get(cur.parentLocationId);
    if (!next) return `"${node.name}" has a place inside a missing place.`;
    cur = next;
  }
  return chain;
}

/** Ordered guide scopes for the party's position. */
export function resolveGuideScopes(atlas: CampaignAtlas): ScopeResult {
  const graphErr = validateAtlasGraph(atlas);
  if (graphErr) return { ok: false, error: graphErr };
  const path = breadcrumbs(atlas, atlas.activeMapId);
  if (!path.length || path[0].mapId !== atlas.rootMapId || path[path.length - 1].mapId !== atlas.activeMapId) {
    return { ok: false, error: 'The party’s map path is broken.' };
  }
  const scopes: GuideScope[] = [];
  for (let i = 0; i < path.length; i++) {
    const node = getNode(atlas, path[i].mapId)!;
    scopes.push({ mapId: node.id, mapName: node.name, scope: 'map', locationId: null, label: node.name });
    const isActive = i === path.length - 1;
    let locId: string | null = null;
    if (!isActive) locId = path[i + 1].viaLocationId;
    else {
      const st = node.state;
      const onRoad = !!(st.activeTravel || st.journeyPlan || st.currentRoutePosition);
      locId = onRoad ? null : st.currentLocationId;
    }
    if (locId) {
      const chain = locationChain(atlas, node.id, locId);
      if (typeof chain === 'string') return { ok: false, error: chain };
      scopes.push(...chain);
    }
  }
  return { ok: true, scopes, pathLabel: path.map(p => p.name).join(' › ') };
}

const keyOf = (mapId: string, scope: string, locationId: string | null) => `${mapId}\u0000${scope}\u0000${locationId ?? ''}`;

/** Deterministic formatted text for the applicable enabled, nonblank rows (headers carry stable ids). */
export function composeLocationGuides(scopes: GuideScope[], rows: LocationGuideRow[]): string {
  const byKey = new Map<string, LocationGuideRow>();
  for (const r of rows) if (r.enabled && r.content.trim()) byKey.set(keyOf(r.map_id, r.scope, r.location_id), r);
  const used = new Set<string>();
  const parts: string[] = [];
  for (const s of scopes) {
    const row = byKey.get(keyOf(s.mapId, s.scope, s.locationId));
    if (!row || used.has(row.id)) continue;
    used.add(row.id);
    const where = s.scope === 'map' ? `area map ${s.mapId}` : `place ${s.locationId} on map ${s.mapId}`;
    parts.push(`### ${row.name} — ${s.label} [${where}]\n${row.content}`);
  }
  return parts.join('\n\n---\n\n');
}

/** Core guides + area guides, with the same separator as core guides. */
export function combineGuides(core: string, area: string): string {
  const c = (core || '').trim(), a = (area || '').trim();
  if (!a) return c;
  const block = `## CURRENT AREA GUIDES (where the party is now)\n\n${a}`;
  return c ? `${c}\n\n---\n\n${block}` : block;
}

export function checkGuideBudget(combined: string): string | null {
  return combined.length > MAX_TOTAL_CHARS
    ? `The guides for this area add up to ${combined.length.toLocaleString()} characters, over the ${MAX_TOTAL_CHARS.toLocaleString()} limit. Turn off or shorten a guide, then try again.`
    : null;
}
