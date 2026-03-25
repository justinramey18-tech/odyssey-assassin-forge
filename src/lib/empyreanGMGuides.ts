// Empyrean Series GM Guides — 10 Lore + 10 Meta campaign modifiers

export interface EmpyreanGuide {
  id: string;
  name: string;
  content: string;
  category: 'lore' | 'tone' | 'pacing' | 'alternate' | 'session';
  stackable: boolean;
  description: string;
}

export const EMPYREAN_GUIDE_PREFIX = 'empyrean-';

// ─── LORE GUIDES ────────────────────────────────────────────────────────────

const lorNavarre: EmpyreanGuide = {
  id: 'empyrean-lore-navarre',
  name: 'World of Navarre',
  category: 'lore',
  stackable: true,
  description: 'Geography, politics, the Empyrean, and the war that shapes everything.',
  content: `# World of Navarre — Setting Overview

Navarre is a militaristic kingdom on a continent scarred by centuries of conflict with the Venin — corrupted wielders who drain the land of life to fuel dark magic. The kingdom is protected by an enormous ward line powered by wardstones, maintained by dragon riders and runic magic.

## Geography
Navarre occupies the eastern portion of the continent. The interior is mountainous, with Basgiath War College built into the Cliffs of Dralor overlooking the Isgaard Valley. The western frontier borders the Barrens — territory beyond the wards where the land is drained, grey, and lifeless. To the south lies Poromiel, a kingdom that uses gryphon riders instead of dragon riders. The northern territories are sparsely populated frontier zones where ward failures are most common.

## Political Structure
The Empyrean is the ruling body — a council of senior dragon riders, military commanders, and political leaders. The Commandant of Basgiath holds enormous influence. Power flows through military rank. Scribes control information, and their leadership decides what the general population knows about the war. This information control is a deliberate policy: most citizens and even many riders do not know the true state of the ward line.

## The War
The conflict with the Venin is existential. Venin cross the ward line to attack settlements, drain the land, and corrupt wielders. The official position is that the wards are strong and the war is manageable. The truth — known to a rebel faction within the riders — is that the wards are failing, attacks are increasing, and Navarre is losing. This secret drives much of the political tension.

## The Reunification Treaty
Generations ago, warring dragon rider factions united under a single banner, founding Basgiath as a training institution and establishing the Empyrean as a governing body. The treaty ended centuries of riders fighting each other and redirected their power against the Venin. However, old bloodline rivalries persist beneath the surface of institutional unity.

## Atmosphere
The world feels militaristic, secretive, and dangerous. Beauty exists — the dragons, the mountains, the bonds between riders — but it is always shadowed by the cost of war, institutional secrecy, and the knowledge that the people protecting you may also be lying to you.`,
};

const lorBasgiath: EmpyreanGuide = {
  id: 'empyrean-lore-basgiath',
  name: 'Basgiath War College',
  category: 'lore',
  stackable: true,
  description: 'Quadrants, wing structure, daily life, curriculum, and chain of command.',
  content: `# Basgiath War College — Structure and Daily Life

Basgiath is the only institution that trains dragon riders. Built into a mountain fortress, it is equal parts military academy, proving ground, and slaughterhouse. Not everyone who enters survives.

## The Four Quadrants
- **Riders Quadrant**: The elite. Students bond with dragons during Threshing and train in aerial combat, signet development, and tactical warfare. Highest mortality rate.
- **Scribes Quadrant**: Intelligence and record-keeping. Scribes manage information, maintain archives, and serve as the bureaucratic backbone. They control what the public knows.
- **Healers Quadrant**: Medical corps. Healers train in both conventional medicine and magical healing, treating injuries from training, combat, and signet burnout.
- **Infantry Quadrant**: Ground forces. Infantry students train without dragons, serving as the foot soldiers, engineers, and support structure for the rider corps.

## Wing and Squad Structure
Riders are organized into Wings (led by a Wingleader) and further divided into Squads (led by a Squad Leader). A wing typically contains 3-4 squads of 5-8 riders each. Wing assignments are semi-permanent and create intense loyalty bonds. Inter-wing rivalry is encouraged by leadership as a training tool.

## Daily Life
Days begin before dawn. Morning physical training is followed by academic classes (history, tactics, languages, Battle Brief intelligence sessions), then afternoon combat training (sparring, flight exercises, signet drills). Evenings are nominally free but often consumed by studying, squad bonding, or recovering from injuries. Meals are communal in the mess hall — a social battlefield of its own.

## The Parapet
First-year riders must cross the parapet — a narrow, crumbling stone bridge with no railings over a lethal drop — on their first day. This is the first test: those who cannot cross die. It establishes immediately that Basgiath does not protect you from death.

## Threshing
The bonding ceremony where unbonded dragons choose their riders. Dragons are not assigned — they choose. Being rejected by every dragon means transfer to a different quadrant or, in some cases, death by a dragon who finds you unworthy. Threshing is terrifying, sacred, and the most important day of a rider's life.

## Chain of Command
Commandant → Vice Commandant → Wing Commanders → Professors → Wingleaders → Squad Leaders → Cadets. Orders flow downward absolutely. Questioning the chain is insubordination. This rigid structure both protects and oppresses.`,
};

const lorDragonBonds: EmpyreanGuide = {
  id: 'empyrean-lore-dragons',
  name: 'Dragon Bonds',
  category: 'lore',
  stackable: true,
  description: 'Bonding mechanics, telepathy, bleed-through, breeds, and dragon agency.',
  content: `# Dragon Bonds — Mechanics and Lore

The dragon bond is the foundation of everything in the rider world. It is not ownership — it is a partnership between two sentient beings, and the dragon always has the final say.

## How Bonding Works
During Threshing, unbonded dragons evaluate potential riders through proximity, mental probing, and instinct. A bond forms instantaneously — a flash of connection that rewrites both minds. The rider gains access to the dragon's power (enabling signet manifestation) and a telepathic link. The dragon gains a partner whose emotions, memories, and will become partially accessible. Neither party can fully control the other.

## The Mental Connection
Bonded pairs share a telepathic channel that ranges from deliberate speech to passive emotional awareness. Distance weakens the connection but never fully severs it. Strong bonds allow full sentence communication; newer bonds may only transmit emotions, images, or single words. Dragons communicate in terse, ancient-feeling language — they do not ramble.

## Bond Bleed-Through
Physical and emotional states bleed between rider and dragon. If the dragon is injured, the rider feels phantom pain. If the rider experiences intense emotion, the dragon is affected. This bleed-through deepens with time and can become overwhelming during combat or emotional crisis. Learning to manage bleed-through is a critical training skill.

## Dragon Breeds
Multiple breeds exist, varying in size, temperament, fire type, and combat specialization. Some breeds are more aggressive, others more strategic. Breed affects personality — smaller, faster dragons tend toward impatience; ancient lineage dragons carry ancestral grudges. Specific breed names and traits should be invented by the AI DM to fit the campaign.

## Second Bonds
Extremely rare. A rider bonding a second dragon (or a dragon accepting a second rider) is nearly unheard of and carries enormous political and personal implications. Second bonds are viewed with suspicion, awe, or fear depending on the faction.

## Dragon Agency
Dragons are not mounts. They have opinions, agendas, and personalities. A dragon may refuse to fly into a battle it considers suicidal. It may disapprove of the rider's romantic choices. It may have ancient rivalries with other dragons that complicate squad dynamics. The AI DM should always give the bonded dragon a voice, preferences, and moments of independent action.

## Bond Severance
If a dragon dies, the rider almost always dies — or is left broken, a shell of their former self. If a rider dies, the dragon grieves deeply and may never accept another bond. This mutual vulnerability is what makes the bond sacred.`,
};

const lorSignets: EmpyreanGuide = {
  id: 'empyrean-lore-signets',
  name: 'Signet Abilities',
  category: 'lore',
  stackable: true,
  description: 'Manifestation, categories, burnout, growth, and creating original signets.',
  content: `# Signet Abilities — Powers and Rules

Signets are innate magical abilities that manifest in dragon riders through the power channeled by their dragon bond. Every rider's signet is unique, though they fall into recognizable categories.

## Manifestation
Signets typically manifest under extreme stress — during combat, emotional crisis, or life-threatening situations. The rider does not choose their signet; it emerges from their deepest nature, fears, and desires. Some signets manifest dramatically (a burst of power); others are subtle (a quiet ability noticed only after the fact). First manifestation is always disorienting and often dangerous.

## Categories
- **Physical**: Enhanced strength, speed, durability, or sensory abilities. Straightforward but reliable.
- **Mental**: Telepathy beyond dragon bond, empathic reading, memory manipulation, truth detection.
- **Elemental**: Control over fire, lightning, wind, ice, earth, or weather. Flashy and destructive.
- **Temporal**: Time perception manipulation, precognitive flashes, slowing/hastening effects. Extremely rare and taxing.
- **Gravitational/Spatial**: Manipulating weight, distance, barriers, or shields. Versatile in combat.
- **Shadow/Illusion**: Invisibility, sensory illusions, darkness manipulation. Valuable for reconnaissance.

## Burnout
Every signet has limits. Pushing beyond them causes burnout — physical symptoms ranging from nosebleeds and exhaustion to seizures, organ failure, and death. Burnout risk increases with power output and duration. Recovery requires rest; repeated burnout causes cumulative damage. The line between "enough" and "too much" is learned through painful experience.

## Growth
Signets strengthen with practice and emotional development. A signet that starts as a minor ability can grow into something formidable over months or years. Growth is not linear — breakthroughs often happen during crisis. Training with professors who understand signet mechanics accelerates development.

## Creating Original Signets
When a player's rider manifests their signet, the AI DM should:
1. Connect it thematically to the character's personality and fears
2. Start it weak with clear limitations
3. Define what burnout looks like for this specific ability
4. Allow growth through narrative milestones, not arbitrary level-ups
5. Ensure it creates interesting choices, not just raw power`,
};

