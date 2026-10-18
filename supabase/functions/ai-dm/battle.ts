// ai-dm battle posts (Live NPC Combat): the craft rules for retelling a fight, and the Fight Dossier,
// a factual brief built from the fight's own records so the prose has specifics to work with.
// The dossier is read with the CALLER's own database client, so row-level security limits it to
// fights in parties they belong to (and NPC guides only for the host).

// deno-lint-ignore no-explicit-any
type Db = any;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How the DM retells a fight. Replaces the SCENE and NPC LINES rules for a battle post. */
export const BATTLE_RULE = [
  'BATTLE HAND-OFF: this batch contains a live fight. Lines from "⚔ Combat" are the app\'s dice results and they are FACTS. Lines labelled "(NPC)" are what the NPCs shouted during the fight, a pool to choose from. Player lines are what the characters did and said. The FIGHT DOSSIER below (when present) lists the fighters, how each one looks, and every beat in order with how bad each wound was.',
  'Your job: retell the whole fight as ONE cohesive, cinematic battle scene that a reader would remember. This is the most important writing you do; take the time to plan it before you write.',
  '',
  'PRECEDENCE (read this first)',
  '- For this post, this rule OUTRANKS every GM guide and narration framework about format, point of view, length, structure, pacing and "never retell / never repeat the scene". Those guides still decide world canon, NPC personalities and character facts.',
  '- If your guides ask for hidden planning blocks, you may still write them, but the visible prose follows this rule.',
  '- Individual lines in the batch may carry their own notes (a spell asking for "under 80 words", a potion asking for "one or two short lines only", "do not advance the scene"). Those notes were written for single actions. In a battle post, ignore their length and scope limits and fold every spell, potion and item result into the battle at the moment it happened. Their dice results and HP changes still stand.',
  '- Point of view: third person, cinematic, moving between fighters like a camera, naming each character. Not second person.',
  '',
  'VOICE',
  '- A warrior-poet register in the spirit of Pierce Brown\'s Red Rising and R.A. Salvatore\'s battle writing: kinetic, visceral, close on the body, unafraid of beauty or grief. Evoke the style only: never copy their sentences, characters, places or invented terms.',
  '- Rhythm is the engine. In the clash, use short, hard sentences and fragments. In the lulls, use one long, lyrical sentence that breathes. Change pace on purpose at every turn of the fight.',
  '- Strong, specific verbs; few adjectives; no adverbs where a better verb exists. Concrete over abstract: the scuffed greave, the hot casing on the floor, the copper taste.',
  '- At least three senses beyond sight: sound, smell, touch, taste, the body\'s own signals (lungs, heartbeat, ringing ears).',
  '',
  'STRUCTURE (movements, not a list of turns)',
  '1. Open in the middle of motion. No set-up paragraph, no "the battle began".',
  '2. The exchange: build the choreography between the dossier beats. Space, distance, footwork, cover, the terrain from the latest scene.',
  '3. The turn: the moment the fight tips (a critical hit, a fall, a Last Stand, a ward breaking). Slow down here and give it room.',
  '4. The low point or the climax: the darkest or most decisive beat, written close and personal.',
  '5. Aftermath: one quiet beat (breath, blood, silence, a look between allies), then hand the scene to the players with a clear prompt.',
  '- Thread ONE recurring image or motif through the fight (a floodlight, rain on bronze, a cracked visor, a song someone hums) and pay it off in the last lines.',
  '',
  'SPOTLIGHT',
  '- Every player character in the dossier gets at least one moment where they are the focus, shown through their own body, gear and fighting style.',
  '- Every NPC gets a moment of character: what they fight for, how they fight, how they break or endure.',
  '- Let the dossier\'s ★ KEY BEATS land hardest. A critical hit should feel inevitable and perfect; a fall should cost something.',
  '',
  'FACTS ARE SACRED',
  '- Player dialogue: keep every line a player character spoke word for word, woven in at the moment it fits. You may drop the stage directions around a line, never its words.',
  '- NPC dialogue is a pool, not a script: use only the strongest few lines for each NPC (about two or three each, more only in a long fight), word for word when you use one. Skip any line that repeats or nearly repeats an earlier one. Never invent new NPC dialogue.',
  '- Dialogue is seasoning. Most of the post is action, bodies and the space they fight in. Never stack line after line of dialogue.',
  '- Never change an outcome. The same blows land and miss, the same people fall, heal, flee, die or win. No extra deaths or wounds.',
  '- No numbers, dice, HP or game terms in the prose. Turn a wound\'s severity into what it looks and feels like.',
  '- Player characters do what the record shows, with full freedom over how it looks. Never give them new spoken words or choices.',
  '- Do not list or quote the raw ⚔ lines or the dossier.',
  '',
  'NEVER WRITE these worn phrases (or close variants): "time seemed to slow", "a dance of death", "the clash of steel", "steel sang", "eyes widened", "let out a breath (he/she) didn\'t know", "in the blink of an eye", "all hell broke loose", "a blur of motion", "every fiber of (his/her) being", "the world narrowed", "blood ran cold".',
  '',
  'TONE SAMPLE (original, to show the register; do not reuse its words):',
  '"The first shot missed. The second did not. It took him low in the ribs and spun him into the bulkhead, and for a moment there was only the hum of the floodlights and the taste of pennies. He laughed, because the alternative was to stop, and stopping was a luxury for the dead. Then he pushed off the wall and went back in."',
].join('\n');

