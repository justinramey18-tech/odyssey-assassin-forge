import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { User, Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setBoundSaveId, getBoundSaveId, type DMMode } from '@/lib/modeCharacterBinding';

export interface ModeCharacterPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DMMode;
  activeCloudSaveId: string | null;
  saves: Array<{ id: string; save_name: string; character_name?: string; character_level?: number; updated_at: string }>;
  onRefresh?: () => void;
  onSwitch: (saveId: string) => Promise<boolean>;
}

const MODE_LABEL: Record<DMMode, string> = {
  solo: 'Solo campaign',
  party: 'Party campaign',
  empyrean: 'Empyrean campaign',
};

export function ModeCharacterPicker({
  open, onOpenChange, mode, activeCloudSaveId, saves, onRefresh, onSwitch,
}: ModeCharacterPickerProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const bound = getBoundSaveId(mode);

  useEffect(() => { if (open) onRefresh?.(); }, [open, onRefresh]);

  if (!open) return null;

  const choose = async (saveId: string) => {
    if (busyId) return;
    setBusyId(saveId);
    try {
      setBoundSaveId(mode, saveId);
      if (saveId !== activeCloudSaveId) await onSwitch(saveId);
      onOpenChange(false);
    } finally {
      setBusyId(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[84] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => !busyId && onOpenChange(false)}>
      <div className="w-full max-w-md rounded-t-2xl border-t border-x border-amber-500/25 bg-gradient-to-b from-[#1a0e05] to-[#0a0a0f] p-4 pb-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{MODE_LABEL[mode]}</p>
          <button onClick={() => !busyId && onOpenChange(false)} aria-label="Close"
            className="p-2 -mr-2 text-white/40" style={{ touchAction: 'manipulation' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-base font-cinzel text-amber-200 mb-3">Play this campaign as</h2>

        {saves.length === 0 ? (
          <p className="text-xs text-white/50 py-6 text-center">
            No saved characters yet. Build one in the main app, then come back and pick it here.
          </p>
        ) : (
          <div className="max-h-[45vh] overflow-y-auto space-y-1.5">
            {saves.map(s => {
              const isBound = s.id === bound;
              return (
                <button key={s.id} onClick={() => choose(s.id)} disabled={!!busyId}
                  className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left',
                    isBound ? 'border-amber-400/50 bg-amber-900/20' : 'border-white/10 bg-white/[0.03]')}
                  style={{ touchAction: 'manipulation', minHeight: 56 }}>
                  <User className="w-4 h-4 text-amber-300/70 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white/90 truncate">{s.character_name || s.save_name}</span>
                    {typeof s.character_level === 'number' && (
                      <span className="block text-[10px] text-white/40">Level {s.character_level}</span>
                    )}
                  </span>
                  {busyId === s.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    : isBound ? <Check className="w-4 h-4 text-amber-300" /> : null}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Each campaign remembers its own character. Switching here does not affect your other campaigns.
        </p>
      </div>
    </div>,
    document.body
  );
}
