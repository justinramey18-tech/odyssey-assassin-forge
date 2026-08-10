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
  { step: 'Write who you are', detail: 'Fill in your backstory, race and gender. The DM reads this and builds the world around it. Blank backstory means a generic story.', where: 'Sheet → Story' },
  { step: 'Check your numbers', detail: 'Look over your ability scores, HP and gold so nothing surprises you mid-fight. None of it is locked in.', where: 'Sheet → Stats' },
  { step: 'Load your kit', detail: 'Equip gear and stock consumables. Equipped gear changes your stats the moment you equip it.', where: 'Sheet → Items' },
  { step: 'Give everyone a voice', detail: 'Assign a voice to yourself and to NPCs so read-aloud narration sounds like different people.', where: 'Sheet → Voices' },
  { step: 'Say what you do', detail: 'Type what your character does and why. Describe intent — the DM handles the rules.' },
];

export const HELP_TOPICS: HelpTopic[] = [
  // ── First Steps ──
  {
    id: 'how-it-works', section: 'start', title: 'How a session works', blurb: 'The basic loop', icon: 'compass',
    entries: [
      { q: 'Who is the DM?', a: 'An AI Dungeon Master. It narrates the world, plays every NPC, and reacts to what you write. It is not following a script — the story bends around what you do.' },
      { q: 'What do I actually type?', a: 'What your character does, says or tries. "I edge along the wall and listen at the door" works. "Perception check" does not.' },
      { q: 'Do I need to know the rules?', a: 'No. Describe the attempt in plain words. The app handles dice, resources and bonuses behind the scenes.' },
      { q: 'How long until the DM replies?', a: 'Usually a few seconds. A status line tells you when it is thinking so you are not left guessing.' },
    ],
  },
  {
    id: 'screen-tour', section: 'start', title: 'Where everything lives', blurb: 'A tour of the screen', icon: 'wrench',
    entries: [
      { q: 'The bottom bar', a: 'Swipe up on it to open your tools: dice, roleplay prompts, one-tap actions, the Oracle, AFK settings and your character sheet.', where: 'Bottom bar' },
      { q: 'Your character sheet', a: 'Everything about you — vitals, stats, abilities, items, voices and story. Open it from the SHEET tab on the bottom bar.', where: 'Bottom bar → SHEET' },
      { q: 'The table chat', a: 'In party sessions using Live DM or Chat Rounds, a chat drawer sits at the bottom of the screen. That is where the round is built.', where: 'Bottom of party screen', partyOnly: true },
      { q: 'This guide', a: 'The question mark in the header, any time. It never interrupts your session — closing it puts you right back.' },
    ],
  },

  // ── Your Character ──
  {
    id: 'backstory', section: 'character', title: 'Backstory and identity', blurb: 'What the DM knows about you', icon: 'user',
    entries: [
      { q: 'How much backstory should I write?', a: 'Up to 4000 characters. Motives, secrets and enemies matter far more than a family tree — the DM pulls threads out of it mid-campaign.', where: 'Sheet → Story' },
      { q: 'How do I add people from my past?', a: 'Add them under Relationships with a name and a disposition like ally, rival or lover. The DM brings them back into the story later.', where: 'Sheet → Story' },
      { q: 'Where do I set race and gender?', a: 'Under Identity on the Story tab. These shape how NPCs address and react to you.', where: 'Sheet → Story' },
      { q: 'Can I change any of it later?', a: 'Yes, all of it, at any point. The DM reads the current version on your next message.' },
    ],
  },
  {
    id: 'numbers', section: 'character', title: 'Stats, XP and leveling', blurb: 'Your numbers and where they come from', icon: 'activity',
    entries: [
      { q: 'Why is a stat higher than I expected?', a: 'Equipped gear adds bonuses. The Stats tab breaks each one out so you can see exactly which item is doing it.', where: 'Sheet → Stats' },
      { q: 'How do I earn XP?', a: 'The DM awards it as you play. The progress bar shows how far you are from the next level.' },
      { q: 'How do I level up?', a: 'When the bar fills, take the level up. New picks unlock in the Abilities, Arcana and Legacy screens.' },
    ],
  },
  {
    id: 'kit', section: 'character', title: 'Gear, items and gold', blurb: 'Equipping, using, buying', icon: 'backpack',
    entries: [
      { q: 'How do I equip something?', a: 'Equip it from the Items tab. Your stats change immediately and you can see the difference on Stats.', where: 'Sheet → Items' },
      { q: 'How do I use an item in the story?', a: 'Use it from the sheet rather than just typing about it. That sends the action to the DM so the narration actually reacts.', where: 'Sheet → Items' },
      { q: 'Where do I spend gold?', a: 'Tap through to the Shop from Items to buy and sell. Your purse shows on Vitals.', where: 'Sheet → Items → Shop' },
    ],
  },
  {
    id: 'powers', section: 'character', title: 'Abilities and spells', blurb: 'What you can do in a scene', icon: 'zap',
    entries: [
      { q: 'Where are my abilities?', a: 'The Abilities tab lists everything you have. Tap a row to expand the full description.', where: 'Sheet → Abilities' },
      { q: 'How do I cast a spell?', a: 'Tap Cast. The app rolls it, spends the slot, and hands the DM a factual result to narrate.', where: 'Sheet → Abilities' },
      { q: 'Why is a spell greyed out?', a: 'No slot of that level or higher is left. Cantrips are always available, and a rest gets your slots back.' },
      { q: 'Where do I pick new ones?', a: 'Jump out to Abilities, Arcana or Legacy from the sheet. The floating return button brings you straight back.' },
    ],
  },
  {
    id: 'voices', section: 'character', title: 'Voices and read-aloud', blurb: 'Making the table sound right', icon: 'mic',
    entries: [
      { q: 'How do I get a voice?', a: 'Pick one on the Voices tab and assign it. Read-aloud then uses it for your lines.', where: 'Sheet → Voices' },
      { q: 'Can NPCs have their own voices?', a: 'Yes. The tab suggests names spotted in the current story so you can cast whoever just spoke in one tap.', where: 'Sheet → Voices' },
    ],
  },

  // ── Playing a Turn ──
  {
    id: 'turns', section: 'playing', title: 'Taking your turn', blurb: 'Getting the scene you wanted', icon: 'swords',
    entries: [
      { q: 'What makes a good action?', a: 'Intent plus method. Say what you want to happen and how you are trying to make it happen. The DM fills in the rest.' },
      { q: 'Can I speak in character?', a: 'Yes. Put dialogue in quotes and the DM treats it as words NPCs can hear and answer.' },
      { q: 'Can I do more than one thing?', a: 'Yes, but keep it to one intention. Long chains of actions get compressed and you lose control of the details.' },
      { q: 'The DM went off the rails', a: 'Correct it plainly in your next message. Your guides and established world facts outrank the DM improvising.' },
    ],
  },
  {
    id: 'dice', section: 'playing', title: 'Rolling dice', blurb: 'When and how to roll', icon: 'dice',
    entries: [
      { q: 'Do I roll before I act?', a: 'No. Describe the attempt first. Roll if the DM asks for one or if you want the number to decide.' },
      { q: 'Where is the dice roller?', a: 'The DICE tab on the bottom bar. Results can be pushed straight into the story so the DM narrates the outcome.', where: 'Bottom bar → DICE' },
    ],
  },
  {
    id: 'survive', section: 'playing', title: 'Damage, healing and rest', blurb: 'Staying alive between fights', icon: 'heart',
    entries: [
      { q: 'How do I take damage or heal?', a: 'Adjust your HP with the plus and minus controls on Vitals as hits and healing land.', where: 'Sheet → Vitals' },
      { q: 'What does a short rest give me?', a: 'Roughly a quarter of your max HP plus short-rest resources. You only get a few before a long rest is required.', where: 'Sheet → Vitals' },
      { q: 'What does a long rest give me?', a: 'Full HP, spell slots back, temp HP cleared, death saves reset and your short rests refilled.', where: 'Sheet → Vitals' },
      { q: 'Does the DM know I rested?', a: 'Yes. Confirming a rest sends a line to the DM so the story moves forward with the time you spent.' },
    ],
  },
  {
    id: 'toolbar', section: 'playing', title: 'The tools drawer', blurb: 'Every tab on the bottom bar', icon: 'wrench',
    entries: [
      { q: 'DICE', a: 'Roll anything and push the result into the story.', where: 'Bottom bar' },
      { q: 'RP PROMPTS', a: 'Ideas for what your character would do when you are stuck.', where: 'Bottom bar' },
      { q: 'ACTIONS', a: 'One-tap versions of common moves, built from your own gear and abilities.', where: 'Bottom bar' },
      { q: 'ORACLE', a: 'Private whispers and hints meant for you, not the table.', where: 'Bottom bar' },
      { q: 'AFK', a: 'Set a personality guide so the AI plays your character when you step away.', where: 'Bottom bar' },
      { q: 'SETTINGS', a: 'Narration tone, round style and session options.', where: 'Bottom bar' },
    ],
  },
  {
    id: 'quests', section: 'playing', title: 'Quests and the world', blurb: 'Keeping the story pointed somewhere', icon: 'scroll',
    entries: [
      { q: 'Where do quests show up?', a: 'The Quest Board on the Story tab. Offers appear there to accept or decline.', where: 'Sheet → Story' },
      { q: 'What does accepting do?', a: 'The DM starts tracking the quest and narrates the opening beat toward the first objective.' },
      { q: 'A quest was mentioned but never appeared', a: 'Tap Scan on the Quest Board. It re-reads the DM latest reply and pulls the quest out.', where: 'Sheet → Story' },
      { q: 'Who accepts quests in a party?', a: 'The party creator, on behalf of the group.', partyOnly: true },
    ],
  },
  {
    id: 'loot', section: 'playing', title: 'Loot the DM gives you', blurb: 'Nothing is yours until you accept it', icon: 'gift',
    entries: [
      { q: 'What is the badge on the Items tab?', a: 'The DM awarded you something and it is waiting. Open Items to accept or discard it.', where: 'Sheet → Items' },
      { q: 'Where did my reward go?', a: 'Almost always sitting unaccepted on the Items tab. Accept it to move it into your bags.', where: 'Sheet → Items' },
    ],
  },

  // ── Party and Live DM ──
  {
    id: 'party-basics', section: 'party', title: 'Playing with other people', blurb: 'What changes at a shared table', icon: 'users', partyOnly: true,
    entries: [
      { q: 'How does a turn work with others?', a: 'It depends on the round style your host picked. Classic ready-up means you submit an action and hit Ready. Chat Rounds and Live DM mean you type into the live table chat instead.' },
      { q: 'Can I see my teammates sheets?', a: 'Yes. Tap Party at the top of your character sheet to read them, so you know who can heal, tank or scout.', where: 'Sheet → Party' },
      { q: 'What if we split up?', a: 'Each group gets its own scene and the DM narrates them separately until you regroup.' },
      { q: 'Do I have to wait for slow players?', a: 'Only in classic ready-up. In Live DM the table keeps talking and the round fires when the host sends it.' },
    ],
  },
  {
    id: 'live', section: 'party', title: 'Live DM mode', blurb: 'The table chat that drives the DM', icon: 'messages', partyOnly: true,
    entries: [
      { q: 'What is Live DM?', a: 'Instead of ready-up, the party talks in a live chat at the bottom of the screen. What the table says becomes the round the DM answers.', where: 'Bottom of party screen' },
      { q: 'What are the three round styles?', a: 'Ready-up queue is one submission each. Chat Rounds sends only in-character lines. Live DM sends the out-of-character banter along too, so the DM riffs on the table before playing the scene.' },
      { q: 'In character or table talk?', a: 'Use the Post as toggle above the input. In-character is your character speaking and acting. Table talk is you the player, tagged with a badge. Live DM sends both; Chat Rounds sends only in-character.' },
      { q: 'Do I wait my turn?', a: 'No. Type as the scene happens. The table is a conversation, not a queue.' },
      { q: 'What is the chaos dial?', a: 'A 1 to 10 host setting for how much comedic, fourth-wall energy the DM brings. Low is straight and serious, high is unhinged commentary. Your guides always beat the joke.' },
    ],
  },
  {
    id: 'round', section: 'party', title: 'Sending a round', blurb: 'Ticking lines and firing it off', icon: 'check', partyOnly: true,
    entries: [
      { q: 'What is the checkbox on each message?', a: 'Tick a line to include it in the next hand-off to the DM. Untick to pull it back. Unticked lines are just chatter the DM never sees.' },
      { q: 'Can I tick someone else line?', a: 'Yes. If a teammate said something the DM needs to react to, tick it for them.' },
      { q: 'What does Sent mean?', a: 'That line has gone to the DM. It fades out and can no longer be ticked or edited — it belongs to that round now.' },
      { q: 'When does the round fire?', a: 'The host sends it. The counter on the table bar shows lines ticked versus lines the round is waiting on, and turns green when the threshold is met.' },
      { q: 'What sets the threshold?', a: 'The host picks whether the round needs a total number of messages, a number from each player, or messages from a number of distinct players — and whether table talk counts.' },
      { q: 'I made a typo', a: 'Edit or delete your own messages any time before they are sent. You can also react to anyone message with an emoji.' },
    ],
  },
  {
    id: 'signals', section: 'party', title: 'Pings, votes and focus fire', blurb: 'Fast signals mid-fight', icon: 'radio', partyOnly: true,
    entries: [
      { q: 'How do I get attention fast?', a: 'Send a tactical ping: Need Heal, Danger, Focus Fire, Ready, Help or Retreat. Each has a short cooldown.' },
      { q: 'How do we all hit the same target?', a: 'Ping Focus Fire to mark it. A banner shows at the top of everyone screen with who marked it, until someone clears it.' },
      { q: 'How do we settle an argument?', a: 'Start a vote with a question and at least two options. Everyone taps a pick and the tally updates live.' },
    ],
  },
  {
    id: 'party-loot', section: 'party', title: 'Shared loot', blurb: 'Who gets what', icon: 'split', partyOnly: true,
    entries: [
      { q: 'Where does group loot go?', a: 'Into the shared loot queue. Anyone can claim an unclaimed item, and claimed items show who took them.' },
      { q: 'How are quest rewards split?', a: 'The host sets the split mode for XP and gold in party settings.' },
    ],
  },
];

