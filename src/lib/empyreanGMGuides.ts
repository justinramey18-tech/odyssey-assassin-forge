// Empyrean Series GM Guides — 10 Lore + 10 Meta campaign modifiers

export interface EmpyreanGuide {
  id: string;
  name: string;
  content: string;
  category: 'lore' | 'tone' | 'pacing' | 'alternate';
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

// ─── EXPORTS ────────────────────────────────────────────────────────────────

export const EMPYREAN_LORE_GUIDES: EmpyreanGuide[] = [
  lorNavarre, lorBasgiath, lorDragonBonds, lorSignets, lorRunes,
  lorVenin, lorFactions, lorCombat, lorNPCs, lorTone,
];

export const EMPYREAN_META_GUIDES: EmpyreanGuide[] = [
  metaRomance, metaMilitary, metaHorror, metaAcademy, metaDragon,
  metaRealTime, metaMontage, metaEpisodic, metaWartime,
  metaAlternate,
];

export const ALL_EMPYREAN_GUIDES: EmpyreanGuide[] = [
  ...EMPYREAN_LORE_GUIDES,
  ...EMPYREAN_META_GUIDES,
];

/** Check if a guide ID belongs to the Empyrean pack */
export function isEmpyreanGuide(id: string): boolean {
  return id.startsWith(EMPYREAN_GUIDE_PREFIX);
}

/** Get guides by category */
export function getGuidesByCategory(category: EmpyreanGuide['category']): EmpyreanGuide[] {
  return ALL_EMPYREAN_GUIDES.filter(g => g.category === category);
}
