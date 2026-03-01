import { useState, useEffect, useRef, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Ghost, Save, Trash2, Sparkles, MessageSquare, Send, ChevronDown, ChevronUp, ArrowDownToLine, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { loadApiKey } from '@/lib/api-keys';
import ReactMarkdown from 'react-markdown';

const MAX_GUIDE_LENGTH = 2000;
const GUIDE_REGEX = /\[GUIDE_START\]([\s\S]*?)\[GUIDE_END\]/;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AfkPersonalityGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyId: string;
  userId: string;
  characterName: string;
  currentGuide: string | null;
  onSaved: (guide: string | null) => void;
}

export function AfkPersonalityGuide({
  open,
  onOpenChange,
  partyId,
  userId,
  characterName,
  currentGuide,
  onSaved,
}: AfkPersonalityGuideProps) {
  const [guide, setGuide] = useState('');
  const [saving, setSaving] = useState(false);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [extractedGuide, setExtractedGuide] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setGuide(currentGuide || '');
    } else {
      // Reset chat on close
      setChatMessages([]);
      setChatInput('');
      setChatOpen(false);
      setExtractedGuide(null);
      setIsStreaming(false);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [open, currentGuide]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Check for guide blocks in messages
  useEffect(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      const msg = chatMessages[i];
      if (msg.role === 'assistant') {
        const match = msg.content.match(GUIDE_REGEX);
        if (match) {
          setExtractedGuide(match[1].trim());
          return;
        }
      }
    }
    setExtractedGuide(null);
  }, [chatMessages]);

  const sendChatMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantContent = '';

    try {
      const anthropicKey = loadApiKey('anthropic');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/afk-guide-chat`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          characterName,
          user_api_key: anthropicKey || undefined,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Stream failed' }));
        toast.error(err.error || 'AI request failed');
        setIsStreaming(false);
        return;
      }

      if (!resp.body) {
        toast.error('No response stream');
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setChatMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            // partial JSON, wait for more
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Chat stream error:', e);
        toast.error('Chat failed');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [chatInput, chatMessages, isStreaming, characterName]);

  const handleInsertGuide = () => {
    if (extractedGuide) {
      setGuide(extractedGuide.slice(0, MAX_GUIDE_LENGTH));
      toast.success('Guide inserted! Review and save when ready.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: member } = await (supabase.from('party_members') as any)
        .select('character_status')
        .eq('party_id', partyId)
        .eq('user_id', userId)
        .single();

      const currentStatus = (member?.character_status as Record<string, unknown>) || {};
      const trimmed = guide.trim() || null;

      await (supabase.from('party_members') as any)
        .update({
          character_status: {
            ...currentStatus,
            afkPersonalityGuide: trimmed,
          },
        })
        .eq('party_id', partyId)
        .eq('user_id', userId);

      onSaved(trimmed);
      toast.success(trimmed ? 'AFK guide saved!' : 'AFK guide removed');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save AFK guide:', err);
      toast.error('Failed to save AFK guide');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setGuide('');
    setSaving(true);
    try {
      const { data: member } = await (supabase.from('party_members') as any)
        .select('character_status')
        .eq('party_id', partyId)
        .eq('user_id', userId)
        .single();

      const currentStatus = (member?.character_status as Record<string, unknown>) || {};

      await (supabase.from('party_members') as any)
        .update({
          character_status: {
            ...currentStatus,
            afkPersonalityGuide: null,
          },
        })
        .eq('party_id', partyId)
        .eq('user_id', userId);

      onSaved(null);
      toast.success('AFK guide removed');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to clear AFK guide:', err);
      toast.error('Failed to clear AFK guide');
    } finally {
      setSaving(false);
    }
  };

  // Start chat with AI greeting on first open
  const handleToggleChat = () => {
    const willOpen = !chatOpen;
    setChatOpen(willOpen);
    if (willOpen && chatMessages.length === 0) {
      // Send an initial "start" message to trigger the AI's first question
      setChatMessages([]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        let assistantContent = '';
        try {
          const anthropicKey = loadApiKey('anthropic');
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/afk-guide-chat`;

          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'Start the interview.' }],
              characterName,
              user_api_key: anthropicKey || undefined,
            }),
            signal: controller.signal,
          });

          if (!resp.ok || !resp.body) {
            setIsStreaming(false);
            return;
          }

          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 1);
              if (line.endsWith('\r')) line = line.slice(0, -1);
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  assistantContent += delta;
                  setChatMessages([{ role: 'assistant', content: assistantContent }]);
                }
              } catch { /* partial */ }
            }
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') console.error('Init chat error:', e);
        } finally {
          setIsStreaming(false);
          abortRef.current = null;
        }
      })();
    }
  };

  /** Strip guide markers from displayed messages */
  const renderMessageContent = (content: string) => {
    const cleaned = content.replace(/\[GUIDE_START\]/g, '').replace(/\[GUIDE_END\]/g, '');
    return (
      <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-1 [&>p:last-child]:mb-0">
        <ReactMarkdown>{cleaned}</ReactMarkdown>
      </div>
    );
  };

  const hasAnthropicKey = !!loadApiKey('anthropic');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] p-0 bg-background/95 backdrop-blur-xl border-t-2 border-purple-500/30 rounded-none flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="p-4 pb-2 border-b border-purple-500/20 bg-purple-950/30 shrink-0">
          <SheetTitle className="font-cinzel text-lg flex items-center gap-2 text-purple-200">
            <Ghost className="w-5 h-5 text-purple-400" />
            AFK Personality Guide
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Describe how {characterName} should act when you're away. The AI will roleplay your character using this guide when the round timer expires.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {/* AI Guide Builder - Collapsible */}
          <Collapsible open={chatOpen} onOpenChange={handleToggleChat}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 text-purple-200 justify-between"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  AI Guide Builder
                </span>
                {chatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border border-purple-500/20 bg-purple-950/10 overflow-hidden flex flex-col" style={{ maxHeight: '50vh' }}>
                {!hasAnthropicKey && (
                  <div className="px-3 py-2 text-[11px] text-amber-400/80 bg-amber-500/5 border-b border-amber-500/10">
                    No Anthropic key set — using Lovable AI. Add your key in Settings for Claude 4.5 Sonnet.
                  </div>
                )}

                {/* Chat messages */}
                <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: '35vh' }}>
                  <div className="p-3 space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === 'user'
                              ? 'bg-purple-600/30 text-purple-100 border border-purple-500/20'
                              : 'bg-muted/40 text-foreground border border-border/30'
                          }`}
                        >
                          {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
                        </div>
                      </div>
                    ))}

                    {isStreaming && chatMessages.length === 0 && (
                      <div className="flex justify-start">
                        <div className="bg-muted/40 border border-border/30 rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>

                {/* Insert guide button */}
                {extractedGuide && (
                  <div className="px-3 py-2 border-t border-purple-500/20 bg-purple-900/20">
                    <Button
                      size="sm"
                      onClick={handleInsertGuide}
                      className="w-full gap-2 bg-purple-600/40 hover:bg-purple-600/60 text-purple-100 border border-purple-500/30"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      Insert Guide into Textarea
                    </Button>
                  </div>
                )}

                {/* Chat input */}
                <div className="p-2 border-t border-purple-500/20 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                    placeholder="Answer the question..."
                    className="flex-1 h-8 text-sm bg-background/50 border-border/50"
                    disabled={isStreaming}
                  />
                  <Button
                    size="sm"
                    onClick={sendChatMessage}
                    disabled={isStreaming || !chatInput.trim()}
                    className="h-8 px-3 bg-purple-600/40 hover:bg-purple-600/60 border border-purple-500/30"
                  >
                    {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Main textarea */}
          <Textarea
            value={guide}
            onChange={(e) => setGuide(e.target.value.slice(0, MAX_GUIDE_LENGTH))}
            placeholder={`Example: ${characterName} is cautious and always protects the party healer. They prefer ranged attacks and will retreat if HP drops below 30%. They speak with dry sarcasm and rarely trust strangers.`}
            className="min-h-[200px] flex-1 resize-y bg-background/50 border-border/50 focus:border-purple-500/50 focus:ring-purple-500/20"
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {guide.length}/{MAX_GUIDE_LENGTH}
          </p>
        </div>

        <SheetFooter className="p-4 pt-2 border-t border-purple-500/20 shrink-0 gap-2 sm:gap-2 flex-row justify-end">
          {currentGuide && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving}
              className="gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </Button>
          )}
          <Button
            onClick={handleSave}
            size="sm"
            disabled={saving}
            className="gap-1 bg-purple-900/60 border border-purple-500/30 hover:bg-purple-900/80 text-purple-200"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Guide'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
