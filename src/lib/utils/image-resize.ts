/**
 * Resize an image data URL to a small JPEG thumbnail using an offscreen canvas.
 * Used to compress profile images before broadcasting to the party.
 */
export async function resizeImageToThumbnail(
  dataUrl: string,
  size: number = 64,
  quality: number = 0.6
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Center-crop: use the smallest dimension to create a square crop
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for resize'));
    img.src = dataUrl;
  });
}
