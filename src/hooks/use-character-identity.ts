import { useState, useCallback, useEffect } from 'react';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const GENDER_KEY = 'dnd-character-gender';
const RACE_KEY = 'dnd-character-race';
const BACKSTORY_KEY = 'dnd-character-backstory';
const RELATIONSHIPS_KEY = 'dnd-character-relationships';

const MAX_RELATIONSHIPS = 10;

// Fired when any instance of this hook writes, so other mounted instances stay in sync.
const IDENTITY_CHANGED_EVENT = 'odyssey-character-identity-change';

export interface CharacterRelationship {
  id: string;
  name: string;
  disposition: string;
  notes?: string;
}

function loadString(key: string): string {
  try {
    return getScopedItem(key) || '';
  } catch (e) {
    console.error(`[CharacterIdentity] Failed to load ${key}:`, e);
    return '';
  }
}

function loadRelationships(): CharacterRelationship[] {
  try {
    const saved = getScopedItem(RELATIONSHIPS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('[CharacterIdentity] Failed to load relationships:', e);
  }
  return [];
}

export function useCharacterIdentity() {
  const [gender, setGender] = useState(() => loadString(GENDER_KEY));
  const [race, setRace] = useState(() => loadString(RACE_KEY));
  const [backstory, setBackstory] = useState(() => loadString(BACKSTORY_KEY));
  const [relationships, setRelationships] = useState<CharacterRelationship[]>(() => loadRelationships());

  // Persist on change
  useEffect(() => {
    try { setScopedItem(GENDER_KEY, gender); } catch (e) { console.error('[CharacterIdentity] Failed to save gender:', e); }
  }, [gender]);

  useEffect(() => {
    try { setScopedItem(RACE_KEY, race); } catch (e) { console.error('[CharacterIdentity] Failed to save race:', e); }
  }, [race]);

  useEffect(() => {
    try { setScopedItem(BACKSTORY_KEY, backstory); } catch (e) { console.error('[CharacterIdentity] Failed to save backstory:', e); }
  }, [backstory]);

  useEffect(() => {
    try { setScopedItem(RELATIONSHIPS_KEY, JSON.stringify(relationships)); } catch (e) { console.error('[CharacterIdentity] Failed to save relationships:', e); }
  }, [relationships]);

  // Broadcast writes so other mounted instances (e.g. the solo DM character sheet) refresh
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(IDENTITY_CHANGED_EVENT));
  }, [gender, race, backstory, relationships]);

  // Re-init on character switch
  useEffect(() => {
    const handleCharacterLoaded = () => {
      setGender(loadString(GENDER_KEY));
      setRace(loadString(RACE_KEY));
      setBackstory(loadString(BACKSTORY_KEY));
      setRelationships(loadRelationships());
    };
    const handleIdentityChanged = () => {
      const nextGender = loadString(GENDER_KEY);
      const nextRace = loadString(RACE_KEY);
      const nextBackstory = loadString(BACKSTORY_KEY);
      const nextRelationships = loadRelationships();
      setGender(prev => (prev === nextGender ? prev : nextGender));
      setRace(prev => (prev === nextRace ? prev : nextRace));
      setBackstory(prev => (prev === nextBackstory ? prev : nextBackstory));
      setRelationships(prev => (JSON.stringify(prev) === JSON.stringify(nextRelationships) ? prev : nextRelationships));
    };
    window.addEventListener('odyssey-character-loaded', handleCharacterLoaded);
    window.addEventListener(IDENTITY_CHANGED_EVENT, handleIdentityChanged);
    return () => {
      window.removeEventListener('odyssey-character-loaded', handleCharacterLoaded);
      window.removeEventListener(IDENTITY_CHANGED_EVENT, handleIdentityChanged);
    };
  }, []);

  const addRelationship = useCallback((name: string, disposition: string, notes?: string): boolean => {
    let added = false;
    setRelationships(prev => {
      if (prev.length >= MAX_RELATIONSHIPS) return prev;
      added = true;
      return [...prev, { id: crypto.randomUUID(), name, disposition, notes }];
    });
    return added;
  }, []);

  const updateRelationship = useCallback((id: string, updates: Partial<Omit<CharacterRelationship, 'id'>>) => {
    setRelationships(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const removeRelationship = useCallback((id: string) => {
    setRelationships(prev => prev.filter(r => r.id !== id));
  }, []);

  return {
    gender, race, backstory, relationships,
    setGender, setRace, setBackstory,
    addRelationship, updateRelationship, removeRelationship,
  };
}
