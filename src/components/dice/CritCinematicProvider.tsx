import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { subscribeD20Rolls, CINEMATIC_CONTEXTS } from '@/lib/rollD20';
import { isCriticalHit, isCriticalMiss, type DieType, type RollMode } from '@/lib/diceRoller';

const SRC = '/nat20-cinematic.mp4';
const PREF_KEY = 'odyssey-crit-cinematics'; // device preference, not per-character
const READY_WAIT_MS = 300;
const SAFETY_MS = 9500;

export function loadCritCinematicsEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}
export function saveCritCinematicsEnabled(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

interface CritCinematicApi {
  /** Resolves true if the cinematic actually played (caller should skip its own roll animation/thud). */
  maybePlayCritCinematic: (rolls: number[], rollMode: RollMode, die: DieType) => Promise<boolean>;
  preloadCritCinematic: () => void;
}

const fallback: CritCinematicApi = {
  maybePlayCritCinematic: async () => false,
  preloadCritCinematic: () => {},
};

const Ctx = createContext<CritCinematicApi>(fallback);
export const useCritCinematic = () => useContext(Ctx);

export function CritCinematicProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const finishRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);

  const preloadCritCinematic = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.preload === 'auto') return;
    v.preload = 'auto';
    try { v.load(); } catch { /* ignore */ }
  }, []);

  const maybePlayCritCinematic = useCallback(async (rolls: number[], rollMode: RollMode, die: DieType): Promise<boolean> => {
    try {
      if (!isCriticalHit(rolls, rollMode, die) || isCriticalMiss(rolls, rollMode, die)) return false;
      if (!loadCritCinematicsEnabled() || busyRef.current) return false;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
      const v = videoRef.current;
      if (!v) return false;
      preloadCritCinematic();

      // Never make the player wait on a download.
      const ready = await new Promise<boolean>((resolve) => {
        if (v.readyState >= 3) return resolve(true);
        const t = window.setTimeout(() => { cleanup(); resolve(false); }, READY_WAIT_MS);
        const ok = () => { cleanup(); resolve(true); };
        const cleanup = () => { clearTimeout(t); v.removeEventListener('canplay', ok); };
        v.addEventListener('canplay', ok);
      });
      if (!ready) return false;

      busyRef.current = true;
      return await new Promise<boolean>((resolve) => {
        const timers: number[] = [];
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          timers.forEach(clearTimeout);
          v.removeEventListener('ended', finish);
          v.removeEventListener('error', finish);
          try { v.pause(); } catch { /* ignore */ }
          finishRef.current = null;
          busyRef.current = false;
          setShown(false);
          setVisible(false);
          setShowSkip(false);
          resolve(true);
        };
        finishRef.current = finish;
        v.addEventListener('ended', finish);
        v.addEventListener('error', finish);
        timers.push(window.setTimeout(finish, SAFETY_MS));
        timers.push(window.setTimeout(() => setShowSkip(true), 1000));
        try { v.currentTime = 0; } catch { /* ignore */ }
        setVisible(true);
        requestAnimationFrame(() => setShown(true));
        v.muted = false;
        v.play().catch(() => {
          v.muted = true;
          v.play().catch(finish);
        });
      });
    } catch {
      busyRef.current = false;
      return false; // fail open
    }
  }, [preloadCritCinematic]);

  useEffect(() => () => { finishRef.current?.(); }, []);

  // Any d20 rolled through rollD20() gets the cinematic automatically,
  // for eligible contexts only. The caller awaits it via awaitD20Reveal().
  const playRef = useRef(maybePlayCritCinematic);
  playRef.current = maybePlayCritCinematic;
  useEffect(() => subscribeD20Rolls((r) => {
    if (!r.isCrit || !CINEMATIC_CONTEXTS.has(r.context)) return;
    return playRef.current(r.rolls, r.mode, 'd20');
  }), []);

  return (
    <Ctx.Provider value={{ maybePlayCritCinematic, preloadCritCinematic }}>
      {children}
      <div
        className="fixed inset-0 z-[90] transition-opacity duration-150"
        style={{
          opacity: shown ? 1 : 0,
          visibility: visible ? 'visible' : 'hidden',
          pointerEvents: visible ? 'auto' : 'none',
          touchAction: 'manipulation',
        }}
        onClick={() => finishRef.current?.()}
        aria-hidden={!visible}
      >
        <video
          ref={videoRef}
          src={SRC}
          playsInline
          preload="none"
          className="w-full h-full object-cover"
        />
        {showSkip && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); finishRef.current?.(); }}
            className="absolute right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] min-h-12 min-w-12 px-4 rounded-full border border-border bg-background/60 text-foreground font-cinzel text-sm backdrop-blur"
            style={{ touchAction: 'manipulation' }}
          >
            Skip
          </button>
        )}
      </div>
    </Ctx.Provider>
  );
}
