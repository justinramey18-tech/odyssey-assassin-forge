// The starter map for solo Empyrean campaigns: an original, app-drawn map of the Continent with
// Basgiath's grounds as a map inside it. Places come from claude/EMPYREAN_CANON.md; positions are
// approximate (canon gives no coordinates) and the player can move every pin in Setup.
// Notes are facts in our own words. No book text.

import {
  calibrationFromMapWidth, polylineMiles, sanitizeCampaignMapState, suggestStreets, yardsToMiles,
  type CampaignMapLocation, type CampaignMapRoute, type LocationKind,
} from '@/lib/campaign-map';
import { convertLegacyToAtlas, createChildMap, enterChild, type CampaignAtlas } from '@/lib/campaign-atlas';

export const CONTINENT_MAP_IMAGE = '/maps/empyrean-continent.svg';
/** Painted art of the grounds (CL-072). The older app-drawn plan stays at /maps/basgiath-grounds.svg. */
export const BASGIATH_MAP_IMAGE = '/maps/basgiath-grounds-art.webp';
export const CONTINENT_IMAGE_SIZE = { width: 1600, height: 1200 };
export const BASGIATH_IMAGE_SIZE = { width: 1448, height: 1086 };
/** Claude's call: canon gives no scale. Basgiath to Samara is "a day's flight". */
export const CONTINENT_WIDTH_MILES = 1400;
export const BASGIATH_WIDTH_YARDS = 1800;
/** Day 1, 08:00. */
export const STARTER_CAMPAIGN_MINUTE = 8 * 60;

export interface StarterPlace { id: string; name: string; kind: LocationKind; x: number; y: number; region?: string; discovered?: boolean; note: string }

export const CONTINENT_PLACES: StarterPlace[] = [
  { id: 'basgiath', name: 'Basgiath War College', kind: 'fort', x: 0.36, y: 0.42, region: 'Morraine', note: 'Navarre\'s war college, built into the side of Basgiath Mountain near the middle of the kingdom. Riders, scribes, healers and infantry all train here. The Riders Quadrant is the Citadel on the upper ridge; the wardstone lies beneath the college.' },
  { id: 'chantara', name: 'Chantara', kind: 'village', x: 0.33, y: 0.46, region: 'Morraine', note: 'The village nearest Basgiath, which supplies the college. Cadets may visit only once they are past first year.' },
  { id: 'montserrat', name: 'Montserrat', kind: 'fort', x: 0.52, y: 0.4, region: 'Morraine', note: 'A border outpost in eastern Morraine, close to the Cygnisen border. Active riders and infantry hold it; cadets come here on assignments.' },
  { id: 'chakir', name: 'Chakir', kind: 'fort', x: 0.5, y: 0.25, region: 'Northeast border', note: 'A border post watched by the Eastern Wing. Gryphon attacks along this stretch have cost civilian lives.' },
  { id: 'calldyr', name: 'Calldyr City', kind: 'city', x: 0.24, y: 0.52, region: 'Calldyr', note: 'The capital of Navarre and the seat of King Tauri. Politics, the court and the Senarium of province heads live here.' },
  { id: 'medaro-pass', name: 'Medaro Pass', kind: 'landmark', x: 0.31, y: 0.65, region: 'Tyrrendor', note: 'The one way through the Cliffs of Dralor into Tyrrendor on the ground. Whoever holds the pass holds the province\'s door.' },
  { id: 'aretia', name: 'Aretia', kind: 'city', x: 0.24, y: 0.79, region: 'Tyrrendor', discovered: false, note: 'The old capital of Tyrrendor. Navarre burned it after the rebellion; as far as the kingdom knows it is a ruin. What stands here now is a closely kept secret.' },
  { id: 'athebyne', name: 'Athebyne', kind: 'fort', x: 0.44, y: 0.74, region: 'Tyrrendor border', note: 'A remote outpost on Tyrrendor\'s border, past the reach of easy supply. It sits close to the edge of the wards.' },
  { id: 'resson', name: 'Resson', kind: 'town', x: 0.5, y: 0.78, region: 'Poromiel', note: 'A walled trading post just beyond Navarre\'s border and its wards. Goods and news cross here that the kingdom would rather not discuss.' },
  { id: 'samara', name: 'Samara', kind: 'fort', x: 0.58, y: 0.6, region: 'Southeast border', note: 'The easternmost post of the Southern Wing, where Krovla and Braevick meet. About a day\'s flight from Basgiath, and a hard posting.' },
  { id: 'zolya', name: 'Zolya', kind: 'city', x: 0.72, y: 0.42, region: 'Braevick, Poromiel', note: 'A Poromish city at the foot of the Esben Mountains and home of Cliffsbane Academy, where gryphon fliers train.' },
  { id: 'cordyn', name: 'Cordyn', kind: 'city', x: 0.76, y: 0.74, region: 'Poromiel', note: 'A wealthy Poromish city and the seat of Viscount Tecarus, a collector of rare things and next in line for Poromiel\'s throne.' },
  { id: 'draithus', name: 'Draithus', kind: 'city', x: 0.57, y: 0.85, region: 'Poromiel', note: 'A large Poromish city south of the border country, crowded with people who have fled the east.' },
  { id: 'deverelli', name: 'Deverelli', kind: 'other', x: 0.64, y: 0.935, region: 'The Isles', discovered: false, note: 'The nearest of the isle kingdoms and a neutral trading power. Magic is thin on the isles and dragons suffer there.' },
];

