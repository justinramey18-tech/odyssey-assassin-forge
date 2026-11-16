// The "Become a Dragon Rider" assistant's screen: a full-screen chat with the Empyrean Guide that
// ends in a checked build and a Begin button. Used for a new rider (the start screen's card,
// route /empyrean-create) and for a new campaign for an existing rider (the Empyrean hub).

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, RefreshCw, Rocket, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useEmpyreanOnboardingChat, type OnboardingMode } from '@/hooks/use-empyrean-onboarding-chat';
import type { OnboardingResult } from '@/lib/empyrean-onboarding';
import { CONTINENT_PLACES } from '@/lib/empyreanCanon/continentMap';
import { DRAGON_COLORS } from '@/lib/dragonColors';

const TOUCH = { touchAction: 'manipulation' as const };
const placeName = (id: string) => CONTINENT_PLACES.find(p => p.id === id)?.name ?? id;
const colorName = (id: string) => DRAGON_COLORS.find(c => c.id === id)?.label ?? id;

interface Props {
  mode: OnboardingMode;
  characterName?: string;
  getLore: () => string;
  getRider?: () => string;
  /** Busy while Begin is being applied. */
  beginning?: boolean;
  onBegin: (result: OnboardingResult) => void;
  onClose: () => void;
  /** z-index class; the hub overlay sits above its own screens. */
  layer?: string;
}

export function EmpyreanOnboardingChat({ mode, characterName, getLore, getRider, beginning, onBegin, onClose, layer = 'z-[70]' }: Props) {
  const chat = useEmpyreanOnboardingChat({ mode, getLore, getRider });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  // The guide speaks first: send a greeting for the player when the chat is empty.
  useEffect(() => {
    if (greeted.current || chat.rawCount > 0) return;
    greeted.current = true;
    void chat.sendMessage(mode === 'rider'
      ? 'Hello. I want to become a dragon rider and start a solo Empyrean campaign.'
      : `Hello, I'm ${characterName || 'a rider'}. I want to start a new Empyrean campaign.`);
  }, [chat, mode, characterName]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    else el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isLoading]);

  const send = (text: string) => {
    if (!text.trim() || chat.isLoading) return;
    setInput('');
    void chat.sendMessage(text);
  };
  const r = chat.result;
  const summary = useMemo(() => {
    if (!r) return [];
    const lines: string[] = [];
    if (r.kind === 'rider') lines.push(`${r.character.name}, ${r.empyrean.yearAtBasgiath}`);
    lines.push(`🐉 ${r.empyrean.dragonName} (${colorName(r.empyrean.dragonColor)})`);
    if (r.empyrean.signetType) lines.push(`✨ ${r.empyrean.signetType}`);
    lines.push(`📍 Starts at ${placeName(r.campaign.startLocationId)} · random events ${r.campaign.events}`);
    return lines;
  }, [r]);

  return (
    <div className={cn('fixed inset-0 flex flex-col bg-gradient-to-b from-background via-background to-background/95', layer)}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-primary/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-cinzel font-semibold text-primary truncate">{mode === 'rider' ? 'Become a Dragon Rider' : 'A New Campaign'}</p>
            <p className="text-[11px] text-muted-foreground truncate">The Empyrean Guide builds it with you</p>
          </div>
        </div>
        <div className="flex items-center shrink-0">
          <Button variant="ghost" type="button" onClick={() => { chat.reset(); greeted.current = false; }} disabled={chat.isLoading || beginning}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg hover:bg-muted/50 disabled:opacity-40" style={TOUCH} aria-label="Start over">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" type="button" onClick={onClose} className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg hover:bg-muted/50" style={TOUCH} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
        {chat.messages.slice(1).map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[88%] rounded-lg px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-primary/15 text-foreground border border-primary/30 rounded-br-sm'
                : 'bg-card/60 text-foreground border border-border/40 rounded-bl-sm')}>
              {msg.role === 'assistant'
                ? <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_strong]:text-primary"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                : msg.content}
            </div>
          </div>
        ))}
        {chat.isLoading && chat.messages[chat.messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="bg-card/60 border border-border/40 rounded-lg rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> The guide is thinking…
            </div>
          </div>
        )}
        {chat.error && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2 text-center">{chat.error}</p>
          </div>
        )}
      </div>

      {r && (
        <div className="shrink-0 px-4 pb-2 space-y-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs space-y-0.5">
            {summary.map(line => <p key={line}>{line}</p>)}
          </div>
          <Button onClick={() => onBegin(r)} disabled={chat.isLoading || beginning} style={TOUCH}
            className="w-full min-h-[52px] bg-primary hover:bg-primary/90 text-primary-foreground font-cinzel font-semibold text-base gap-2">
            {beginning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />} Begin
          </Button>
          <Button variant="outline" disabled={chat.isLoading || beginning} style={TOUCH}
            onClick={() => send('Write a different opening scene. Keep every other choice the same, then send the full build again.')}
            className="w-full min-h-[48px] border-primary/30 text-primary text-xs gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> A different opening scene
          </Button>
        </div>
      )}

      {!r && !chat.isLoading && chat.suggestions.length > 0 && (
        <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-2">
          {chat.suggestions.map(s => (
            <Button variant="ghost" key={s} type="button" onClick={() => send(s)} style={TOUCH}
              className="shrink-0 min-h-[48px] px-3 rounded-full text-xs bg-primary/10 border border-primary/25 text-primary active:bg-primary/25 break-words">
              {s}
            </Button>
          ))}
        </div>
      )}

      <div className="shrink-0 border-t border-border/30 bg-background/80 p-3 flex gap-2" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Answer the guide…"
          rows={1}
          disabled={chat.isLoading || beginning}
          aria-label="Your answer"
          className="flex-1 resize-none bg-muted/30 border border-border/40 rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-50 min-h-[48px] max-h-32"
          style={TOUCH}
        />
        <Button onClick={() => send(input)} disabled={!input.trim() || chat.isLoading || beginning} aria-label="Send" style={TOUCH}
          className="h-12 w-12 p-0 shrink-0 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary disabled:opacity-40">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
