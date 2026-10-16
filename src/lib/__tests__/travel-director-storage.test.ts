import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Runs only against the explicitly provisioned disposable PostgreSQL cluster, never Cloud.
const isolated = process.env.TRAVEL_DIRECTOR_ISOLATED_TESTS === '1';
const fixture = `
INSERT INTO parties VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
INSERT INTO party_shared_state(party_id,user_id,state_type,state_data) VALUES (
'00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','campaign_map',
'{"format":"odyssey-campaign-atlas","version":2,"revision":4,"sourcePartyId":"00000000-0000-4000-8000-000000000001","rootMapId":"00000000-0000-4000-8000-000000000003","activeMapId":"00000000-0000-4000-8000-000000000003","campaignMinute":100,"realMinutesPerGameHour":5,"maps":[{"id":"00000000-0000-4000-8000-000000000003","name":"City","parentMapId":null,"parentLocationId":null,"entryLocationId":null,"navigationMode":"regional","state":{"travelScale":"city","locations":[],"routes":[],"currentLocationId":null,"campaignMinute":100,"realMinutesPerGameHour":5,"unrelated":"kept","journeyPlan":{"destinationLocationId":"dest","pace":"normal","currentLegIndex":0,"legs":[{"routeId":"ab","fromLocationId":"a","toLocationId":"b","reversed":false},{"routeId":"bc","fromLocationId":"b","toLocationId":"dest","reversed":true}]},"activeTravel":{"routeId":"ab","reversed":false,"startProgress":0,"endProgress":1,"startedAt":1000,"realDurationMs":10000,"startCampaignMinute":100,"gameMinutes":60,"segments":[{"routeId":"ab","reversed":false,"startProgress":0,"endProgress":1,"gameMinutes":20,"distanceMiles":1,"legIndex":0},{"routeId":"bc","reversed":true,"startProgress":0.2,"endProgress":1,"gameMinutes":40,"distanceMiles":2,"legIndex":1}]}}},{"id":"00000000-0000-4000-8000-000000000004","name":"Other","parentMapId":"00000000-0000-4000-8000-000000000003","parentLocationId":"a","entryLocationId":null,"navigationMode":"local","state":{"campaignMinute":0,"sentinel":"untouched"}}]}');
INSERT INTO party_travel_events(id,party_id,created_by,map_id,destination_location_id,journey_plan_hash,has_event,event_type,event_premise,target_leg_index,target_route_id,target_route_progress,target_reversed,target_overall_fraction,target_tranche_fraction,target_campaign_minute,expected_tranche_started_at,scheduled_at,status)
SELECT '00000000-0000-4000-8000-000000000005',party_id,user_id,'00000000-0000-4000-8000-000000000003','dest',
encode(sha256(convert_to((state_data->'maps'->0->'state'->'journeyPlan' - 'currentLegIndex')::text,'UTF8')),'hex'),true,'encounter','Secret',1,'bc',0.6,true,0.5,0.5,130,1000,'2000-01-01','scheduled' FROM party_shared_state;
`;
const call = `public.pause_campaign_travel_for_event('00000000-0000-4000-8000-000000000005')`;
function check(sql: string) {
  const out = execFileSync('psql', ['-h', '/tmp/travel-director/pg', '-p', '55432', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: `BEGIN; ${fixture} ${sql} ROLLBACK;`, encoding: 'utf8',
  });
  expect(out.split('\n')).toContain('PASS');
}
describe.skipIf(!isolated)('private Travel Director storage (isolated PostgreSQL)', () => {
  it('grants neither table access nor pause execution to any browser role', () => check(`
    SELECT CASE WHEN NOT has_table_privilege('authenticated','party_travel_events','SELECT')
    AND NOT has_table_privilege('anon','party_travel_events','SELECT')
    AND NOT has_function_privilege('authenticated','pause_campaign_travel_for_event(uuid)','EXECUTE')
    AND NOT has_function_privilege('anon','pause_campaign_travel_for_event(uuid)','EXECUTE')
    AND has_function_privilege('service_role','pause_campaign_travel_for_event(uuid)','EXECUTE')
    AND (SELECT relrowsecurity FROM pg_class WHERE oid='party_travel_events'::regclass)
    AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='party_travel_events') THEN 'PASS' ELSE 'FAIL' END;`));
  it('pauses a late callback at fraction 0.5, reversed road progress 0.6 and minute 130', () => check(`
    SET LOCAL ROLE service_role; SELECT CASE WHEN ${call}->>'paused'='true' THEN 'PASS' ELSE 'FAIL' END;
    SELECT CASE WHEN state_data->>'campaignMinute'='130' AND state_data->'maps'->0->'state'->'activeTravel'->'startedAt'='null'::jsonb
    AND (state_data->'maps'->0->'state'->'currentRoutePosition'->>'progress')::numeric=0.6 THEN 'PASS' ELSE 'FAIL' END FROM party_shared_state;`));
  it('increments revision once and preserves the inactive map and journey', () => check(`
    CREATE TEMP TABLE before_pause AS SELECT state_data FROM party_shared_state;
    SELECT ${call}; SELECT CASE WHEN s.state_data->>'revision'='5'
    AND s.state_data->'maps'->1=b.state_data->'maps'->1
    AND s.state_data->'maps'->0->'state'->'journeyPlan'=b.state_data->'maps'->0->'state'->'journeyPlan'
    AND s.state_data->'maps'->0->'state'->>'travelScale'='city'
    AND s.state_data->'maps'->0->'state'->>'unrelated'='kept' THEN 'PASS' ELSE 'FAIL' END FROM party_shared_state s,before_pause b;`));
  it('retries successfully without a second revision increment', () => check(`SELECT ${call};
    SELECT CASE WHEN ${call}->>'alreadyPaused'='true' AND (SELECT state_data->>'revision' FROM party_shared_state)='5' THEN 'PASS' ELSE 'FAIL' END;`));
  it('rejects cancelled events without changing the map', () => check(`UPDATE party_travel_events SET status='cancelled';
    SELECT CASE WHEN ${call}->>'stale'='true' AND (SELECT state_data->>'revision' FROM party_shared_state)='4' THEN 'PASS' ELSE 'FAIL' END;`));
  it('rejects a changed normalized journey', () => check(`UPDATE party_travel_events SET journey_plan_hash='wrong';
    SELECT CASE WHEN ${call}->>'reason'='changed_journey' THEN 'PASS' ELSE 'FAIL' END;`));
  it('rejects a changed active map', () => check(`UPDATE party_travel_events SET map_id='00000000-0000-4000-8000-000000000004';
    SELECT CASE WHEN ${call}->>'reason'='wrong_map' THEN 'PASS' ELSE 'FAIL' END;`));
  it('rejects a resumed or replaced tranche', () => check(`UPDATE party_travel_events SET expected_tranche_started_at=2000;
    SELECT CASE WHEN ${call}->>'reason'='changed_tranche' THEN 'PASS' ELSE 'FAIL' END;`));
  it('does not pause before the event is due', () => check(`UPDATE party_travel_events SET scheduled_at=clock_timestamp()+interval '1 day';
    SELECT CASE WHEN ${call}->>'reason'='not_due' AND (SELECT status FROM party_travel_events)='scheduled' THEN 'PASS' ELSE 'FAIL' END;`));
  it('rejects inconsistent stored target coordinates', () => check(`UPDATE party_travel_events SET target_route_progress=0.7;
    SELECT CASE WHEN ${call}->>'reason'='changed_target' THEN 'PASS' ELSE 'FAIL' END;`));
  it('assigns an exact segment boundary to the next road', () => check(`UPDATE party_travel_events SET target_tranche_fraction=1.0/3,target_route_progress=0.8,target_campaign_minute=120;
    SELECT CASE WHEN ${call}->>'paused'='true' THEN 'PASS' ELSE 'FAIL' END;`));
  it('enforces one open event and allows historical events', () => check(`
    DO $$ BEGIN BEGIN INSERT INTO party_travel_events(party_id,created_by,destination_location_id,journey_plan_hash,has_event,status)
    SELECT party_id,created_by,'dest','none',false,'no_event' FROM party_travel_events;
    RAISE EXCEPTION 'unique rule did not reject'; EXCEPTION WHEN unique_violation THEN NULL; END; END $$;
    UPDATE party_travel_events SET status='posted';
    INSERT INTO party_travel_events(party_id,created_by,destination_location_id,journey_plan_hash,has_event,status)
    SELECT party_id,created_by,'dest','none',false,'no_event' FROM party_travel_events;
    SELECT CASE WHEN count(*)=2 THEN 'PASS' ELSE 'FAIL' END FROM party_travel_events;`));
  it('rejects secrets on no-event records and fractions outside 0..1', () => check(`
    DO $$ BEGIN BEGIN UPDATE party_travel_events SET target_overall_fraction=1.1; RAISE EXCEPTION 'fraction accepted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN UPDATE party_travel_events SET has_event=false,status='no_event'; RAISE EXCEPTION 'secret accepted';
    EXCEPTION WHEN check_violation THEN NULL; END; END $$; SELECT 'PASS';`));
});