// Battle feed: turns fight events into short Pokémon-style lines for the battle screen's text box
// ("XEYLE used THE BEDSIDE MANNER!", "KLEG took 7 damage!"). Pure and phone-only: it reads the
// events the referee already writes (party_fight_events) and never changes the fight.
// Plan: claude/POKEMON_BATTLE_PLAN.md, section 6.

/** The fields of a fight event the feed reads (a party_fight_events row has all of them). */
export interface FeedEvent {
  id: string;
  kind: string;
  actor_name: string | null;
  target_name: string | null;
  d20: number | null;
  total: number | null;
  hp_delta: number | null;
  detail: string | null;
  target_user_id?: string | null;
}

export type FeedTone = 'neutral' | 'hit' | 'heal' | 'warn' | 'good' | 'bad';

export interface FeedLine {
  /** Unique per line: the event id plus the line's position. */
  id: string;
  text: string;
  tone: FeedTone;
  /** 1 = jumps the queue (aimed at me, or about me). 0 = normal. */
  priority: 0 | 1;
}

export interface FeedContext {
  /** My character's name in the fight (my fighter row's name). */
  myName?: string | null;
  myUserId?: string | null;
}

/** How long each line stays in the text box before the next one (a tap skips sooner). */
export const FEED_STEP_MS = 1200;
/** The most lines waiting at once; older normal lines drop (they stay in the fight log). */
export const FEED_MAX = 6;

/** Names in the text box are capitals, like the classic battle screens. */
export function caps(name: string | null | undefined): string {
  return (name ?? '').trim().toUpperCase();
}

/** "Moonshadow and Whisperwind: 5 damage (critical!)" → its parts. Works with or without a move name. */
export function parseStrike(detail: string | null | undefined): {
  move: string | null; damage: number | null; miss: boolean; crit: boolean; counter: boolean; riposte: boolean;
} {
  let text = (detail ?? '').trim();
  const counter = /^counter clash!/i.test(text);
  const riposte = /riposte/i.test(text);
  if (counter) text = text.replace(/^counter clash!\s*/i, '').replace(/riposte!?\s*/i, '');
  const crit = /\(critical!?\)/i.test(text);
  text = text.replace(/\s*\(critical!?\)/i, '');
  // Spells add "(X failed the DC 13 save)" after the damage; strip any trailing bracket.
  text = text.replace(/\s*\([^)]*\)\s*$/, '');
  const m = /^(?:(.+?):\s*)?(?:(\d+)\s*damage|(miss))\s*$/i.exec(text);
  if (!m) return { move: null, damage: null, miss: false, crit, counter, riposte };
  return { move: m[1]?.trim() || null, damage: m[2] != null ? Number(m[2]) : null, miss: !!m[3], crit, counter, riposte };
}

/** The part before the first ":" (the move or item name), if any. */
function moveOf(detail: string | null | undefined): string | null {
  const d = (detail ?? '').trim();
  const i = d.indexOf(':');
  return i > 0 ? d.slice(0, i).trim() : null;
}

/** The part after the first ":" (the effect), or the whole detail. */
function effectOf(detail: string | null | undefined): string {
  const d = (detail ?? '').trim();
  const i = d.indexOf(':');
  return i > 0 ? d.slice(i + 1).trim() : d;
}

