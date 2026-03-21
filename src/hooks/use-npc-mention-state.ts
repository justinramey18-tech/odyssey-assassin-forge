import { useState, useCallback, useMemo, RefObject } from 'react';
import { useNPCAutocomplete, getAtMentionQuery, filterNPCNames } from '@/hooks/use-npc-autocomplete';
import type { Message } from '@/components/oracle/types';

/**
 * Encapsulates all NPC autocomplete state for a DM input textarea.
 * Returns props to spread on the textarea and a render function for the dropdown.
 */
export function useNPCMentionState(
  messages: Message[],
  inputRef: RefObject<HTMLTextAreaElement | null>,
  setInput: (value: string | ((prev: string) => string)) => void,
  currentInput: string,
) {
  const allNPCs = useNPCAutocomplete(messages);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);

  const mentionState = useMemo(() => {
    return getAtMentionQuery(currentInput, cursorPos);
  }, [currentInput, cursorPos]);

  const suggestions = useMemo(() => {
    if (!mentionState) return [];
    return filterNPCNames(allNPCs, mentionState.query);
  }, [mentionState, allNPCs]);

  const showAutocomplete = suggestions.length > 0;

  const selectNPC = useCallback((name: string) => {
    if (!mentionState || !inputRef.current) return;
    const before = currentInput.slice(0, mentionState.startIndex);
    const after = currentInput.slice(cursorPos);
    const newText = `${before}@${name} ${after}`;
    if (typeof setInput === 'function') {
      setInput(newText);
    }
    setActiveIndex(0);
    // Set cursor after the inserted name
    const newPos = mentionState.startIndex + name.length + 2; // @Name + space
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }, [mentionState, currentInput, cursorPos, setInput, inputRef]);

  const handleAutocompleteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showAutocomplete) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && showAutocomplete)) {
      e.preventDefault();
      selectNPC(suggestions[activeIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setCursorPos(0); // dismiss
      return true;
    }
    return false;
  }, [showAutocomplete, suggestions, activeIndex, selectNPC]);

  const trackCursor = useCallback(() => {
    if (inputRef.current) {
      setCursorPos(inputRef.current.selectionStart ?? 0);
    }
  }, [inputRef]);

  return {
    showAutocomplete,
    suggestions,
    activeIndex,
    selectNPC,
    handleAutocompleteKeyDown,
    trackCursor,
  };
}
