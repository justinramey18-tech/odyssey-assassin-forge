// Solo Empyrean progression web: pure functions only (no Deno, no database, no network), so the
// same file runs in the edge function and in the app's tests.
// A rider spends XP on nodes. The level system is untouched: nodes are a bonus on top of it.
// The ledger (nodes owned, XP spent, XP earned per campaign) is kept on the server, in the
// rider's row (empyrean_riders.data.web). The phone only shows what this file works out.

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const int = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

export type WebHalf = 'rider' | 'dragon';
export type NodeTier = 'small' | 'big' | 'capstone';
export const NODE_COST: Record<NodeTier, number> = { small: 150, big: 400, capstone: 1000 };

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

/** The whole web. A spoke with no nodes is shown as "coming": it cannot be bought yet. */
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
  { id: 'blade', half: 'rider', name: 'Blade', stat: 'Attack and damage', blurb: 'Hit more often, and harder.', nodes: [] },
  { id: 'tempo', half: 'rider', name: 'Tempo', stat: 'Speed', blurb: 'Act sooner in a fight, and get clear of one.', nodes: [] },
  { id: 'saddle', half: 'rider', name: 'Saddle', stat: "Your dragon's help", blurb: 'Draw more from the bond.', nodes: [] },
  { id: 'vigor', half: 'dragon', name: 'Vigor', stat: 'Dragon HP', blurb: 'A dragon that stays in the fight.', nodes: [] },
  { id: 'fang-and-flame', half: 'dragon', name: 'Fang and Flame', stat: 'Attack and fire', blurb: 'Sharper strikes and more fire.', nodes: [] },
  { id: 'wing', half: 'dragon', name: 'Wing', stat: 'Speed', blurb: 'It strikes sooner and flies further.', nodes: [] },
  { id: 'scale', half: 'dragon', name: 'Scale', stat: 'Armor', blurb: 'Harder to hit, harder to hurt.', nodes: [] },
  { id: 'loyalty', half: 'dragon', name: 'Loyalty', stat: 'Trust', blurb: 'Trust that changes what it will do for you.', nodes: [] },
];

/** Each node with the node that must be owned before it (null: none). */
const NODES = new Map<string, { node: NodeDef; spoke: SpokeDef; parent: string | null }>();
for (const spoke of WEB_SPOKES) {
  spoke.nodes.forEach((node, index) => NODES.set(node.id, { node, spoke, parent: node.parent !== undefined ? node.parent : index > 0 ? spoke.nodes[index - 1].id : null }));
}
export const nodeCost = (id: string): number | null => { const n = NODES.get(id); return n ? NODE_COST[n.node.tier] : null; };

// ── the ledger ──
/** Riders created before this moment start with enough XP for one small node (Justin, 2026-11-19). */
export const WEB_GRANT_BEFORE = Date.UTC(2026, 11, 1);
export const WEB_START_GRANT = NODE_COST.small;
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
}
const startGrant = (createdAt: unknown): number => {
  const t = typeof createdAt === 'string' ? Date.parse(createdAt) : NaN;
  return Number.isFinite(t) && t < WEB_GRANT_BEFORE ? WEB_START_GRANT : 0;
};
/** Read the ledger out of the rider row's data. Anything missing or broken reads as empty, never as an error. */
export function normalizeLedger(data: unknown, riderCreatedAt?: unknown): WebLedger {
  const d = data && typeof data === 'object' ? (data as Record<string, any>) : {};
  const r = d.web && typeof d.web === 'object' ? (d.web as Record<string, any>) : null;
  const nodes: string[] = [];
  for (const id of Array.isArray(r?.nodes) ? r.nodes : []) if (typeof id === 'string' && NODES.has(id) && !nodes.includes(id)) nodes.push(id);
  const camps: Record<string, number> = {};
  const rawCamps = r?.camps && typeof r.camps === 'object' ? (r.camps as Record<string, unknown>) : {};
  for (const key of Object.keys(rawCamps).slice(0, MAX_CAMPAIGNS)) camps[key.slice(0, 60)] = clamp(int(rawCamps[key]), 0, 100_000_000);
  // What was spent is always what the owned nodes cost, so a damaged number can never mint or burn XP.
  const spent = nodes.reduce((sum, id) => sum + (nodeCost(id) ?? 0), 0);
  const grant = r && Number.isFinite(Number(r.grant)) ? clamp(int(r.grant), 0, 100_000) : startGrant(riderCreatedAt);
  return { v: 1, nodes, spent, camps, grant };
}
/** The rider row's data with this ledger in it; every other key is kept as it was. */
export function withLedger(data: unknown, ledger: WebLedger): Record<string, unknown> {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  return { ...d, web: ledger };
}
export const xpEarned = (l: WebLedger) => l.grant + Object.values(l.camps).reduce((sum, n) => sum + n, 0);
export const xpBalance = (l: WebLedger) => Math.max(0, xpEarned(l) - l.spent);
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
  const cost = NODE_COST[found.node.tier];
  const short = cost - xpBalance(l);
  if (short > 0) return `You need ${short} more XP.`;
  return null;
}
export function buyNode(l: WebLedger, id: string): { ok: true; ledger: WebLedger; name: string; effect: string } | { ok: false; error: string } {
  const no = refusal(l, id);
  const found = NODES.get(id);
  if (no || !found) return { ok: false, error: no || 'That upgrade is not available yet.' };
  return { ok: true, ledger: { ...l, nodes: [...l.nodes, id], spent: l.spent + NODE_COST[found.node.tier] }, name: found.node.name, effect: found.node.effect };
}

