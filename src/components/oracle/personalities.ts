import { PersonalityConfig } from './types';

export const personalities: PersonalityConfig[] = [
  {
    id: 'thunderhead',
    name: 'The Thunderhead',
    subtitle: 'Omniscient Consciousness',
    icon: '⚡',
    color: '#3B82F6', // blue-500
    bgGradient: 'from-blue-950/80 via-blue-900/60 to-slate-950/80',
    borderColor: 'border-blue-500/50',
    quickPrompts: [
      'Calculate my optimal turn sequence',
      'What is the statistical outcome of this plan?',
      'Analyze the tactical situation',
      'What are my survival probabilities?',
    ],
  },
  {
    id: 'jarvis',
    name: 'J.A.R.V.I.S.',
    subtitle: 'Personal AI Assistant',
    icon: '🔷',
    color: '#06B6D4', // cyan-500
    bgGradient: 'from-cyan-950/80 via-teal-900/60 to-slate-950/80',
    borderColor: 'border-cyan-500/50',
    quickPrompts: [
      'What would you recommend, JARVIS?',
      'Run the numbers on this encounter',
      'Prepare a tactical assessment',
      'What are my options, Sir?',
    ],
  },
  {
    id: 'deadpool',
    name: 'Deadpool',
    subtitle: 'Merc with a Mouth',
    icon: '💀',
    color: '#EF4444', // red-500
    bgGradient: 'from-red-950/80 via-rose-900/60 to-slate-950/80',
    borderColor: 'border-red-500/50',
    quickPrompts: [
      "What's the most fun thing I could do?",
      'Roast my build choices',
      'Give me three increasingly stupid options',
      'What would YOU do in this situation?',
    ],
  },
  {
    id: 'gandalf',
    name: 'Gandalf',
    subtitle: 'The Grey Wanderer',
    icon: '🧙',
    color: '#9CA3AF', // gray-400 for the Grey
    bgGradient: 'from-slate-800/80 via-stone-700/60 to-slate-950/80',
    borderColor: 'border-slate-400/50',
    quickPrompts: [
      'What path should I take from here?',
      'Is this truly a wise course of action?',
      'What hidden dangers await me?',
      'Speak to me of hope in this dark hour',
    ],
  },
  {
    id: 'jarlaxle',
    name: 'Jarlaxle Baenre',
    subtitle: 'Leader of Bregan D\'aerthe',
    icon: '🎩',
    color: '#A855F7', // purple-500 for the flamboyant drow
    bgGradient: 'from-purple-950/80 via-violet-900/60 to-slate-950/80',
    borderColor: 'border-purple-500/50',
    quickPrompts: [
      'What would be the most... profitable approach?',
      'How can I turn this situation to my advantage?',
      'What secrets are my enemies hiding?',
      'Entertain me with your most audacious plan',
    ],
  },
];

export function getPersonalityConfig(id: string): PersonalityConfig {
  return personalities.find(p => p.id === id) || personalities[2]; // Default to Deadpool
}
