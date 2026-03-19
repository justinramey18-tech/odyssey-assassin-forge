import { OracleModeConfig } from './types';

export const oracleModes: OracleModeConfig[] = [
  {
    id: 'quick',
    name: 'Quick',
    icon: '⚡',
    description: 'Brief 1-2 sentence answers',
    color: '#EF4444', // red
    quickPrompts: [
      'Best action this turn?',
      'Should I retreat?',
      'Use a potion now?',
      'Attack or defend?',
    ],
  },
  {
    id: 'choice',
    name: 'Choice',
    icon: '🎲',
    description: 'Generate 4 options',
    color: '#F59E0B', // amber
    quickPrompts: [
      'What are my combat options?',
      'Give me roleplay choices',
      'Ways to approach this encounter?',
      'Creative solutions I could try?',
    ],
  },
  {
    id: 'plan',
    name: 'Plan',
    icon: '🎯',
    description: 'Collaborative 1-4 sentences',
    color: '#10B981', // emerald
    quickPrompts: [
      "What's my first move?",
      'Help me plan my turn',
      'What should I prioritize?',
      'Next step?',
    ],
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: '💬',
    description: 'Natural conversation',
    color: '#8B5CF6', // violet
    quickPrompts: [
      'What should I know about my situation?',
      'Help me understand my options',
      'Any advice for me right now?',
      'Tell me about my abilities',
    ],
  },
  {
    id: 'analyze',
    name: 'Analyze',
    icon: '🔬',
    description: 'Deep tactical analysis',
    color: '#3B82F6', // blue
    quickPrompts: [
      'Analyze my current build',
      'Break down this combat scenario',
      'What are my strengths and weaknesses?',
      'Optimal ability rotation?',
    ],
  },
  {
    id: 'recap',
    name: 'Recap',
    icon: '📜',
    description: 'Structured scene recap',
    color: '#EC4899', // pink
    quickPrompts: [
      '📖 Catch me up from my bookmark',
      'Quick catch-up',
      'What happened this scene?',
      'Full session recap',
      'Tactical briefing',
    ],
  },
  {
    id: 'quest',
    name: 'Quests',
    icon: '📜',
    description: 'Identify and track quests',
    color: '#F59E0B',
    quickPrompts: [
      'What quests am I currently on?',
      'Summarize my active objectives',
      'What should I do next?',
      'Any quests I might have missed?',
    ],
  },
];

export function getModeConfig(id: string): OracleModeConfig {
  return oracleModes.find(m => m.id === id) || oracleModes[0];
}

export function getModePromptModifier(mode: string): string {
  switch (mode) {
    case 'quick':
      return `
RESPONSE MODE: QUICK RESPONSE
HARD LIMIT: 1-2 sentences. No exceptions.`;

    case 'choice':
      return `
RESPONSE MODE: CHOICE GENERATION
HARD LIMIT: 4 numbered options maximum. Each option is ONE sentence.`;

    case 'plan':
      return `
RESPONSE MODE: COLLABORATIVE PLANNING
HARD LIMIT: 1-4 sentences maximum.`;

    case 'chat':
      return `
RESPONSE MODE: NATURAL CONVERSATION
HARD LIMIT: 3-5 sentences maximum.`;

    case 'analyze':
      return `
RESPONSE MODE: DEEP ANALYSIS
HARD LIMIT: 8-12 sentences maximum. Use bullet points.`;

    case 'recap':
      return `
RESPONSE MODE: STRUCTURED RECAP
HARD LIMIT: 300 words or less. Be concise and itemized — no prose paragraphs.

Format your response in exactly 2 sections:

**📖 What Happened** — A chronological bullet-point timeline of key events since the user's last bookmark (or the last 35 messages). Each bullet is ONE sentence covering a single event, decision, combat outcome, or revelation. Order from oldest to newest. Cap at 8-12 bullets — skip trivial moments, focus on events that matter.

**⚔️ Current Situation** — 2-3 sentences summarizing the party's current state RIGHT NOW: where they are, what they're facing, health/resource status, and any immediate threats or opportunities.

Rules:
- Use bullet points (•) for the timeline, NOT numbered lists
- Do NOT write flowing narrative paragraphs
- Do NOT include a "Next Move" section
- Every bullet must be a concrete event, not vague summary
- If covering many messages, prioritize: combat outcomes > story beats > loot/rewards > NPC interactions > flavor`;


    default:
      return `
RESPONSE MODE: QUICK RESPONSE
HARD LIMIT: 1-2 sentences. No exceptions.`;
  }
}
