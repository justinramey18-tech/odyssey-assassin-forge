// The solo Empyrean dragon record on the server (DECISIONS D-30, 2026-11-15).
// Table empyrean_dragons (one row per rider and dragon) and its history empyrean_dragon_events,
// saved through the apply_dragon_change database function (one atomic save + one history row).
//
// The phone keeps its copy in the existing bond state (dragonBondState.ts, scoped localStorage),
// so screens read it at once. The server is the source of truth for bond, trust and wounds:
// - connect: load or create the record (the first time, the phone's bond moves in), then the
//   server's meters replace the phone's; memories and the rest come back from the server only
//   when the phone has none (a new phone or a new campaign).
// - every meter change goes through commitDragonChange: the phone updates at once, then the
//   server save runs in order. Offline or before connect, the change waits in a queue and is
//   replayed on the server's numbers at the next connect, so nothing is lost or counted twice.
// - memories, mood and counters reach the server as a snapshot a few seconds after they change.
import { supabase } from '@/integrations/supabase/client';
import { loadBondState, saveBondState, type DragonBondState } from '@/lib/dragonBondState';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { applyMeterChange, metersFromLegacy, metersOf, normalizeMeters, type MeterChange, type MeterResult, type Meters } from '@/lib/dragon-meters';

/** The phone bond state plus the solo-only fields. */
export type SoloDragonState = DragonBondState & {
  wounds?: number;
  neglectChargedThrough?: string | null;
  /** The server record this phone copy was last loaded from. Missing after a reset elsewhere. */
  recordId?: string;
};

export interface DragonEvent {
  id: string;
  source: string;
  reason: string | null;
  bond_delta: number;
  trust_delta: number;
  wounds_delta: number;
  bond_after: number;
  trust_after: number;
  wounds_after: number;
  created_at: string;
}

interface RecordRef {
  id: string;
  version: number;
  meters: Meters;
  riderKey: string;
  dragonName: string;
}

type DragonRow = { id: string; version: number; bond: number; trust: number; wounds: number; mood: string; state: Record<string, any> | null };

interface PendingChange {
  change: MeterChange;
  source: string;
  reason: string;
  at: string;
  dragonName: string;
}

const PENDING_KEY = 'empyrean-dragon-pending';
const SNAPSHOT_DELAY_MS = 4000;
const METER_FIELDS = new Set(['bond', 'trust', 'wounds', 'ruptures']);
// The generated database types don't list the new tables until Lovable regenerates them.
const db = supabase as any;

let record: RecordRef | null = null;
/** The dragon the screen last asked to connect (changes made before the load finishes wait for it). */
let wantedDragon = '';
let chain: Promise<unknown> = Promise.resolve();
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(state: SoloDragonState) => void>();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.catch(() => undefined);
  return run;
}

/** Screens subscribe so a server load or a change made elsewhere shows at once. */
export function onDragonStateChange(fn: (state: SoloDragonState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit(state: SoloDragonState) {
  for (const fn of listeners) {
    try { fn(state); } catch { /* a listener's error never blocks the save */ }
  }
}

export function loadSoloDragonState(): SoloDragonState {
  return loadBondState() as SoloDragonState;
}

function writeLocal(state: SoloDragonState) {
  saveBondState(state);
  emit(state);
}

/** The rider: the active cloud save, or 'local' for a character that was never saved. */
export function currentRiderKey(): string {
  try { return localStorage.getItem('odyssey-active-cloud-save-id') || 'local'; } catch { return 'local'; }
}

export function connectedDragon(): { id: string; dragonName: string; meters: Meters } | null {
  return record ? { id: record.id, dragonName: record.dragonName, meters: record.meters } : null;
}

function snapshotOf(state: SoloDragonState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state)) if (!METER_FIELDS.has(k)) out[k] = v;
  out.savedAt = new Date().toISOString();
  return out;
}

const later = (a?: string | null, b?: string | null) => {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (!Number.isFinite(ta)) return Number.isFinite(tb) ? (b as string) : null;
  if (!Number.isFinite(tb)) return a as string;
  return ta >= tb ? (a as string) : (b as string);
};

