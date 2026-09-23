import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { usePartyDirector, type DirectorCategory, type DirectorMessage } from '@/hooks/use-party-director';
import directorBg from '@/assets/director/director-bg.jpg.asset.json';
import playerFrame from '@/assets/director/director-player-frame.png.asset.json';
import dmFrame from '@/assets/director/director-dm-frame.png.asset.json';
import dmCrest from '@/assets/director/director-dm-crest.png.asset.json';
import noticeStrip from '@/assets/director/director-notice-strip.png.asset.json';
import inputBar from '@/assets/director/director-input-bar.png.asset.json';
import sealChannel from '@/assets/director/seal-channel.png.asset.json';
import sealSend from '@/assets/director/seal-send.png.asset.json';
import sealQuestion from '@/assets/director/seal-question.png.asset.json';
import sealPrivate from '@/assets/director/seal-private.png.asset.json';
import sealPublic from '@/assets/director/seal-public.png.asset.json';
import sealPending from '@/assets/director/seal-pending.png.asset.json';
import sealRejected from '@/assets/director/seal-rejected.png.asset.json';
import sealApproved from '@/assets/director/seal-approved.png.asset.json';
const directorBgUrl = directorBg.url;
const playerFrameUrl = playerFrame.url;
const dmFrameUrl = dmFrame.url;
const dmCrestUrl = dmCrest.url;
const noticeStripUrl = noticeStrip.url;
const inputBarUrl = inputBar.url;
const sealChannelUrl = sealChannel.url;
const sealSendUrl = sealSend.url;
const sealQuestionUrl = sealQuestion.url;
const sealPrivateUrl = sealPrivate.url;
const sealPublicUrl = sealPublic.url;
const sealPendingUrl = sealPending.url;
const sealRejectedUrl = sealRejected.url;
const sealApprovedUrl = sealApproved.url;

interface PartyDirectorScreenProps {
  open: boolean;
  onClose: () => void;
  partyId: string | null;
  userId: string | null;
  campaignPlan?: string;
  characterContext?: string;
  /** Parent submits this text to the regular round when AI classifies as public_action. */
  onPublicAction?: (actionText: string) => void;
}

export function PartyDirectorScreen({
  open, onClose, partyId, userId, campaignPlan, characterContext, onPublicAction,
}: PartyDirectorScreenProps) {
  const { messages, isSending, error, send, overrideMessage } = usePartyDirector({
    partyId, userId, campaignPlan, characterContext, onPublicAction,
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, isSending]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[78] flex flex-col bg-[#07040a]"
      style={{ backgroundImage: `url(${directorBgUrl})`, backgroundSize: 'cover', backgroundPosition: 'top center' }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(6,3,5,.1) 0%, rgba(6,3,5,.45) 30%, rgba(6,3,5,.72) 100%)' }} />

      {/* Header */}
      <div className="relative shrink-0 flex items-center gap-2.5 px-3 pb-3 pt-[max(0.625rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/85 to-black/35">
        <img src={sealChannelUrl} alt="" draggable={false} className="h-12 w-12 shrink-0 drop-shadow-[0_0_8px_rgba(220,38,38,0.45)]" />
        <div className="min-w-0">
          <h2 className="font-cinzel text-[17px] font-bold tracking-[0.04em] text-[#FFE4AA] [text-shadow:0_0_8px_rgba(245,158,11,0.55),0_1px_2px_#000]">Director's Channel</h2>
          <p className="mt-0.5 text-[11px] text-amber-100/60">Only you and the DM can see this.</p>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ touchAction: 'manipulation' }}
          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-yellow-500/55 bg-black/60 text-amber-300 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)] active:scale-95">
          <X className="h-4 w-4" />
        </button>
        <div aria-hidden="true" className="absolute inset-x-3 bottom-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(185,28,28,.7), rgba(234,179,8,.8), rgba(185,28,28,.7), transparent)' }} />
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-3.5">
        {messages.length === 0 && !isSending && (
          <div className="py-8 px-4 text-center space-y-3">
            <img src={sealChannelUrl} alt="" className="mx-auto h-24 w-24 drop-shadow-[0_0_14px_rgba(220,38,38,0.45)]" />
            <p className="font-cinzel text-base font-bold text-[#FFE4AA]">Private channel to the DM</p>
            <p className="mx-auto max-w-xs text-xs leading-relaxed text-amber-100/65">
              The DM hears everything you say here. Other players don't. Use this for questions, secret moves, or hidden character details.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <DirectorMessageBubble
            key={msg.id}
            msg={msg}
            onOverride={overrideMessage}
          />
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/25 bg-black/55 py-1.5 pl-1.5 pr-3 text-[12.5px] italic text-amber-100/70">
              <img src={sealChannelUrl} alt="" className="h-[26px] w-[26px] animate-pulse" />
              <span>The DM is considering…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Input bar + wax-seal send button */}
      <div className="relative shrink-0 flex items-center gap-2 px-2.5 pt-2 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 to-black/50">
        <div className="flex min-h-[56px] flex-1 items-center"
          style={{ borderStyle: 'solid', borderWidth: '18px 28px', borderImage: `url(${inputBarUrl}) 70 108 fill / 18px 28px stretch`, padding: '0 2px' }}>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask, tell, or describe..."
            rows={1}
            maxLength={2000}
            disabled={isSending}
            className="min-h-[22px] max-h-28 resize-none border-0 bg-transparent p-0 text-sm text-amber-50 shadow-none placeholder:italic placeholder:text-amber-100/40 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <button type="button" onClick={handleSend} disabled={!input.trim() || isSending} aria-label="Send"
          className="relative h-[52px] w-[52px] shrink-0 transition-transform active:scale-95 disabled:opacity-40 disabled:grayscale"
          style={{ touchAction: 'manipulation' }}>
          <img src={sealSendUrl} alt="" draggable={false} className="h-full w-full drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
          {isSending && <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-amber-100" />}
        </button>
      </div>
    </div>
  );
}

