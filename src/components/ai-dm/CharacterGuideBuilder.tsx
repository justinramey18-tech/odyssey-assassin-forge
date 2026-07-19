import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Loader2, UserPlus, User, Users, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CharacterGuideBuilderProps {
  open: boolean;
  onClose: () => void;
  campaignType: 'dnd' | 'empyrean';
  campaignPlan?: string;
  onGuideCreated: (name: string, content: string) => void;
}

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export function CharacterGuideBuilder({
  open,
  onClose,
  campaignType,
  campaignPlan,
  onGuideCreated,
}: CharacterGuideBuilderProps) {
  const [buildMode, setBuildMode] = useState<'pc' | 'npc' | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [finalized, setFinalized] = useState<{ name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setBuildMode(null);
      setMessages([]);
      setInput('');
      setLoading(false);
      setFinalized(null);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const chooseMode = useCallback((mode: 'pc' | 'npc') => {
    setBuildMode(mode);
    const flavor = campaignType === 'empyrean' ? 'Fourth Wing / Empyrean' : 'D&D';
    const greeting =
      mode === 'pc'
        ? `Let's build your ${flavor} character. Tell me who they are — name, race/class or role, and a sentence or two on their personality or history. I'll ask a few follow-ups then wrap it into a character guide.`
        : `Let's build an NPC for the ${flavor} campaign. Tell me who they are — name, role in the world, and what makes them memorable. I'll ask a few follow-ups (including any secrets), then wrap it into an NPC guide.`;
    setMessages([{ role: 'assistant', content: greeting }]);
  }, [campaignType]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !buildMode || finalized) return;
    const nextMessages: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('character-guide-builder', {
        body: {
          user_message: text,
          chat_history: messages,
          campaign_plan: campaignPlan || '',
          build_mode: buildMode,
          campaign_type: campaignType,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const reply: string = data?.reply || '…';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (data?.guide_finalized?.character_name && data?.guide_finalized?.guide_markdown) {
        onGuideCreated(data.guide_finalized.character_name, data.guide_finalized.guide_markdown);
        setFinalized({ name: data.guide_finalized.character_name });
      }
    } catch (e: any) {
      console.error('[CharacterGuideBuilder]', e);
      toast.error(e?.message || 'Failed to reach the character guide builder');
    } finally {
      setLoading(false);
    }
  }, [input, loading, buildMode, finalized, messages, campaignPlan, campaignType, onGuideCreated]);

  if (!open) return null;

  const modeLabel = buildMode === 'pc' ? 'Player Character' : buildMode === 'npc' ? 'NPC' : '';

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-cinzel text-sm text-zinc-100 truncate">
              Create Character with AI
            </div>
            {buildMode && (
              <div className="text-xs text-zinc-500 truncate">Building: {modeLabel}</div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode picker */}
      {!buildMode && (
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4">
          <div className="text-center max-w-sm">
            <h2 className="font-cinzel text-lg text-zinc-100 mb-2">What are we building?</h2>
            <p className="text-sm text-zinc-400">
              This creates a GM guide that the DM will treat as authoritative for the character.
              You can edit it later in GM Guides.
            </p>
          </div>
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button
              onClick={() => chooseMode('pc')}
              className="w-full p-4 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-left transition"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-cinzel text-zinc-100">Player Character</div>
                  <div className="text-xs text-zinc-500">A character you'll play</div>
                </div>
              </div>
            </button>
            <button
              onClick={() => chooseMode('npc')}
              className="w-full p-4 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-left transition"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-400" />
                <div>
                  <div className="font-cinzel text-zinc-100">NPC</div>
                  <div className="text-xs text-zinc-500">A character the DM controls</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Chat */}
      {buildMode && !finalized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
                    m.role === 'user'
                      ? 'bg-emerald-600/80 text-white'
                      : 'bg-zinc-800 text-zinc-100'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-zinc-400 rounded-2xl px-4 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Describe your character…"
                rows={2}
                className="flex-1 resize-none rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className={cn(
                  'p-3 rounded-xl transition shrink-0',
                  loading || !input.trim()
                    ? 'bg-zinc-800 text-zinc-600'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                )}
                aria-label="Send"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Success */}
      {finalized && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
          <CheckCircle2 className="w-14 h-14 text-emerald-400" />
          <div>
            <h2 className="font-cinzel text-lg text-zinc-100">Character guide created!</h2>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm">
              <span className="text-zinc-200">{finalized.name}</span> has been added to your GM
              Guides and is now active. You can edit it anytime from GM Guides.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-cinzel"
          >
            Done
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

export default CharacterGuideBuilder;