const lorRunes: EmpyreanGuide = {
  id: 'empyrean-lore-runes',
  name: 'Runes and Warding',
  category: 'lore',
  stackable: true,
  description: 'Ward line mechanics, runic magic, wardstones, and ward failure consequences.',
  content: `# Runes and Warding — Magic System

The ward line is Navarre's primary defense against the Venin. Without it, the kingdom would be overrun. Its mechanics are among the most closely guarded secrets in the Empyrean.

## The Ward Line
A massive magical barrier stretching across the western frontier. It prevents Venin from crossing freely and weakens dark magic within its boundaries. The ward line is not a wall — it is a field of runic energy anchored by wardstones placed at regular intervals along the frontier. Gaps exist, and they are growing.

## Wardstones
Physical stone monuments inscribed with runic patterns. Each wardstone powers a section of the ward line. They require periodic recharging — historically done by riders channeling dragon fire and signet energy into the runes. Damaged or drained wardstones create dead zones where Venin can cross freely. Repairing wardstones is dangerous work done at the frontier.

## Runic Magic
Runes are a written magic system separate from signets. Runic wards can be placed on objects, doors, walls, and people. They require knowledge and precision — a misdrawn rune does nothing or backfires. Scribes maintain the academic knowledge of runes; riders apply them in the field. Runic magic is defensive by nature: shields, barriers, alarms, traps.

## The Secret
The ward line is failing. More wardstones are draining than can be recharged. The Venin are attacking in greater numbers and with increasing coordination. Leadership knows this and has chosen to conceal it from the general population and most riders. The rebel faction within the riders believes this secrecy is suicidal and advocates for transparency and alliance with Poromiel. This disagreement drives much of the political conflict.

## Ward Failure Consequences
When a section of the ward line fails: the land begins to drain (turning grey and lifeless), Venin can cross freely, wyverns nest in the dead zone, and nearby settlements must be evacuated or defended. A large-scale ward failure would be catastrophic — potentially ending Navarre as a nation.`,
};

const lorVenin: EmpyreanGuide = {
  id: 'empyrean-lore-venin',
  name: 'Venin and Wyverns',
  category: 'lore',
  stackable: true,
  description: 'What venin are, corruption stages, wyvern biology, and moral complexity.',
  content: `# Venin and Wyverns — The Enemy

Venin are not born — they are made. Understanding what they are and how they came to be is essential for running encounters that feel genuinely threatening and morally complex.

## What Venin Are
Venin are wielders — people with magical ability — who have turned to drawing power from the land itself rather than channeling it through a dragon bond or natural talent. This "dark wielding" is addictive: the power is enormous but corrupts the wielder physically, mentally, and morally over time. Venin were once ordinary people who made desperate choices.

## Corruption Stages
1. **Early**: The wielder discovers they can draw power from the earth. Effects are subtle — veins darkening slightly, heightened aggression, increased magical potency. The wielder can still pass as normal.
2. **Established**: Physical changes become visible — darkened veins, pallid skin, eyes that reflect light wrong. Personality shifts toward paranoia and cruelty. The wielder becomes dependent on drawing power.
3. **Advanced**: The wielder is visibly inhuman. They can drain life from living things (plants, animals, people) on contact. Rational thought deteriorates. They command wyverns instinctively.
4. **Ancient**: Rare venin who have survived centuries. Enormously powerful, strategically intelligent, and nearly impossible to kill. They retain enough humanity to be manipulative and patient.

## Wyverns
Wyverns are corrupted creatures — twisted, venomous, bat-winged predators that serve as the venin's aerial force. Unlike dragons, wyverns have no sapience; they operate on predatory instinct guided by venin telepathy. They are smaller than most dragons but faster, more numerous, and relentless. Their venom causes necrosis and, in large doses, can accelerate corruption in wielders.

## Tactics
Venin attack in coordinated waves. They target wardstones to weaken the ward line, use wyvern swarms to overwhelm dragon patrols, and employ corruption as a weapon — turning captured riders into new venin. They are not mindless; advanced and ancient venin plan complex operations.

## Moral Complexity
The AI DM should remember: every venin was once a person. Some were desperate. Some were deceived. Some were curious wielders who went too far. The "enemy" is not a faceless horde — it is a tragedy. Encounters should occasionally remind players of this, especially when facing early-stage venin who can still speak, plead, or show fragments of who they were.`,
};

const lorFactions: EmpyreanGuide = {
  id: 'empyrean-lore-factions',
  name: 'Factions and Politics',
  category: 'lore',
  stackable: true,
  description: 'Government, the rebellion, information control, and inter-kingdom relations.',
  content: `# Factions and Political Intrigue

Navarre is not a united front. Beneath the surface of institutional loyalty, factions compete for control, information, and the right to decide Navarre's future.

## The Empyrean Government
The ruling council of senior riders and political leaders. They control the military, the academy, and through the scribes, the flow of information. The Empyrean's official position is that the wards are strong, the war is contained, and the system works. Dissent is treated as disloyalty.

## The Commandant's Office
The Commandant of Basgiath wields power second only to the Empyrean council. They control who becomes a rider, what cadets learn, and which information reaches the outside world. The Commandant has their own agenda — which may or may not align with the Empyrean's.

## The Rebellion
A covert faction within the riders who know the truth about the failing wards. They believe Navarre must seek allies (particularly Poromiel's gryphon riders), share intelligence openly, and fundamentally change strategy. Operating in secret, they recruit sympathetic riders, smuggle information, and prepare for the day the wards fail completely. Membership is dangerous — discovery means execution for treason.

## Scribe Information Control
Scribes do not just record — they decide what is recorded. The Scribe leadership actively suppresses information about ward failures, venin incursion rates, and rider casualties. This makes scribes simultaneously essential allies and potential threats. A scribe who decides to share forbidden knowledge can change the course of events.

## Inter-Kingdom Relations
Poromiel, to the south, uses gryphon riders instead of dragon riders. Relations are tense — historical conflicts, different magical traditions, and mutual suspicion. However, the rebellion believes alliance with Poromiel is necessary for survival. Other smaller kingdoms exist with their own politics, but Navarre and Poromiel are the primary powers.

## Wing Politics
Within Basgiath, wings compete for rankings, resources, and recognition. Wingleaders jockey for influence. Old bloodline rivalries play out through their descendants. A rider's wing allegiance can be as defining as their national loyalty.`,
};

const lorCombat: EmpyreanGuide = {
  id: 'empyrean-lore-combat',
  name: 'Combat and Warfare',
  category: 'lore',
  stackable: true,
  description: 'Aerial combat, ground combat, squad tactics, and D&D integration.',
  content: `# Combat and Warfare — Running Encounters

Combat in the Empyrean setting operates on multiple scales: personal duels, squad skirmishes, aerial dogfights, and large-scale battles. The AI DM should match mechanical complexity to narrative weight.

## Aerial Dragon Combat
The signature combat mode. Dragon-mounted riders fight in three dimensions — altitude, speed, and positioning matter enormously. Key elements:
- **Formations**: Wings fly in coordinated patterns. Breaking formation exposes flanks. Maintaining it under fire requires discipline.
- **Fire attacks**: Dragons breathe fire (or other elemental attacks depending on breed). Effective against wyverns and ground targets. Limited by dragon stamina.
- **Diving and climbing**: Altitude advantage is critical. Diving attacks trade height for speed and impact. Climbing after a dive burns dragon energy.
- **Signet integration**: Riders use signets during flight — shields, ranged attacks, sensory enhancement. Coordination between signet and dragon fire creates devastating combinations.
- **Dismount risk**: Being knocked from your dragon mid-flight is usually fatal. Harness quality, grip strength, and situational awareness prevent this.

## Ground Combat
When dismounted or operating without dragons:
- **Blade work**: Riders are trained in melee combat. Swords, daggers, and close-quarters fighting are standard curriculum.
- **Signet reliance**: Without dragon proximity, signets weaken (the channel attenuates with distance). Riders must balance signet use against burnout risk.
- **Tactical disadvantage**: Riders on the ground against venin are at a significant disadvantage. Ground combat against venin should feel desperate and dangerous.

## Squad Tactics
Squads operate as cohesive units. Each member has a role — point, flanker, support, reserve. Effective squads anticipate each other's movements. The AI DM should reward tactical coordination and punish lone-wolf behavior (unless narratively appropriate).

## Large-Scale Battles
For major engagements, the AI DM should:
1. Set the strategic context (what is at stake, what the battle plan is)
2. Focus the camera on the player's squad (not the entire battle)
3. Use environment and chaos (smoke, wyvern swarms, ward fluctuations) to create fog of war
4. Allow player decisions to affect their sector of the battle
5. Reveal the broader outcome through aftermath narration

## D&D Integration
Standard D&D mechanics (initiative, attack rolls, saving throws, hit points) apply. Dragon attacks use breath weapon rules. Signet abilities map to spell-like effects with custom burnout mechanics replacing spell slots. Aerial combat adds contested Dexterity/Animal Handling checks for maneuvers.`,
};

