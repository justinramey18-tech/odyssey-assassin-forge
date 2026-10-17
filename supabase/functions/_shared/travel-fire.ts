import { activeMap, object, savedTravelRoute, text } from './travel-planning.ts';
import { travelContext } from './travel-context.ts';
const FALLBACK='The journey halts as something along the way demands attention. For now, the party remains where it is. What do you look for or investigate?';
const INSTRUCTION=`This is the opening beat of a journey interruption that has just paused travel. APP-OWNED MAP STATE is canon above every guide or summary.
Narrate at the exact paused travel position, respecting mounted or direct air travel when supplied. Never put a flying party on a ground road. Use the private premise as behind-the-screen intent, never quote it.
Write an immersive Party DM response with something concrete to react to, matching the guides and recent narrative voice.
Do not make player characters act or speak, resolve decisions, resume travel, move farther, or announce destination arrival unless the map says so.
Never mention scheduling, QStash, hidden plans, percentages, callbacks, or event triggers. No private-premise user post is created.`;
export async function fireTravel(db:any,partyId:string,eventId:string,generate:(system:string,input:string,model?:string)=>Promise<string>) {
  const {data:e,error}=await db.from('party_travel_events').select('*').eq('id',eventId).eq('party_id',partyId).maybeSingle();
  if(error) return 503;
  if(!e || ['planned','posted','cancelled','no_event','failed'].includes(e.status)) return 200;
  const {data:paused,error:pauseError}=await db.rpc('pause_campaign_travel_for_event',{_event_id:eventId});
  if(pauseError) return 503;
  if(!paused?.paused) {
    if(paused?.reason==='not_due') return 503;
    const {error:cancelError}=await db.from('party_travel_events').update({status:'cancelled'})
      .eq('id',eventId).eq('updated_at',e.updated_at).in('status',['planned','scheduled','firing']);
    if(cancelError) return 503;
    return 200;
  }
  const {data:claim,error:claimError}=await db.rpc('claim_travel_event_attempt',{_event_id:eventId});
  if(claimError) return 503;
  if(!claim?.claimed) return claim?.busy ? 503 : 200;
  let content='',failed=false;
  try {
    const {data:row,error:mapError}=await db.from('party_shared_state').select('state_data').eq('party_id',partyId).eq('user_id',e.created_by).eq('state_type','campaign_map').maybeSingle();
    const map=activeMap(row?.state_data);
    if(mapError || !map || map.state.activeTravel?.startedAt!==null) throw new Error('Paused context unavailable');
    const j={...map,plan:map.state.journeyPlan,travel:map.state.activeTravel,remaining:[],remainingMiles:0,now:Date.now(),campaignMinute:paused.campaignMinute};
    const ctx=await travelContext(db,partyId,e.created_by,j as any);
    const route=savedTravelRoute(map.state,paused.routeId);
    const input=`${ctx.input}\n\n## APP-OWNED PAUSED MAP STATE\n${JSON.stringify({map:map.name,method:map.state.journeyPlan?.pace,route:paused.routeId,description:text(route?.description,500),terrainFactor:route?.terrainFactor,distanceMiles:route?.distanceMiles,progress:paused.routeProgress,campaignMinute:paused.campaignMinute,destination:paused.destinationLocationId,position:map.state.currentRoutePosition})}\n\n## PRIVATE INTENT (DO NOT QUOTE)\nType: ${text(e.event_type,80)}\n${text(e.event_premise,2000)}`;
    const model=text(ctx.session.dmModel,100);
    try { content=await generate(INSTRUCTION,input,model); } catch { content=await generate(INSTRUCTION,input); }
    if(!content.trim()) throw new Error('Blank narration');
  } catch {
    if(claim.attempt<3) {
      await db.from('party_travel_events').update({last_error:'Travel narration unavailable; retry pending',firing_lease_id:null,firing_lease_until:null})
        .eq('id',eventId).eq('firing_lease_id',claim.leaseId);
      return 503;
    }
    content=FALLBACK; failed=true;
  }
  const {data:post,error:postError}=await db.rpc('complete_travel_event_post',{_event_id:eventId,_lease_id:claim.leaseId,_content:content,_failed:failed});
  return postError || !post ? 503 : 200;
}