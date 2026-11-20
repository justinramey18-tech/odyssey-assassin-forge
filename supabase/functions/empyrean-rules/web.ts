// Solo Empyrean progression web: pure functions only (no Deno, no database, no network), so the
// same file runs in the edge function and in the app's tests.
// A rider spends XP on the rider's half of the web and Kinship on the dragon's half. The level
// system is untouched: nodes are a bonus on top of it.
// The ledger (nodes owned, what was earned per campaign, what was spent) is kept on the server, in the
// rider's row (empyrean_riders.data.web). The phone only shows what this file works out.

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

export type WebHalf = 'rider' | 'dragon';
export type NodeTier = 'small' | 'big' | 'capstone';
export const NODE_COST: Record<NodeTier, number> = { small: 150, big: 400, capstone: 1000 };
/** The dragon's half is paid with Kinship, which is earned from time spent with the dragon (see rules.ts, earnKin). */
export type Currency = 'xp' | 'kin';
export const KIN_COST: Record<NodeTier, number> = { small: 3, big: 8, capstone: 20 };
export const currencyOf = (half: WebHalf): Currency => (half === 'dragon' ? 'kin' : 'xp');
/** The dragon's trust tiers the Loyalty branches unlock at (the same tiers the Bond screen shows). */
export const TRUST_GUARDED = 21;
export const TRUST_OPEN = 41;
export const TRUST_DEEP = 61;

/** What owned nodes add up to. Every number here is read by a rule on the server. */
export interface WebBonuses {
  /** Added to the Signet Strain limit the phone sends. */
  strainLimit: number;
  /** Strain taken off a failed signet check (never below 0). */
  backlashOff: number;
  /** The first story channel of each in-game day costs no strain. */
  freeChannel: boolean;
  /** Added to the rider's max HP. The sheet adds it (Empyrean mode only) from the number sent here. */
  maxHp: number;
  /** Ward: a shield over HP that takes damage first. It refills on a long rest; half on a short rest and
   *  fully at the start of a fight with the two flags. */
  wardMax: number; wardShortRest: boolean; wardFightRefill: boolean;
  /** Regeneration: HP per game hour, HP on each of the rider's fight turns, and whether what HP cannot hold refills the Ward. */
  regenHour: number; regenTurn: number; regenWard: boolean;
  /** Adrenaline (fights, at half HP or less): damage, to-hit, doubled at a quarter HP or less, and a shorter wait between moves. */
  adrDamage: number; adrHit: number; adrDouble: boolean; adrHasteMs: number;
  /** Lifeblood: HP paid per point of strain over the limit (0: a channel cannot pass the limit), whether a
   *  blood-paid channel also eases strain by 1, and whether a blood-paid fight strike rolls 2 extra dice. */
  bloodPrice: number; bloodEase: boolean; heartfire: boolean;
  /** Channel, Power: flat damage and extra dice on a signet strike in a fight, and 1 strain back when the strike drops an enemy. */
  sigDamage: number; sigDice: number; sigKillRefund: boolean;
  /** Channel, Control: a bonus on signet checks, and a signet check can no longer fail critically. */
  signetCheck: number; steadySignet: boolean;
  /** Channel, Recovery: extra strain eased by a short rest, by Ground Yourself and by the after-reply cool-down, and strain eased per game hour. */
  restEase: number; groundEase: number; coolEase: number; strainHour: number;
  /** Channel, Mastery: extra Signet Mastery XP per channel and per day, and whether mastery counts as one rank higher. */
  masteryXp: number; masteryCap: number; masteryRankUp: boolean;
  /** Blade (weapon attacks): flat damage, to-hit, extra weapon dice, extra dice against an enemy at half HP or less, the lowest
   *  d20 that is a critical hit (0: only a 20), and how far a miss can fall short and still land for half damage. */
  wpnDamage: number; wpnHit: number; wpnDice: number; wpnFinish: number; critFrom: number; graze: number;
  /** Tempo: a shorter wait between moves; ready at once when a fight starts; every enemy's first move later; the first hit of a fight
   *  is critical; no wait after the first move; AC in a fight; Flee; a shorter wait each time an enemy misses; the first hit on the rider misses. */
  tempoMs: number; openReady: boolean; foeDelayMs: number; firstCrit: boolean; blur: boolean;
  fightAc: number; flee: number; missHasteMs: number; dodgeFirst: boolean;
  /** Saddle (needs a bonded dragon): the dragon's help on checks, how much less wounds and conditions take off a check, HP saved on a
   *  failed physical check, failed checks rolled again per day, and no critical failures. */
  help: number; helpSteady: number; helpSoften: number; secondLook: number; helpNoCrit: boolean;
  /** Saddle, while the dragon is up in a fight: to-hit, AC, damage, extra dice, damage taken off every hit on the rider, and a shorter wait when the dragon is hit. */
  mountHit: number; mountAc: number; mountDamage: number; mountDice: number; mountGuard: number; mountHasteMs: number;
  /** Vigor: the dragon's max HP; a hunt mends half; a long rest mends it fully; HP on each of its fight turns; once a fight it recovers a
   *  third at a quarter health; it mends a fifth after a win; once a fight a killing blow leaves it at 1 HP. */
  dHp: number; dHuntMend: boolean; dRestMend: boolean; dMendTurn: number; dSecondWind: boolean; dWinMend: boolean; dLastStand: boolean;
  /** Fang and Flame: to-hit, bite damage, extra bite dice, the lowest d20 that is a critical bite (0: only a 20), a second bite after a
   *  kill, extra fire dice, fire at a single enemy, fire every second turn, and fire that opens the fight and is never half-avoided. */
  dAtk: number; dBite: number; dBiteDice: number; dCritFrom: number; dCleave: boolean;
  dFireDice: number; dFireEager: boolean; dFireFast: boolean; dFireOpen: boolean;
  /** Wing: a shorter wait between its turns, an earlier first move, a delay on an enemy it bites, every enemy's first move later, Flee,
   *  extra days before it needs to fly, to-hit and bite damage in the air, and a Flee that always works. */
  dTempoMs: number; dOpenMs: number; dHarryMs: number; dFoeDelayMs: number; dFlee: number; flyDays: number; dAirHit: number; dAirBite: number; dSureFlee: boolean;
  /** Scale: AC, damage taken off every hit, half damage from big moves, the first hit of a fight does nothing; and shielding the rider:
   *  extra chance (points over 50), the bond it starts at (0: the usual 61; the lowest owned wins), a quarter instead of half, and no turn used. */
  dAc: number; dSoak: number; dBrace: boolean; dFirstHit: boolean;
  dShieldChance: number; dShieldBond: number; dShieldDeep: boolean; dShieldFree: boolean;
  /** Loyalty, trunk: trust earned by a hunt, a flight and a won fight, extra days before it needs to hunt, and days of grace before an unmet need costs trust. */
  trustHunt: number; trustFly: number; trustFight: number; huntDays: number; needGrace: number;
  /** Loyalty, branches: each works only once the dragon's trust has reached its tier (21, 41, 61). withTrust() folds the ones that
   *  have been reached into the keys above (dAtk, dBite, dTempoMs, dBiteDice, help, dFlee, restEase) and into the three flags below. */
  t21Atk: number; t21Bite: number; t41TempoMs: number; t41Avenge: boolean; t61BiteDice: number;
  t21Help: number; t21Flee: number; t41TakeBlow: boolean; t41RestEase: number; t61Rescue: boolean;
  /** Set only by withTrust(): the dragon strikes at once when the rider falls to half HP, takes a blow that would drop the rider, and carries a fallen rider out. */
  dAvenge: boolean; dTakeBlow: boolean; dRescue: boolean;
}
export const NO_BONUSES: WebBonuses = {
  strainLimit: 0, backlashOff: 0, freeChannel: false, maxHp: 0,
  wardMax: 0, wardShortRest: false, wardFightRefill: false,
  regenHour: 0, regenTurn: 0, regenWard: false,
  adrDamage: 0, adrHit: 0, adrDouble: false, adrHasteMs: 0,
  bloodPrice: 0, bloodEase: false, heartfire: false,
  sigDamage: 0, sigDice: 0, sigKillRefund: false,
  signetCheck: 0, steadySignet: false,
  restEase: 0, groundEase: 0, coolEase: 0, strainHour: 0,
  masteryXp: 0, masteryCap: 0, masteryRankUp: false,
  wpnDamage: 0, wpnHit: 0, wpnDice: 0, wpnFinish: 0, critFrom: 0, graze: 0,
  tempoMs: 0, openReady: false, foeDelayMs: 0, firstCrit: false, blur: false, fightAc: 0, flee: 0, missHasteMs: 0, dodgeFirst: false,
  help: 0, helpSteady: 0, helpSoften: 0, secondLook: 0, helpNoCrit: false,
  mountHit: 0, mountAc: 0, mountDamage: 0, mountDice: 0, mountGuard: 0, mountHasteMs: 0,
  dHp: 0, dHuntMend: false, dRestMend: false, dMendTurn: 0, dSecondWind: false, dWinMend: false, dLastStand: false,
  dAtk: 0, dBite: 0, dBiteDice: 0, dCritFrom: 0, dCleave: false, dFireDice: 0, dFireEager: false, dFireFast: false, dFireOpen: false,
  dTempoMs: 0, dOpenMs: 0, dHarryMs: 0, dFoeDelayMs: 0, dFlee: 0, flyDays: 0, dAirHit: 0, dAirBite: 0, dSureFlee: false,
  dAc: 0, dSoak: 0, dBrace: false, dFirstHit: false, dShieldChance: 0, dShieldBond: 0, dShieldDeep: false, dShieldFree: false,
  trustHunt: 0, trustFly: 0, trustFight: 0, huntDays: 0, needGrace: 0,
  t21Atk: 0, t21Bite: 0, t41TempoMs: 0, t41Avenge: false, t61BiteDice: 0,
  t21Help: 0, t21Flee: 0, t41TakeBlow: false, t41RestEase: 0, t61Rescue: false,
  dAvenge: false, dTakeBlow: false, dRescue: false,
};