/** Ground roads for riders without wings. Flights ignore them. */
export const CONTINENT_ROADS: Array<[string, string, number]> = [
  ['basgiath', 'chantara', 1], ['basgiath', 'calldyr', 1.2], ['basgiath', 'montserrat', 1.3], ['montserrat', 'chakir', 1.6],
  ['calldyr', 'medaro-pass', 1.4], ['medaro-pass', 'aretia', 1.6], ['medaro-pass', 'athebyne', 1.8], ['athebyne', 'resson', 1.4],
  ['montserrat', 'samara', 1.8], ['samara', 'zolya', 2], ['resson', 'draithus', 1.4], ['draithus', 'cordyn', 1.4],
];

export const BASGIATH_PLACES: StarterPlace[] = [
  { id: 'courtyard', name: 'The Courtyard', kind: 'landmark', x: 0.54, y: 0.57, note: 'A teardrop-shaped yard inside the Citadel, big enough for the whole quadrant in formation. A stone dais stands beside the opening to the Parapet.' },
  { id: 'parapet', name: 'The Parapet', kind: 'landmark', x: 0.655, y: 0.59, note: 'A narrow stone bridge high above the ravine, with no rail, and the only opening in the Citadel wall. Every candidate crosses it on Conscription Day or falls.' },
  { id: 'rotunda', name: 'The Dragon Rotunda', kind: 'landmark', x: 0.425, y: 0.495, note: 'A domed hall with six pillars carved as dragons, one for each color. It joins the academic wing, the dorms, the commons and the gathering hall.' },
  { id: 'academic-wing', name: 'Academic Wing', kind: 'other', x: 0.39, y: 0.41, note: 'Four floors of classrooms. The Battle Brief room is here, with its great wall map of the Continent, and the sparring gym with its black mats is on the top floor.' },
  { id: 'barracks', name: 'First-Year Barracks', kind: 'other', x: 0.51, y: 0.385, note: 'Rows of beds for unbonded first-years, with no privacy. Private dorm rooms come only after a cadet bonds.' },
  { id: 'gathering-hall', name: 'Gathering Hall and Commons', kind: 'other', x: 0.4, y: 0.615, note: 'Where cadets eat, and where they talk when no leadership is listening. Rumors start and end here.' },
  { id: 'forge', name: 'The Forge', kind: 'other', x: 0.265, y: 0.465, note: 'Below the tunnel to the flight field and heated by dragonfire. Alloy is smelted here and daggers are made. It is not open to cadets.' },
  { id: 'gauntlet', name: 'The Gauntlet', kind: 'landmark', x: 0.15, y: 0.58, note: 'A near-vertical obstacle course cut into the ridge. It leads up to the flight field, and first-years must finish it before Presentation.' },
  { id: 'flight-field', name: 'The Flight Field', kind: 'landmark', x: 0.2, y: 0.28, note: 'A box canyon with peaks on three sides where dragons land and riders mount. Unbonded cadets and non-riders are not allowed here.' },
  { id: 'vale', name: 'The Vale', kind: 'region', x: 0.5, y: 0.04, note: 'The dragons\' own valley behind the college, where eggs are laid and hatchlings are kept safe. Cadets never enter it. Trespassing is a quick way to die.' },
  { id: 'infirmary', name: 'Healer Quadrant and Infirmary', kind: 'other', x: 0.84, y: 0.355, note: 'Reached from the Citadel by a covered bridge over the ravine. A long hall of beds; menders work here when the wound is worth their strength.' },
  { id: 'archives', name: 'Scribe Quadrant and the Archives', kind: 'other', x: 0.8, y: 0.555, note: 'The kingdom\'s records, kept underground by the scribes. The Archives are sealed each evening by wards that harm anyone left inside.' },
  { id: 'administration', name: 'Administration', kind: 'other', x: 0.59, y: 0.77, note: 'The command offices, looking out over the fields. The commanding general of Basgiath works here.' },
  { id: 'lake', name: 'The Lake', kind: 'landmark', x: 0.855, y: 0.775, note: 'A quiet lake below the college where cadets swim on a free day. One of the few places a conversation is hard to overhear.' },
];

