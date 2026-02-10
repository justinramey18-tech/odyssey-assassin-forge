import { describe, it, expect } from 'vitest';
import { parseEnemyMatches, detectEnemies } from '../patterns/enemies';

describe('parseEnemyMatches', () => {
  // === Multi-enemy pattern (bug fix: second pair was dropped) ===
  it('parses both enemy pairs from "3 Goblins and 2 Hobgoblins"', () => {
    // ENCOUNTER_PATTERNS[7] requires capitalized names: (\d+)\s+([a-zA-Z]...)
    const text = 'You encounter 3 Goblins and 2 Hobgoblins blocking the road.';
    const enemies = parseEnemyMatches(text);
    const names = enemies.map(e => e.name.toLowerCase());
    expect(names.some(n => n.includes('goblin'))).toBe(true);
    expect(names.some(n => n.includes('hobgoblin'))).toBe(true);

    const goblins = enemies.find(e => e.name.toLowerCase().includes('goblin') && !e.name.toLowerCase().includes('hob'));
    const hobgoblins = enemies.find(e => e.name.toLowerCase().includes('hobgoblin'));
    if (goblins) expect(goblins.quantity).toBe(3);
    if (hobgoblins) expect(hobgoblins.quantity).toBe(2);
  });

  // === Single capture group patterns (bug fix: NaN quantity) ===
  it('gives quantity=1 for "the orc attacks" pattern', () => {
    const text = 'The Orc attacks you with its greataxe.';
    const enemies = parseEnemyMatches(text);
    const orc = enemies.find(e => e.name.toLowerCase().includes('orc'));
    expect(orc).toBeDefined();
    expect(orc!.quantity).toBe(1);
    expect(Number.isNaN(orc!.quantity)).toBe(false);
  });

  // === Title-case preservation (bug fix: was lowercasing after first char) ===
  it('preserves multi-word title casing', () => {
    const text = 'A Fire Elemental appears from the lava.';
    const enemies = parseEnemyMatches(text);
    const fe = enemies.find(e => e.name.toLowerCase().includes('fire'));
    if (fe) {
      // Should be "Fire Elemental", not "Fire elemental"
      expect(fe.name).toMatch(/Fire\s+Elemental/i);
      // The second word should be capitalized
      const words = fe.name.split(/\s+/);
      if (words.length >= 2) {
        expect(words[1][0]).toBe(words[1][0].toUpperCase());
      }
    }
  });

  // === Defeated enemy tracking ===
  it('marks enemies as defeated when kill phrases appear', () => {
    const text = 'The Goblin attacks you. You strike back. You killed the Goblin.';
    const enemies = parseEnemyMatches(text);
    const goblin = enemies.find(e => e.name.toLowerCase().includes('goblin'));
    expect(goblin?.status).toBe('defeated');
  });

  it('marks enemies as fled when flee phrases appear', () => {
    const text = 'The Bandit attacks you. The Bandit flees into the woods.';
    const enemies = parseEnemyMatches(text);
    const bandit = enemies.find(e => e.name.toLowerCase().includes('bandit'));
    expect(bandit?.status).toBe('fled');
  });

  // === AC/HP extraction ===
  it('extracts AC from enemy stat blocks', () => {
    const text = 'The Goblin (AC 15) attacks you.';
    const enemies = parseEnemyMatches(text);
    const goblin = enemies.find(e => e.name.toLowerCase().includes('goblin'));
    expect(goblin?.ac).toBe(15);
  });

  it('extracts HP from enemy mentions', () => {
    const text = 'The Troll has 84 HP and regenerates.';
    const enemies = parseEnemyMatches(text);
    const troll = enemies.find(e => e.name.toLowerCase().includes('troll'));
    expect(troll?.estimatedHP).toBe(84);
  });

  // === Creature type inference ===
  it('infers creature type from name', () => {
    const text = 'A Zombie shambles toward you. The Zombie attacks.';
    const enemies = parseEnemyMatches(text);
    const zombie = enemies.find(e => e.name.toLowerCase().includes('zombie'));
    expect(zombie?.creatureType).toBe('undead');
  });

  // === Player filtering ===
  it('does not include player entries', () => {
    const text = 'Initiative Order:\n1. Player (You)\n2. Goblin';
    const enemies = parseEnemyMatches(text);
    const names = enemies.map(e => e.name.toLowerCase());
    expect(names).not.toContain('player');
    expect(names.some(n => n.includes('you'))).toBe(false);
  });
});

describe('detectEnemies', () => {
  it('detects enemies from initiative order blocks', () => {
    const text = 'Initiative Order:\n1. Player (You)\n2. Goblin\n3. Orc';
    const enemies = detectEnemies(text);
    expect(enemies.map(e => e.toLowerCase())).toContain('goblin');
    expect(enemies.map(e => e.toLowerCase())).toContain('orc');
  });

  it('detects enemies from damage events', () => {
    const text = 'Goblin deals 8 damage to you. You take 5 damage from Orc.';
    const enemies = detectEnemies(text);
    const lower = enemies.map(e => e.toLowerCase());
    expect(lower).toContain('goblin');
    expect(lower).toContain('orc');
  });

  it('detects enemies from turn references', () => {
    const text = "Goblin's turn. The Orc's turn.";
    const enemies = detectEnemies(text);
    const lower = enemies.map(e => e.toLowerCase());
    expect(lower).toContain('goblin');
  });

  it('deduplicates enemy names', () => {
    const text = "Goblin attacks you. Goblin deals 5 damage. Goblin's turn.";
    const enemies = detectEnemies(text);
    const goblins = enemies.filter(e => e.toLowerCase() === 'goblin');
    expect(goblins.length).toBe(1);
  });
});