/** parent: the node that must be owned first (omitted: the node before it in the list; null: none).
 *  branch: the branch of the spoke it sits on (omitted: the spoke's trunk). soon: shown, not yet buyable (none today). */
interface NodeDef { id: string; tier: NodeTier; name: string; effect: string; gives: Partial<WebBonuses>; parent?: string | null; branch?: string; soon?: boolean }
interface BranchDef { id: string; name: string; aspect: string }
interface SpokeDef { id: string; half: WebHalf; name: string; stat: string; blurb: string; nodes: NodeDef[]; branches?: BranchDef[] }

const TIERS: NodeTier[] = ['small', 'small', 'big', 'big', 'capstone'];
/** A five-node branch (small, small, big, big, capstone) growing from `from`. */
function branch(id: string, from: string, soon: boolean, defs: Array<[name: string, effect: string, gives: Partial<WebBonuses>]>): NodeDef[] {
  return defs.map(([name, effect, gives], i) => ({
    id: `${id}-${i + 1}`, tier: TIERS[i], name, effect, gives, branch: id, parent: i === 0 ? from : `${id}-${i}`, ...(soon ? { soon: true } : {}),
  }));
}
const hp = (n: number): [string, Partial<WebBonuses>] => [`Max HP +${n}.`, { maxHp: n }];

type Def = [name: string, effect: string, gives: Partial<WebBonuses>];
/** A five-node trunk of small nodes; a spoke's two branches grow from its last node. */
const trunk = (id: string, defs: Def[]): NodeDef[] => defs.map(([name, effect, gives], i) => ({ id: `${id}-${i + 1}`, tier: 'small', name, effect, gives }));
/** Five trunk nodes that all do the same thing. */
const same = (id: string, names: string[], effect: string, gives: Partial<WebBonuses>): NodeDef[] => trunk(id, names.map((name): Def => [name, effect, gives]));

