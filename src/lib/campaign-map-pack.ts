// Odyssey Map Pack v1: a ZIP with manifest.json, one map image, one map data file,
// optional guide texts and a README. Parsing is local and read-only: it never writes
// the live Campaign Map or the database. Anything wrong in a required part fails closed.

import JSZip from 'jszip';
import { MAX_GUIDE_CHARS } from '@/lib/gm-guides-storage';
import {
  LOCATION_KINDS, sanitizeCampaignMapState, validRealMinutesPerGameHour,
  type CampaignMapState,
} from '@/lib/campaign-map';

export const MAP_PACK_FORMAT = 'odyssey-campaign-map-pack';
export const MAP_PACK_VERSION = 1;
export const MAX_PACK_BYTES = 25 * 1024 * 1024;
export const MAX_PACK_FILES = 40;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_JSON_BYTES = 1024 * 1024;
export const MAX_TEXT_BYTES = 256 * 1024;
export const MAX_PACK_GUIDES = 12;

const IMAGE_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const TEXT_EXT = new Set(['txt', 'md']);
const ALLOWED_EXT = new Set(['json', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp']);

export interface MapPackGuideRef { name: string; file: string; customId?: string; recommendedEnabled?: boolean }
export interface MapPackManifest {
  format: typeof MAP_PACK_FORMAT;
  version: 1;
  id: string;
  name: string;
  description?: string;
  mapFile: string;
  dataFile: string;
  guides: MapPackGuideRef[];
  sha256?: Record<string, string>;
}
export interface MapPackGuide extends MapPackGuideRef { content: string; tooLarge: boolean }

export interface MapPackPreview {
  installable: boolean;
  errors: string[];
  warnings: string[];
  manifest: MapPackManifest | null;
  image: Blob | null;
  imageType: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  state: CampaignMapState | null;
  guides: MapPackGuide[];
  readme: string | null;
  summary: { locations: number; routes: number; discovered: number; unpinned: number; calibrated: boolean; startingLocation: string | null; realMinutesPerGameHour: number | null; defaultPace: string | null };
}

export type DecodeImage = (blob: Blob) => Promise<{ width: number; height: number } | null>;

/** Browser image decode (no code runs — only pixels). */
export const browserDecodeImage: DecodeImage = async (blob) => {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob);
      const out = { width: bmp.width, height: bmp.height };
      bmp.close?.();
      return out;
    }
  } catch { return null; }
  return null;
};

const extOf = (p: string) => (p.split('/').pop()?.split('.').pop() ?? '').toLowerCase();

