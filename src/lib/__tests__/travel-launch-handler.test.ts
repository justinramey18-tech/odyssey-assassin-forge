import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { eligibleJourney, isOriginalHost, journeyHash, object, parseDecision, targetPoint } from '../../../supabase/functions/_shared/travel-planning';
const code = transpileModule(readFileSync('supabase/functions/party-travel-director/index.ts','utf8').replace(/^import .*;\r?\n/gm,''),
  { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
async function run(existing: Record<string, unknown> | null, commit = true, content = '{"event":false,"eventType":null,"premise":null,"targetFraction":null}', providerStatus = 200) {
  const map = { routes: [{ id:'road', fromLocationId:'a', toLocationId:'b', distanceSource:'manual', distanceMiles:10 }],
    locations:[{id:'a'},{id:'b'}], currentLocationId:null,
    journeyPlan:{destinationLocationId:'b',pace:'normal',currentLegIndex:0,totalMiles:10,
      legs:[{routeId:'road',fromLocationId:'a',toLocationId:'b',reversed:false}]},
    activeTravel:{routeId:'road',reversed:false,startProgress:0,endProgress:1,startedAt:null,
      realDurationMs:60000,gameMinutes:60,startCampaignMinute:0,pace:'normal'} };
  let stored = existing;
  const rpc = vi.fn(async (...args: any[]) => { if(commit) stored = { id:'durable',...args[1]._plan }; return { data:commit,error:null }; });
  const update = vi.fn(() => ({eq:async()=>({error:null})}));
  const db = { auth:{getUser:async()=>({data:{user:{id:'host'}},error:null})}, rpc,
    from: (table:string) => {
      const q: Record<string, any> = {};
      for(const method of ['select','eq','is','in','order','limit']) q[method]=()=>q;
      q.update = update;
      q.maybeSingle=async()=>({data:table==='parties' ? {created_by:'host',is_active:true} : table==='party_shared_state' ? {state_data:map} : stored,error:null});
      return q;
    } };
  const fetch = vi.fn(async (..._args: any[])=>new Response(JSON.stringify({choices:[{message:{content}}]}),{status:providerStatus}));
  const launchTravel = vi.fn(async(..._args: any[])=>({ok:true,planned:stored?.has_event===true}));
  const syncTravel = vi.fn();
  let handler: ((req: Request)=>Promise<Response>) | undefined;
  runInNewContext(code, { createClient:()=>db, corsHeaders:{},
    z:{object:()=>({strict:()=>({safeParse:(data:unknown)=>({success:true,data})})}),string:()=>({uuid:()=>({})}),enum:()=>({})},
    eligibleJourney,isOriginalHost,journeyHash,object,parseDecision,targetPoint,
    travelContext:async()=>({input:'synthetic road'}),launchTravel,syncTravel,fetch,Response,Date,AbortController,setTimeout,clearTimeout,
    console:{warn:vi.fn()},
    Deno:{env:{get:()=> 'synthetic-only'},serve:(fn:typeof handler)=>{handler=fn;}} });
  if(!handler) throw new Error('Missing handler');
  const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic-only'},body:JSON.stringify({partyId:'party',action:'launch'})}));
  return { response,data:await response.json(),fetch,launchTravel,syncTravel,rpc,map,update };
}
describe('launch request routing',()=>{
  it.each([false,true])('reuses existing durable outcome (event=%s) without invoking the planner',async has_event=>{
    const x=await run({id:'existing',has_event,status:has_event?'planned':'no_event'});
    expect(x.response.status).toBe(200); expect(x.data).toEqual({ok:true,planned:has_event});
    expect(x.fetch).not.toHaveBeenCalled(); expect(x.rpc).not.toHaveBeenCalled(); expect(x.launchTravel).toHaveBeenCalledOnce(); expect(x.syncTravel).not.toHaveBeenCalled();
  });
  it('plans once, commits, reads the durable row and then launches',async()=>{
    const x=await run(null);
    expect(x.response.status).toBe(200); expect(x.fetch).toHaveBeenCalledOnce(); expect(x.rpc).toHaveBeenCalledOnce();
    expect(x.launchTravel.mock.calls[0][5]).toMatchObject({id:'durable',has_event:false,status:'no_event'});
    expect(x.rpc.mock.invocationCallOrder[0]).toBeLessThan(x.launchTravel.mock.invocationCallOrder[0]);
    expect(x.syncTravel).not.toHaveBeenCalled();
  });
  it('a planner failure still launches through a durable no-event row',async()=>{
    const y=await run(null,true,'',500);
    expect(y.response.status).toBe(200); expect(y.data).toEqual({ok:true,planned:false});
    expect(y.rpc.mock.calls[0][0]).toBe('commit_private_travel_plan');
    expect(y.rpc.mock.calls[0][1]._plan).toMatchObject({has_event:false,status:'no_event'});
    expect(y.launchTravel).toHaveBeenCalledOnce();
    expect(y.launchTravel.mock.calls[0][5]).toMatchObject({has_event:false,status:'no_event'});
    expect(y.update).toHaveBeenCalledWith({last_error:'planner_provider_http_500'});
  });
  it('requests the strict four-field nullable schema without changing model settings',async()=>{
    const x=await run(null);
    const request = JSON.parse(x.fetch.mock.calls[0][1].body);
    expect(request).toMatchObject({model:'qwen-3-6-plus',temperature:0.4,max_tokens:900});
    expect(request.response_format).toEqual({type:'json_schema',json_schema:{name:'travel_decision',strict:true,schema:{
      type:'object',additionalProperties:false,required:['event','eventType','premise','targetFraction'],
      properties:{event:{type:'boolean'},eventType:{type:['string','null'],maxLength:80},
        premise:{type:['string','null'],maxLength:2000},targetFraction:{type:['number','null'],minimum:0.15,maximum:0.85}},
    }}});
    expect(x.update).not.toHaveBeenCalled();
  });
  it('commits a valid structured event instead of falling back to no-event',async()=>{
    const x=await run(null,true,JSON.stringify({event:true,eventType:'social',premise:'synthetic road encounter',targetFraction:0.5}));
    expect(x.response.status).toBe(200);
    expect(x.rpc.mock.calls[0][1]._plan).toMatchObject({has_event:true,status:'planned',event_type:'social',target_overall_fraction:0.5});
    expect(x.launchTravel.mock.calls[0][5]).toMatchObject({has_event:true,status:'planned'});
    expect(x.update).not.toHaveBeenCalled();
  });
  it('retains invalid-decision diagnostics and safe launch fallback',async()=>{
    const x=await run(null,true,'{"event":false,"eventType":null,"premise":"contradiction","targetFraction":null}');
    expect(x.response.status).toBe(200);
    expect(x.rpc.mock.calls[0][1]._plan).toMatchObject({has_event:false,status:'no_event'});
    expect(x.update).toHaveBeenCalledWith({last_error:'planner_invalid_decision'});
    expect(x.launchTravel).toHaveBeenCalledOnce();
  });
  it('never launches or syncs after a rejected plan commit',async()=>{
    const x=await run(null,false);
    expect(x.response.status).toBe(409); expect(x.launchTravel).not.toHaveBeenCalled(); expect(x.syncTravel).not.toHaveBeenCalled();
  });
});