import { useState, useCallback, useEffect, useRef } from 'react';
import { HomebrewSpell, SpellCustomizationState } from '@/lib/spellCustomization/types';
import { loadSpellCustomization, saveSpellCustomization, generateHomebrewSpellId } from '@/lib/spellCustomization/utils';
import { registerCustomSpell, unregisterCustomSpell } from '@/lib/magic/spells';
import { toast } from 'sonner';

const SPELL_CUSTOMIZATION_CHANGE_EVENT = 'odyssey-spell-customization-changed';

export function useSpellCustomization() {
  const [state, setState] = useState<SpellCustomizationState>(loadSpellCustomization);
  const instanceId = useRef(Math.random().toString(36).slice(2));

  // Persist on change, then broadcast so other mounted instances re-read.
  const isFirstPersist = useRef(true);
  useEffect(() => {
    saveSpellCustomization(state);
    if (isFirstPersist.current) {
      isFirstPersist.current = false;
      return;
    }
    window.dispatchEvent(new CustomEvent(SPELL_CUSTOMIZATION_CHANGE_EVENT, {
      detail: { source: instanceId.current },
    }));
  }, [state]);

  // Register every homebrew spell with the global lookup registry.
  // There is deliberately NO cleanup that unregisters on unmount: the registry
  // is global and other screens read from it after this hook has gone away.
  // Instead, IDs that are no longer in state are pruned on each run.
  const registeredIdsRef = useRef<string[]>([]);
  useEffect(() => {
    const currentIds = state.homebrewSpells.map(s => s.id);
    registeredIdsRef.current
      .filter(id => !currentIds.includes(id))
      .forEach(id => unregisterCustomSpell(id));
    state.homebrewSpells.forEach(spell => registerCustomSpell(spell));
    registeredIdsRef.current = currentIds;
  }, [state.homebrewSpells]);

  // Re-read from storage when the active character changes, or when another
  // mounted instance of this hook edits the homebrew list.
  useEffect(() => {
    const reload = () => setState(loadSpellCustomization());
    const handleChanged = (e: Event) => {
      const src = (e as CustomEvent<{ source?: string }>).detail?.source;
      if (src === instanceId.current) return;
      reload();
    };
    window.addEventListener('odyssey-character-loaded', reload);
    window.addEventListener(SPELL_CUSTOMIZATION_CHANGE_EVENT, handleChanged as EventListener);
    return () => {
      window.removeEventListener('odyssey-character-loaded', reload);
      window.removeEventListener(SPELL_CUSTOMIZATION_CHANGE_EVENT, handleChanged as EventListener);
    };
  }, []);

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
