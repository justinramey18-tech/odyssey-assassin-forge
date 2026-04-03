import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Slide } from '@/lib/parseSlides';
import SlideRenderer from '@/components/empyrean/SlideRenderer';
import SlideshowVFX from '@/components/empyrean/SlideshowVFX';
import { playSFX, setAmbience, stopAll as stopAllAudio, getCtx } from '@/lib/slideshowAudioEngine';
import { preloadAudioFiles, extractAudioNames } from '@/lib/slideshowAudioLoader';

const MOOD_COLORS: Record<string, string> = {
  neutral: '#08080f',
  dark: '#060610',
  warm: '#12080a',
  cold: '#080a10',
  danger: '#160804',
  triumph: '#0a0a04',
  grief: '#0a0810',
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

  const handleTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // If tap is in the left 60px, go back; otherwise advance
    const x = e.clientX ?? (e as any).touches?.[0]?.clientX ?? 999;
    if (x <= 60 && currentIndex > 0) {
      goBack();
    } else {
      advance();
    }
  }, [advance, goBack, currentIndex]);

  if (!currentSlide) return null;

  return (
    <div
      onClick={handleTap}
      className="fixed inset-0 z-[75] flex flex-col select-none cinematic-slideshow-root"
      style={{
        backgroundColor: bgColor,
        transition: 'background-color 1.5s ease',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        cursor: 'pointer',
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

      {/* Bottom bar: counter + progress + prompt */}
      <div className="px-5 pb-5 relative z-10" onClick={(e) => e.stopPropagation()}>
        {/* Slide counter */}
        <p className="text-center text-[10px] text-white/25 tracking-widest mb-2.5 font-sans">
          {currentIndex + 1} / {totalSlides}
        </p>

        {/* Progress bar */}
        <div className="h-[2px] bg-white/5 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full"
            style={{
              width: `${((currentIndex + 1) / totalSlides) * 100}%`,
              background: 'linear-gradient(to right, #b8860b, #daa520)',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        {/* Last slide prompt or tap hint */}
        {isLastSlide ? (
          <p
            className="text-center font-serif text-sm italic text-amber-400/70 cursor-pointer"
            onClick={(e) => { e.stopPropagation(); stopAllAudio(); onComplete(); }}
            style={{ touchAction: 'manipulation' }}
          >
            Your turn. What do you do?
          </p>
        ) : (
          <p className="text-center text-[10px] text-white/15 tracking-wider font-sans">
            tap to continue
          </p>
        )}
      </div>
    </div>
  );
}
