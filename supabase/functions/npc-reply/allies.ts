// npc-reply, D-24: NPC allies. An NPC joins the party when the player it offered to taps the
// offer under its line, or when the host adds it from the Mind screen; the host can also part ways.
// Every permission check happens here, before anything is written.
//
//   join: { messageId }   the player named in the NPC line's offer accepts it
//   add:  { npcId }       the host puts an NPC in the party
//   part: { npcId }       the host takes an NPC out of the party

import { MAX_ALLIES, joinOfferOf } from './prompt.ts';
import type { Deps, HandlerResult } from './handler.ts';
import type { NpcRepo, NpcRow } from './repo.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const reply = (status: number, body: Record<string, unknown>): HandlerResult => ({ status, body });
const refuse = (status: number, error: string): HandlerResult => reply(status, { error });

/** The reason an NPC cannot join the party right now, or null when it can. */
async function cannotJoin(npc: NpcRow, repo: NpcRepo): Promise<string | null> {
  if (npc.archived) return `${npc.name} is archived. Restore them first.`;
  if (npc.player_user_id) return `${npc.name} is a player's character, not an NPC.`;
  if (npc.combat_state) return npc.combat_state === 'ko' ? `${npc.name} is knocked out.` : `${npc.name} is dead.`;
  if (repo.enemyInOpenFight && (await repo.enemyInOpenFight(npc.id))) return `${npc.name} is fighting the party right now. Finish the fight first.`;
  const count = repo.countAllies ? await repo.countAllies(npc.party_id) : 0;
  if (count >= MAX_ALLIES) return `The party already travels with ${MAX_ALLIES} allies.`;
  return null;
}

/** Puts the NPC in the party, posts the table line and gives the NPC a memory of it. */
async function enlist(npc: NpcRow, allyOf: string, who: string, hostId: string, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!repo.setAlly) return refuse(500, 'Allies are not set up on this server yet.');
  const row = await repo.setAlly(npc.id, allyOf, new Date(deps.now()).toISOString());
  if (!row) return refuse(404, 'That NPC was not found.');
  await repo.postPartyLine?.(npc.party_id, hostId, `🤝 ${npc.name} joins the party.`);
  await repo.ensureEventMemory?.(npc.id, npc.party_id, `${npc.name} joined the party and now travels with them${who ? ` (${who})` : ''}.`);
  return reply(200, { ok: true, npc: npc.name, allySince: row.ally_since ?? null });
}

/** A player accepts the offer an NPC made under its line. */
export async function join(req: { userId: string; messageId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.messageId)) return refuse(400, 'Missing or invalid messageId.');
  const line = await repo.getLine(req.messageId);
  if (!line || !line.npc_id) return refuse(404, 'That offer is gone.');
  const offer = joinOfferOf(line.content);
  if (!offer) return refuse(404, 'That line has no offer to join.');
  if (offer.to !== req.userId) return refuse(403, `Only ${offer.name} can accept this offer.`);
  if (line.consumed) return refuse(409, 'That offer has passed: the round already went to the DM.');
  if (!(await repo.isMember(line.party_id, req.userId))) return refuse(403, "You're not seated at this table.");
  const npc = await repo.getNpc(line.npc_id);
  if (!npc || npc.party_id !== line.party_id) return refuse(404, 'That NPC is not at this table.');
  if (npc.ally_since) return reply(200, { ok: true, already: true, npc: npc.name, allySince: npc.ally_since });
  if (!npc.on_stage) return refuse(409, `${npc.name} isn't on stage right now.`);
  const why = await cannotJoin(npc, repo);
  if (why) return refuse(409, why);
  const hostId = await repo.getPartyHost(line.party_id);
  if (!hostId) return refuse(404, 'Party not found.');
  return enlist(npc, req.userId, `at ${offer.name}'s invitation`, hostId, deps);
}

/** The host puts an NPC in the party. */
export async function add(req: { userId: string; npcId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.npcId)) return refuse(400, 'Missing or invalid npcId.');
  const npc = await repo.getNpc(req.npcId);
  if (!npc) return refuse(404, 'That NPC was not found.');
  const hostId = await repo.getPartyHost(npc.party_id);
  if (!hostId || hostId !== req.userId) return refuse(403, 'Only the host can add an NPC to the party.');
  if (npc.ally_since) return reply(200, { ok: true, already: true, npc: npc.name, allySince: npc.ally_since });
  const why = await cannotJoin(npc, repo);
  if (why) return refuse(409, why);
  return enlist(npc, req.userId, 'the host brought them in', hostId, deps);
}

/** The host takes an NPC out of the party. Nothing is deleted: the NPC stays on the roster. */
export async function part(req: { userId: string; npcId: unknown }, deps: Deps): Promise<HandlerResult> {
  const { repo } = deps;
  if (!isUuid(req.npcId)) return refuse(400, 'Missing or invalid npcId.');
  const npc = await repo.getNpc(req.npcId);
  if (!npc) return refuse(404, 'That NPC was not found.');
  const hostId = await repo.getPartyHost(npc.party_id);
  if (!hostId || hostId !== req.userId) return refuse(403, 'Only the host can part ways with an ally.');
  if (!npc.ally_since) return reply(200, { ok: true, already: true, npc: npc.name });
  if (!repo.setAlly) return refuse(500, 'Allies are not set up on this server yet.');
  await repo.setAlly(npc.id, null, new Date(deps.now()).toISOString());
  await repo.postPartyLine?.(npc.party_id, hostId, `🤝 ${npc.name} parts ways with the party.`);
  await repo.ensureEventMemory?.(npc.id, npc.party_id, `${npc.name} parted ways with the party and no longer travels with them.`);
  return reply(200, { ok: true, npc: npc.name });
}
