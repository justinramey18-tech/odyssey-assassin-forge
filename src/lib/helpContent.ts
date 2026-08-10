export type HelpSectionId = 'start' | 'character' | 'playing' | 'party' | 'fixes' | 'terms';
export type HelpIconKey =
  | 'rocket' | 'user' | 'swords' | 'users' | 'lifebuoy' | 'bookOpen'
  | 'activity' | 'zap' | 'backpack' | 'mic' | 'dice' | 'heart' | 'wrench'
  | 'scroll' | 'gift' | 'messages' | 'check' | 'radio' | 'split' | 'compass';

export interface HelpEntry {
  /** The player's question, phrased the way they would ask it. */
  q: string;
  /** The answer. Plain, short, no rules jargon. */
  a: string;
  /** Ordered "do this, then this" steps for anything with a real sequence. */
  steps?: string[];
  /** The gotcha or the detail people ask about second. */
  note?: string;
  /** Optional breadcrumb chip, e.g. 'Sheet → Items' or 'Bottom bar → DICE'. */
  where?: string;
  /** Only show when the guide is opened from a party session. */
  partyOnly?: boolean;
}

export interface HelpTopic {
  id: string;
  section: HelpSectionId;
  title: string;
  blurb: string;
  icon: HelpIconKey;
  partyOnly?: boolean;
  entries: HelpEntry[];
}

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  blurb: string;
  icon: HelpIconKey;
  /** Tailwind classes for the tile accent. */
  accent: string;
  partyOnly?: boolean;
}

