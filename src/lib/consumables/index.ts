export * from './types';
export * from './potions';
export * from './poisons';
export * from './scrolls';
export * from './prompts';

import { potions } from './potions';
import { poisons } from './poisons';
import { scrolls } from './scrolls';
import { Consumable } from './types';

export const allConsumables: Consumable[] = [...potions, ...poisons, ...scrolls];

export function getConsumableById(id: string): Consumable | undefined {
  return allConsumables.find(c => c.id === id);
}

export function getConsumablesByType(type: 'potion' | 'poison' | 'scroll'): Consumable[] {
  return allConsumables.filter(c => c.type === type);
}
