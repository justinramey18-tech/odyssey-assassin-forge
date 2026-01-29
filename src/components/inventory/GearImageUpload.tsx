import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadGearImage, getGearImage, removeLocalGearImage } from '@/lib/inventory/gearImages';
import { Button } from '@/components/ui/button';

interface GearImageUploadProps {
  itemId: string;
  currentImage?: string | null;
  onImageChange?: (imageUrl: string | null) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GearImageUpload({
  itemId,
  currentImage,
  onImageChange,
  className,
  size = 'md',
}: GearImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || getGearImage(itemId));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);

    try {
      const imageUrl = await uploadGearImage(itemId, file);
      if (imageUrl) {
        setPreviewUrl(imageUrl);
        onImageChange?.(imageUrl);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    removeLocalGearImage(itemId);
    setPreviewUrl(null);
    onImageChange?.(null);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('relative group', sizeClasses[size], className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative w-full h-full rounded-lg overflow-hidden border-2 border-border">
          <img
            src={previewUrl}
            alt="Gear"
            className="w-full h-full object-cover object-center"
          />
          
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={triggerFileSelect}
            >
              <Upload className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-destructive/80"
              onClick={handleRemoveImage}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={triggerFileSelect}
          disabled={isUploading}
          className={cn(
            'w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/30',
            'flex flex-col items-center justify-center gap-1',
            'hover:border-primary/50 hover:bg-muted/30 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary/50',
            isUploading && 'pointer-events-none'
          )}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
              <span className="text-[8px] text-muted-foreground/60 uppercase">Upload</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