/** The whole web: ten spokes, 180 nodes. (A spoke with no nodes would be shown as "coming".) */
export const WEB_SPOKES: SpokeDef[] = [
  {
    id: 'vitality', half: 'rider', name: 'Vitality', stat: 'Max HP', blurb: 'A body that takes more punishment.',
    branches: [
      { id: 'tough', name: 'Toughness', aspect: 'Max HP' },
      { id: 'ward', name: 'Ward', aspect: 'A shield over your HP' },
      { id: 'regen', name: 'Regeneration', aspect: 'HP that returns on its own' },
      { id: 'adren', name: 'Adrenaline', aspect: 'Stronger when hurt' },
      { id: 'blood', name: 'Lifeblood', aspect: 'HP as power' },
    ],
    nodes: [
      // The trunk: every branch grows from its last node.
      ...['Hale', 'Hardy', 'Robust', 'Stalwart', 'Ironblooded'].map((name, i): NodeDef => ({ id: `vitality-${i + 1}`, tier: 'small', name, effect: hp(3)[0], gives: hp(3)[1] })),
      ...branch('tough', 'vitality-5', false, [
        ['Thick Hide', ...hp(4)], ['Deep Lungs', ...hp(4)], ['Oaken Frame', ...hp(6)], ['Mountain Heart', ...hp(6)], ["Titan's Frame", ...hp(10)],
      ]),
      ...branch('ward', 'vitality-5', false, [
        ['First Ward', 'A 4-point Ward over your HP. It takes damage first and refills on a long rest.', { wardMax: 4 }],
        ['Second Ward', 'Ward 8.', { wardMax: 4 }],
        ['Third Ward', 'Ward 14.', { wardMax: 6 }],
        ['Quick Ward', 'Half your Ward refills on a short rest.', { wardShortRest: true }],
        ['Bulwark', 'Ward 24. It refills at the start of every fight.', { wardMax: 10, wardFightRefill: true }],
      ]),
      ...branch('regen', 'vitality-5', false, [
        ['Slow Mend', 'Recover 1 HP every game hour.', { regenHour: 1 }],
        ['Steady Mend', 'Recover 2 HP every game hour.', { regenHour: 1 }],
        ['Battle Mend', 'Recover 1 HP on each of your turns in a fight.', { regenTurn: 1 }],
        ['Swift Mend', 'Recover 3 HP every game hour.', { regenHour: 1 }],
        ['Wellspring', 'Recover 2 HP on each fight turn, and regeneration your HP cannot hold refills your Ward.', { regenTurn: 1, regenWard: true }],
      ]),
      ...branch('adren', 'vitality-5', false, [
        ['Quickened Pulse', 'At half HP or less: +1 damage in a fight.', { adrDamage: 1 }],
        ['Racing Pulse', 'At half HP or less: +2 damage in a fight.', { adrDamage: 1 }],
        ['Cornered', 'At half HP or less: also +1 to hit.', { adrHit: 1 }],
        ['Last Reserves', 'At a quarter HP or less those bonuses double.', { adrDouble: true }],
        ['Blood Up', 'At half HP or less you act 1 second sooner in a fight.', { adrHasteMs: 1000 }],
      ]),
      ...branch('blood', 'vitality-5', false, [
        ['Open Vein', 'Channel past your Signet Strain limit: each point over costs 4 HP. Reaching the limit still costs bond.', { bloodPrice: 4 }],
        ['Willing Vein', 'Each point over costs 3 HP.', { bloodPrice: 3 }],
        ['Practiced Vein', 'Each point over costs 2 HP.', { bloodPrice: 2 }],
        ['Bloodletting', 'A channel paid in blood also eases Signet Strain by 1.', { bloodEase: true }],
        ['Heartfire', 'In a fight, a signet strike paid in blood rolls 2 extra dice.', { heartfire: true }],
      ]),
    ],
  },
  {
    id: 'channel', half: 'rider', name: 'Channel', stat: 'Signet power', blurb: 'Hold more power, and do more with it.',
    branches: [
      { id: 'reserve', name: 'Reservoir', aspect: 'Signet Strain limit' },
      { id: 'power', name: 'Power', aspect: 'Signet strikes in a fight' },
      { id: 'control', name: 'Control', aspect: 'Signet checks' },
      { id: 'recover', name: 'Recovery', aspect: 'Strain that eases faster' },
      { id: 'mastery', name: 'Mastery', aspect: 'Signet Mastery' },
    ],
    nodes: [
      // The trunk: every branch grows from its last node. (channel-1 to channel-5 keep the ids riders already own.)
      ...['First', 'Second', 'Third', 'Fourth', 'Fifth'].map((n, i): NodeDef => ({ id: `channel-${i + 1}`, tier: 'small', name: `${n} Reserve`, effect: 'Signet Strain limit +1.', gives: { strainLimit: 1 } })),
      ...branch('reserve', 'channel-5', false, [
        ['Deeper Reserve', 'Signet Strain limit +1.', { strainLimit: 1 }],
        ['Wider Reserve', 'Signet Strain limit +1.', { strainLimit: 1 }],
        ['Tempered Conduit', 'Signet Strain limit +1.', { strainLimit: 1 }],
        ['Steady Conduit', 'Signet Strain limit +1.', { strainLimit: 1 }],
        ['Deep Well', 'Signet Strain limit +2. Your first story channel each day costs no strain.', { strainLimit: 2, freeChannel: true }],
      ]),
      ...branch('power', 'channel-5', false, [
        ['Kindled', 'Signet strikes in a fight deal 2 more damage.', { sigDamage: 2 }],
        ['Burning', 'Signet strikes deal 4 more damage.', { sigDamage: 2 }],
        ['Surge', 'Signet strikes roll 1 extra die.', { sigDice: 1 }],
        ['Torrent', 'Signet strikes roll 2 extra dice.', { sigDice: 1 }],
        ['Stormheart', 'A signet strike that drops an enemy gives 1 Signet Strain back.', { sigKillRefund: true }],
      ]),
      ...branch('control', 'channel-5', false, [
        ['Firm Grip', '+1 on signet checks.', { signetCheck: 1 }],
        ['Sure Grip', '+2 on signet checks.', { signetCheck: 1 }],
        ['Braced', 'A failed signet check adds 1 less strain.', { backlashOff: 1 }],
        ['Unshaken', 'A failed signet check adds 2 less strain.', { backlashOff: 1 }],
        ['Perfect Control', 'A signet check can fail, but never critically.', { steadySignet: true }],
      ]),
      ...branch('recover', 'channel-5', false, [
        ['Easy Breath', 'A short rest eases 1 more Signet Strain.', { restEase: 1 }],
        ['Rooted', 'Ground Yourself eases 1 more Signet Strain.', { groundEase: 1 }],
        ['Cool Head', 'The cool-down after a quiet DM reply eases 2 strain (from 1).', { coolEase: 1 }],
        ['Deep Calm', 'A short rest and Ground Yourself each ease 1 more again.', { restEase: 1, groundEase: 1 }],
        ['Still Water', 'Signet Strain eases by 1 every game hour.', { strainHour: 1 }],
      ]),
      ...branch('mastery', 'channel-5', false, [
        ['Student', '+1 Signet Mastery XP for every channel.', { masteryXp: 1 }],
        ['Diligent', 'You can earn 4 more Signet Mastery XP a day.', { masteryCap: 4 }],
        ['Adept', '+2 Signet Mastery XP for every channel.', { masteryXp: 1 }],
        ['Tireless', 'You can earn 8 more Signet Mastery XP a day.', { masteryCap: 4 }],
        ['Attuned', 'Your Signet Mastery counts as one rank higher.', { masteryRankUp: true }],
      ]),
    ],
  },
  {
    id: 'blade', half: 'rider', name: 'Blade', stat: 'Attack and damage', blurb: 'Hit more often, and harder.',
    branches: [{ id: 'edge', name: 'Edge', aspect: 'Weapon damage' }, { id: 'precise', name: 'Precision', aspect: 'To-hit and critical hits' }],
    nodes: [
      ...trunk('blade', [
        ['Whetted', 'Weapon hits deal 1 more damage.', { wpnDamage: 1 }],
        ['Trained Eye', '+1 to hit with weapons.', { wpnHit: 1 }],
        ['Weighted', 'Weapon hits deal 1 more damage.', { wpnDamage: 1 }],
        ['Sure Hand', '+1 to hit with weapons.', { wpnHit: 1 }],
        ['Bladework', 'Weapon hits deal 1 more damage.', { wpnDamage: 1 }],
      ]),
      ...branch('edge', 'blade-5', false, [
        ['Keen Edge', 'Weapon hits deal 1 more damage.', { wpnDamage: 1 }],
        ['Honed Edge', 'Weapon hits deal 1 more damage.', { wpnDamage: 1 }],
        ['Heavy Hand', 'Weapon hits deal 2 more damage.', { wpnDamage: 2 }],
        ['Cleaving Blow', 'Weapon hits roll 1 extra weapon die.', { wpnDice: 1 }],
        ['Killing Stroke', 'Against an enemy at half HP or less, weapon hits roll 2 more dice.', { wpnFinish: 2 }],
      ]),
      ...branch('precise', 'blade-5', false, [
        ['Steady Aim', '+1 to hit with weapons.', { wpnHit: 1 }],
        ['Patient Aim', '+1 to hit with weapons.', { wpnHit: 1 }],
        ['Weak Points', 'Weapon attacks are critical on a 19 or 20.', { critFrom: 19 }],
        ['Glancing Blow', 'A weapon attack that misses by 2 or less still lands for half damage.', { graze: 2 }],
        ['Deadeye', 'Weapon attacks are critical on an 18, 19 or 20.', { critFrom: 18 }],
      ]),
    ],
  },
  {
    id: 'tempo', half: 'rider', name: 'Tempo', stat: 'Speed', blurb: 'Act sooner in a fight, and get clear of one.',
    branches: [{ id: 'init', name: 'Initiative', aspect: 'The first seconds of a fight' }, { id: 'evade', name: 'Evasion', aspect: 'Harder to hit, easier to get away' }],
    nodes: [
      ...same('tempo', ['Quick', 'Quicker', 'Fleet', 'Swift', 'Lightning'], 'Act 0.4 seconds sooner in a fight.', { tempoMs: 400 }),
      ...branch('init', 'tempo-5', false, [
        ['Quick Draw', 'You are ready to act the moment a fight starts.', { openReady: true }],
        ['Wrong-Footed', "Every enemy's first move comes 2 seconds later.", { foeDelayMs: 2000 }],
        ['First Blood', 'Your first hit in a fight is a critical hit.', { firstCrit: true }],
        ['Off Balance', "Every enemy's first move comes 3 seconds later again (5 in all).", { foeDelayMs: 3000 }],
        ['Blur', 'After your first move in a fight you can act again at once.', { blur: true }],
      ]),
      ...branch('evade', 'tempo-5', false, [
        ['Light Feet', '+1 AC in a fight.', { fightAc: 1 }],
        ['Open Ground', '+2 to Flee.', { flee: 2 }],
        ['Sidestep', 'Each time an enemy misses you, your next move comes 1 second sooner.', { missHasteMs: 1000 }],
        ['Slippery', '+1 AC in a fight and +2 to Flee, again.', { fightAc: 1, flee: 2 }],
        ['Untouchable', 'The first hit that would land on you in each fight misses instead.', { dodgeFirst: true }],
      ]),
    ],
  },
  {
    id: 'saddle', half: 'rider', name: 'Saddle', stat: "Your dragon's help", blurb: 'Draw more from the bond.',
    branches: [{ id: 'guide', name: 'Guidance', aspect: 'Checks with your dragon' }, { id: 'mount', name: 'Mounted', aspect: 'Fights with your dragon up' }],
    nodes: [
      ...trunk('saddle', [
        ['Leaning In', "Your dragon's help on checks +1.", { help: 1 }],
        ['Stirrup Strike', 'While your dragon is up in a fight: +1 to hit.', { mountHit: 1 }],
        ['Shared Calm', 'With a bonded dragon, wounds and conditions take 1 less off your checks.', { helpSteady: 1 }],
        ['Wing Cover', 'While your dragon is up in a fight: +1 AC.', { mountAc: 1 }],
        ['One Mind', "Your dragon's help on checks +1, again.", { help: 1 }],
      ]),
      ...branch('guide', 'saddle-5', false, [
        ['Warning Growl', 'With a bonded dragon, a failed physical check costs 2 less HP.', { helpSoften: 2 }],
        ['Steady Presence', 'Wounds and conditions take 1 less off your checks, again.', { helpSteady: 1 }],
        ['Shared Senses', "Your dragon's help on checks +1, again.", { help: 1 }],
        ['Second Look', "Once a day, a failed check is rolled again with your dragon's help. The better roll stands.", { secondLook: 1 }],
        ['Mind-speak', 'Second Look works three times a day, and with a bonded dragon a check never fails critically.', { secondLook: 2, helpNoCrit: true }],
      ]),
      ...branch('mount', 'saddle-5', false, [
        ['Paired Strike', 'While your dragon is up in a fight, your hits deal 1 more damage.', { mountDamage: 1 }],
        ['High Seat', 'While your dragon is up: +1 to hit, again.', { mountHit: 1 }],
        ['Under the Wing', 'While your dragon is up: +1 AC again, and every hit on you deals 1 less damage.', { mountAc: 1, mountGuard: 1 }],
        ['Shared Fury', 'When your dragon is hit, your next move comes 1.5 seconds sooner.', { mountHasteMs: 1500 }],
        ['Dragonrider', 'While your dragon is up, your hits roll 1 extra die and every hit on you deals 1 less damage, again.', { mountDice: 1, mountGuard: 1 }],
      ]),
    ],
  },
  {
    id: 'vigor', half: 'dragon', name: 'Vigor', stat: 'Dragon HP', blurb: 'A dragon that stays in the fight.',
    branches: [{ id: 'mend', name: 'Mending', aspect: 'Health that comes back' }, { id: 'endure', name: 'Endurance', aspect: 'More health, and a last stand' }],
    nodes: [
      ...same('vigor', ['Hearty', 'Broad', 'Thick-Blooded', 'Mighty', 'Towering'], "Your dragon's max HP +10.", { dHp: 10 }),
      ...branch('mend', 'vigor-5', false, [
        ['Good Hunting', 'A hunt mends half its health (from a quarter).', { dHuntMend: true }],
        ['Battle Mend', 'It recovers 2 HP on each of its turns in a fight.', { dMendTurn: 2 }],
        ['Deep Rest', 'A long rest mends it fully (from half).', { dRestMend: true }],
        ['Knitting Scales', 'It recovers 3 more HP on each of its turns (5 in all).', { dMendTurn: 3 }],
        ['Second Wind', 'Once a fight, when it falls to a quarter of its health or less, it recovers a third of it.', { dSecondWind: true }],
      ]),
      ...branch('endure', 'vigor-5', false, [
        ['Broad Chest', "Your dragon's max HP +12.", { dHp: 12 }],
        ['Deep Reserves', "Your dragon's max HP +12.", { dHp: 12 }],
        ['Old Strength', "Your dragon's max HP +20.", { dHp: 20 }],
        ["Victor's Rest", 'After a fight you win, it mends a fifth of its health.', { dWinMend: true }],
        ['Unbroken', 'Once a fight, a blow that would kill it leaves it at 1 HP.', { dLastStand: true }],
      ]),
    ],
  },
  {
    id: 'fang-and-flame', half: 'dragon', name: 'Fang and Flame', stat: 'Attack and fire', blurb: 'Sharper strikes and more fire.',
    branches: [{ id: 'bite', name: 'Fang', aspect: 'Its bite' }, { id: 'flame', name: 'Flame', aspect: 'Its fire' }],
    nodes: [
      ...trunk('ff', [
        ['Sharp Teeth', 'Its bite deals 2 more damage.', { dBite: 2 }],
        ["Hunter's Eye", '+1 to hit with its bite and its fire.', { dAtk: 1 }],
        ['Strong Jaws', 'Its bite deals 2 more damage.', { dBite: 2 }],
        ['Sure Strike', '+1 to hit with its bite and its fire.', { dAtk: 1 }],
        ['Killer', 'Its bite deals 2 more damage.', { dBite: 2 }],
      ]),
      ...branch('bite', 'ff-5', false, [
        ['Long Fangs', 'Its bite rolls 1 extra die.', { dBiteDice: 1 }],
        ['Crushing Jaws', 'Its bite deals 3 more damage.', { dBite: 3 }],
        ['Throat-Seeker', 'Its bite is critical on a 19 or 20.', { dCritFrom: 19 }],
        ['Rending', 'Its bite rolls 2 more dice.', { dBiteDice: 2 }],
        ['Savage', 'When its bite drops an enemy, it bites another at once.', { dCleave: true }],
      ]),
      ...branch('flame', 'ff-5', false, [
        ['Hotter', 'Its fire rolls 1 more die.', { dFireDice: 1 }],
        ['Eager Flame', 'It breathes fire whenever its fire is ready, even at a single enemy.', { dFireEager: true }],
        ['Quick Breath', 'Its fire is ready every second turn (from every third).', { dFireFast: true }],
        ['White Heat', 'Its fire rolls 2 more dice.', { dFireDice: 2 }],
        ['Inferno', 'It opens every fight with fire, and no enemy half-avoids its fire.', { dFireOpen: true }],
      ]),
    ],
  },
  {
    id: 'wing', half: 'dragon', name: 'Wing', stat: 'Speed', blurb: 'It strikes sooner and flies further.',
    branches: [{ id: 'swoop', name: 'Swoop', aspect: 'Striking first' }, { id: 'flight', name: 'Flight', aspect: 'The air, and getting you out' }],
    nodes: [
      ...same('wing', ['Tailwind', 'Updraft', 'Slipstream', 'Gale', 'Windborn'], 'Your dragon acts 0.4 seconds sooner in a fight.', { dTempoMs: 400 }),
      ...branch('swoop', 'wing-5', false, [
        ['Quick Launch', 'Its first move in a fight comes 3 seconds sooner.', { dOpenMs: 3000 }],
        ['Buffet', 'An enemy it bites has its next move delayed by 1 second.', { dHarryMs: 1000 }],
        ['Dive', 'It strikes the moment a fight starts.', { dOpenMs: 3000 }],
        ['Harry', 'An enemy it bites is delayed by 1.5 seconds more (2.5 in all).', { dHarryMs: 1500 }],
        ['Stormrider', "Every enemy's first move comes 4 seconds later.", { dFoeDelayMs: 4000 }],
      ]),
      ...branch('flight', 'wing-5', false, [
        ['Strong Wings', 'With your dragon up, +2 to Flee.', { dFlee: 2 }],
        ['Long Glide', 'It needs to fly with you every 3 days (from every 2).', { flyDays: 1 }],
        ['Sky Hunter', 'In a fight in the air: +2 to hit, and its bite deals 4 more damage.', { dAirHit: 2, dAirBite: 4 }],
        ['Tireless', 'It needs to fly every 4 days, and +2 to Flee again.', { flyDays: 1, dFlee: 2 }],
        ['Skyborne', 'With your dragon up, fleeing always works.', { dSureFlee: true }],
      ]),
    ],
  },
  {
    id: 'scale', half: 'dragon', name: 'Scale', stat: 'Armor', blurb: 'Harder to hit, harder to hurt.',
    branches: [{ id: 'hide', name: 'Hide', aspect: 'Taking less from every hit' }, { id: 'guard', name: 'Guardian', aspect: 'Shielding you' }],
    nodes: [
      ...trunk('scale', [
        ['Hard Scales', "Your dragon's AC +1.", { dAc: 1 }],
        ['Thick Plates', 'Every hit on your dragon deals 1 less damage.', { dSoak: 1 }],
        ['Harder Scales', "Your dragon's AC +1.", { dAc: 1 }],
        ['Thicker Plates', 'Every hit on your dragon deals 1 less damage.', { dSoak: 1 }],
        ['Armored', "Your dragon's AC +1.", { dAc: 1 }],
      ]),
      ...branch('hide', 'scale-5', false, [
        ['Thick Hide', 'Every hit on your dragon deals 1 less damage.', { dSoak: 1 }],
        ['Layered Scales', "Your dragon's AC +1.", { dAc: 1 }],
        ['Braced', 'Big telegraphed moves deal half damage to your dragon.', { dBrace: true }],
        ['Stone Hide', 'Every hit on your dragon deals 2 less damage.', { dSoak: 2 }],
        ['Ironhide', 'The first hit on your dragon in each fight does nothing.', { dFirstHit: true }],
      ]),
      ...branch('guard', 'scale-5', false, [
        ['Watchful', 'It shields you from a big move 65% of the time (from half).', { dShieldChance: 15 }],
        ['Close Guard', 'It shields you from bond 41 (from 61).', { dShieldBond: 41 }],
        ['Wingwall', 'A blow it shields deals a quarter of its damage (from half).', { dShieldDeep: true }],
        ['Ever Watchful', 'It shields you 90% of the time, at any bond.', { dShieldChance: 25, dShieldBond: 1 }],
        ['Aegis', 'Shielding you no longer uses its turn.', { dShieldFree: true }],
      ]),
    ],
  },
  {
    id: 'loyalty', half: 'dragon', name: 'Loyalty', stat: 'Trust', blurb: 'Trust that changes what it will do for you.',
    branches: [{ id: 'fierce', name: 'Fierce', aspect: 'Trust that sharpens its attacks' }, { id: 'devoted', name: 'Devoted', aspect: 'Trust that protects you' }],
    nodes: [
      ...trunk('loyalty', [
        ['Kept Faith', 'A hunt together earns 1 trust (once a day).', { trustHunt: 1 }],
        ['Shared Sky', 'A flight together earns 1 trust (once a day).', { trustFly: 1 }],
        ['Patient', 'It needs to hunt every 4 days (from every 3).', { huntDays: 1 }],
        ['Blooded Together', 'Winning a real fight side by side earns 1 trust.', { trustFight: 1 }],
        ['Forgiving', 'An unmet need costs no trust on its first day.', { needGrace: 1 }],
      ]),
      ...branch('fierce', 'loyalty-5', false, [
        ['Bared Teeth', 'At Guarded trust (21 or more): +1 to hit with its bite and its fire.', { t21Atk: 1 }],
        ['Blood Oath', 'At Guarded trust (21 or more): its bite deals 2 more damage.', { t21Bite: 2 }],
        ['Wrath', 'At Open trust (41 or more): it acts 1 second sooner in a fight.', { t41TempoMs: 1000 }],
        ['Vengeance', 'At Open trust (41 or more): once a fight, when you fall to half HP or less, it strikes at once.', { t41Avenge: true }],
        ['Fury', 'At Deep trust (61 or more): its bite rolls 2 extra dice.', { t61BiteDice: 2 }],
      ]),
      ...branch('devoted', 'loyalty-5', false, [
        ['At Your Side', "At Guarded trust (21 or more): your dragon's help on checks +1.", { t21Help: 1 }],
        ['Carry Me', 'At Guarded trust (21 or more): with your dragon up, +2 to Flee.', { t21Flee: 2 }],
        ['Take the Blow', 'At Open trust (41 or more): once a fight, a hit that would drop you lands on your dragon instead.', { t41TakeBlow: true }],
        ["Heart's Ease", 'At Open trust (41 or more): a short rest eases 1 more Signet Strain.', { t41RestEase: 1 }],
        ['Devoted', 'At Deep trust (61 or more): once a day, if you fall in a real fight it carries you out. The fight ends and you live at 1 HP.', { t61Rescue: true }],
      ]),
    ],
  },
];

