// The 20 quick-add sparring opponents for host-launched Party Sparring.
import type { Foe } from '@/components/arena/ArenaPractice';

export type SparringFoe = Foe & { id: string; group: string; role: string; blurb: string; persona: string };

const f = (id: string, group: string, name: string, role: string, blurb: string, persona: string, maxHp: number, ac: number, attackBonus: number, damageAvg: number, speed: Foe['speed']): SparringFoe =>
  ({ id, group, name, role, blurb, persona, maxHp, ac, attackBonus, damageAvg, speed });

export const SPARRING_ROSTER: SparringFoe[] = [
  f('dummy', 'Practice Targets', 'Straw & Iron Dummy', 'Target Dummy', 'Never hits back. Test combos and spells.', 'A silent training dummy. It only creaks.', 200, 10, -20, 1, 'trivial'),
  f('automaton', 'Practice Targets', 'Clockwork Sparring Automaton', 'Defensive Tank', 'Brass robot with a buckler. Break its guard.', 'A ticking brass automaton that speaks in clipped drill commands.', 70, 17, 3, 5, 'easy'),
  f('bombardier', 'Practice Targets', 'Rust-Gear Bombardier', 'Ranged Artillerist', 'Hurls smoke bombs and firecrackers.', 'A wheezing rolling contraption that cackles through a tin horn.', 35, 13, 4, 6, 'medium'),
  f('goblin', 'Bandits & Brawlers', 'Goblin Skulker', 'Agile Skirmisher', 'Hit-and-run strikes. Hard to pin down.', 'A sneering, giggling goblin who mocks slow opponents.', 22, 15, 4, 5, 'hard'),
  f('brawler', 'Bandits & Brawlers', 'Tavern Brawler', 'Grappler', 'Loves grabbing shirts. Pin escape practice.', 'A loud, cheerful drunk bruiser who wants a good scrap.', 45, 12, 4, 6, 'medium'),
  f('cutpurse', 'Bandits & Brawlers', 'Highway Cutpurse', 'Ambush Rogue', 'Twin daggers, deadly critical strikes.', 'A smooth-talking thief who taunts with stolen trinkets.', 30, 14, 5, 7, 'hard'),
  f('enforcer', 'Bandits & Brawlers', 'Bandit Enforcer', 'Heavy Bruiser', 'Slow, telegraphed power strikes.', 'A grim, scarred bandit of few words and heavy swings.', 60, 13, 5, 9, 'easy'),
  f('duelist', 'Trained Fighters', 'Silverguard Duelist', 'Precision Fencer', 'Fast rapier. Parry Duel practice.', 'A polite, proud fencer who critiques footwork.', 40, 16, 6, 7, 'hard'),
  f('shieldbreaker', 'Trained Fighters', 'Dwarven Shield-Breaker', 'Armor Breaker', 'Plate armor and a two-handed warhammer.', 'A gruff dwarf who laughs when the hammer lands.', 65, 18, 5, 10, 'easy'),
  f('ranger', 'Trained Fighters', 'High-Elf Ranger', 'Long-Range Archer', 'Rapid arrows from afar.', 'A calm, aloof elf who comments on your stance.', 35, 15, 7, 7, 'medium'),
  f('monk', 'Trained Fighters', 'Wandering Martial Artist', 'Combo Striker', 'Swift palm and kick flurries.', 'A serene monk who speaks in short proverbs.', 40, 16, 6, 6, 'deadly'),
  f('pyromancer', 'Spellcasters', 'Apprentice Pyromancer', 'Fire Blaster', 'Explosive bursts of flame.', 'An over-eager young mage who apologises after every fireball.', 28, 12, 6, 9, 'medium'),
  f('witch', 'Spellcasters', 'Hedge Witch', 'Curser & Controller', 'Slowing hexes and blinding fog.', 'A cackling old witch full of riddles and threats.', 32, 12, 5, 6, 'medium'),
  f('acolyte', 'Spellcasters', 'Combat Acolyte', 'Field Medic', 'Heals and wards the other opponents.', 'A soft-spoken acolyte who prays for everyone in the ring.', 30, 15, 4, 4, 'easy'),
  f('stormcaller', 'Spellcasters', 'Storm Caller', 'Lightning Shocker', 'Bolts that punish tight formations.', 'A dramatic storm mage who shouts at the sky.', 34, 13, 6, 8, 'medium'),
  f('wolf', 'Beasts', 'Timber Wolf Alpha', 'Pack Leader', 'Fast predator that tries takedowns.', 'A snarling wolf. It only growls and howls, never speaks words.', 38, 14, 5, 7, 'hard'),
  f('bear', 'Beasts', 'Cave Bear', 'Raw Muscle', 'Huge health, sweeping claw swipes.', 'An enormous bear. It only roars and huffs, never speaks words.', 80, 12, 6, 10, 'easy'),
  f('viper', 'Beasts', 'Venomfang Viper', 'Poison Skirmisher', 'Quick bites with lingering venom.', 'A hissing serpent. It only hisses, never speaks words.', 24, 14, 6, 6, 'deadly'),
  f('champion', 'Elite & Bosses', 'Veteran Arena Champion', 'Elite Duelist', 'Master gladiator, shifting stances.', 'A famous, swaggering gladiator who plays to the crowd.', 110, 17, 8, 12, 'hard'),
  f('golem', 'Elite & Bosses', 'Obsidian Golem Replica', 'Raid Boss', 'Massive defense, earth-shaking stomps.', 'A towering stone construct that rumbles single ominous words.', 200, 18, 8, 15, 'easy'),
];

export const MAX_SPARRING_FOES = 6;

/** Turn a pick list (roster id -> count) into named opponents; duplicates get numbered. Capped. */
export function buildSparringFoes(counts: Record<string, number>): SparringFoe[] {
  const out: SparringFoe[] = [];
  for (const r of SPARRING_ROSTER) {
    const n = Math.max(0, Math.floor(Number(counts[r.id]) || 0));
    for (let i = 0; i < n && out.length < MAX_SPARRING_FOES; i++) out.push({ ...r, name: n > 1 ? `${r.name} ${i + 1}` : r.name });
  }
  return out;
}
