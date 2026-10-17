import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Explicit disposable socket only. Never use Cloud/PG environment connection values.
const isolated = process.env.TRAVEL_LAUNCH_ISOLATED_TESTS === '1';
const party = '00000000-0000-4000-8000-000000000001';
const host = '00000000-0000-4000-8000-000000000002';
const map = '00000000-0000-4000-8000-000000000003';
const event = '00000000-0000-4000-8000-000000000005';
const state = {
  campaignMinute: 100, sentinel: { kept: true },
  journeyPlan: { destinationLocationId: 'dest', pace: 'normal', currentLegIndex: 0, totalMiles: 3,
    legs: [{ routeId: 'ab', fromLocationId: 'a', toLocationId: 'b', reversed: false },
      { routeId: 'bc', fromLocationId: 'b', toLocationId: 'dest', reversed: true }] },
  activeTravel: { startedAt: null, pace: 'normal', realDurationMs: 10000, startCampaignMinute: 100,
    gameMinutes: 60, pausedFraction: 0,
    segments: [{ routeId: 'ab', reversed: false, startProgress: 0, endProgress: 1, gameMinutes: 20, legIndex: 0 },
      { routeId: 'bc', reversed: true, startProgress: 0.2, endProgress: 1, gameMinutes: 40, legIndex: 1 }] },
};
const envelope = { format: 'odyssey-campaign-atlas', version: 2, revision: 4, sourcePartyId: party,
  rootMapId: map, activeMapId: map, campaignMinute: 100, realMinutesPerGameHour: 5, extra: 'preserved',
  maps: [{ id: map, name: 'World', parentMapId: null, parentLocationId: null, entryLocationId: null,
    navigationMode: 'regional', extra: 'node metadata', state },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Other', parentMapId: map,
    parentLocationId: 'a', entryLocationId: null, navigationMode: 'local', state: { sentinel: 'untouched' } }] };
const schedule = { target_tranche_fraction: 0.5, target_campaign_minute: 130, target_route_progress: 0.6,
  expected_tranche_started_at: 1000, scheduled_at: '1970-01-01T00:00:06.000Z', qstash_message_id: 'queue-receipt' };
const json = (value: unknown) => `'${JSON.stringify(value)}'::jsonb`;
const call = (payload: unknown = schedule, expected = '(SELECT state_data FROM party_shared_state)', start = 1000) =>
  `arm_private_travel_launch('${event}',${expected},${start},${json(payload)})`;
function check(sql: string, legacy = false, noEvent = false) {
  const saved = legacy ? state : envelope;
  const plan = legacy ? "state_data->'journeyPlan'" : "state_data->'maps'->0->'state'->'journeyPlan'";
  const fixture = `INSERT INTO parties VALUES ('${party}','${host}');
    INSERT INTO party_shared_state(party_id,user_id,state_type,state_data) VALUES ('${party}','${host}','campaign_map',${json(saved)});
    INSERT INTO party_travel_events(id,party_id,created_by,map_id,destination_location_id,journey_plan_hash,has_event,status,
      event_type,event_premise,target_leg_index,target_route_id,target_route_progress,target_reversed,target_overall_fraction)
    SELECT '${event}',party_id,user_id,${legacy ? 'NULL' : `'${map}'::uuid`},'dest',
      encode(sha256(convert_to(((${plan}) - 'currentLegIndex' - 'totalMiles')::text,'UTF8')),'hex'),
      ${noEvent ? "false,'no_event',NULL,NULL,NULL,NULL,NULL,NULL,NULL" : "true,'planned','social','Private premise',1,'bc',0.6,true,0.5"} FROM party_shared_state;
    CREATE TEMP TABLE original AS SELECT state_data FROM party_shared_state;
    CREATE TEMP TABLE original_event AS SELECT to_jsonb(e) AS data FROM party_travel_events e;`;
  const out = execFileSync('psql', ['-h', '/tmp/travel-launch/pg', '-p', '55433', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: `BEGIN; ${fixture} ${sql} ROLLBACK;`, encoding: 'utf8',
  }).split('\n');
  expect(out).toContain('PASS');
  expect(out).not.toContain('FAIL');
}
const unchanged = `SELECT CASE WHEN s.state_data=o.state_data AND to_jsonb(e)=b.data THEN 'PASS' ELSE 'FAIL' END
  FROM party_shared_state s,original o,party_travel_events e,original_event b;`;
