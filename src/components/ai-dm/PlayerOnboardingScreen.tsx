import { useState, useCallback, useEffect, useRef } from 'react';
import { Send, Loader2, MessageCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePlayerOnboarding, type FinalizedCharacter } from '@/hooks/use-player-onboarding';

interface PlayerOnboardingScreenProps {
  open: boolean;
  partyId: string | null;
  userId: string | null;
  campaignPlan?: string;
  hostCharacterSummary?: string;
  playerExistingCharacter?: string;
  campaignType?: 'dnd' | 'empyrean';
  /** Called after the player's character is successfully applied. Parent should hide the screen. */
  onComplete: () => void;
}

export function PlayerOnboardingScreen({
  open,
  partyId,
  userId,
  campaignPlan,
  hostCharacterSummary,
  playerExistingCharacter,
  campaignType,
  onComplete,
}: PlayerOnboardingScreenProps) {
  const { messages, isSending, error, pendingFinalized, isApplying, send, apply, dismissFinalized } = usePlayerOnboarding({
    partyId, userId, campaignPlan, hostCharacterSummary, playerExistingCharacter, campaignType,
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isSending) return;
    const text = input;
    setInput('');
    send(text);
  }, [input, isSending, send]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleConfirm = useCallback(async () => {
    const ok = await apply();
    if (ok) onComplete();
  }, [apply, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[78] flex flex-col bg-gradient-to-b from-[#080510] via-background to-background/95">
      <div className="shrink-0 px-4 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-cinzel font-semibold text-foreground">Character Onboarding</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          The host built the world. Now let's build your character.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-amber-600/20 border border-amber-500/30 text-amber-100'
                : 'bg-white/5 border border-white/10 text-foreground'
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 bg-white/5 border border-white/10 text-muted-foreground text-sm inline-flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            {error}
          </div>
        )}

        {pendingFinalized && (
          <FinalizeCard
            character={pendingFinalized}
            onConfirm={handleConfirm}
            onEdit={dismissFinalized}
            isApplying={isApplying}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-border/40 p-2">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your character..."
            rows={1}
            maxLength={2000}
            className="min-h-[44px] max-h-32 resize-none text-sm"
            disabled={isSending || isApplying}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending || isApplying}
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white h-11 w-11 p-0"
            aria-label="Send"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FinalizeCard({ character, onConfirm, onEdit, isApplying }: {
  character: FinalizedCharacter;
  onConfirm: () => void;
  onEdit: () => void;
  isApplying: boolean;
}) {
  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
        Ready to apply
      </div>
      <div className="space-y-1.5 text-xs">
        <Field label="Character" value={character.character_name} />
        {character.dragon_name && <Field label="Dragon" value={`${character.dragon_name}${character.dragon_color ? ` (${character.dragon_color})` : ''}`} />}
        {character.signet_type && <Field label="Signet" value={character.signet_type} />}
        {character.year_at_basgiath && <Field label="Year" value={character.year_at_basgiath} />}
        {character.backstory && <Field label="Backstory" value={character.backstory} />}
        {character.personality && <Field label="Personality" value={character.personality} />}
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          onClick={onConfirm}
          disabled={isApplying}
          size="sm"
          className="flex-1 h-9 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Apply character
        </Button>
        <Button
          onClick={onEdit}
          disabled={isApplying}
          size="sm"
          variant="outline"
          className="h-9 text-xs"
        >
          Keep editing
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-emerald-200/70">{label}</div>
      <div className="text-white/90 leading-snug">{value}</div>
    </div>
  );
}
