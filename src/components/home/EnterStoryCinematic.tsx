import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const VIDEO_START_DELAY_MS = 2000;
const SKIP_REVEAL_DELAY_MS = 1000;
const PLAYBACK_SAFETY_MS = 9000;
const ABSOLUTE_BACKSTOP_MS = 13000;

type CinematicPhase = 'idle' | 'waiting' | 'video' | 'white';

interface EnterStoryCinematicProps {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  onOpenPartyDM: () => void;
  onComplete: () => void;
}

export function EnterStoryCinematic({
  active,
  videoRef,
  onOpenPartyDM,
  onComplete,
}: EnterStoryCinematicProps) {
  const openedPartyRef = useRef(false);
  const finishedRef = useRef(false);
  const [phase, setPhase] = useState<CinematicPhase>('idle');
  const [showSkip, setShowSkip] = useState(false);

  // Callbacks are held in refs so timer effects never depend on their identity.
  const onOpenPartyDMRef = useRef(onOpenPartyDM);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onOpenPartyDMRef.current = onOpenPartyDM; }, [onOpenPartyDM]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const openPartyOnce = () => {
    if (openedPartyRef.current) return;
    openedPartyRef.current = true;
    onOpenPartyDMRef.current();
  };

  const finishImmediately = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    videoRef.current?.pause();
    openPartyOnce();
    setPhase('idle');
    onCompleteRef.current();
  };

  const finishAfterWhite = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('idle');
    onCompleteRef.current();
  };

  // Owned by `active` alone: nothing but a real activation can start or restart
  // these timers, so unstable callbacks can never tear them down.
  useEffect(() => {
    if (!active) {
      setPhase('idle');
      setShowSkip(false);
      return;
    }

    openedPartyRef.current = false;
    finishedRef.current = false;
    setPhase('waiting');
    setShowSkip(false);

    const skipTimer = window.setTimeout(() => setShowSkip(true), SKIP_REVEAL_DELAY_MS);
    const startTimer = window.setTimeout(() => {
      openPartyOnce();
      setPhase('video');
    }, VIDEO_START_DELAY_MS);
    // Absolute backstop: no matter what goes wrong, the player lands in Party DM.
    const backstopTimer = window.setTimeout(finishImmediately, ABSOLUTE_BACKSTOP_MS);

    return () => {
      window.clearTimeout(skipTimer);
      window.clearTimeout(startTimer);
      window.clearTimeout(backstopTimer);
    };
  }, [active]);

  useEffect(() => {
    if (phase !== 'video') return;

    const video = videoRef.current;
    if (!video) {
      finishImmediately();
      return;
    }

    const handleEnded = () => setPhase('white');
    const handleError = () => finishImmediately();
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    video.muted = true;
    void video.play().catch(() => finishImmediately());

    const safetyTimer = window.setTimeout(finishImmediately, PLAYBACK_SAFETY_MS);
    return () => {
      window.clearTimeout(safetyTimer);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [phase]);

  if (!active || phase === 'idle' || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-transparent"
      onClick={finishImmediately}
      style={{ touchAction: 'manipulation' }}
    >
      {phase === 'white' && (
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          onAnimationComplete={finishAfterWhite}
        />
      )}

      {showSkip && phase !== 'white' && (
        <Button
          type="button"
          variant="ghost"
          aria-label="Skip intro"
          onClick={(event) => {
            event.stopPropagation();
            finishImmediately();
          }}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 min-h-12 px-4 text-xs text-white/75 hover:bg-white/10 hover:text-white"
          style={{ touchAction: 'manipulation' }}
        >
          Skip
        </Button>
      )}
    </div>,
    document.body,
  );
}