/** Safe relative path: no absolute, no backslashes, no `..`, no empty parts. */
export function isSafePackPath(p: string): boolean {
  if (typeof p !== 'string' || !p || p.length > 200) return false;
  if (p.startsWith('/') || p.includes('\\') || /^[a-zA-Z]:/.test(p) || p.includes('\0')) return false;
  const parts = p.split('/');
  return parts.every(x => x !== '' && x !== '.' && x !== '..');
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const in01 = (v: unknown) => fin(v) && v >= 0 && v <= 1;

function parseManifest(raw: unknown, errors: string[]): MapPackManifest | null {
  if (!isObj(raw)) { errors.push('manifest.json is not a JSON object.'); return null; }
  if (raw.format !== MAP_PACK_FORMAT) errors.push(`manifest.json format must be "${MAP_PACK_FORMAT}".`);
  if (raw.version !== MAP_PACK_VERSION) errors.push('manifest.json version must be 1.');
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id) errors.push('manifest.json needs an id.');
  if (!name) errors.push('manifest.json needs a name.');
  const mapFile = typeof raw.mapFile === 'string' ? raw.mapFile : '';
  const dataFile = typeof raw.dataFile === 'string' ? raw.dataFile : '';
  if (!isSafePackPath(mapFile) || !mapFile.startsWith('map/')) errors.push('mapFile must be a safe path under map/.');
  else if (!IMAGE_EXT[extOf(mapFile)]) errors.push('mapFile must be a PNG, JPEG or WebP image.');
  if (!isSafePackPath(dataFile) || !dataFile.startsWith('map/') || extOf(dataFile) !== 'json') errors.push('dataFile must be a .json file under map/.');
  const guides: MapPackGuideRef[] = [];
  if (raw.guides !== undefined) {
    if (!Array.isArray(raw.guides)) errors.push('guides must be a list.');
    else {
      if (raw.guides.length > MAX_PACK_GUIDES) errors.push(`At most ${MAX_PACK_GUIDES} guides.`);
      raw.guides.slice(0, MAX_PACK_GUIDES).forEach((g, i) => {
        if (!isObj(g) || typeof g.name !== 'string' || !g.name.trim() || typeof g.file !== 'string') { errors.push(`Guide ${i + 1} needs a name and file.`); return; }
        if (!isSafePackPath(g.file) || !g.file.startsWith('guides/') || !TEXT_EXT.has(extOf(g.file))) { errors.push(`Guide "${g.name}" must be a .txt or .md file under guides/.`); return; }
        guides.push({ name: g.name.trim().slice(0, 120), file: g.file, ...(typeof g.customId === 'string' && g.customId.trim() ? { customId: g.customId.trim().slice(0, 80) } : {}), ...(g.recommendedEnabled === true ? { recommendedEnabled: true } : {}) });
      });
    }
  }
  let sha256: Record<string, string> | undefined;
  if (raw.sha256 !== undefined) {
    if (!isObj(raw.sha256)) errors.push('sha256 must map file paths to checksums.');
    else {
      sha256 = {};
      for (const [k, v] of Object.entries(raw.sha256)) {
        if (typeof v !== 'string' || !/^[0-9a-fA-F]{64}$/.test(v)) errors.push(`Checksum for ${k} is not a SHA-256 value.`);
        else sha256[k] = v.toLowerCase();
      }
    }
  }
  return {
    format: MAP_PACK_FORMAT, version: 1, id, name,
    ...(typeof raw.description === 'string' && raw.description.trim() ? { description: raw.description.trim().slice(0, 600) } : {}),
    mapFile, dataFile, guides, ...(sha256 ? { sha256 } : {}),
  };
}

