import { eventClock } from './travel-event-clock.ts';
import { cancelQstash } from './travel-sync.ts';
import { object, type Journey } from './travel-planning.ts';

// No map writes here: only the locked arm RPC can start the staged tranche.
export async function launchTravel(db: any, partyId: string, token: string, journey: Journey,
  expectedMap: unknown, event: Record<string, any>) {
  if (journey.travel.startedAt !== null || !event.id
    || !((event.has_event === false && event.status === 'no_event')
      || (event.has_event === true && event.status === 'planned'
        && event.scheduled_at === null && event.qstash_message_id === null)))
    throw new Error('The journey changed. Try again.');
  const startedAt = Date.now() + 5000;
  let schedule: Record<string, unknown> | null = null;
  let messageId: string | undefined;
  if (event.has_event) {
    const projection = eventClock({ ...journey.state, activeTravel: { ...journey.travel, startedAt } }, event, startedAt);
    // Targets outside this tranche cannot be armed by the current storage contract.
    // Fail closed rather than starting an unarmed journey or moving its target.
    if (projection.kind !== 'schedule' || projection.target_route_progress !== event.target_route_progress)
      throw new Error('Travel scheduling unavailable.');
    try {
      const url = Deno.env.get('SUPABASE_URL');
      const res = await fetch(`${url}/functions/v1/schedule-timer-callback`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyId, travelEventId: event.id, scheduledAt: projection.scheduled_at, launchTravelEvent: true }),
      });
      if (!res.ok) throw new Error('Publication failed');
      const result = object(await res.json());
      if (typeof result.messageId !== 'string' || !result.messageId.trim()) throw new Error('Missing receipt');
      messageId = result.messageId;
      const { kind: _kind, ...fields } = projection;
      schedule = { ...fields, qstash_message_id: messageId };
    } catch { throw new Error('Travel scheduling unavailable.'); }
  }
  try {
    const { data: armed, error } = await db.rpc('arm_private_travel_launch', {
      _event_id: event.id, _expected_map: expectedMap, _started_at: startedAt, _schedule: schedule,
    });
    if (error || armed !== true) throw new Error('Arm rejected');
  } catch {
    if (messageId) await cancelQstash(messageId);
    throw new Error('Travel launch failed. Try again.');
  }
  return { ok: true, planned: event.has_event === true };
}