import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Pause, Play, X, Clock, Plus, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DmSessionConfig } from '@/hooks/use-party-dm';

interface RoundTimerProps {
  sessionConfig: DmSessionConfig | null;
  isCreator: boolean;
  currentUserId?: string;
  characterName?: string;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onCancelTimer: () => void;
  onRequestExtension: () => void;
  onApproveExtension: (seconds: number) => void;
  onDismissExtensions: () => void;
  onTimerExpire: () => void;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RoundTimer({
  sessionConfig,
  isCreator,
  currentUserId,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onCancelTimer,
  onRequestExtension,
  onApproveExtension,
  onDismissExtensions,
  onTimerExpire,
}: RoundTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [hasExpired, setHasExpired] = useState(false);

  const timerEnabled = sessionConfig?.timerEnabled ?? false;
  const timerDuration = sessionConfig?.timerDurationSeconds ?? 0;
  const timerStartedAt = sessionConfig?.timerStartedAt ?? null;
  const timerPaused = sessionConfig?.timerPausedRemaining ?? null;
  const extensionRequests = sessionConfig?.extensionRequests ?? [];

  const isPaused = timerPaused != null && timerStartedAt == null;
  const isRunning = timerStartedAt != null;
  const isIdle = !isRunning && !isPaused;

  const hasRequested = useMemo(
    () => extensionRequests.some(r => r.userId === currentUserId),
    [extensionRequests, currentUserId]
  );

  // Tick every second when running + catch up on tab visibility change
  useEffect(() => {
    if (!isRunning || !timerStartedAt) {
      if (isPaused) {
        setRemaining(timerPaused);
      } else {
        setRemaining(null);
      }
      setHasExpired(false);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - new Date(timerStartedAt).getTime()) / 1000;
      const left = Math.max(0, timerDuration - elapsed);
      setRemaining(left);
      if (left <= 0 && !hasExpired) {
        setHasExpired(true);
        onTimerExpire();
      }
    };

    tick();
    const id = setInterval(tick, 1000);

    // When tab returns from background, immediately check if timer expired
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Also set a precise setTimeout for the exact expiry moment as a backup
    const elapsed = (Date.now() - new Date(timerStartedAt).getTime()) / 1000;
    const msUntilExpiry = Math.max(0, (timerDuration - elapsed) * 1000);
    const backupTimeout = setTimeout(tick, msUntilExpiry + 100);

    return () => {
      clearInterval(id);
      clearTimeout(backupTimeout);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isRunning, timerStartedAt, timerDuration, isPaused, timerPaused, hasExpired, onTimerExpire]);

  if (!timerEnabled) return null;

  const progress = remaining != null && timerDuration > 0
    ? Math.max(0, Math.min(1, remaining / timerDuration))
    : 1;

  const isUrgent = remaining != null && remaining <= 30;
  const isCritical = remaining != null && remaining <= 10;

  return (
    <div className="w-full">
      {/* Timer bar */}
      <AnimatePresence>
        {(isRunning || isPaused) && remaining != null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-1.5"
          >
            {/* Progress bar */}
            <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden mb-1.5">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-colors duration-500",
                  isCritical ? "bg-red-500" : isUrgent ? "bg-amber-500" : "bg-emerald-500",
                  isPaused && "opacity-50"
                )}
                style={{ width: `${progress * 100}%` }}
                animate={isCritical ? { opacity: [1, 0.5, 1] } : {}}
                transition={isCritical ? { repeat: Infinity, duration: 0.8 } : {}}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Timer className={cn(
                  "w-3 h-3",
                  isCritical ? "text-red-400" : isUrgent ? "text-amber-400" : "text-white/40"
                )} />
                <span className={cn(
                  "text-xs font-mono tabular-nums",
                  isCritical ? "text-red-400 font-bold" : isUrgent ? "text-amber-400" : "text-white/60",
                  isPaused && "opacity-50"
                )}>
                  {formatTime(remaining)}
                  {isPaused && <span className="ml-1 text-[9px] text-white/30">(paused)</span>}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Extension requests badge */}
                {extensionRequests.length > 0 && isCreator && (
                  <div className="flex items-center gap-1 mr-1">
                    <span className="text-[9px] text-amber-300 bg-amber-900/30 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                      {extensionRequests.length} ext. {extensionRequests.length === 1 ? 'request' : 'requests'}
                    </span>
                    <button
                      onClick={() => onApproveExtension(60)}
                      className="p-0.5 rounded hover:bg-emerald-900/30 text-emerald-400/60 hover:text-emerald-400 transition-colors"
                      title="Add 1 minute"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={onDismissExtensions}
                      className="p-0.5 rounded hover:bg-red-900/20 text-white/30 hover:text-white/60 transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Player extension request button */}
                {!isCreator && isRunning && (
                  <button
                    onClick={onRequestExtension}
                    disabled={hasRequested}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] border transition-colors",
                      hasRequested
                        ? "bg-white/5 border-white/10 text-white/30 cursor-default"
                        : "bg-amber-900/20 border-amber-500/20 text-amber-300 hover:bg-amber-900/40"
                    )}
                    title={hasRequested ? "Extension requested" : "Request more time"}
                  >
                    {hasRequested ? "Requested" : "+Time"}
                  </button>
                )}

                {/* Host controls */}
                {isCreator && (
                  <>
                    {isRunning && (
                      <button
                        onClick={onPauseTimer}
                        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                        title="Pause timer"
                      >
                        <Pause className="w-3 h-3" />
                      </button>
                    )}
                    {isPaused && (
                      <button
                        onClick={onResumeTimer}
                        className="p-1 rounded hover:bg-emerald-900/20 text-emerald-400/60 hover:text-emerald-400 transition-colors"
                        title="Resume timer"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={onCancelTimer}
                      className="p-1 rounded hover:bg-red-900/20 text-white/30 hover:text-red-400 transition-colors"
                      title="Cancel timer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle state: host can start */}
      {isCreator && isIdle && !sessionConfig?.isGenerating && (
        <div className="px-3 py-1 flex items-center justify-end">
          <button
            onClick={onStartTimer}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title="Start round timer"
          >
            <Timer className="w-3 h-3" />
            Start Timer
          </button>
        </div>
      )}
    </div>
  );
}

// ── Timer Settings (for session start / settings) ──────────────────────────

interface TimerSettingsProps {
  enabled: boolean;
  durationSeconds: number;
  onEnabledChange: (enabled: boolean) => void;
  onDurationChange: (seconds: number) => void;
}

export function TimerSettings({ enabled, durationSeconds, onEnabledChange, onDurationChange }: TimerSettingsProps) {
  const [unit, setUnit] = useState<'seconds' | 'minutes' | 'hours'>(() => {
    if (durationSeconds >= 3600 && durationSeconds % 3600 === 0) return 'hours';
    if (durationSeconds >= 60) return 'minutes';
    return 'seconds';
  });

  const getDisplayValue = useCallback((secs: number, u: typeof unit) => {
    if (u === 'hours') return Math.round(secs / 3600);
    if (u === 'minutes') return Math.round(secs / 60);
    return secs;
  }, []);

  // Local string state so user can clear the field while typing
  const [localValue, setLocalValue] = useState(() => String(getDisplayValue(durationSeconds, unit)));

  // Sync from parent when durationSeconds changes externally
  useEffect(() => {
    setLocalValue(String(getDisplayValue(durationSeconds, unit)));
  }, [durationSeconds, unit, getDisplayValue]);

  const commitValue = useCallback((raw: string) => {
    const parsed = parseInt(raw);
    const val = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    if (unit === 'hours') onDurationChange(val * 3600);
    else if (unit === 'minutes') onDurationChange(val * 60);
    else onDurationChange(val);
    setLocalValue(String(val));
  }, [unit, onDurationChange]);

  const handleUnitChange = useCallback((newUnit: typeof unit) => {
    setUnit(newUnit);
    // Convert current value to new unit sensibly
    if (newUnit === 'minutes' && durationSeconds < 60) onDurationChange(60);
    if (newUnit === 'hours' && durationSeconds < 3600) onDurationChange(3600);
  }, [durationSeconds, onDurationChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-white/70">Round Timer</span>
        </div>
        <button
          onClick={() => onEnabledChange(!enabled)}
          className={cn(
            "relative w-9 h-5 rounded-full transition-colors",
            enabled ? "bg-emerald-600" : "bg-white/20"
          )}
        >
          <div className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5"
          )} />
        </button>
      </div>

      <AnimatePresence>
        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={() => commitValue(localValue)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitValue(localValue); }}
                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-amber-500/40"
              />
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                {(['seconds', 'minutes', 'hours'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => handleUnitChange(u)}
                    className={cn(
                      "px-2 py-1.5 text-[10px] transition-colors",
                      unit === u
                        ? "bg-amber-900/40 text-amber-300"
                        : "bg-white/5 text-white/40 hover:text-white/60"
                    )}
                  >
                    {u === 'seconds' ? 'sec' : u === 'minutes' ? 'min' : 'hr'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-white/30 mt-1">
              Timer auto-starts each round. Host can pause/resume/cancel.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
