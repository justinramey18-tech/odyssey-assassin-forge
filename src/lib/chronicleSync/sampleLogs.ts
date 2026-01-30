// Chronicle Sync Sample Session Logs
// For testing the parsing system

export const SAMPLE_LOGS = {
  combat: `Session 12: The Goblin Ambush

The party ventured into the Darkwood Forest when suddenly, three goblins leaped from the bushes!

Round 1:
You draw your sword and strike at the nearest goblin with a quick draw attack. Rolling to hit... Natural 20! Critical hit! You deal 24 slashing damage to the goblin, completely obliterating it in one devastating blow. "That's what I call a warm-up!" you quip over the body.

Round 2:
The second goblin retaliates. You take 8 piercing damage from its rusty spear. Your ally casts Cure Wounds, healing you for 12 HP.

Round 3:
You counterattack after being hit, dealing another blow. The goblin falls! The last goblin tries to flee but you dash across the clearing and cut it down.

Combat Ends:
You gain 150 XP for defeating the goblin patrol. Searching the bodies, you find 2 health potions and 35 gold pieces.`,

  exploration: `Session 15: The Ancient Tomb

After days of travel, you finally reach the Tomb of the Forgotten King. The entrance is sealed with an ancient lock.

Investigation:
You discover a hidden path behind the statue, leading to a secret entrance. Inside, you carefully navigate the trapped corridors.

Treasure Room:
The main chamber contains an ornate chest. You search it thoroughly and find:
- 1 Scroll of Fireball
- 3 Potions of Greater Healing
- 150 gold pieces

You also discover a Potion of Invisibility hidden in a false bottom.

Your keen investigation earns you 200 XP for thoroughly exploring the tomb and finding all its secrets.`,

  social: `Session 18: The Noble's Ball

You arrive at Lord Blackwood's estate, dressed in your finest clothes. The ball is in full swing.

The guard at the entrance eyes you suspiciously. You distract the guard with a witty joke about his uniform looking like it was designed by a colorblind tailor. He laughs heartily, allowing you to slip past without invitation.

Inside, you spot the mark - Lady Ashford, carrying the enchanted amulet. You engage her in conversation, using charm and humor to defuse the tension when her husband becomes suspicious.

Breaking the fourth wall, you mutter "Plot armor, don't fail me now" before making your move.

The evening is a success. You gain 250 XP for completing the infiltration without combat. The DM also awards you 50 bonus XP for excellent roleplay.`,

  levelUp: `Session 20: The Dragon's End

The battle with the young red dragon reaches its climax. Your party has fought bravely through three rounds of intense combat.

Final Strike:
You leap from the elevated platform, performing a successful leap from 30 feet high. You plunge your blade into the dragon's neck as you descend. The creature roars and collapses.

Victory:
The dragon is slain! You gain 2500 XP for this legendary victory.

With this experience, you reach level 8! You feel power surging through you as you've reached level 8. The DM congratulates you on this milestone.

Loot:
Among the dragon's hoard, you find 500 gold pieces, 4 health potions, and a Potion of Fire Resistance.`,

  mixed: `Session 25: The Siege of Ironhold

The orc warband has breached the outer walls. You stand defending the gate.

Combat Round 1:
An orc berserker charges you. You take 18 slashing damage from its greataxe. You stumble but survive, reduced to 0 HP momentarily before your regeneration kicks in - surviving after being reduced to 0 HP.

Round 2:
Your ally rushes over and uses a Potion of Greater Healing on you, restoring 20 HP. You're back in the fight!

Round 3:
You counterattack after taking damage, delivering a devastating counterattack. You deal 25 damage with a mighty swing, followed by a critical hit for 32 more damage - complete overkill as the orc only had 10 HP left.

"Was that supposed to hurt?" you deliver a post-kill one-liner.

Round 4:
More orcs approach. You use non-verbal communication, signaling to your allies with hand signs. They understand perfectly and flank the enemies.

Combat Ends:
You dash action across the courtyard to help close the gate. The siege is repelled!

Rewards:
- Gain 450 XP for defending Ironhold
- Find 3 health potions on fallen enemies  
- Receive 100 gold pieces as reward from the town
- You've now reached level 6!

The captain also gifts you an Antitoxin for your bravery.`,
};

export const SAMPLE_LOG_DESCRIPTIONS: Record<keyof typeof SAMPLE_LOGS, string> = {
  combat: 'Combat encounter with goblins - tests XP, damage, healing, items, crits, and one-liners',
  exploration: 'Dungeon exploration - tests item acquisition, gold, and XP from exploration',
  social: 'Social encounter at a noble ball - tests achievement triggers for roleplay',
  levelUp: 'Dragon boss fight - tests level-up detection, large XP gains, and item loot',
  mixed: 'Siege battle - tests multiple achievement categories, HP changes, and item usage',
};

export type SampleLogKey = keyof typeof SAMPLE_LOGS;

export function getSampleLogKeys(): SampleLogKey[] {
  return Object.keys(SAMPLE_LOGS) as SampleLogKey[];
}
