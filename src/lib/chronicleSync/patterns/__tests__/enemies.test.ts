import { describe, it, expect } from 'vitest';
import { detectEnemies, parseEnemyMatches } from '../enemies';

describe('Enemy Detection', () => {
  describe('Initiative Order Detection', () => {
    it('should detect enemies from initiative order blocks', () => {
      const text = `
Initiative Order:
1. Σκιά (You) - Surprise Round taken.
2. Isu Sentinel #2 - Currently searching/panicking.
3. Isu Sentinel #3 - Active.
      `;
      
      const enemies = detectEnemies(text, 'Σκιά');
      
      expect(enemies).toContain('Isu Sentinel');
      expect(enemies).not.toContain('Σκιά');
    });
    
    it('should handle numbered list formats', () => {
      const text = `
Initiative Order:
1. Player Character (You)
2. Goblin Warrior
3. Orc Chief
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Goblin Warrior');
      expect(enemies).toContain('Orc Chief');
      expect(enemies.length).toBe(2);
    });
    
    it('should filter out player markers', () => {
      const text = `
Initiative Order:
1. Hero (You)
2. Goblin
3. Your Character (PC)
4. Orc
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual(expect.arrayContaining(['Goblin', 'Orc']));
      expect(enemies).not.toContain('Hero');
    });
  });
  
  describe('Damage Event Detection', () => {
    it('should detect enemies dealing damage', () => {
      const text = 'The Goblin deals 12 damage to you.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Goblin');
    });
    
    it('should detect enemies taking damage', () => {
      const text = 'You deal 20 damage to the Orc Warrior.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Orc Warrior');
    });
    
    it('should handle "takes damage" format', () => {
      const text = 'The Dragon takes 45 damage from your fireball.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Dragon');
    });
  });
  
  describe('Turn Reference Detection', () => {
    it('should detect enemies from turn references', () => {
      const text = "It's the Goblin's turn.";
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Goblin');
    });
  });
  
  describe('Combat Action Detection', () => {
    it('should detect enemies attacking', () => {
      const text = 'The Orc attacks you with its greataxe.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Orc');
    });
    
    it('should detect "fighting" references', () => {
      const text = 'You are fighting the Shadow Demon.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toContain('Shadow Demon');
    });
  });
  
  describe('Unicode Support', () => {
    it('should handle Greek characters', () => {
      const text = `
Initiative Order:
1. Σκιά (You)
2. Δράκος
      `;
      
      const enemies = detectEnemies(text, 'Σκιά');
      
      expect(enemies).toContain('Δράκος');
      expect(enemies).not.toContain('Σκιά');
    });
  });
  
  describe('Deduplication', () => {
    it('should deduplicate same enemy mentioned multiple times', () => {
      const text = `
Initiative Order:
1. You
2. Goblin #1
3. Goblin #2

Goblin #1 attacks you.
You hit Goblin #2 for 15 damage.
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual(['Goblin']);
      expect(enemies.length).toBe(1);
    });
    
    it('should preserve different enemy types', () => {
      const text = `
Initiative Order:
1. You
2. Goblin
3. Orc
4. Troll
      `;
      
      const enemies = detectEnemies(text);
      
      expect(enemies).toHaveLength(3);
      expect(enemies).toContain('Goblin');
      expect(enemies).toContain('Orc');
      expect(enemies).toContain('Troll');
    });
  });
  
  describe('Full parseEnemyMatches integration', () => {
    it('should return ParsedEnemy array with initiative order detection', () => {
      const text = `
Initiative Order:
1. Player (You)
2. Isu Sentinel #2
3. Ancient Dragon

The Ancient Dragon attacks you for 40 damage.
      `;
      
      const enemies = parseEnemyMatches(text);
      
      expect(enemies.length).toBeGreaterThan(0);
      expect(enemies.some(e => e.name.includes('Isu Sentinel') || e.name.includes('Sentinel'))).toBe(true);
      expect(enemies.some(e => e.name.includes('Dragon'))).toBe(true);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty text', () => {
      const enemies = detectEnemies('');
      expect(enemies).toEqual([]);
    });
    
    it('should handle text with no enemies', () => {
      const text = 'You walk through the forest peacefully.';
      const enemies = detectEnemies(text);
      
      expect(enemies).toEqual([]);
    });
  });
});
