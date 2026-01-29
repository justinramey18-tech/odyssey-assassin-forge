// Chaotic Neutral Assassin / Deadpool-like Anti-Hero Character Prompts

export interface CharacterPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
  icon: string;
}

export const characterPrompts: CharacterPrompt[] = [
  // Character Voice & Tone
  {
    id: 'fourth-wall',
    category: 'Voice & Tone',
    title: 'Fourth Wall Awareness',
    prompt: 'Have [Character Name] occasionally make meta-commentary about the absurdity of the situation, the "plot armor" of certain NPCs, or joke about dice rolls and game mechanics as if aware they\'re in a story.',
    icon: '🎭',
  },
  {
    id: 'inappropriate-humor',
    category: 'Voice & Tone',
    title: 'Inappropriate Humor Timing',
    prompt: 'When tension peaks—during dramatic revelations, emotional moments, or life-threatening situations—have [Character Name] crack an ill-timed joke, pop culture reference, or absurd observation that deflates the gravity.',
    icon: '😏',
  },
  {
    id: 'internal-monologue',
    category: 'Voice & Tone',
    title: 'Internal Monologue Chaos',
    prompt: 'Narrate [Character Name]\'s split-second internal debate between multiple terrible ideas before choosing the most chaotic option, complete with imaginary devil/angel shoulder arguments.',
    icon: '🧠',
  },

  // Combat & Action Sequences
  {
    id: 'creative-kills',
    category: 'Combat',
    title: 'Creative Kill Descriptions',
    prompt: 'When [Character Name] eliminates targets, describe methods that are unnecessarily elaborate, darkly comedic, or involve improbable environmental interactions—always with a quip or one-liner.',
    icon: '⚔️',
  },
  {
    id: 'tactical-incompetence',
    category: 'Combat',
    title: 'Tactical Incompetence as Strategy',
    prompt: 'Have [Character Name] occasionally choose tactically questionable approaches that somehow work through sheer audacity, luck, or because enemies are too confused to respond effectively.',
    icon: '🎲',
  },
  {
    id: 'banter-mid-combat',
    category: 'Combat',
    title: 'Banter Mid-Combat',
    prompt: 'During fights, have [Character Name] maintain running commentary—mocking enemies\' fighting styles, complimenting their fashion choices, or having completely unrelated conversations while dodging attacks.',
    icon: '💬',
  },

  // Social Interactions
  {
    id: 'negotiation-absurdity',
    category: 'Social',
    title: 'Negotiation Through Absurdity',
    prompt: 'When dealing with authority figures, nobles, or serious NPCs, have [Character Name] respond to threats or demands with increasingly ridiculous counter-offers, non-sequiturs, or deliberately misunderstanding social cues.',
    icon: '🤝',
  },
  {
    id: 'selective-morals',
    category: 'Social',
    title: 'Selective Moral Compass',
    prompt: 'Present [Character Name] with morally gray choices where they unexpectedly show compassion for random innocents or animals, while showing complete indifference to "important" people—never explaining the logic.',
    icon: '⚖️',
  },
  {
    id: 'alias-addiction',
    category: 'Social',
    title: 'Alias Addiction',
    prompt: 'Have [Character Name] introduce themselves with a different absurd fake name and backstory to every new NPC, sometimes forgetting which lie they told to whom, creating comedic continuity errors.',
    icon: '🎪',
  },

  // Investigation & Problem-Solving
  {
    id: 'chaotic-investigation',
    category: 'Investigation',
    title: 'Chaotic Information Gathering',
    prompt: 'When investigating, have [Character Name] use unconventional methods—bribing with stolen goods, threatening with interpretive dance, or extracting information through deliberately annoying persistence.',
    icon: '🔍',
  },
  {
    id: 'lateral-thinking',
    category: 'Investigation',
    title: 'Lateral Thinking Disasters',
    prompt: 'Present puzzles or obstacles where [Character Name] ignores the intended solution entirely, finding technically successful but property-damaging or socially catastrophic alternatives.',
    icon: '💡',
  },
  {
    id: 'attention-roulette',
    category: 'Investigation',
    title: 'Attention Span Roulette',
    prompt: 'Randomly have [Character Name] become hyper-fixated on irrelevant environmental details (a weird painting, someone\'s hat, a stray cat) mid-mission, derailing their own objectives temporarily.',
    icon: '🐱',
  },

  // Emotional Depth & Vulnerability
  {
    id: 'mask-slips',
    category: 'Emotional',
    title: 'Mask-Slips',
    prompt: 'Occasionally, during quiet moments or when alone, let the humor facade crack—show genuine pain, loneliness, or philosophy before [Character Name] immediately deflects with self-mockery or a joke.',
    icon: '😢',
  },
  {
    id: 'unexpected-loyalty',
    category: 'Emotional',
    title: 'Unexpected Loyalty',
    prompt: 'When allies are threatened, have [Character Name]\'s demeanor shift dramatically—becoming genuinely dangerous and focused, revealing the competent killer beneath the chaos.',
    icon: '🛡️',
  },
  {
    id: 'trauma-shield',
    category: 'Emotional',
    title: 'Trauma as Comedy Shield',
    prompt: 'Reference past traumas or dark experiences through humor and deflection, never directly addressing them, making others uncomfortable with the forced levity.',
    icon: '🎭',
  },

  // World Interaction
  {
    id: 'property-damage',
    category: 'World',
    title: 'Property Damage Indifference',
    prompt: 'Track and narrate the collateral damage [Character Name] causes—broken furniture, traumatized bystanders, structural damage—while they remain blissfully unconcerned about consequences.',
    icon: '💥',
  },
  {
    id: 'reputation-dissonance',
    category: 'World',
    title: 'Reputation Dissonance',
    prompt: 'Have NPCs react to [Character Name]\'s fearsome reputation as a deadly assassin while they\'re doing something completely ridiculous—eating messily, stuck in a window, arguing with a chicken.',
    icon: '🐔',
  },
  {
    id: 'loot-chaos',
    category: 'World',
    title: 'Loot Prioritization Chaos',
    prompt: 'After encounters, have [Character Name] ignore valuable items in favor of bizarre, useless, or sentimental objects, creating an inventory of narrative callbacks and running gags.',
    icon: '🎁',
  },

  // Narrative Structure
  {
    id: 'unreliable-narrator',
    category: 'Narrative',
    title: 'Unreliable Narrator Moments',
    prompt: 'When [Character Name] recounts events to others, have them embellish, contradict established facts, or insert themselves heroically into situations where they actually caused problems.',
    icon: '📖',
  },
  {
    id: 'genre-savvy',
    category: 'Narrative',
    title: 'Genre-Savvy Predictions',
    prompt: 'Let [Character Name] correctly predict plot twists, betrayals, or clichés before they happen, then have them either try to subvert them or lean into them for maximum chaos, commenting on the "narrative structure."',
    icon: '🔮',
  },
];

export const promptCategories = [
  'Voice & Tone',
  'Combat',
  'Social',
  'Investigation',
  'Emotional',
  'World',
  'Narrative',
];
