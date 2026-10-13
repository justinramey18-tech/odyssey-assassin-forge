import { describe, it, expect } from 'vitest';
import { SPARRING_ROSTER, buildSparringFoes } from '../sparringRoster';

describe('sparring roster', () => {
  it('has 20 opponents', () => { expect(SPARRING_ROSTER).toHaveLength(20); });
  it('caps a fight at 6 opponents', () => { expect(buildSparringFoes({ goblin: 4, bear: 4 })).toHaveLength(6); });
  it('numbers duplicates', () => { expect(buildSparringFoes({ goblin: 2 }).map((f) => f.name)).toEqual(['Goblin Skulker 1', 'Goblin Skulker 2']); });
});
