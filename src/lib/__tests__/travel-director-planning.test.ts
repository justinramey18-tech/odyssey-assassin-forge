import { describe, it, expect } from 'vitest';
import { eligibleJourney, isOriginalHost, journeyHash, parseDecision, roadGuideScopes, targetPoint } from '../../../supabase/functions/_shared/travel-planning';
import { createCalibration, effectiveRouteMiles } from '../campaign-map';
import { createHash } from 'node:crypto';

const raw = () => ({
  routes: [
    { id: 'a', fromLocationId: 'start', toLocationId: 'middle', distanceSource: 'manual', distanceMiles: 10, terrainFactor: 1 },
    { id: 'b', fromLocationId: 'end', toLocationId: 'middle', distanceSource: 'manual', distanceMiles: 30, terrainFactor: 2 },
  ], locations: [{ id: 'start' }, { id: 'middle' }, { id: 'end' }], currentLocationId: null,
  journeyPlan: { destinationLocationId: 'end', pace: 'normal', currentLegIndex: 0, totalMiles: 35,
    legs: [{ routeId: 'a', fromLocationId: 'start', toLocationId: 'middle', reversed: false },
      { routeId: 'b', fromLocationId: 'middle', toLocationId: 'end', reversed: true }] },
  activeTravel: { routeId: 'a', reversed: false, startProgress: 0.5, endProgress: 1, startedAt: 1000,
    realDurationMs: 100000, gameMinutes: 100, startCampaignMinute: 0, pace: 'normal' },
});
const journey = (r: unknown = raw(), now = 1000) => {
  const j = eligibleJourney(r, now); if (!j) throw new Error('Missing journey'); return j;
};
describe('hidden travel planning', () => {
  it('allows only the original host, never a co-host or member', () => {
    expect(isOriginalHost('host','host')).toBe(true);
    expect(isOriginalHost('host','co-host')).toBe(false);
    expect(isOriginalHost('host','member')).toBe(false);
    expect(isOriginalHost(undefined,undefined)).toBe(false);
  });
  it('uses unequal road miles and the reversed normal coordinate', () => {
    const j = journey();
    expect(j.remainingMiles).toBe(35);
    expect(targetPoint(j, 0.5)).toEqual({ target_leg_index: 1, target_route_id: 'b', target_route_progress: 1-12.5/30,
      target_reversed: true, target_overall_fraction: 0.5 });
  });
  it('handles a reversed mid-road start', () => {
    const r = raw(); r.journeyPlan.currentLegIndex = 1;
    r.activeTravel = { ...r.activeTravel, routeId: 'b', reversed: true, startProgress: 0.25 };
    const j = journey(r);
    expect(j.remainingMiles).toBe(22.5);
    expect(targetPoint(j, 0.5).target_route_progress).toBe(0.375);
  });
  it('uses the actual elapsed multi-road position before planning', () => {
    const r: any = raw(); r.activeTravel.segments = [
      { routeId:'a',reversed:false,startProgress:0.5,endProgress:1,gameMinutes:100,legIndex:0 },
      { routeId:'b',reversed:true,startProgress:0,endProgress:1,gameMinutes:1200,legIndex:1 },
    ];
    const j = journey(r, 1000+100000*(700/1300));
    expect(j.remainingMiles).toBeCloseTo(15);
    expect(targetPoint(j,0.5).target_route_progress).toBeCloseTo(0.25);
  });
  it('city, arrived, local, and ended journeys do not plan', () => {
    const r = raw();
    expect(eligibleJourney({ ...r,travelScale:'city' },1000)).toBeNull();
    expect(eligibleJourney({ ...r,currentLocationId:'end' },1000)).toBeNull();
    expect(eligibleJourney(r,200000)).toBeNull();
    expect(eligibleJourney({format:'odyssey-campaign-atlas',version:2,activeMapId:'x',maps:[{id:'x',navigationMode:'local',state:r}]},1000)).toBeNull();
  });
  it('staged travel stays at zero elapsed regardless of wall time', () => {
    const r = raw();
    const j = journey({ ...r, activeTravel: { ...r.activeTravel, startedAt: null } },999999999);
    expect(j.remainingMiles).toBe(35); expect(j.campaignMinute).toBe(0);
  });
  it('staged travel respects its saved paused fraction', () => {
    const r = raw();
    const j = journey({ ...r, activeTravel: { ...r.activeTravel, startedAt: null, pausedFraction: 0.5 } },999999999);
    expect(j.remainingMiles).toBe(32.5); expect(j.campaignMinute).toBe(50);
  });
  it('hash exactly matches PostgreSQL jsonb spacing and key ordering', async () => {
    const expected = '{"legs": [{"routeId": "a", "reversed": false, "toLocationId": "middle", "fromLocationId": "start"}, {"routeId": "b", "reversed": true, "toLocationId": "end", "fromLocationId": "middle"}], "pace": "normal", "destinationLocationId": "end"}';
    expect(await journeyHash(journey())).toBe(createHash('sha256').update(expected).digest('hex'));
  });
  it('hash survives pause/resume timing and mutable progress changes', async () => {
    const r = raw(), changed = raw(); changed.activeTravel.startedAt = 2000;
    changed.journeyPlan.currentLegIndex = 1; changed.activeTravel.routeId = 'b'; changed.activeTravel.reversed = true;
    expect(await journeyHash(journey(r))).toBe(await journeyHash(journey(changed,2000)));
  });
  it('only accepts strict decision shapes with target 0.15 to 0.85', () => {
    expect(parseDecision('{"event":false}')).toEqual({event:false});
    for (const targetFraction of [0.14,0.86,'0.5',null]) expect(() => parseDecision(JSON.stringify({event:true,eventType:'social',premise:'road',targetFraction}))).toThrow();
    expect(() => parseDecision('{"event":false,"premise":"secret"}')).toThrow();
    expect(() => parseDecision('```json\n{"event":false}\n```')).toThrow();
    expect(parseDecision('{"event":true,"eventType":" social ","premise":" road ","targetFraction":0.15}')).toEqual({event:true,eventType:'social',premise:'road',targetFraction:0.15});
  });
  it('includes enclosing entrance and map-wide guides, never destination guides', () => {
    expect(roadGuideScopes({format:'odyssey-campaign-atlas',rootMapId:'world',activeMapId:'area',maps:[
      {id:'world',state:{locations:[{id:'town',parentLocationId:'region'},{id:'region'}]}},
      {id:'area',parentMapId:'world',parentLocationId:'town',state:{currentLocationId:'destination',locations:[{id:'destination'}]}}
    ]})).toEqual([{mapId:'world',scope:'map',locationId:null},{mapId:'world',scope:'location',locationId:'town'},
      {mapId:'world',scope:'location',locationId:'region'},{mapId:'area',scope:'map',locationId:null}]);
  });
  it('calibrated road distance matches campaign-map math', () => {
    const r: any = raw(); r.imageNaturalWidth=1000; r.imageNaturalHeight=500;
    r.mapCalibration=createCalibration({x:0,y:0},{x:1,y:0},1000,500,10);
    r.routes[0]={...r.routes[0],distanceSource:'calibrated',path:[{x:0,y:0},{x:0.5,y:0},{x:1,y:0}]};
    const j=journey(r);
    expect(j.remaining[0].fullMiles).toBe(effectiveRouteMiles(r.routes[0],r.mapCalibration));
  });
  it('rejects invalid direction and unknown distance rather than guessing', () => {
    const r = raw(); r.routes[0].distanceMiles = NaN;
    expect(eligibleJourney(r,1000)).toBeNull();
    const other=raw(); other.journeyPlan.legs[0].reversed=true;
    expect(eligibleJourney(other,1000)).toBeNull();
  });
});