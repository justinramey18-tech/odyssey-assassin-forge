import { OracleModeConfig } from './types';

export const oracleModes: OracleModeConfig[] = [
  {
    id: 'chat',
    name: 'Chat',
    icon: '💬',
    description: 'Natural conversation',
    color: '#8B5CF6', // violet
  },
  {
    id: 'plan',
    name: 'Plan',
    icon: '🎯',
    description: 'Collaborative 1-4 sentences',
    color: '#10B981', // emerald
  },
  {
    id: 'choice',
    name: 'Choice',
    icon: '🎲',
    description: 'Generate 4-6 options',
    color: '#F59E0B', // amber
  },
  {
    id: 'analyze',
    name: 'Analyze',
    icon: '🔬',
    description: 'Deep tactical analysis',
    color: '#3B82F6', // blue
  },
  {
    id: 'quick',
    name: 'Quick',
    icon: '⚡',
    description: 'Brief 1-2 sentence answers',
    color: '#EF4444', // red
  },
];

export function getModeConfig(id: string): OracleModeConfig {
  return oracleModes.find(m => m.id === id) || oracleModes[0];
}

export function getModePromptModifier(mode: string): string {
  switch (mode) {
    case 'plan':
      return `
RESPONSE MODE: COLLABORATIVE PLANNING
- Respond in ONLY 1-4 concise sentences
- Ask clarifying questions to collaborate on the plan
- Don't write out entire strategies - work together step by step
- Focus on the immediate next step or decision
- Invite the user's input and preferences
- Be a planning partner, not a lecturer`;

    case 'choice':
      return `
RESPONSE MODE: CHOICE GENERATION
- Present exactly 4-6 distinct options for the player
- Number each option clearly (1, 2, 3, etc.)
- Each option should be 1-2 sentences max
- Include a mix of safe, risky, and creative approaches
- Don't recommend one over another - let the player decide
- Format: Brief title + short description for each option`;

    case 'analyze':
      return `
RESPONSE MODE: DEEP ANALYSIS
- Provide thorough tactical analysis
- Consider multiple angles: offense, defense, resource management, positioning
- Reference specific abilities, stats, and items by name
- Calculate rough odds or outcomes when relevant
- Structure with clear sections if needed
- Be comprehensive but organized`;

    case 'quick':
      return `
RESPONSE MODE: QUICK RESPONSE
- Answer in ONLY 1-2 sentences maximum
- Be direct and actionable
- Skip explanations - just give the answer
- No preamble or follow-up questions
- Punchy and immediate`;

    case 'chat':
    default:
      return `
RESPONSE MODE: NATURAL CONVERSATION
- Respond naturally without length constraints
- Balance helpfulness with personality
- Engage conversationally`;
  }
}
