import { describe, expect, it } from 'vitest';
import { caps, hpBand, linesForEvent, mergeFeed, parseStrike, pickDefaultTarget, type FeedEvent, type FeedLine } from '@/lib/battle-feed';

// Detail strings below are copied from real party_fight_events rows (2026-10-19).
const ev = (kind: string, actor: string, target: string, detail: string, extra: Partial<FeedEvent> = {}): FeedEvent => ({
  id: `${kind}-1`, kind, actor_name: actor, target_name: target, detail, d20: null, total: null, hp_delta: 0, target_user_id: null, ...extra,
});
const texts = (e: FeedEvent, ctx = {}) => linesForEvent(e, ctx).map(l => l.text);

describe('parseStrike', () => {
  it('reads a named hit', () => expect(parseStrike('The Bedside Manner: 10 damage')).toMatchObject({ move: 'The Bedside Manner', damage: 10, miss: false, crit: false }));
  it('reads a crit', () => expect(parseStrike('Second Opinion Dart Pistol: 8 damage (critical!)')).toMatchObject({ damage: 8, crit: true }));
  it('reads an unnamed NPC hit', () => expect(parseStrike('20 damage (critical!)')).toMatchObject({ move: null, damage: 20, crit: true }));
  it('reads a miss', () => expect(parseStrike('miss')).toMatchObject({ miss: true, damage: null }));
  it('reads a named miss', () => expect(parseStrike('Moonshadow and Whisperwind: miss')).toMatchObject({ move: 'Moonshadow and Whisperwind', miss: true }));
  it('reads a counter', () => expect(parseStrike('Counter Clash! The Bedside Manner: 5 damage')).toMatchObject({ counter: true, damage: 5 }));
  it('reads a spell save note', () => expect(parseStrike('Sepsis Speedrun: 17 damage (Kael failed the DC 13 save)')).toMatchObject({ move: 'Sepsis Speedrun', damage: 17 }));
});

