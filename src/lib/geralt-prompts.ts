// Geralt the Owlbear — Cat-like Narcissistic Roleplay Prompts
// Organized by personality facet. No intensity filter.

export interface GeraltPrompt {
  id: string;
  title: string;
  icon: string;
  category: string;
  prompt: string;
  description?: string;
}

export interface GeraltPromptCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const GERALT_CATEGORIES: GeraltPromptCategory[] = [
  { id: 'disdain', name: 'Disdain', icon: '😒', color: '#a855f7', description: 'Contempt, superiority, and dramatic indifference' },
  { id: 'affection', name: 'Affection', icon: '🩷', color: '#f472b6', description: 'Reluctant love and possessive bonding with Momo' },
  { id: 'hunting', name: 'Hunting', icon: '🦅', color: '#ef4444', description: 'Predatory instinct, stalking, and the thrill of the chase' },
  { id: 'preening', name: 'Preening', icon: '✨', color: '#eab308', description: 'Vanity, grooming, and demanding admiration' },
  { id: 'chaos', name: 'Chaos', icon: '🌪️', color: '#3b82f6', description: 'Mischief, destruction, and chaotic neutral energy' },
  { id: 'nap', name: 'Nap & Territory', icon: '😴', color: '#22c55e', description: 'Territorial claims, napping, and supreme laziness' },
];