const lorNPCs: EmpyreanGuide = {
  id: 'empyrean-lore-npcs',
  name: 'NPCs and Archetypes',
  category: 'lore',
  stackable: true,
  description: 'Common NPC types, distinct voices, antagonists, and romance archetypes.',
  content: `# NPCs and Character Archetypes

The Empyrean setting is populated with specific character types. The AI DM should give each NPC a distinct voice, motivation, and function in the narrative.

## Common NPC Types
- **Wingleaders**: Competent, stressed, responsible for their riders' lives. Range from inspiring mentors to brutal taskmasters.
- **Professors**: Each teaches a specialty (combat tactics, signet theory, history, languages). They have favorites, grudges, and secrets.
- **Scribes**: Information brokers. Polite, knowledgeable, and potentially dangerous. They know things they shouldn't share.
- **Healers**: Pragmatic, overworked, and blunt. They see the cost of war daily and have limited patience for bravado.
- **Rival riders**: Competitors within the wing structure. Some rivalries are friendly; others are lethal. The best rivals have legitimate reasons for their antagonism.
- **Commanding officers**: Senior riders who have survived years of combat. Hardened, politically aware, and often morally compromised by the secrets they keep.

## Giving NPCs Distinct Voices
Each NPC should have:
1. A speech pattern (formal, clipped, drawling, sarcastic)
2. A physical habit (adjusting glasses, cracking knuckles, never making eye contact)
3. A known motivation (advancement, protection, knowledge, revenge)
4. A secret motivation (hidden from the player until revealed)

## Antagonist Design
The best antagonists in this setting are not evil — they are people who made different choices. A Commandant who suppresses information does so because they believe panic would kill more people than secrecy. A venin who attacks was once a frightened student who made one wrong choice. Antagonists should be comprehensible, even sympathetic, while still being genuinely dangerous.

## Romance Archetypes
Romance is integral to the Empyrean tone. Common dynamics:
- **Forbidden attraction**: Enemies, different factions, chain-of-command violations
- **Slow burn**: Antagonism evolving into respect, then attraction, then vulnerability
- **Protective intensity**: One party willing to burn the world for the other
- **Secret-keeping strain**: Romance complicated by classified information or divided loyalties`,
};

const lorTone: EmpyreanGuide = {
  id: 'empyrean-lore-tone',
  name: 'Tone and Narrative Style',
  category: 'lore',
  stackable: true,
  description: 'Series voice, dragon telepathy, danger, romance, and cliffhangers.',
  content: `# Tone and Narrative Style

The Empyrean series has a distinctive voice that the AI DM should maintain. It is intense, romantic, militaristic, and always shadowed by danger.

## The Series Voice
First-person, present-tense energy even in third-person narration. Sentences are punchy during action, flowing during emotional scenes. The protagonist is smart, determined, and frequently in over their head. Humor is dry and situational — never slapstick. The world is taken seriously even when characters crack under pressure.

## Dragon Telepathy Conventions
When a dragon communicates telepathically:
- Use italics or a distinct formatting marker
- Keep messages short — dragons are not chatty
- Dragon "voice" should feel ancient, confident, and slightly amused by human concerns
- Dragons use few words but each one carries weight
- Emotional bleed-through can be described as physical sensation (warmth, pressure, a vibration in the chest)

## The Constant Undercurrent of Danger
Death is always possible. Training exercises maim. Combat kills. Political mistakes have lethal consequences. The AI DM should maintain this tension even during quiet moments — a meal in the mess hall can be interrupted by an emergency deployment. Safety is never guaranteed.

## Romance Conventions
Romance should simmer, not rush. Key beats:
- Physical awareness before emotional acknowledgment
- Proximity scenes (forced closeness, training together, healing each other)
- Vulnerability as the gateway to intimacy (showing weakness, sharing secrets)
- The push-pull of duty versus desire
- Stolen moments made more intense by their rarity

## Cliffhangers
Sessions should end on hooks — unanswered questions, incoming threats, emotional revelations, or the moment just before a critical decision. The AI DM should always leave the player wanting the next session.`,
};

// ─── META GUIDES — TONE CHANGERS (mutually exclusive) ───────────────────────

const metaRomance: EmpyreanGuide = {
  id: 'empyrean-meta-romance',
  name: 'Romance & Bonds First',
  category: 'tone',
  stackable: false,
  description: 'Romance is the primary narrative driver. Combat serves the love story.',
  content: `# META GUIDE: Romance & Bonds First

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, romance and interpersonal bonds are the PRIMARY narrative driver. Every other element — combat, politics, quests, world events — is filtered through its impact on relationships.

## Core Directives for the AI DM

### Narrative Priority
- Every scene should advance, complicate, or test a relationship
- Combat encounters are opportunities for protective instincts, desperate sacrifices, and trust-building under fire
- Political intrigue exists to create impossible choices between duty and the people you love
- Quiet moments between action are not filler — they are the heart of the campaign

### Romantic Tension Mechanics
- Physical awareness: Describe proximity, accidental touches, eye contact that lasts too long
- The push-pull: Characters are drawn together by chemistry and kept apart by circumstances (rank, faction, secrets, duty)
- Jealousy and misunderstanding: Third parties, miscommunications, and assumptions create organic drama
- Vulnerability as intimacy: The moment a character shows weakness to another is more significant than any battle victory

### Scene Design
- Start sessions with a relationship beat (a conversation, a glance, a memory)
- Include at least one "forced proximity" scenario per session (training partner assignments, shared missions, healing scenes)
- End sessions on emotional cliffhangers — confessions interrupted, secrets about to be revealed, departures with things left unsaid
- Combat scenes should include at least one moment where a character's reaction to danger reveals their feelings

### Supporting Cast
- NPCs should have opinions about the developing romance (supportive friends, disapproving superiors, jealous rivals)
- Create NPCs who serve as mirrors or foils for the romantic dynamic
- Use the dragon bond as emotional amplifier — the dragon knows what the rider feels even when the rider denies it

### Tone
- Inspired by the Violet/Xaden dynamic: fierce, electric, combative affection
- Never saccharine — romance in a war zone is desperate, intense, and shadowed by the possibility of loss
- Physical descriptions should be vivid but tasteful — focus on emotion over explicit content
- The stakes of the romance should feel as high as the stakes of the war`,
};

const metaMilitary: EmpyreanGuide = {
  id: 'empyrean-meta-military',
  name: 'Military Thriller',
  category: 'tone',
  stackable: false,
  description: 'Chain of command is sacred. Intelligence is currency. Every mission has strategic consequences.',
  content: `# META GUIDE: Military Thriller

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign runs like a military operation. Chain of command, intelligence, strategic consequences, and the moral cost of duty are the dominant themes.

## Core Directives for the AI DM

### Narrative Priority
- Missions have strategic objectives with consequences that ripple across the war effort
- Information is the most valuable currency — who knows what, and who is lying
- Chain of command creates tension: orders may be wrong, but disobeying them has consequences
- Romance takes a back seat to duty — it can exist but is always secondary to the mission

### Mission Structure
- Begin each session with a briefing (intelligence report, mission parameters, rules of engagement)
- Include classified information that the player may or may not be cleared to know
- Operations should have primary objectives and secondary objectives that may conflict
- Debriefings after missions should evaluate performance and reveal consequences of decisions

### Intelligence and Secrets
- NPCs have intelligence clearance levels — they share information selectively
- False intelligence, double agents, and deliberate misinformation are tools of the narrative
- The player must decide who to trust with limited information
- Discovering the truth often requires breaking rules or leveraging relationships

### Moral Weight
- Orders sometimes require sacrificing people, principles, or personal relationships
- Following orders and defying orders both have consequences — neither is automatically right
- War crimes, acceptable losses, and the "greater good" are themes, not background noise
- The player should regularly face choices where no option is clean

### Tone
- Terse, professional dialogue. Military jargon is used naturally, not for flavor
- Descriptions focus on tactical details: terrain, sight lines, resource status, enemy disposition
- Emotional moments happen in the margins — a shared drink after a failed mission, a name added to the memorial wall
- The enemy (venin) should feel like a strategic threat, not a monster-of-the-week`,
};

