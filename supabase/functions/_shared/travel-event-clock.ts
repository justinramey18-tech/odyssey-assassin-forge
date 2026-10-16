// Exact tranche/direction projection; pure and used only on the server.
type Row = Record<string, any>;
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export function eventClock(state: Row, event: Row, now: number) {
  const t = state.activeTravel, plan = state.journeyPlan;
  if (!plan || !Array.isArray(plan.legs) || state.travelScale === 'city' || state.currentLocationId === event.destination_location_id)
    return { kind: 'cancel' } as const;
  if (!t) {
    const p=state.currentRoutePosition;
    const idx=plan.currentLegIndex;
    if(event.target_leg_index<idx) return {kind:'cancel'} as const;
    if(p?.routeId===event.target_route_id && event.target_leg_index===idx) {
      const currentDir=event.target_reversed ? 1-p.progress : p.progress;
      const targetDir=event.target_reversed ? 1-event.target_route_progress : event.target_route_progress;
      if(currentDir>=targetDir-1e-9) return {kind:'cancel'} as const;
    }
    return { kind: 'wait' } as const;
  }
  const segments: Row[] = t.segments?.length ? t.segments : [{ ...t, legIndex:plan.currentLegIndex }];
  const total = segments.reduce((n,s) => n+s.gameMinutes,0);
  if (!finite(total) || total <= 0 || !finite(t.realDurationMs) || t.realDurationMs <= 0) return {kind:'cancel'} as const;
  const base = finite(t.pausedFraction) ? Math.max(0,Math.min(1,t.pausedFraction)) : 0;
  const current = t.startedAt === null ? base : Math.min(1,base+Math.max(0,now-t.startedAt)/t.realDurationMs*(1-base));
  let elapsed=0, target: Row | undefined;
  for (const seg of segments) {
    const dir = event.target_reversed ? 1-event.target_route_progress : event.target_route_progress;
    if (seg.legIndex === event.target_leg_index && seg.routeId === event.target_route_id && seg.reversed === event.target_reversed
      && dir >= seg.startProgress-1e-9 && dir <= seg.endProgress+1e-9) {
      const k=(dir-seg.startProgress)/(seg.endProgress-seg.startProgress);
      target={ fraction:(elapsed+k*seg.gameMinutes)/total, routeProgress:event.target_route_progress };
      break;
    }
    elapsed+=seg.gameMinutes;
  }
  if (!target) {
    const last=segments[segments.length-1];
    const targetDir=event.target_reversed ? 1-event.target_route_progress : event.target_route_progress;
    const same=segments.find(s=>s.legIndex===event.target_leg_index);
    return {kind:event.target_leg_index < (last?.legIndex ?? plan.currentLegIndex)
      || (same && targetDir<same.startProgress-1e-9) ? 'cancel' : 'wait'} as const;
  }
  if (target.fraction <= current+1e-9) {
    // A late sync never rewinds. Only nudge ahead on this same leg with meaningful road left.
    const safe=current+(t.startedAt === null ? 0 : 3000/t.realDurationMs*(1-base));
    const dir=event.target_reversed ? 1-event.target_route_progress : event.target_route_progress;
    const seg=segments.find(s => s.legIndex===event.target_leg_index);
    if (!seg || t.startedAt === null || safe >= 0.9 || safe >= 1) return {kind:'cancel'} as const;
    let before=0; for (const s of segments) { if(s===seg) break; before+=s.gameMinutes; }
    const k=(safe*total-before)/seg.gameMinutes;
    const progress=seg.startProgress+(seg.endProgress-seg.startProgress)*k;
    if (k < 0 || k >= 1 || progress >= 0.98 || progress <= dir) return {kind:'cancel'} as const;
    // Strict remaining-journey distance bound is checked by the caller as well.
    target={fraction:safe,routeProgress:seg.reversed ? 1-progress : progress};
  }
  if (t.startedAt === null) return {kind:'wait'} as const;
  if (!finite(t.startedAt) || base>=1) return {kind:'cancel'} as const;
  const scheduledMs=t.startedAt+(target.fraction-base)/(1-base)*t.realDurationMs;
  if (!finite(scheduledMs)) return {kind:'cancel'} as const;
  return {kind:'schedule', target_tranche_fraction:target.fraction,
    target_campaign_minute:t.startCampaignMinute+total*target.fraction,
    target_route_progress:target.routeProgress, expected_tranche_started_at:t.startedAt,
    scheduled_at:new Date(scheduledMs).toISOString()} as const;
}