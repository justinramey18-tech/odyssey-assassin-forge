import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Trash2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface BackgroundUploadButtonProps {
  hasCustomBackground: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}

export function BackgroundUploadButton({
  hasCustomBackground,
  onUpload,
  onClear,
}: BackgroundUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const { toast } = useToast();

  const handleClick = () => {
    if (hasCustomBackground) {
      setShowConfirmClear(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(file);
      toast({
        title: "Background Updated",
        description: "Your custom background has been set!",
        className: "border-primary bg-primary/10",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmClear = () => {
    onClear();
    setShowConfirmClear(false);
    toast({
      title: "Background Cleared",
      description: "Default background restored",
    });
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <motion.button
        onClick={handleClick}
        disabled={isUploading}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "p-2 rounded-lg transition-all duration-200",
          "border border-white/20 hover:border-white/40",
          "bg-black/30 hover:bg-black/50 backdrop-blur-sm",
          isUploading && "opacity-50 cursor-not-allowed"
        )}
        aria-label={hasCustomBackground ? "Change or clear custom background" : "Upload custom background"}
      >
        {isUploading ? (
          <Loader2 className="w-5 h-5 text-white/80 animate-spin" />
        ) : hasCustomBackground ? (
          <ImagePlus className="w-5 h-5 text-primary" />
        ) : (
          <ImagePlus className="w-5 h-5 text-white/80" />
        )}
      </motion.button>

      {/* Confirm Clear Popover */}
      <AnimatePresence>
        {showConfirmClear && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "bg-background/95 backdrop-blur-xl border border-white/20 rounded-lg p-3",
              "shadow-xl min-w-[180px]"
            )}
          >
            <p className="text-xs text-muted-foreground mb-3 text-center">
              Custom background options
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowConfirmClear(false);
                  fileInputRef.current?.click();
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                  "bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                )}
              >
                <ImagePlus className="w-4 h-4" />
                <span>Change Image</span>
              </button>
              <button
                onClick={handleConfirmClear}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                  "bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                )}
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear Background</span>
              </button>
              <button
                onClick={() => setShowConfirmClear(false)}
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs",
                  "text-muted-foreground hover:text-foreground transition-colors"
                )}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay to close popover when clicking outside */}
      {showConfirmClear && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowConfirmClear(false)}
        />
      )}
    </div>
  );
}
