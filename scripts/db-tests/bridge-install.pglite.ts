// Isolated database test for the connector area installer (drizzle/migrations/0027).
// Runs against an in-memory PGlite Postgres with SYNTHETIC data only — never the live database.
//
// Run (PGlite is not a project dependency; install it in a temp folder):
//   mkdir -p /tmp/pgl && (cd /tmp/pgl && bun add @electric-sql/pglite)
//   NODE_PATH=/tmp/pgl/node_modules bun scripts/db-tests/bridge-install.pglite.ts
//
// Known gap: PGlite is single-connection, so truly concurrent transactions cannot be raced here.
// Concurrency safety rests on the party row lock + receipt uniqueness (see docs/bridge-campaign-install.md).

import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.REPO_ROOT ?? join(import.meta.dir, '..', '..');
const mig = (f: string) => readFileSync(join(ROOT, 'drizzle', 'migrations', f), 'utf8');

const HOST = '11111111-1111-4111-8111-111111111111';
const PLAYER = '99999999-9999-4999-8999-999999999999';
const P_LEGACY = '22222222-2222-4222-8222-222222222222';
const P_ATLAS = '33333333-3333-4333-8333-333333333333';
const ROOTMAP = '44444444-4444-4444-8444-444444444444';
const D = (c: string) => c.repeat(64);

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ok   ${name}`); } else { failed++; console.log(`  FAIL ${name} ${detail}`); }
}

const db = new PGlite();

async function setup() {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

    CREATE TABLE public.parties (id uuid PRIMARY KEY, link_code text NOT NULL, created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), is_active boolean NOT NULL DEFAULT true);
    CREATE TABLE public.party_shared_state (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), party_id uuid NOT NULL REFERENCES public.parties(id), user_id uuid NOT NULL,
      state_type text NOT NULL, state_data jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (party_id, user_id, state_type));
    CREATE TABLE public.gm_guides (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, content text NOT NULL, enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), mode text NOT NULL DEFAULT 'solo');
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.parties, public.party_shared_state, public.gm_guides TO authenticated;
    GRANT ALL ON public.parties, public.party_shared_state, public.gm_guides TO service_role;

    CREATE FUNCTION public.handle_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END $$;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END $$;
    CREATE TRIGGER update_party_shared_state_updated_at BEFORE UPDATE ON public.party_shared_state FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
    CREATE FUNCTION public.is_party_host(_user_id uuid, _party_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
      AS $$ SELECT EXISTS (SELECT 1 FROM public.parties WHERE id = _party_id AND created_by = _user_id) $$;
    CREATE FUNCTION public.safe_uuid(txt text) RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN txt::uuid; EXCEPTION WHEN others THEN RETURN NULL; END $$;
  `);
  // Every migration from the nested-map foundation onward, in order (includes later fixes).
  for (const f of readdirSync(join(ROOT, 'drizzle', 'migrations')).filter(f => /^\d{4}_.*\.sql$/.test(f) && f >= '0025').sort()) {
    await db.exec(mig(f));
  }
}

const world = () => ({
  version: 1, imageUrl: 'https://cdn/world.png', imageNaturalWidth: 1000, imageNaturalHeight: 800,
  mapCalibration: { imageWidth: 1000, imageHeight: 800, a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, knownMiles: 100, milesPerPixel: 0.1 },
  locations: [
    { id: 'arabel', name: 'Arabel', x: 0.5, y: 0.5, discovered: true, kind: 'city' },
    { id: 'tilverton', name: 'Tilverton', x: 0.7, y: 0.6, discovered: true, kind: 'town' },
  ],
  routes: [{ id: 'r1', fromLocationId: 'arabel', toLocationId: 'tilverton', distanceMiles: 30, distanceSource: 'manual', terrainFactor: 1, path: [] }],
  currentLocationId: 'tilverton', campaignMinute: 777, realMinutesPerGameHour: 15, defaultPace: 'normal', customUnknownField: { keep: true },
});
const atlas = () => ({
  format: 'odyssey-campaign-atlas', version: 2, revision: 5, sourcePartyId: P_ATLAS, rootMapId: ROOTMAP, activeMapId: ROOTMAP,
  campaignMinute: 777, realMinutesPerGameHour: 15,
  maps: [{ id: ROOTMAP, name: 'World', parentMapId: null, parentLocationId: null, entryLocationId: null, navigationMode: 'regional', state: world() }],
});
const area = (over: Record<string, unknown> = {}) => ({
  imageUrl: 'https://cdn/arabel.png', imageNaturalWidth: 500, imageNaturalHeight: 400,
  locations: [{ id: 'gate', name: 'Gate', x: 0.1, y: 0.1 }, { id: 'inn', name: 'Inn', x: 0.4, y: 0.4, parentLocationId: 'gate' }],
  routes: [], currentLocationId: 'gate', defaultPace: 'normal', ...over,
});
const guides = [{ scope: 'map', name: 'Arabel city', content: 'CITY-SECRET' }, { scope: 'location', locationId: 'inn', name: 'Inn', content: 'INN-SECRET' }];