function readPending(): PendingChange[] {
  try {
    const raw = getScopedItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function writePending(list: PendingChange[]) {
  try { setScopedItem(PENDING_KEY, JSON.stringify(list.slice(-50))); } catch { /* full phone: the change stays on the phone only */ }
}

function rowMeters(row: { bond: number; trust: number; wounds: number }): Meters {
  return normalizeMeters({ bond: row.bond, trust: row.trust, wounds: row.wounds });
}

async function fetchRow(riderKey: string, dragonName: string) {
  const { data, error } = await db.from('empyrean_dragons').select('*')
    .eq('rider_key', riderKey).eq('dragon_name', dragonName).maybeSingle();
  if (error) throw error;
  return data as DragonRow | null;
}

/**
 * Server meters always win. The rest (memories, habits, counters) stays as the phone has it when
 * the phone copy came from this record; otherwise (a new phone, or a new campaign or rider build
 * that reset the phone's copy) it comes back from the server.
 */
function mergeFromServer(local: SoloDragonState, row: DragonRow, created: boolean): SoloDragonState {
  const server = (row.state || {}) as Partial<SoloDragonState>;
  const phoneInSync = created || local.recordId === row.id;
  const base: SoloDragonState = !phoneInSync && Object.keys(server).length
    ? { ...local, ...(server as SoloDragonState) }
    : local;
  const meters = rowMeters(row);
  const merged: SoloDragonState = {
    ...base,
    bond: meters.bond,
    trust: meters.trust,
    wounds: meters.wounds,
    mood: (row.mood as SoloDragonState['mood']) || base.mood || 'calm',
    lastContactTimestamp: later(local.lastContactTimestamp, server.lastContactTimestamp),
    // Time apart before the record existed is never charged.
    neglectChargedThrough: created ? new Date().toISOString() : later(local.neglectChargedThrough, server.neglectChargedThrough),
    recordId: row.id,
  };
  delete (merged as unknown as Record<string, unknown>).savedAt;
  return merged;
}

/**
 * A new campaign (or a new rider build) resets the phone's bond copy to the defaults. Before
 * saving anything over the server's copy, take the dragon's memories and meters back from the
 * server, so the same dragon remembers the rider across campaigns.
 */
async function restoreIfReset() {
  if (!record) return;
  const local = loadSoloDragonState();
  if (local.recordId === record.id) return;
  const row = await fetchRow(record.riderKey, record.dragonName);
  if (!row) return;
  record = { ...record, version: row.version, meters: rowMeters(row) };
  writeLocal(mergeFromServer(local, row, false));
}

async function saveRow(meters: Meters, state: SoloDragonState, event: { source: string; reason: string; applied: Meters } | null) {
  if (!record) return null;
  const { data, error } = await db.rpc('apply_dragon_change', {
    p_dragon_id: record.id,
    p_expected_version: record.version,
    p_bond: meters.bond,
    p_trust: meters.trust,
    p_wounds: meters.wounds,
    p_mood: state.mood || null,
    p_state: snapshotOf(state),
    p_source: event ? event.source : null,
    p_reason: event ? event.reason : null,
    p_bond_delta: event ? event.applied.bond : 0,
    p_trust_delta: event ? event.applied.trust : 0,
    p_wounds_delta: event ? event.applied.wounds : 0,
  });
  if (error) throw error;
  if (!data) return null; // another device saved first
  record = { ...record, version: data.version, meters: rowMeters(data) };
  return data;
}

/**
 * Apply one change on the server's own numbers and save it. A version clash (another device)
 * reloads the row and tries again, up to 3 times. Returns the server's meters after the save.
 */
async function pushChange(p: PendingChange): Promise<Meters | null> {
  if (!record) return null;
  await restoreIfReset();
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = applyMeterChange(record.meters, p.change);
    const saved = await saveRow(result.meters, loadSoloDragonState(), { source: p.source, reason: p.reason, applied: result.applied });
    if (saved) return record.meters;
    const row = await fetchRow(record.riderKey, record.dragonName);
    if (!row) return null;
    record = { ...record, id: row.id, version: row.version, meters: rowMeters(row) };
  }
  return null;
}

/** Make the phone's meters match the server's (after a save or a load). */
function adoptServerMeters(meters: Meters) {
  const state = loadSoloDragonState();
  if (state.bond === meters.bond && state.trust === meters.trust && (state.wounds ?? 0) === meters.wounds) return;
  writeLocal({ ...state, bond: meters.bond, trust: meters.trust, wounds: meters.wounds });
}

async function flushPending() {
  if (!record) return;
  const list = readPending();
  if (!list.length) return;
  const keep: PendingChange[] = [];
  for (const p of list) {
    if (p.dragonName && p.dragonName !== record.dragonName) { keep.push(p); continue; }
    try {
      const after = await pushChange(p);
      if (!after) keep.push(p);
    } catch {
      keep.push(p);
    }
  }
  writePending(keep);
  adoptServerMeters(record.meters);
}

/**
 * Load (or create) the dragon's record and make the phone match it. Call when the solo
 * Empyrean screen opens with a bonded dragon, and again after a character switch.
 * Returns the phone state after the load, or null when there is no dragon or no connection.
 */
export function connectDragonRecord(opts: { dragonName: string; riderName?: string }): Promise<SoloDragonState | null> {
  const dragonName = (opts.dragonName || '').trim();
  wantedDragon = dragonName;
  if (!dragonName) { record = null; return Promise.resolve(null); }
  return enqueue(async () => {
    const riderKey = currentRiderKey();
    try {
      let row = await fetchRow(riderKey, dragonName);
      const local = loadSoloDragonState();
      let created = false;
      if (!row) {
        const m = metersFromLegacy(local);
        const ins = await db.from('empyrean_dragons').insert({
          rider_key: riderKey,
          dragon_name: dragonName,
          rider_name: opts.riderName || null,
          bond: m.bond,
          trust: m.trust,
          wounds: m.wounds,
          mood: local.mood || 'calm',
          state: snapshotOf(local),
        }).select('*').single();
        if (ins.error) {
          // Another device created it a moment ago.
          if (ins.error.code !== '23505') throw ins.error;
          row = await fetchRow(riderKey, dragonName);
        } else {
          row = ins.data;
          created = true;
          // The phone's numbers already include any change waiting in the queue: don't count it twice.
          writePending(readPending().filter(p => p.dragonName && p.dragonName !== dragonName));
          await db.from('empyrean_dragon_events').insert({
            dragon_id: ins.data.id,
            source: 'start',
            reason: 'Moved from this phone',
            bond_after: m.bond,
            trust_after: m.trust,
            wounds_after: m.wounds,
          });
        }
      }
      if (!row) return null;
      record = { id: row.id, version: row.version, meters: rowMeters(row), riderKey, dragonName };

      writeLocal(mergeFromServer(local, row, created));
      await flushPending();
      if (created) scheduleDragonSnapshot();
      return loadSoloDragonState();
    } catch (e) {
      console.warn('[DragonRecord] connect failed; the bond stays on this phone for now', e);
      record = null;
      return null;
    }
  });
}

/**
 * One meter change. The phone updates at once (and screens are told); the server save follows
 * in order. `edit` can change other fields in the same step (mood, memories, contact time).
 */
export function commitDragonChange(
  change: MeterChange,
  source: string,
  reason: string,
  edit?: (state: SoloDragonState) => SoloDragonState,
): MeterResult & { state: SoloDragonState } {
  const current = loadSoloDragonState();
  const result = applyMeterChange(metersOf(current), change);
  const base = edit ? edit(current) : current;
  const next: SoloDragonState = { ...base, bond: result.meters.bond, trust: result.meters.trust, wounds: result.meters.wounds };
  writeLocal(next);

  const nothing = !result.applied.bond && !result.applied.trust && !result.applied.wounds;
  if (nothing && !edit) return { ...result, state: next };

  const pending: PendingChange = { change, source, reason: String(reason || '').slice(0, 300), at: new Date().toISOString(), dragonName: record?.dragonName ?? wantedDragon };
  if (!record) {
    if (!nothing) writePending([...readPending(), pending]);
    return { ...result, state: next };
  }
  void enqueue(async () => {
    try {
      const after = nothing ? null : await pushChange(pending);
      if (nothing) {
        if (!record) return;
        await saveRow(record.meters, loadSoloDragonState(), null);
      } else if (!after) {
        writePending([...readPending(), pending]);
      } else {
        adoptServerMeters(after);
      }
    } catch (e) {
      console.warn('[DragonRecord] save failed; kept for the next connect', e);
      if (!nothing) writePending([...readPending(), pending]);
    }
  });
  return { ...result, state: next };
}

/**
 * Save the phone's non-meter state (memories, mood, habits, counters, contact time) to the
 * server a few seconds after it changes. Meters are never written from here.
 */
export function scheduleDragonSnapshot(): void {
  if (!record) return;
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    void enqueue(async () => {
      if (!record) return;
      try {
        await restoreIfReset();
        for (let attempt = 0; attempt < 3; attempt++) {
          if (await saveRow(record.meters, loadSoloDragonState(), null)) return;
          const row = await fetchRow(record.riderKey, record.dragonName);
          if (!row) return;
          record = { ...record, version: row.version, meters: rowMeters(row) };
        }
      } catch (e) {
        console.warn('[DragonRecord] snapshot failed', e);
      }
    });
  }, SNAPSHOT_DELAY_MS);
}

/** Change phone-only fields (mood, memories, contact time) and schedule the snapshot. */
export function updateDragonState(edit: (state: SoloDragonState) => SoloDragonState): SoloDragonState {
  const next = edit(loadSoloDragonState());
  writeLocal(next);
  scheduleDragonSnapshot();
  return next;
}

/** The newest history entries for the connected dragon. */
export async function loadDragonHistory(limit = 60): Promise<DragonEvent[]> {
  if (!record) return [];
  const { data, error } = await db.from('empyrean_dragon_events').select('*')
    .eq('dragon_id', record.id).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as DragonEvent[];
}

/** Resolves when every queued save so far has finished (or failed). */
export function dragonSavesSettled(): Promise<unknown> {
  return chain;
}

/** Test hook: forget the connection and the save queue. */
export function __resetDragonRecordForTests() {
  record = null;
  wantedDragon = '';
  chain = Promise.resolve();
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = null;
  listeners.clear();
}
