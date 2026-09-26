import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const CINEMATIC_SRC = '/enter-story-cinematic.mp4';
const VIDEO_START_DELAY_MS = 2000;
const SKIP_REVEAL_DELAY_MS = 1000;
const PLAYBACK_SAFETY_MS = 9000;

type CinematicPhase = 'idle' | 'waiting' | 'video' | 'white';

interface EnterStoryCinematicProps {
  active: boolean;
  onOpenPartyDM: () => void;
  onComplete: () => void;
}

export function EnterStoryCinematic({
  active,
  onOpenPartyDM,
  onComplete,
}: EnterStoryCinematicProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const openedPartyRef = useRef(false);
  const finishedRef = useRef(false);
  const [phase, setPhase] = useState<CinematicPhase>('idle');
  const [showSkip, setShowSkip] = useState(false);

  // Warm the browser cache as soon as HomeScreen mounts, well before the tap.
  useEffect(() => {
    const preloader = document.createElement('video');
    preloader.preload = 'auto';
    preloader.playsInline = true;
    preloader.src = CINEMATIC_SRC;
    preloader.load();

    return () => {
      preloader.removeAttribute('src');
      preloader.load();
    };
  }, []);

  const openPartyOnce = useCallback(() => {
    if (openedPartyRef.current) return;
    openedPartyRef.current = true;
    onOpenPartyDM();
  }, [onOpenPartyDM]);

  const finishImmediately = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    videoRef.current?.pause();
    openPartyOnce();
    setPhase('idle');
    onComplete();
  }, [onComplete, openPartyOnce]);

  const finishAfterWhite = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('idle');
    onComplete();
  }, [onComplete]);

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

    return () => {
      window.clearTimeout(skipTimer);
      window.clearTimeout(startTimer);
    };
  }, [active, openPartyOnce]);

  useEffect(() => {
    if (phase !== 'video') return;

    const video = videoRef.current;
    if (!video) {
      finishImmediately();
      return;
    }

    video.currentTime = 0;
    video.muted = false;
    void video.play().catch(() => {
      video.muted = true;
      return video.play();
    }).catch(() => finishImmediately());

    const safetyTimer = window.setTimeout(finishImmediately, PLAYBACK_SAFETY_MS);
    return () => window.clearTimeout(safetyTimer);
  }, [finishImmediately, phase]);

  if (!active || phase === 'idle' || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black"
      onClick={finishImmediately}
      style={{ touchAction: 'manipulation' }}
    >
      {phase === 'video' && (
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <video
            ref={videoRef}
            src={CINEMATIC_SRC}
            className="h-full w-full object-cover"
            playsInline
            preload="auto"
            aria-hidden="true"
            onEnded={() => setPhase('white')}
            onError={finishImmediately}
          />
        </motion.div>
      )}

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
