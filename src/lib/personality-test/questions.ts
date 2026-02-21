import type { Question } from './types';

export const QUESTIONS: Question[] = [
  // === SECTION 1: HOW YOU EXPLORE (questions 1-5) ===
  {
    id: 1,
    section: 'explore',
    text: 'You enter a dark dungeon. Do you:',
    optionA: { text: 'Light a torch and examine the first room carefully', value: 'methodical' },
    optionB: { text: 'Press forward and adapt to whatever you find', value: 'spontaneous' },
  },
  {
    id: 2,
    section: 'explore',
    text: 'You find a mysterious locked chest. Do you:',
    optionA: { text: 'Search for traps and clues before touching it', value: 'methodical' },
    optionB: { text: 'Try to pick the lock immediately — fortune favors the bold', value: 'spontaneous' },
  },
  {
    id: 3,
    section: 'explore',
    text: 'The path ahead splits into two corridors. Do you:',
    optionA: { text: 'Listen carefully, check for footprints, and weigh the options', value: 'methodical' },
    optionB: { text: 'Pick the one that looks more dangerous — that\'s where the treasure is', value: 'spontaneous' },
  },
  {
    id: 4,
    section: 'explore',
    text: 'You discover an ancient inscription on a wall. Do you:',
    optionA: { text: 'Spend time deciphering it — it might be a warning or a clue', value: 'methodical' },
    optionB: { text: 'Note it and keep moving — the answer is probably ahead', value: 'spontaneous' },
  },
  {
    id: 5,
    section: 'explore',
    text: 'Your party camps for the night in unfamiliar territory. Do you:',
    optionA: { text: 'Set up watch rotations and map escape routes', value: 'methodical' },
    optionB: { text: 'Build a fire and enjoy the moment — you\'ll handle trouble when it comes', value: 'spontaneous' },
  },

  // === SECTION 2: HOW YOU CONNECT (questions 6-10) ===
  {
    id: 6,
    section: 'connect',
    text: 'A distraught villager begs for help. Do you:',
    optionA: { text: 'Ask questions to understand the full situation before committing', value: 'analytical' },
    optionB: { text: 'Immediately offer comfort and promise to help', value: 'empathetic' },
  },
  {
    id: 7,
    section: 'connect',
    text: 'An NPC companion betrays the party. Do you:',
    optionA: { text: 'Analyze their motives — there must be a logical reason', value: 'analytical' },
    optionB: { text: 'Feel the sting of betrayal — you trusted them', value: 'empathetic' },
  },
  {
    id: 8,
    section: 'connect',
    text: 'You meet a rival adventurer at a tavern. Do you:',
    optionA: { text: 'Size them up — assess their gear, skills, and threat level', value: 'analytical' },
    optionB: { text: 'Buy them a drink and swap war stories', value: 'empathetic' },
  },
  {
    id: 9,
    section: 'connect',
    text: 'A dying enemy asks for mercy. Do you:',
    optionA: { text: 'Consider the tactical implications of letting them live', value: 'analytical' },
    optionB: { text: 'Show compassion — even enemies deserve dignity', value: 'empathetic' },
  },
  {
    id: 10,
    section: 'connect',
    text: 'The king offers you a choice of reward. Do you:',
    optionA: { text: 'Request access to the royal library or intelligence network', value: 'analytical' },
    optionB: { text: 'Ask for the freedom of wrongly imprisoned villagers', value: 'empathetic' },
  },

  // === SECTION 3: WHAT DRIVES YOU (questions 11-15) ===
  {
    id: 11,
    section: 'drive',
    text: 'You prefer adventures that:',
    optionA: { text: 'Test your skills with difficult challenges and worthy foes', value: 'achievement' },
    optionB: { text: 'Tell compelling stories with memorable characters', value: 'narrative' },
  },
  {
    id: 12,
    section: 'drive',
    text: 'After defeating a boss, you\'re most satisfied by:',
    optionA: { text: 'The tactical victory — you outplayed a powerful enemy', value: 'achievement' },
    optionB: { text: 'The narrative payoff — the villain\'s story reached its climax', value: 'narrative' },
  },
  {
    id: 13,
    section: 'drive',
    text: 'Your ideal session involves:',
    optionA: { text: 'A challenging dungeon with clever traps and tough encounters', value: 'achievement' },
    optionB: { text: 'A dramatic revelation that changes everything you thought you knew', value: 'narrative' },
  },
  {
    id: 14,
    section: 'drive',
    text: 'When you level up, you\'re most excited about:',
    optionA: { text: 'New abilities and increased power to tackle harder content', value: 'achievement' },
    optionB: { text: 'How your character\'s growth reflects their journey and choices', value: 'narrative' },
  },
  {
    id: 15,
    section: 'drive',
    text: 'The most memorable moment in an adventure is:',
    optionA: { text: 'A clutch critical hit or brilliant tactical play', value: 'achievement' },
    optionB: { text: 'An emotional scene that gave you chills', value: 'narrative' },
  },
];

export const SECTION_HEADERS: Record<string, { title: string; subtitle: string }> = {
  explore: {
    title: 'How You Explore',
    subtitle: 'Your approach to the unknown',
  },
  connect: {
    title: 'How You Connect',
    subtitle: 'Your relationship with the world',
  },
  drive: {
    title: 'What Drives You',
    subtitle: 'The heart of your adventure',
  },
};

export const TOTAL_QUESTIONS = QUESTIONS.length;