function DirectorMessageBubble({ msg, onOverride }: {
  msg: DirectorMessage;
  onOverride: (messageId: string, newMode: 'private' | 'public') => Promise<void>;
}) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    const raw = msg.content.trim();
    const head = raw.slice(0, 48);
    const declined = raw.startsWith('❌') || /declin|reject/i.test(head);
    const approved = !declined && (raw.startsWith('✅') || /approv/i.test(head));
    const text = raw.replace(/^(✅|❌)\s*/u, '');
    const seal = declined ? sealRejectedUrl : approved ? sealApprovedUrl : sealPendingUrl;
    return (
      <div className="flex justify-start pl-[22px]">
        <div
          className="relative flex min-h-[40px] max-w-[88%] items-center text-[13px] italic leading-snug text-[#F6E3B8] [text-shadow:0_1px_2px_#000]"
          style={{
            borderStyle: 'solid',
            borderWidth: '6px 26px 6px 6px',
            borderImage: `url(${noticeStripUrl}) 22 110 22 24 fill / 6px 26px 6px 6px stretch`,
            padding: '4px 6px 4px 28px',
          }}
        >
          <img src={seal} alt="" aria-hidden="true"
            className="pointer-events-none absolute top-1/2 h-[46px] w-[46px] -translate-y-1/2 drop-shadow-[0_2px_3px_#000]"
            style={{ left: -28 }} />
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      {isUser ? (
        <div className="max-w-[85%] text-sm leading-[1.55] text-[#F7E6D6]"
          style={{ borderStyle: 'solid', borderWidth: '10px', borderImage: `url(${playerFrameUrl}) 96 fill / 28px stretch`, padding: '8px 14px' }}>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      ) : (
        <div className="relative mt-4 max-w-[88%] text-sm leading-[1.6] text-[#EDE3D1]"
          style={{ borderStyle: 'solid', borderWidth: '14px', borderImage: `url(${dmFrameUrl}) 140 fill / 40px stretch`, padding: '18px 16px 10px' }}>
          <img src={dmCrestUrl} alt="" aria-hidden="true"
            className="pointer-events-none absolute left-1/2 h-10 w-10 -translate-x-1/2 drop-shadow-[0_2px_4px_#000]"
            style={{ top: -34 }} />
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      )}
      {isUser && msg.category && (
        <div className="mt-1 flex items-center gap-2">
          <CategoryBadge category={msg.category} />
          {(msg.category === 'private_action' || msg.category === 'public_action') && (
            <button
              onClick={() => onOverride(msg.id, msg.category === 'private_action' ? 'public' : 'private')}
              className="text-[10px] text-amber-100/55 underline underline-offset-2 transition-colors hover:text-amber-300"
              style={{ touchAction: 'manipulation' }}
            >
              Make {msg.category === 'private_action' ? 'public' : 'private'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBadge({ category }: { category: DirectorCategory }) {
  const config = {
    question: { seal: sealQuestionUrl, color: 'text-sky-300', label: 'Question' },
    private_action: { seal: sealPrivateUrl, color: 'text-purple-300', label: 'Private' },
    public_action: { seal: sealPublicUrl, color: 'text-emerald-300', label: 'Public' },
    escalated: { seal: sealPendingUrl, color: 'text-amber-300', label: 'Pending Approval' },
    rejected: { seal: sealRejectedUrl, color: 'text-red-400', label: 'Rejected' },
  }[category];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 font-cinzel text-[10px] font-bold uppercase tracking-[0.12em] ${config.color}`}>
      <img src={config.seal} alt="" className="h-[26px] w-[26px]" />
      {config.label}
    </span>
  );
}
