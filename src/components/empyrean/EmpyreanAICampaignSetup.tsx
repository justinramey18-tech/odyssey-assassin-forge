import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Loader2, Rocket, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useEmpyreanSetupChat } from '@/hooks/use-empyrean-setup-chat';
import {
  saveEmpyreanDMConfig,
  saveDragonNotes,
  EmpyreanDMConfig,
  CampaignFocus,
} from '@/lib/empyreanDMPersona';
import {
  saveBondState,
  DEFAULT_BOND,
  DEFAULT_TRUST,
  setIsUnbonded,
} from '@/lib/dragonBondState';

interface EmpyreanAICampaignSetupProps {
  open: boolean;
  onClose: () => void;
  characterName: string;
  onLaunch: (config: EmpyreanDMConfig, openingPrompt: string) => void;
}

export function EmpyreanAICampaignSetup({
  open,
  onClose,
  characterName,
  onLaunch,
}: EmpyreanAICampaignSetupProps) {
  const { messages, isLoading, buildData, suggestions, error, sendMessage, reset } = useEmpyreanSetupChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentGreeting = useRef(false);

  useEffect(() => {
    if (open && !hasSentGreeting.current && messages.length === 0) {
      hasSentGreeting.current = true;
      const greeting = characterName
        ? `Hello, I'm ${characterName}. I want to set up my Empyrean campaign.`
        : `Hello, I want to set up my Empyrean campaign.`;
      sendMessage(greeting);
    }
    if (!open) {
      hasSentGreeting.current = false;
    }
  }, [open, characterName, messages.length, sendMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = useCallback((s: string) => {
    if (isLoading) return;
    sendMessage(s);
  }, [isLoading, sendMessage]);

  const handleApplyAndLaunch = useCallback(() => {
    if (!buildData) return;

    try {
      const config: EmpyreanDMConfig = {
        selectedLoreGuides: [],
        selectedToneGuides: [],
        selectedSessionTemplate: null,
        characterName: buildData.characterName || characterName || 'Rider',
        dragonName: buildData.dragonName || '',
        dragonColor: buildData.dragonColor || 'deep-red',
        signetType: buildData.signetType || '',
        yearAtBasgiath: buildData.yearAtBasgiath || 'first-year',
        campaignFocus: (buildData.campaignFocus as CampaignFocus) || 'balanced',
      };

      saveEmpyreanDMConfig(config);

      if (buildData.dragonPersonality && buildData.dragonPersonality.trim().length > 0) {
        saveDragonNotes(buildData.dragonPersonality.trim());
      }

      setIsUnbonded(false);
      saveBondState({
        bond: DEFAULT_BOND,
        trust: DEFAULT_TRUST,
        mood: 'calm',
        memories: [],
        totalChatExchanges: 0,
        sessionChatCount: 0,
        ruptures: 0,
        lastContactTimestamp: null,
        unreadDragonMessages: [],
      });

      const openingPrompt = buildData.openingScene || '';

      toast.success('Campaign forged. Entering Navarre...');

      reset();

      onLaunch(config, openingPrompt);
    } catch (e) {
      console.error('[EmpyreanAISetup] Failed to apply build data:', e);
      toast.error('Failed to save campaign. Check console for details.');
    }
  }, [buildData, characterName, onLaunch, reset]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-purple-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-cinzel font-semibold text-purple-300 truncate">Empyrean Herald</p>
            <p className="text-[10px] text-muted-foreground truncate">Talk through your setup — I'll forge the campaign</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-purple-500/20 text-purple-100 border border-purple-500/30 rounded-br-sm'
                  : 'bg-card/60 text-foreground border border-border/40 rounded-bl-sm backdrop-blur-sm'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_strong]:text-amber-300">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card/60 border border-border/40 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-center">
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Apply button — shown when buildData is ready */}
      {buildData && (
        <div className="shrink-0 px-4 pb-2">
          <Button
            onClick={handleApplyAndLaunch}
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-amber-500 hover:from-purple-600 hover:to-amber-600 text-white font-cinzel font-semibold text-sm gap-2"
            style={{ touchAction: 'manipulation' }}
          >
            <Rocket className="w-4 h-4" />
            Apply & Enter Navarre
          </Button>
        </div>
      )}

      {/* Suggestions */}
      {!isLoading && suggestions.length > 0 && !buildData && (
        <div className="shrink-0 px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none flex-nowrap">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-purple-500/10 border border-purple-500/25 text-purple-300 hover:bg-purple-500/20 active:bg-purple-500/30 transition-colors whitespace-nowrap"
              style={{ touchAction: 'manipulation' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border/30 bg-background/80 backdrop-blur-sm p-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          rows={1}
          disabled={isLoading}
          className="flex-1 resize-none bg-muted/30 border border-border/40 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-purple-500/40 disabled:opacity-50 min-h-[44px] max-h-32"
          style={{ touchAction: 'manipulation' }}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="h-11 w-11 p-0 shrink-0 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 disabled:opacity-40"
          style={{ touchAction: 'manipulation' }}
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