/** "Potion of Superior Healing (given by Xeyle)" → "Potion of Superior Healing". */
function dropBracket(s: string): string {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** The lines one fight event adds to the text box. An event the feed doesn't show returns []. */
export function linesForEvent(e: FeedEvent, ctx: FeedContext = {}): FeedLine[] {
  const A = caps(e.actor_name);
  const T = caps(e.target_name);
  const me = caps(ctx.myName);
  const aboutMe = (!!ctx.myUserId && e.target_user_id === ctx.myUserId) || (!!me && (T === me || A === me));
  const hp = Number(e.hp_delta) || 0;
  const out: Array<[string, FeedTone]> = [];
  let priority: 0 | 1 = aboutMe ? 1 : 0;

  switch (e.kind) {
    case 'sync':
      return [];
    case 'start':
      out.push([T ? `${T} wants to fight!` : 'The battle begins!', 'warn']);
      break;
    case 'intent': {
      const raw = (e.detail ?? '').replace(/\s+in\s+\d+\s*s$/i, '').trim();
      const move = caps(raw.replace(/\s*\([^)]*\)\s*$/, '')) || 'AN ATTACK';
      out.push([T ? `${A} is winding up ${move} at ${T}!` : `${A} is winding up ${move}!`, 'warn']);
      if (me && T === me) {
        out.push([`Hit ${A} to push it back!`, 'warn']);
        priority = 1;
      }
      break;
    }
    case 'attack': {
      const s = parseStrike(e.detail);
      if (s.counter) {
        out.push([`COUNTER CLASH! ${A} struck back${s.damage != null ? ` for ${s.damage}` : ''}!`, 'good']);
        if (s.riposte) out.push(['RIPOSTE!', 'good']);
        break;
      }
      out.push([s.move ? `${A} used ${caps(s.move)}!` : (T ? `${A} attacks ${T}!` : `${A} attacks!`), 'neutral']);
      if (e.d20 != null && e.total != null) out.push([`Rolled ${e.d20} → ${e.total}`, 'neutral']);
      if (s.crit) out.push(['A critical hit!', 'hit']);
      if (s.miss || (s.damage == null && hp === 0)) out.push([`${A}'s attack missed!`, 'neutral']);
      else out.push([`${T || 'The target'} took ${s.damage ?? Math.abs(hp)} damage!`, 'hit']);
      break;
    }
    case 'spell': {
      const s = parseStrike(e.detail);
      const move = s.move ?? moveOf(e.detail);
      out.push([move ? `${A} cast ${caps(move)}!` : `${A} cast a spell!`, 'neutral']);
      const d = e.detail ?? '';
      if (/failed the .*save/i.test(d)) out.push([`${T} failed the save!`, 'neutral']);
      else if (/(made|passed|succeeded on) the .*save|saved/i.test(d)) out.push([`${T} made the save. Half damage!`, 'neutral']);
      if (s.crit) out.push(['A critical hit!', 'hit']);
      if (s.miss) out.push([`It missed ${T}!`, 'neutral']);
      else if ((s.damage ?? Math.abs(hp)) > 0) out.push([`${T} took ${s.damage ?? Math.abs(hp)} damage!`, 'hit']);
      else out.push([`It had no effect on ${T}.`, 'neutral']);
      break;
    }
    case 'heal':
    case 'mend': {
      const move = moveOf(e.detail);
      const name = move ? caps(dropBracket(move)) : null;
      if (name) out.push([A && T && A !== T ? `${A} used ${name} on ${T}!` : `${A || T} used ${name}!`, 'neutral']);
      out.push([`${T || A} regained ${hp > 0 ? hp : '?'} HP!`, 'heal']);
      break;
    }
    case 'second_wind':
      out.push([`${A} caught a second wind!`, 'neutral']);
      out.push([`${T || A} regained ${hp > 0 ? hp : '?'} HP!`, 'heal']);
      break;
    case 'potion': {
      const move = moveOf(e.detail);
      out.push([`${A} drank ${move ? `a ${caps(move)}` : 'a potion'}!`, 'neutral']);
      const eff = effectOf(e.detail);
      if (hp > 0) out.push([`${T || A} regained ${hp} HP!`, 'heal']);
      else if (eff) out.push([`${eff}!`.replace(/!+$/, '!'), 'heal']);
      break;
    }
    case 'shield':
      out.push([`${A} used ${caps(moveOf(e.detail) ?? 'a shield')}!`, 'neutral']);
      out.push([`${T && T !== A ? T : A} is shielded.`, 'neutral']);
      break;
    case 'rally':
      out.push([`${A} used ${caps(moveOf(e.detail) ?? e.detail ?? 'a rally')}!`, 'warn']);
      out.push(['The enemies rally!', 'warn']);
      break;
    case 'pin': {
      if (/broke free/i.test(e.detail ?? '')) {
        out.push([`${T || A} broke free!`, 'good']);
        break;
      }
      const move = moveOf(e.detail);
      out.push([move ? `${A} used ${caps(move)}!` : `${A} grabs ${T}!`, 'bad']);
      out.push([`${T} is pinned!`, 'bad']);
      break;
    }
    case 'retreat':
      out.push([`${A} fled the battle!`, 'neutral']);
      break;
    case 'stabilize':
      out.push(/fail/i.test(e.detail ?? '')
        ? [`${A} tried to stabilize ${T}… it failed.`, 'bad']
        : [`${A} stabilized ${T}!`, 'good']);
      break;
    case 'down':
      out.push([`${T} is down!`, 'bad']);
      break;
    case 'death_save':
      out.push([`${T}'s death save: ${e.detail?.trim() || (e.d20 != null ? `rolled ${e.d20}` : 'rolled')}`, hp > 0 ? 'good' : 'neutral']);
      break;
    case 'death':
      out.push([`${T} has fallen.`, 'bad']);
      break;
    case 'defeat_npc':
      out.push([`${T} is ${(e.detail ?? '').trim() || 'defeated'}!`, 'good']);
      break;
    case 'join':
      out.push([`${A} joins the fight!`, 'good']);
      break;
    case 'scale':
      out.push(['The enemy steels itself!', 'warn']);
      break;
    case 'huddle':
      out.push(['HUDDLE! The battle freezes.', 'neutral']);
      break;
    case 'pause':
      out.push(['The battle is paused.', 'neutral']);
      break;
    case 'resume':
      out.push(['The battle resumes!', 'neutral']);
      break;
    case 'end': {
      const d = e.detail ?? '';
      if (/party wins|victory/i.test(d)) out.push(['VICTORY!', 'good']);
      else if (/defeat|party (?:is|was) (?:beaten|defeated)|party loses|fallen/i.test(d)) out.push(['The party was defeated…', 'bad']);
      else out.push(['The battle is over.', 'neutral']);
      priority = 1;
      break;
    }
    default: {
      // Any kind the feed doesn't know yet (duel, last_stand, revive, new ones): name + detail.
      const who = A || T;
      const d = (e.detail ?? '').trim();
      if (!who && !d) return [];
      out.push([who && d ? `${who}: ${d}` : (who || d), 'neutral']);
    }
  }
  return out.map(([text, tone], i) => ({ id: `${e.id}:${i}`, text, tone, priority }));
}