export const HELP_SECTIONS: HelpSection[] = [
  { id: 'start', title: 'First Steps', blurb: 'Never played here before', icon: 'rocket', accent: 'text-amber-300 border-amber-400/30 bg-amber-500/10' },
  { id: 'character', title: 'Your Character', blurb: 'Backstory, stats, gear, powers', icon: 'user', accent: 'text-sky-300 border-sky-400/30 bg-sky-500/10' },
  { id: 'playing', title: 'Playing a Turn', blurb: 'Acting, rolling, resting, looting', icon: 'swords', accent: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' },
  { id: 'party', title: 'Party and Live DM', blurb: 'Table chat, rounds, signals', icon: 'users', accent: 'text-violet-300 border-violet-400/30 bg-violet-500/10', partyOnly: true },
  { id: 'fixes', title: 'Something is Wrong', blurb: 'Common problems, fixed fast', icon: 'lifebuoy', accent: 'text-rose-300 border-rose-400/30 bg-rose-500/10' },
  { id: 'terms', title: 'What Words Mean', blurb: 'Ticked, consumed, chaos dial...', icon: 'bookOpen', accent: 'text-white/70 border-white/15 bg-white/[0.04]' },
];

/** Numbered onboarding path shown pinned on the guide home screen. */
export const HELP_QUICK_START: Array<{ step: string; detail: string; where?: string }> = [
  { step: 'Write who you are', detail: 'Fill in your backstory, race and gender. The DM reads this before every reply and mines it for hooks — an enemy you named in paragraph two can walk into the tavern in session three. A blank backstory gets you a generic wanderer nobody in the world has an opinion about.', where: 'Sheet → Story' },
  { step: 'Check your numbers', detail: 'Read your ability scores, HP, AC and gold once before you start so nothing surprises you mid-fight. These numbers are what the app rolls against and what the DM is told is true, so a wrong value quietly warps every scene. All of it stays editable.', where: 'Sheet → Stats' },
  { step: 'Load your kit', detail: 'Equip your weapon and armour and stock a couple of consumables. Equipping is not cosmetic — the moment an item is equipped its bonuses fold into your AC, attack and attributes, and the DM is told about the change.', where: 'Sheet → Items' },
  { step: 'Give everyone a voice', detail: 'Assign a voice to yourself, the narrator and any NPC you expect to hear from. Read-aloud then plays each speaker in a different voice instead of one flat narrator reading the whole scene.', where: 'Sheet → Voices' },
  { step: 'Say what you do', detail: 'Type what your character does and why, in plain language. You never announce a rule or a check — describe the attempt and the app and the DM handle the mechanics between them.' },
];

export const HELP_TOPICS: HelpTopic[] = [
  // ── First Steps ──
  {
    id: 'how-it-works', section: 'start', title: 'How a session works', blurb: 'The basic loop', icon: 'compass',
    entries: [
      {
        q: 'Who is the DM?',
        a: 'An AI Dungeon Master. It narrates the world, plays every NPC, tracks what has already happened and reacts to whatever you write. There is no script it is working through — the plot bends around your choices, including the ones it did not see coming.',
        note: 'It is not improvising freely either. Your guides, your character sheet numbers and anything already established as world canon outrank whatever it feels like inventing.',
      },
      {
        q: 'What do I actually type?',
        a: 'What your character does, says or tries — the same way you would say it out loud at a real table.',
        steps: [
          'Say what you want to happen: get past the guard, calm the crowd, find the ledger.',
          'Say how you are going about it: bribe, bluff, climb the outside wall, wait for the shift change.',
          'Add dialogue in quotes if you are speaking, so NPCs can actually hear and answer it.',
        ],
        note: 'Strong: "I lean on the bar and ask the innkeeper who has been buying so much lamp oil, sliding a coin across." Weak: "Persuasion check." The second one gives the DM nothing to narrate.',
      },
      {
        q: 'Do I need to know the rules?',
        a: 'No. Describe the attempt in plain words. The app owns the mechanics: it knows your scores, your bonuses, your remaining slots and rests, and it rolls when a roll is needed.',
        note: 'Because the app rolls, the number is settled before the DM writes. The DM narrates the result it was handed — it cannot quietly decide you missed.',
      },
      {
        q: 'How much does the DM remember?',
        a: 'The recent scene in full, plus a running summary of everything older, plus your sheet, your guides and any world facts that were locked in as canon.',
        note: 'Anything said once in passing twenty scenes ago can fade. If a detail matters long-term, put it in your backstory or relationships and it gets read fresh every single reply.',
        where: 'Sheet → Story',
      },
      {
        q: 'How long until the DM replies?',
        a: 'Usually a few seconds; longer for a big scene or a full party round. A status line tells you when it is thinking, so a slow reply is never a mystery.',
        note: 'Only one reply is generated at a time. In a party, if someone else fired the round a moment before you, yours waits rather than colliding with it.',
      },
    ],
  },
  {
    id: 'screen-tour', section: 'start', title: 'Where everything lives', blurb: 'A tour of the screen', icon: 'wrench',
    entries: [
      {
        q: 'The bottom bar',
        a: 'Your toolbox. Swipe up on the notch to open it: dice, roleplay prompts, one-tap actions, the Oracle, AFK settings and your character sheet all live there.',
        note: 'It is an overlay, not a page. Opening it never loses your place in the scene or your half-typed message.',
        where: 'Bottom bar',
      },
      {
        q: 'Your character sheet',
        a: 'Everything about you, split into tabs: Vitals for HP and rests, Stats for your numbers and gear bonuses, Abilities for powers and spells, Items for gear, loot and the shop, Voices for read-aloud, Story for backstory and the Quest Board.',
        note: 'The sheet is not a separate app — using something from here (casting, equipping, drinking a potion) sends a real action to the DM. Typing about it does not.',
        where: 'Bottom bar → SHEET',
      },
      {
        q: 'The message box',
        a: 'Where your turn goes. Alongside it sit the improve-my-wording button and auto-rolls, so a described attack can resolve its dice as you send it.',
        note: 'You can write as much as you want — there is no length cap on what you send.',
      },
      {
        q: 'The table chat',
        a: 'In party sessions using Chat Rounds or Live DM, a chat drawer sits at the bottom of the screen. That is where the party talks and where the next round is assembled before anything reaches the DM.',
        where: 'Bottom of party screen',
        partyOnly: true,
      },
      {
        q: 'This guide',
        a: 'The question mark in the header, any time, even mid-scene. It opens on top of the session and closing it puts you back exactly where you were, with nothing lost.',
        note: 'The search box at the top reads every answer, fix and glossary term at once — one word like "rest" or "ticked" is usually enough.',
      },
    ],
  },

  // ── Your Character ──
  {
    id: 'backstory', section: 'character', title: 'Backstory and identity', blurb: 'What the DM knows about you', icon: 'user',
    entries: [
      {
        q: 'How much backstory should I write?',
        a: 'Up to 4000 characters, and the DM reads all of it every reply. Quality beats length: what you want, what you are hiding, and who wants you dead are worth more than a family tree.',
        steps: [
          'Name one thing your character is chasing.',
          'Name one thing they are running from, or hiding.',
          'Name one person or group with a reason to interfere.',
        ],
        note: 'Those three lines give the DM material to ambush you with for the rest of the campaign. Pure history with no unresolved threads gives it nothing to pull on.',
        where: 'Sheet → Story',
      },
      {
        q: 'How do I add people from my past?',
        a: 'Add them under Relationships with a name and a disposition — ally, rival, lover, enemy. The DM treats them as real people who exist offscreen and can reappear.',
        note: 'Dispositions steer the scene when they do show up. A rival will not greet you the way an ally does.',
        where: 'Sheet → Story',
      },
      {
        q: 'Where do I set race and gender?',
        a: 'Under Identity on the Story tab. They shape how NPCs address you, who trusts you on sight, and which doors open or close in a given town.',
        where: 'Sheet → Story',
      },
      {
        q: 'Can I change any of it later?',
        a: 'Yes, all of it, at any point mid-campaign. The DM reads the current version on your next message, so an edit takes effect immediately.',
        note: 'Editing your past does not rewrite scenes that already happened — those are already part of the story record.',
      },
    ],
  },
  {
    id: 'numbers', section: 'character', title: 'Stats, XP and leveling', blurb: 'Your numbers and where they come from', icon: 'activity',
    entries: [
      {
        q: 'Which numbers actually matter?',
        a: 'Your ability scores drive every check and attack, AC decides what hits you, HP decides how long you last, and gold gates the shop. The DM is told all of them as fact, and live sheet numbers beat anything written in a guide or an older message.',
        where: 'Sheet → Stats',
      },
      {
        q: 'Why is a stat higher than I expected?',
        a: 'Equipped gear is adding to it. The Stats tab has a breakdown that lists every bonus and names the item producing it, so you can see exactly where an extra point came from.',
        steps: [
          'Open Sheet → Stats.',
          'Find the gear bonus breakdown under your scores.',
          'Read the per-item lines for AC, attack and attributes.',
        ],
        note: 'If a bonus is missing from the list, the item is owned but not equipped. Only equipped gear counts.',
        where: 'Sheet → Stats',
      },
      {
        q: 'How do I earn XP?',
        a: 'The DM awards it for what you accomplish — fights survived, quests closed, problems solved sideways. The bar shows your lifetime total and how far the next level is.',
        note: 'Your table can run on milestone levelling instead, where the DM levels you at story beats and no numbers are tracked. The host picks which.',
      },
      {
        q: 'How does levelling up work?',
        a: 'When the bar fills, take the level up from the sheet. That is what unlocks new picks.',
        steps: [
          'Confirm the level up when the bar completes.',
          'Spend the new picks in Abilities, Arcana or Legacy.',
          'Return to the sheet and check Stats — HP and slots have moved.',
        ],
        note: 'Unspent picks sit waiting; nothing is lost if you level mid-fight and spend them later.',
      },
    ],
  },
  {
    id: 'kit', section: 'character', title: 'Gear, items and gold', blurb: 'Equipping, using, buying', icon: 'backpack',
    entries: [
      {
        q: 'How do I equip something?',
        a: 'Equip it from the Items tab. Bonuses apply instantly — there is no confirm step and no waiting for the next scene.',
        steps: [
          'Open Sheet → Items and find the piece in your bags.',
          'Tap Equip on it.',
          'Check Sheet → Stats to see the new AC, attack or attribute line appear.',
        ],
        note: 'Heavy loads matter. Carrying far past what your Strength supports will drag on you, so do not hoard armour you are not wearing.',
        where: 'Sheet → Items',
      },
      {
        q: 'How do I use an item in the story?',
        a: 'Use it from the sheet, not by typing about it. Using it from the sheet spends the item, rolls anything it needs, and hands the DM a result it must narrate around.',
        note: 'This is the single most common mix-up. "I drink my healing potion" in the message box is a sentence; tapping the potion is an action with numbers behind it.',
        where: 'Sheet → Items',
      },
      {
        q: 'Where do I spend gold?',
        a: 'The Shop, reached from the Items tab. Buying moves the item straight into your bags and takes the coin; selling returns roughly half the value.',
        note: 'Your purse is shown on Vitals, and the DM knows the figure — you cannot talk your way into buying something you cannot afford.',
        where: 'Sheet → Items → Shop',
      },
      {
        q: 'What are consumables?',
        a: 'One-use items — potions, scrolls, bombs. They appear in the sheet and also as one-tap entries in the ACTIONS drawer, so you can use one mid-fight without digging.',
        note: 'Using one rolls its dice for you, applies the effect, and removes it from your count in the same tap.',
        where: 'Bottom bar → ACTIONS',
      },
    ],
  },
  {
    id: 'powers', section: 'character', title: 'Abilities and spells', blurb: 'What you can do in a scene', icon: 'zap',
    entries: [
      {
        q: 'Where are my abilities?',
        a: 'The Abilities tab lists everything you have, including homebrew. Tap a row to expand the full description, its cost and what it actually does.',
        note: 'Whatever is written there is also given to the DM, so a homebrew power behaves the way you wrote it rather than the way the AI guesses.',
        where: 'Sheet → Abilities',
      },
      {
        q: 'How do I cast a spell?',
        a: 'Tap Cast on the spell. The app shows you the maths first, then resolves it and reports a settled result to the DM.',
        steps: [
          'Tap Cast on the spell in Sheet → Abilities.',
          'Pick the slot level — casting higher scales the dice.',
          'Read the preview: the exact hit calculation and the exact damage dice.',
          'Confirm. The app rolls, spends the slot, and sends the result for the DM to narrate.',
        ],
        note: 'The DM treats those numbers as facts it cannot overrule. It decides what the fireball sets alight, not whether it hit.',
        where: 'Sheet → Abilities',
      },
      {
        q: 'Why is a spell greyed out?',
        a: 'You have no slot at that level or above left. Cantrips never grey out.',
        note: 'A long rest returns every slot; a short rest returns some resources depending on your class. Or cast the same spell from a lower slot if it allows it.',
      },
      {
        q: 'Where do I pick new ones?',
        a: 'Abilities, Arcana and Legacy, reachable from the sheet. A floating return button brings you straight back into the scene without losing the session.',
      },
    ],
  },
  {
    id: 'voices', section: 'character', title: 'Voices and read-aloud', blurb: 'Making the table sound right', icon: 'mic',
    entries: [
      {
        q: 'How do I get a voice?',
        a: 'Pick one from the voice library on the Voices tab and assign it to yourself. Read-aloud then uses it for your lines instead of the narrator voice.',
        steps: [
          'Open Sheet → Voices.',
          'Browse the library and preview a few.',
          'Assign one as your character, and set a separate narrator voice for prose.',
        ],
        where: 'Sheet → Voices',
      },
      {
        q: 'Can NPCs have their own voices?',
        a: 'Yes, and the tab suggests names it spotted in the current story so you can cast whoever just spoke in one tap.',
        note: 'Once cast, that NPC keeps the voice for the rest of the campaign until you change it.',
        where: 'Sheet → Voices',
      },
      {
        q: 'How do I hear a DM reply read out?',
        a: 'Use the narration button under the message. It splits the reply by speaker and plays each part in the right voice, one after another.',
        note: 'Music ducks or pauses while narration plays and comes back afterwards, so you are not fighting your own soundtrack.',
      },
      {
        q: 'Can I record my own line?',
        a: 'Yes. Highlight the passage in a DM reply and record it in your own voice.',
        steps: [
          'Highlight the text you want to voice.',
          'Use the voice chip that appears above the selection.',
          'Record, listen back, and re-record until you are happy.',
          'Save — that clip now plays for that passage during read-aloud.',
        ],
        note: 'The highlighted lines stay on screen while you record so you do not lose your place.',
      },
    ],
  },

  // ── Playing a Turn ──
  {
    id: 'turns', section: 'playing', title: 'Taking your turn', blurb: 'Getting the scene you wanted', icon: 'swords',
    entries: [
      {
        q: 'What makes a good action?',
        a: 'Intent plus method. Say what you want to happen and how you are trying to make it happen; the DM fills in the world reacting to it.',
        note: 'Compare: "I attack the guard" versus "I kick the brazier over to blind him, then drive my dagger under his ribs while he flinches." The second one gets you the burning-tent complication and the guard who remembers your face.',
      },
      {
        q: 'Can I speak in character?',
        a: 'Yes. Put dialogue in quotes and the DM treats it as words in the room — NPCs hear it, react to it, and answer it directly.',
        note: 'Your exact words get carried into the reply rather than summarised away, so write the line you actually want said.',
      },
      {
        q: 'Can I do more than one thing?',
        a: 'Yes, but keep it to one intention with a couple of beats. A long chain of six separate plans gets compressed into a paragraph and you lose control of the details you cared about.',
        note: 'If the second half depends on how the first half went, send the first half and see what happens.',
      },
      {
        q: 'What does the improve button do?',
        a: 'It rewrites your rough note into a fuller action in your character\'s voice, keeping your intent intact. You see the result before it sends.',
        note: 'Useful when you know what you want to do but do not feel like writing it out. It never changes what you were trying to do.',
      },
      {
        q: 'The DM went off the rails',
        a: 'Correct it plainly in your next message — "that is not what I said, I was already outside the wall". Your guides and established world facts outrank the DM improvising, and it will fold the correction in.',
        note: 'In a party, the host can also take the turn back or redo the last round outright if a reply landed badly.',
      },
    ],
  },
  {
    id: 'dice', section: 'playing', title: 'Rolling dice', blurb: 'When and how to roll', icon: 'dice',
    entries: [
      {
        q: 'Do I roll before I act?',
        a: 'No. Describe the attempt first. Roll when the DM asks for one, or when you want the dice rather than the narrative to decide.',
        note: 'Many actions never need a roll. Ordinary things your character is good at just happen.',
      },
      {
        q: 'Where is the dice roller?',
        a: 'The DICE tab on the bottom bar. Pick the die, add or drop a modifier, roll, then push the result into the story so the DM narrates that exact number.',
        note: 'Your modifiers are filled in from your sheet, so you are not doing arithmetic mid-scene.',
        where: 'Bottom bar → DICE',
      },
      {
        q: 'What happens on a natural 20?',
        a: 'A fanfare plays and the roll is flagged as a critical to the DM, which narrates it as a genuine standout moment rather than a slightly better hit.',
        note: 'The fanfare fires when the DM finishes writing that reply, so the music lands with the payoff instead of talking over it.',
      },
      {
        q: 'What are auto-rolls?',
        a: 'When your action clearly involves a roll — an attack, a spell, a potion — the app rolls it as you send, shows the animation, and attaches the result.',
        note: 'You get the breakdown on screen before it commits, so you can see the hit calculation and the damage dice rather than trusting a number.',
      },
    ],
  },
  {
    id: 'survive', section: 'playing', title: 'Damage, healing and rest', blurb: 'Staying alive between fights', icon: 'heart',
    entries: [
      {
        q: 'How do I take damage or heal?',
        a: 'Adjust HP with the plus and minus controls on Vitals as hits and healing land. Temporary HP is tracked separately and burns off first.',
        note: 'Healing from a potion or spell used through the sheet applies itself — you only adjust manually for damage the DM narrates.',
        where: 'Sheet → Vitals',
      },
      {
        q: 'What does a short rest give me?',
        a: 'A breather: roughly a quarter of your maximum HP back plus the resources your class recovers on a short rest.',
        note: 'They are limited. You only get a few between long rests, and once they are gone the button will not help you.',
        where: 'Sheet → Vitals',
      },
      {
        q: 'What does a long rest give me?',
        a: 'A full reset: HP to maximum, every spell slot back, temporary HP cleared, death saves wiped, and your short rests refilled.',
        note: 'It costs in-world time. The DM advances the clock, and anything on a timer out in the world moves with it.',
        where: 'Sheet → Vitals',
      },
      {
        q: 'Does the DM know I rested?',
        a: 'Yes. Confirming a rest sends a line into the story, so the narration covers the night watch, the ambush, or simply the morning after.',
        note: 'That means resting in a bad place is a real decision, not a free button.',
      },
    ],
  },
  {
    id: 'toolbar', section: 'playing', title: 'The tools drawer', blurb: 'Every tab on the bottom bar', icon: 'wrench',
    entries: [
      { q: 'DICE', a: 'Roll anything with your modifiers pre-filled and push the result straight into the story. Reach for it when the DM asks for a check or you want the dice to decide.', where: 'Bottom bar' },
      { q: 'RP PROMPTS', a: 'Suggestions for what your character might do or say, written for the scene you are actually in. Reach for it when you are stuck staring at an empty box.', where: 'Bottom bar' },
      { q: 'ACTIONS', a: 'One-tap versions of your common moves, built from your own equipped gear, abilities and consumables. Reach for it mid-fight when typing is too slow.', where: 'Bottom bar' },
      { q: 'ORACLE', a: 'Private hints and whispers meant for you alone — a read on an NPC, a nudge on what you are missing. Nothing here is seen by the rest of the table.', where: 'Bottom bar' },
      { q: 'AFK', a: 'A personality guide the AI follows to play your character while you step away, so the party is not stalled waiting on you.', note: 'Turn it off when you come back, or it keeps acting for you.', where: 'Bottom bar' },
      { q: 'SETTINGS', a: 'Narration tone and length, round style, music and mood, and the rest of the session options.', where: 'Bottom bar' },
      { q: 'SHEET', a: 'Your full character sheet. Everything you own, know or can do lives behind this tab.', where: 'Bottom bar' },
    ],
  },
  {
    id: 'quests', section: 'playing', title: 'Quests and the world', blurb: 'Keeping the story pointed somewhere', icon: 'scroll',
    entries: [
      {
        q: 'Where do quests show up?',
        a: 'The Quest Board on the Story tab. Offers land there with their objectives and rewards laid out before you commit to anything.',
        where: 'Sheet → Story',
      },
      {
        q: 'What does accepting do?',
        a: 'It puts the quest on the board as active, the DM starts tracking your progress against its stages, and the next reply pushes you toward the first objective.',
        note: 'Declining is a real option. The DM writes the consequence of the refusal instead of pretending it never came up.',
      },
      {
        q: 'A quest was mentioned but never appeared',
        a: 'The DM described it in prose without formally offering it. Tap Scan on the Quest Board and it re-reads the latest reply and pulls the quest out.',
        where: 'Sheet → Story',
      },
      {
        q: 'What is the world state list?',
        a: 'A record of the big irreversible things you did — who you killed, what you burned, which faction you betrayed. It sits on the Quest Board and is fed back to the DM as fact.',
        note: 'This is what stops the story contradicting itself. If a reply claims someone you killed is alive, the app flags it and the host can have it rewritten.',
        where: 'Sheet → Story',
      },
      {
        q: 'Who accepts quests in a party?',
        a: 'The party creator accepts on behalf of the group, so the table does not end up on four different quests.',
        note: 'Rewards then split according to the mode the host set in party settings.',
        partyOnly: true,
      },
    ],
  },
  {
    id: 'loot', section: 'playing', title: 'Loot the DM gives you', blurb: 'Nothing is yours until you accept it', icon: 'gift',
    entries: [
      {
        q: 'What is the badge on the Items tab?',
        a: 'The DM awarded you something and it is sitting in a pending tray waiting on you. The badge counts how many items are waiting.',
        steps: [
          'Open Sheet → Items.',
          'Open the pending awards and read what each item does.',
          'Accept to move it into your bags, or discard it.',
          'Equip it if it is gear — accepting alone does not equip it.',
        ],
        where: 'Sheet → Items',
      },
      {
        q: 'Where did my reward go?',
        a: 'Almost always still pending on the Items tab. Until you accept it, it is an offer rather than a possession, so it does not show in your bags or your stats.',
        where: 'Sheet → Items',
      },
      {
        q: 'What happens to potions the DM gives me?',
        a: 'Accepted consumables land in your consumables and appear as one-tap entries in the ACTIONS drawer, with their own dice already set up.',
        where: 'Bottom bar → ACTIONS',
      },
    ],
  },

  // ── Party and Live DM ──
  {
    id: 'party-basics', section: 'party', title: 'Playing with other people', blurb: 'What changes at a shared table', icon: 'users', partyOnly: true,
    entries: [
      {
        q: 'How does a turn work with others?',
        a: 'It depends on the round style the host picked. In ready-up you each submit one action and hit Ready. In Chat Rounds and Live DM you talk in the live table chat and the round is built out of what was said.',
        note: 'Whatever the style, the DM answers the whole table in one reply rather than each of you separately.',
      },
      {
        q: 'Can I see my teammates sheets?',
        a: 'Yes. Tap Party at the top of your character sheet to read everyone else read-only — HP, gear, abilities, class.',
        note: 'Worth doing before a fight so you know who can heal, who can tank and who should not be opening doors.',
        where: 'Sheet → Party',
      },
      {
        q: 'What if we split up?',
        a: 'Each group gets its own scene and the DM narrates them separately, cutting between you, until you regroup.',
        note: 'You will read the other group\'s scene as it happens; keeping what your character does not know out of your own actions is on you.',
      },
      {
        q: 'Do I have to wait for slow players?',
        a: 'Only in ready-up, where the round waits on submissions. In Chat Rounds and Live DM the table keeps talking and the round fires when the host sends it.',
        note: 'If someone is genuinely gone, their AFK guide can act for them so the table is not frozen.',
      },
      {
        q: 'How do we all hear the same music?',
        a: 'The host controls ambient mood presets — combat, exploration, social, downtime — from settings, and can let the scene switch them automatically as the story shifts.',
        where: 'Bottom bar → SETTINGS',
      },
    ],
  },
  {
    id: 'live', section: 'party', title: 'Live DM mode', blurb: 'The table chat that drives the DM', icon: 'messages', partyOnly: true,
    entries: [
      {
        q: 'What is Live DM?',
        a: 'A round style where the party talks freely in a live chat at the bottom of the screen, and the conversation itself becomes the round the DM answers — table banter included.',
        where: 'Bottom of party screen',
      },
      {
        q: 'What are the three round styles?',
        a: 'They differ in who submits and what reaches the DM.',
        steps: [
          'Ready-up queue — one action each in the message box, then Ready. The round fires when everyone is ready.',
          'Chat Rounds — you talk in the table chat, but only in-character lines that were ticked reach the DM.',
          'Live DM — same chat, but out-of-character banter goes too, so the DM riffs on the table before playing the scene.',
        ],
        note: 'The host switches style in settings mid-session; nothing is lost when they do.',
      },
      {
        q: 'In character or table talk?',
        a: 'Use the Post as toggle above the input. In-character is your character speaking and acting in the world. Table talk is you the player, marked with a badge so nobody mistakes it for dialogue.',
        note: 'This decides whether your line can reach the DM at all. In Chat Rounds, table talk is never sent — so a plan you typed as table talk simply never happened.',
      },
      {
        q: 'Do I wait my turn?',
        a: 'No. Type as the scene happens, interrupt, argue, talk over each other. It is a conversation, not a queue.',
      },
      {
        q: 'What is the chaos dial?',
        a: 'A 1 to 10 host setting for how much comedic, fourth-wall-poking energy the DM brings. Low is straight and grim, high is unhinged running commentary.',
        note: 'It only changes tone. Your guides, your sheet and world canon still win over any joke it wants to make.',
      },
    ],
  },
  {
    id: 'round', section: 'party', title: 'Sending a round', blurb: 'Ticking lines and firing it off', icon: 'check', partyOnly: true,
    entries: [
      {
        q: 'What is the checkbox on each message?',
        a: 'It marks that line for inclusion in the next hand-off to the DM. Ticked lines get sent; unticked lines are just chatter the DM never sees.',
        note: 'Nothing is sent automatically. If you post a brilliant plan and leave it unticked, it stays between the players.',
      },
      {
        q: 'Can I tick someone else\'s line?',
        a: 'Yes. Anyone can tick anyone. If a teammate said something the DM needs to react to and they forgot, tick it for them.',
      },
      {
        q: 'How do I get a round sent?',
        a: 'Build it in the chat, then the host sends it.',
        steps: [
          'Post your action, in-character.',
          'Tick your line, and any teammate line that belongs in this round.',
          'Watch the counter on the table bar — it shows ticked versus what the round is waiting on, and turns green at the threshold.',
          'The host taps Send to DM, which fires generation immediately.',
        ],
      },
      {
        q: 'What does Sent mean?',
        a: 'That line has gone to the DM. It fades, locks, and can no longer be ticked, edited or deleted — it belongs to that round permanently.',
        note: 'Spotted a mistake after it sent? Post a correction as a new line and tick that instead.',
      },
      {
        q: 'What sets the threshold?',
        a: 'The host. They choose whether the round needs a total number of messages, a number from each player, or messages from a number of distinct players — and whether table talk counts toward it.',
        note: 'A round that will not turn green usually means it is waiting on a specific person, not just more messages.',
      },
      {
        q: 'I made a typo',
        a: 'Tap the pencil on your own line to edit it in place, or delete it, any time before it is sent.',
        note: 'You can also react to any message with an emoji, which is never sent to the DM — it is purely for the table.',
      },
    ],
  },
  {
    id: 'signals', section: 'party', title: 'Pings, votes and focus fire', blurb: 'Fast signals mid-fight', icon: 'radio', partyOnly: true,
    entries: [
      {
        q: 'How do I get attention fast?',
        a: 'Send a tactical ping instead of typing: Need Heal, Danger, Focus Fire, Ready, Help or Retreat. It shows to the whole party instantly.',
        note: 'Each has a short cooldown so the screen cannot be spammed. Pings are player-to-player — the DM does not narrate them.',
      },
      {
        q: 'How do we all hit the same target?',
        a: 'Ping Focus Fire to mark an enemy. A banner pins to the top of everyone\'s screen naming the target and who marked it, until someone clears it.',
        note: 'The banner is the reminder; you still have to actually aim your action at it.',
      },
      {
        q: 'How do we settle an argument?',
        a: 'Start a vote with a question and at least two options. Everyone taps a pick and the tally updates live for the whole party.',
        note: 'The vote decides the table, not the story. Someone still has to post the resulting action for the DM to act on.',
      },
    ],
  },
  {
    id: 'party-loot', section: 'party', title: 'Shared loot', blurb: 'Who gets what', icon: 'split', partyOnly: true,
    entries: [
      {
        q: 'Where does group loot go?',
        a: 'Into the shared loot queue rather than any one person\'s bags. Anyone can claim an unclaimed item, and claimed items show who took them.',
        note: 'Claim it and it moves into your pending awards — you still have to accept it there before it is really yours.',
      },
      {
        q: 'How are quest rewards split?',
        a: 'The host sets the split mode for XP and gold in party settings, and the app applies it to everyone when the quest closes.',
        where: 'Bottom bar → SETTINGS',
      },
    ],
  },
];

/** Symptom-first troubleshooting, rendered as its own screen. */
export const HELP_FIXES: Array<{ symptom: string; cause: string; confirm?: string; fix: string; partyOnly?: boolean }> = [
  { symptom: 'The DM ignored the item I used', cause: 'Typing about an item is not the same as using it — no action was ever sent.', confirm: 'Check your count for that item on the Items tab. If it did not go down, it was never used.', fix: 'Use it from the Items tab or the ACTIONS drawer. That spends it, rolls it, and hands the DM a result it has to react to.' },
  { symptom: 'I never got the reward the DM promised', cause: 'Awarded loot sits pending until you accept it.', confirm: 'Look for the badge on the Items tab — the number is how many awards are waiting.', fix: 'Open Items, read the pending award, and accept it. Equip it afterwards if it is gear.' },
  { symptom: 'My gear bonus is not showing up', cause: 'The item is owned but not equipped, and only equipped gear counts.', confirm: 'Open the gear bonus breakdown on Stats — if the item is not listed there, it is not equipped.', fix: 'Equip it on the Items tab, then re-check the breakdown on Stats to confirm the bonus applied.' },
  { symptom: 'I cannot cast a spell', cause: 'No slot at that level or higher remains.', confirm: 'Check your remaining slots on the Abilities tab.', fix: 'Take a short or long rest from Vitals, cast it from a lower slot if it allows it, or fall back to a cantrip.' },
  { symptom: 'I cannot take another short rest', cause: 'Short rests are limited between long rests and you have used them.', confirm: 'The short rest counter on Vitals shows how many you have left.', fix: 'Take a long rest. That refills your short rests along with HP and slots — but it costs in-world time.' },
  { symptom: 'A quest was mentioned but is not on the board', cause: 'The DM described it in prose without formally offering it.', confirm: 'The Quest Board on the Story tab has no matching offer.', fix: 'Tap Scan on the Quest Board. It re-reads the last reply and pulls the quest out into a real offer.' },
  { symptom: 'The story forgot something important', cause: 'It was said once in passing and never written down anywhere permanent.', confirm: 'Search your backstory and relationships — if it is not there, it can fade out of the DM\'s memory.', fix: 'Add it to your backstory or relationships on the Story tab, then remind the DM once in your next message.' },
  { symptom: 'The DM contradicted something that already happened', cause: 'It improvised over an established fact.', confirm: 'Check the world state list on the Quest Board for the fact it broke.', fix: 'Say so plainly in your next message. In a party the host can also have the reply rewritten or redo the round.' },
  { symptom: 'Nothing happens when I post in the table chat', cause: 'Posting does not send anything — the round has not been fired.', confirm: 'Look at the counter on the table bar: it shows ticked lines versus what the round still needs.', fix: 'Tick your line. If the counter is green, ask the host to send the round.', partyOnly: true },
  { symptom: 'My message never reached the DM', cause: 'It was unticked, or it was table talk in a mode that does not send table talk.', confirm: 'Check the checkbox on your line and the badge showing whether you posted in-character or as table talk.', fix: 'Tick the line, and repost it in-character if the round style only sends in-character lines.', partyOnly: true },
  { symptom: 'I cannot edit my message', cause: 'It was already sent in a round, and sent lines lock permanently.', confirm: 'Sent lines are faded and have no pencil icon.', fix: 'Post a correction as a new line and tick that one instead.', partyOnly: true },
  { symptom: 'I cannot accept a quest', cause: 'Only the party creator accepts on behalf of the group.', confirm: 'The accept button is missing for you on the Quest Board.', fix: 'Ask the host to accept it. Rewards then split by the mode set in party settings.', partyOnly: true },
  { symptom: 'The DM is too jokey, or too serious', cause: 'The chaos dial is set high or low.', confirm: 'Ask the host what it is set to in party settings — it runs 1 to 10.', fix: 'Have the host move it. Low is grim and straight, high is comedic and fourth-wall-breaking.', partyOnly: true },
  { symptom: 'The party is stuck waiting on someone', cause: 'A ready-up round waits on every submission.', confirm: 'The ready counter shows who has not submitted.', fix: 'Have them set an AFK guide so the AI acts for them, or have the host switch to Chat Rounds or Live DM.', partyOnly: true },
];

/** Plain-language glossary, rendered as its own screen. */
export const HELP_GLOSSARY: Array<{ term: string; meaning: string; example?: string; partyOnly?: boolean }> = [
  { term: 'Round', meaning: 'One exchange: the table acts, the DM answers once for everyone.', example: 'Three of you post actions, the host sends, and one reply covers all three.' },
  { term: 'In character', meaning: 'Your character speaking or acting inside the world. NPCs can hear it and the DM narrates it.', example: '"I don\'t trust him," she says, hand already on the hilt.' },
  { term: 'Table talk', meaning: 'You the player, out of character. Shown with a badge so nobody reads it as dialogue.', example: '"Hang on, do we still have the rope?" — in Live DM the DM hears this too and may riff on it.', partyOnly: true },
  { term: 'Ticked', meaning: 'A chat line you marked to be included in the next hand-off to the DM.', example: 'Untick it and the DM never sees it, no matter how good it was.', partyOnly: true },
  { term: 'Sent', meaning: 'A line that already went to the DM. Faded, locked, no longer editable or tickable.', example: 'Spotted a typo after sending? Post a correction as a new line.', partyOnly: true },
  { term: 'Threshold', meaning: 'What the round is waiting on before the host can fire it, set by the host.', example: 'Could be five total messages, or one from each of the four of you.', partyOnly: true },
  { term: 'Chaos dial', meaning: 'How much comedy and fourth-wall energy the DM brings, 1 to 10.', example: 'At 2 the goblin snarls; at 9 it complains about its shift pattern.', partyOnly: true },
  { term: 'Focus target', meaning: 'An enemy the party marked so everyone attacks the same thing.', example: 'A banner pins to the top of everyone\'s screen until it is cleared.', partyOnly: true },
  { term: 'Ping', meaning: 'A one-tap signal to the party like Need Heal or Retreat.', example: 'Faster than typing mid-fight, and the DM does not narrate it.', partyOnly: true },
  { term: 'AFK guide', meaning: 'Instructions the AI uses to play your character while you are away.', example: '"Cautious, protects the healer, never starts fights" — then step away without stalling the table.' },
  { term: 'Oracle', meaning: 'Private hints and whispers meant only for you.', example: 'A read on whether the merchant is lying, without asking in front of the party.' },
  { term: 'Quest Board', meaning: 'Where the DM offers quests, tracks accepted ones, and records world state.', example: 'Sheet → Story. Tap Scan if a mentioned quest never appeared.' },
  { term: 'World state', meaning: 'The record of irreversible things you did, fed back to the DM as fact.', example: 'Once it says the captain is dead, the DM cannot bring him back for a scene.' },
  { term: 'Pending item', meaning: 'Loot the DM gave you that you have not accepted yet.', example: 'It shows as a badge on Items and does not affect your stats until accepted.' },
  { term: 'Equipped', meaning: 'Gear actively worn or held. Only equipped gear changes your numbers.', example: 'A plate harness in your bags does nothing for your AC.' },
  { term: 'Short rest', meaning: 'A brief breather: about a quarter of your max HP plus short-rest resources.', example: 'Limited between long rests, so do not burn them all in one dungeon.' },
  { term: 'Long rest', meaning: 'A full night: HP, slots, temp HP, death saves and short rests all reset.', example: 'It advances the in-world clock, so resting in a bad place has consequences.' },
  { term: 'Milestone levelling', meaning: 'Levelling at story beats instead of tracking XP numbers.', example: 'The host picks this instead of the XP bar if your table prefers it.' },
];
