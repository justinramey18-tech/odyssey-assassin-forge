import { useState, useCallback, useEffect } from 'react';
import { HomebrewSpell, SpellCustomizationState } from '@/lib/spellCustomization/types';
import { loadSpellCustomization, saveSpellCustomization, generateHomebrewSpellId } from '@/lib/spellCustomization/utils';
import { registerCustomSpell, unregisterCustomSpell } from '@/lib/magic/spells';
import { toast } from 'sonner';

export function useSpellCustomization() {
  const [state, setState] = useState<SpellCustomizationState>(loadSpellCustomization);

  // Persist on change
  useEffect(() => {
    saveSpellCustomization(state);
  }, [state]);

  // Register/unregister custom spells with the global registry
  useEffect(() => {
    // Register all homebrew spells
    state.homebrewSpells.forEach(spell => {
      registerCustomSpell(spell);
    });

    return () => {
      // Cleanup on unmount
      state.homebrewSpells.forEach(spell => {
        unregisterCustomSpell(spell.id);
      });
    };
  }, [state.homebrewSpells]);

  const addSpell = useCallback((spell: HomebrewSpell): void => {
    setState(prev => ({
      ...prev,
      homebrewSpells: [...prev.homebrewSpells, spell],
    }));
    toast.success(`Created "${spell.name}"!`);
  }, []);

  const updateSpell = useCallback((id: string, updates: Partial<HomebrewSpell>): void => {
    setState(prev => ({
      ...prev,
      homebrewSpells: prev.homebrewSpells.map(s =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    }));
  }, []);

  const removeSpell = useCallback((id: string): void => {
    setState(prev => {
      const spell = prev.homebrewSpells.find(s => s.id === id);
      if (spell) {
        unregisterCustomSpell(id);
        toast.success(`Removed "${spell.name}"`);
      }
      return {
        ...prev,
        homebrewSpells: prev.homebrewSpells.filter(s => s.id !== id),
      };
    });
  }, []);

  const duplicateSpell = useCallback((id: string): void => {
    setState(prev => {
      const spell = prev.homebrewSpells.find(s => s.id === id);
      if (!spell) return prev;
      const copy: HomebrewSpell = {
        ...spell,
        id: generateHomebrewSpellId(),
        name: `${spell.name} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return {
        ...prev,
        homebrewSpells: [...prev.homebrewSpells, copy],
      };
    });
  }, []);

  return {
    homebrewSpells: state.homebrewSpells,
    addSpell,
    updateSpell,
    removeSpell,
    duplicateSpell,
  };
}
