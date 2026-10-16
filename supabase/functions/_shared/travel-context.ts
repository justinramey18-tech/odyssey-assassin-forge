import { object, roadGuideScopes, text, type Journey } from './travel-planning.ts';
const cap = (items: string[], n = 8) => [...items.slice(0, n), ...(items.length > n ? [`(+${items.length - n} more)`] : [])];
const time = (m: number) => `Day ${Math.floor(m / 1440) + 1}, ${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

function roster(rows: any[]): string[] {
  return rows.map(r => {
    const c = object(r.character_status), name = text(r.character_name || c.characterName || c.name, 60);
    if (!name) return '';
    const parts = [text(c.race || c.species, 40), text(c.className || c.characterClass, 40),
      Number.isFinite(Number(c.level)) ? `level ${Math.trunc(Number(c.level))}` : '',
      text(c.appearance || c.description, 220), text(c.backstory, 360) ? `[BACKSTORY START] ${text(c.backstory, 360)} [BACKSTORY END]` : ''].filter(Boolean);
    const gear = (Array.isArray(c.equippedGear) ? c.equippedGear : []).map((g: any) => text(typeof g === 'string' ? g : g?.name, 40)).filter(Boolean);
    if (gear.length) parts.push(`gear: ${cap(gear).join(', ')}`);
    return `- ${name}${parts.length ? `: ${parts.join('; ')}` : ''}`;
  }).filter(Boolean);
}

function routeContext(j: Journey): string[] {
  const names = new Map((j.state.locations || []).map((l: any) => [l.id, text(l.name, 80)]));
  return cap(j.remaining.map(r => `- ${names.get(r.leg.fromLocationId) || 'Unknown'} to ${names.get(r.leg.toLocationId) || 'Unknown'}: ${r.miles.toFixed(1)} mi remaining of ${r.fullMiles.toFixed(1)} mi; terrain x${Number.isFinite(r.route.terrainFactor) ? r.route.terrainFactor : 1}${text(r.route.description, 260) ? `; ${text(r.route.description, 260)}` : ''}`), 12);
}

function block(title: string, rows: string[], total = 7000): string {
  return rows.length ? `## ${title}\n${rows.join('\n').slice(0, total)}` : '';
}

export async function travelContext(db: any, partyId: string, hostId: string, j: Journey) {
  const [guides, shared, members, history] = await Promise.all([
    db.from('gm_guides').select('name, content').eq('user_id', hostId).eq('mode', 'party').eq('enabled', true).order('created_at').limit(8),
    db.from('party_shared_state').select('state_type, state_data').eq('party_id', partyId).eq('user_id', hostId).in('state_type', ['dm_session', 'party_memory_anchors', 'quest_flags']),
    db.from('party_members').select('character_name, character_status').eq('party_id', partyId).order('joined_at').limit(8),
    db.from('party_dm_messages').select('role, content, is_afk_marker').eq('party_id', partyId).eq('role','assistant').is('team',null).order('created_at', { ascending: false }).limit(8),
  ]);
  if (guides.error || shared.error || members.error || history.error) throw new Error('Context read failed');
  const byType = new Map<string, Record<string, any>>((shared.data || []).map((r: any) => [r.state_type, object(r.state_data)]));
  const scopes = roadGuideScopes(j.envelope);
  let areaGuides: string[] = [];
  if (scopes.length) {
    const { data, error } = await db.from('party_location_guides').select('id, map_id, scope, location_id, name, content')
      .eq('party_id', partyId).in('map_id', [...new Set(scopes.map(s => s.mapId))]).eq('enabled', true);
    if (error) throw new Error('Guide read failed');
    const used = new Set<string>();
    areaGuides = scopes.flatMap(s => {
      const g = (data || []).find((r: any) => r.map_id === s.mapId && r.scope === s.scope && (r.location_id ?? null) === s.locationId);
      if (!g || used.has(g.id) || !text(g.content, 1)) return [];
      used.add(g.id); return [`### ${text(g.name, 100)}\n${text(g.content, 2500)}`];
    });
  }
  const anchors = byType.get('party_memory_anchors')?.anchors;
  const quests = byType.get('quest_flags');
  const dest = (j.state.locations || []).find((l: any) => l.id === j.plan.destinationLocationId);
  const recent = (history.data || []).filter((m: any) => !m.is_afk_marker && typeof m.content === 'string').reverse()
    .map((m: any) => `DM: ${text(m.content.replace(/<!--WHISPER:[\s\S]*?<!--\/WHISPER:[^>]*-->/gi,'').replace(/\[WHISPER[^\]]*\][\s\S]*?\[\/WHISPER[^\]]*\]/gi,''), 600)}`);
  const input = [
    `## JOURNEY\nMap: ${j.name || 'World'}\nDestination: ${text(dest?.name, 100) || 'Unknown destination'}\nPace: ${j.plan.pace}\nCampaign time: ${time(Math.max(0, j.campaignMinute))}${j.remaining.length ? `\nRemaining distance: ${j.remainingMiles.toFixed(1)} miles` : ''}`,
    block('REMAINING ROADS', routeContext(j)),
    block('PARTY', roster(members.data || [])),
    text(byType.get('dm_session')?.campaignSummary, 2500) ? `## CAMPAIGN SUMMARY\n${text(byType.get('dm_session')?.campaignSummary, 2500)}` : '',
    block('RECENT PARTY DM NARRATIVE', recent, 4000),
    block('ENABLED GM GUIDES', (guides.data || []).map((g: any) => `### ${text(g.name, 100)}\n${text(g.content, 2500)}`), 12000),
    block('MEMORY ANCHORS', Array.isArray(anchors) ? cap(anchors.map((a: any) => typeof a === 'string' ? text(a,300) : `${text(a?.key,80)}: ${text(a?.value || a?.text || a?.content,300)}`).filter(Boolean), 12) : [], 3000),
    quests && Object.keys(quests).length ? `## QUEST AND WORLD STATE\n${JSON.stringify(quests).slice(0, 3000)}` : '',
    block('ROAD-APPLICABLE AREA GUIDES', areaGuides, 8000),
  ].filter(Boolean).join('\n\n');

  return { input, session: byType.get('dm_session') || {} };
}