/** Each node with the node that must be owned before it (null: none). */
const NODES = new Map<string, { node: NodeDef; spoke: SpokeDef; parent: string | null }>();
for (const spoke of WEB_SPOKES) {
  spoke.nodes.forEach((node, index) => NODES.set(node.id, { node, spoke, parent: node.parent !== undefined ? node.parent : index > 0 ? spoke.nodes[index - 1].id : null }));
}
/** What a node costs, in its half's own currency (XP for the rider's half, Kinship for the dragon's). */
export const nodeCost = (id: string): number | null => { const n = NODES.get(id); return n ? (n.spoke.half === 'dragon' ? KIN_COST : NODE_COST)[n.node.tier] : null; };
export const nodeCurrency = (id: string): Currency | null => { const n = NODES.get(id); return n ? currencyOf(n.spoke.half) : null; };
const spentIn = (nodes: string[], currency: Currency) => nodes.reduce((sum, id) => sum + (nodeCurrency(id) === currency ? nodeCost(id) ?? 0 : 0), 0);

// ── the ledger ──
/** Riders created before this moment start with enough XP for one small node (Justin, 2026-11-19). */
export const WEB_GRANT_BEFORE = Date.UTC(2026, 11, 1);
export const WEB_START_GRANT = NODE_COST.small;
/** ...and with enough Kinship for one small dragon node. */
export const KIN_START_GRANT = KIN_COST.small;
export const MAX_CAMPAIGNS = 200;

