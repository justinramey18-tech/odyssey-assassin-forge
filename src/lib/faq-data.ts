// Comprehensive FAQ Data for D&D Character Management App

export interface FAQItem {
  q: string;
  a: string;
}

export interface FAQCategory {
  category: string;
  questions: FAQItem[];
}

export const FAQ_ITEMS: FAQCategory[] = [
  {
    category: "Getting Started",
    questions: [
      {
        q: "What is this app?",
        a: "This is a D&D 5e character management companion app designed for Assassin-class characters. It tracks abilities, equipment, spells, conditions, and provides AI-powered tactical assistance for your tabletop sessions.",
      },
      {
        q: "How do I navigate the app?",
        a: "The Home Screen is your hub. Use the navigation cards: 'Quick Menus' opens drawers (Oracle, Conditions, Stats, etc.), 'The Main HUD' leads to combat, and the third card changes based on context (available points, shop items, etc.). The bottom category bar switches between Home, Fighting, Inventory, and Utility.",
      },
      {
        q: "What do the four main categories contain?",
        a: "HOME: Dashboard with quick access. FIGHTING: Combat HUD, Skills trees, Abilities, Arcana (magic), and Legacy (prestige). INVENTORY: Consumables, Shop, Gear, Star Constellations, and Feats. UTILITY: Scribe (AI storytelling), Chronicle Sync, Cloud Save, and Settings.",
      },
      {
        q: "How do I create my character?",
        a: "On first launch, enter your character name. This name appears throughout the app and in AI prompts. You can change it later in Settings → Character tab.",
      },
      {
        q: "How does the tutorial work?",
        a: "There's no step-by-step tutorial. Instead, explore freely and use this FAQ or the Help icon on the Home Screen header for guidance. The app is designed to be intuitive with visual cues.",
      },
      {
        q: "What is the Intro Splash Screen?",
        a: "A dramatic cinematic entrance shown when you first load the app. It features your character name and a Deadpool-themed assassin visual. Tap to proceed to the Home Screen.",
      },
    ],
  },
  {
    category: "Home Screen",
    questions: [
      {
        q: "What are the status badges at the top?",
        a: "Real-time indicators: Active Conditions (tap to manage debuffs/buffs), Ready Cooldowns (abilities off cooldown), Concentration status (when maintaining a spell), and Expiring Shop Items (countdown timers). Each badge is tappable.",
      },
      {
        q: "What does the health bar show?",
        a: "Your current/max HP with color-coded urgency: green (healthy), amber (bloodied), red (critical). Temporary HP appears as a cyan overlay above the bar. AC and Initiative modifiers display below.",
      },
      {
        q: "How do I change my HP?",
        a: "Tap the HP number on the health bar to open an input field. Type your new value or use the +/- buttons. Temp HP is managed separately.",
      },
      {
        q: "What's the 'Available Points' widget?",
        a: "When you have unspent ability points, this amber glowing widget appears on the Home Screen. Shows 'X Points Available' with a 'Spend Now' button that takes you directly to the Abilities tab.",
      },
      {
        q: "What is the large D20 in the center?",
        a: "Tap it to open the full Dice Roller. You can roll d4, d6, d8, d10, d12, d20, and d100 with custom modifiers. Results are displayed with natural 20/1 highlighting.",
      },
      {
        q: "What are the three navigation cards?",
        a: "Quick Menus: Opens the drawer menu (Oracle, Conditions, Stats, Set Bonus, Prompts, Abilities, Scribe, Timers, Arcana). The Main HUD: Goes to Combat tab. The third card is contextual—shows available points, shop deals, or other alerts.",
      },
      {
        q: "What does the XP bar show?",
        a: "Your current XP progress toward the next level. Includes current XP, XP needed, and percentage. The bar changes color as you approach level-up.",
      },
      {
        q: "How do I level up?",
        a: "When you have enough XP, the 'Level Up!' button in the footer glows and pulses. Tap it to advance. Leveling grants ability points and may unlock new content.",
      },
      {
        q: "What is the clock widget?",
        a: "Displays current real-world time in the app's themed style. Useful for session time tracking.",
      },
    ],
  },
  {
    category: "Skill Trees (Hunter, Warrior, Assassin)",
    questions: [
      {
        q: "What are the three skill trees?",
        a: "HUNTER: Ranged combat, tracking, traps, and environmental awareness. WARRIOR: Melee combat, defense, resilience, and frontline tactics. ASSASSIN: Stealth, critical strikes, poison, and evasion.",
      },
      {
        q: "How do I view skill trees?",
        a: "Go to Fighting → Skills tab. Use the tree selector at the top to switch between Hunter, Warrior, and Assassin. Each tree shows its abilities organized in tiers.",
      },
      {
        q: "How do I unlock abilities?",
        a: "Tap any ability node to view details. If you have available points and meet prerequisites, tap 'Unlock Tier' to spend 1 point. Each ability has 3 tiers.",
      },
      {
        q: "What do the tier levels mean?",
        a: "Tier I: Basic unlock. Tier II: Enhanced effects. Tier III: Mastered—maximum power, shown with a golden glow. Each tier costs 1 ability point.",
      },
      {
        q: "What's the difference between Active and Passive abilities?",
        a: "ACTIVE: Require an action (action, bonus action, or reaction) to use. Appear in your combat loadout. PASSIVE: Always on once unlocked. Provide constant benefits without using actions.",
      },
      {
        q: "Can I refund ability points?",
        a: "Yes! Tap an unlocked ability, then use 'Refund Tier' to reclaim your point. You can experiment freely with different builds.",
      },
      {
        q: "What are the connection lines between abilities?",
        a: "They show prerequisites. You must unlock earlier abilities before accessing later ones in the same branch. Lines glow when the path is available.",
      },
      {
        q: "How do ability points work?",
        a: "You earn points from leveling (cumulative formula: 5 at level 1, scaling to 74 at level 20) and from Prestige levels. Points are shared across all trees including Drizzt's Legacy.",
      },
      {
        q: "What happens when I master an ability?",
        a: "At Tier III, the ability gains a golden 'Mastered' visual effect. Some abilities unlock additional features or stronger effects at mastery.",
      },
    ],
  },
  {
    category: "Combat System",
    questions: [
      {
        q: "How do I access the Combat HUD?",
        a: "Tap 'The Main HUD' card on Home Screen, or go to Fighting → Combat tab. The HUD is designed for real-time combat during your D&D sessions.",
      },
      {
        q: "What tabs are in the Combat HUD?",
        a: "ATTACKS: Weapon attacks and quick-cast spells. STEALTH: Stealth-related abilities and checks. ABILITIES: Your equipped active abilities. ITEMS: Consumables for combat. REACT: Reactions and opportunity attacks. SUMMARY: Turn action log.",
      },
      {
        q: "What is the Situation Panel?",
        a: "Configure combat conditions like Advantage/Disadvantage, cover, flanking, or special scenarios. These modifiers automatically apply to your roll calculations.",
      },
      {
        q: "How do action economy indicators work?",
        a: "Shows available actions this turn: Action (sword icon), Bonus Action (lightning), Reaction (shield), Movement (boot). Tap to mark as used. Resets each turn.",
      },
      {
        q: "How do weapons sync with abilities?",
        a: "Equipped weapons connect to their relevant tree: Ranged weapons → Hunter abilities, Primary melee → Warrior, Secondary weapons → Assassin. Damage combines weapon + ability bonuses.",
      },
      {
        q: "What is Quick Cast in Combat?",
        a: "The Attacks tab shows up to 4 favorite spells for one-tap casting. Displays spell attack bonus, Save DC, and remaining slots. Great for combat casters.",
      },
      {
        q: "How do I use abilities in combat?",
        a: "Go to the Abilities tab in Combat. Tap an equipped ability to use it. Abilities with cooldowns start their timer. AI prompts are generated for your DM.",
      },
      {
        q: "What is the Turn Summary?",
        a: "The Summary tab logs all actions taken this turn: attacks, spells cast, abilities used, items consumed. Useful for tracking complex turns.",
      },
      {
        q: "How do Reactions work?",
        a: "The React tab shows available reactions (opportunity attacks, defensive abilities, etc.). Reactions can be used once per round outside your turn.",
      },
      {
        q: "What is Offhand (Two-Weapon Fighting)?",
        a: "When wielding a Light weapon in each hand, you can make an offhand bonus action attack with your secondary weapon. By default, you don't add your ability modifier to damage. Enable 'Two-Weapon Fighting Style' in Settings to add it.",
      },
      {
        q: "Where do I configure combat feats and fighting styles?",
        a: "Go to Settings → Game tab → Combat Features & Feats section. Toggle on any feats or fighting styles your character has, such as Two-Weapon Fighting, Dual Wielder, Great Weapon Master, or Sharpshooter.",
      },
      {
        q: "What is Two-Weapon Fighting Style?",
        a: "A fighting style that adds your ability modifier to offhand attack damage. Enable it in Settings → Game → Combat Features if your character has this class feature.",
      },
      {
        q: "What does Dual Wielder feat do?",
        a: "Allows two-weapon fighting with any one-handed melee weapons (not just Light weapons) and grants +1 AC while dual wielding. Enable in Settings → Game → Combat Features.",
      },
      {
        q: "What is Great Weapon Master?",
        a: "A feat that lets you take -5 to attack rolls for +10 damage when using Heavy weapons. Also grants a bonus action attack on critical hits or kills. Enable in Settings → Game → Combat Features.",
      },
      {
        q: "What is Sharpshooter?",
        a: "A feat that lets you take -5 to attack rolls for +10 damage with ranged weapons. Also ignores cover bonuses and long range penalties. Enable in Settings → Game → Combat Features.",
      },
      {
        q: "What is Sentinel?",
        a: "A feat that makes your opportunity attacks reduce the target's speed to 0 and lets you attack creatures that attack allies within 5ft of you. Enable in Settings → Game → Combat Features.",
      },
      {
        q: "What is Polearm Master?",
        a: "A feat that grants a bonus action attack with the butt end of your polearm (1d4 damage) and lets you make opportunity attacks when enemies enter your reach. Enable in Settings → Game → Combat Features.",
      },
    ],
  },
  {
    category: "Abilities & Loadouts",
    questions: [
      {
        q: "What is the Abilities tab?",
        a: "Fighting → Abilities shows all your unlocked active abilities. Tap any ability for details, to equip it, or to copy an AI prompt for your DM.",
      },
      {
        q: "How do loadout slots work?",
        a: "Equip active abilities to numbered slots for quick Combat access. Open an ability's detail panel and tap 'Equip to Loadout'. The number of slots increases with level.",
      },
      {
        q: "How many abilities can I equip?",
        a: "Loadout capacity scales with level. Early levels have fewer slots. Check the Abilities tab header for your current capacity (e.g., '4/6 equipped').",
      },
      {
        q: "Can I unequip abilities?",
        a: "Yes. Open the ability detail panel and tap 'Remove from Loadout'. The slot becomes available for another ability.",
      },
      {
        q: "What are AI DM prompts?",
        a: "Each ability has a generated prompt describing its effects in roleplay language. Tap 'Copy Prompt' to paste it into your AI DM chat (ChatGPT, Claude, etc.).",
      },
      {
        q: "Why can't I see some abilities?",
        a: "Abilities only appear in the loadout after being unlocked in the skill trees. Go to Fighting → Skills to unlock new abilities.",
      },
    ],
  },
  {
    category: "Arcana (Magic System)",
    questions: [
      {
        q: "What is the Arcana tab?",
        a: "Fighting → Arcana is the D&D 5e-compliant magic system. It includes spellbook, spell slots, material components, and active spell tracking.",
      },
      {
        q: "What spellcasting paths are available?",
        a: "Arcane Trickster (INT-based, Rogue subclass), Eldritch Knight (INT-based, Fighter subclass), Hexblade (CHA-based, Warlock subclass), and Shadow Blade (custom path).",
      },
      {
        q: "How do I prepare spells?",
        a: "In the Spellbook tab, tap a spell and toggle 'Prepared'. Your preparation limit is ability modifier + spellcaster level. Prepared count shows in the header.",
      },
      {
        q: "How do spell slots work?",
        a: "Slots are expended when casting. Go to the Slots tab to see available slots per level. Slots refill on Long Rest. Warlock Pact slots refill on Short Rest.",
      },
      {
        q: "What is Concentration?",
        a: "Some spells require concentration to maintain. You can only concentrate on one spell at a time. Taking damage requires a Constitution save (DC = max of 10 or half damage).",
      },
      {
        q: "How do Concentration Checks work?",
        a: "When you take damage while concentrating, use the Concentration Check panel. Enter damage taken, roll the d20, and add your CON save modifier. Natural 20 auto-succeeds; Natural 1 auto-fails.",
      },
      {
        q: "What are Material Components?",
        a: "The Components tab tracks costly or consumed components (e.g., 100gp Pearl for Identify). Add components from presets or create custom ones.",
      },
      {
        q: "What is a Spellcasting Focus?",
        a: "A toggle in the Components tab. When active, material components without a gold cost are automatically provided—you only need to track costly/consumed materials.",
      },
      {
        q: "How does Active Spell Tracking work?",
        a: "When you cast a spell with duration, it appears in the Active Spells panel with a real-time countdown. Spells auto-expire with toast notifications. Manually dismiss with the X button.",
      },
      {
        q: "How does cantrip scaling work?",
        a: "Cantrips automatically scale at levels 5, 11, and 17. Damage dice increase as shown on spell cards (e.g., '1d10 → 2d10'). The app calculates your current scaled damage.",
      },
      {
        q: "What do the spell card colors mean?",
        a: "Gray: Cantrips. Blue: Levels 1-2. Purple: Levels 3-4. Gold: Level 5. Each school also has a subtle watermark effect.",
      },
      {
        q: "What are the status icons on spell cards?",
        a: "Attack (sword): Requires attack roll. Save (shield): Target makes saving throw. Concentration (eye): Requires concentration. Ritual (book): Can cast as ritual. V/S/M: Component requirements.",
      },
      {
        q: "How do Range Indicators work?",
        a: "Color-coded badges: Self (gray), Touch (green), Short 30ft (cyan), Medium 60ft (blue), Long 120ft+ (purple). Area effects show shape icons (cone, sphere, cube, etc.).",
      },
      {
        q: "What's the Features tab?",
        a: "Shows your spellcasting path's special features and abilities. Each path has unique mechanics beyond basic spellcasting.",
      },
    ],
  },
  {
    category: "Drizzt's Legacy (Prestige System)",
    questions: [
      {
        q: "What is Drizzt's Legacy?",
        a: "An advanced prestige tree with powerful abilities inspired by Drizzt Do'Urden. Unlocks through gameplay progression and prestige levels. Found in Fighting → Legacy tab.",
      },
      {
        q: "What are the Legacy branches?",
        a: "Four branches representing Drizzt's aspects: DUAL (dual-wielding mastery), GUENHWYVAR (companion abilities), DROW (dark elf heritage), and MONK (monastic training).",
      },
      {
        q: "How do I unlock Legacy abilities?",
        a: "Legacy uses the same unified ability points as skill trees. Spend points on any branch. Foundation abilities are always accessible; higher tiers require mastering lower tiers.",
      },
      {
        q: "What are tier gates?",
        a: "Each branch has three tiers: Foundation, Intermediate, and Advanced. You must master all abilities in a tier (reach Tier III) before unlocking the next tier of that branch.",
      },
      {
        q: "How do Prestige Levels work?",
        a: "Earned through extended gameplay and XP accumulation. Each prestige level grants bonus ability points. Check your prestige level in the Home Screen or Settings.",
      },
      {
        q: "What's the central Drizzt node?",
        a: "The visual center of the Legacy tree. Represents overall mastery. Unlocks special bonuses as you complete branches.",
      },
      {
        q: "Can I refund Legacy abilities?",
        a: "Yes, same as regular abilities—tap an unlocked ability and use 'Refund Tier'. However, Game Mode settings may disable refunds in Honest Mode.",
      },
    ],
  },
  {
    category: "Equipment & Gear",
    questions: [
      {
        q: "How do I access my equipment?",
        a: "Go to Inventory → Gear tab. You'll see your character silhouette with equipment slots for each body part.",
      },
      {
        q: "What equipment slots exist?",
        a: "Head, Shoulders, Chest, Hands, Waist, Legs, Feet, Ring 1, Ring 2, Amulet, Primary Weapon, Secondary Weapon, and Ranged Weapon.",
      },
      {
        q: "How do I equip items?",
        a: "Tap an equipment slot to open the item selection screen. Browse available items and tap to equip. Different slots accept different item types.",
      },
      {
        q: "What are item rarities?",
        a: "Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold). Higher rarities have better stats and unique effects.",
      },
      {
        q: "What are Set Bonuses?",
        a: "Legendary items belong to named sets. Equipping multiple pieces from the same set grants bonus effects. Check Quick Menus → Set Bonus to see active bonuses.",
      },
      {
        q: "How many set pieces do I need?",
        a: "Sets typically grant bonuses at 2, 4, 6, and 8 pieces equipped. Full 8-piece sets transform your character avatar.",
      },
      {
        q: "How do I unlock better gear?",
        a: "Legendary items unlock at higher character levels. The Gear tab shows what's available. Some items require achievements or prestige.",
      },
      {
        q: "What is Gear Lock?",
        a: "In certain game modes, equipped gear becomes locked and cannot be changed freely. Check Game Mode settings for details.",
      },
      {
        q: "How do equipment stats aggregate?",
        a: "All equipped items' bonuses (AC, attack, damage, attributes) combine automatically. View totals in Quick Menus → Stats drawer.",
      },
      {
        q: "Can I customize item images?",
        a: "Yes! Tap the camera icon on any item to upload a custom image. Clear custom images in Settings → Character tab.",
      },
    ],
  },
  {
    category: "Star Constellations",
    questions: [
      {
        q: "What are Star Constellations?",
        a: "Inventory → Stars shows constellation maps for each legendary set. Nodes represent items; lines connect them. Nodes illuminate when items are equipped.",
      },
      {
        q: "How do constellations work?",
        a: "Each legendary set has a unique humanoid constellation. Star nodes light up with the set's glow color when you equip that piece. Connection lines brighten as you complete the set.",
      },
      {
        q: "What are the constellation backgrounds?",
        a: "Each set has a unique themed background showing an Assassin's Creed-style assassin wearing that legendary armor. These images render at low opacity to highlight the constellation.",
      },
      {
        q: "How do I navigate constellations?",
        a: "Swipe horizontally to move between different set constellations. The map snaps to center each constellation.",
      },
      {
        q: "Do constellations track achievements?",
        a: "Yes! Nodes also reflect achievement unlock status from the Feats tab. Progress bars appear when prerequisites are partially complete.",
      },
    ],
  },
  {
    category: "Achievements & Feats",
    questions: [
      {
        q: "What is the Feats tab?",
        a: "Inventory → Feats displays all achievements. Track your progression across combat, exploration, roleplay, and collection categories.",
      },
      {
        q: "How do achievements work?",
        a: "Achievements have requirements (kill X enemies, reach level Y, collect Z items). Progress tracks automatically. Completed achievements grant rewards and unlock content.",
      },
      {
        q: "What rewards do achievements give?",
        a: "XP bonuses, ability point rewards, cosmetic unlocks, gear unlocks, and titles. Some legendary items require specific achievements.",
      },
      {
        q: "How do achievements connect to gear?",
        a: "Certain legendary items only unlock after completing related achievements. Check item requirements to see what you need to accomplish.",
      },
    ],
  },
  {
    category: "Consumables System",
    questions: [
      {
        q: "What are Consumables?",
        a: "Single-use items: Potions (healing, buffs), Poisons (apply to weapons), and Scrolls (one-time spells). Found in Inventory → Consumables tab.",
      },
      {
        q: "How do I add consumables?",
        a: "Tap the '+' button in Consumables to open the catalog. Browse Potions, Poisons, or Scrolls tabs. Tap an item to see details, then set quantity and add to inventory.",
      },
      {
        q: "How do I use consumables?",
        a: "Tap a consumable in your inventory to open its detail sheet. Tap 'Use' to consume one. The item removes from inventory when quantity reaches zero.",
      },
      {
        q: "What do the rarity colors mean?",
        a: "Same as equipment: Common (gray), Uncommon (green), Rare (blue), Epic (purple), Legendary (gold). Higher rarity = stronger effects.",
      },
      {
        q: "How do Poisons work?",
        a: "Apply poisons to weapons for bonus damage/effects on attacks. Poisons have limited uses or duration. Some require Constitution saves from targets.",
      },
      {
        q: "How do Scrolls work?",
        a: "Scrolls allow one-time casting of a spell without using spell slots. Anyone can use scrolls for spells on their class list; others require checks.",
      },
      {
        q: "Can I get AI prompts for consumables?",
        a: "Yes! Each consumable has a 'Copy Prompt' button that generates a roleplay description for your AI DM.",
      },
    ],
  },
  {
    category: "Shop System",
    questions: [
      {
        q: "What is the Shop?",
        a: "Inventory → Shop is where you spend gold on items. Features rotating stock, timed deals, and special offers discovered through Chronicle Sync.",
      },
      {
        q: "How does gold work?",
        a: "Earn gold through Chronicle Sync (parsing session logs) or manual input. Gold balance shows at the top of the Shop. Spend it on items.",
      },
      {
        q: "What are timed deals?",
        a: "Some shop items have expiration timers. A badge on the Home Screen shows when deals are about to expire. Buy before they disappear!",
      },
      {
        q: "How do items appear in the Shop?",
        a: "Chronicle Sync detects shop references in your session logs and adds them to your Shop. You can also manually add items.",
      },
      {
        q: "What happens when I buy an item?",
        a: "Gold is deducted and the item moves to your inventory (Consumables or Gear depending on type). The item is removed from the Shop.",
      },
    ],
  },
  {
    category: "Conditions & Status Effects",
    questions: [
      {
        q: "What are Conditions?",
        a: "D&D 5e status effects like Poisoned, Frightened, Blinded, Prone, etc. Track debuffs, buffs, and concentration effects.",
      },
      {
        q: "How do I add conditions?",
        a: "Quick Menus → Conditions drawer, or tap the Conditions badge on Home Screen. Tap '+' to add from the condition list. Set duration and source.",
      },
      {
        q: "What durations are supported?",
        a: "Rounds (combat time), Minutes (10 rounds = 1 minute), Save-ends (until target saves), or Indefinite. Timers count down automatically.",
      },
      {
        q: "How do I remove conditions?",
        a: "Swipe left on a condition to dismiss it. A 5-second undo buffer lets you restore accidentally dismissed conditions.",
      },
      {
        q: "What is the Condition Quick Bar?",
        a: "In Combat HUD, a compact bar shows your active conditions at a glance. Tap to expand and manage.",
      },
      {
        q: "How does Concentration tracking work?",
        a: "When you cast a concentration spell, it appears as a special condition. Breaking concentration (failing a save or casting another) removes it automatically.",
      },
      {
        q: "Can I get AI prompts for conditions?",
        a: "Yes! Each condition has roleplay-heavy prompts describing how it affects your character. Copy to clipboard for your AI DM.",
      },
    ],
  },
  {
    category: "Cooldowns & Timers",
    questions: [
      {
        q: "What are Cooldowns?",
        a: "Some abilities can only be used once per rest or have time-based cooldowns. Track them via Quick Menus → Timers or the Ready badge on Home Screen.",
      },
      {
        q: "What cooldown types exist?",
        a: "Per Short Rest (recharges on short rest), Per Long Rest (recharges on long rest), or Real-Time (counts down in minutes/seconds).",
      },
      {
        q: "How do I see which abilities are ready?",
        a: "The 'Ready' badge on Home Screen shows abilities off cooldown. Tap it to open the Timers drawer with full details.",
      },
      {
        q: "How do cooldowns reset?",
        a: "Per-rest cooldowns reset when you take the appropriate rest (Short or Long). Real-time cooldowns count down automatically.",
      },
      {
        q: "What's the difference between Short and Long Rest?",
        a: "Short Rest: Quick tap, recovers some resources. Long Rest: Hold for 0.8 seconds (prevents accidents), fully restores HP and resets all cooldowns.",
      },
    ],
  },
  {
    category: "Oracle (AI Assistant)",
    questions: [
      {
        q: "What is the Oracle?",
        a: "An AI-powered assistant accessed via Quick Menus → Oracle. It's aware of your character's complete state and provides tactical advice, roleplay suggestions, and answers.",
      },
      {
        q: "What personalities are available?",
        a: "The Thunderhead (omniscient, analytical), JARVIS (formal, efficient), Deadpool (chaotic, fourth-wall-breaking), Gandalf (wise, cryptic), Jarlaxle Baenre (cunning, mercenary), The Investigator (analytical, introspective).",
      },
      {
        q: "What does 'Character Aware' mean?",
        a: "The Oracle receives a JSON snapshot of your current state: HP, level, equipped abilities, gear, active conditions, cooldowns, spell slots, etc. It uses this for contextual responses.",
      },
      {
        q: "What are Context Chips?",
        a: "Tappable status chips (HP, Ready Cooldowns, Items, Spell Slots) that generate relevant queries. Tap your HP chip to ask about healing options.",
      },
      {
        q: "What are Quick Prompts?",
        a: "Personality-specific suggested questions. Each personality has themed prompts matching their style.",
      },
      {
        q: "Do I need an API key?",
        a: "No! The Oracle uses a backend edge function with Lovable AI integration. It works out of the box with no configuration.",
      },
      {
        q: "Can the Oracle help with combat?",
        a: "Absolutely. Ask about optimal turn sequences, ability priorities, when to use consumables, or tactical positioning.",
      },
    ],
  },
  {
    category: "Scribe (AI Storytelling)",
    questions: [
      {
        q: "What is the Scribe?",
        a: "Utility → Scribe is an AI-powered narrative tool. It helps generate story content, character moments, and roleplay descriptions.",
      },
      {
        q: "What can the Scribe create?",
        a: "Character backstory moments, combat descriptions, dialogue, environmental descriptions, NPC interactions, and dramatic scenes.",
      },
      {
        q: "How does Scribe differ from Oracle?",
        a: "Oracle provides tactical/mechanical advice during play. Scribe focuses on narrative and storytelling—content for between sessions or dramatic moments.",
      },
    ],
  },
  {
    category: "Chronicle Sync",
    questions: [
      {
        q: "What is Chronicle Sync?",
        a: "Utility → Chronicle is an AI-powered parser that extracts mechanical data from your session logs: XP gains, achievements, items, gold, and shop discoveries.",
      },
      {
        q: "How do I use Chronicle Sync?",
        a: "Paste your session log (from AI DM or notes) into Chronicle. It parses the text and shows detected elements. Review and apply what's relevant.",
      },
      {
        q: "What can Chronicle detect?",
        a: "XP awards, level-ups, achievement completions, item acquisitions, gold amounts, shop listings, consumable names, and equipment references.",
      },
      {
        q: "How does the review workflow work?",
        a: "After parsing, you see all detected elements in cards. Toggle which ones to apply. Confirm to update your character. An undo snapshot is created.",
      },
      {
        q: "What is the undo snapshot?",
        a: "Before applying changes, Chronicle saves your current state. If something goes wrong, you can restore within 1 hour.",
      },
      {
        q: "How does fuzzy matching work?",
        a: "Chronicle uses Levenshtein distance with a 70% similarity threshold to match mentioned consumables to the database. 'Potion of Greater Healing' matches even with typos.",
      },
      {
        q: "What is Honest Mode validation?",
        a: "In Game Mode settings, Honest Mode enforces XP caps and requires evidence for claims. Chronicle respects these rules during parsing.",
      },
    ],
  },
  {
    category: "Cloud Save & Accounts",
    questions: [
      {
        q: "How does saving work?",
        a: "Your character automatically saves to browser localStorage. This persists between sessions but is device-specific.",
      },
      {
        q: "What is Cloud Save?",
        a: "Utility → Cloud lets you sign in with an account to sync progress across devices. Your data backs up to the cloud and restores on any device.",
      },
      {
        q: "How do I enable Cloud Save?",
        a: "Go to Utility → Cloud. Sign in or create an account. Enable sync. Your data uploads automatically.",
      },
      {
        q: "Can I have multiple characters?",
        a: "Cloud Save supports multiple save slots. Create different characters and switch between them.",
      },
      {
        q: "What data is synced?",
        a: "Character info, abilities, equipment, consumables, achievements, prestige, XP, and settings. Custom images are stored separately.",
      },
    ],
  },
  {
    category: "Settings & Configuration",
    questions: [
      {
        q: "Where are Settings?",
        a: "Utility → Settings, or tap the gear icon. On mobile, settings use a drill-down navigation pattern.",
      },
      {
        q: "What tabs are in Settings?",
        a: "Game (game modes, XP progression), Setup (AI GM sync, dice odds), Character (name, reset options), and Q&A (this FAQ).",
      },
      {
        q: "What are Game Modes?",
        a: "Honest Mode: Stricter validation, XP caps, no easy refunds. Standard Mode: Full flexibility. Configure in Settings → Game tab.",
      },
      {
        q: "What is XP Progression Mode?",
        a: "Choose between Standard (D&D 5e PHB), Fast (reduced requirements), or Milestone (level-up on achievements). Settings → Game tab.",
      },
      {
        q: "What are Dice Odds?",
        a: "Configure advantage/disadvantage behavior and view roll probabilities. Settings → Setup tab.",
      },
      {
        q: "How do I sync with my AI GM?",
        a: "Settings → Setup tab. Use 'Generate State Summary' to copy your character's complete build as formatted text. Paste into ChatGPT, Claude, or your AI DM of choice.",
      },
      {
        q: "What is 'Full Guide' vs 'Build Only'?",
        a: "Full Guide: Complete game rules plus your character. Build Only: Just your current character state. Use whichever fits your AI DM's needs.",
      },
      {
        q: "How do I change my character name?",
        a: "Settings → Character tab → Edit Name. This updates your name throughout the app.",
      },
      {
        q: "How do I reset everything?",
        a: "Settings → Character tab → Danger Zone → Reset Entire App. This clears all data and restarts. PERMANENT—cannot be undone!",
      },
      {
        q: "How do I clear custom images?",
        a: "Settings → Character tab. Options to clear equipment images, ability images, or all custom images at once.",
      },
      {
        q: "How do I check for app updates?",
        a: "Settings → Character tab → Check for Updates. The app uses a service worker for offline support and will prompt when updates are available.",
      },
    ],
  },
  {
    category: "Stats & Ability Scores",
    questions: [
      {
        q: "Where do I see my stats?",
        a: "Quick Menus → Stats drawer. Shows Armor Class, attack bonuses, damage, and attribute modifiers from all equipment and effects.",
      },
      {
        q: "How are stats calculated?",
        a: "Base attributes + equipment bonuses + ability effects + set bonuses = final stats. Everything aggregates in real-time.",
      },
      {
        q: "What ability scores exist?",
        a: "Standard D&D 5e: Strength (STR), Dexterity (DEX), Constitution (CON), Intelligence (INT), Wisdom (WIS), Charisma (CHA).",
      },
      {
        q: "How do modifiers work?",
        a: "Modifier = (Score - 10) / 2, rounded down. Score 10-11 = +0, 12-13 = +1, 14-15 = +2, etc. Displayed as +X or -X.",
      },
      {
        q: "How does proficiency bonus work?",
        a: "Scales with level: +2 at levels 1-4, +3 at 5-8, +4 at 9-12, +5 at 13-16, +6 at 17-20. Applied to proficient skills and saves.",
      },
    ],
  },
  {
    category: "Dice Roller",
    questions: [
      {
        q: "How do I roll dice?",
        a: "Tap the large D20 on Home Screen, or find dice options in combat abilities. The roller supports all standard dice.",
      },
      {
        q: "What dice types are available?",
        a: "d4, d6, d8, d10, d12, d20, and d100 (percentile). Roll multiples by setting the quantity.",
      },
      {
        q: "Can I add modifiers?",
        a: "Yes! Set a modifier value before rolling. Positive or negative. The result shows natural roll + modifier = total.",
      },
      {
        q: "What are Natural 20 and Natural 1?",
        a: "On d20 rolls, rolling 20 is a critical success (highlighted green). Rolling 1 is a critical failure (highlighted red). Special effects may trigger.",
      },
      {
        q: "How does Advantage/Disadvantage work?",
        a: "Roll 2d20 and take the higher (advantage) or lower (disadvantage) result. Configure in Dice Odds settings or Situation Panel.",
      },
    ],
  },
  {
    category: "Prompts & AI Integration",
    questions: [
      {
        q: "What are Prompts?",
        a: "Pre-written roleplay descriptions for abilities, conditions, consumables, and items. Copy them to share with your AI DM.",
      },
      {
        q: "Where do I find Prompts?",
        a: "Quick Menus → Prompts shows collected prompts. Individual items/abilities also have 'Copy Prompt' buttons in their detail views.",
      },
      {
        q: "How do I use prompts with AI DMs?",
        a: "Copy a prompt, then paste it into ChatGPT, Claude, or your AI DM of choice. The prompt provides context for your action.",
      },
      {
        q: "Are prompts customizable?",
        a: "Some prompts can be edited. Look for the edit icon. Custom prompts are saved with your character.",
      },
      {
        q: "What AI DMs work with this app?",
        a: "Any text-based AI: ChatGPT, Claude, Gemini, local LLMs. The prompts are plain text and work everywhere.",
      },
    ],
  },
  {
    category: "Drawers & Quick Menus",
    questions: [
      {
        q: "What are Drawers?",
        a: "Side panels that slide in with focused functionality. Access via Quick Menus on Home Screen or various buttons throughout the app.",
      },
      {
        q: "What drawers are available?",
        a: "Oracle (AI assistant), Conditions (status effects), Stats (character statistics), Set Bonus (equipment bonuses), Prompts (roleplay text), Abilities (equipped skills), Scribe (storytelling), Timers (cooldowns), and Arcana (quick magic access).",
      },
      {
        q: "How do I close a drawer?",
        a: "Tap outside the drawer, swipe it away, or tap the X button. Drawer state is preserved when closed.",
      },
      {
        q: "Why don't drawers open my keyboard?",
        a: "By design! Drawers prevent auto-focus on input fields to avoid the keyboard obscuring content. Tap fields manually to type.",
      },
    ],
  },
  {
    category: "Infinity Gauntlet",
    questions: [
      {
        q: "What is the Infinity Gauntlet?",
        a: "A special feature accessible from the Home Screen. Allows narrative prompts based on the six Infinity Stones.",
      },
      {
        q: "What are Infinity Stone prompts?",
        a: "90+ unique roleplay scenarios organized by stone (Power, Space, Reality, Soul, Time, Mind) and intensity (Mild, Moderate, World-Breaking). The Soul Stone features 40 emotional and social prompts.",
      },
      {
        q: "What does 'Surprise Me' do?",
        a: "Randomly selects a stone and intensity for a chaotic narrative prompt. Great for unexpected story moments.",
      },
      {
        q: "How do I use Stone prompts?",
        a: "Select a stone, choose intensity, browse prompts. Tap to copy. Paste into your AI DM for dramatic narrative events.",
      },
    ],
  },
  {
    category: "PWA & Installation",
    questions: [
      {
        q: "What is a PWA?",
        a: "Progressive Web App. This app can be installed on your device like a native app, with offline support and home screen icon.",
      },
      {
        q: "How do I install the app?",
        a: "On iOS: Tap Share → Add to Home Screen. On Android: Tap the browser menu → Install App. On Desktop: Look for the install icon in the address bar.",
      },
      {
        q: "Does the app work offline?",
        a: "Yes! Once installed, the app works offline using cached data. Your character is stored locally. Cloud features require internet.",
      },
      {
        q: "How do updates work?",
        a: "The app automatically checks for updates. When available, you'll see a prompt to refresh. You can also check manually in Settings → Character → Check for Updates.",
      },
    ],
  },
  {
    category: "Troubleshooting",
    questions: [
      {
        q: "My data disappeared. What happened?",
        a: "Data is stored in browser localStorage. Clearing browser data removes it. Use Cloud Save to prevent data loss. Check if you're on the same browser/device.",
      },
      {
        q: "An ability isn't working correctly.",
        a: "Check prerequisites in the skill tree. Ensure you have available points. Try refunding and re-purchasing. Check Game Mode settings for restrictions.",
      },
      {
        q: "My HP/stats are wrong.",
        a: "Check equipped items in Gear tab. View Stats drawer for breakdown. Equipment bonuses may have changed. Conditions might be affecting values.",
      },
      {
        q: "The app is slow or unresponsive.",
        a: "Try refreshing the page. Clear browser cache (but not localStorage). Check for updates. Close other tabs. Restart your device if needed.",
      },
      {
        q: "Chronicle Sync isn't detecting things.",
        a: "Ensure your session log has clear text mentions. Use standard D&D terminology. Check the fuzzy match threshold (70%). Try rephrasing detected items.",
      },
      {
        q: "Oracle isn't responding.",
        a: "Check your internet connection. The Oracle requires backend access. Try refreshing. If persistent, the server may be temporarily unavailable.",
      },
      {
        q: "I can't find a feature.",
        a: "Check all four category tabs (Home, Fighting, Inventory, Utility). Use Quick Menus for drawers. Explore sub-tabs within each category.",
      },
      {
        q: "Custom images aren't showing.",
        a: "Images are stored locally. Try re-uploading. Check file size/format (PNG, JPG recommended). Clear and re-add if persistent.",
      },
    ],
  },
];
