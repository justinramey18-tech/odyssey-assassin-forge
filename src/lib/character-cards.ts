import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';

const STORAGE_KEY = 'dnd-character-cards';

export interface CharacterCard {
  id: string;
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
  enabled?: boolean;
}

function generateId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCharacterCards(): CharacterCard[] {
  migrateToScoped(STORAGE_KEY);
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CharacterCard[];
  } catch {
    return [];
  }
}

export function saveCharacterCards(cards: CharacterCard[]): void {
  setScopedItem(STORAGE_KEY, JSON.stringify(cards));
}

export function addCharacterCard(card: Omit<CharacterCard, 'id'>): CharacterCard {
  const cards = loadCharacterCards();
  const newCard: CharacterCard = { ...card, id: generateId() };
  saveCharacterCards([...cards, newCard]);
  return newCard;
}

export function updateCharacterCard(id: string, updates: Partial<Omit<CharacterCard, 'id'>>): void {
  const cards = loadCharacterCards();
  saveCharacterCards(cards.map(c => c.id === id ? { ...c, ...updates } : c));
}

export function removeCharacterCard(id: string): void {
  const cards = loadCharacterCards();
  saveCharacterCards(cards.filter(c => c.id !== id));
}

/** Format cards for injection into AI system prompts (filters out disabled) */
export function formatCardsForPrompt(cards: CharacterCard[]): string {
  const enabled = cards.filter(c => c.enabled !== false);
  if (enabled.length === 0) return '';
  const lines = enabled.map(c => {
    const rc = c.raceClass ? ` (${c.raceClass})` : '';
    return `- ${c.name}${rc}: ${c.personality}. Speech style: ${c.speechStyle}`;
  });
  return `CHARACTER PROFILES (use for dialogue voice and consistency):\n${lines.join('\n')}`;
}
