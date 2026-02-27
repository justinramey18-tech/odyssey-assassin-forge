import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAICreationChat, buildDataToWizardState } from '@/hooks/use-ai-creation-chat';
import { presetToEquipment, getPresetById } from '@/components/wizard/presets/equipment-presets';
import ReactMarkdown from 'react-markdown';
import wizardBackground from '@/assets/wizard-background.jpg';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';

export default function AICreationAssistant() {
  const navigate = useNavigate();
  const { messages, isLoading, buildData, error, suggestions, sendMessage, reset } = useAICreationChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentGreeting = useRef(false);

  // Auto-send greeting to trigger AI's first message
  useEffect(() => {
    if (!hasSentGreeting.current && messages.length === 0) {
      hasSentGreeting.current = true;
      sendMessage('Hello, I want to create a character.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth auto-scroll to bottom on new messages or loading state
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
    const wizardState = buildDataToWizardState(buildData);
    
    // Resolve equipment from preset
    if (wizardState.selectedPresetId) {
      const preset = getPresetById(wizardState.selectedPresetId);
      if (preset) {
        wizardState.equipment = presetToEquipment(preset);
      }
    }

    // Navigate to Index with the wizard state to apply
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
    <BackgroundWrapper imagePath={wizardBackground} overlayOpacity={90}>
      <div className="min-h-screen flex flex-col max-w-lg mx-auto relative">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
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

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary/20 text-foreground border border-primary/30'
                    : 'bg-card/80 text-foreground border border-border'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>pre]:bg-background/50 [&>pre]:border [&>pre]:border-border [&>pre]:rounded">
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
              <div className="bg-card/80 border border-border rounded-lg px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            </div>
          )}

          {/* Quick-reply suggestion chips */}
          {suggestions.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-2 px-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput('');
                    sendMessage(s);
                  }}
                  className="px-3 py-1.5 text-xs font-display rounded-full border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors animate-fade-in"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Apply button - shows when build data is ready */}
        {buildData && (
          <div className="px-4 py-2 border-t border-border bg-background/80 backdrop-blur-sm">
            <Button
              onClick={handleApply}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-display tracking-wider"
              size="lg"
            >
              ⚔️ Apply & Continue
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="sticky bottom-0 px-4 py-3 border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your character..."
              rows={1}
              className="flex-1 resize-none bg-card/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-24"
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
