import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserRound, X } from 'lucide-react';
import { getSheetReturn, clearSheetReturn, subscribeSheetReturn, SheetReturn } from '@/lib/sheetReturn';

interface ReturnToSheetButtonProps {
  /** Reopen the solo DM overlay. The DM screen restores the sheet itself. */
  onReturn: () => void;
  /** Hide while a full-screen DM overlay is already on top. */
  hidden?: boolean;
}

export function ReturnToSheetButton({ onReturn, hidden = false }: ReturnToSheetButtonProps) {
  const [pending, setPending] = useState<SheetReturn | null>(() => getSheetReturn());

  useEffect(() => subscribeSheetReturn(() => setPending(getSheetReturn())), []);

  if (hidden || !pending) return null;

  return createPortal(
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[55] flex items-center gap-1.5"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
    >
      <button
        type="button"
        onClick={onReturn}
        className="flex items-center gap-2 rounded-full border border-amber-500/50 bg-black/85 backdrop-blur px-4 py-3 text-xs font-cinzel tracking-wide text-amber-300 shadow-lg shadow-black/60 active:bg-amber-500/15"
        style={{ touchAction: 'manipulation', minHeight: 48 }}
      >
        <UserRound className="w-4 h-4" />
        Back to character sheet
      </button>
      <button
        type="button"
        onClick={clearSheetReturn}
        aria-label="Dismiss return shortcut"
        className="flex items-center justify-center rounded-full border border-amber-500/30 bg-black/85 backdrop-blur text-amber-300/70 active:bg-amber-500/15"
        style={{ touchAction: 'manipulation', minHeight: 48, minWidth: 48 }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>,
    document.body
  );
}
