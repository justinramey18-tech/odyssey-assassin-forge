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
      'Quick catch-up',
      'What happened this scene?',
      'Full session recap',
      'Give me an exhaustive, detailed recap of everything that has happened — leave nothing out',
      'Tactical briefing',
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
Format your response in exactly 3 sections:

**📖 Story** — What just happened narratively (2-3 sentences). Key events, NPC actions, revelations. Draw from the campaign summary and recent narrative messages.

**⚔️ Situation** — Current tactical state as bullet points. Reference REAL data: party HP/conditions, enemies on the field, active effects, resources spent, spell slots remaining. Narrate these facts in your voice, do not just list raw numbers.

**➡️ Next Move** — One sentence. If in combat, give a tactical suggestion. If in roleplay/exploration, give a narrative hook or question to consider.

Do not deviate from this 3-section format. Every section must be present.`;

    default:
      return `
RESPONSE MODE: QUICK RESPONSE
HARD LIMIT: 1-2 sentences. No exceptions.`;
  }
}