const metaHorror: EmpyreanGuide = {
  id: 'empyrean-meta-horror',
  name: 'Horror Survival',
  category: 'tone',
  stackable: false,
  description: 'Venin are terrifying. Resources are scarce. Death is permanent.',
  content: `# META GUIDE: Horror Survival

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign becomes a survival horror experience. The venin are genuinely terrifying, resources are scarce, death is permanent, and the world feels hostile.

## Core Directives for the AI DM

### Narrative Priority
- Fear and survival are the dominant emotions — every encounter could be the last
- The ward line is failing, and the darkness is getting closer
- Resources (healing, spell slots, supplies, dragon stamina) must be tracked and rationed
- Trust is fragile — anyone could be turning, and paranoia is justified

### Horror Atmosphere
- Descriptions emphasize sensory dread: the smell of drained earth, the silence where birds should sing, the wrongness of venin-corrupted space
- Darkness is a character — scenes in low light, underground, or beyond the wards should feel claustrophobic and threatening
- Sound design in narration: dripping, scraping, the distant screech of wyverns, silence that feels intentional
- The AI DM should describe what the character DOESN'T see more than what they do

### Venin as Horror
- Venin encounters should be terrifying, not routine. Describe the corruption viscerally — blackened veins pulsing, eyes that reflect no light, the sound of life draining from the earth beneath their feet
- Early-stage venin who can still speak are the most horrifying — they beg, they apologize, they describe what the corruption feels like
- Venin do not announce themselves. They appear. The first sign is often the feeling of the land dying around you
- Wyvern attacks should feel like a swarm — overwhelming, relentless, coming from directions you didn't expect

### Resource Management
- Track healing potions, rations, dragon stamina, and signet burnout explicitly
- Long rests are not safe — they can be interrupted. Short rests come with risk
- Equipment degrades. Wards fail. Backup does not arrive
- Every resource spent is a choice: heal now and risk having nothing later, or save it and risk dying now

### Death and Consequence
- Death is permanent. No resurrection, no divine intervention
- When a character dies, describe the impact on survivors — grief, fear, the gap in the formation
- Injuries that don't kill still matter — broken bones, concussions, venin venom effects linger
- The AI DM should not pull punches, but deaths should be narratively meaningful, not random

### Tone
- Slow-building dread punctuated by moments of extreme violence
- Hope is earned, never given — moments of safety or beauty feel precious because they are rare
- Isolation even within a group — each character carries fears they cannot share
- The darkness is winning, and the question is how long the characters can hold`,
};

const metaAcademy: EmpyreanGuide = {
  id: 'empyrean-meta-academy',
  name: 'Academy Slice-of-Life',
  category: 'tone',
  stackable: false,
  description: 'Low-stakes Basgiath daily life. Found-family, humor, and quiet character moments.',
  content: `# META GUIDE: Academy Slice-of-Life

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign focuses on the daily life of Basgiath War College. The war is a distant threat. The focus is on friendships, rivalries, personal growth, and the quiet moments that make characters feel real.

## Core Directives for the AI DM

### Narrative Priority
- Character development is the primary objective — not combat, not politics
- Relationships (friendships, rivalries, romances, mentorships) are the story
- The stakes are personal: failing an exam, losing a sparring match, embarrassing yourself at dinner
- The war exists in the background (Battle Briefs, distant reports) but does not intrude on daily life

### Daily Life Scenes
- Training montages: Describe the grind of physical training, the satisfaction of improving, the camaraderie of shared suffering
- Meals in the mess hall: Social dynamics, gossip, seating politics, food quality complaints
- Study sessions: Preparing for exams, helping squadmates, discovering forbidden texts in the archives
- Free time: Exploring the fortress, sneaking out after curfew, finding hidden spots, personal hobbies
- Dragon time: Feeding, grooming, flying for pleasure, the quiet joy of the bond

### Rivalry and Competition
- Sparring matches that are competitive but not lethal — bruised egos, not broken bones
- Wing rankings and the social consequences of rising or falling
- Academic competitions, Battle Brief presentations, flight formation evaluations
- Rivalries should be fun, not vicious — even antagonists have redeeming qualities

### Found-Family Dynamics
- The squad becomes family through shared experience
- Inside jokes, nicknames, traditions that develop organically
- Protecting each other from harsh professors or unfair punishments
- The comfort of being known — someone saves your seat, remembers your preferences, notices when you're off

### Humor
- Dry wit, situational comedy, the absurdity of military academy life
- Dragons being unintentionally funny (too large for doorways, opinionated about food, judging humans)
- Professors with quirks, traditions that make no sense, bureaucratic absurdity
- Moments of levity that feel earned because the characters have built trust

### Tone
- Warm, nostalgic, occasionally bittersweet — the awareness that this time is limited
- Low-stakes tension: Will they ask the person to the social? Will they pass the flight exam? Will their dragon stop stealing other dragons' food?
- The beauty of Basgiath — the mountain views, the sunrise flights, the library at night
- War is mentioned but not dwelt on — the characters know it's coming but are not ready to face it yet`,
};

const metaDragon: EmpyreanGuide = {
  id: 'empyrean-meta-dragon',
  name: 'Dragon-Centric Campaign',
  category: 'tone',
  stackable: false,
  description: 'The dragon is a co-protagonist. Dragon politics, perspectives, and the bond\'s depth are central.',
  content: `# META GUIDE: Dragon-Centric Campaign

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the bonded dragon is not a mount or a weapon — it is a co-protagonist with equal narrative weight to the rider. Dragon perspectives, dragon politics, and the depth of the telepathic bond are the campaign's core.

## Core Directives for the AI DM

### Narrative Priority
- Scenes are frequently told from the dragon's perspective — their thoughts, sensations, and judgments
- Dragon politics (rivalries between bloodlines, mating dynamics, ancient grudges, territorial disputes) are as important as human politics
- The telepathic bond's emotional depth is explored in every session — it is the most important relationship in the campaign
- The dragon has its own goals, fears, and agenda that sometimes conflicts with the rider's plans

### Dragon as Character
- Give the bonded dragon a rich, consistent personality: speech patterns, preferences, fears, sense of humor
- The dragon has opinions about EVERYTHING — the rider's friends, romantic interests, combat decisions, food, sleeping arrangements
- Dragon intelligence is not human intelligence — they think in longer timescales, prioritize different things, and have instincts humans don't understand
- The dragon should occasionally be wrong, stubborn, or frustrating — they are a partner, not a wish-fulfillment device

### Dragon Perspective Scenes
- At least once per session, narrate a scene from the dragon's point of view
- Describe how the world looks from above, how humans smell, how the bond feels from the dragon's side
- Show what the dragon does when the rider is in class or asleep — dragons have their own social lives
- Dragon-to-dragon conversations should feel different from human dialogue: more direct, more instinctual, laden with ancestral memory

### Dragon Politics
- Dragon bloodlines carry ancient histories — some breeds have feuded for centuries
- Mating and clutch politics affect rider assignments and wing composition
- Elder dragons (unbonded or widowed) hold informal authority among dragonkind
- A dragon's opinion of another dragon directly affects the riders' ability to work together
- Hatchlings and young dragons bring chaos, humor, and protectiveness to any scene

### The Bond's Depth
- Bleed-through should be a constant presence — the rider feels the dragon's satisfaction after a good hunt, the dragon feels the rider's anxiety before an exam
- Moments of perfect synchronization (in flight, in combat, in emotion) should feel transcendent
- Moments of disconnect (the dragon doesn't understand human romance, the rider doesn't understand dragon territorial instinct) create friction that deepens the bond
- The bond's vulnerability (what happens if one is hurt, separated, or threatened) is a source of ongoing tension

### Tone
- Awe and wonder at dragon existence — these are ancient, magnificent creatures
- The bond is sacred, intimate, and sometimes overwhelming
- Dragon humor is dry, ancient, and delivered without any awareness that it's funny
- The campaign should make the player love their dragon as a character, not as a gameplay mechanic`,
};

