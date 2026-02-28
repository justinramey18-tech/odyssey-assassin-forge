// Geralt the Owlbear — Companion-specific Roleplay Infinity Stones
// These prompts are tailored for Momo's owlbear companion Geralt

export interface GeraltPrompt {
  id: string;
  category: string;
  title: string;
  description: string;
  prompt: string;
  icon: string;
}

export const geraltPrompts: GeraltPrompt[] = [
  // ── BOND STONE (Companion Bond & Loyalty) ──
  {
    id: 'geralt-bond-mild-1',
    category: 'Bond',
    title: 'Gentle Nuzzle',
    description: 'Geralt shows affection toward Momo in a quiet moment.',
    prompt: 'Describe Geralt the owlbear nudging Momo gently with his massive beak, making a low thrumming purr. Show how this simple gesture deepens their bond.',
    icon: '🪶',
  },
  {
    id: 'geralt-bond-mild-2',
    category: 'Bond',
    title: 'Shared Meal',
    description: 'Geralt and Momo share food together on the trail.',
    prompt: 'Narrate a scene where Geralt drops a freshly caught rabbit at Momo\'s feet and waits expectantly, tilting his owl-head. Describe the routine of their shared meal and what it reveals about their companionship.',
    icon: '🍖',
  },
  {
    id: 'geralt-bond-moderate-1',
    category: 'Bond',
    title: 'Protective Instinct',
    description: 'Geralt senses danger before Momo does and acts protectively.',
    prompt: 'An unseen threat approaches camp. Geralt\'s feathers bristle and he positions his massive body between the threat and Momo, a low growl rumbling through his chest. Describe how Geralt\'s protective instincts manifest and how Momo responds.',
    icon: '🛡️',
  },
  {
    id: 'geralt-bond-extreme-1',
    category: 'Bond',
    title: 'Near-Death Loyalty',
    description: 'Geralt refuses to leave Momo\'s side even when gravely wounded.',
    prompt: 'Geralt is badly wounded but refuses to retreat, standing over an unconscious Momo with blood-matted feathers and a defiant screech. Describe this desperate display of loyalty and the consequences.',
    icon: '💔',
  },

  // ── INSTINCT STONE (Primal Behavior & Nature) ──
  {
    id: 'geralt-instinct-mild-1',
    category: 'Instinct',
    title: 'Curious Investigation',
    description: 'Geralt investigates something with his keen senses.',
    prompt: 'Geralt catches an unusual scent and begins investigating with his keen owlbear senses — sniffing the air, rotating his owl-head almost 180 degrees, and pawing at the ground. Describe what he discovers and how Momo interprets his behavior.',
    icon: '👃',
  },
  {
    id: 'geralt-instinct-mild-2',
    category: 'Instinct',
    title: 'Nesting Behavior',
    description: 'Geralt creates a sleeping nest from whatever materials are nearby.',
    prompt: 'At camp, Geralt obsessively arranges branches, leaves, and stolen blankets into a nest. He keeps dragging Momo\'s belongings into the pile. Describe this endearing but inconvenient nesting ritual.',
    icon: '🪹',
  },
  {
    id: 'geralt-instinct-moderate-1',
    category: 'Instinct',
    title: 'Territorial Display',
    description: 'Geralt reacts to another large creature entering his territory.',
    prompt: 'Another large beast approaches and Geralt rises to his full height, spreads his vestigial wings, and unleashes a territorial screech that shakes leaves from trees. Describe this primal display of dominance and its effect on everyone nearby.',
    icon: '🦅',
  },
  {
    id: 'geralt-instinct-extreme-1',
    category: 'Instinct',
    title: 'Feral Rage',
    description: 'Geralt\'s primal instincts temporarily overwhelm his training.',
    prompt: 'Something triggers Geralt\'s deepest feral instincts — his eyes go wide and wild, he stops responding to Momo\'s commands, and acts on pure predatory drive. Describe Momo\'s struggle to calm Geralt back down and the aftermath.',
    icon: '🐻',
  },

  // ── FEROCITY STONE (Combat & Attacks) ──
  {
    id: 'geralt-ferocity-mild-1',
    category: 'Ferocity',
    title: 'Warning Snap',
    description: 'Geralt intimidates an enemy with a display of force.',
    prompt: 'Geralt snaps his beak inches from a hostile NPC\'s face, close enough to ruffle their hair. The sound echoes like cracking bone. Describe the intimidation check and the NPC\'s terrified reaction.',
    icon: '⚡',
  },
  {
    id: 'geralt-ferocity-moderate-1',
    category: 'Ferocity',
    title: 'Beak & Claw Fury',
    description: 'Geralt unleashes his multiattack in glorious detail.',
    prompt: 'Geralt launches into a multiattack — describe the beak strike (1d10+5 piercing) followed by raking claws (2d8+5 slashing) with visceral, cinematic detail. Include the sounds, the spray, and Momo\'s reaction watching their companion fight.',
    icon: '⚔️',
  },
  {
    id: 'geralt-ferocity-moderate-2',
    category: 'Ferocity',
    title: 'Bear Hug Takedown',
    description: 'Geralt grapples an enemy in his crushing bear hug.',
    prompt: 'Geralt grabs an enemy in his massive arms (DC 15 grapple) and squeezes. Describe the crushing pressure, the enemy\'s desperate attempts to break free, and whether Geralt\'s owl-eyes show any mercy.',
    icon: '🫂',
  },
  {
    id: 'geralt-ferocity-extreme-1',
    category: 'Ferocity',
    title: 'Apex Predator',
    description: 'Geralt goes full apex predator against a worthy foe.',
    prompt: 'Against a formidable enemy, Geralt fights like the apex predator he is — combining his keen senses, raw strength (STR 20), and cunning instinct. Describe a drawn-out, brutal combat sequence where Geralt proves why owlbears are feared across the realms.',
    icon: '💀',
  },

  // ── SPIRIT STONE (Mood & Emotion) ──
  {
    id: 'geralt-spirit-mild-1',
    category: 'Spirit',
    title: 'Playful Romp',
    description: 'Geralt is in a playful mood and causes wholesome chaos.',
    prompt: 'Geralt is feeling playful — describe him chasing butterflies, rolling in flowers (crushing them), or trying to play with smaller animals that are absolutely terrified of him. Show Momo\'s amused or exasperated reaction.',
    icon: '🦋',
  },
  {
    id: 'geralt-spirit-mild-2',
    category: 'Spirit',
    title: 'Sunset Companion',
    description: 'A quiet, peaceful moment between Geralt and Momo.',
    prompt: 'As the sun sets, Geralt settles beside Momo, his massive warm body providing both comfort and heat. His owl-eyes half-close contentedly. Describe this peaceful moment and what Momo reflects on.',
    icon: '🌅',
  },
  {
    id: 'geralt-spirit-moderate-1',
    category: 'Spirit',
    title: 'Jealous Growl',
    description: 'Geralt gets jealous when Momo gives attention to someone else.',
    prompt: 'Momo is being friendly with an NPC and Geralt doesn\'t like it. Describe his passive-aggressive behavior — inserting his massive body between them, "accidentally" knocking things over, or giving the NPC death-stares with his enormous owl-eyes.',
    icon: '😤',
  },
  {
    id: 'geralt-spirit-extreme-1',
    category: 'Spirit',
    title: 'Mourning Howl',
    description: 'Geralt mourns a fallen ally or responds to Momo\'s grief.',
    prompt: 'Geralt senses Momo\'s deep grief or loss. Describe how the owlbear responds — the mournful hooting that echoes through the night, how he refuses to leave Momo\'s side, and the raw emotional connection between beast and companion.',
    icon: '🌙',
  },

  // ── WILD STONE (Unpredictable & Chaotic) ──
  {
    id: 'geralt-wild-mild-1',
    category: 'Wild',
    title: 'Wrong Target',
    description: 'Geralt hilariously misidentifies what Momo was pointing at.',
    prompt: 'Momo points at something, but Geralt misunderstands and charges at the completely wrong target — maybe a merchant\'s cart, a scarecrow, or a party member\'s hat. Describe the hilarious chaos and cleanup.',
    icon: '🎯',
  },
  {
    id: 'geralt-wild-moderate-1',
    category: 'Wild',
    title: 'Unexpected Friendship',
    description: 'Geralt befriends something he absolutely shouldn\'t.',
    prompt: 'Geralt decides to befriend an enemy creature or monster mid-combat, completely ignoring Momo\'s commands. Describe the absurd scene of a massive owlbear nuzzling a creature that everyone else is trying to kill.',
    icon: '🤝',
  },
  {
    id: 'geralt-wild-moderate-2',
    category: 'Wild',
    title: 'Collateral Damage',
    description: 'Geralt causes unintended destruction in a social setting.',
    prompt: 'Geralt accompanies Momo into a place clearly not designed for a Large monstrosity — a tavern, a noble\'s hall, or a cramped shop. Describe the inevitable destruction: knocked shelves, terrified patrons, and Momo\'s attempts at damage control.',
    icon: '💥',
  },
  {
    id: 'geralt-wild-extreme-1',
    category: 'Wild',
    title: 'Gone AWOL',
    description: 'Geralt wanders off on his own mysterious adventure.',
    prompt: 'Geralt vanishes during the night and returns hours later covered in mud, feathers, and what appears to be glitter, carrying something bizarre in his beak. Describe Momo\'s investigation of where Geralt went and what he brought back.',
    icon: '🌀',
  },
];

// Geralt-specific infinity stones
export const geraltInfinityStones = [
  {
    id: 'bond',
    name: 'Bond Stone',
    color: '#f59e0b', // warm amber
    categories: ['Bond'],
    description: 'Companion loyalty & emotional connection',
  },
  {
    id: 'instinct',
    name: 'Instinct Stone',
    color: '#22c55e', // nature green
    categories: ['Instinct'],
    description: 'Primal behavior & keen senses',
  },
  {
    id: 'ferocity',
    name: 'Ferocity Stone',
    color: '#ef4444', // fierce red
    categories: ['Ferocity'],
    description: 'Combat prowess & raw power',
  },
  {
    id: 'spirit',
    name: 'Spirit Stone',
    color: '#a78bfa', // soft purple
    categories: ['Spirit'],
    description: 'Mood, emotion & companionship',
  },
  {
    id: 'wild',
    name: 'Wild Stone',
    color: '#f97316', // chaotic orange
    categories: ['Wild'],
    description: 'Unpredictable & chaotic moments',
  },
];