export interface WebLedger {
  v: 1;
  /** Node ids owned, in the order they were bought. */
  nodes: string[];
  /** XP spent on those nodes. */
  spent: number;
  /** XP the rules server has awarded this rider, per campaign. A campaign's number only goes up,
   *  and it stays after the campaign is deleted. */
  camps: Record<string, number>;
  /** A one-time starting amount. */
  grant: number;
  /** Kinship: spent on the dragon's nodes; earned per campaign (the campaign's own running total, which only goes up); and the one-time starting amount. */
  kspent: number;
  kcamps: Record<string, number>;
  kgrant: number;
}
const isEarlyRider = (createdAt: unknown): boolean => {
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) && t < WEB_GRANT_BEFORE;
};
const startGrant = (createdAt: unknown): number => (isEarlyRider(createdAt) ? WEB_START_GRANT : 0);
const readCamps = (raw: unknown, top: number): Record<string, number> => {
  const out: Record<string, number> = {};
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const key of Object.keys(r).slice(0, MAX_CAMPAIGNS)) out[key.slice(0, 60)] = clamp(int(r[key]), 0, top);
  return out;
};
/** Read the ledger out of the rider row's data. Anything missing or broken reads as empty, never as an error. */
export function normalizeLedger(data: unknown, riderCreatedAt?: unknown): WebLedger {
  const d = data && typeof data === 'object' ? (data as Record<string, any>) : {};
  const r = d.web && typeof d.web === 'object' ? (d.web as Record<string, any>) : null;
  const nodes: string[] = [];
  for (const id of Array.isArray(r?.nodes) ? r.nodes : []) if (typeof id === 'string' && NODES.has(id) && !nodes.includes(id)) nodes.push(id);
  const camps = readCamps(r?.camps, 100_000_000);
  // What was spent is always what the owned nodes cost, so a damaged number can never mint or burn XP or Kinship.
  const grant = r && Number.isFinite(Number(r.grant)) ? clamp(int(r.grant), 0, 100_000) : startGrant(riderCreatedAt);
  // A ledger saved before Kinship existed has no starting Kinship yet: it gets it now, once (the number is then saved with the ledger).
  const kgrant = r && r.kgrant != null && Number.isFinite(Number(r.kgrant)) ? clamp(int(r.kgrant), 0, 1000) : isEarlyRider(riderCreatedAt) ? KIN_START_GRANT : 0;
  return { v: 1, nodes, spent: spentIn(nodes, 'xp'), camps, grant, kspent: spentIn(nodes, 'kin'), kcamps: readCamps(r?.kcamps, 1_000_000), kgrant };
}
/** The rider row's data with this ledger in it; every other key is kept as it was. */
export function withLedger(data: unknown, ledger: WebLedger): Record<string, unknown> {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  return { ...d, web: ledger };
}
export const xpEarned = (l: WebLedger) => l.grant + Object.values(l.camps).reduce((sum, n) => sum + n, 0);
export const xpBalance = (l: WebLedger) => Math.max(0, xpEarned(l) - l.spent);
export const kinEarned = (l: WebLedger) => l.kgrant + Object.values(l.kcamps).reduce((sum, n) => sum + n, 0);
export const kinBalance = (l: WebLedger) => Math.max(0, kinEarned(l) - l.kspent);
/** Record the Kinship a campaign has earned so far (its own running total). Returns the same ledger when nothing is new. */
export function creditKinship(l: WebLedger, campaignId: string, kinSoFar: number): WebLedger {
  const have = l.kcamps[campaignId];
  const now = clamp(int(kinSoFar), 0, 1_000_000);
  if (have != null ? now <= have : now <= 0 || Object.keys(l.kcamps).length >= MAX_CAMPAIGNS) return l;
  return { ...l, kcamps: { ...l.kcamps, [campaignId]: now } };
}
/** Record the XP a campaign has paid so far. Returns the same ledger when nothing is new. */
export function creditCampaign(l: WebLedger, campaignId: string, xpSoFar: number): WebLedger {
  const have = l.camps[campaignId];
  const now = clamp(int(xpSoFar), 0, 100_000_000);
  if (have != null ? now <= have : now <= 0 || Object.keys(l.camps).length >= MAX_CAMPAIGNS) return l;
  return { ...l, camps: { ...l.camps, [campaignId]: now } };
}

