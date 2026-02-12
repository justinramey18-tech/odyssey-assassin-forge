import { useState, useEffect, useCallback } from 'react';
import { Clock, Copy, Check } from 'lucide-react';
import { Glass } from '@/components/ui/glass';
import { getCurrentESTTimestamp } from '@/lib/fourthWallTime';
import { loadTimezone, getTimezoneAbbr, formatTimeForTimezone, TIMEZONE_CHANGE_EVENT } from '@/lib/timezone-storage';

export function ClockWidget() {
  const [time, setTime] = useState<string>('');
  const [abbr, setAbbr] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [tz, setTz] = useState(() => loadTimezone());

  // Listen for timezone changes
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setTz(customEvent.detail);
    };
    window.addEventListener(TIMEZONE_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(TIMEZONE_CHANGE_EVENT, handleChange);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      setTime(formatTimeForTimezone(tz));
      setAbbr(getTimezoneAbbr(tz));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [tz]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getCurrentESTTimestamp());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silent fail
    }
  }, []);

  return (
    <Glass
      variant="default"
      rounded="full"
      className="flex items-center gap-1.5 px-2 py-1 text-xs font-mono tracking-wide"
    >
      <Clock className="w-3 h-3 text-red-400" />
      <span className="text-white">{time}</span>
      <span className="text-[10px] text-white/60">{abbr}</span>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-white/10 transition-colors"
        aria-label="Copy current time"
      >
        {copied ? (
          <Check className="w-2.5 h-2.5 text-green-400" />
        ) : (
          <Copy className="w-2.5 h-2.5 text-white/50" />
        )}
      </button>
    </Glass>
  );
}
