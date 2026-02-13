import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VideoPlayer } from './VideoPlayer';

interface TutorialCardProps {
  title: string;
  description?: string | null;
  videoUrl: string;
  category: string;
}

export function TutorialCard({ title, description, videoUrl, category }: TutorialCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setShowPlayer(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'group relative w-full text-left rounded-xl overflow-hidden',
          'bg-black/40 border border-amber-900/30 hover:border-amber-500/40',
          'transition-colors'
        )}
      >
        {/* Thumbnail area */}
        <div className="relative aspect-video bg-gradient-to-br from-amber-950/60 to-black/80 flex items-center justify-center">
          <Film className="w-10 h-10 text-amber-500/30" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="w-12 h-12 rounded-full bg-amber-500/80 flex items-center justify-center">
              <Play className="w-6 h-6 text-black fill-black ml-0.5" />
            </div>
          </div>
          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-500/30 font-cinzel">
            {category}
          </span>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-cinzel text-amber-200 truncate">{title}</h3>
          {description && (
            <p className="text-xs text-white/50 mt-1 line-clamp-2">{description}</p>
          )}
        </div>
      </motion.button>

      {showPlayer && (
        <VideoPlayer
          src={videoUrl}
          title={title}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </>
  );
}