describe('linesForEvent', () => {
  it('start', () => expect(texts(ev('start', 'Anduril', 'One-Eye Kleg', ''))).toEqual(['ONE-EYE KLEG wants to fight!']));

  it('attack hit with roll', () => expect(texts(ev('attack', 'Xeyle', 'Grog', 'The Bedside Manner: 7 damage', { d20: 16, total: 21, hp_delta: -7 })))
    .toEqual(['XEYLE used THE BEDSIDE MANNER!', 'Rolled 16 → 21', 'GROG took 7 damage!']));

  it('attack crit', () => expect(texts(ev('attack', 'Xeyle', 'Grog', 'The Bedside Manner: 9 damage (critical!)', { d20: 20, total: 25, hp_delta: -9 })))
    .toEqual(['XEYLE used THE BEDSIDE MANNER!', 'Rolled 20 → 25', 'A critical hit!', 'GROG took 9 damage!']));

  it('attack miss', () => expect(texts(ev('attack', 'Kleg', 'Xeyle', 'miss', { d20: 3, total: 9 })))
    .toEqual(['KLEG attacks XEYLE!', 'Rolled 3 → 9', "KLEG's attack missed!"]));

  it('NPC hit without a move name', () => expect(texts(ev('attack', 'Kleg', 'Xeyle', '14 damage', { d20: 13, total: 23, hp_delta: -14 })))
    .toEqual(['KLEG attacks XEYLE!', 'Rolled 13 → 23', 'XEYLE took 14 damage!']));

  it('counter clash', () => expect(texts(ev('attack', 'Xeyle', 'Kleg', 'Counter Clash! The Bedside Manner: 5 damage', { hp_delta: -5 })))
    .toEqual(['COUNTER CLASH! XEYLE struck back for 5!']));

  it('save spell', () => expect(texts(ev('spell', 'Xeyle', "Kael 'The Brawler'", "Sepsis Speedrun: 17 damage (Kael 'The Brawler' failed the DC 13 save)", { hp_delta: -17 })))
    .toEqual(['XEYLE cast SEPSIS SPEEDRUN!', "KAEL 'THE BRAWLER' failed the save!", "KAEL 'THE BRAWLER' took 17 damage!"]));

  it('spell with no damage', () => expect(texts(ev('spell', 'Xeyle', 'Grog', 'Jumper Cables (Both Ends): 0 damage')))
    .toEqual(['XEYLE cast JUMPER CABLES (BOTH ENDS)!', 'It had no effect on GROG.']));

  it('self heal', () => expect(texts(ev('heal', 'Xeyle', 'Xeyle', 'Loogie of Life: +7 HP', { hp_delta: 7 })))
    .toEqual(['XEYLE used LOOGIE OF LIFE!', 'XEYLE regained 7 HP!']));

  it('given potion', () => expect(texts(ev('heal', 'Xeyle', 'Phoenix', 'Potion of Superior Healing (given by Xeyle): +22 HP', { hp_delta: 22 })))
    .toEqual(['XEYLE used POTION OF SUPERIOR HEALING on PHOENIX!', 'PHOENIX regained 22 HP!']));

  it('NPC mend', () => expect(texts(ev('mend', 'Grog', 'Squid', 'Snoot: +10 HP', { hp_delta: 10 })))
    .toEqual(['GROG used SNOOT on SQUID!', 'SQUID regained 10 HP!']));

  it('potion for Resolve', () => expect(texts(ev('potion', 'Xeyle', 'Xeyle', 'Potion of Superior Healing: +75 Resolve')))
    .toEqual(['XEYLE drank a POTION OF SUPERIOR HEALING!', '+75 Resolve!']));

  it('intent aimed at me jumps the queue', () => {
    const lines = linesForEvent(ev('intent', 'Hobgoblin Soldier (Flanker)', 'Anduril', 'Harassing Thrust (pinning move) in 4s'), { myName: 'Anduril' });
    expect(lines.map(l => l.text)).toEqual(['HOBGOBLIN SOLDIER (FLANKER) is winding up HARASSING THRUST at ANDURIL!', 'Hit HOBGOBLIN SOLDIER (FLANKER) to push it back!']);
    expect(lines.every(l => l.priority === 1 && l.tone === 'warn')).toBe(true);
  });

  it('intent at someone else stays normal', () => {
    const lines = linesForEvent(ev('intent', 'Kleg', 'Phoenix', 'Heavy Blow in 6s'), { myName: 'Anduril' });
    expect(lines.map(l => l.text)).toEqual(['KLEG is winding up HEAVY BLOW at PHOENIX!']);
    expect(lines[0].priority).toBe(0);
  });

  it('pin and break free', () => {
    expect(texts(ev('pin', "Lysandra 'The Whip-Tongue'", 'Xeyle', 'Disarming Wordplay: pinned 30s (half-blocked: head start)')))
      .toEqual(["LYSANDRA 'THE WHIP-TONGUE' used DISARMING WORDPLAY!", 'XEYLE is pinned!']);
    expect(texts(ev('pin', 'Kleg', 'Xeyle', 'Broke free!'))).toEqual(['XEYLE broke free!']);
  });

  it('stabilize success and failure', () => {
    expect(texts(ev('stabilize', 'Xeyle', 'Phoenix', 'Stabilized'))).toEqual(['XEYLE stabilized PHOENIX!']);
    expect(texts(ev('stabilize', 'Xeyle', 'Phoenix', 'Failed to stabilize'))).toEqual(['XEYLE tried to stabilize PHOENIX… it failed.']);
  });

  it('down, death save, death', () => {
    expect(texts(ev('down', "Rix 'The Grin'", 'Xeyle', ''))).toEqual(['XEYLE is down!']);
    expect(texts(ev('death_save', '', 'Xeyle', 'Natural 20: back up with 1 HP', { d20: 20, hp_delta: 1 }))).toEqual(["XEYLE's death save: Natural 20: back up with 1 HP"]);
    expect(texts(ev('death', '', 'Xeyle', '3 failures'))).toEqual(['XEYLE has fallen.']);
  });

  it('NPC defeat', () => expect(texts(ev('defeat_npc', 'Anduril', 'One-Eye Kleg', 'knocked out'))).toEqual(['ONE-EYE KLEG is knocked out!']));
  it('ally joins', () => expect(texts(ev('join', "Drizzt Do'Urden", '', 'ally: fights beside the party'))).toEqual(["DRIZZT DO'URDEN joins the fight!"]));
  it('scale', () => expect(texts(ev('scale', 'Drizzt', '', 'Drizzt joins: the enemy scales up for 2 fighters'))).toEqual(['The enemy steels itself!']));
  it('pause and resume', () => {
    expect(texts(ev('pause', '', '', 'The host paused the fight'))).toEqual(['The battle is paused.']);
    expect(texts(ev('resume', '', '', 'The fight resumes'))).toEqual(['The battle resumes!']);
  });
  it('victory', () => expect(texts(ev('end', '', '', 'Combat over: the party wins.'))).toEqual(['VICTORY!']));
  it('unknown kinds fall back to name + detail', () => expect(texts(ev('duel', 'Anduril', 'Hobgoblin', 'Duel over: 3/7 perfect.'))).toEqual(['ANDURIL: Duel over: 3/7 perfect.']));
  it('skips internal sync events', () => expect(linesForEvent(ev('sync', 'Xeyle', 'Xeyle', ''))).toEqual([]));
  it('marks lines about me as priority', () => {
    const lines = linesForEvent(ev('attack', 'Kleg', 'Xeyle', '14 damage', { hp_delta: -14, target_user_id: 'u1' }), { myUserId: 'u1' });
    expect(lines.every(l => l.priority === 1)).toBe(true);
  });
  it('gives every line a unique id', () => {
    const ids = linesForEvent(ev('attack', 'Xeyle', 'Grog', 'X: 9 damage (critical!)', { d20: 20, total: 25 })).map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mergeFeed', () => {
  const l = (id: string, priority: 0 | 1 = 0): FeedLine => ({ id, text: id, tone: 'neutral', priority });
  it('puts urgent lines first and normal lines last', () => expect(mergeFeed([l('a'), l('b')], [l('u', 1), l('c')]).map(x => x.id)).toEqual(['u', 'a', 'b', 'c']));
  it('drops the oldest normal lines over the cap', () => expect(mergeFeed([l('a'), l('b'), l('c')], [l('u', 1), l('d')], 3).map(x => x.id)).toEqual(['u', 'c', 'd']));
  it('never adds the same line twice', () => expect(mergeFeed([l('a')], [l('a'), l('b')]).map(x => x.id)).toEqual(['a', 'b']));
});

describe('pickDefaultTarget', () => {
  const e = (id: string, hp: number, status = 'up', aimingAtMe = false) => ({ id, hp, max_hp: 30, status, aimingAtMe });
  it('keeps the current target while it stands', () => expect(pickDefaultTarget([e('a', 5), e('b', 30)], 'b')).toBe('b'));
  it('switches when the current target falls', () => expect(pickDefaultTarget([e('a', 0, 'ko'), e('b', 30), e('c', 10)], 'a')).toBe('c'));
  it('prefers the enemy aiming at me', () => expect(pickDefaultTarget([e('a', 5), e('b', 30, 'up', true)])).toBe('b'));
  it('else the weakest', () => expect(pickDefaultTarget([e('a', 20), e('b', 4), e('c', 10)])).toBe('b'));
  it('null when no enemy stands', () => expect(pickDefaultTarget([e('a', 0, 'dead')])).toBeNull());
});

describe('helpers', () => {
  it('caps', () => expect(caps("Drizzt Do'Urden")).toBe("DRIZZT DO'URDEN"));
  it('hpBand', () => {
    expect(hpBand(30, 59)).toBe('green');
    expect(hpBand(20, 59)).toBe('yellow');
    expect(hpBand(5, 59)).toBe('red');
    expect(hpBand(0, 0)).toBe('red');
  });
});
