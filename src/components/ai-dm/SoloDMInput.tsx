import { useState, useCallback, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAtMentionQuery, filterNPCNames } from '@/hooks/use-npc-autocomplete';
import { NPCAutocomplete } from './NPCAutocomplete';
import { useDraftPersist } from '@/hooks/use-draft-persist';

export interface SoloDMInputHandle {
  setText: (text: string) => void;
  appendText: (text: string) => void;
  getText: () => string;
  focus: () => void;
}

interface SoloDMInputProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
  isLoading: boolean;
  npcNames: string[];
  inputClassName?: string;
  sendActiveClassName?: string;
  placeholder?: string;
}

export const SoloDMInput = memo(forwardRef<SoloDMInputHandle, SoloDMInputProps>(function SoloDMInput(
  { onSend, onCancel, onPaste, isLoading, npcNames, inputClassName, sendActiveClassName, placeholder },
  ref
) {
  const [input, setInput, clearInput] = useDraftPersist('odyssey-solo-dm-draft');
  const [cursorPos, setCursorPos] = useState(0);
  const [acActiveIndex, setAcActiveIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mentionState = getAtMentionQuery(input, cursorPos);
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
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
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
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      });
    },
    getText: () => input,
    focus: () => inputRef.current?.focus(),
  }), [input, setInput]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    setCursorPos(ta.selectionStart ?? 0);
  }, [setInput]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    onSend(input.trim());
    clearInput();
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, onSend, clearInput]);

  return (
    <div className="relative flex items-end gap-2">
      {showAc && (
        <NPCAutocomplete
          names={acSuggestions}
          onSelect={selectNPC}
          activeIndex={acActiveIndex}
        />
      )}
      <textarea
        ref={inputRef}
        value={input}
        onChange={handleChange}
        onKeyDown={e => {
          if (showAc) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAcActiveIndex(i => (i + 1) % acSuggestions.length); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAcActiveIndex(i => (i - 1 + acSuggestions.length) % acSuggestions.length); return; }
            if (e.key === 'Tab' || (e.key === 'Enter' && showAc)) { e.preventDefault(); selectNPC(acSuggestions[acActiveIndex]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setCursorPos(0); return; }
          }
        }}
        onSelect={trackCursor}
        onPaste={onPaste}
        placeholder={placeholder || "What do you do? (@NPC to talk to an NPC)"}
        rows={1}
        className={cn("flex-1 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none resize-none min-h-[42px] max-h-[200px]", inputClassName)}
        disabled={isLoading}
      />
      {isLoading ? (
        <button
          onClick={onCancel}
          className="p-2.5 rounded-xl bg-red-900/40 border border-red-500/30 hover:bg-red-900/60 transition-colors shrink-0"
          style={{ touchAction: 'manipulation' }}
        >
          <Square className="w-5 h-5 text-red-400" />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={cn(
            "p-2.5 rounded-xl border shrink-0 transition-colors",
            input.trim()
              ? (sendActiveClassName || "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60")
              : "bg-white/5 border-white/10 opacity-40"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          <Send className="w-5 h-5 text-amber-400" />
        </button>
      )}
    </div>
  );
}));
