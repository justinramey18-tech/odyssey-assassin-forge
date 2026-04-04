import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Slide } from '@/lib/parseSlides';
import SlideRenderer from '@/components/empyrean/SlideRenderer';
import SlideshowVFX from '@/components/empyrean/SlideshowVFX';
import { playSFX, setAmbience, stopAll as stopAllAudio, getCtx } from '@/lib/slideshowAudioEngine';
import { preloadAudioFiles, extractAudioNames } from '@/lib/slideshowAudioLoader';

const MOOD_COLORS: Record<string, string> = {
  neutral: '#0a0a14',
  dark: '#060612',
  warm: '#1a0c08',
  cold: '#080e1a',
  danger: '#1e0808',
  triumph: '#141208',
  grief: '#100a18',
};

interface CinematicSlideshowProps {
  slides: Slide[];
  onComplete: () => void;
}

export default function CinematicSlideshow({ slides, onComplete }: CinematicSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bgColor, setBgColor] = useState(MOOD_COLORS.neutral);

  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex] ?? null;
  const isLastSlide = currentIndex >= totalSlides - 1;

  // Preload all audio files referenced in this slideshow
  useEffect(() => {
    try {
      const audioCtx = getCtx();
      const { sfxNames, ambienceNames } = extractAudioNames(slides);
      preloadAudioFiles(audioCtx, sfxNames, ambienceNames);
    } catch {
      // Audio context not available — synth fallback will handle it
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update background color when mood changes
  // Trigger mood, SFX, and ambience on slide change
  useEffect(() => {
    if (!currentSlide) return;

    // Update mood background color
    if (currentSlide.mood && MOOD_COLORS[currentSlide.mood]) {
      setBgColor(MOOD_COLORS[currentSlide.mood]);
    }

    // Play one-shot sound effects
    for (const sfx of currentSlide.sfx) {
      playSFX(sfx);
    }

    // Set ambience (persists until changed)
    if (currentSlide.ambience) {
      setAmbience(currentSlide.ambience);
    }
  }, [currentIndex, currentSlide]);

  const advance = useCallback(() => {
    if (isLastSlide) {
      stopAllAudio();
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  }, [isLastSlide, onComplete]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);


  if (!currentSlide) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex flex-col select-none cinematic-slideshow-root"
      style={{
        backgroundColor: bgColor,
        transition: 'background-color 1.5s ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {/* Visual Effects Layer */}
      <SlideshowVFX
        slideVfx={currentSlide?.vfx ?? []}
        slideKey={currentIndex}
      />

      {/* Close button */}
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); stopAllAudio(); onComplete(); }}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
          style={{ touchAction: 'manipulation' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Slide content — vertically centered */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <SlideRenderer key={currentIndex} slide={currentSlide} />
        </AnimatePresence>
      </div>

      {/* Bottom navigation bar */}
      <div className="px-4 pb-5 relative z-10">
        {/* Progress bar */}
        <div className="h-[2px] bg-white/5 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full"
            style={{
              width: `${((currentIndex + 1) / totalSlides) * 100}%`,
              background: 'linear-gradient(to right, #b8860b, #daa520)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {/* Navigation row */}
        <div className="flex items-center justify-between">
          {/* Back button — left side */}
          <button
            onClick={(e) => { e.stopPropagation(); goBack(); }}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 transition-all disabled:opacity-20 disabled:pointer-events-none"
            style={{ touchAction: 'manipulation' }}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-xs font-cinzel uppercase tracking-wider">Back</span>
          </button>

          {/* Slide counter — center */}
          <span className="text-[10px] text-white/25 tracking-widest font-sans">
            {currentIndex + 1} / {totalSlides}
          </span>

          {/* Next / Finish button — right side */}
          {isLastSlide ? (
            <button
              onClick={(e) => { e.stopPropagation(); stopAllAudio(); onComplete(); }}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-900/20 hover:bg-amber-900/40 text-amber-300 transition-all active:scale-[0.97]"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-xs font-cinzel uppercase tracking-wider">Continue</span>
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); advance(); }}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all active:scale-[0.97]"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-xs font-cinzel uppercase tracking-wider">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
