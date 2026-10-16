import { activeMap, eligibleJourney, journeyHash, object } from './travel-planning.ts';
import { eventClock } from './travel-event-clock.ts';
export async function cancelQstash(id: unknown) {
  const key=Deno.env.get('QSTASH_TOKEN');
  if (!key || typeof id !== 'string' || !id) return;
  try { await fetch(`https://qstash.upstash.io/v2/messages/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${key}`}}); } catch { /* stale validation remains authoritative */ }
}
export async function syncTravel(db: any, partyId:string, host:string, token:string, cancel=false) {
  const {data:rows,error}=await db.from('party_travel_events').select('*').eq('party_id',partyId).in('status',['planned','scheduled','no_event']);
  if(error) throw new Error('Sync failed');
  if(cancel) {
    for(const e of rows || []) {
      const {error:err}=await db.from('party_travel_events').update({status:'cancelled',scheduled_at:null,expected_tranche_started_at:null,qstash_message_id:null})
        .eq('id',e.id).eq('updated_at',e.updated_at).in('status',['planned','scheduled','no_event']);
      if(err) throw new Error('Cancel failed');
      await cancelQstash(e.qstash_message_id);
    }
    return;
  }
  const e=rows?.[0]; if(!e || e.status==='no_event') return;
  const {data:row,error:mapError}=await db.from('party_shared_state').select('state_data').eq('party_id',partyId).eq('user_id',host).eq('state_type','campaign_map').maybeSingle();
  if(mapError) throw new Error('Sync failed');
  const map=activeMap(row?.state_data), st=map?.state;
  let projection: ReturnType<typeof eventClock>={kind:'cancel'};
  if(map && st?.journeyPlan && st.travelScale!=='city' && map.mapId===e.map_id
    && st.journeyPlan.destinationLocationId===e.destination_location_id) {
    // Hash uses only stable plan fields; running/paused state is irrelevant here.
    const hash=await journeyHash({plan:st.journeyPlan} as any);
    if(hash===e.journey_plan_hash) projection=eventClock(st,e,Date.now());
  }
  if(projection.kind==='schedule' && projection.target_route_progress!==e.target_route_progress) {
    const j=eligibleJourney(row?.state_data,Date.now());
    const leg=j?.remaining.find(r=>r.legIndex===e.target_leg_index);
    if(!j || !leg) projection={kind:'cancel'};
    else {
      const dir=e.target_reversed ? 1-projection.target_route_progress : projection.target_route_progress;
      const before=j.remaining.filter(r=>r.legIndex<e.target_leg_index).reduce((n,r)=>n+r.miles,0);
      const distance=before+(dir-leg.start)*leg.fullMiles;
      if(distance<0 || distance/j.remainingMiles>=0.9) projection={kind:'cancel'};
    }
  }
  if(projection.kind==='schedule' && e.status==='scheduled' && e.expected_tranche_started_at===projection.expected_tranche_started_at
    && e.target_tranche_fraction===projection.target_tranche_fraction && e.qstash_message_id) return;
  const patch=projection.kind==='schedule' ? {...projection,status:'scheduled'} : {status:projection.kind==='cancel' ? 'cancelled':'planned'};
  const {data:changed,error:syncError}=await db.rpc('sync_private_travel_event',{_event_id:e.id,_expected_updated_at:e.updated_at,_expected_map:row?.state_data ?? null,_patch:patch});
  if(syncError) throw new Error('Sync failed');
  if(!changed) return;
  await cancelQstash(e.qstash_message_id);
  if(projection.kind!=='schedule') return;
  const url=Deno.env.get('SUPABASE_URL');
  const res=await fetch(`${url}/functions/v1/schedule-timer-callback`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({partyId,travelEventId:e.id,scheduledAt:projection.scheduled_at})});
  if(!res.ok) throw new Error('Scheduling failed');
  const result=object(await res.json());
  if(typeof result.messageId!=='string') throw new Error('Scheduling failed');
  const {data:saved,error:saveError}=await db.from('party_travel_events').update({qstash_message_id:result.messageId})
    .eq('id',e.id).eq('status','scheduled').eq('expected_tranche_started_at',projection.expected_tranche_started_at)
    .eq('scheduled_at',projection.scheduled_at).select('id');
  if(saveError || !saved?.length) await cancelQstash(result.messageId);
  if(saveError) throw new Error('Scheduling failed');
}