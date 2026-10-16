import { describe,it,expect } from 'vitest';
import { eventClock } from '../../../supabase/functions/_shared/travel-event-clock';
const state=()=>({currentLocationId:null,journeyPlan:{destinationLocationId:'end',currentLegIndex:0,legs:[{},{}]},
  activeTravel:{startedAt:1000,realDurationMs:60000,startCampaignMinute:100,pausedFraction:0,
    segments:[{routeId:'a',reversed:false,startProgress:0,endProgress:1,gameMinutes:20,legIndex:0},
      {routeId:'b',reversed:true,startProgress:0.2,endProgress:1,gameMinutes:40,legIndex:1}]}});
const event=()=>({destination_location_id:'end',target_leg_index:1,target_route_id:'b',target_reversed:true,target_route_progress:0.6});
describe('offline road clock',()=>{
  it('converts reversed target to whole-tranche 0.5, minute 130, and absolute 31000ms',()=>{
    expect(eventClock(state(),event(),1000)).toMatchObject({kind:'schedule',target_tranche_fraction:0.5,target_campaign_minute:130,
      scheduled_at:new Date(31000).toISOString(),expected_tranche_started_at:1000});
  });
  it('resumed fraction is included in exact due time',()=>{
    const s=state();s.activeTravel.pausedFraction=0.25;
    expect(eventClock(s,event(),1000)).toMatchObject({kind:'schedule',scheduled_at:new Date(21000).toISOString()});
  });
  it('manually paused before target stays planned',()=>{
    const s:any=state();s.activeTravel.startedAt=null;s.activeTravel.pausedFraction=0.25;
    expect(eventClock(s,event(),999999).kind).toBe('wait');
  });
  it('later travel-day target waits without scheduling',()=>{
    const e=event();e.target_leg_index=2;e.target_route_id='later';
    expect(eventClock(state(),e,1000).kind).toBe('wait');
  });
  it('late sync nudges forward 3 seconds on same road without rewinding',()=>{
    const out=eventClock(state(),event(),32000);
    expect(out.kind).toBe('schedule');
    if(out.kind!=='schedule') throw new Error('missing schedule');
    expect(Date.parse(out.scheduled_at)).toBeCloseTo(35000);
    expect(out.target_route_progress).toBeLessThan(0.6);
  });
  it('late sync near road end cancels',()=>{
    expect(eventClock(state(),event(),59000).kind).toBe('cancel');
  });
  it('arrival and city never schedule',()=>{
    expect(eventClock({...state(),currentLocationId:'end'},event(),1000).kind).toBe('cancel');
    expect(eventClock({...state(),travelScale:'city'},event(),1000).kind).toBe('cancel');
  });
  it('target behind a stopped party cancels',()=>{
    const s:any=state();delete s.activeTravel;s.journeyPlan.currentLegIndex=1;s.currentRoutePosition={routeId:'b',progress:0.4};
    expect(eventClock(s,event(),1000).kind).toBe('cancel');
  });
});