/** Strict check of raw map data. Errors make the pack non-installable. */
export function validateMapData(raw: unknown, imageWidth: number | null, imageHeight: number | null): { errors: string[]; warnings: string[] } {
  const errors: string[] = []; const warnings: string[] = [];
  if (!isObj(raw)) return { errors: ['The map data is not a JSON object.'], warnings };
  const locs = Array.isArray(raw.locations) ? raw.locations : null;
  const routes = Array.isArray(raw.routes) ? raw.routes : [];
  if (!locs) errors.push('Map data needs a locations list.');
  if (raw.routes !== undefined && !Array.isArray(raw.routes)) errors.push('routes must be a list.');
  const ids = new Set<string>();
  (locs ?? []).forEach((l, i) => {
    if (!isObj(l) || typeof l.id !== 'string' || !l.id.trim()) { errors.push(`Location ${i + 1} has no id.`); return; }
    if (ids.has(l.id)) errors.push(`Location id "${l.id}" is used twice.`);
    ids.add(l.id);
    if (typeof l.name !== 'string' || !l.name.trim()) errors.push(`Location "${l.id}" has no name.`);
    const hasX = l.x !== null && l.x !== undefined, hasY = l.y !== null && l.y !== undefined;
    if (hasX !== hasY) errors.push(`Location "${l.id}" has only one coordinate.`);
    else if (hasX && (!in01(l.x) || !in01(l.y))) errors.push(`Location "${l.id}" coordinates must be between 0 and 1.`);
    if (l.kind !== undefined && !(LOCATION_KINDS as readonly string[]).includes(l.kind as string)) warnings.push(`Location "${l.id}" has an unknown kind; it will show as "other".`);
    if (l.overlayMode !== undefined && l.overlayMode !== 'full' && l.overlayMode !== 'pin' && l.overlayMode !== 'background') errors.push(`Location "${l.id}" overlayMode must be "full", "pin" or "background".`);
  });
  (locs ?? []).forEach((l) => {
    if (!isObj(l) || l.parentLocationId === undefined || l.parentLocationId === null) return;
    if (typeof l.parentLocationId !== 'string' || !ids.has(l.parentLocationId) || l.parentLocationId === l.id) errors.push(`Location "${String(l.id)}" points to a parent that doesn't exist.`);
  });
  const routeIds = new Set<string>();
  routes.forEach((r, i) => {
    if (!isObj(r) || typeof r.id !== 'string' || !r.id.trim()) { errors.push(`Road ${i + 1} has no id.`); return; }
    if (routeIds.has(r.id)) errors.push(`Road id "${r.id}" is used twice.`);
    routeIds.add(r.id);
    if (!ids.has(r.fromLocationId as string) || !ids.has(r.toLocationId as string)) errors.push(`Road "${r.id}" connects to a place that doesn't exist.`);
    else if (r.fromLocationId === r.toLocationId) errors.push(`Road "${r.id}" starts and ends at the same place.`);
    if (r.path !== undefined && (!Array.isArray(r.path) || r.path.some(p => !isObj(p) || !in01(p.x) || !in01(p.y)))) errors.push(`Road "${r.id}" has a point outside the map.`);
    if (r.terrainFactor !== undefined && (!fin(r.terrainFactor) || r.terrainFactor <= 0 || r.terrainFactor > 10)) errors.push(`Road "${r.id}" terrain must be above 0 and at most 10.`);
    if (r.overlayMode !== undefined && r.overlayMode !== 'full' && r.overlayMode !== 'background') errors.push(`Road "${r.id}" overlayMode must be "full" or "background".`);
    const src = r.distanceSource;
    if (src !== 'manual' && src !== 'calibrated') errors.push(`Road "${r.id}" distanceSource must be "manual" or "calibrated".`);
    if (src === 'manual' && !(fin(r.distanceMiles) && r.distanceMiles > 0)) errors.push(`Road "${r.id}" uses typed miles but has no positive distance.`);
    if (src === 'calibrated' && !isObj(raw.mapCalibration)) errors.push(`Road "${r.id}" uses the map estimate but the pack has no calibration.`);
    if (src === 'calibrated' && (!Array.isArray(r.path) || r.path.length < 2)) errors.push(`Road "${r.id}" uses the map estimate but has no traced path.`);
  });
  if (raw.currentLocationId !== undefined && raw.currentLocationId !== null && !ids.has(raw.currentLocationId as string)) errors.push('The starting location does not exist.');
  if (raw.startingLocationId !== undefined && raw.startingLocationId !== null && !ids.has(raw.startingLocationId as string)) errors.push('The starting location does not exist.');
  if (raw.realMinutesPerGameHour !== undefined && validRealMinutesPerGameHour(raw.realMinutesPerGameHour) === null) errors.push('Time speed is out of range.');
  if (raw.defaultPace !== undefined && !['slow', 'normal', 'fast'].includes(raw.defaultPace as string)) errors.push('Default pace must be slow, normal or fast.');
  if (raw.campaignMinute !== undefined && !(fin(raw.campaignMinute) && raw.campaignMinute >= 0)) errors.push('Campaign clock must be zero or more.');
  if (imageWidth && imageHeight) {
    if (raw.imageNaturalWidth !== undefined && (raw.imageNaturalWidth !== imageWidth || raw.imageNaturalHeight !== imageHeight)) errors.push(`Map data says the image is ${raw.imageNaturalWidth}×${raw.imageNaturalHeight}, but it is ${imageWidth}×${imageHeight}.`);
    const c = raw.mapCalibration;
    if (isObj(c)) {
      if (c.imageWidth !== imageWidth || c.imageHeight !== imageHeight) errors.push(`Calibration was made for a ${c.imageWidth}×${c.imageHeight} image, but this image is ${imageWidth}×${imageHeight}.`);
      if (!isObj(c.a) || !isObj(c.b) || !in01(c.a.x) || !in01(c.a.y) || !in01(c.b.x) || !in01(c.b.y) || !(fin(c.knownMiles) && c.knownMiles > 0)) errors.push('Calibration points or miles are not valid.');
    }
  }
  if (isObj(raw.activeTravel) && raw.activeTravel.startedAt !== null && raw.activeTravel.startedAt !== undefined) warnings.push('The pack had a running travel timer; it will import paused.');
  if (routeIds.size === 0 && ids.size > 1) warnings.push('No roads are included; you will need to add them.');
  return { errors, warnings };
}