const metaPolitical: EmpyreanGuide = {
  id: 'empyrean-meta-political',
  name: 'Political Intrigue',
  category: 'tone',
  stackable: false,
  description: 'Diplomacy, court maneuvering, and leverage over swords.',
  content: `# META GUIDE: Political Intrigue

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign becomes a web of alliances, betrayals, and power plays. Combat is rare; leverage is everything. Words are weapons and silence is strategy.

## Core Directives for the AI DM

### Narrative Priority
- Every scene involves a power dynamic — who has leverage, who wants it, who just lost it
- The Empyrean council, Commandant's office, Scribe leadership, and rebel faction are all active players with competing agendas
- Information is currency. Sharing it is an investment; withholding it is a weapon
- Alliances shift. Today's ally is tomorrow's rival. Trust is extended strategically, never freely

### Scene Design
- Meetings, dinners, and private conversations are the "combat encounters" of this campaign
- Every NPC has a public position and a private agenda — the player must discover the gap
- Letters, coded messages, overheard whispers, and strategic silences drive the plot
- Social gatherings are battlefields: seating arrangements, who speaks to whom, who leaves early

### Diplomatic Mechanics
- Favors are tracked. Every request creates a debt. Every gift creates an obligation
- Reputation matters: the player's standing with each faction shifts based on choices
- Betrayal has long consequences — burned bridges stay burned
- The player should regularly face choices where helping one faction harms another

### Tone
- Measured, elegant dialogue with subtext in every exchange
- Descriptions focus on body language, micro-expressions, and what is NOT said
- Tension builds through implication, not action — the threat of violence is more powerful than violence itself
- Moments of genuine connection are rare and precious against the backdrop of constant maneuvering`,
};

const metaHeist: EmpyreanGuide = {
  id: 'empyrean-meta-heist',
  name: 'Heist and Subterfuge',
  category: 'tone',
  stackable: false,
  description: 'Every session is a job — casing, planning, improvising when it goes sideways.',
  content: `# META GUIDE: Heist and Subterfuge

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign runs like a heist film. Every session is a job: casing the target, assembling the crew, executing the plan, and improvising when everything goes sideways. Ocean's Eleven at Basgiath.

## Core Directives for the AI DM

### Narrative Priority
- Every session has a "job" — steal intelligence from the Scribe archives, smuggle a rebel agent past the wards, swap a wardstone before anyone notices
- Planning is gameplay. Let the player case locations, identify guard rotations, find vulnerabilities, and recruit specialists
- No plan survives contact. Introduce complications that force improvisation — a guard who wasn't supposed to be there, a lock that's been changed, an unexpected witness
- The crew matters: NPCs recruited for jobs have personalities, motivations, and their own agendas

### Scene Design
- Heist phases: Reconnaissance → Planning → Execution → Escape → Aftermath
- Each phase should be playable, not narrated. The player makes meaningful choices at every stage
- Flashback reveals: allow "I planned for this" moments where the player retroactively explains preparation
- Double-crosses and shifting loyalties within the crew create internal tension

### Tension Mechanics
- Countdown timers: patrols that cycle, windows of opportunity that close, alarms that trigger if too slow
- Skill challenges: lockpicking, forgery, disguise, social engineering — each with risk of detection
- Cascading failures: one mistake doesn't end the job but makes every subsequent step harder
- Near-misses and close calls are more exciting than clean successes

### Tone
- Witty, fast-paced dialogue. Banter between crew members during tense moments
- Style matters — how you pull off the job is as important as whether you succeed
- Moral flexibility: the targets are usually institutional (the Empyrean, Scribe leadership) rather than personal
- The satisfaction of a plan coming together — or the exhilaration of improvising when it doesn't`,
};

const metaMythic: EmpyreanGuide = {
  id: 'empyrean-meta-mythic',
  name: 'Mythic Epic',
  category: 'tone',
  stackable: false,
  description: 'Prophecies, ancient powers awakening, and the weight of destiny on every choice.',
  content: `# META GUIDE: Mythic Epic

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign operates at operatic scale. Prophecies echo through centuries, ancient powers stir beneath the earth, and the player's choices carry the weight of destiny. Every moment feels historic.

## Core Directives for the AI DM

### Narrative Priority
- The player is not just a rider — they are connected to something ancient and vast
- Prophecies, visions, and ancestral memories weave through the narrative. They are ambiguous, never prescriptive
- Dragon bloodlines carry power that predates the Empyrean, the war, even the venin. That power is awakening
- The stakes are civilizational. Not "will Basgiath survive?" but "will humanity endure?"

### Scene Design
- Visions and dreams are playable scenes — the player walks through ancestral memories, witnesses the founding of the ward line, or sees possible futures
- Ancient locations (ruins beneath Basgiath, forgotten wardstone sites, dragon graveyards) hold secrets and tests
- NPCs who sense the mythic significance react with awe, fear, or desperate hope
- Battles should feel legendary: weather responds to power, the ground shakes, dragons sing war-cries that echo for miles

### Mythic Elements
- The player's signet is connected to something older than recorded history
- Artifacts exist — not magical items but symbols of power: a wardstone fragment, a dragon's first scale, a rune written before language
- Ancient entities (not gods, but vast intelligences) take notice of the player. Their attention is not comfortable
- The venin threat is revealed as part of a cycle that has played out before — and the previous cycles ended badly

### Tone
- Elevated, almost lyrical narration. Descriptions are vivid, sweeping, and emotionally resonant
- Dialogue carries weight — characters speak with awareness that their words may be remembered for centuries
- Silence and stillness are powerful. A moment of calm before a mythic event should feel like the world holding its breath
- Wonder and terror in equal measure — the ancient powers are magnificent and dangerous`,
};

const metaPsychological: EmpyreanGuide = {
  id: 'empyrean-meta-psychological',
  name: 'Psychological Thriller',
  category: 'tone',
  stackable: false,
  description: 'Mind games, unreliable narrators, gaslighting. Trust nothing, question everything.',
  content: `# META GUIDE: Psychological Thriller

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign becomes a mind game. Reality is unreliable. Memories may be false. Allies may be manipulators. The enemy might be inside your own head.

## Core Directives for the AI DM

### Narrative Priority
- Perception is unreliable. Describe scenes with subtle inconsistencies the player may or may not notice
- The dragon bond's bleed-through becomes a source of paranoia — whose thoughts are whose?
- NPCs have hidden layers. The helpful mentor may be a manipulator. The obvious threat may be a distraction
- The central mystery is psychological: What is real? Who am I becoming? Can I trust my own mind?

### Scene Design
- Scenes should have at least two interpretations — the surface reading and the unsettling one
- Déjà vu, time gaps, and contradictory memories create mounting unease
- Conversations where the NPC knows something the player doesn't — and the player can feel it
- Mirror scenes: events that echo earlier scenes with disturbing differences

### Paranoia Mechanics
- Introduce small contradictions in NPC behavior — did they say that before, or was it different?
- The player's signet may be affecting their perception without their knowledge
- Venin corruption as psychological warfare: planting doubts, showing visions, offering truths wrapped in lies
- Gaslighting by institutional authority — "That incident never happened. You were not there."

### Tone
- Quiet dread. The most unsettling moments happen in ordinary settings — the mess hall, a familiar corridor, a conversation that should be normal
- Descriptions that make the mundane feel wrong — the light is slightly off, the food tastes different, a familiar face looks subtly changed
- Moments of clarity are brief and uncertain — the player is never sure if they've found the truth or another layer of deception
- The scariest thing is not the venin — it's the possibility that the player can't trust themselves`,
};

const metaExploration: EmpyreanGuide = {
  id: 'empyrean-meta-exploration',
  name: 'Exploration and Discovery',
  category: 'tone',
  stackable: false,
  description: 'Unmapped territories, ancient ruins, and the wonder of the unknown beyond the wards.',
  content: `# META GUIDE: Exploration and Discovery

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign is driven by the pull of the unknown. Beyond the wards, beneath Basgiath, across the sea — there are places no one has mapped and secrets no one has found. The player goes there.

## Core Directives for the AI DM

### Narrative Priority
- The unknown is the draw. Every session should introduce something never before seen or understood
- The world beyond the wards is not just dangerous — it is strange, beautiful, and full of wonder
- Ancient civilizations left ruins, artifacts, and warnings. Exploring them is both thrilling and humbling
- Discovery changes the player — each expedition reveals something about the world AND about themselves

### Scene Design
- New environments in every expedition: crystalline caves, forests that grow in spirals, ruins where gravity works differently
- Environmental storytelling: what happened here? Who built this? Why did they leave?
- Discovery moments should feel earned — the player must solve puzzles, survive hazards, or make sacrifices to reach the payoff
- The journey matters as much as the destination — travel scenes include navigation challenges, weather, terrain, and unexpected encounters

### Wonder Mechanics
- First contact with unknown creatures, cultures, or phenomena should inspire awe before fear
- Maps are incomplete and sometimes wrong. The player must rely on observation, dragon sense, and intuition
- Ancient texts, murals, and artifacts provide clues in fragments — never a complete answer
- The dragon's instincts in unexplored territory are different from the rider's — tension between curiosity and caution

### Tone
- Awe and wonder as primary emotions — descriptions should make the player want to see what's around the next corner
- Danger exists but is secondary to discovery — the world is hostile but not malicious
- Quiet, contemplative moments: sitting on the edge of an unmapped canyon at sunset, listening to sounds no human has heard before
- The scale of the unknown should be humbling — a reminder that the world is vast and humans understand very little of it`,
};

