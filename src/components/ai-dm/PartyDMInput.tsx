import { useState, useCallback, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { Send, Check, Paperclip, Loader2, Camera, Film, ImageIcon, BarChart3, Ghost, Music } from 'lucide-react';
import { useDraftPersist } from '@/hooks/use-draft-persist';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Image as LucideImage } from 'lucide-react';

export interface PartyDMInputHandle {
  /** Replace input text entirely */
  setText: (text: string) => void;
  /** Append text (on new line if existing text) */
  appendText: (text: string) => void;
}

interface PartyDMInputProps {
  onSubmit: (text: string) => void;
  onReady: () => void;
  onReadyAutopilot?: () => void;
  hasAfkGuide?: boolean;
  onPaste: (e: React.ClipboardEvent) => void;
  disabled?: boolean;
  hasPrompt?: boolean;
  currentUserId?: string;
  isUploadingPhoto?: boolean;
  isUploadingVideo?: boolean;
  isUploadingAudio?: boolean;
  onTakePhoto?: () => void;
  onRecordVideo?: () => void;
  onPickPhoto?: () => void;
  onPickVideo?: () => void;
  onPickAudio?: () => void;
  onCreatePoll?: () => void;
}

export const PartyDMInput = memo(forwardRef<PartyDMInputHandle, PartyDMInputProps>(function PartyDMInput(
  { onSubmit, onReady, onReadyAutopilot, hasAfkGuide, onPaste, disabled, hasPrompt, currentUserId, isUploadingPhoto, isUploadingVideo, isUploadingAudio, onTakePhoto, onRecordVideo, onPickPhoto, onPickVideo, onPickAudio, onCreatePoll },
  ref
) {
  const [input, setInput, clearInput] = useDraftPersist('odyssey-party-dm-draft');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setText: (text: string) => {
      setInput(text);
      // Reset textarea height on next tick
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
        }
      });
    },
    appendText: (text: string) => {
      setInput(prev => prev ? `${prev}\n${text}` : text);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
          inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
        }
      });
    },
  }), [setInput]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [setInput]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    onSubmit(input.trim());
    clearInput();
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, onSubmit, clearInput]);

  // Dismiss attach menu on outside click
  const attachMenuDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (showAttachMenu && !attachMenuDismissRef.current) {
    attachMenuDismissRef.current = setTimeout(() => {
      const dismiss = (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-attach-menu]')) return;
        setShowAttachMenu(false);
        document.removeEventListener('pointerdown', dismiss);
        attachMenuDismissRef.current = null;
      };
      document.addEventListener('pointerdown', dismiss);
    }, 0);
  }

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onPaste={onPaste}
          placeholder="What does your character do?"
          rows={1}
          className="flex-1 bg-white/5 border border-amber-900/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none min-h-[42px] max-h-[200px]"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || !!hasPrompt}
          className={cn(
            "p-2.5 rounded-xl border shrink-0 transition-colors",
            input.trim() ? "bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60" : "bg-white/5 border-white/10 opacity-40"
          )}
          style={{ touchAction: 'manipulation' }}
        >
          <Send className="w-5 h-5 text-amber-400" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onReady}
          className={cn("gap-1.5 bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60 text-emerald-300", hasAfkGuide ? "flex-1" : "flex-1")}
          size="sm"
        >
          <Check className="w-4 h-4" />
          {hasAfkGuide ? 'No Action' : 'Ready (No Action)'}
        </Button>
        {hasAfkGuide && (
          <Button
            onClick={onReadyAutopilot}
            className="flex-1 gap-1.5 bg-purple-900/40 border border-purple-500/30 hover:bg-purple-900/60 text-purple-300"
            size="sm"
          >
            <Ghost className="w-4 h-4" />
            Autopilot
          </Button>
        )}
        {currentUserId && (
          <div className="flex gap-1 shrink-0">
            <div className="relative" data-attach-menu>
              <button
                onClick={() => setShowAttachMenu(prev => !prev)}
                disabled={isUploadingPhoto || isUploadingVideo || isUploadingAudio}
                className="p-2 rounded-xl border border-white/10 hover:border-amber-500/30 bg-white/5 hover:bg-amber-900/20 transition-colors"
                style={{ touchAction: 'manipulation' }}
                title="Attach media"
              >
                {(isUploadingPhoto || isUploadingVideo || isUploadingAudio) ? (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4 text-white/50" />
                )}
              </button>
              {showAttachMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-black/95 border border-amber-900/30 rounded-xl p-1.5 z-20 shadow-xl space-y-0.5">
                  <button
                    onClick={() => { onTakePhoto?.(); setShowAttachMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </button>
                  <button
                    onClick={() => { onRecordVideo?.(); setShowAttachMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Film className="w-4 h-4" />
                    Record Video
                  </button>
                  <div className="border-t border-white/5 my-0.5" />
                  <button
                    onClick={() => { onPickPhoto?.(); setShowAttachMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <LucideImage className="w-4 h-4" />
                    Photo from Gallery
                  </button>
                  <button
                    onClick={() => { onPickVideo?.(); setShowAttachMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <Film className="w-4 h-4" />
                    Video from Gallery
                  </button>
                  <div className="border-t border-white/5 my-0.5" />
                  <button
                    onClick={() => { onCreatePoll?.(); setShowAttachMenu(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-amber-900/30 text-white/70 hover:text-amber-300 transition-colors text-xs"
                    style={{ touchAction: 'manipulation' }}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Create Poll
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}));