/** Symptom-first troubleshooting, rendered as its own screen. */
export const HELP_FIXES: Array<{ symptom: string; cause: string; fix: string; partyOnly?: boolean }> = [
  { symptom: 'The DM ignored the item I used', cause: 'Typing about an item is not the same as using it.', fix: 'Use it from the Items tab. That sends a real action the DM has to react to.' },
  { symptom: 'I never got the reward the DM promised', cause: 'Awarded loot waits for you to accept it.', fix: 'Open the Items tab and look for the badge. Accept it to move it into your bags.' },
  { symptom: 'My gear bonus is not showing up', cause: 'The item is owned but not equipped.', fix: 'Equip it on the Items tab, then check the breakdown on Stats to confirm the bonus applied.' },
  { symptom: 'I cannot cast a spell', cause: 'No slot of that level or higher remains.', fix: 'Take a short or long rest from Vitals, or cast a lower level spell or cantrip.' },
  { symptom: 'I cannot take another short rest', cause: 'Short rests are limited between long rests.', fix: 'Take a long rest. That refills your short rests along with everything else.' },
  { symptom: 'A quest was mentioned but is not on the board', cause: 'The DM described it without formally offering it.', fix: 'Tap Scan on the Quest Board to re-read the last reply and pull it out.' },
  { symptom: 'The story forgot something important', cause: 'It was said in passing and never written down.', fix: 'Put it in your backstory or relationships on the Story tab, then remind the DM in your next message.' },
  { symptom: 'Nothing happens when I post in the table chat', cause: 'The round has not been sent yet.', fix: 'Check the table bar. Either the round is short a ticked line, or the host has not sent it.', partyOnly: true },
  { symptom: 'My message never reached the DM', cause: 'Unticked lines and, in Chat Rounds, table talk are never sent.', fix: 'Tick your line, and check whether you posted it as in-character or table talk.', partyOnly: true },
  { symptom: 'I cannot edit my message', cause: 'It was already sent in a round.', fix: 'Sent lines are locked. Post a correction as a new line and tick that instead.', partyOnly: true },
  { symptom: 'I cannot accept a quest', cause: 'Only the party creator can accept for the group.', fix: 'Ask the host to accept it.', partyOnly: true },
  { symptom: 'The DM is too jokey, or too serious', cause: 'The chaos dial is set high or low.', fix: 'Ask the host to change it in party settings.', partyOnly: true },
];

