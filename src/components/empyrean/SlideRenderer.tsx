import { motion } from 'framer-motion';
import type { Slide } from '@/lib/parseSlides';

interface SlideRendererProps {
  slide: Slide;
}

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.6, ease: 'easeOut' },
};

export default function SlideRenderer({ slide }: SlideRendererProps) {
  if (slide.displayType === 'firstLine') {
    return (
      <motion.div {...fadeUp} className="text-center px-7 max-w-[380px] mx-auto">
        <div className="w-16 h-px mx-auto mb-5 bg-gradient-to-r from-transparent via-amber-600/60 to-transparent" />
        <p className="font-serif text-[22px] leading-relaxed text-amber-300/90 italic font-normal tracking-wide">
          {slide.text}
        </p>
        <div className="w-16 h-px mx-auto mt-5 bg-gradient-to-r from-transparent via-amber-600/60 to-transparent" />
      </motion.div>
    );
  }

  if (slide.displayType === 'pullQuote') {
    return (
      <motion.div {...fadeUp} className="text-center px-7 max-w-[380px] mx-auto">
        <div className="w-10 h-px mx-auto mb-4 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
        <p className="font-serif text-[19px] leading-relaxed text-amber-400/80 font-medium">
          {slide.text}
        </p>
        <div className="w-10 h-px mx-auto mt-4 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent" />
      </motion.div>
    );
  }

  if (slide.displayType === 'dialogue') {
    return (
      <motion.div {...fadeUp} className="px-7 max-w-[380px] mx-auto">
        <div className="border-l-2 border-purple-500 pl-3.5">
          {slide.speaker && (
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-purple-400 mb-1.5 font-sans">
              {slide.speaker}
            </p>
          )}
          <p className="font-serif text-[16px] leading-[1.65] text-white/85">
            {slide.text}
          </p>
        </div>
      </motion.div>
    );
  }

  // Normal paragraph
  return (
    <motion.div {...fadeUp} className="px-7 max-w-[380px] mx-auto">
      <p className="font-serif text-[16px] leading-[1.7] text-white/70 text-left">
        {slide.text}
      </p>
    </motion.div>
  );
}
