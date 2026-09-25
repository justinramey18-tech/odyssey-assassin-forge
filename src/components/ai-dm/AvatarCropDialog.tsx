import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Wide crop that matches the speaker tile's photo window (about 2.25:1).
 * The picture is framed in a wide window matching the speaker tile; chat
 * circles show the centre of it.
 */
export const AVATAR_OUTPUT_W = 576;
export const AVATAR_OUTPUT_H = 256;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const VIEW_W = 300; // on-screen crop window
const VIEW_H = 134;

interface AvatarCropDialogProps {
  open: boolean;
  file: File | null;
  kind: 'ic' | 'ooc';
  onCancel: () => void;
  onConfirm: (cropped: File) => void | Promise<void>;
}

/**
 * Lets the player pan/zoom their picture inside a circle before it is saved,
 * then exports a square 256x256 image so every chat avatar renders identically.
 */
export function AvatarCropDialog({ open, file, kind, onCancel, onConfirm }: AvatarCropDialogProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    setError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImg(null);

    if (!file.type.startsWith('image/')) { setError('That file is not an image.'); return; }
    if (file.size > MAX_SOURCE_BYTES) { setError('Image too large (max 12MB).'); return; }

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setError('That image could not be opened.');
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  // Scale that makes the picture cover the whole wide window at zoom 1.
  const baseScale = img ? Math.max(VIEW_W / img.naturalWidth, VIEW_H / img.naturalHeight) : 1;
  const drawW = img ? img.naturalWidth * baseScale * zoom : 0;
  const drawH = img ? img.naturalHeight * baseScale * zoom : 0;

  /** Keep the picture covering the whole window — no empty corners. */
  const clamp = useCallback((x: number, y: number) => {
    const maxX = Math.max(0, (drawW - VIEW_W) / 2);
    const maxY = Math.max(0, (drawH - VIEW_H) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, [drawW, drawH]);

  useEffect(() => { setOffset(o => clamp(o.x, o.y)); }, [clamp]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset(clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y)));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const handleConfirm = async () => {
    if (!img || !file) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_OUTPUT_W;
      canvas.height = AVATAR_OUTPUT_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not prepare the image.');
      const ratio = AVATAR_OUTPUT_W / VIEW_W;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        img,
        (VIEW_W / 2 - drawW / 2 + offset.x) * ratio,
        (VIEW_H / 2 - drawH / 2 + offset.y) * ratio,
        drawW * ratio,
        drawH * ratio,
      );
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.88));
      if (!blob) throw new Error('Could not prepare the image.');
      const cropped = new File([blob], `avatar-${kind}.jpg`, { type: 'image/jpeg' });
      await onConfirm(cropped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-[340px] p-4 z-[90]">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-sm">
            {kind === 'ic' ? 'Character picture' : 'Player picture'}
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="text-xs text-destructive py-4">{error}</p>
        ) : (
          <>
            <div
              className={cn(
                "relative mx-auto rounded-full overflow-hidden border-2 touch-none select-none bg-black/60",
                kind === 'ic' ? "border-emerald-400/50" : "border-amber-400/50"
              )}
              style={{ width: VIEW, height: VIEW }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {img ? (
                <img
                  src={img.src}
                  alt="Crop preview"
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                  style={{
                    width: drawW,
                    height: drawH,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white/50" />
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Drag to reposition · pinch or slide to zoom
            </p>

            <div className="flex items-center gap-2 mt-2">
              <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
              <Slider
                value={[zoom]}
                min={1}
                max={4}
                step={0.01}
                onValueChange={([v]) => setZoom(Number.isFinite(v) ? v : 1)}
              />
            </div>
          </>
        )}

        <div className="flex gap-2 mt-3">
          <Button variant="outline" className="flex-1 h-11" onClick={onCancel} style={{ touchAction: 'manipulation' }}>
            Cancel
          </Button>
          <Button
            className="flex-1 h-11"
            disabled={!img || busy || !!error}
            onClick={handleConfirm}
            style={{ touchAction: 'manipulation' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save picture'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
