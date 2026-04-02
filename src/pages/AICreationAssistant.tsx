import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAICreationChat, buildDataToWizardState, CharacterBuildData } from '@/hooks/use-ai-creation-chat';
import { presetToEquipment, getPresetById } from '@/components/wizard/presets/equipment-presets';
import ReactMarkdown from 'react-markdown';
import { setScopedItem } from '@/lib/scoped-storage';
import aiCreationBg from '@/assets/ai-creation-bg.jpeg';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { saveHomebrewContentFromBuildData } from '@/lib/ai-creation/saveHomebrew';
import { saveEmpyreanDMConfig, saveDragonNotes } from '@/lib/empyreanDMPersona';
import { saveBondState, DEFAULT_BOND, DEFAULT_TRUST, setIsUnbonded } from '@/lib/dragonBondState';

export default function AICreationAssistant() {
  const navigate = useNavigate();
  const { messages, isLoading, buildData, error, suggestions, sendMessage, reset } = useAICreationChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentGreeting = useRef(false);

  // Complexity meter: estimate token usage from conversation length
  const complexity = useMemo(() => {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 3.5);
    const maxTokens = 150000;
    const percent = Math.min(Math.round((estimatedTokens / maxTokens) * 100), 100);
    const level = percent < 50 ? 'low' : percent < 75 ? 'moderate' : percent < 90 ? 'high' : 'critical';
    return { percent, level, estimatedTokens };
  }, [messages]);

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
    
    // Save identity fields to scoped storage
    if (buildData.gender) {
      setScopedItem('dnd-character-gender', buildData.gender);
    }
    if (buildData.race) {
      setScopedItem('dnd-character-race', buildData.race);
    }
    if (buildData.backstory) {
      setScopedItem('dnd-character-backstory', buildData.backstory.slice(0, 2000));
    }

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

    // Save Empyrean dragon config if present
    if (buildData.empyrean) {
      const emp = buildData.empyrean;

      if (emp.unbonded) {
        setIsUnbonded(true);
      } else {
        setIsUnbonded(false);

        // Save the Empyrean DM campaign config
        saveEmpyreanDMConfig({
          selectedLoreGuides: [],
          selectedToneGuides: [],
          selectedSessionTemplate: null,
          characterName: buildData.name || '',
          dragonName: emp.dragonName || '',
          dragonColor: emp.dragonColor || 'deep-red',
          signetType: emp.signetType || '',
          yearAtBasgiath: emp.yearAtBasgiath || 'first-year',
          campaignFocus: (emp.campaignFocus as any) || 'balanced',
        });

        // Save dragon personality notes
        if (emp.dragonPersonality) {
          saveDragonNotes(emp.dragonPersonality);
        }

        // Initialize dragon bond state
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
      }

      // Set app mode to empyrean
      setScopedItem('odyssey-app-mode', 'empyrean');

      console.log('[AICreation] Saved Empyrean config:', {
        dragonName: emp.dragonName,
        signetType: emp.signetType,
        unbonded: emp.unbonded,
        campaignFocus: emp.campaignFocus,
      });
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
            <div className="flex-1">
              <p className="font-display text-sm font-bold text-foreground">AI Creation Assistant</p>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground">Build your character through conversation</p>
              </div>
            </div>
          </div>
          {/* Complexity indicator — only show after a few messages */}
          {messages.length > 2 && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex flex-col items-end gap-0.5">
                <span className={`text-[9px] font-display tracking-wider ${
                  complexity.level === 'critical' ? 'text-destructive animate-pulse' :
                  complexity.level === 'high' ? 'text-amber-400' :
                  complexity.level === 'moderate' ? 'text-yellow-500/70' :
                  'text-muted-foreground'
                }`}>
                  {complexity.level === 'critical' ? '⚠️ LIMIT' :
                   complexity.level === 'high' ? '🔥 HIGH' :
                   complexity.level === 'moderate' ? '📊 MED' :
                   '✨ LOW'}
                </span>
                <div className="w-16 h-1.5 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      complexity.level === 'critical' ? 'bg-destructive' :
                      complexity.level === 'high' ? 'bg-amber-400' :
                      complexity.level === 'moderate' ? 'bg-yellow-500' :
                      'bg-primary/60'
                    }`}
                    style={{ width: `${complexity.percent}%` }}
                  />
                </div>
              </div>
              {complexity.level === 'critical' && (
                <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
              )}
            </div>
          )}
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
              <div className="bg-destructive/20 border border-destructive/40 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-destructive shadow-lg max-w-[90%] space-y-2">
                <p className="font-display font-bold">⚠️ {error}</p>
                {(error.includes('too large') || error.includes('too complex') || error.includes('cut off')) && (
                  <div className="text-xs text-destructive/80 space-y-1">
                    <p>💡 Tips to fix this:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Reduce homebrew items (max 5 per category)</li>
                      <li>Keep descriptions short and mechanical</li>
                      <li>Try "Quick & Dirty" mode for a faster build</li>
                      <li>Start a new session with the button below</li>
                    </ul>
                    <Button
                      onClick={() => { reset(); hasSentGreeting.current = false; }}
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      🔄 Start Fresh
                    </Button>
                  </div>
                )}
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