async function rowOf(party: string) {
  return (await db.query<{ state_data: any; updated_at: string; user_id: string }>(
    `SELECT state_data, updated_at::text, user_id::text FROM party_shared_state WHERE party_id = $1 AND state_type = 'campaign_map'`, [party])).rows[0];
}
async function counts() {
  const g = await db.query<{ n: number }>('SELECT count(*)::int n FROM party_location_guides');
  const r = await db.query<{ n: number }>('SELECT count(*)::int n FROM bridge_campaign_installs');
  return { guides: g.rows[0].n, receipts: r.rows[0].n };
}

async function asRole<T>(role: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}

async function install(o: {
  party: string; actor?: string; req: string; updatedAt: string; rev: number | null; legacy: boolean; parentMap: string | null;
  parentLoc?: string; name?: string; map?: unknown; guides?: unknown; digest?: string; host?: string;
}) {
  return asRole('service_role', async () => (await db.query<{ r: any }>(
    `SELECT public.bridge_install_campaign_area($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13) r`,
    [o.party, o.actor ?? 'owner:approved', o.req, o.host ?? HOST, o.updatedAt, o.rev, o.legacy, o.parentMap, o.parentLoc ?? 'arabel',
     o.name ?? 'Arabel', JSON.stringify(o.map ?? area()), JSON.stringify(o.guides ?? guides), o.digest ?? D('a')])).rows[0].r);
}
async function expectErr(name: string, p: Promise<unknown>, code: string) {
  try { await p; check(name, false, '(no error)'); }
  catch (e: any) { check(name, e?.code === code, `(got ${e?.code}: ${e?.message})`); }
}