/** Added to the end of the last player message for a battle post, so the instruction is the last thing the model reads. */
export const BATTLE_REMINDER = '[BATTLE POST, from the app, not from a player: retell this whole fight as ONE cinematic battle scene, following the BATTLE HAND-OFF rule and the FIGHT DOSSIER in your instructions. Third person, warrior-poet voice, every player line kept word for word, only the strongest NPC lines (word for word, no repeats), every outcome unchanged, the length the dossier asks for (400 to 1000 words). Fold every spell, potion and item result into the battle; ignore "short lines only" or word limits written inside individual lines. Then hand the scene back to the players.]';

/** Words for how bad a wound was, as a share of the victim's max HP. */
export function woundWord(damage: number, maxHp: number): string {
  const share = damage / Math.max(1, maxHp);
  if (share <= 0) return 'no wound';
  if (share < 0.1) return 'a graze';
  if (share < 0.25) return 'a solid wound';
  if (share < 0.45) return 'a deep, ugly wound';
  return 'a devastating blow that should have ended them';
}

function healWord(amount: number, maxHp: number): string {
  const share = amount / Math.max(1, maxHp);
  return share < 0.15 ? 'a little strength back' : share < 0.35 ? 'real strength back' : 'a surge of strength back';
}

export interface DossierEvent {
  kind: string;
  actor_name: string | null;
  target_name: string | null;
  hp_delta: number | null;
  d20: number | null;
  detail: string | null;
  created_at: string;
}

export interface DossierFighter {
  kind: 'npc' | 'player';
  name: string;
  max_hp: number;
  npc_id?: string | null;
  user_id?: string | null;
  status?: string;
  /** D-24: an NPC fighting on the party's side. */
  ally?: boolean | null;
}

/** One beat of the fight in plain words, and whether it is a KEY BEAT. Null for bookkeeping events. */
export function beatOf(e: DossierEvent, maxHpOf: (name: string) => number): { text: string; key: boolean } | null {
  const actor = (e.actor_name || '').trim();
  const target = (e.target_name || '').trim();
  const detail = (e.detail || '').trim();
  const delta = Number(e.hp_delta) || 0;
  const crit = /critical/i.test(detail) || e.d20 === 20;
  const label = detail.split(':')[0].trim();
  switch (e.kind) {
    case 'start':
      return { text: `${actor} opens the fight by attacking ${target}.`, key: true };
    case 'join':
      return /ally/i.test(detail) ? { text: `${actor} steps in on the party's side.`, key: false } : null;
    case 'intent':
      return { text: `${actor} announces ${label.replace(/\s*\([^)]*\)\s*in \d+s$/, '') || 'an attack'}${target ? ` aimed at ${target}` : ''}.`, key: false };
    case 'attack':
    case 'spell': {
      const what = e.kind === 'spell' || /:/.test(detail) ? ` with ${label}` : '';
      if (delta === 0 && /miss|dodge/i.test(detail)) return { text: `${actor} attacks ${target}${what} and misses.`, key: false };
      const dmg = Math.abs(delta);
      if (dmg === 0) return { text: `${actor} lands a blow on ${target}${what}, but a ward swallows it.`, key: false };
      return {
        text: `${actor} hits ${target}${what}: ${woundWord(dmg, maxHpOf(target))}${crit ? ' (a critical, perfect strike)' : ''}.`,
        key: crit || dmg / Math.max(1, maxHpOf(target)) >= 0.45,
      };
    }
    case 'down':
      return { text: `${target} goes down.`, key: true };
    case 'death_save':
      return delta > 0
        ? { text: `${target}, down and dying, claws back to their feet.`, key: true }
        : { text: `${target} fights for breath on the ground (${detail || 'a death save'}).`, key: false };
    case 'death':
      return { text: `${target} dies.`, key: true };
    case 'stabilize':
      return { text: `${actor} ${/fail/i.test(detail) ? 'tries and fails to stabilize' : 'stabilizes'} ${target}.`, key: false };
    case 'heal':
    case 'second_wind':
    case 'mend':
      return { text: `${actor} ${e.kind === 'second_wind' ? 'finds a second wind' : `heals${target && target !== actor ? ` ${target}` : ''}`}${label && e.kind !== 'second_wind' ? ` (${label})` : ''}: ${healWord(delta, maxHpOf(target || actor))}.`, key: false };
    case 'last_stand':
      return { text: `${target || actor} refuses to fall: a Last Stand, back on their feet.`, key: true };
    case 'potion':
      return { text: `${actor} drinks a potion mid-fight.`, key: false };
    case 'shield':
      return { text: `${actor} throws a protective ward over ${target || 'themself'} (${label}).`, key: false };
    case 'rally':
      return { text: `${actor} rallies their allies (${label}).`, key: false };
    case 'pin':
      return /held back|too late/i.test(detail)
        ? { text: `${actor} ${/too late/i.test(detail) ? 'tries and fails to hold' : 'holds'} ${target} back (${label}).`, key: false }
        : { text: `${actor} pins ${target} down (${label}).`, key: false };
    case 'retreat':
      return { text: `${actor} flees the fight.`, key: true };
    case 'defeat_npc':
      return { text: `${actor} ${/killed/i.test(detail) ? 'kills' : 'knocks out'} ${target}.`, key: true };
    case 'end':
      return { text: detail || 'The fight ends.', key: true };
    default:
      return null;
  }
}