describe.skipIf(!isolated)('durable launch (isolated PostgreSQL)', () => {
  it('allows only service-role execution', () => check(`SELECT CASE WHEN
    NOT has_function_privilege('anon','arm_private_travel_launch(uuid,jsonb,bigint,jsonb)','EXECUTE') AND
    NOT has_function_privilege('authenticated','arm_private_travel_launch(uuid,jsonb,bigint,jsonb)','EXECUTE') AND
    has_function_privilege('service_role','arm_private_travel_launch(uuid,jsonb,bigint,jsonb)','EXECUTE') THEN 'PASS' ELSE 'FAIL' END;`));
  it('anchors the atlas and schedules the durable event together', () => check(`SET LOCAL ROLE service_role;
    SELECT CASE WHEN ${call()} THEN 'PASS' ELSE 'FAIL' END; RESET ROLE;
    SELECT CASE WHEN state_data=jsonb_set(jsonb_set(o.state_data,'{maps,0,state,activeTravel,startedAt}','1000'),'{revision}','5')
      AND e.status='scheduled' AND e.expected_tranche_started_at=1000 AND e.target_campaign_minute=130
      AND e.target_tranche_fraction=0.5 AND e.qstash_message_id='queue-receipt' THEN 'PASS' ELSE 'FAIL' END
      FROM party_shared_state s,original o,party_travel_events e;`));
  it('anchors a no-event outcome without changing its row or campaign time', () => check(`SELECT CASE WHEN ${call(null)} THEN 'PASS' ELSE 'FAIL' END;
    SELECT CASE WHEN s.state_data=jsonb_set(jsonb_set(o.state_data,'{maps,0,state,activeTravel,startedAt}','1000'),'{revision}','5')
      AND to_jsonb(e)=b.data THEN 'PASS' ELSE 'FAIL' END FROM party_shared_state s,original o,party_travel_events e,original_event b;`, false, true));
  it('preserves legacy keys without converting the map', () => check(`SELECT CASE WHEN ${call(null)} THEN 'PASS' ELSE 'FAIL' END;
    SELECT CASE WHEN s.state_data=jsonb_set(o.state_data,'{activeTravel,startedAt}','1000') THEN 'PASS' ELSE 'FAIL' END
    FROM party_shared_state s,original o;`, true, true));
  it('rejects stale expected JSON without either write', () => check(`SELECT CASE WHEN NOT ${call(schedule, "'{}'::jsonb")} THEN 'PASS' ELSE 'FAIL' END; ${unchanged}`));
  it('rejects non-original-host events', () => check(`UPDATE party_travel_events SET created_by='00000000-0000-4000-8000-000000000009';
    UPDATE original_event SET data=(SELECT to_jsonb(e) FROM party_travel_events e);
    SELECT CASE WHEN NOT ${call()} THEN 'PASS' ELSE 'FAIL' END; ${unchanged}`));
  it.each(['journey_plan_hash', 'destination_location_id', 'map_id'])('rejects changed %s', field => check(`
    UPDATE party_travel_events SET ${field}=${field === 'map_id' ? "'00000000-0000-4000-8000-000000000004'" : "'wrong'"};
    UPDATE original_event SET data=(SELECT to_jsonb(e) FROM party_travel_events e);
    SELECT CASE WHEN NOT ${call()} THEN 'PASS' ELSE 'FAIL' END; ${unchanged}`));
  it('rejects a missing or already-running tranche', () => check(`ALTER TABLE party_shared_state DISABLE TRIGGER guard_campaign_atlas_row;
    UPDATE party_shared_state SET state_data=jsonb_set(state_data,'{maps,0,state,activeTravel,startedAt}','999');
    SELECT CASE WHEN NOT ${call()} THEN 'PASS' ELSE 'FAIL' END;
    UPDATE party_shared_state SET state_data=state_data #- '{maps,0,state,activeTravel}';
    SELECT CASE WHEN NOT ${call()} THEN 'PASS' ELSE 'FAIL' END;`));
  it.each([
    ['missing queue receipt', { ...schedule, qstash_message_id: '' }],
    ['wrong anchor', { ...schedule, expected_tranche_started_at: 2000 }],
    ['wrong campaign minute', { ...schedule, target_campaign_minute: 131 }],
    ['wrong road progress', { ...schedule, target_route_progress: 0.7 }],
    ['wrong tranche fraction', { ...schedule, target_tranche_fraction: 0.7 }],
    ['wrong callback time', { ...schedule, scheduled_at: '1970-01-01T00:00:07.000Z' }],
    ['malformed callback time', { ...schedule, scheduled_at: 'invalid' }],
  ])('rejects %s without anchoring travel', (_name, payload) => check(`SELECT CASE WHEN NOT ${call(payload)} THEN 'PASS' ELSE 'FAIL' END; ${unchanged}`));
  it('rejects retries after success without incrementing revision twice', () => check(`SELECT ${call()};
    SELECT CASE WHEN NOT ${call()} AND (SELECT state_data->>'revision' FROM party_shared_state)='5' THEN 'PASS' ELSE 'FAIL' END;`));
  it('validates the atlas and rolls back both writes on rejection', () => check(`ALTER TABLE party_shared_state DISABLE TRIGGER guard_campaign_atlas_row;
    UPDATE party_shared_state SET state_data=jsonb_set(state_data,'{version}','3');
    UPDATE original SET state_data=(SELECT state_data FROM party_shared_state);
    SELECT CASE WHEN NOT ${call()} THEN 'PASS' ELSE 'FAIL' END; ${unchanged}`));
  it('supports a paused fraction without changing the saved fraction', () => check(`ALTER TABLE party_shared_state DISABLE TRIGGER guard_campaign_atlas_row;
    UPDATE party_shared_state SET state_data=jsonb_set(state_data,'{maps,0,state,activeTravel,pausedFraction}','0.25');
    SELECT CASE WHEN ${call({ ...schedule, scheduled_at: '1970-01-01T00:00:04.333Z' })} THEN 'PASS' ELSE 'FAIL' END;
    SELECT CASE WHEN state_data->'maps'->0->'state'->'activeTravel'->>'pausedFraction'='0.25' THEN 'PASS' ELSE 'FAIL' END FROM party_shared_state;`));
});