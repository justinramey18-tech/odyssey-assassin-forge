import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Film, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VideoPlayer } from './VideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface TutorialCardProps {
  id: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  category: string;
  isOwner?: boolean;
  onDeleted?: () => void;
}

export function TutorialCard({ id, title, description, videoUrl, category, isOwner, onDeleted }: TutorialCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await (supabase.from('tutorials') as any).delete().eq('id', id);
    setDeleting(false);
    setShowConfirm(false);
    onDeleted?.();
  };

  return (
    <>
      <div className="relative">
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

        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 border border-amber-500/20 text-white/60 hover:text-white hover:bg-black/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-amber-900/40">
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300 focus:bg-red-900/20 cursor-pointer"
                onClick={() => setShowConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {showPlayer && (
        <VideoPlayer
          src={videoUrl}
          title={title}
          onClose={() => setShowPlayer(false)}
        />
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-[#1a1a2e] border-amber-900/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-200 font-cinzel">Delete Tutorial</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete "{title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-amber-900/40 text-white/70">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-900/60 hover:bg-red-900/80 text-red-200 border border-red-500/30"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