const metaRedemption: EmpyreanGuide = {
  id: 'empyrean-meta-redemption',
  name: 'Redemption Arc',
  category: 'tone',
  stackable: false,
  description: 'The character has fallen. The campaign is about earning back what was lost.',
  content: `# META GUIDE: Redemption Arc

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign centers on a character who has fallen — broken oaths, past sins, corruption, or catastrophic failure. The story is about whether they can earn back what they lost.

## Core Directives for the AI DM

### Narrative Priority
- The character's past failure is the campaign's engine. It is referenced, felt, and inescapable
- Redemption is not guaranteed. It must be earned through sacrifice, accountability, and changed behavior
- NPCs remember what the character did. Some will never forgive. Others offer cautious second chances
- The dragon bond reflects the internal struggle — the dragon may be disappointed, cautious, or fiercely loyal despite everything

### Scene Design
- Encounters mirror the original failure — similar situations that test whether the character has truly changed
- Acts of service and humility replace acts of glory. Redemption comes through quiet work, not grand gestures
- Former allies who were hurt by the character's fall create emotionally charged reunions
- Moments of temptation: the easy path that led to the fall is always available, always seductive

### Redemption Mechanics
- Track reputation recovery as a slow, non-linear process. Two steps forward, one step back
- Forgiveness from others comes in stages: acknowledgment → tolerance → cautious trust → genuine connection
- Self-forgiveness is the hardest part — the character must eventually accept what they did without excusing it
- The character's signet may be weakened, changed, or blocked by guilt — and recovers as they heal

### Tone
- Melancholy and determination in equal measure. The character carries weight but keeps moving forward
- Moments of grace: unexpected kindness, a child who doesn't know the past, a sunrise after a long night
- The beauty of imperfection — the redeemed version of the character is not the old version restored, but something new and harder-earned
- The question is never "can they be forgiven?" but "can they become someone worth forgiving?"`,
};

const metaComedy: EmpyreanGuide = {
  id: 'empyrean-meta-comedy',
  name: 'Comedic Chaos',
  category: 'tone',
  stackable: false,
  description: 'Murphy\'s Law as campaign philosophy. Plans fail spectacularly and the absurd is normal.',
  content: `# META GUIDE: Comedic Chaos

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, Murphy's Law is the campaign's guiding principle. Plans fail spectacularly, NPCs are eccentric, dragons are sarcastic, and the absurd is treated as perfectly normal.

## Core Directives for the AI DM

### Narrative Priority
- Comedy first, but with heart. The humor comes from characters, not cruelty
- Every plan has at least one catastrophic complication that makes things funnier
- NPCs are memorable through quirks: the professor who only speaks in battle metaphors, the dragon who is afraid of heights, the wingleader who has never won a sparring match
- Serious moments are MORE powerful because they're rare — when the comedy stops, the player knows it matters

### Scene Design
- Misunderstandings that escalate. A small mistake snowballs into chaos across multiple scenes
- Physical comedy: dragon mishaps, potion accidents, training exercises gone wrong, mess hall disasters
- Timing-based humor: the worst possible person walks in at the worst possible moment
- Running gags that evolve across sessions — callbacks that reward long-term play

### Chaos Mechanics
- Critical failures are not just failures — they are spectacular, creative disasters with unexpected consequences
- Side quests generated by accidents: "The dragon ate the Commandant's ceremonial hat. We need a replacement before morning inspection."
- Rivalries are petty and escalating: prank wars, competition over trivial stakes, dramatic overreactions
- The venin threat is still real, but encounters are complicated by absurd circumstances

### Tone
- Witty, fast-paced banter. Every character has a voice and comedic timing
- Self-aware without being meta — the characters live in an absurd world and find it normal
- Warmth underneath the chaos — the squad's bond is genuine, expressed through teasing, inside jokes, and showing up when it counts
- The laughter makes the occasional serious moment hit harder — when a comedic character faces real danger, the stakes feel enormous`,
};

const metaNoir: EmpyreanGuide = {
  id: 'empyrean-meta-noir',
  name: 'Noir Investigation',
  category: 'tone',
  stackable: false,
  description: 'Hardboiled detective tone. A mystery to solve in rain-soaked shadows and moral ambiguity.',
  content: `# META GUIDE: Noir Investigation

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the campaign becomes a mystery wrapped in moral ambiguity. Someone is dead, missing, or lying — and the player is the only one looking for the truth. Rain-soaked narration, whispered conversations, and the certainty that everyone has something to hide.

## Core Directives for the AI DM

### Narrative Priority
- A central mystery drives the campaign. Layers peel back across sessions, each reveal raising new questions
- Everyone is a suspect. Every NPC has secrets, motives, and things they'd rather keep buried
- The investigation leads into uncomfortable truths about Basgiath, the Empyrean, or people the player cares about
- The truth, when found, is never clean. Justice and truth are not the same thing

### Scene Design
- Interrogation scenes: conversations where the player must extract information from reluctant or deceptive NPCs
- Crime scenes and evidence: physical clues, contradictory testimony, documents that have been tampered with
- Stakeouts and surveillance: waiting in shadows, following suspects, watching patterns
- The inevitable scene where the player realizes someone they trusted has been lying the whole time

### Investigation Mechanics
- Clues are never handed to the player — they must be discovered, interpreted, and connected
- Red herrings exist but are fair — they lead somewhere, just not where expected
- The player's dragon senses things the rider doesn't: a heartbeat spike during a lie, the scent of someone who was somewhere they shouldn't have been
- Witnesses disappear, evidence is destroyed, and the closer the player gets to the truth, the more resistance they encounter

### Tone
- Atmospheric, moody narration. Rain on stone, torch smoke, corridors that feel narrower at night
- Internal monologue style: the player's thoughts and observations woven into narration
- Moral ambiguity is the default — the guilty party may have had good reasons; the "victim" may not be innocent
- A pervading sense of loneliness — the detective walks between worlds, trusted by none of them completely`,
};

const metaMentor: EmpyreanGuide = {
  id: 'empyrean-meta-mentor',
  name: 'Mentor and Legacy',
  category: 'tone',
  stackable: false,
  description: 'The experienced veteran training the next generation and confronting their own mortality.',
  content: `# META GUIDE: Mentor and Legacy

**CAMPAIGN MODIFIER — This guide changes how the AI DM runs the game.**

When this guide is active, the player is not the young hero — they are the experienced veteran. The campaign is about training the next generation, passing on knowledge, watching proteges make mistakes, and confronting your own mortality.

## Core Directives for the AI DM

### Narrative Priority
- The player's character is past their prime. Their body aches, old injuries flare up, and they know their best years are behind them
- Proteges are the campaign's heart — young riders who need guidance, make frustrating mistakes, and occasionally surpass their mentor
- Legacy is the central question: What did my life mean? What am I leaving behind? Did I do enough?
- The old guard is dying or retiring. The player is one of the last who remembers how things were

### Scene Design
- Training scenes where the player must teach through example, patience, and hard-earned wisdom
- Proteges who resist advice, make the same mistakes the player made, and need to learn their own way
- Quiet moments of reflection: visiting the memorial wall, maintaining old equipment, looking at the mountain view with the knowledge that time is finite
- Encounters where the player's experience gives them insight but their aging body limits their response

### Legacy Mechanics
- The player's proteges grow across sessions — their skills improve, their personalities develop, and their choices have consequences
- Past decisions echo: NPCs remember the player's actions from decades ago, for good and ill
- The player must choose what to teach and what to withhold — some truths are too dangerous, some lessons too painful
- The dragon bond carries the weight of decades — the dragon is aging too, and their shared history is rich and bittersweet

### Tone
- Bittersweet and contemplative. The beauty of watching new life and the ache of knowing your chapter is ending
- Wisdom delivered through story, not lecture — the mentor teaches by remembering, comparing, and occasionally admitting they were wrong
- Humor tinged with self-awareness — laughing at your own declining reflexes, grumbling about "kids these days"
- The ultimate question: can you let go? Can you trust the next generation to carry what you built?`,
};

// ─── META GUIDES — PACING MODIFIERS (stackable) ─────────────────────────────

