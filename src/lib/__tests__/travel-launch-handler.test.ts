import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { eligibleJourney, isOriginalHost, journeyHash, object, parseDecision, targetPoint } from '../../../supabase/functions/_shared/travel-planning';
const code = transpileModule(readFileSync('supabase/functions/party-travel-director/index.ts','utf8').replace(/^import .*;\r?\n/gm,''),
  { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
async function run(existing: Record<string, unknown> | null, commit = true) {
  const map = { routes: [{ id:'road', fromLocationId:'a', toLocationId:'b', distanceSource:'manual', distanceMiles:10 }],
    locations:[{id:'a'},{id:'b'}], currentLocationId:null,
    journeyPlan:{destinationLocationId:'b',pace:'normal',currentLegIndex:0,totalMiles:10,
      legs:[{routeId:'road',fromLocationId:'a',toLocationId:'b',reversed:false}]},
    activeTravel:{routeId:'road',reversed:false,startProgress:0,endProgress:1,startedAt:null,
      realDurationMs:60000,gameMinutes:60,startCampaignMinute:0,pace:'normal'} };
  let stored = existing;
  const rpc = vi.fn(async (..._args: any[]) => { if(commit) stored = { id:'durable',has_event:false,status:'no_event' }; return { data:commit,error:null }; });
  const db = { auth:{getUser:async()=>({data:{user:{id:'host'}},error:null})}, rpc,
    from: (table:string) => {
      const q: Record<string, any> = {};
      for(const method of ['select','eq','is','in','order','limit']) q[method]=()=>q;
      q.maybeSingle=async()=>({data:table==='parties' ? {created_by:'host',is_active:true} : table==='party_shared_state' ? {state_data:map} : stored,error:null});
      return q;
    } };
  const fetch = vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'{"event":false}'}}]})));
  const launchTravel = vi.fn(async(..._args: any[])=>({ok:true,planned:stored?.has_event===true}));
  const syncTravel = vi.fn();
  let handler: ((req: Request)=>Promise<Response>) | undefined;
  runInNewContext(code, { createClient:()=>db, corsHeaders:{},
    z:{object:()=>({strict:()=>({safeParse:(data:unknown)=>({success:true,data})})}),string:()=>({uuid:()=>({})}),enum:()=>({})},
    eligibleJourney,isOriginalHost,journeyHash,object,parseDecision,targetPoint,
    travelContext:async()=>({input:'synthetic road'}),launchTravel,syncTravel,fetch,Response,Date,AbortController,setTimeout,clearTimeout,
    Deno:{env:{get:()=> 'synthetic-only'},serve:(fn:typeof handler)=>{handler=fn;}} });
  if(!handler) throw new Error('Missing handler');
  const response=await handler(new Request('https://synthetic.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic-only'},body:JSON.stringify({partyId:'party',action:'launch'})}));
  return { response,data:await response.json(),fetch,launchTravel,syncTravel,rpc,map };
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
    expect(x.launchTravel.mock.calls[0]).toContainEqual({id:'durable',has_event:false,status:'no_event'});
    expect(x.rpc.mock.invocationCallOrder[0]).toBeLessThan(x.launchTravel.mock.invocationCallOrder[0]);
    expect(x.syncTravel).not.toHaveBeenCalled();
  });
  it('a planner failure still launches through a durable no-event row',async()=>{
    const x=await run(null);
    x.fetch.mockImplementation(async()=>new Response('planner down',{status:500}));
    const y=await run(null);
    expect(y.response.status).toBe(200); expect(y.data).toEqual({ok:true,planned:false});
    expect(y.rpc.mock.calls[0][0]).toBe('commit_private_travel_plan');
    expect(y.rpc.mock.calls[0][1]._plan).toMatchObject({has_event:false,status:'no_event'});
    expect(y.launchTravel).toHaveBeenCalledOnce();
    expect(y.launchTravel.mock.calls[0][5]).toMatchObject({has_event:false,status:'no_event'});
  });
  it('never launches or syncs after a rejected plan commit',async()=>{
    const x=await run(null,false);
    expect(x.response.status).toBe(409); expect(x.launchTravel).not.toHaveBeenCalled(); expect(x.syncTravel).not.toHaveBeenCalled();
  });
});