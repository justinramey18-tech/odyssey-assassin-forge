// Art for the Human DM Assistant: image imports, looping background videos
// (always with a still poster, and stills only when the phone asks for reduced
// motion), and the wax-seal stamp that plays once after Post it.

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import assistantButtonArt from '@/assets/dm-assistant/assistant-button.png';
import applyButtonArt from '@/assets/dm-assistant/apply-button.png';
import crestArt from '@/assets/dm-assistant/assistant-crest.png';
import draftFrameArt from '@/assets/dm-assistant/draft-frame.png';
import npcFrameArt from '@/assets/dm-assistant/npc-line-frame.png';
import medalBrainstorm from '@/assets/dm-assistant/medal-brainstorm.png';
import medalDraft from '@/assets/dm-assistant/medal-draft.png';
import medalNpc from '@/assets/dm-assistant/medal-npc.png';
import medalVersions from '@/assets/dm-assistant/medal-versions.png';
import medalDice from '@/assets/whisper/medal-move.png';

export const ART = {
  assistantButton: assistantButtonArt,
  applyButton: applyButtonArt,
  crest: crestArt,
  medalBrainstorm,
  medalDraft,
  medalNpc,
  medalVersions,
  medalDice,
};

/** Videos live in public/ (streamed, not bundled). Each has a poster still. */
const VIDEO = {
  desk: { src: '/dm-assistant/assistant-bg.mp4', poster: '/dm-assistant/assistant-bg-poster.webp' },
  stage: { src: '/dm-assistant/rehearsal-bg.mp4', poster: '/dm-assistant/rehearsal-bg-poster.webp' },
  crest: { src: '/dm-assistant/assistant-crest.mp4', poster: '/dm-assistant/assistant-crest-poster.webp' },
  seal: { src: '/dm-assistant/seal-stamp.mp4', poster: '/dm-assistant/seal-stamp-poster.webp', done: '/dm-assistant/seal-stamp-done.webp' },
};

/** Ornate stretchable borders (border-image). The slice covers each corner ornament. */
export const draftFrameStyle: React.CSSProperties = {
  borderStyle: 'solid',
  borderWidth: '22px',
  borderImage: `url(${draftFrameArt}) 84 / 22px stretch`,
};

export const npcFrameStyle: React.CSSProperties = {
  borderStyle: 'solid',
  borderWidth: '16px',
  borderImage: `url(${npcFrameArt}) 96 / 16px stretch`,
};

/** A small round medal icon from the set. */
export function Medal({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" aria-hidden="true" draggable={false} className={cn('shrink-0 select-none', className)} />;
}

/** A muted looping video that falls back to its poster (reduced motion, or the video fails). */
function LoopVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  if (reduced || failed) {
    return <img src={poster} alt="" aria-hidden="true" draggable={false} className={className} />;
  }
  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

/**
 * The chat background: the DM's desk normally, the rehearsal stage while
 * talking to an NPC. Darkened toward the top so chat text stays readable.
 */
export function AssistantBackdrop({ stage }: { stage: boolean }) {
  const v = stage ? VIDEO.stage : VIDEO.desk;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <LoopVideo key={v.src} src={v.src} poster={v.poster} className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b10] via-[#0b0b10]/80 to-[#0b0b10]/25" />
    </div>
  );
}

/** Header crest: the still normally, the "writing" loop while the assistant works. */
export function AssistantCrest({ busy, className }: { busy: boolean; className?: string }) {
  return (
    <span className={cn('relative inline-block shrink-0 overflow-hidden rounded-full', className)}>
      {busy
        ? <LoopVideo src={VIDEO.crest.src} poster={VIDEO.crest.poster} className="h-full w-full object-cover scale-[1.12]" />
        : <img src={crestArt} alt="" aria-hidden="true" draggable={false} className="h-full w-full" />}
    </span>
  );
}

/**
 * The wax seal stamping down, played once over the panel after Post it.
 * Calls onDone when it ends (or straight away-ish with reduced motion), with a
 * safety timeout so the panel always closes.
 */
export function SealStampOverlay({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };
  useEffect(() => {
    const t = setTimeout(finish, reduced ? 900 : 4500);
    return () => clearTimeout(t);
    // finish is stable for this overlay's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70" role="status" aria-label="Posted to the table">
      <div className="h-56 w-56 overflow-hidden rounded-2xl border border-amber-400/40 shadow-[0_0_40px_rgba(245,158,11,0.35)]">
        {reduced
          ? <img src={VIDEO.seal.done} alt="" className="h-full w-full object-cover" />
          : <video src={VIDEO.seal.src} poster={VIDEO.seal.poster} autoPlay muted playsInline preload="auto" onEnded={finish} onError={finish} className="h-full w-full object-cover" />}
      </div>
      <span className="font-cinzel text-[14px] tracking-wider text-amber-200">Sealed and sent</span>
    </div>
  );
}