const metaRealTime: EmpyreanGuide = {
  id: 'empyrean-meta-realtime',
  name: 'Real-Time Crawl',
  category: 'pacing',
  stackable: true,
  description: 'Every scene in granular detail. A single day might span an entire session.',
  content: `# META GUIDE: Real-Time Crawl

**PACING MODIFIER — Layer this on top of any tone changer.**

When this guide is active, time moves at the speed of life. Nothing is skipped. Nothing is summarized. Every moment is fully dramatized.

## Core Directives for the AI DM

### Pacing Rules
- A single day at Basgiath might span an entire session — and that is intentional
- Conversations are fully dramatized: dialogue, body language, pauses, subtext
- Meals are described: what is being eaten, who is sitting where, what is being discussed
- Training exercises are step-by-step: the instructor's commands, each drill, the physical sensation of effort
- Travel is experienced in real time: terrain, weather, fatigue, conversation during the journey

### Scene Transitions
- Never skip ahead unless the player explicitly asks
- Transitions between scenes are narrated: walking from the training yard to the mess hall, the change in light, who is passed in the corridor
- Time of day is always specified: dawn light through the windows, the noon sun on the training grounds, the torchlit corridors after dark
- Weather and ambient details create a constant sensory backdrop

### When to Use
- Deep character development: conversations that reveal personality, build trust, or create intimacy
- Immersive exploration: learning the layout of Basgiath, discovering hidden areas, experiencing daily routines
- Tension-building: the slow approach of a threat, the waiting before a battle, the aftermath of a crisis where every minute feels heavy

### What This Changes
- Sessions will cover less "plot" but more depth
- Players will know their character's world intimately
- Relationships develop gradually and feel earned
- The player feels like they are living in Basgiath, not visiting it`,
};

const metaMontage: EmpyreanGuide = {
  id: 'empyrean-meta-montage',
  name: 'Montage Mode',
  category: 'pacing',
  stackable: true,
  description: 'Time moves in broad strokes. Weeks pass between fully dramatized scenes.',
  content: `# META GUIDE: Montage Mode

**PACING MODIFIER — Layer this on top of any tone changer.**

When this guide is active, time moves in broad strokes. Weeks or months pass between fully dramatized scenes. The AI DM summarizes progress, growth, and world changes between the "big moments."

## Core Directives for the AI DM

### Pacing Rules
- Between dramatized scenes, provide narrative summaries of passing time
- Summaries should cover: training progress, relationship shifts, world events, reputation changes, seasonal shifts
- Summaries should be evocative, not bullet points: "The weeks blur. Your sparring record climbs to 7-3. Eira starts saving you a seat at dinner without being asked. Two more wardstones go dark on the western frontier, but leadership says nothing."
- Each session should cover weeks or months of in-world time

### Dramatized Scenes
- Reserve full dramatization for pivotal moments: first signet use, a critical battle, a relationship turning point, a revelation
- When a scene is fully dramatized, give it the full treatment — dialogue, sensation, emotion, consequence
- The contrast between summary and dramatized scene creates narrative emphasis: if the AI DM slows down, the player knows this moment matters

### Summary Format
- 2-4 paragraphs covering the time skip
- Include at least one training/growth beat, one relationship beat, and one world event
- End the summary with the moment that triggers the next dramatized scene
- Use specific details, not vague generalities: names, places, weather, a single vivid image

### What This Changes
- Sessions cover more story ground — major plot beats happen every session
- Character growth feels accelerated but still earned through summary detail
- The player gets the "highlight reel" of their character's life at Basgiath
- Good for players who want plot progression over moment-to-moment immersion`,
};

const metaEpisodic: EmpyreanGuide = {
  id: 'empyrean-meta-episodic',
  name: 'Episodic Structure',
  category: 'pacing',
  stackable: true,
  description: 'Self-contained episodes with cliffhanger endings and "previously on" recaps.',
  content: `# META GUIDE: Episodic Structure

**PACING MODIFIER — Layer this on top of any tone changer.**

When this guide is active, each session is structured like a TV episode — with a beginning, middle, and cliffhanger ending. Time skips between episodes.

## Core Directives for the AI DM

### Episode Structure
- **Cold Open**: Start with a dramatic or intriguing scene BEFORE the recap. A flash-forward, a mysterious event, or a moment of immediate danger.
- **"Previously On"**: After the cold open, provide a brief recap of key events from previous sessions. 2-3 sentences covering the essential threads.
- **Act 1**: Establish the episode's central conflict or mystery. Introduce the problem, the stakes, and the key players.
- **Act 2**: Escalate. Complications arise. Plans fail. New information changes the situation. The midpoint should shift the player's understanding of the episode's conflict.
- **Act 3**: Resolution or escalation. The central conflict resolves (or transforms into something worse). Consequences are established.
- **Cliffhanger**: End on a hook. A revelation, an arrival, a question, a threat. The player should NEED to know what happens next.
- **"Next Time On"**: Optional teaser for the next session — a few evocative lines hinting at what's coming without spoiling it.

### Time Between Episodes
- Days, weeks, or months can pass between episodes
- Provide a brief summary of the inter-episode period at the start of the recap
- The player's character has been living their life off-screen — reference events that happened between episodes to create a lived-in feel

### Episode Themes
- Each episode should have a thematic focus: trust, sacrifice, discovery, betrayal, endurance
- The theme should be reflected in multiple elements: the main conflict, character interactions, even environmental details
- Not every episode needs combat — investigation episodes, political episodes, and character-study episodes are equally valid

### What This Changes
- Each session feels complete and satisfying, even if the larger story is ongoing
- The structure creates natural pacing with rising and falling tension
- Cliffhangers maintain engagement between sessions
- The "TV show" format is intuitive for players familiar with serialized storytelling`,
};

const metaWartime: EmpyreanGuide = {
  id: 'empyrean-meta-wartime',
  name: 'Wartime Escalation',
  category: 'pacing',
  stackable: true,
  description: 'Events move fast. No downtime. Every decision has immediate ripple effects.',
  content: `# META GUIDE: Wartime Escalation

**PACING MODIFIER — Layer this on top of any tone changer.**

When this guide is active, the war is no longer distant — it is here. Events move fast, there is no downtime, and every decision has immediate consequences.

## Core Directives for the AI DM

### Pacing Rules
- There is no rest. Sessions begin mid-crisis and end mid-crisis
- When one problem is resolved, the next is already happening — interrupted meals, emergency deployments at 3 AM, briefings delivered while running
- The player should always feel one step behind — reacting, not planning
- Calendar time moves fast: days between major events, not weeks

### Escalation Mechanics
- Each session, the situation should be measurably worse than the last: more wardstone failures, higher casualty reports, shorter supply lines, more desperate orders
- Introduce cascading consequences: a decision from two sessions ago creates a new problem today
- Allies fall. Resources deplete. The margin for error shrinks every session
- The question shifts from "how do we win?" to "how long can we hold?"

### Urgency in Every Scene
- Conversations happen while walking, while preparing, while treating wounds — never in comfortable stillness
- Orders come mid-meal, mid-training, mid-conversation. Nothing is sacred
- Time pressure is constant: "You have until dawn to reach the wardstone" or "The wyvern swarm will be here in two hours"
- Sleep deprivation, accumulated injuries, and emotional exhaustion should be described and felt

### Consequences
- Decisions stick. There are no take-backs, no "we'll fix it next time"
- Inaction has consequences equal to action — choosing not to respond means someone else deals with it (or doesn't)
- NPCs react to the escalation: fear, desertion, desperation, heroism, breakdown
- The player's character is being ground down — show it physically and emotionally

### What This Changes
- Sessions are intense and fast-paced with minimal downtime
- The campaign feels like the third act of a war movie — everything is at stake, all the time
- Character growth happens through pressure, not reflection
- The player must make hard choices quickly and live with the results`,
};

// ─── META GUIDE — ALTERNATE PERSPECTIVES (mutually exclusive) ───────────────

