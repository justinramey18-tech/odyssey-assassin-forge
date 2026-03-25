import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAICampaignChat, CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import ReactMarkdown from 'react-markdown';

interface CampaignBuilderChatProps {
  partyMembers?: Array<{ character_name: string; character_status?: Record<string, unknown> }>;
  characterName?: string;
  characterLevel?: number;
  onComplete: (data: CampaignBuildData) => void;
  onSkip: () => void;
}

export default function CampaignBuilderChat({ partyMembers, characterName, characterLevel, onComplete, onSkip }: CampaignBuilderChatProps) {
  const { messages, isLoading, buildData, error, suggestions, sendMessage, reset } = useAICampaignChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasSentGreeting = useRef(false);

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
      let greeting: string;
      if (partyMembers && partyMembers.length > 0) {
        const levelInfo = partyMembers.some(m => (m.character_status as any)?.level)
          ? ` Levels: ${partyMembers.map(m => `${m.character_name} (Lvl ${(m.character_status as any)?.level || '?'})`).join(', ')}.`
          : '';
        greeting = `Hello! I'm setting up a new campaign for my party. We have ${partyMembers.length} players: ${partyMembers.map(m => m.character_name).join(', ')}.${levelInfo}`;
      } else {
        const name = characterName || 'Adventurer';
        const lvl = characterLevel || 1;
        greeting = `Hello! I'm setting up a new solo campaign for my character ${name} (Level ${lvl}).`;
      }
      sendMessage(greeting);
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

  const handleKeyDown = (_e: React.KeyboardEvent) => {
    // intentionally no-op: Enter naturally inserts a newline in textarea
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-[#14080a] via-[#0d0d12] to-[#0a0a0f] flex flex-col">
      <div className="h-full flex flex-col max-w-lg mx-auto w-full relative">
        {/* Header */}
        <div className="shrink-0 z-50 bg-black/60 backdrop-blur-md border-b border-amber-900/30 px-4 py-3 flex items-center gap-3">
          <button onClick={onSkip} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-cinzel text-sm font-bold text-foreground">Campaign Architect</p>
              <p className="text-[10px] text-muted-foreground">Build your world through conversation</p>
            </div>
          </div>
          {messages.length > 2 && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex flex-col items-end gap-0.5">
                <span className={`text-[9px] font-cinzel tracking-wider ${
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
                      'bg-amber-500/60'
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

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-lg ${
                  msg.role === 'user'
                    ? 'bg-amber-500/20 text-foreground border border-amber-500/30 backdrop-blur-sm'
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
                <span className="w-2 h-2 rounded-full bg-amber-400/70 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-amber-400/70 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-amber-400/70 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-destructive/20 border border-destructive/40 backdrop-blur-sm rounded-lg px-4 py-3 text-sm text-destructive shadow-lg max-w-[90%] space-y-2">
                <p className="font-cinzel font-bold">⚠️ {error}</p>
                {(error.includes('too large') || error.includes('cut off')) && (
                  <div className="text-xs text-destructive/80 space-y-1">
                    <p>💡 Tips to fix this:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Ask for shorter descriptions</li>
                      <li>Reduce the number of NPCs or locations</li>
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
                  className="px-3 py-1.5 text-xs font-cinzel rounded-full border border-amber-500/40 bg-black/50 text-amber-400 hover:bg-amber-500/20 backdrop-blur-sm transition-colors opacity-0 animate-scale-in shadow-lg"
                  style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'forwards' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Begin Campaign button */}
        {buildData && (
          <div className="shrink-0 px-4 py-2 border-t border-amber-900/30 bg-black/60 backdrop-blur-md">
            <Button
              onClick={() => onComplete(buildData)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-cinzel tracking-wider"
              size="lg"
            >
              🏰 Begin Campaign
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-amber-900/30 bg-black/60 backdrop-blur-md">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your world..."
              rows={1}
              className="flex-1 resize-none bg-black/40 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 max-h-24 backdrop-blur-sm"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              variant="ghost"
              className="shrink-0 text-amber-400 hover:bg-amber-500/10"
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
    </div>
  );
}