// ── what the nodes do ──
export function webBonuses(l: WebLedger): WebBonuses {
  const out: WebBonuses = { ...NO_BONUSES };
  for (const id of l.nodes) {
    const g = NODES.get(id)?.node.gives;
    if (!g) continue;
    out.strainLimit += g.strainLimit ?? 0;
    out.backlashOff += g.backlashOff ?? 0;
    if (g.freeChannel) out.freeChannel = true;
    out.maxHp += g.maxHp ?? 0;
    out.wardMax += g.wardMax ?? 0;
    if (g.wardShortRest) out.wardShortRest = true;
    if (g.wardFightRefill) out.wardFightRefill = true;
    out.regenHour += g.regenHour ?? 0;
    out.regenTurn += g.regenTurn ?? 0;
    if (g.regenWard) out.regenWard = true;
    out.adrDamage += g.adrDamage ?? 0;
    out.adrHit += g.adrHit ?? 0;
    if (g.adrDouble) out.adrDouble = true;
    out.adrHasteMs += g.adrHasteMs ?? 0;
    // The price of blood only ever falls: the cheapest owned node sets it.
    if (g.bloodPrice) out.bloodPrice = out.bloodPrice > 0 ? Math.min(out.bloodPrice, g.bloodPrice) : g.bloodPrice;
    if (g.bloodEase) out.bloodEase = true;
    if (g.heartfire) out.heartfire = true;
    out.sigDamage += g.sigDamage ?? 0;
    out.sigDice += g.sigDice ?? 0;
    if (g.sigKillRefund) out.sigKillRefund = true;
    out.signetCheck += g.signetCheck ?? 0;
    if (g.steadySignet) out.steadySignet = true;
    out.restEase += g.restEase ?? 0;
    out.groundEase += g.groundEase ?? 0;
    out.coolEase += g.coolEase ?? 0;
    out.strainHour += g.strainHour ?? 0;
    out.masteryXp += g.masteryXp ?? 0;
    out.masteryCap += g.masteryCap ?? 0;
    if (g.masteryRankUp) out.masteryRankUp = true;
  }
  return out;
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
  /** The node that must be owned first (null: the hub), the branch it sits on (null: the trunk), and whether it is not buyable yet. */
  parent: string | null; branch: string | null; soon: boolean;
}
export interface WebSpokeView {
  id: string; half: WebHalf; name: string; stat: string; blurb: string; coming: boolean; owned: number; nodes: WebNodeView[];
  branches: Array<{ id: string; name: string; aspect: string }>;
}
export interface WebView {
  xp: { earned: number; spent: number; balance: number };
  owned: string[];
  bonuses: WebBonuses;
  spokes: WebSpokeView[];
}
export function webView(l: WebLedger): WebView {
  return {
    xp: { earned: xpEarned(l), spent: l.spent, balance: xpBalance(l) },
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
          id: n.id, tier: n.tier, name: n.name, effect: n.effect, cost: NODE_COST[n.tier], owned, canBuy: !owned && !why, why,
          parent: NODES.get(n.id)?.parent ?? null, branch: n.branch ?? null, soon: !!n.soon,
        };
      }),
    })),
  };
}