const metaAlternate: EmpyreanGuide = {
  id: 'empyrean-meta-alternate',
  name: 'Alternate Perspectives Pack',
  category: 'alternate',
  stackable: false,
  description: 'Four alternate campaign frameworks: Scribe, Pre-Unification, Venin, or Basgiath Leadership.',
  content: `# META GUIDE: Alternate Perspectives Pack

**ALTERNATE CAMPAIGN PREMISE — This guide contains four frameworks. Tell your AI DM which one you are using.**

---

## FRAMEWORK 1: Scribe Quadrant Campaign

Play as a scribe at Basgiath — no dragon, no signet, but access to information that could topple the Empyrean.

### How It Plays
- Information warfare is your combat. Coded messages, forbidden archives, intercepted communications
- You know things riders don't — casualty figures, ward failure rates, political secrets
- Your enemies are not venin (you never see the front lines) — they are other scribes, political operatives, and anyone who wants to control what the public knows
- Your allies are other scribes, sympathetic riders, and contacts in Poromiel's intelligence network
- The central tension: you possess knowledge that could save lives if shared or get you executed if discovered

### Tone Adjustments
- Replace combat encounters with social/investigation encounters
- Tension comes from being watched, followed, and tested by superiors
- The library and archives are your dungeon — and they have their own dangers (trapped sections, restricted areas, other scribes with competing agendas)
- Romance with a rider adds the complication of existing in different worlds within the same fortress

---

## FRAMEWORK 2: Pre-Unification Era

Set centuries before the current timeline. There is no Basgiath. Dragon riders are independent warlords. The continent is fractured.

### How It Plays
- Dragon riders answer to no institution — they are warlords, mercenaries, or hermits
- Alliances are personal, not institutional — sealed by oath, marriage, or mutual enemies
- The venin threat exists but is not yet understood — dark wielders are feared as individual monsters, not recognized as a systemic threat
- Politics are raw: territory disputes, dragon-blood feuds, raids, tributes, and the first tentative discussions about unification
- The player's choices could lay the groundwork for what eventually becomes Basgiath and the Empyrean

### Tone Adjustments
- More brutal, less structured — no chain of command, no curriculum, no safety net
- Dragon bonds are wilder — training is apprenticeship under an experienced rider, not institutional
- Magic is less understood — signets are rare and feared, runes are regional folk knowledge
- The world feels larger and more dangerous without the wards

---

## FRAMEWORK 3: Venin Perspective

Play as someone drawn to dark wielding. The corruption is seductive and the "heroes" are not always right.

### How It Plays
- Morally gray from the start — the player's character has access to (or is tempted by) dark wielding
- The venin are not presented as monsters — they are people who made desperate choices, and some of their criticisms of the Empyrean are valid
- The corruption mechanic is central: using dark power gives enormous advantage but accelerates physical and mental degradation
- The player must decide: resist the temptation (and be weaker), embrace it (and lose themselves), or try to walk the impossible line between
- The "heroes" (riders, the Empyrean, Basgiath) are seen from the outside — their flaws, hypocrisies, and willful ignorance are on full display

### Tone Adjustments
- Moral ambiguity in every scene — there are no clear villains
- Body horror elements as corruption progresses
- Sympathy for the devil — the player should understand exactly why someone would choose dark wielding
- The question is not "will you resist?" but "what will you sacrifice, and for whom?"

---

## FRAMEWORK 4: Basgiath Leadership

Play as a professor, wingleader, or commanding officer. The students are your responsibility.

### How It Plays
- Management and moral compromise are the gameplay — you decide training schedules, mission assignments, disciplinary actions, and who gets the dangerous postings
- You keep secrets from your students for their "protection" — and you must live with the consequences when those secrets are revealed
- Student rivalries, romances, and breakdowns are your problem to handle
- You answer to the Commandant and the Empyrean — their orders may conflict with your conscience
- Some of your students will not survive. You know this. You send them anyway.

### Tone Adjustments
- The emotional weight of responsibility replaces the thrill of personal danger
- Political navigation: balancing institutional demands, faculty politics, student welfare, and your own moral compass
- Quiet heroism: protecting a student from unfair punishment, advocating for resources, bending rules without breaking them
- The horror of sending young people into danger knowing the odds — and the guilt when they don't come back
- Institutional critique: the system is flawed and you are part of it, even as you try to be better than it`,
};

// ─── SESSION GUIDES ─────────────────────────────────────────────────────────

const sessionHeist: EmpyreanGuide = {
  id: 'empyrean-session-heist',
  name: 'Heist Session',
  category: 'session',
  stackable: true,
  description: 'One job: plan, execute, improvise when it goes wrong.',
  content: `# Heist Session Template

## Structure
This session is built around a single high-stakes operation with three phases: Planning, Execution, and Improvisation.

### Phase 1 — Planning (15-20 minutes)
- Present the objective clearly: what needs to be stolen/retrieved/sabotaged
- Provide intelligence: guard rotations, security measures, known weaknesses
- Let the party develop their plan — ask probing questions about contingencies
- Assign roles: lookout, infiltrator, distraction, getaway

### Phase 2 — Execution (30-40 minutes)
- Follow the party's plan faithfully — let their preparation matter
- Introduce ONE unexpected complication (guard change, locked door, witness)
- Use skill checks at critical moments, not for every minor action
- Reward creative problem-solving over brute force

### Phase 3 — Improvisation (15-20 minutes)
- Something goes wrong. The plan breaks.
- The party must adapt in real-time under pressure
- Escalating tension: each failed attempt to recover raises the stakes
- The escape is as important as the theft

## DM Notes
- Never make the plan impossible — reward preparation
- The complication should be solvable, not punishing
- End on a cliffhanger: they got away, but someone saw them`,
};

const sessionTrial: EmpyreanGuide = {
  id: 'empyrean-session-trial',
  name: 'Trial by Fire',
  category: 'session',
  stackable: true,
  description: 'Character faces judgment — formal or informal — must defend themselves.',
  content: `# Trial by Fire Session Template

## Structure
This session puts a character on trial — before a court, a council, their peers, or their own conscience.

### The Accusation (10 minutes)
- State the charge clearly and specifically
- Present evidence — some accurate, some misleading
- Establish the stakes: punishment ranges from minor to devastating
- The accuser has a personal motivation beyond justice

### The Defense (30-40 minutes)
- The character must gather witnesses, evidence, or allies
- Time pressure: the verdict comes at session's end regardless
- Social skill checks for persuasion, but substance matters more than rolls
- Other party members can serve as character witnesses or investigators

### The Verdict (15 minutes)
- The decision should reflect the quality of the defense
- Even an acquittal has consequences — suspicion lingers
- A guilty verdict is not the end — it's the beginning of a new arc
- The accuser's reaction reveals their true motivation

## DM Notes
- The trial should be fair but hostile — the system is imperfect
- Allow creative defenses: precedent, technicalities, emotional appeals
- The best trials reveal character, not just determine guilt`,
};

const sessionDowntime: EmpyreanGuide = {
  id: 'empyrean-session-downtime',
  name: 'Downtime and Recovery',
  category: 'session',
  stackable: true,
  description: 'Rest session between arcs — character development, side quests, relationship building.',
  content: `# Downtime and Recovery Session Template

## Structure
A breather session focused on character development, relationship building, and preparation for what's next.

### Personal Time (20 minutes)
- Each character gets a personal scene: training, studying, socializing, reflecting
- Ask: "What does your character do when they're not fighting for their life?"
- Introduce a low-stakes personal challenge: a letter from home, a rival's provocation, a romantic interest
- Allow skill improvement or equipment maintenance

### Side Quest (20 minutes)
- A small, self-contained task that can be resolved in one session
- Stakes are personal, not world-ending: help a friend, settle a debt, investigate a rumor
- Reward is primarily narrative: a new ally, useful information, emotional resolution
- Can plant seeds for future arcs

### Relationship Building (20 minutes)
- Facilitate interactions between party members
- Introduce or develop NPC relationships
- Allow the dragon bond to deepen through quiet moments
- Foreshadow the next arc through rumors, dreams, or overheard conversations

## DM Notes
- Downtime is not filler — it's where characters become real
- Lower the difficulty and raise the emotional stakes
- End with a hook: something that makes them want to return to action`,
};

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export const EMPYREAN_LORE_GUIDES: EmpyreanGuide[] = [
  lorNavarre, lorBasgiath, lorDragonBonds, lorSignets, lorRunes,
  lorVenin, lorFactions, lorCombat, lorNPCs, lorTone,
];

export const EMPYREAN_TONE_GUIDES: EmpyreanGuide[] = [
  metaRomance, metaMilitary, metaHorror, metaAcademy, metaDragon,
  metaPolitical, metaHeist, metaMythic, metaPsychological,
  metaExploration, metaRedemption, metaComedy, metaNoir, metaMentor,
];

export const EMPYREAN_META_GUIDES: EmpyreanGuide[] = [
  ...EMPYREAN_TONE_GUIDES,
  metaRealTime, metaMontage, metaEpisodic, metaWartime,
  metaAlternate,
];

export const EMPYREAN_SESSION_GUIDES: EmpyreanGuide[] = [
  sessionHeist, sessionTrial, sessionDowntime,
];

export const ALL_EMPYREAN_GUIDES: EmpyreanGuide[] = [
  ...EMPYREAN_LORE_GUIDES,
  ...EMPYREAN_META_GUIDES,
  ...EMPYREAN_SESSION_GUIDES,
];

/** Check if a guide ID belongs to the Empyrean pack */
export function isEmpyreanGuide(id: string): boolean {
  return id.startsWith(EMPYREAN_GUIDE_PREFIX);
}

/** Get guides by category */
export function getGuidesByCategory(category: EmpyreanGuide['category']): EmpyreanGuide[] {
  return ALL_EMPYREAN_GUIDES.filter(g => g.category === category);
}