// ── buying ──
type Refusal = string | null;
function refusal(l: WebLedger, id: string): Refusal {
  const found = NODES.get(id);
  if (!found) return 'That upgrade is not available yet.';
  if (l.nodes.includes(id)) return 'You already have that upgrade.';
  if (found.node.soon) return 'Coming in the next update.';
  const before = found.parent ? NODES.get(found.parent)?.node : null;
  if (before && !l.nodes.includes(before.id)) return `Unlock ${before.name} first.`;
  const kin = found.spoke.half === 'dragon';
  const short = (nodeCost(id) ?? 0) - (kin ? kinBalance(l) : xpBalance(l));
  if (short > 0) return `You need ${short} more ${kin ? 'Kinship' : 'XP'}.`;
  return null;
}
export function buyNode(l: WebLedger, id: string): { ok: true; ledger: WebLedger; name: string; effect: string } | { ok: false; error: string } {
  const no = refusal(l, id);
  const found = NODES.get(id);
  if (no || !found) return { ok: false, error: no || 'That upgrade is not available yet.' };
  const nodes = [...l.nodes, id];
  return { ok: true, ledger: { ...l, nodes, spent: spentIn(nodes, 'xp'), kspent: spentIn(nodes, 'kin') }, name: found.node.name, effect: found.node.effect };
}

