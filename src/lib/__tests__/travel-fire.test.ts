import { describe,it,expect,vi } from 'vitest';
import { fireTravel } from '../../../supabase/functions/_shared/travel-fire';
vi.mock('../../../supabase/functions/_shared/travel-context',()=>({travelContext:async()=>({input:'Shared road context',session:{dmModel:'venice/qwen-3-6-plus'}})}));
function setup(status='scheduled',attempt=1) {
  const calls:string[]=[];
  const e={id:'e',party_id:'p',created_by:'h',status,event_type:'social',event_premise:'Private premise'};
  const updates:any[]=[];
  const db:any={from:(table:string)=>{
    const q:any={select:()=>q,eq:()=>q,in:()=>q,update:(x:any)=>{updates.push(x);return q;},
      maybeSingle:async()=>({data:table==='party_travel_events'?e:{state_data:{routes:[],locations:[],journeyPlan:{pace:'normal',destinationLocationId:'end'},activeTravel:{startedAt:null},currentRoutePosition:{routeId:'a',progress:0.5}}}}),
      then:(resolve:any)=>Promise.resolve({data:null,error:null}).then(resolve)};return q;
  },rpc:async(name:string,args:any)=>{
    calls.push(name);
    if(name==='pause_campaign_travel_for_event') return {data:{paused:true,campaignMinute:120,routeId:'a',routeProgress:0.5,destinationLocationId:'end'}};
    if(name==='claim_travel_event_attempt') return {data:{claimed:true,leaseId:'lease',attempt}};
    if(name==='complete_travel_event_post') {updates.push(args);return {data:'post'};}
    throw new Error('Unexpected call');
  }};
  return {db,calls,updates};
}
describe('offline road firing',()=>{
  it('pauses and claims before narration, then atomically writes only the assistant beat',async()=>{
    const x=setup();const generate=vi.fn(async()=>{expect(x.calls).toEqual(['pause_campaign_travel_for_event','claim_travel_event_attempt']);return 'A traveler raises a lantern.';});
    expect(await fireTravel(x.db,'p','e',generate)).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
    expect(x.updates.at(-1)).toMatchObject({_content:'A traveler raises a lantern.',_failed:false});
  });
  it('falls back once after preferred provider fails',async()=>{
    const x=setup();const generate=vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('A traveler waits.');
    expect(await fireTravel(x.db,'p','e',generate)).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]).toHaveLength(2);
  });
  it('AI failure remains retryable and never writes a premature post',async()=>{
    const x=setup();expect(await fireTravel(x.db,'p','e',vi.fn().mockRejectedValue(new Error('down')))).toBe(503);
    expect(x.calls).not.toContain('complete_travel_event_post');
    expect(x.updates[0].last_error).not.toContain('Private premise');
  });
  it('third AI failure creates only the generic non-secret interruption',async()=>{
    const x=setup('firing',3);expect(await fireTravel(x.db,'p','e',vi.fn().mockRejectedValue(new Error('down')))).toBe(200);
    expect(x.updates.at(-1)).toMatchObject({_failed:true});
    expect(x.updates.at(-1)._content).not.toContain('Private premise');
  });
  it('terminal and unarmed events never call the model or pause',async()=>{
    for(const status of ['posted','cancelled','failed','no_event','planned']) {
      const x=setup(status),generate=vi.fn();expect(await fireTravel(x.db,'p','e',generate)).toBe(200);
      expect(x.calls).toHaveLength(0);expect(generate).not.toHaveBeenCalled();
    }
  });
  it('a busy worker does not generate a second beat',async()=>{
    const x=setup();const rpc=x.db.rpc;x.db.rpc=async(name:string,args:any)=>name==='claim_travel_event_attempt'?{data:{claimed:false,busy:true}}:rpc(name,args);
    const generate=vi.fn();expect(await fireTravel(x.db,'p','e',generate)).toBe(503);expect(generate).not.toHaveBeenCalled();
  });
  it('stale callbacks cancel without narration and return success',async()=>{
    const x=setup();x.db.rpc=async()=>({data:{paused:false,stale:true,reason:'changed_tranche'}});
    const generate=vi.fn();expect(await fireTravel(x.db,'p','e',generate)).toBe(200);
    expect(x.updates[0]).toEqual({status:'cancelled'});expect(generate).not.toHaveBeenCalled();
  });
  it('early callback is retryable and does not cancel the event',async()=>{
    const x=setup();x.db.rpc=async()=>({data:{paused:false,reason:'not_due'}});
    expect(await fireTravel(x.db,'p','e',vi.fn())).toBe(503);expect(x.updates).toHaveLength(0);
  });
});