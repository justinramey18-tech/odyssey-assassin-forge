import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X, RotateCcw, Check, Loader2, ChevronLeft } from 'lucide-react';
import offeringJointAsset from '@/assets/offering-joint.jpg.asset.json';
import { RP_FLAVORS, getRpFlavor, type RpFlavor } from '@/lib/rpFlavors';

interface ActionItem {
  id: string;
  label: string;
  emoji: string;
  prompt: string;
}

interface StoryMasterworkActionsProps {
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  fetchStoryPills: (flavorId?: string) => Promise<ActionItem[]>;
}

export function StoryMasterworkActions({ disabled, onSelect, fetchStoryPills }: StoryMasterworkActionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pills, setPills] = useState<ActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setPills([]);
    try {
      const result = await fetchStoryPills();
      setPills(result);
    } catch (e: any) {
      setError(e?.message || 'Could not generate suggestions.');
    } finally {
      setLoading(false);
    }
  }, [fetchStoryPills]);

  const close = useCallback(() => setOpen(false), []);

  const choose = useCallback((prompt: string) => {
    onSelect(prompt);
    setOpen(false);
  }, [onSelect]);

  return (
    <>
      <div className="relative w-full">
        <span
          className="absolute -inset-[2px] rounded-xl bg-green-500/70 animate-pulse"
          aria-hidden="true"
        />
        <button
          onClick={generate}
          disabled={disabled}
          className="relative isolate w-full flex flex-col justify-between items-center text-center min-h-[220px] py-5 px-4 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-100 hover:text-amber-50 text-xs leading-snug transition-colors disabled:opacity-40 overflow-hidden"
          style={{ touchAction: 'manipulation' }}
        >
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${offeringJointAsset.url})` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/20 to-black/80" aria-hidden="true" />
          <div className="flex items-start gap-2 justify-center w-full">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <span className="relative max-w-[260px]">
              Are you a pothead? Too high to roleplay? Not high enough?
            </span>
          </div>
          <span className="relative max-w-[260px]">
            No worries! Tap me and ill generate you some moves to choose from!{' '}
            <span className="font-bold text-amber-300">CLICK HERE!!!</span>
          </span>
        </button>
      </div>

      {open && createPortal(
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-900/30 bg-[#0d0d12]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-cinzel text-amber-300">Suggested Moves</span>
            </div>
            <div className="flex items-center gap-2">
              {!loading && (
                <button
                  onClick={generate}
                  className="flex items-center gap-1 text-[11px] text-amber-300/60 hover:text-amber-300 px-2 py-1 rounded"
                  style={{ touchAction: 'manipulation' }}
                  title="Regenerate"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              )}
              <button
                onClick={close}
                className="p-1.5 rounded-lg border border-amber-500/30 text-amber-300 hover:bg-amber-900/30"
                style={{ touchAction: 'manipulation' }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-amber-300/60">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs">Reading the scene...</span>
              </div>
            )}

            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-sm text-red-300/80 text-center">{error}</p>
                <button
                  onClick={generate}
                  className="text-xs text-amber-300 underline"
                  style={{ touchAction: 'manipulation' }}
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && pills.map((pill) => (
              <div
                key={pill.id}
                className="rounded-xl border border-amber-900/30 bg-amber-950/20 overflow-hidden"
              >
                <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                  <span className="text-lg leading-none mt-0.5">{pill.emoji}</span>
                  <div className="flex-1 min-w-0">
                    {pill.label && (
                      <p className="text-xs font-semibold text-amber-200/90 mb-1">{pill.label}</p>
                    )}
                    <p className="text-sm text-white/85 whitespace-pre-wrap break-words leading-relaxed">
                      {pill.prompt}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => choose(pill.prompt)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-amber-900/30 hover:bg-amber-900/50 border-t border-amber-900/30 text-amber-200 text-xs font-semibold transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  Use this
                </button>
              </div>
            ))}

            {!loading && !error && pills.length === 0 && (
              <div className="flex items-center justify-center py-16">
                <p className="text-xs text-white/40">No suggestions available.</p>
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-amber-900/30 bg-[#0d0d12]">
            <p className="text-[10px] text-white/40 text-center">
              Choosing a suggestion drops it into your input — you can still edit before you ready up.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
