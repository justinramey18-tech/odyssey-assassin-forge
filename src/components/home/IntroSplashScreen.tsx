import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { Glass } from '@/components/ui/glass';
import tposeBackground from '@/assets/generated/deadpool-assassin-tpose-dive.jpg';

interface IntroSplashScreenProps {
  onBegin: () => void;
}

export function IntroSplashScreen({ onBegin }: IntroSplashScreenProps) {
  return (
    <BackgroundWrapper
      imagePath={tposeBackground}
      overlayOpacity={40}
      tintColor="red"
      tintOpacity={15}
      fixed={true}
      backgroundSize="contain"
      backgroundPosition="center center"
      className="fixed inset-0 z-50"
    >
      <div className="flex flex-col items-center justify-center h-screen px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center"
        >
          <Glass
            variant="default"
            className="px-8 py-10 max-w-md mx-auto"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mb-6"
            >
              <Sparkles className="w-12 h-12 mx-auto text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
            </motion.div>
            
            <h1 className="text-xl md:text-2xl font-bold text-white mb-8 leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Are you ready to begin your infinity pool journey?
            </h1>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <Glass
                as="button"
                variant="interactive"
                className="w-full py-4 text-lg font-semibold text-white border-amber-500/50 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_30px_rgba(251,191,36,0.5)]"
                onClick={onBegin}
                style={{ touchAction: 'manipulation' }}
              >
                <span className="drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                  Begin Journey
                </span>
              </Glass>
            </motion.div>
          </Glass>
        </motion.div>
      </div>
    </BackgroundWrapper>
  );
}