/** Target length for the battle post: longer fights get more room. */
export function targetWords(keyBeats: number, beats: number): number {
  return Math.max(400, Math.min(1000, 300 + 40 * keyBeats + 8 * beats));
}

export interface DossierInput {
  fighters: DossierFighter[];
  events: DossierEvent[];
  /** NPC id -> first part of its guide (appearance and manner) and its skill names. */
  npcInfo: Map<string, { guide: string; skills: string[] }>;
  /** Player user id -> sheet summary. */
  playerInfo: Map<string, { race?: string; className?: string; level?: number; gear: string[] }>;
}

/** The Fight Dossier text, or '' when there is nothing to tell. */
export function buildDossier(input: DossierInput): string {
  const { fighters, events, npcInfo, playerInfo } = input;
  if (events.length === 0) return '';
  const maxHp = new Map(fighters.map(f => [f.name, f.max_hp]));
  const maxHpOf = (name: string) => maxHp.get(name) ?? 40;

  const who: string[] = [];
  for (const f of fighters) {
    if (f.kind === 'npc') {
      const info = f.npc_id ? npcInfo.get(f.npc_id) : undefined;
      const bits = [info?.guide ? info.guide : '', info?.skills.length ? `Fights with: ${info.skills.join(', ')}.` : '']
        .filter(Boolean).join(' ');
      // D-24: an ally fights beside the party and is knocked out at worst, never killed.
      const side = f.ally ? 'NPC ally, fighting beside the party' : 'NPC';
      who.push(`- ${f.name} (${side})${bits ? `: ${bits}` : ''}${f.status === 'ko' ? (f.ally ? ' Is knocked out before the end and gets back up after.' : ' Ends the fight knocked out.') : f.status === 'dead' ? ' Ends the fight dead.' : f.status === 'fled' ? ' Flees before the end.' : ''}`);
    } else {
      const p = f.user_id ? playerInfo.get(f.user_id) : undefined;
      const desc = [p?.race, p?.className].filter(Boolean).join(' ');
      const gear = p?.gear.length ? `; carries ${p.gear.join(', ')}` : '';
      who.push(`- ${f.name} (player character${desc ? `: ${desc}` : ''}${p?.level ? `, level ${p.level}` : ''}${gear}).`);
    }
  }

  // The server logs a defeat just before the blow that caused it: put the blow first.
  const ordered = [...events];
  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    if (a.kind === 'defeat_npc' && (b.kind === 'attack' || b.kind === 'spell') && a.actor_name === b.actor_name && a.target_name === b.target_name) {
      ordered[i] = b;
      ordered[i + 1] = a;
      i++;
    }
  }
  const t0 = Date.parse(ordered[0].created_at);
  const beats: string[] = [];
  let keys = 0;
  let lastSecs = 0;
  for (const e of ordered) {
    const b = beatOf(e, maxHpOf);
    if (!b) continue;
    if (b.key) keys++;
    const secs = Math.max(lastSecs, Math.round((Date.parse(e.created_at) - t0) / 1000));
    lastSecs = secs;
    beats.push(`[${secs}s]${b.key ? ' ★ KEY BEAT:' : ''} ${b.text}`);
  }
  if (beats.length === 0) return '';
  const trimmed = beats.length > 160 ? [...beats.slice(0, 40), '[… many smaller exchanges …]', ...beats.slice(-110)] : beats;
  const words = targetWords(keys, beats.length);

  return [
    '## FIGHT DOSSIER (facts for this battle post only; never show, list or quote it)',
    'FIGHTERS',
    ...who,
    '',
    'WHAT HAPPENED, IN ORDER (seconds from the first blow)',
    ...trimmed,
    '',
    `ARENA: the location of the latest scene in the story. Use its terrain, light and objects.`,
    `LENGTH: about ${words} words.`,
  ].join('\n');
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Reads the fights that overlap the handed-off ⚔ lines and builds the dossier. Never throws:
 * on any problem it returns '' and the battle post simply goes without it.
 */