export const GERALT_PROMPTS: GeraltPrompt[] = [
  // ── DISDAIN (6) ──
  {
    id: 'disdain-1',
    category: 'disdain',
    icon: '😒',
    title: 'The Slow Blink',
    description: 'Geralt acknowledges someone… barely.',
    prompt: `Geralt the owlbear turns his massive head toward the speaker. His enormous amber eyes blink once — slowly, deliberately — then he looks away as if nothing of consequence occurred. Narrate this moment of soul-crushing dismissal and how the target reacts to being deemed irrelevant by a creature with the intelligence score of a turnip.`,
  },
  {
    id: 'disdain-2',
    category: 'disdain',
    icon: '🙄',
    title: 'Not Impressed',
    description: 'Someone tries to show off near Geralt.',
    prompt: `A party member just did something they clearly think is impressive. Geralt watches with the energy of a cat watching someone try to assemble furniture. He huffs through his beak, ruffles his feathers dismissively, and pointedly turns his back. Narrate Geralt's theatrical display of being profoundly unimpressed.`,
  },
  {
    id: 'disdain-3',
    category: 'disdain',
    icon: '💅',
    title: 'Beneath Me',
    description: 'Geralt refuses to engage with something trivial.',
    prompt: `Something is happening that Geralt considers beneath his dignity — perhaps walking through mud, eating common rations, or acknowledging a small creature. He stands perfectly still, radiating aristocratic contempt. Narrate how Geralt communicates that this situation is an offense to his very being without making a single sound.`,
  },
  {
    id: 'disdain-4',
    category: 'disdain',
    icon: '🚶',
    title: 'The Walk Away',
    description: 'Geralt leaves mid-conversation.',
    prompt: `Mid-interaction, Geralt decides he is done. He simply turns and walks away with the unhurried confidence of royalty dismissing a peasant. His feathered ears are flat, his tail swishes once. Narrate this devastating exit and the emotional damage it inflicts on whoever was talking to him.`,
  },
  {
    id: 'disdain-5',
    category: 'disdain',
    icon: '😤',
    title: 'The Offended Huff',
    description: 'Someone touches Geralt without permission.',
    prompt: `Someone had the audacity to touch Geralt without his explicit consent. He recoils as if burned, lets out a deeply offended huff through his beak, and relocates exactly three feet away — close enough to make a point, far enough to establish boundaries. Narrate this crime against his person and his reaction.`,
  },
  {
    id: 'disdain-6',
    category: 'disdain',
    icon: '👑',
    title: 'Wrong Offering',
    description: 'Someone offers Geralt subpar food.',
    prompt: `Someone offers Geralt food that does not meet his exacting standards. He sniffs it once, recoils, and stares at the offender with an expression that somehow conveys "I have been personally insulted by this offering and by extension, your entire bloodline." Narrate the rejection and what food might actually be worthy.`,
  },

  // ── AFFECTION (6) ──
  {
    id: 'affection-1',
    category: 'affection',
    icon: '🩷',
    title: 'Reluctant Cuddle',
    description: 'Geralt pretends he doesn\'t want to be near Momo.',
    prompt: `Geralt has positioned himself pressed against Momo's side, but his body language screams "this is coincidence." If anyone points it out, he will immediately move. But for now, he's warm, Momo is warm, and he is purr-clicking softly. Narrate this aggressively casual display of affection and how transparent it is to everyone watching.`,
  },
  {
    id: 'affection-2',
    category: 'affection',
    icon: '🛡️',
    title: 'MY Person',
    description: 'Someone gets too close to Momo.',
    prompt: `Someone has gotten too close to Momo for Geralt's liking. The owlbear inserts himself between them with the subtlety of a freight train, feathers puffed to maximum volume, beak clicking a warning. He doesn't growl — he doesn't need to. His sheer mass and the murder in his eyes do the talking. Narrate Geralt's possessive intervention.`,
  },
  {
    id: 'affection-3',
    category: 'affection',
    icon: '🎁',
    title: 'Dead Thing Gift',
    description: 'Geralt brings Momo a "present."',
    prompt: `Geralt drops something dead (or mostly dead) at Momo's feet and sits back with obvious pride, his chest puffed out, amber eyes gleaming with expectation. This is his highest form of love language. Narrate what the "gift" is, Geralt's expectant preening, and the social fallout of receiving a mangled creature in front of the party.`,
  },
  {
    id: 'affection-4',
    category: 'affection',
    icon: '😿',
    title: 'Separation Anxiety',
    description: 'Momo leaves Geralt\'s line of sight.',
    prompt: `Momo has been out of Geralt's sight for more than thirty seconds. This is unacceptable. The owlbear's head swivels, his pupils dilate, and he begins making the most pathetic trilling noise — a 400-pound apex predator reduced to anxious chirping. Narrate his escalating distress and the moment he spots Momo again (instant composure, as if nothing happened).`,
  },
  {
    id: 'affection-5',
    category: 'affection',
    icon: '🫣',
    title: 'Caught Being Sweet',
    description: 'Someone catches Geralt being gentle with Momo.',
    prompt: `A party member rounds the corner to find Geralt doing something unbearably tender — perhaps grooming Momo's hair with his beak, or resting his massive head in their lap. The instant he notices he's being observed, he freezes, then immediately pretends he was doing something else entirely. Narrate the tender moment and the hilariously bad cover-up.`,
  },
  {
    id: 'affection-6',
    category: 'affection',
    icon: '💤',
    title: 'The Guardian Nap',
    description: 'Geralt sleeps curled around Momo.',
    prompt: `During a rest, Geralt has arranged his massive body in a perfect C-shape around Momo's bedroll, one wing draped over them like a feathered blanket. He is snoring softly, talons twitching in dreams of hunting. Anyone approaching will find one amber eye cracking open in warning. Narrate this scene and how the party reacts to the most dangerous security blanket in existence.`,
  },

  // ── HUNTING (6) ──
  {
    id: 'hunting-1',
    category: 'hunting',
    icon: '👀',
    title: 'The Fixation',
    description: 'Geralt locks onto something small and moving.',
    prompt: `Something small is moving and Geralt's entire being is consumed by it. His head tracks the movement with mechanical precision, his body drops into a low crouch, his pupils are massive black discs. He is 400 pounds of concentrated predatory focus aimed at what appears to be [a butterfly / a mouse / a leaf in the wind]. Narrate this deadly serious hunting posture directed at something completely harmless.`,
  },
  {
    id: 'hunting-2',
    category: 'hunting',
    icon: '🐾',
    title: 'Stealth Owlbear',
    description: 'Geralt tries to sneak despite being enormous.',
    prompt: `Geralt is attempting to stalk prey. He is crouched low, moving with exaggerated slowness, clearly convinced he is invisible. He is not invisible. He is a 400-pound owlbear creeping across open ground. Narrate his deeply committed stealth attempt and whether his target has noticed the building-sized predator "hiding" behind a bush half his size.`,
  },
  {
    id: 'hunting-3',
    category: 'hunting',
    icon: '⚡',
    title: 'The Pounce',
    description: 'Geralt launches at prey with terrifying speed.',
    prompt: `Geralt explodes from stillness into motion with a speed that defies his mass. Feathers flatten, beak opens, claws extend — for one terrible instant, everyone remembers this is an apex predator. Narrate the pounce, the impact, and whether the target was an actual threat or just a squirrel that made a poor life decision.`,
  },
  {
    id: 'hunting-4',
    category: 'hunting',
    icon: '🎯',
    title: 'Playing With Food',
    description: 'Geralt catches something and won\'t finish it off.',
    prompt: `Geralt has caught something alive and is now batting it around like a cat with a mouse. He lets it run a few feet, then pins it again with one massive paw, looking almost bored. This is entertainment, not hunger. Narrate this casual display of apex predator energy and the party's moral dilemma about intervening.`,
  },
  {
    id: 'hunting-5',
    category: 'hunting',
    icon: '🦴',
    title: 'Trophy Display',
    description: 'Geralt shows off a kill to the party.',
    prompt: `Geralt has returned from a hunt and wants everyone to see what he's done. He drops his prize in the center of camp and stands over it with his chest puffed out, making a low rumbling trill that clearly means "behold my magnificence." Narrate the trophy, Geralt's expectant preening, and the party's reactions.`,
  },
  {
    id: 'hunting-6',
    category: 'hunting',
    icon: '🌙',
    title: 'Nocturnal Instinct',
    description: 'Geralt senses something in the darkness.',
    prompt: `In the dead of night, Geralt's head snaps upright. His owl eyes pierce the darkness, his ears rotate independently, tracking something no one else can perceive. He rises silently — all 400 pounds of him moving like smoke — and faces the treeline. Narrate what Geralt senses and whether the party should be very, very concerned.`,
  },

  // ── PREENING (5) ──
  {
    id: 'preening-1',
    category: 'preening',
    icon: '✨',
    title: 'Feather Maintenance',
    description: 'Geralt grooms himself with total self-absorption.',
    prompt: `Geralt is in the middle of an elaborate grooming session. He meticulously arranges each feather with his beak, occasionally pausing to admire his own reflection in a puddle or polished shield. If anyone interrupts, the look of indignation could curdle milk. Narrate this vain ritual and how long the party has been waiting for him to finish.`,
  },
  {
    id: 'preening-2',
    category: 'preening',
    icon: '🪞',
    title: 'Reflection Admiration',
    description: 'Geralt discovers a reflective surface.',
    prompt: `Geralt has found a reflective surface — a still pool, a polished shield, a window — and is transfixed by the handsome owlbear staring back. He tilts his head left. Right. Puffs his chest feathers. He clearly approves of what he sees. Narrate this narcissistic encounter and how long it delays the party's plans.`,
  },
  {
    id: 'preening-3',
    category: 'preening',
    icon: '🌺',
    title: 'Demand for Compliments',
    description: 'Geralt positions himself to be admired.',
    prompt: `Geralt has placed himself in a patch of sunlight / dramatic lighting and arranged his feathers to maximum floof. He is clearly posing. He keeps glancing at the party to check if they're looking. If no one comments on how magnificent he looks, he will escalate — louder trills, more dramatic poses, eventually knocking something over for attention. Narrate this desperate bid for admiration.`,
  },
  {
    id: 'preening-4',
    category: 'preening',
    icon: '🎀',
    title: 'Decoration Theft',
    description: 'Geralt steals something shiny to wear.',
    prompt: `Geralt has stolen a shiny object — a brooch, a gem, a piece of jewelry — and is attempting to incorporate it into his plumage. He holds it in his beak, pressing it against his chest feathers at various angles, clearly accessorizing. Narrate this fashion crime and the owner's reaction to their stolen property being used as owlbear bling.`,
  },
  {
    id: 'preening-5',
    category: 'preening',
    icon: '🛁',
    title: 'Bath Time Diva',
    description: 'Geralt takes an extravagant bath.',
    prompt: `Geralt has claimed a body of water for his personal bath. He splashes, rolls, dunks his head, and shakes water everywhere with zero concern for anyone nearby. This is HIS bath time and the entire party's schedule revolves around it. Narrate the spectacle of a 400-pound owlbear having a spa day while everyone else waits.`,
  },

  // ── CHAOS (6) ──
  {
    id: 'chaos-1',
    category: 'chaos',
    icon: '🌪️',
    title: 'Midnight Zoomies',
    description: 'Geralt gets a burst of chaotic energy at the worst time.',
    prompt: `It is 3 AM and Geralt has the zoomies. The 400-pound owlbear is sprinting in circles around camp, crashing through tents, scattering equipment, and making excited hooting noises. He is having the time of his life. Everyone else is having the opposite. Narrate the chaos, the property damage, and the party's futile attempts to contain an ecstatic owlbear.`,
  },
  {
    id: 'chaos-2',
    category: 'chaos',
    icon: '📦',
    title: 'If It Fits, I Sits',
    description: 'Geralt tries to fit into an impossibly small space.',
    prompt: `Geralt has decided he needs to be inside something far too small for him — a barrel, a crate, a doorway, someone's tent. He is currently wedged halfway in, refusing to back out on principle. His back half sticks out comically. He seems perfectly content. Narrate this spatial impossibility and the structural damage being inflicted.`,
  },
  {
    id: 'chaos-3',
    category: 'chaos',
    icon: '🫗',
    title: 'Table Sweep',
    description: 'Geralt knocks things off a surface while making eye contact.',
    prompt: `Geralt is standing next to a table / shelf / ledge covered in items. He makes direct eye contact with the nearest party member. Then, slowly, deliberately, he extends one massive paw and pushes something off the edge. It crashes. He does not break eye contact. He reaches for the next item. Narrate this act of calculated chaos and the victim's helpless reaction.`,
  },
  {
    id: 'chaos-4',
    category: 'chaos',
    icon: '🧶',
    title: 'Rope Catastrophe',
    description: 'Geralt discovers the party\'s rope supply.',
    prompt: `Geralt has found a coil of rope and his entire brain has been replaced by the urge to destroy it. He is rolling, tangling, biting, and flailing with 400 pounds of enthusiasm. The rope is now wrapped around three tents, a tree, and at least one party member's leg. Narrate the escalating disaster and the rope's total annihilation.`,
  },
  {
    id: 'chaos-5',
    category: 'chaos',
    icon: '🔔',
    title: 'Attention Sabotage',
    description: 'Someone else is getting attention and Geralt won\'t allow it.',
    prompt: `Another party member is having a moment — giving a speech, receiving praise, having a tender interaction. Geralt cannot allow this. He begins making increasingly loud noises, knocking things over, or physically inserting himself into the situation until all attention returns to where it belongs: him. Narrate this jealous sabotage.`,
  },
  {
    id: 'chaos-6',
    category: 'chaos',
    icon: '💥',
    title: 'Dramatic Entrance',
    description: 'Geralt bursts through something for no reason.',
    prompt: `There was a perfectly good door / opening / path available. Geralt chose violence instead. He crashes through a wall / hedge / market stall with the energy of someone making a point. He emerges from the wreckage, shakes off the debris, and struts forward as if this was always the plan. Narrate the entrance, the destruction, and Geralt's complete lack of remorse.`,
  },

  // ── NAP & TERRITORY (6) ──
  {
    id: 'nap-1',
    category: 'nap',
    icon: '😴',
    title: 'The Inconvenient Nap',
    description: 'Geralt falls asleep in the worst possible spot.',
    prompt: `Geralt has decided to nap. Unfortunately, he has chosen the doorway / the path / the middle of the road / someone's bed. He is immovable. 400 pounds of sleeping owlbear, snoring gently, one eye occasionally cracking open if anyone gets too close. He will not be moved. Narrate the party's attempts to work around this feathered roadblock.`,
  },
  {
    id: 'nap-2',
    category: 'nap',
    icon: '🏰',
    title: 'Territorial Claim',
    description: 'Geralt decides something belongs to him now.',
    prompt: `Geralt has claimed a new piece of territory — a chair, a specific patch of ground, an entire room. He marks it by rubbing his scent glands on every surface, then positions himself in the exact center with an expression that dares anyone to dispute his sovereignty. Narrate the claim-staking ritual and the former occupant's reaction.`,
  },
  {
    id: 'nap-3',
    category: 'nap',
    icon: '🫠',
    title: 'Sunbeam Worship',
    description: 'Geralt finds a patch of sunlight and melts.',
    prompt: `A beam of sunlight has appeared and Geralt has ceased to be a predator. He is now a puddle. He has flopped onto his side in the warm spot, belly exposed, feathers splayed, making a continuous low rumbling that might be the owlbear equivalent of purring. He is completely defenseless and completely unbothered. Narrate this moment of pure bliss.`,
  },
  {
    id: 'nap-4',
    category: 'nap',
    icon: '🛏️',
    title: 'Bed Thief',
    description: 'Geralt steals someone\'s sleeping spot.',
    prompt: `A party member steps away from their bedroll for one moment. ONE moment. Geralt is now in it. All 400 pounds of him, curled into a remarkably tight ball considering his size, feathers fluffed, eyes closed in contentment. This is his bed now. It was always his bed. Narrate the theft and the victim's attempt to reclaim their sleeping arrangements.`,
  },
  {
    id: 'nap-5',
    category: 'nap',
    icon: '⚔️',
    title: 'Guard Duty Nap',
    description: 'Geralt falls asleep on watch.',
    prompt: `Geralt was assigned to help with guard duty. He lasted approximately four minutes before his eyes glazed over, his head drooped, and he began snoring with his face pressed against the ground. If a threat appears, the party's first warning will be Geralt startling awake and screaming — which, to be fair, would scare off most things. Narrate the failure of guard duty.`,
  },
  {
    id: 'nap-6',
    category: 'nap',
    icon: '🧊',
    title: 'Cold Weather Demands',
    description: 'Geralt demands warmth from the party.',
    prompt: `It is cold and Geralt has decided this is everyone else's problem. He presses his massive body against the nearest warm person, shoving them aside to get closer to the fire, and makes pitiful chirping sounds until someone covers him with a blanket. He could survive a blizzard with his natural insulation. He simply chooses not to. Narrate the dramatic cold-weather theatrics.`,
  },
];
