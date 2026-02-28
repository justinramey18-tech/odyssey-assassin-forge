import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAICreationChat, buildDataToWizardState, CharacterBuildData } from '@/hooks/use-ai-creation-chat';
import { presetToEquipment, getPresetById } from '@/components/wizard/presets/equipment-presets';
import ReactMarkdown from 'react-markdown';
import aiCreationBg from '@/assets/ai-creation-bg.jpeg';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { saveHomebrewContentFromBuildData } from '@/lib/ai-creation/saveHomebrew';

export default function AICreationAssistant() {
  const navigate = useNavigate();
  const { messages, isLoading, buildData, error, suggestions, sendMessage, reset } = useAICreationChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentGreeting = useRef(false);

  useEffect(() => {
    if (!hasSentGreeting.current && messages.length === 0) {
      hasSentGreeting.current = true;
      sendMessage('Hello, I want to create a character.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
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

  const handleApply = useCallback(() => {
    if (!buildData) return;
    
    const homebrewSummary = saveHomebrewContentFromBuildData(buildData);
    if (homebrewSummary.totalItems > 0) {
      console.log('[AICreation] Saved homebrew content:', homebrewSummary);
    }

    const wizardState = buildDataToWizardState(buildData);
    
    if (wizardState.selectedPresetId) {
      const preset = getPresetById(wizardState.selectedPresetId);
      if (preset) {
        wizardState.equipment = presetToEquipment(preset);
      }
    }

    if (homebrewSummary.createdGearItems.length > 0) {
      for (const item of homebrewSummary.createdGearItems) {
        const slot = item.slotType;
        if (slot && !wizardState.equipment.slots[slot]) {
          wizardState.equipment.slots[slot] = item;
        } else if (slot) {
          wizardState.equipment.inventory.push(item);
        }
      }
      console.log('[AICreation] Auto-equipped homebrew gear into slots');
    }

    if (buildData.alignment) {
      try {
        const activeId = localStorage.getItem('odyssey-active-cloud-save-id');
        const key = activeId
          ? `odyssey-alignment-drift_${activeId}`
          : 'odyssey-alignment-drift';
        const seedEntry = {
          promptId: '_ai_creation_seed',
          law: buildData.alignment.law,
          good: buildData.alignment.good,
          ts: Date.now(),
        };
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        existing.push(seedEntry);
        localStorage.setItem(key, JSON.stringify(existing.slice(-50)));
        console.log('[AICreation] Seeded alignment drift:', buildData.alignment);
      } catch (e) {
        console.error('[AICreation] Failed to store alignment:', e);
      }
    }

    navigate('/', { 
      state: { 
        aiCreatedCharacter: wizardState,
      } 
    });
  }, [buildData, navigate]);

  const handleBack = useCallback(() => {
    reset();
    navigate('/');
  }, [navigate, reset]);

  return (
    <BackgroundWrapper imagePath={aiCreationBg} overlayOpacity={75}>
      <div className="h-screen flex flex-col max-w-lg mx-auto relative">
        {/* Header */}
        <div className="shrink-0 z-50 bg-black/60 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-foreground">AI Creation Assistant</p>
              <p className="text-[10px] text-muted-foreground">Build your character through conversation</p>
            </div>
          </div>
        </div>

        {/* Messages — only this area scrolls */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-primary/30 text-foreground border border-primary/40 backdrop-blur-sm'
                    : 'bg-black/60 text-foreground border border-border/50 backdrop-blur-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>pre]:bg-black/40 [&>pre]:border [&>pre]:border-border/50 [&>pre]:rounded">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-black/60 border border-border/50 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-destructive/20 border border-destructive/40 backdrop-blur-sm rounded-lg px-3 py-2 text-sm text-destructive shadow-lg">
                {error}
              </div>
            </div>
          )}

          {suggestions.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-2 px-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput('');
                    sendMessage(s);
                  }}
                  className="px-3 py-1.5 text-xs font-display rounded-full border border-primary/40 bg-black/50 text-primary hover:bg-primary/20 backdrop-blur-sm transition-colors opacity-0 animate-scale-in shadow-lg"
                  style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Apply button */}
        {buildData && (
          <div className="shrink-0 px-4 py-2 border-t border-border/50 bg-black/60 backdrop-blur-md">
            <Button
              onClick={handleApply}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-display tracking-wider"
              size="lg"
            >
              ⚔️ Apply & Continue
            </Button>
          </div>
        )}

        {/* Input — fixed at bottom */}
        <div className="shrink-0 px-4 py-3 border-t border-border/50 bg-black/60 backdrop-blur-md">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your character..."
              rows={1}
              className="flex-1 resize-none bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-24 backdrop-blur-sm"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              variant="ghost"
              className="shrink-0 text-primary hover:bg-primary/10"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </BackgroundWrapper>
  );
}