export async function loadBattleDossier(
  db: Db,
  lt: { partyId?: unknown; combatSince?: unknown; combatUntil?: unknown } | undefined,
): Promise<string> {
  try {
    const partyId = typeof lt?.partyId === 'string' && UUID_RE.test(lt.partyId) ? lt.partyId : null;
    const since = typeof lt?.combatSince === 'string' ? Date.parse(lt.combatSince) : NaN;
    const until = typeof lt?.combatUntil === 'string' ? Date.parse(lt.combatUntil) : NaN;
    if (!partyId || !Number.isFinite(since)) return '';
    const from = new Date(since - 5 * 60_000).toISOString();
    const to = new Date((Number.isFinite(until) ? until : Date.now()) + 2 * 60_000).toISOString();

    const fights = await db.from('party_fights').select('id, started_at, ended_at')
      .eq('party_id', partyId).lte('started_at', to).order('started_at', { ascending: false }).limit(3);
    if (fights.error) return '';
    const ids = (fights.data || [])
      .filter((f: { ended_at: string | null }) => !f.ended_at || Date.parse(f.ended_at) >= Date.parse(from))
      .map((f: { id: string }) => f.id);
    if (ids.length === 0) return '';

    const [fighters, events, members] = await Promise.all([
      db.from('party_fight_combatants').select('kind, name, max_hp, npc_id, user_id, status, ally').in('fight_id', ids),
      db.from('party_fight_events').select('kind, actor_name, target_name, hp_delta, d20, detail, created_at')
        .in('fight_id', ids).gte('created_at', from).lte('created_at', to)
        .order('created_at', { ascending: true }).limit(400),
      db.from('party_members').select('user_id, character_status').eq('party_id', partyId),
    ]);
    if (fighters.error || events.error) return '';
    const fighterRows = (fighters.data || []) as DossierFighter[];

    const npcIds = fighterRows.filter(f => f.kind === 'npc' && f.npc_id).map(f => f.npc_id as string);
    const npcInfo = new Map<string, { guide: string; skills: string[] }>();
    if (npcIds.length) {
      const [npcs, guides] = await Promise.all([
        db.from('party_npcs').select('id, combat_stats').in('id', npcIds),
        // Host only (row-level security): other callers simply get no guide text.
        db.from('party_npc_guides').select('npc_id, guide').in('npc_id', npcIds),
      ]);
      for (const n of npcs.data || []) {
        const skills = Array.isArray(n.combat_stats?.skills)
          ? n.combat_stats.skills.map((s: { name?: unknown }) => str(s?.name)).filter(Boolean).slice(0, 4)
          : [];
        npcInfo.set(n.id, { guide: '', skills });
      }
      for (const g of guides.data || []) {
        const cur = npcInfo.get(g.npc_id) || { guide: '', skills: [] };
        const guide = str(g.guide).replace(/\s+/g, ' ');
        cur.guide = guide.length > 420 ? `${guide.slice(0, 420).replace(/\s\S*$/, '')}…` : guide;
        npcInfo.set(g.npc_id, cur);
      }
    }

    const playerInfo = new Map<string, { race?: string; className?: string; level?: number; gear: string[] }>();
    for (const m of members.data || []) {
      const s = m.character_status || {};
      const gear = Array.isArray(s.equippedGear)
        ? s.equippedGear
          .filter((g: { slot?: unknown }) => ['primary_weapon', 'secondary_weapon', 'ranged_weapon', 'chest', 'head', 'cloak'].includes(String(g?.slot)))
          .map((g: { name?: unknown }) => str(g?.name)).filter(Boolean).slice(0, 4)
        : [];
      playerInfo.set(m.user_id, { race: str(s.race) || undefined, className: str(s.className) || undefined, level: Number(s.level) || undefined, gear });
    }

    return buildDossier({ fighters: fighterRows, events: (events.data || []) as DossierEvent[], npcInfo, playerInfo });
  } catch (err) {
    console.warn('[ai-dm] battle dossier skipped:', err);
    return '';
  }
}
