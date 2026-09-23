import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import toolsBgAsset from '@/assets/tools/tools-bg.jpg.asset.json';
import toolsBannerAsset from '@/assets/tools/tools-banner.png.asset.json';

const toolsBg = toolsBgAsset.url;
const toolsBanner = toolsBannerAsset.url;

interface PartyToolsScreenProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function PartyToolsScreen({ open, onClose, children }: PartyToolsScreenProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tools"
      className="fixed inset-0 z-[62] flex flex-col bg-[#07060a]"
      style={{ backgroundImage: `url(${toolsBg})`, backgroundSize: 'cover', backgroundPosition: 'top center' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.05) 0%, rgba(0,0,0,.45) 26%, rgba(0,0,0,.62) 100%)' }}
      />
      <div className="relative flex shrink-0 justify-center px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <img
          src={toolsBanner}
          alt="Tools"
          draggable={false}
          className="w-[88%] max-w-[380px] drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tools"
          style={{ touchAction: 'manipulation' }}
          className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full border border-[#caa05a]/70 bg-black/70 text-[#f0c97a] active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
