import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import nat20Video from '@/assets/nat20-video.mp4.asset.json';

/**
 * Full-screen celebration video that plays whenever a natural 20 is rolled
 * anywhere in the app. Listens for the global `odyssey-nat20` event.
 */
export function Nat20VideoOverlay() {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const handle = () => setVisible(true);
    window.addEventListener('odyssey-nat20', handle);
    return () => window.removeEventListener('odyssey-nat20', handle);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const el = videoRef.current;
    if (el) {
      el.currentTime = 0;
      void el.play().catch(() => {
        // Autoplay with sound may be blocked — fall back to muted playback.
        el.muted = true;
        void el.play().catch(() => setVisible(false));
      });
    }
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] bg-black flex items-center justify-center"
      onClick={() => setVisible(false)}
    >
      <video
        ref={videoRef}
        src={nat20Video.url}
        playsInline
        autoPlay
        className="w-full h-full object-contain"
        onEnded={() => setVisible(false)}
        onError={() => setVisible(false)}
      />
      <button
        onClick={() => setVisible(false)}
        className="absolute top-4 right-4 min-h-[48px] min-w-[48px] px-4 rounded-full bg-background/60 border border-border text-foreground text-xs font-cinzel uppercase tracking-wider"
        aria-label="Skip celebration"
      >
        Skip
      </button>
    </div>,
    document.body
  );
}

export default Nat20VideoOverlay;
