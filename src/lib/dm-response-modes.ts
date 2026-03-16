export type ResponseLength = 'micro' | 'snippet' | 'standard' | 'detailed' | 'epic';
export type ContentType = 'balanced' | 'combat' | 'dialogue' | 'environment' | 'lore' | 'compressed';

export interface ResponseMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  length: ResponseLength;
  content: ContentType;
  wordRange: string;
  promptModifier: string;
}

export const lengthSpecs: Record<ResponseLength, { range: string; label: string; modifier: string }> = {
  micro:    { range: '10-20 words',   label: 'Micro',    modifier: 'Respond in exactly 10-20 words. Be extremely concise.' },
  snippet:  { range: '30-50 words',   label: 'Snippet',  modifier: 'Respond in exactly 30-50 words. 2-3 sentences maximum.' },
  standard: { range: '75-125 words',  label: 'Standard', modifier: 'Respond in 75-125 words. One full paragraph or exchange.' },
  detailed: { range: '150-250 words', label: 'Detailed', modifier: 'Respond in 150-250 words. 2-3 well-developed paragraphs.' },
  epic:     { range: '300-500 words', label: 'Epic',     modifier: 'Respond in 300-500 words. Full scene treatment with rich detail.' },
};

export const contentSpecs: Record<ContentType, { label: string; modifier: string }> = {
  balanced:    { label: 'Balanced',    modifier: 'Include appropriate mix of description, dialogue, and action.' },
  combat:      { label: 'Combat',      modifier: 'Use bullet points or numbered lists. Include: attack rolls, damage numbers, HP changes, conditions, positioning. Minimize prose.' },
  dialogue:    { label: 'Dialogue',    modifier: 'Focus exclusively on NPC speech and subtext (in parentheses). Minimal scene description.' },
  environment: { label: 'Exploration', modifier: 'Prioritize spatial layout, sensory details, and interactive elements. Light on NPC characterization.' },
  lore:        { label: 'Lore',        modifier: 'Deliver historical, cultural, or world-building information through environmental text or knowledgeable sources.' },
  compressed:  { label: 'Montage',     modifier: 'Summarize extended time periods. Highlight only key events, resource changes, and complications.' },
};

export const RESPONSE_LENGTHS: ResponseLength[] = ['micro', 'snippet', 'standard', 'detailed', 'epic'];
export const CONTENT_TYPES: ContentType[] = ['balanced', 'combat', 'dialogue', 'environment', 'lore', 'compressed'];

export const presetModes: ResponseMode[] = [
  {
    id: 'quick-action',
    name: 'Quick Action',
    icon: '⚡',
    description: 'Single action, instant resolution',
    length: 'micro',
    content: 'balanced',
    wordRange: '10-20 words',
    promptModifier: `${lengthSpecs.micro.modifier} ${contentSpecs.balanced.modifier}`,
  },
  {
    id: 'combat-turn',
    name: 'Combat Turn',
    icon: '⚔️',
    description: 'Mechanical resolution, bullet format',
    length: 'snippet',
    content: 'combat',
    wordRange: '30-50 words',
    promptModifier: `${lengthSpecs.snippet.modifier} ${contentSpecs.combat.modifier}`,
  },
  {
    id: 'standard-scene',
    name: 'Standard Scene',
    icon: '🎬',
    description: 'Default balanced response',
    length: 'standard',
    content: 'balanced',
    wordRange: '75-125 words',
    promptModifier: `${lengthSpecs.standard.modifier} ${contentSpecs.balanced.modifier}`,
  },
  {
    id: 'npc-conversation',
    name: 'NPC Conversation',
    icon: '💬',
    description: 'Deep dialogue with subtext',
    length: 'detailed',
    content: 'dialogue',
    wordRange: '150-250 words',
    promptModifier: `${lengthSpecs.detailed.modifier} ${contentSpecs.dialogue.modifier}`,
  },
  {
    id: 'boss-moment',
    name: 'Boss Moment',
    icon: '👑',
    description: 'Dramatic entrance, full atmosphere',
    length: 'epic',
    content: 'environment',
    wordRange: '300-500 words',
    promptModifier: `${lengthSpecs.epic.modifier} ${contentSpecs.environment.modifier} Focus on creating dramatic atmosphere for major encounters.`,
  },
  {
    id: 'fast-montage',
    name: 'Fast Montage',
    icon: '⏭️',
    description: 'Ultra-brief time skip',
    length: 'micro',
    content: 'compressed',
    wordRange: '10-20 words',
    promptModifier: `${lengthSpecs.micro.modifier} ${contentSpecs.compressed.modifier}`,
  },
  {
    id: 'journey-summary',
    name: 'Journey Summary',
    icon: '🗺️',
    description: 'Travel with minor events',
    length: 'snippet',
    content: 'compressed',
    wordRange: '30-50 words',
    promptModifier: `${lengthSpecs.snippet.modifier} ${contentSpecs.compressed.modifier}`,
  },
  {
    id: 'rich-exploration',
    name: 'Rich Exploration',
    icon: '🔍',
    description: 'Detailed environment, interactivity',
    length: 'detailed',
    content: 'environment',
    wordRange: '150-250 words',
    promptModifier: `${lengthSpecs.detailed.modifier} ${contentSpecs.environment.modifier}`,
  },
  {
    id: 'lore-reveal',
    name: 'Lore Reveal',
    icon: '📜',
    description: 'Historical/cultural exposition',
    length: 'standard',
    content: 'lore',
    wordRange: '75-125 words',
    promptModifier: `${lengthSpecs.standard.modifier} ${contentSpecs.lore.modifier}`,
  },
  {
    id: 'epic-climax',
    name: 'Epic Climax',
    icon: '🌟',
    description: 'Maximum drama, pivotal moments',
    length: 'epic',
    content: 'balanced',
    wordRange: '300-500 words',
    promptModifier: `${lengthSpecs.epic.modifier} ${contentSpecs.balanced.modifier} This is a climactic moment—use full novelistic treatment.`,
  },
];

export function getResponseModeById(id: string): ResponseMode | undefined {
  return presetModes.find(m => m.id === id);
}

export function getCustomModeModifier(length: ResponseLength, content: ContentType): string {
  return `${lengthSpecs[length].modifier} ${contentSpecs[content].modifier}`;
}

export function getModeName(length: ResponseLength, content: ContentType): string {
  const preset = presetModes.find(m => m.length === length && m.content === content);
  if (preset) return preset.name;
  return `${lengthSpecs[length].label} ${contentSpecs[content].label}`;
}

/**
 * Resolve a responseMode string (preset id or "custom:length:content") to a prompt modifier.
 * Returns empty string if no mode set (default immersive style).
 */
export function resolveResponseModePrompt(modeId: string | undefined | null): string {
  if (!modeId) return '';

  // Custom mode: "custom:detailed:combat"
  if (modeId.startsWith('custom:')) {
    const parts = modeId.split(':');
    const length = parts[1] as ResponseLength;
    const content = parts[2] as ContentType;
    if (lengthSpecs[length] && contentSpecs[content]) {
      return `\n\n## RESPONSE FORMAT\n${getCustomModeModifier(length, content)}\nStrictly adhere to the word count and formatting requirements above.`;
    }
    return '';
  }

  const preset = getResponseModeById(modeId);
  if (!preset) return '';
  return `\n\n## RESPONSE FORMAT\n${preset.promptModifier}\nStrictly adhere to the word count and formatting requirements above.`;
}
