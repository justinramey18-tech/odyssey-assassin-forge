import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';

const STORAGE_KEY = 'dnd-protagonist-cards';
const MAX_PROTAGONISTS = 3;

export type POVStyle = 'first' | 'third' | 'rotating';

export interface ProtagonistCard {
  id: string;
  enabled: boolean;
  name: string;
  raceClass?: string;
  personality: string;
  speechStyle: string;
  povStyle: POVStyle;
  // Detail tier (progressive disclosure)
  backstory?: string;
  goalsConflicts?: string;
  relationships?: string;
  appearanceMannerisms?: string;
  flawsWeaknesses?: string;
  skillsAbilities?: string;
  characterArc?: string;
}

function generateId(): string {
  return `protag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadProtagonistCards(): ProtagonistCard[] {
  migrateToScoped(STORAGE_KEY);
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProtagonistCard[];
  } catch {
    return [];
  }
}

export function saveProtagonistCards(cards: ProtagonistCard[]): void {
  setScopedItem(STORAGE_KEY, JSON.stringify(cards));
}

export function addProtagonistCard(card: Omit<ProtagonistCard, 'id'>): ProtagonistCard | null {
  const cards = loadProtagonistCards();
  if (cards.length >= MAX_PROTAGONISTS) return null;
  const newCard: ProtagonistCard = { ...card, id: generateId() };
  saveProtagonistCards([...cards, newCard]);
  return newCard;
}

export function removeProtagonistCard(id: string): void {
  const cards = loadProtagonistCards();
  saveProtagonistCards(cards.filter(c => c.id !== id));
}

export function updateProtagonistCard(id: string, updates: Partial<Omit<ProtagonistCard, 'id'>>): void {
  const cards = loadProtagonistCards();
  saveProtagonistCards(cards.map(c => c.id === id ? { ...c, ...updates } : c));
}