async function main() {
  await setup();
  await db.exec(`
    INSERT INTO parties (id, link_code, created_by) VALUES ('${P_LEGACY}', 'L', '${HOST}'), ('${P_ATLAS}', 'A', '${HOST}');
    INSERT INTO party_shared_state (party_id, user_id, state_type, state_data) VALUES
      ('${P_LEGACY}', '${HOST}', 'campaign_map', '${JSON.stringify(world())}'),
      ('${P_ATLAS}', '${HOST}', 'campaign_map', '${JSON.stringify(atlas())}');
    INSERT INTO party_location_guides (party_id, map_id, scope, name, content) VALUES ('${P_ATLAS}', '${ROOTMAP}', 'map', 'Unrelated', 'WORLD-NOTES');
  `);

  console.log('grants');
  const sig = 'public.bridge_install_campaign_area(uuid, text, uuid, uuid, timestamptz, integer, boolean, uuid, text, text, jsonb, jsonb, text)';
  for (const role of ['anon', 'authenticated']) {
    const r = (await db.query<any>(`SELECT has_function_privilege('${role}', '${sig}', 'EXECUTE') i,
      has_function_privilege('${role}', 'public.bridge_get_campaign_install(uuid,text,uuid)', 'EXECUTE') g,
      has_table_privilege('${role}', 'public.bridge_campaign_installs', 'SELECT') s`)).rows[0];
    check(`${role} cannot run installer / lookup / read receipts`, !r.i && !r.g && !r.s);
    await expectErr(`${role} call is refused by the database`, asRole(role, () => db.query(`SELECT public.bridge_get_campaign_install($1,'x',$1)`, [P_ATLAS])), '42501');
  }
  const pub = (await db.query<any>(`SELECT has_function_privilege('public', '${sig}', 'EXECUTE') p`)).rows[0];
  check('PUBLIC has no execute', !pub.p);

  console.log('legacy conversion');
  const L0 = await rowOf(P_LEGACY);
  await expectErr('legacy: wrong expected marker is stale', install({ party: P_LEGACY, req: crypto.randomUUID(), updatedAt: L0.updated_at, rev: 0, legacy: false, parentMap: ROOTMAP }), '40001');
  const rl = await install({ party: P_LEGACY, req: '55555555-0000-4000-8000-000000000001', updatedAt: L0.updated_at, rev: null, legacy: true, parentMap: null });
  const L1 = await rowOf(P_LEGACY);
  const root = L1.state_data.maps.find((m: any) => m.id === L1.state_data.rootMapId);
  check('legacy: revision initialized to 0', rl.revision === 0 && L1.state_data.revision === 0);
  check('legacy: original world kept unchanged as root', JSON.stringify(root.state) === JSON.stringify(L0.state_data));
  check('legacy: clock/rate preserved', L1.state_data.campaignMinute === 777 && L1.state_data.realMinutesPerGameHour === 15);
  check('legacy: party stays on root', L1.state_data.activeMapId === root.id);
  check('legacy: host ownership unchanged', L1.user_id === HOST);

  console.log('atlas install (connector actor is not the host)');
  const A0 = await rowOf(P_ATLAS);
  const before = await counts();
  // all-or-nothing: force the guide insert to fail after the map was prepared
  await db.exec(`CREATE FUNCTION public.t_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'Inn' THEN RAISE EXCEPTION 'forced' USING ERRCODE='XX001'; END IF; RETURN NEW; END $$;
                 CREATE TRIGGER t_fail BEFORE INSERT ON public.party_location_guides FOR EACH ROW EXECUTE FUNCTION public.t_fail();`);
  await expectErr('forced guide failure aborts', install({ party: P_ATLAS, req: '55555555-0000-4000-8000-000000000002', updatedAt: A0.updated_at, rev: 5, legacy: false, parentMap: ROOTMAP }), 'XX001');
  const afterFail = await counts(); const A0b = await rowOf(P_ATLAS);
  check('nothing persisted after failure', afterFail.guides === before.guides && afterFail.receipts === before.receipts && A0b.updated_at === A0.updated_at && A0b.state_data.revision === 5);
  await db.exec('DROP TRIGGER t_fail ON public.party_location_guides; DROP FUNCTION public.t_fail();');

  const REQ = '55555555-0000-4000-8000-000000000003';
  const ra = await install({ party: P_ATLAS, req: REQ, updatedAt: A0.updated_at, rev: 5, legacy: false, parentMap: ROOTMAP });
  const A1 = await rowOf(P_ATLAS);
  const rootNow = A1.state_data.maps.find((m: any) => m.id === ROOTMAP);
  const child = A1.state_data.maps.find((m: any) => m.id === ra.mapId);
  check('revision incremented once', ra.revision === 6 && A1.state_data.revision === 6);
  check('root geography/routes/calibration/position unchanged', JSON.stringify(rootNow.state) === JSON.stringify(A0.state_data.maps[0].state));
  check('clock + active map unchanged', A1.state_data.campaignMinute === 777 && A1.state_data.activeMapId === ROOTMAP);
  check('child is local, attached, entry = arrival, no travel', child.navigationMode === 'local' && child.parentLocationId === 'arabel' && child.entryLocationId === 'gate' && !child.state.activeTravel);
  check('guide ids returned', ra.guideCount === 2);
  check('unrelated guide untouched', (await db.query<any>(`SELECT content FROM party_location_guides WHERE name='Unrelated'`)).rows[0].content === 'WORLD-NOTES');
  check('guide text not in map JSON', !JSON.stringify(A1.state_data).includes('SECRET'));
  check('guide text not in receipt', !JSON.stringify(ra).includes('SECRET'));
  check('receipt omits snapshot', !('original_state_data' in ra) && !JSON.stringify(ra).includes('customUnknownField'));

  console.log('retries, conflicts, validation');
  const replay = await install({ party: P_ATLAS, req: REQ, updatedAt: A0.updated_at, rev: 5, legacy: false, parentMap: ROOTMAP });
  check('lost-response retry returns original ids/revision', replay.replayed === true && replay.mapId === ra.mapId && replay.revision === 6
    && JSON.stringify(replay.guideIds) === JSON.stringify(ra.guideIds));
  check('retry did not write again', (await rowOf(P_ATLAS)).updated_at === A1.updated_at && (await counts()).receipts === before.receipts + 1);
  await expectErr('same request, different content', install({ party: P_ATLAS, req: REQ, updatedAt: A0.updated_at, rev: 5, legacy: false, parentMap: ROOTMAP, name: 'Other' }), '23505');
  await expectErr('same request, different digest', install({ party: P_ATLAS, req: REQ, updatedAt: A0.updated_at, rev: 5, legacy: false, parentMap: ROOTMAP, digest: D('b') }), '23505');
  const lookup = await asRole('service_role', async () => (await db.query<any>(`SELECT public.bridge_get_campaign_install($1,'owner:approved',$2) r`, [P_ATLAS, REQ])).rows[0].r);
  check('receipt lookup works (recovery after ticket expiry)', lookup?.mapId === ra.mapId);

  const n = () => crypto.randomUUID();
  await expectErr('stale updated_at', install({ party: P_ATLAS, req: n(), updatedAt: A0.updated_at, rev: 6, legacy: false, parentMap: ROOTMAP, parentLoc: 'tilverton' }), '40001');
  await expectErr('stale revision', install({ party: P_ATLAS, req: n(), updatedAt: A1.updated_at, rev: 5, legacy: false, parentMap: ROOTMAP, parentLoc: 'tilverton' }), '40001');
  await expectErr('changed host', install({ party: P_ATLAS, req: n(), updatedAt: A1.updated_at, rev: 6, legacy: false, parentMap: ROOTMAP, parentLoc: 'tilverton', host: PLAYER }), '40001');
  await expectErr('occupied parent place', install({ party: P_ATLAS, req: n(), updatedAt: A1.updated_at, rev: 6, legacy: false, parentMap: ROOTMAP }), '23505');
  const base = { party: P_ATLAS, updatedAt: A1.updated_at, rev: 6, legacy: false, parentMap: ROOTMAP, parentLoc: 'tilverton' } as const;
  await expectErr('duplicate place ids', install({ ...base, req: n(), map: area({ locations: [{ id: 'g', name: 'A' }, { id: 'g', name: 'B' }], currentLocationId: 'g' }) }), '22023');
  await expectErr('place loop', install({ ...base, req: n(), map: area({ locations: [{ id: 'a', name: 'A', parentLocationId: 'b' }, { id: 'b', name: 'B', parentLocationId: 'a' }], currentLocationId: 'a' }) }), '22023');
  await expectErr('road to missing place', install({ ...base, req: n(), map: area({ routes: [{ id: 'r', fromLocationId: 'gate', toLocationId: 'nope', distanceMiles: 1, path: [] }] }) }), '22023');
  await expectErr('injected travel', install({ ...base, req: n(), map: area({ activeTravel: { routeId: 'x' } }) }), '22023');
  await expectErr('non-https image', install({ ...base, req: n(), map: area({ imageUrl: 'http://evil/x.png' }) }), '22023');
  await expectErr('guide for a place not in the area', install({ ...base, req: n(), guides: [{ scope: 'location', locationId: 'arabel', name: 'x', content: 'y' }] }), '22023');
  await expectErr('two guides same scope', install({ ...base, req: n(), guides: [{ scope: 'map', name: 'a', content: 'b' }, { scope: 'map', name: 'c', content: 'd' }] }), '22023');
  await expectErr('guide over 30,000 chars', install({ ...base, req: n(), guides: [{ scope: 'map', name: 'a', content: 'x'.repeat(30001) }] }), '22023');
  const big = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, ...(i ? { parentLocationId: `p${i - 1}` } : {}) }));
  await expectErr('combined guides over 200,000', install({ ...base, req: n(),
    map: area({ locations: big, currentLocationId: 'p0' }),
    guides: big.map(l => ({ scope: 'location', locationId: l.id, name: l.name, content: 'x'.repeat(29990) })) }), '54000');
  await db.exec(`UPDATE parties SET is_active = false WHERE id = '${P_ATLAS}'`);
  await expectErr('inactive party', install({ ...base, req: n() }), '55000');
  await db.exec(`UPDATE parties SET is_active = true WHERE id = '${P_ATLAS}'`);
  check('no stray writes from rejected calls', (await rowOf(P_ATLAS)).updated_at === A1.updated_at && (await counts()).receipts === before.receipts + 1);

  console.log('host-only app path unchanged');
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${PLAYER}', false)`);
  await expectErr('non-host cannot write_campaign_atlas', asRole('authenticated', () => db.query(
    `SELECT * FROM public.write_campaign_atlas($1, $2::jsonb, $3::timestamptz)`, [P_ATLAS, JSON.stringify(A1.state_data), A1.updated_at])), '42501');
  await expectErr('non-host cannot insert location guides', asRole('authenticated', () => db.query(
    `INSERT INTO party_location_guides (party_id, map_id, scope, name, content) VALUES ($1, $2, 'map', 'x', 'y')`, [P_ATLAS, crypto.randomUUID()])), '42501');
  const seen = await asRole('authenticated', async () => (await db.query<any>(`SELECT count(*)::int n FROM party_location_guides`)).rows[0].n);
  check('player cannot read private guides', seen === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

await main();