// ── what the nodes do ──
/** Keys where owning more lowers the number: the lowest one owned wins (0: none owned). Every other number adds up; every flag is on once owned. */
const LOWEST = ['bloodPrice', 'critFrom', 'dCritFrom', 'dShieldBond'];
export function webBonuses(l: WebLedger): WebBonuses {
  const out: Record<string, number | boolean> = { ...NO_BONUSES };
  for (const id of l.nodes) {
    const g = NODES.get(id)?.node.gives as Record<string, number | boolean> | undefined;
    if (!g) continue;
    for (const key of Object.keys(g)) {
      const v = g[key], have = out[key];
      if (typeof v === 'boolean') { if (v) out[key] = true; }
      else if (typeof v === 'number' && typeof have === 'number') out[key] = LOWEST.includes(key) ? (have > 0 && v > 0 ? Math.min(have, v) : have || v) : have + v;
    }
  }
  return out as unknown as WebBonuses;
}
/** The bonuses with the dragon's trust applied: a Loyalty branch node works only once trust has reached its tier (null: no bonded dragon). */
export function withTrust(b: WebBonuses, trust: number | null): WebBonuses {
  const t = trust == null || !Number.isFinite(trust) ? -1 : trust;
  const guarded = t >= TRUST_GUARDED, open = t >= TRUST_OPEN, deep = t >= TRUST_DEEP;
  return {
    ...b,
    dAtk: b.dAtk + (guarded ? b.t21Atk : 0), dBite: b.dBite + (guarded ? b.t21Bite : 0), help: b.help + (guarded ? b.t21Help : 0), dFlee: b.dFlee + (guarded ? b.t21Flee : 0),
    dTempoMs: b.dTempoMs + (open ? b.t41TempoMs : 0), restEase: b.restEase + (open ? b.t41RestEase : 0), dAvenge: open && b.t41Avenge, dTakeBlow: open && b.t41TakeBlow,
    dBiteDice: b.dBiteDice + (deep ? b.t61BiteDice : 0), dRescue: deep && b.t61Rescue,
  };
}
export const STRAIN_TOP = 20;
/** The strain limit with the web's bonus on top. A phone that sends no limit, or 0 (no signet yet), gets no bonus. */
export function webStrainLimit(base: number | null, bonuses: WebBonuses): number | null {
  if (base == null || base <= 0) return base;
  return Math.min(STRAIN_TOP, base + Math.max(0, bonuses.strainLimit));
}

