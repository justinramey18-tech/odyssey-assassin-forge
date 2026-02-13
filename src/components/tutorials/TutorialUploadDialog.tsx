import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TutorialUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
  userId: string;
}

const CATEGORIES = ['Getting Started', 'Combat', 'AI DM', 'Party', 'Character', 'General'];
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

export function TutorialUploadDialog({ open, onClose, onUploaded, userId }: TutorialUploadDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file || !title.trim()) return;

    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: 'File too large', description: 'Video must be under 50MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const path = `tutorials/${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);

      const { error: insertError } = await (supabase.from('tutorials') as any).insert({
        title: title.trim(),
        description: description.trim() || null,
        video_url: urlData.publicUrl,
        category,
        created_by: userId,
      });

      if (insertError) throw insertError;

      toast({ title: 'Tutorial uploaded!', className: 'border-primary bg-primary/10' });
      setTitle('');
      setDescription('');
      setFile(null);
      onUploaded();
      onClose();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md mx-4 bg-background/95 border border-amber-900/40 rounded-2xl p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-cinzel text-amber-200">Upload Tutorial</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60">
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Tutorial title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40"
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-white/5 border border-amber-900/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 resize-none"
          />

          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors font-cinzel',
                  category === cat
                    ? 'bg-amber-900/40 border-amber-500/40 text-amber-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />

          <button
            onClick={() => fileRef.current?.click()}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-colors',
              file ? 'border-amber-500/40 bg-amber-900/10' : 'border-white/10 hover:border-white/20'
            )}
          >
            {file ? (
              <>
                <Film className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-300 truncate max-w-[200px]">{file.name}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/40">Choose video file (MP4/WebM, max 50MB)</span>
              </>
            )}
          </button>

          <button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className={cn(
              'w-full py-2.5 rounded-xl font-cinzel text-sm transition-colors',
              file && title.trim() && !uploading
                ? 'bg-amber-900/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60'
                : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
            )}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
              </span>
            ) : (
              'Upload Tutorial'
            )}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
