import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  title?: string;
  onClose?: () => void;
  modal?: boolean;
  className?: string;
}

export function VideoPlayer({ src, title, onClose, modal = true, className }: VideoPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!modal) {
    return (
      <div className={cn('rounded-xl overflow-hidden bg-black', className)}>
        <video
          src={src}
          controls
          playsInline
          className="w-full rounded-xl"
          controlsList="nodownload"
        />
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={cn(
            'relative w-full mx-4 rounded-2xl overflow-hidden bg-black border border-white/10',
            isFullscreen ? 'max-w-[95vw] max-h-[95vh]' : 'max-w-3xl'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">
            {title && (
              <h3 className="text-sm font-cinzel text-amber-200 truncate">{title}</h3>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <video
            src={src}
            controls
            playsInline
            autoPlay
            className="w-full"
            controlsList="nodownload"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
