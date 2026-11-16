// The character rules both creation assistants share: what the app accepts for each field of a
// new character, and the exact JSON the app parses. Used by ai-creation-assistant and
// empyrean-onboarding, so the two can never disagree about a class, a score or an ID.
// Plain text: keep backticks, backslashes and template placeholders out of these strings.

export const CHARACTER_RULES = `WHAT THE APP ACCEPTS

- name: 2 to 30 characters. level: 1 to 20 (default 1; for a loaded campaign, match the party's lowest current level).

- portraitIcon: Skull, User, Shield, Sword, Crosshair, Ghost, Flame, Zap, Moon, Sun, Star or Crown.

- primaryClass: rogue (d8, DEX, uses a Magic Path), wizard (d6, INT), sorcerer (d6, CHA), warlock (d8, CHA, pact), cleric (d8, WIS), druid (d8, WIS), bard (d8, CHA). No other classes exist. In a reskinned world, keep the class ID and rename it in conversation.

- abilityScores: the standard array 15, 14, 13, 12, 10, 8. Suggested (STR/DEX/CON/INT/WIS/CHA): rogue 8/15/14/12/13/10, wizard 8/14/13/15/12/10, sorcerer, warlock and bard 8/14/13/10/12/15, cleric 14/10/13/8/15/12, druid 10/14/13/8/15/12.

- gender and race: free text, including a race the world invents. backstory: third person, under 1500 characters, with a motivation, a key event and a personality.

- alignment: law and good, each from -5 to +5 (lawful good is about 4/4, chaotic neutral about -4/0, neutral evil about 0/-4).

- gameMode: infinityPool (default, full sandbox) or honest (strict: organic leveling, gear unlocks, no rerolls, enforced cooldowns).

- xpPreset: standard (default), fastTrack, epicJourney, or milestone (the DM levels characters by hand).

- diceOddsMode: fair (default), heroic (slightly better rolls), dramatic (big swings high or low), chaotic (unpredictable), cursed (the dice hate you).

- selectedPath, rogue only, otherwise null: arcane_trickster (INT, illusion and enchantment), shadow_blade (CHA, shadow and necrotic), eldritch_knight (INT, abjuration and evocation), hexblade (CHA, pact, from level 1).

- starterAbilities, any class: a list of { abilityId, currentTier } with tiers 1 to 3. Each tier costs 1 point. Points by level: L1 5, L2 8, L3 10, L4 12, L5 14, then +3 per level up to L10, +4 per level up to L15, +5 per level up to L20. Never go over the budget.

  Hunter (ranged): devastating_shot, multi_shot, predator_shot, ghost_arrows, rain_of_destruction, archery_master, hunters_instinct, arrow_retrieval.

  Warrior (melee): ring_of_chaos, shield_breaker, battlecry, spartan_rage, hero_strike, weapon_master, warriors_resilience, second_wind_mastery.

  Assassin (stealth and poison): critical_assassination, shadow_step, venomous_attacks, vanish, deaths_veil, shadow_dancer, poison_tolerance, sixth_sense.

- selectedPresetId: street-runner (levels 1 to 4), shadow-initiate (3 to 6), wetboy-operative (5 to 10), greek-heroes (10 to 20), or custom (start empty). For a non-fantasy world, use custom and make themed homebrew gear instead.

- consumables: exact IDs only, fitting the world (in a sci-fi world a potion can be called a stim in conversation).

  Potions: potion-healing, potion-climbing, potion-greater-healing, potion-animal-friendship, potion-fire-breath, potion-growth, potion-hill-giant-strength, potion-poison, potion-resistance, potion-water-breathing, potion-superior-healing, potion-clairvoyance, potion-diminution, potion-gaseous-form, potion-frost-giant-strength, potion-stone-giant-strength, potion-heroism, potion-invulnerability, potion-mind-reading, potion-supreme-healing, potion-fire-giant-strength, potion-cloud-giant-strength, potion-flying, potion-invisibility, potion-longevity, potion-speed, potion-vitality, potion-storm-giant-strength, potion-swimming, potion-philter-of-love, potion-oil-of-slipperiness, potion-watchful-rest, potion-elixir-of-health, potion-truesight, potion-oil-of-etherealness, potion-maximum-power, potion-possibility, potion-giant-size, potion-dragons-majesty, potion-undying, potion-sovereign-glue, potion-universal-solvent

  Poisons: poison-assassins-blood, poison-midnight-tears, poison-torpor, poison-essence-of-ether, poison-malice, poison-oil-of-taggit, poison-burnt-othur-fumes, poison-truth-serum, poison-basic, poison-drow, poison-serpent-venom, poison-wyvern, poison-purple-worm, poison-carrion-crawler, poison-pale-tincture, poison-lolths-sting, poison-dragon-bile, poison-demon-ichor, poison-nightmare-vapor, poison-shadowfell-essence, poison-pit-fiend-venom, poison-eye-of-basilisk, poison-primordial-blight

  Scrolls: scroll-disguise-self, scroll-invisibility, scroll-pass-without-trace, scroll-silence, scroll-misty-step, scroll-gaseous-form, scroll-nondetection, scroll-greater-invisibility, scroll-sleep, scroll-hold-person, scroll-darkness, scroll-blindness-deafness, scroll-suggestion, scroll-haste, scroll-fear, scroll-dimension-door, scroll-detect-magic, scroll-detect-poison-disease, scroll-comprehend-languages, scroll-detect-thoughts, scroll-locate-object, scroll-clairvoyance, scroll-tongues, scroll-feather-fall, scroll-fog-cloud, scroll-charm-person, scroll-healing-word, scroll-spider-climb, scroll-mirror-image, scroll-knock, scroll-web, scroll-counterspell, scroll-fly, scroll-dispel-magic, scroll-fireball, scroll-polymorph, scroll-banishment, scroll-wall-of-force

  Starter kits: levels 1 to 4: potion-healing x2, poison-basic. Levels 5 to 10: potion-greater-healing x2, potion-healing, poison-drow, scroll-misty-step. Levels 11 to 15: potion-superior-healing x2, potion-speed, poison-wyvern, scroll-greater-invisibility, scroll-counterspell. Levels 16 to 20: potion-supreme-healing x2, potion-speed, potion-invisibility, poison-purple-worm, scroll-dimension-door, scroll-counterspell.`;

export const CHARACTER_JSON_TEMPLATE = `{"action":"apply_character","data":{"name":"...","level":1,"portraitIcon":"Skull","primaryClass":"rogue","gender":"","race":"","backstory":"","abilityScores":{"strength":8,"dexterity":15,"constitution":14,"intelligence":12,"wisdom":13,"charisma":10},"alignment":{"law":0,"good":0},"gameMode":"infinityPool","honestModeRules":{"requireGearUnlocks":true,"organicLevelUp":true,"maxLevelInfinityStones":true,"noRerolls":true,"scribeItemVerification":true,"prestigePointsRequireXP":true,"prestigeRespecDisabled":true,"enforceCooldowns":true,"enforceWildShapeDuration":true},"xpPreset":"standard","diceOddsMode":"fair","selectedPath":null,"starterAbilities":[],"selectedPresetId":"street-runner","consumables":[],"homebrewGear":[],"homebrewSpells":[],"homebrewAbilities":[],"homebrewConsumables":[]}}`;