/**
 * Adds new lines to the waiting queue. Priority lines go first (in order), normal lines after the
 * ones already waiting. Over the cap, the oldest normal lines drop first.
 */
export function mergeFeed(waiting: FeedLine[], fresh: FeedLine[], max = FEED_MAX): FeedLine[] {
  const seen = new Set(waiting.map(l => l.id));
  const add = fresh.filter(l => !seen.has(l.id));
  const urgent = add.filter(l => l.priority === 1);
  const normal = add.filter(l => l.priority === 0);
  const out = [...urgent, ...waiting, ...normal];
  while (out.length > max) {
    const i = out.findIndex(l => l.priority === 0);
    if (i < 0) out.shift();
    else out.splice(i, 1);
  }
  return out;
}

/** A fighter as the default-target picker sees it. */
export interface TargetCandidate {
  id: string;
  status: string | null;
  hp: number;
  max_hp: number;
  /** True when this enemy is winding up a move aimed at me. */
  aimingAtMe?: boolean;
}

/**
 * The enemy a move lands on when the player hasn't picked one: keep the current target while it
 * stands; else the enemy aiming at me; else the weakest (lowest HP %); else the first. Null if none stand.
 */
export function pickDefaultTarget(enemies: TargetCandidate[], currentId?: string | null): string | null {
  const up = enemies.filter(f => f.status === 'up');
  if (up.length === 0) return null;
  if (currentId && up.some(f => f.id === currentId)) return currentId;
  const aiming = up.find(f => f.aimingAtMe);
  if (aiming) return aiming.id;
  const pct = (f: TargetCandidate) => (f.max_hp > 0 ? f.hp / f.max_hp : 1);
  return [...up].sort((a, b) => pct(a) - pct(b))[0].id;
}

/** HP bar color band, as in the classic battle screens. */
export function hpBand(hp: number, max: number): 'green' | 'yellow' | 'red' {
  const p = max > 0 ? (hp / max) * 100 : 0;
  return p > 50 ? 'green' : p > 20 ? 'yellow' : 'red';
}
