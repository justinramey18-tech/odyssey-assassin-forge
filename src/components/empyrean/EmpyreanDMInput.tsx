import { useState, useCallback, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { Send, ScrollText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAtMentionQuery, filterNPCNames } from '@/hooks/use-npc-autocomplete';
import { NPCAutocomplete } from '@/components/ai-dm/NPCAutocomplete';
import { useDraftPersist } from '@/hooks/use-draft-persist';

export interface EmpyreanDMInputHandle {
  setText: (text: string) => void;
  appendText: (text: string) => void;
  getText: () => string;
  focus: () => void;
}

interface EmpyreanDMInputProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenCharacterSheet: () => void;
  isLoading: boolean;
  npcNames: string[];
  placeholder?: string;
  npcSceneActive?: boolean;
  onNpcInterjection?: (text: string) => void;
  npcScenePlaceholder?: string;
}

export const EmpyreanDMInput = memo(forwardRef<EmpyreanDMInputHandle, EmpyreanDMInputProps>(function EmpyreanDMInput(
  { onSend, onCancel, onOpenCharacterSheet, isLoading, npcNames, placeholder, npcSceneActive, onNpcInterjection, npcScenePlaceholder },
  ref
) {
  const [input, setInput, clearInput] = useDraftPersist('odyssey-empyrean-dm-draft');
  const [npcInput, setNpcInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [acActiveIndex, setAcActiveIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mentionState = !npcSceneActive ? getAtMentionQuery(input, cursorPos) : null;
  const acSuggestions = mentionState ? filterNPCNames(npcNames, mentionState.query) : [];
  const showAc = acSuggestions.length > 0;

  const selectNPC = useCallback((name: string) => {
    if (!mentionState) return;
    const before = input.slice(0, mentionState.startIndex);
    const after = input.slice(cursorPos);
    const newText = `${before}@${name} ${after}`;
    setInput(newText);
    setAcActiveIndex(0);
    const newPos = mentionState.startIndex + name.length + 2;
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }, [mentionState, input, cursorPos, setInput]);

  const trackCursor = useCallback(() => {
    if (inputRef.current) setCursorPos(inputRef.current.selectionStart ?? 0);
  }, []);

  useImperativeHandle(ref, () => ({
    setText: (text: string) => {
      setInput(text);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
        }
      });
    },
    appendText: (text: string) => {
      setInput(prev => {
        const trimmed = (prev || '').trim();
        return trimmed ? trimmed + '\n' + text : text;
      });
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      });
    },
    getText: () => input,
    focus: () => inputRef.current?.focus(),
  }), [input, setInput]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (npcSceneActive) {
      setNpcInput(val);
    } else {
      setInput(val);
      setCursorPos(e.target.selectionStart ?? 0);
    }
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [npcSceneActive, setInput]);

  const handleSend = useCallback(() => {
    if (npcSceneActive) {
      if (npcInput.trim() && onNpcInterjection) {
        onNpcInterjection(npcInput.trim());
        setNpcInput('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
      }
    } else {
      if (!input.trim()) return;
      onSend(input.trim());
      clearInput();
      if (inputRef.current) inputRef.current.style.height = 'auto';
    }
  }, [input, npcInput, npcSceneActive, onSend, onNpcInterjection, clearInput]);

  const currentValue = npcSceneActive ? npcInput : input;
  const currentPlaceholder = npcSceneActive
    ? (npcScenePlaceholder || "Speak up — the NPCs will react to you...")
    : (placeholder || "What does your rider do... (@NPC to talk to an NPC)");

  return (
    <div className="flex items-end gap-2">
      {showAc && (
        <NPCAutocomplete
          names={acSuggestions}
          onSelect={selectNPC}
          activeIndex={acActiveIndex}
        />
      )}

      {!npcSceneActive && (
        <button
          onClick={onOpenCharacterSheet}
          className="p-2.5 rounded-lg hover:bg-sky-500/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          style={{ touchAction: 'manipulation' }}
          aria-label="Character Sheet"
        >
          <ScrollText className="w-5 h-5 text-sky-400" />
        </button>
      )}

      <textarea
        ref={inputRef}
        value={currentValue}
        onChange={handleChange}
        onSelect={npcSceneActive ? undefined : trackCursor}
        placeholder={currentPlaceholder}
        rows={1}
        className="flex-1 bg-card/30 border border-purple-500/20 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-400 max-h-[120px] min-h-[44px]"
        onKeyDown={e => {
          if (!npcSceneActive && showAc) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAcActiveIndex(i => (i + 1) % acSuggestions.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAcActiveIndex(i => (i - 1 + acSuggestions.length) % acSuggestions.length); return; }
            if (e.key === 'Tab' || (e.key === 'Enter' && showAc)) { e.preventDefault(); selectNPC(acSuggestions[acActiveIndex]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setCursorPos(0); return; }
          }
        }}
      />

      {isLoading ? (
        npcSceneActive ? (
          <button
            onClick={handleSend}
            disabled={!npcInput.trim()}
            className="p-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            style={{ touchAction: 'manipulation' }}
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="p-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5 text-red-400" />
          </button>
        )
      ) : (
        <button
          onClick={handleSend}
          disabled={!currentValue.trim()}
          className={cn(
            'p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0',
            currentValue.trim()
              ? 'bg-purple-600 hover:bg-purple-500 text-white'
              : 'bg-muted/30 text-muted-foreground',
          )}
          style={{ touchAction: 'manipulation' }}
        >
          <Send className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}));
