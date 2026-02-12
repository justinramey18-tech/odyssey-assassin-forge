import { useState, useEffect, useCallback } from 'react';
import { Clock, Copy, Check } from 'lucide-react';
import { Glass } from '@/components/ui/glass';
import { getCurrentESTTimestamp } from '@/lib/fourthWallTime';

export function ClockWidget() {
  const [time, setTime] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const estTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
      setTime(estTime);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

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
      <span className="text-[10px] text-white/60">EST</span>
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
