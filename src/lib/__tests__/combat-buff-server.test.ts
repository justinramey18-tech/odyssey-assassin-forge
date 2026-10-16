// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import * as R from '../../../supabase/functions/npc-combat/rules.ts';
import * as S from '../../../supabase/functions/npc-combat/skills.ts';
import * as M from '../../../supabase/functions/npc-combat/minigames.ts';
import * as DU from '../../../supabase/functions/npc-combat/duel.ts';

const now = Date.parse('2026-10-16T18:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const until = (seconds: number) => new Date(now + seconds * 1000).toISOString();
const ac = { kind: 'ac_bonus', amount: 2, durationSeconds: 60 };
const effect = (kind: 'ac_bonus' | 'attack_bonus', amount: number, spell = 'shield') => ({ kind, amount, spell, until: until(60) });

// Exercise the actual deploy-local handler, with no network, auth sessions or live rows.
const source = readFileSync('supabase/functions/npc-combat/index.ts', 'utf8')
  .replace(/^import .*;\n/gm, '').split('Deno.serve(async')[0];
const code = transformSync(source, { loader: 'ts', target: 'es2022' }).code;
function fixture() {
  const fight = { id: id(1), party_id: id(2), status: 'active', started_by: id(3), paused_at: null, pause_kind: null, paused_until: null };
  const player = (n: number) => ({ id: id(n), fight_id: fight.id, party_id: fight.party_id, kind: 'player', user_id: id(n + 100), name: `Player ${n}`, hp: 30, max_hp: 40, ac: 12, status: 'up', action_seq: 0, last_seen_at: until(0), last_action_at: null, combat_effects: [], temp_hp: 0, temp_hp_source: null, temp_hp_until: null, resolve: 0, perks: [], minigame: {} });
  const caster = player(4), ally = player(5);
  const tables: Record<string, Array<Record<string, any>>> = {
    parties: [{ id: fight.party_id, created_by: caster.user_id }],
    party_fights: [fight], party_fight_combatants: [caster, ally], party_fight_events: [],
    party_members: [{ party_id: fight.party_id, user_id: caster.user_id, character_name: caster.name, character_status: { currentHP: 30, maxHP: 40 } }],
    party_round_chat: [], party_character_deaths: [],
  };
  const db = { from(table: string) {
    let filters: Array<(r: any) => boolean> = [], patch: any = null, inserts: any[] | null = null, one = false, limit = Infinity;
    const q: any = {
      select: () => q, eq: (k: string, v: any) => { filters.push(r => r[k] === v); return q; },
      neq: (k: string, v: any) => { filters.push(r => r[k] !== v); return q; },
      in: (k: string, v: any[]) => { filters.push(r => v.includes(r[k])); return q; },
      is: (k: string, v: any) => { filters.push(r => (r[k] ?? null) === v); return q; },
      limit: (n: number) => { limit = n; return q; }, order: () => q,
      maybeSingle: () => { one = true; return q; }, update: (p: any) => { patch = p; return q; },
      insert: (p: any) => { inserts = Array.isArray(p) ? p : [p]; return q; },
      then(resolve: any) {
        let rows = (tables[table] ?? []).filter(r => filters.every(f => f(r))).slice(0, limit);
        if (patch) for (const r of rows) Object.assign(r, structuredClone(patch));
        if (inserts) { rows = inserts.map(r => ({ id: id(1000 + tables[table].length), ...r })); tables[table].push(...rows); }
        return Promise.resolve({ data: structuredClone(one ? rows[0] ?? null : rows), error: null }).then(resolve);
      },
    }; return q;
  } };
  const api = runInNewContext(code + '\n({ handle, expireEffects, resumeFight, damagePlayer, takeAttackBonus, effectiveAc })', { R, S, M, DU, crypto, console, Date, setTimeout, Response });
  const cast = (card: any, extra: any = {}) => api.handle(db, caster.user_id, { action: 'cast_card', fightId: fight.id, targetId: ally.id, card: { action: 'Shield', resolve: 'buff', combatEffects: [ac], ...card }, ...extra }, now);
  return { api, db, tables, fight, caster, ally, cast };
}

describe('server-authoritative support cards', () => {
  it('applies AC, attack and temporary HP without changing ordinary HP', async () => {
    const f = fixture();
    await f.cast({ combatEffects: [ac, { kind: 'attack_bonus', amount: 3, durationSeconds: 60 }, { kind: 'temporary_hp', amount: 10, durationSeconds: 60 }] });
    expect(f.api.effectiveAc(f.ally, now)).toBe(14);
    expect(f.ally.hp).toBe(30); expect(f.ally.temp_hp).toBe(10);
    expect(await f.api.takeAttackBonus(f.db, f.ally, now)).toBe(3);
    expect(await f.api.takeAttackBonus(f.db, f.ally, now)).toBe(0);
  });
  it.each([null, [], [{ ...ac, amount: 31 }], [{ ...ac, amount: NaN }], [{ ...ac, durationSeconds: 86401 }], [{ ...ac, kind: 'regeneration' }], [ac, ac]])('rejects invalid metadata before claiming an action or touching HP: %j', async raw => {
    const f = fixture(); await expect(f.cast({ combatEffects: raw })).rejects.toThrow();
    expect(f.caster.action_seq).toBe(0); expect(f.ally.hp).toBe(30); expect(f.ally.temp_hp).toBe(0);
    expect(f.tables.party_fight_events).toHaveLength(0);
  });
  it.each(['enemy', 'self', 'all'])('rejects unsupported target kinds: %s', async targetKind => {
    const f = fixture(); await expect(f.cast({ targetKind })).rejects.toThrow(); expect(f.caster.action_seq).toBe(0);
  });
  it('rejects unsupported target counts, dead targets and ended fights', async () => {
    const f = fixture(); await expect(f.cast({}, { targetIds: [f.caster.id] })).rejects.toThrow();
    f.ally.status = 'dead'; await expect(f.cast({})).rejects.toThrow();
    f.ally.status = 'up'; f.fight.status = 'ended'; await expect(f.cast({})).rejects.toThrow();
    expect(f.caster.action_seq).toBe(0);
  });
  it('keeps strongest same-type bonus, allows different types, refreshes without stacking', () => {
    let effects = R.refreshCombatEffect([], effect('ac_bonus', 4), now);
    effects = R.refreshCombatEffect(effects, effect('ac_bonus', 2, 'other'), now);
    effects = R.refreshCombatEffect(effects, { ...effect('ac_bonus', 4), until: until(120) }, now);
    effects = R.refreshCombatEffect(effects, effect('attack_bonus', 3), now);
    expect(effects).toHaveLength(3); expect(R.combatBonus(effects, 'ac_bonus', now)).toBe(4);
    expect(R.combatBonus(effects, 'ac_bonus', now + 60_000)).toBe(4);
    expect(R.combatBonus(effects, 'ac_bonus', now + 120_000)).toBe(0);
  });
  it('absorbs temporary HP first and never adds it to ordinary HP', async () => {
    const f = fixture(); f.ally.temp_hp = 10;
    const first = await f.api.damagePlayer(f.db, f.ally, 7, now, false);
    expect(first.lost).toBe(0); expect(f.ally.hp).toBe(30); expect(f.ally.temp_hp).toBe(3);
    const second = await f.api.damagePlayer(f.db, f.ally, 8, now, false);
    expect(second.lost).toBe(5); expect(f.ally.hp).toBe(25); expect(f.ally.temp_hp).toBe(0);
  });
  it('expires effects once, clears fight temporary HP and preserves HP', async () => {
    const f = fixture(); await f.cast({ combatEffects: [ac, { kind: 'temporary_hp', amount: 10, durationSeconds: 60 }] });
    await f.api.expireEffects(f.db, f.fight, now + 60_000);
    const count = f.tables.party_fight_events.length;
    await f.api.expireEffects(f.db, f.fight, now + 60_000);
    expect(f.tables.party_fight_events).toHaveLength(count); expect(f.ally.combat_effects).toEqual([]);
    expect(f.ally.temp_hp).toBe(0); expect(f.ally.hp).toBe(30);
  });
  it('freezes expiry while paused and shifts it by exactly the pause duration', async () => {
    const f = fixture(); await f.cast({ combatEffects: [ac, { kind: 'temporary_hp', amount: 10, durationSeconds: 60 }] });
    f.fight.status = 'paused'; f.fight.paused_at = until(30) as any;
    await f.api.expireEffects(f.db, f.fight, now + 90_000); expect(f.ally.temp_hp).toBe(10);
    await f.api.resumeFight(f.db, { ...f.fight }, f.caster.user_id, now + 90_000);
    expect(f.ally.temp_hp_until).toBe(until(120));
    expect(R.combatBonus(f.ally.combat_effects, 'ac_bonus', now + 119_000)).toBe(2);
  });
  it('ignores expired attack bonuses and clears support on ended fights', async () => {
    const f = fixture(); f.ally.combat_effects = [effect('attack_bonus', 3)] as any;
    expect(await f.api.takeAttackBonus(f.db, f.ally, now + 60_000)).toBe(0);
    f.fight.status = 'ended'; await f.api.expireEffects(f.db, f.fight, now); expect(f.ally.combat_effects).toEqual([]);
  });
  it('acknowledges only the caller’s inbox entries and retries idempotently', async () => {
    const f = fixture(); f.tables.party_fight_events.push({ id: id(20), target_user_id: f.caster.user_id, temp_hp_delta: 10, applied_at: null }, { id: id(21), target_user_id: f.ally.user_id, temp_hp_delta: 10, applied_at: null });
    const req = { action: 'ack', eventIds: [id(20), id(21)] };
    await f.api.handle(f.db, f.caster.user_id, req, now);
    await f.api.handle(f.db, f.caster.user_id, req, now + 1000);
    expect(f.tables.party_fight_events[0].applied_at).toBe(until(0)); expect(f.tables.party_fight_events[1].applied_at).toBeNull();
  });
});