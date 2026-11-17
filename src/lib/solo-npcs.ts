// Solo Empyrean Live NPCs (D-38): the roster logic and its storage.
// The roster = the built-in canon cast for the campaign's era + the player's own Quick Build NPCs,
// merged with each NPC's campaign state from the solo_npcs table (attitude, memories, status).
// A canon NPC with no row yet is "unmet" with its starting attitude.
import { supabase } from '@/integrations/supabase/client';
import {
  CANON_CAST, CANON_ERAS, canonMind, clampAttitude, listedIn, presentIn,
  type CanonEra, type CastGroup, type NameEntry, type RosterMind,
} from '@/lib/empyreanCanon/castNpcs';
import type { FightChallenge, FoeKind } from '@/lib/empyrean-rules-client';

export type NpcStatus = 'met' | 'knocked_out' | 'dead' | 'hidden';
export const MAX_MEMORIES = 50;

export interface SoloNpcRow {
  id?: string;
  campaign_id: string;
  npc_key: string;
  name: string;
  custom: CustomMind | null;
  attitude: number;
  memories: string[];
  status: NpcStatus;
}

/** A Quick Build NPC as the server returns it and the table keeps it. */
export interface CustomMind {
  name: string; role: string; look: string; personality: string; voice: string; wants: string;
  facts: string[]; secrets: string[]; attitude: number;
  fight: { kind: FoeKind; challenge: FightChallenge } | null;
}

export interface RosterEntry {
  key: string;
  name: string;
  group: CastGroup | 'custom';
  custom: boolean;
  mind: RosterMind;
  attitude: number;
  memories: string[];
  /** 'unmet' = a canon character the rider hasn't met yet. */
  status: NpcStatus | 'unmet';
  /** Shown under Known before they are met (false for secret survivors). */
  listed: boolean;
  fight: { kind: FoeKind; challenge: FightChallenge } | null;
}

export function isCustomKey(key: string): boolean {
  return key.startsWith('custom-');
}

export function buildRoster(rows: SoloNpcRow[], era: CanonEra): RosterEntry[] {
  const byKey = new Map(rows.map(r => [r.npc_key, r]));
  const out: RosterEntry[] = [];
  for (const npc of CANON_CAST) {
    const row = byKey.get(npc.key);
    if (!presentIn(npc, era) && !row) continue;
    out.push({
      key: npc.key, name: npc.name, group: npc.group, custom: false, mind: canonMind(npc, era),
      attitude: row ? clampAttitude(row.attitude) : npc.attitude,
      memories: row?.memories ?? [],
      status: row?.status ?? 'unmet',
      listed: listedIn(npc, era),
      fight: npc.fight,
    });
  }
  for (const row of rows) {
    if (!isCustomKey(row.npc_key) || !row.custom) continue;
    const c = row.custom;
    out.push({
      key: row.npc_key, name: row.name, group: 'custom', custom: true,
      mind: { name: c.name, role: c.role, look: c.look, personality: c.personality, voice: c.voice, wants: c.wants, facts: c.facts ?? [], secrets: c.secrets ?? [] },
      attitude: clampAttitude(row.attitude), memories: row.memories ?? [], status: row.status, listed: true, fight: c.fight ?? null,
    });
  }
  return out;
}

/** Names to match in story text and @mentions: everyone present in this era, plus custom NPCs. */
export function rosterNameEntries(roster: RosterEntry[]): NameEntry[] {
  return roster.filter(e => e.status !== 'dead').map(e => {
    const canon = CANON_CAST.find(n => n.key === e.key);
    return { key: e.key, names: [e.name, ...(canon?.aliases ?? [])] };
  });
}

/** A new row for an NPC being met (canon) or built (custom). */
export function newRow(campaignId: string, entry: Pick<RosterEntry, 'key' | 'name' | 'attitude'>, custom: CustomMind | null = null): SoloNpcRow {
  return { campaign_id: campaignId, npc_key: entry.key, name: entry.name.slice(0, 80), custom, attitude: clampAttitude(entry.attitude), memories: [], status: 'met' };
}

/** One memory and one attitude step, applied to a row. */
export function withMemory(row: SoloNpcRow, memory: string, change: number): SoloNpcRow {
  const memories = memory && !row.memories.includes(memory) ? [...row.memories, memory].slice(-MAX_MEMORIES) : row.memories;
  return { ...row, memories, attitude: clampAttitude(row.attitude + Math.max(-1, Math.min(1, Math.round(change) || 0))) };
}

// ── the campaign's era (kept on this phone, per campaign) ──
const ERA_KEY = 'empyrean-npc-era';

export function loadEra(campaignId: string | null): CanonEra {
  try {
    const v = localStorage.getItem(`${ERA_KEY}::${campaignId ?? 'new'}`);
    return (CANON_ERAS as string[]).includes(v ?? '') ? v as CanonEra : 'fw';
  } catch { return 'fw'; }
}

export function saveEra(campaignId: string | null, era: CanonEra): void {
  try { localStorage.setItem(`${ERA_KEY}::${campaignId ?? 'new'}`, era); } catch { /* ignore */ }
}

// ── storage (table solo_npcs; owner-only) ──
// The table is newer than the generated client types, so it is reached untyped, like dragon-record.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
const defaultDb = (): Db => supabase;

function cleanRow(r: Record<string, unknown>): SoloNpcRow {
  return {
    id: String(r.id ?? ''), campaign_id: String(r.campaign_id ?? ''), npc_key: String(r.npc_key ?? ''), name: String(r.name ?? ''),
    custom: (r.custom as CustomMind | null) ?? null, attitude: clampAttitude(r.attitude),
    memories: Array.isArray(r.memories) ? (r.memories as unknown[]).filter((m): m is string => typeof m === 'string') : [],
    status: (['met', 'knocked_out', 'dead', 'hidden'] as string[]).includes(String(r.status)) ? r.status as NpcStatus : 'met',
  };
}

export async function loadRows(campaignId: string, db: Db = defaultDb()): Promise<SoloNpcRow[]> {
  const { data, error } = await db.from('solo_npcs').select('*').eq('campaign_id', campaignId);
  if (error) throw error;
  return (data ?? []).map(cleanRow);
}

/** Insert or update one NPC's row (unique per player, campaign and NPC). */
export async function saveRow(row: SoloNpcRow, db: Db = defaultDb()): Promise<SoloNpcRow> {
  const { id: _id, ...fields } = row;
  const { data, error } = await db.from('solo_npcs')
    .upsert({ ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id,campaign_id,npc_key' })
    .select('*').single();
  if (error) throw error;
  return cleanRow(data);
}

export async function deleteRow(campaignId: string, key: string, db: Db = defaultDb()): Promise<void> {
  const { error } = await db.from('solo_npcs').delete().eq('campaign_id', campaignId).eq('npc_key', key);
  if (error) throw error;
}