/** Plain-language glossary, rendered as its own screen. */
export const HELP_GLOSSARY: Array<{ term: string; meaning: string; partyOnly?: boolean }> = [
  { term: 'Round', meaning: 'One exchange: the table acts, the DM answers.' },
  { term: 'In character', meaning: 'Your character speaking or acting. NPCs can hear it.' },
  { term: 'Table talk', meaning: 'You the player, out of character. In Live DM the DM hears it too.', partyOnly: true },
  { term: 'Ticked', meaning: 'A chat line you marked to be included in the next hand-off to the DM.', partyOnly: true },
  { term: 'Sent', meaning: 'A line that already went to the DM. Locked, faded, cannot be edited.', partyOnly: true },
  { term: 'Chaos dial', meaning: 'How much comedy and fourth-wall energy the DM brings, 1 to 10.', partyOnly: true },
  { term: 'Focus target', meaning: 'An enemy the party marked so everyone attacks the same thing.', partyOnly: true },
  { term: 'Ping', meaning: 'A one-tap signal like Need Heal or Retreat, shown to the whole party.', partyOnly: true },
  { term: 'AFK guide', meaning: 'Instructions the AI uses to play your character while you are away.' },
  { term: 'Oracle', meaning: 'Private hints and whispers meant only for you.' },
  { term: 'Quest Board', meaning: 'Where the DM offers quests and tracks the ones you accepted.' },
  { term: 'Pending item', meaning: 'Loot the DM gave you that you have not accepted yet.' },
  { term: 'Short rest', meaning: 'A brief breather. Some HP and some resources back. Limited between long rests.' },
  { term: 'Long rest', meaning: 'A full night. Everything back, short rests refilled.' },
];
