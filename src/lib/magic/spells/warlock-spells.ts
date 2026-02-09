// Warlock Spell List
// Charisma-based Pact Magic caster with unique patron-flavored spells

import { SpellDefinition } from '../types';

export const WARLOCK_SPELLS: SpellDefinition[] = [
  // ============================================
  // CANTRIPS (Level 0)
  // ============================================
  {
    id: 'eldritch-blast',
    name: 'Eldritch Blast',
    level: 0,
    school: 'evocation',
    castingTime: 'action',
    range: '120 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack. On a hit, the target takes 1d10 force damage. The spell creates more beams at higher levels: two at 5th, three at 11th, and four at 17th.',
    attackType: 'ranged',
    damageType: 'force',
    damageFormula: '1d10',
    iconName: 'Zap',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'THE SIGNATURE WARLOCK CANTRIP. FORCE DAMAGE THAT SCALES WITH YOUR LEVEL.',
      jarvis: 'Eldritch Blast is the quintessential warlock attack. Multiple beams at higher levels make this remarkably efficient.',
      deadpool: 'Pew pew pew! It\'s like finger guns but they actually work!'
    }
  },
  {
    id: 'chill-touch-warlock',
    name: 'Chill Touch',
    level: 0,
    school: 'necromancy',
    castingTime: 'action',
    range: '120 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 necrotic damage and can\'t regain hit points until the start of your next turn.',
    attackType: 'ranged',
    damageType: 'necrotic',
    damageFormula: '1d8',
    iconName: 'Hand',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'NECROTIC DAMAGE AND HEALING PREVENTION. EXCELLENT AGAINST REGENERATORS.',
      jarvis: 'Despite the name, this spell deals necrotic damage and prevents healing—quite effective against trolls.',
      deadpool: 'It\'s called Chill Touch but it\'s neither chilly nor touchy. Discuss.'
    }
  },
  {
    id: 'minor-illusion-warlock',
    name: 'Minor Illusion',
    level: 0,
    school: 'illusion',
    castingTime: 'action',
    range: '30 feet',
    components: { somatic: true, material: 'A bit of fleece', verbal: false },
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description: 'You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.',
    iconName: 'Image',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'VERSATILE UTILITY CANTRIP. SOUND OR IMAGE, YOUR CHOICE.',
      jarvis: 'A remarkably versatile cantrip for distraction, deception, or simple entertainment.',
      deadpool: 'I use this to make fart sounds during serious moments. No regrets.'
    }
  },
  {
    id: 'prestidigitation-warlock',
    name: 'Prestidigitation',
    level: 0,
    school: 'transmutation',
    castingTime: 'action',
    range: '10 feet',
    components: { verbal: true, somatic: true },
    duration: '1 hour',
    concentration: false,
    ritual: false,
    description: 'This spell is a minor magical trick that novice spellcasters use for practice. You create one of several minor effects: sensory effect, light/snuff flames, clean/soil objects, chill/warm/flavor materials, create symbols, or create trinkets.',
    iconName: 'Sparkles',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'THE SWISS ARMY KNIFE OF CANTRIPS. INFINITE UTILITY APPLICATIONS.',
      jarvis: 'A delightful utility cantrip with numerous practical applications in social situations.',
      deadpool: 'I mostly use it to make my coffee the perfect temperature. Priorities.'
    }
  },
  {
    id: 'mage-hand-warlock',
    name: 'Mage Hand',
    level: 0,
    school: 'conjuration',
    castingTime: 'action',
    range: '30 feet',
    components: { verbal: true, somatic: true },
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description: 'A spectral, floating hand appears at a point you choose within range. The hand can manipulate objects, open doors, stow items, or pour out vials. It can\'t attack, activate magic items, or carry more than 10 pounds.',
    iconName: 'Hand',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'TELEKINETIC UTILITY. REACH WHAT YOU CANNOT TOUCH.',
      jarvis: 'Quite useful for handling suspicious objects from a safe distance.',
      deadpool: 'Finally, I can scratch that spot on my back I could never reach!'
    }
  },
  {
    id: 'true-strike-warlock',
    name: 'True Strike',
    level: 0,
    school: 'divination',
    castingTime: 'action',
    range: 'Self',
    components: { somatic: true, verbal: false },
    duration: 'Concentration, up to 1 round',
    concentration: true,
    ritual: false,
    description: 'You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target\'s defenses. On your next turn, you gain advantage on your first attack roll against the target.',
    iconName: 'Target',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'GRANTS ADVANTAGE ON YOUR NEXT ATTACK. TACTICAL SETUP.',
      jarvis: 'The action economy makes this situationally useful at best.',
      deadpool: 'Takes your whole turn to get advantage? Just attack twice!'
    }
  },
  {
    id: 'poison-spray-warlock',
    name: 'Poison Spray',
    level: 0,
    school: 'conjuration',
    castingTime: 'action',
    range: '10 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You extend your hand toward a creature you can see within range and project a puff of noxious gas. The creature must succeed on a Constitution saving throw or take 1d12 poison damage.',
    attackType: 'save',
    saveStat: 'CON',
    damageType: 'poison',
    damageFormula: '1d12',
    iconName: 'Skull',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'HIGH DAMAGE CANTRIP BUT SHORT RANGE AND COMMON RESISTANCE.',
      jarvis: 'The d12 damage die is impressive, but many creatures resist poison.',
      deadpool: 'It\'s like a magical crop duster. Toot toot!'
    }
  },

  // ============================================
  // 1ST LEVEL SPELLS
  // ============================================
  {
    id: 'hex',
    name: 'Hex',
    level: 1,
    school: 'enchantment',
    castingTime: 'bonus_action',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: 'The petrified eye of a newt' },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    ritual: false,
    description: 'You place a curse on a creature. Until the spell ends, you deal an extra 1d6 necrotic damage whenever you hit the target with an attack. Also, choose one ability—the target has disadvantage on ability checks made with that ability.',
    higherLevels: 'Duration increases: 3rd level (8 hours), 5th level (24 hours).',
    damageType: 'necrotic',
    damageFormula: '1d6',
    iconName: 'Crosshair',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'THE WARLOCK\'S SIGNATURE DAMAGE BOOST. PAIRS PERFECTLY WITH ELDRITCH BLAST.',
      jarvis: 'A bonus action curse that adds 1d6 to each Eldritch Blast beam. Mathematically excellent.',
      deadpool: 'Hex + Eldritch Blast = I love the smell of necrotic damage in the morning!'
    }
  },
  {
    id: 'armor-of-agathys',
    name: 'Armor of Agathys',
    level: 1,
    school: 'abjuration',
    castingTime: 'action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: 'A cup of water' },
    duration: '1 hour',
    concentration: false,
    ritual: false,
    description: 'A protective magical force surrounds you, manifesting as spectral frost. You gain 5 temporary hit points. If a creature hits you with a melee attack while you have these temp HP, it takes 5 cold damage.',
    higherLevels: 'Both temp HP and damage increase by 5 per slot level above 1st.',
    damageType: 'cold',
    iconName: 'Snowflake',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'TEMP HP AND COLD RETALIATION. SCALES WELL WITH HIGHER SLOTS.',
      jarvis: 'Non-concentration temp HP that punishes melee attackers. Quite defensive for a warlock.',
      deadpool: 'Touch me and freeze! Like licking a flagpole in winter!'
    }
  },
  {
    id: 'hellish-rebuke',
    name: 'Hellish Rebuke',
    level: 1,
    school: 'evocation',
    castingTime: 'reaction',
    range: '60 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You point your finger at a creature that damaged you, and it is momentarily surrounded by hellish flames. The creature must make a Dexterity saving throw, taking 2d10 fire damage on a failure, or half on success.',
    higherLevels: 'Damage increases by 1d10 per slot level above 1st.',
    attackType: 'save',
    saveStat: 'DEX',
    damageType: 'fire',
    damageFormula: '2d10',
    iconName: 'Flame',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'REACTION-BASED REVENGE. 2D10 FIRE DAMAGE FOR HITTING YOU.',
      jarvis: 'An excellent use of your reaction—punish attackers with hellfire.',
      deadpool: 'You hit me? SURPRISE! You\'re on fire now!'
    }
  },
  {
    id: 'arms-of-hadar',
    name: 'Arms of Hadar',
    level: 1,
    school: 'conjuration',
    castingTime: 'action',
    range: 'Self (10-foot radius)',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You invoke the power of Hadar. Tendrils of dark energy erupt from you. Each creature in a 10-foot radius must make a Strength save, taking 2d6 necrotic damage on failure (half on success), and can\'t take reactions until its next turn.',
    higherLevels: 'Damage increases by 1d6 per slot level above 1st.',
    attackType: 'save',
    saveStat: 'STR',
    damageType: 'necrotic',
    damageFormula: '2d6',
    iconName: 'Circle',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'AOE NECROTIC BURST. PREVENTS REACTIONS AND OPPORTUNITY ATTACKS.',
      jarvis: 'When surrounded, this clears space and prevents enemy reactions.',
      deadpool: 'Tentacles from the void! This got weird fast!'
    }
  },
  {
    id: 'charm-person-warlock',
    name: 'Charm Person',
    level: 1,
    school: 'enchantment',
    castingTime: 'action',
    range: '30 feet',
    components: { verbal: true, somatic: true },
    duration: '1 hour',
    concentration: false,
    ritual: false,
    description: 'You attempt to charm a humanoid. It must make a Wisdom save (with advantage if you\'re fighting it). On failure, it is charmed and regards you as a friendly acquaintance. The effect ends if you harm it.',
    higherLevels: 'Target one additional creature per slot level above 1st.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'Heart',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'SOCIAL MANIPULATION SPELL. TARGET KNOWS THEY WERE CHARMED AFTERWARD.',
      jarvis: 'Useful for social encounters, but the target will know afterwards.',
      deadpool: 'Make friends and influence people! Magically!'
    }
  },
  {
    id: 'protection-from-evil-and-good-warlock',
    name: 'Protection from Evil and Good',
    level: 1,
    school: 'abjuration',
    castingTime: 'action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: 'Holy water or powdered silver and iron', materialConsumed: true },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: false,
    description: 'Until the spell ends, one willing creature is protected against aberrations, celestials, elementals, fey, fiends, and undead. Those creatures have disadvantage on attacks against the target and can\'t charm, frighten, or possess it.',
    iconName: 'ShieldCheck',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'PROTECTION AGAINST EXTRAPLANAR THREATS. ESSENTIAL FOR PATRON DEALINGS.',
      jarvis: 'Given your patron situation, this spell has certain ironic applications.',
      deadpool: 'Protects against your boss! Awkward workplace dynamics!'
    }
  },
  {
    id: 'expeditious-retreat-warlock',
    name: 'Expeditious Retreat',
    level: 1,
    school: 'transmutation',
    castingTime: 'bonus_action',
    range: 'Self',
    components: { verbal: true, somatic: true },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: false,
    description: 'This spell allows you to move at an incredible pace. When you cast this spell, and as a bonus action on each of your turns until the spell ends, you can take the Dash action.',
    iconName: 'Zap',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'BONUS ACTION DASH EACH TURN. EXCELLENT MOBILITY.',
      jarvis: 'Continuous dashing makes this excellent for repositioning or retreat.',
      deadpool: 'Run away! Run away! But stylishly!'
    }
  },
  {
    id: 'unseen-servant-warlock',
    name: 'Unseen Servant',
    level: 1,
    school: 'conjuration',
    castingTime: 'action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: 'A piece of string and wood' },
    duration: '1 hour',
    concentration: false,
    ritual: true,
    description: 'This spell creates an invisible, mindless, shapeless force that performs simple tasks at your command. The servant can perform simple tasks like fetching items, cleaning, and holding things.',
    iconName: 'Ghost',
    classes: ['warlock', 'wizard'],
    personalityQuips: {
      thunderhead: 'INVISIBLE HELPER FOR MUNDANE TASKS. RITUAL CASTABLE.',
      jarvis: 'Like having a ghostly butler. Quite convenient for camp setup.',
      deadpool: 'Invisible maid service! Finally, someone to pick up my chimichangas!'
    }
  },

  // ============================================
  // 2ND LEVEL SPELLS
  // ============================================
  {
    id: 'darkness-warlock',
    name: 'Darkness',
    level: 2,
    school: 'evocation',
    castingTime: 'action',
    range: '60 feet',
    components: { verbal: true, somatic: false, material: 'Bat fur and a drop of pitch or coal' },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: false,
    description: 'Magical darkness spreads from a point within range to fill a 15-foot-radius sphere. Creatures with darkvision can\'t see through it, and nonmagical light can\'t illuminate it. Pairs with Devil\'s Sight invocation.',
    iconName: 'Moon',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'IMPENETRABLE DARKNESS. COMBINE WITH DEVIL\'S SIGHT FOR ADVANTAGE.',
      jarvis: 'The Devil\'s Sight invocation makes this a powerful combat tool.',
      deadpool: 'Can\'t hit what you can\'t see! Unless you\'re me. I can see fine.'
    }
  },
  {
    id: 'hold-person-warlock',
    name: 'Hold Person',
    level: 2,
    school: 'enchantment',
    castingTime: 'action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: 'A small, straight piece of iron' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'Choose a humanoid you can see. The target must succeed on a Wisdom save or be paralyzed for the duration. The target can repeat the save at the end of each of its turns.',
    higherLevels: 'Target one additional humanoid per slot level above 2nd.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'Lock',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'PARALYSIS MEANS AUTO-CRIT ON MELEE HITS. DEVASTATING.',
      jarvis: 'Paralyzed targets grant automatic critical hits to melee attackers within 5 feet.',
      deadpool: 'Freeze! No, literally freeze. You can\'t move at all.'
    }
  },
  {
    id: 'invisibility-warlock',
    name: 'Invisibility',
    level: 2,
    school: 'illusion',
    castingTime: 'action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: 'An eyelash encased in gum arabic' },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    ritual: false,
    description: 'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it remains on the target. The spell ends if the target attacks or casts a spell.',
    higherLevels: 'Target one additional creature per slot level above 2nd.',
    iconName: 'Eye',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'COMPLETE INVISIBILITY UNTIL YOU ATTACK. EXCELLENT FOR INFILTRATION.',
      jarvis: 'Remember: attacking or casting ends the effect immediately.',
      deadpool: 'Now you see me... now you don\'t! Classic!'
    }
  },
  {
    id: 'misty-step-warlock',
    name: 'Misty Step',
    level: 2,
    school: 'conjuration',
    castingTime: 'bonus_action',
    range: 'Self',
    components: { verbal: true, somatic: false },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
    iconName: 'Wind',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'BONUS ACTION TELEPORT. ESCAPE OR REPOSITION INSTANTLY.',
      jarvis: 'Thirty feet of instantaneous repositioning as a bonus action. Exceptional mobility.',
      deadpool: 'Bamf! Just like that blue fuzzy guy!'
    }
  },
  {
    id: 'suggestion-warlock',
    name: 'Suggestion',
    level: 2,
    school: 'enchantment',
    castingTime: 'action',
    range: '30 feet',
    components: { verbal: true, somatic: false, material: 'A snake\'s tongue and honeycomb' },
    duration: 'Concentration, up to 8 hours',
    concentration: true,
    ritual: false,
    description: 'You suggest a course of activity (limited to a sentence or two) and magically influence a creature you can see. The suggestion must be worded to make the course of action sound reasonable.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'MessageCircle',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'POWERFUL SOCIAL MANIPULATION. WORDING IS CRUCIAL.',
      jarvis: 'The phrasing must sound reasonable—creativity in wording is rewarded.',
      deadpool: 'Hey, wouldn\'t it be cool if you just... walked away from this fight?'
    }
  },
  {
    id: 'spider-climb-warlock',
    name: 'Spider Climb',
    level: 2,
    school: 'transmutation',
    castingTime: 'action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: 'A drop of bitumen and a spider' },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    ritual: false,
    description: 'Until the spell ends, one willing creature you touch gains the ability to move up, down, and across vertical surfaces and upside down along ceilings, while leaving its hands free. The target gains a climbing speed equal to its walking speed.',
    iconName: 'Bug',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'WALK ON WALLS AND CEILINGS. EXCELLENT FOR INFILTRATION.',
      jarvis: 'Hands-free climbing opens many tactical possibilities.',
      deadpool: 'Spider-Warlock, Spider-Warlock, does whatever a spider... lock?'
    }
  },
  {
    id: 'mirror-image-warlock',
    name: 'Mirror Image',
    level: 2,
    school: 'illusion',
    castingTime: 'action',
    range: 'Self',
    components: { verbal: true, somatic: true },
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description: 'Three illusory duplicates of yourself appear in your space. Each duplicate has AC 10 + your Dexterity modifier. When attacked, roll to determine if the attack targets a duplicate instead.',
    iconName: 'Users',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'NON-CONCENTRATION DEFENSE. THREE DUPLICATES ABSORB ATTACKS.',
      jarvis: 'Excellent defensive spell that doesn\'t compete for concentration.',
      deadpool: 'Now there\'s three of me! The world isn\'t ready!'
    }
  },

  // ============================================
  // 3RD LEVEL SPELLS
  // ============================================
  {
    id: 'hunger-of-hadar',
    name: 'Hunger of Hadar',
    level: 3,
    school: 'conjuration',
    castingTime: 'action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: 'A pickled octopus tentacle' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'You open a gateway to the void between stars. A 20-foot-radius sphere of blackness and bitter cold appears. No light can illuminate it. Creatures starting their turn in the area take 2d6 cold damage. Creatures ending their turn there must save or take 2d6 acid damage.',
    attackType: 'save',
    saveStat: 'DEX',
    damageType: 'cold',
    damageFormula: '2d6',
    iconName: 'Circle',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'VOID ZONE. COLD AND ACID DAMAGE, BLOCKS ALL LIGHT.',
      jarvis: 'Area denial with dual damage types. Even Devil\'s Sight doesn\'t work in it.',
      deadpool: 'The hungry void! It\'s like a black hole with an appetite!'
    }
  },
  {
    id: 'counterspell-warlock',
    name: 'Counterspell',
    level: 3,
    school: 'abjuration',
    castingTime: 'reaction',
    range: '60 feet',
    components: { verbal: false, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You attempt to interrupt a creature casting a spell. If the spell is 3rd level or lower, it fails. For higher level spells, make an ability check using your spellcasting ability (DC 10 + spell level).',
    higherLevels: 'Automatically counters spells of the slot level used or lower.',
    iconName: 'Ban',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'NEGATE ENEMY SPELLS. ESSENTIAL AGAINST CASTERS.',
      jarvis: 'Warlock pact slots always cast at maximum level, making this more reliable.',
      deadpool: 'Nope! No magic for you! Denied!'
    }
  },
  {
    id: 'dispel-magic-warlock',
    name: 'Dispel Magic',
    level: 3,
    school: 'abjuration',
    castingTime: 'action',
    range: '120 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'Choose one creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends. For higher level spells, make an ability check (DC 10 + spell level) to end the effect.',
    higherLevels: 'Automatically ends spells of the slot level used or lower.',
    iconName: 'XCircle',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'REMOVE MAGICAL EFFECTS. WARLOCK SLOTS MAKE THIS POWERFUL.',
      jarvis: 'Your pact slots cast this at higher level, improving success rate.',
      deadpool: 'Magic? What magic? I don\'t see any magic here!'
    }
  },
  {
    id: 'fly-warlock',
    name: 'Fly',
    level: 3,
    school: 'transmutation',
    castingTime: 'action',
    range: 'Touch',
    components: { verbal: true, somatic: true, material: 'A wing feather from any bird' },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: false,
    description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When the spell ends, the target falls if still aloft.',
    higherLevels: 'Target one additional creature per slot level above 3rd.',
    iconName: 'Bird',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'FLIGHT AT 60 FEET SPEED. PLAN FOR THE LANDING.',
      jarvis: 'Remember: when concentration ends, so does the flying.',
      deadpool: 'I believe I can fly! I believe I can touch the— OW, concentration broke!'
    }
  },
  {
    id: 'hypnotic-pattern-warlock',
    name: 'Hypnotic Pattern',
    level: 3,
    school: 'illusion',
    castingTime: 'action',
    range: '120 feet',
    components: { verbal: false, somatic: true, material: 'A glowing stick of incense or crystal vial filled with phosphorescent material' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'You create a twisting pattern of colors in a 30-foot cube. Each creature in the area must make a Wisdom save or become charmed for the duration. Charmed creatures are incapacitated with 0 speed.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'Sparkles',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'MASS INCAPACITATION. 30-FOOT CUBE IS ENORMOUS.',
      jarvis: 'One of the best crowd control spells available. Position carefully.',
      deadpool: 'Ooh, pretty colors! Wait, why can\'t they move?'
    }
  },
  {
    id: 'fear-warlock',
    name: 'Fear',
    level: 3,
    school: 'illusion',
    castingTime: 'action',
    range: 'Self (30-foot cone)',
    components: { verbal: true, somatic: true, material: 'A white feather or the heart of a hen' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'You project a phantasmal image of a creature\'s worst fears. Each creature in a 30-foot cone must succeed on a Wisdom save or drop what it\'s holding and become frightened. Frightened creatures must Dash away from you.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'AlertTriangle',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'CONE OF TERROR. FORCES ENEMIES TO FLEE.',
      jarvis: 'Effective crowd control that forces enemies out of position.',
      deadpool: 'BOO! Yeah, magically-enhanced boo!'
    }
  },
  {
    id: 'vampiric-touch-warlock',
    name: 'Vampiric Touch',
    level: 3,
    school: 'necromancy',
    castingTime: 'action',
    range: 'Self',
    components: { verbal: true, somatic: true },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'The touch of your shadow-wreathed hand siphons life force. Make a melee spell attack. On hit, deal 3d6 necrotic damage and regain HP equal to half the damage dealt. You can attack each turn as an action.',
    higherLevels: 'Damage increases by 1d6 per slot level above 3rd.',
    attackType: 'melee',
    damageType: 'necrotic',
    damageFormula: '3d6',
    iconName: 'Heart',
    classes: ['warlock', 'wizard'],
    personalityQuips: {
      thunderhead: 'MELEE SPELL WITH LIFESTEAL. REPEATABLE EACH TURN.',
      jarvis: 'Self-healing while dealing damage. Excellent for melee-oriented warlocks.',
      deadpool: 'Nom nom nom, delicious life force!'
    }
  },

  // ============================================
  // 4TH LEVEL SPELLS
  // ============================================
  {
    id: 'banishment-warlock',
    name: 'Banishment',
    level: 4,
    school: 'abjuration',
    castingTime: 'action',
    range: '60 feet',
    components: { verbal: true, somatic: true, material: 'An item distasteful to the target' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'You attempt to send one creature to another plane of existence. The target must succeed on a Charisma save or be banished. If native to the current plane, it returns when the spell ends.',
    higherLevels: 'Target one additional creature per slot level above 4th.',
    attackType: 'save',
    saveStat: 'CHA',
    iconName: 'LogOut',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'REMOVE THREATS FROM COMBAT. PERMANENT IF EXTRAPLANAR.',
      jarvis: 'Against extraplanar creatures, this can be a permanent solution.',
      deadpool: 'Bye bye! Have fun in the shadow dimension or wherever!'
    }
  },
  {
    id: 'dimension-door-warlock',
    name: 'Dimension Door',
    level: 4,
    school: 'conjuration',
    castingTime: 'action',
    range: '500 feet',
    components: { verbal: true, somatic: false },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You teleport yourself and up to one willing creature within 5 feet of you to a location within range. You can teleport to a spot you can see, visualize, or describe by distance and direction.',
    iconName: 'DoorOpen',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: '500 FEET OF TELEPORTATION. BRING A FRIEND.',
      jarvis: 'Line of sight not required—describe by direction and distance.',
      deadpool: 'Instant travel! No more walking like a peasant!'
    }
  },
  {
    id: 'blight-warlock',
    name: 'Blight',
    level: 4,
    school: 'necromancy',
    castingTime: 'action',
    range: '30 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'Necromantic energy washes over a creature of your choice. The target must make a Constitution saving throw, taking 8d8 necrotic damage on a failure, or half on success. Plants and plant creatures have disadvantage and take max damage.',
    higherLevels: 'Damage increases by 1d8 per slot level above 4th.',
    attackType: 'save',
    saveStat: 'CON',
    damageType: 'necrotic',
    damageFormula: '8d8',
    iconName: 'Skull',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'MASSIVE SINGLE-TARGET DAMAGE. DEVASTATING TO PLANTS.',
      jarvis: 'Eight d8s of necrotic damage. Remarkably effective.',
      deadpool: 'Wither and die! Man, that sounds edgy even for me.'
    }
  },
  {
    id: 'shadow-of-moil',
    name: 'Shadow of Moil',
    level: 4,
    school: 'necromancy',
    castingTime: 'action',
    range: 'Self',
    components: { verbal: true, somatic: true, material: 'An undead eyeball encased in a gem worth at least 150 gp' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'Flame-like shadows wreathe your body, shedding dim light in a 10-foot radius. You have resistance to radiant damage and are heavily obscured to others. When a creature within 10 feet hits you with an attack, the shadows lash out dealing 2d8 necrotic damage.',
    damageType: 'necrotic',
    damageFormula: '2d8',
    iconName: 'Flame',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'HEAVILY OBSCURED PLUS RETALIATION DAMAGE. EXCELLENT DEFENSE.',
      jarvis: 'Being heavily obscured makes you difficult to target while dealing damage to attackers.',
      deadpool: 'I\'m cloaked in darkness and pain! Very on-brand!'
    }
  },

  // ============================================
  // 5TH LEVEL SPELLS
  // ============================================
  {
    id: 'hold-monster-warlock',
    name: 'Hold Monster',
    level: 5,
    school: 'enchantment',
    castingTime: 'action',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: 'A small, straight piece of iron' },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'Choose a creature you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration. This spell works on any creature type, not just humanoids.',
    higherLevels: 'Target one additional creature per slot level above 5th.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'Lock',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'PARALYSIS THAT WORKS ON ANY CREATURE. CRITICAL HIT SETUP.',
      jarvis: 'Unlike Hold Person, this affects any creature type—dragons, demons, anything.',
      deadpool: 'Even monsters get frozen! Equality in paralysis!'
    }
  },
  {
    id: 'synaptic-static',
    name: 'Synaptic Static',
    level: 5,
    school: 'enchantment',
    castingTime: 'action',
    range: '120 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'You choose a point within range and trigger a burst of psychic energy. Each creature in a 20-foot-radius sphere must make an Intelligence save, taking 8d6 psychic damage on failure (half on success). On failed save, targets subtract 1d6 from attack rolls, ability checks, and concentration saves for 1 minute.',
    attackType: 'save',
    saveStat: 'INT',
    damageType: 'psychic',
    damageFormula: '8d6',
    iconName: 'Brain',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'AOE PSYCHIC DAMAGE PLUS DEBUFF. TARGETS INTELLIGENCE.',
      jarvis: 'Excellent against low-Intelligence creatures. The debuff is significant.',
      deadpool: 'Brain blast! Now their heads hurt AND they\'re stupid!'
    }
  },
  {
    id: 'scrying-warlock',
    name: 'Scrying',
    level: 5,
    school: 'divination',
    castingTime: '10_minutes',
    range: 'Self',
    components: { verbal: true, somatic: true, material: 'A focus worth at least 1,000 gp, such as a crystal ball, silver mirror, or font filled with holy water', materialCost: 1000 },
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: false,
    description: 'You can see and hear a particular creature you choose that is on the same plane of existence. The target must make a Wisdom saving throw, modified by how well you know the target and the sort of physical connection you have to it.',
    attackType: 'save',
    saveStat: 'WIS',
    iconName: 'Eye',
    classes: ['warlock', 'wizard'],
    personalityQuips: {
      thunderhead: 'SPY ON TARGETS ANYWHERE ON THE PLANE. REQUIRES EXPENSIVE FOCUS.',
      jarvis: 'Long-range reconnaissance. The more you know about the target, the easier it is.',
      deadpool: 'Magical stalking! Wait, that sounds creepy. Magical reconnaissance!'
    }
  },
  {
    id: 'contact-other-plane',
    name: 'Contact Other Plane',
    level: 5,
    school: 'divination',
    castingTime: '1_minute',
    range: 'Self',
    components: { verbal: true, somatic: false },
    duration: '1 minute',
    concentration: false,
    ritual: true,
    description: 'You mentally contact a demigod, spirit, or extraplanar entity. You must succeed on a DC 15 Intelligence save or take 6d6 psychic damage and be insane until you finish a long rest. On success, you can ask up to five yes/no questions.',
    iconName: 'Phone',
    classes: ['warlock', 'wizard'],
    personalityQuips: {
      thunderhead: 'FIVE QUESTIONS TO OTHERWORLDLY BEINGS. RISK OF INSANITY.',
      jarvis: 'High risk, high reward. The DC 15 save is not guaranteed.',
      deadpool: 'Calling the other side! Hope it\'s not a collect call!'
    }
  },
  {
    id: 'far-step',
    name: 'Far Step',
    level: 5,
    school: 'conjuration',
    castingTime: 'bonus_action',
    range: 'Self',
    components: { verbal: true, somatic: false },
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description: 'You teleport up to 60 feet to an unoccupied space you can see. On each of your turns before the spell ends, you can use a bonus action to teleport in this way again.',
    iconName: 'Zap',
    classes: ['warlock', 'wizard', 'sorcerer'],
    personalityQuips: {
      thunderhead: 'REPEATABLE BONUS ACTION TELEPORT. ULTIMATE MOBILITY.',
      jarvis: 'Sixty feet of teleportation every turn as a bonus action. Exceptional mobility.',
      deadpool: 'Blink blink blink! I\'m everywhere! Can\'t catch me!'
    }
  },
  {
    id: 'infernal-calling',
    name: 'Infernal Calling',
    level: 5,
    school: 'conjuration',
    castingTime: '1_minute',
    range: '90 feet',
    components: { verbal: true, somatic: true, material: 'A ruby worth at least 999 gp', materialCost: 999 },
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    ritual: false,
    description: 'Uttering a dark incantation, you summon a devil from the Nine Hells. You choose the devil\'s type, which must be of a challenge rating equal to or less than your slot level. The devil appears in an unoccupied space you can see.',
    iconName: 'Flame',
    classes: ['warlock'],
    personalityQuips: {
      thunderhead: 'SUMMON A DEVIL. REQUIRES NEGOTIATION OR CONTROL.',
      jarvis: 'Devils are lawful—contracts and commands work. Very thematic for a warlock.',
      deadpool: 'Summoning my patron\'s coworkers! This won\'t be awkward at all!'
    }
  },
];