const place = (p: StarterPlace): CampaignMapLocation => ({
  id: p.id, name: p.name, kind: p.kind, x: p.x, y: p.y, discovered: p.discovered !== false,
  ...(p.region ? { region: p.region } : {}), description: p.note,
});

export interface StarterGuide { mapId: string; scope: 'map' | 'location'; locationId: string | null; name: string; content: string }
export interface StarterMap { atlas: CampaignAtlas; guides: StarterGuide[]; rootMapId: string; basgiathMapId: string }

/** Build the starter atlas for one solo campaign. The rider begins in Basgiath's courtyard. */
/** Where a campaign may start on the map: Basgiath (every cadet), or an outpost a graduated rider is posted to. */
export const STARTER_START_IDS = ['basgiath', 'montserrat', 'samara', 'athebyne', 'chakir'] as const;

/**
 * The starter map. By default the rider starts inside Basgiath's grounds (in the courtyard). With
 * startLocationId set to one of the outposts, the rider starts at that place on the Continent map
 * instead; Basgiath's grounds map still exists inside it.
 */
export function buildEmpyreanStarterAtlas(campaignId: string, opts: { campaignMinute?: number; makeId?: () => string; startLocationId?: string | null } = {}): StarterMap {
  const makeId = opts.makeId ?? (() => crypto.randomUUID());
  const rootMapId = makeId();
  const basgiathMapId = makeId();
  const cal = calibrationFromMapWidth(CONTINENT_IMAGE_SIZE.width, CONTINENT_IMAGE_SIZE.height, CONTINENT_WIDTH_MILES);
  const byId = new Map(CONTINENT_PLACES.map(p => [p.id, p]));
  const start = opts.startLocationId && opts.startLocationId !== 'basgiath' && (STARTER_START_IDS as readonly string[]).includes(opts.startLocationId)
    ? opts.startLocationId : 'basgiath';
  const routes: CampaignMapRoute[] = CONTINENT_ROADS.map(([a, b, terrain]) => {
    const from = byId.get(a), to = byId.get(b);
    if (!from || !to) throw new Error(`Unknown starter road: ${a}-${b}`);
    const straight = polylineMiles([{ x: from.x, y: from.y }, { x: to.x, y: to.y }], cal) ?? 0;
    return {
      id: `road-${a}-${b}`, fromLocationId: a, toLocationId: b, distanceMiles: Math.max(1, Math.round(straight * 1.2)),
      distanceSource: 'manual', terrainFactor: terrain, path: [],
    };
  });
  const world = sanitizeCampaignMapState({
    imageUrl: CONTINENT_MAP_IMAGE, imageNaturalWidth: CONTINENT_IMAGE_SIZE.width, imageNaturalHeight: CONTINENT_IMAGE_SIZE.height,
    mapCalibration: cal, locations: CONTINENT_PLACES.map(place), routes, currentLocationId: start,
    campaignMinute: opts.campaignMinute ?? STARTER_CAMPAIGN_MINUTE, defaultPace: 'flying',
  });
  let grounds = sanitizeCampaignMapState({
    imageUrl: BASGIATH_MAP_IMAGE, imageNaturalWidth: BASGIATH_IMAGE_SIZE.width, imageNaturalHeight: BASGIATH_IMAGE_SIZE.height,
    mapCalibration: calibrationFromMapWidth(BASGIATH_IMAGE_SIZE.width, BASGIATH_IMAGE_SIZE.height, yardsToMiles(BASGIATH_WIDTH_YARDS)),
    locations: BASGIATH_PLACES.map(place), routes: [], currentLocationId: 'courtyard', travelScale: 'city', defaultPace: 'normal',
  });
  let n = 0;
  // The painted art shows the paths, so the app only draws a street when it is chosen or walked (CL-072).
  grounds = { ...grounds, routes: suggestStreets(grounds, () => `path-${++n}`, 2).map(r => ({ ...r, overlayMode: 'background' as const })) };

  let atlas: CampaignAtlas = convertLegacyToAtlas(world, campaignId, 'The Continent', rootMapId);
  const withChild = createChildMap(atlas, rootMapId, 'basgiath', {
    id: basgiathMapId, name: 'Basgiath War College', navigationMode: 'local', state: grounds, entryLocationId: 'courtyard',
  });
  if (typeof withChild === 'string') throw new Error(withChild);
  if (start === 'basgiath') {
    const entered = enterChild(withChild, basgiathMapId);
    if (typeof entered === 'string') throw new Error(entered);
    atlas = entered;
  } else {
    atlas = withChild;
  }

  const guides: StarterGuide[] = [
    { mapId: rootMapId, scope: 'map', locationId: null, name: 'The Continent', content: 'Navarre holds the west behind its wards; Poromiel lies east across the Esben Mountains; the Barrens lie beyond. Tyrrendor is Navarre\'s largest and southernmost province, walled off by the Cliffs of Dralor. Riders cross these distances on dragonback; everyone else takes days on the roads. Outposts along the border are held by active riders, and the wards weaken toward their edge.' },
    { mapId: basgiathMapId, scope: 'map', locationId: null, name: 'Basgiath War College', content: 'The college is built into the mountain. The lower levels belong to the scribes, healers, infantry and administration; the Citadel on the upper ridge is the Riders Quadrant. Riders wear black. Unbonded first-years are watched, tested and expendable; killing another cadet is allowed in the open but not in their sleep or in formation. Dragons perch on the walls and go where they please.' },
    ...CONTINENT_PLACES.map(p => ({ mapId: rootMapId, scope: 'location' as const, locationId: p.id, name: p.name, content: p.note })),
    ...BASGIATH_PLACES.map(p => ({ mapId: basgiathMapId, scope: 'location' as const, locationId: p.id, name: p.name, content: p.note })),
  ];
  return { atlas, guides, rootMapId, basgiathMapId };
}