// ── what the phone shows ──
export interface WebNodeView {
  id: string; tier: NodeTier; name: string; effect: string; cost: number; owned: boolean; canBuy: boolean; why: string | null;
  /** What the cost is paid in: XP on the rider's half, Kinship on the dragon's. */
  currency: Currency;
  /** The node that must be owned first (null: the hub), the branch it sits on (null: the trunk), and whether it is not buyable yet. */
  parent: string | null; branch: string | null; soon: boolean;
}
export interface WebSpokeView {
  id: string; half: WebHalf; name: string; stat: string; blurb: string; coming: boolean; owned: number; nodes: WebNodeView[];
  branches: Array<{ id: string; name: string; aspect: string }>;
}
export interface WebView {
  xp: { earned: number; spent: number; balance: number };
  /** Kinship: the dragon's half is paid with it. */
  kin: { earned: number; spent: number; balance: number };
  owned: string[];
  bonuses: WebBonuses;
  spokes: WebSpokeView[];
}
export function webView(l: WebLedger): WebView {
  return {
    xp: { earned: xpEarned(l), spent: l.spent, balance: xpBalance(l) },
    kin: { earned: kinEarned(l), spent: l.kspent, balance: kinBalance(l) },
    owned: [...l.nodes],
    bonuses: webBonuses(l),
    spokes: WEB_SPOKES.map(s => ({
      id: s.id, half: s.half, name: s.name, stat: s.stat, blurb: s.blurb, coming: s.nodes.length === 0,
      owned: s.nodes.filter(n => l.nodes.includes(n.id)).length,
      branches: (s.branches ?? []).map(b => ({ ...b })),
      nodes: s.nodes.map(n => {
        const owned = l.nodes.includes(n.id);
        const why = owned ? null : refusal(l, n.id);
        return {
          id: n.id, tier: n.tier, name: n.name, effect: n.effect, cost: nodeCost(n.id) ?? 0, currency: currencyOf(s.half), owned, canBuy: !owned && !why, why,
          parent: NODES.get(n.id)?.parent ?? null, branch: n.branch ?? null, soon: !!n.soon,
        };
      }),
    })),
  };
}