/** Install-ready state: imageUrl stays blank until the included image is uploaded; travel is paused. */
export function buildInstallState(raw: unknown, imageWidth: number, imageHeight: number): CampaignMapState {
  const r = isObj(raw) ? { ...raw } : {};
  if (r.currentLocationId == null && typeof r.startingLocationId === 'string') r.currentLocationId = r.startingLocationId;
  const s = sanitizeCampaignMapState({ ...r, imageUrl: null, imageNaturalWidth: imageWidth, imageNaturalHeight: imageHeight });
  s.imageUrl = null;
  if (s.activeTravel) s.activeTravel = { ...s.activeTravel, startedAt: null, pausedFraction: s.activeTravel.pausedFraction ?? 0 };
  return s;
}

export function revokeMapPackPreview(p: MapPackPreview | null) {
  if (p?.imageUrl) URL.revokeObjectURL(p.imageUrl);
}

/** Read and check a Map Pack. Never writes anything. */
export async function parseMapPack(
  file: { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
  opts: { decodeImage?: DecodeImage; makeObjectUrl?: (b: Blob) => string | null } = {},
): Promise<MapPackPreview> {
  const errors: string[] = []; const warnings: string[] = [];
  const empty: MapPackPreview = {
    installable: false, errors, warnings, manifest: null, image: null, imageType: null, imageUrl: null, imageWidth: null, imageHeight: null,
    state: null, guides: [], readme: null,
    summary: { locations: 0, routes: 0, discovered: 0, unpinned: 0, calibrated: false, startingLocation: null, realMinutesPerGameHour: null, defaultPace: null },
  };
  if (!file.name.toLowerCase().endsWith('.zip')) { errors.push('Map Packs must be .zip files.'); return empty; }
  if (file.size > MAX_PACK_BYTES) { errors.push('That Map Pack is larger than 25 MB.'); return empty; }
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch { errors.push('That file could not be opened as a ZIP.'); return empty; }

  const entries = Object.values(zip.files).filter(f => !f.dir);
  if (entries.length > MAX_PACK_FILES) { errors.push(`Too many files (at most ${MAX_PACK_FILES}).`); return empty; }
  for (const f of entries) {
    const name = f.name;
    if (!isSafePackPath(name)) { errors.push(`Unsafe file path: ${name}`); continue; }
    if (name.split('/').some(part => part.startsWith('__MACOSX') || part === '.DS_Store')) continue;
    const ext = extOf(name);
    if (ext === 'zip') errors.push(`Nested ZIPs are not allowed: ${name}`);
    else if (!ALLOWED_EXT.has(ext)) errors.push(`File type not allowed: ${name}`);
  }
  if (Object.keys(zip.files).some(n => !isSafePackPath(n.replace(/\/$/, '')))) errors.push('The ZIP contains an unsafe folder path.');
  const manifests = entries.filter(f => f.name === 'manifest.json');
  if (manifests.length !== 1) errors.push('The pack needs exactly one manifest.json at the top level.');
  if (errors.length) return empty;

  const readBytes = async (path: string, max: number): Promise<ArrayBuffer | null> => {
    const f = zip.file(path);
    if (!f) { errors.push(`Missing file: ${path}`); return null; }
    const buf = await f.async('arraybuffer');
    if (buf.byteLength > max) { errors.push(`${path} is too large.`); return null; }
    return buf;
  };
  const text = (b: ArrayBuffer) => new TextDecoder('utf-8').decode(b);

  const mBuf = await readBytes('manifest.json', MAX_JSON_BYTES);
  if (!mBuf) return empty;
  let mRaw: unknown;
  try { mRaw = JSON.parse(text(mBuf)); } catch { errors.push('manifest.json is not valid JSON.'); return empty; }
  const manifest = parseManifest(mRaw, errors);
  if (!manifest || errors.length) return { ...empty, manifest };

  const imgBuf = await readBytes(manifest.mapFile, MAX_IMAGE_BYTES);
  const dataBuf = await readBytes(manifest.dataFile, MAX_JSON_BYTES);
  const guideBufs = await Promise.all(manifest.guides.map(g => readBytes(g.file, MAX_TEXT_BYTES)));

  // Checksums
  if (manifest.sha256) {
    for (const [path, want] of Object.entries(manifest.sha256)) {
      if (!isSafePackPath(path)) { errors.push(`Unsafe checksum path: ${path}`); continue; }
      const f = zip.file(path);
      if (!f) { errors.push(`Checksum names a missing file: ${path}`); continue; }
      const got = await sha256Hex(await f.async('arraybuffer'));
      if (got !== want) errors.push(`Checksum does not match for ${path}.`);
    }
  }

  let imageWidth: number | null = null, imageHeight: number | null = null, image: Blob | null = null;
  const imageType = IMAGE_EXT[extOf(manifest.mapFile)] ?? null;
  if (imgBuf && imageType) {
    image = new Blob([imgBuf], { type: imageType });
    const dims = await (opts.decodeImage ?? browserDecodeImage)(image);
    if (!dims || !(dims.width > 0 && dims.height > 0)) errors.push('The map image could not be read.');
    else { imageWidth = dims.width; imageHeight = dims.height; }
  }

  let dataRaw: unknown = null;
  if (dataBuf) {
    try { dataRaw = JSON.parse(text(dataBuf)); } catch { errors.push(`${manifest.dataFile} is not valid JSON.`); }
  }
  if (dataRaw !== null) {
    const v = validateMapData(dataRaw, imageWidth, imageHeight);
    errors.push(...v.errors); warnings.push(...v.warnings);
  }

  const guides: MapPackGuide[] = manifest.guides.map((g, i) => {
    const buf = guideBufs[i];
    const content = buf ? text(buf) : '';
    const tooLarge = content.length > MAX_GUIDE_CHARS;
    if (tooLarge) errors.push(`Guide "${g.name}" is longer than ${MAX_GUIDE_CHARS.toLocaleString()} characters.`);
    if (buf && !content.trim()) warnings.push(`Guide "${g.name}" is empty.`);
    return { ...g, content, tooLarge };
  });
  let readme: string | null = null;
  for (const n of ['README.md', 'README.txt']) {
    const f = zip.file(n);
    if (f) { const b = await f.async('arraybuffer'); if (b.byteLength <= MAX_TEXT_BYTES) readme = text(b); else warnings.push(`${n} is too large to show.`); break; }
  }
  const referenced = new Set(['manifest.json', manifest.mapFile, manifest.dataFile, 'README.md', 'README.txt', ...manifest.guides.map(g => g.file)]);
  const extra = entries.filter(f => !referenced.has(f.name) && !f.name.includes('__MACOSX') && !f.name.endsWith('.DS_Store'));
  if (extra.length) warnings.push(`${extra.length} extra file${extra.length === 1 ? '' : 's'} will be ignored.`);

  const state = errors.length === 0 && imageWidth && imageHeight ? buildInstallState(dataRaw, imageWidth, imageHeight) : null;
  const start = state?.currentLocationId ? state.locations.find(l => l.id === state.currentLocationId)?.name ?? null : null;
  const installable = errors.length === 0 && !!state && !!image;
  return {
    installable, errors, warnings, manifest, image, imageType,
    imageUrl: image && installable ? (opts.makeObjectUrl ?? ((b) => (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(b) : null)))(image) : null,
    imageWidth, imageHeight, state, guides, readme,
    summary: {
      locations: state?.locations.length ?? 0,
      routes: state?.routes.length ?? 0,
      discovered: state?.locations.filter(l => l.discovered).length ?? 0,
      unpinned: state?.locations.filter(l => l.x === null || l.y === null).length ?? 0,
      calibrated: !!state?.mapCalibration,
      startingLocation: start,
      realMinutesPerGameHour: state?.realMinutesPerGameHour ?? null,
      defaultPace: state?.defaultPace ?? null,
    },
  };
}
