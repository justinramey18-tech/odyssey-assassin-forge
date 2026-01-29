import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ClockWidget() {
  const [time, setTime] = useState<string>('');

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

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-black/60 backdrop-blur-md border border-red-900/40',
        'text-sm font-mono tracking-wide'
      )}
    >
      <Clock className="w-3.5 h-3.5 text-red-400" />
      <span className="text-zinc-100">{time}</span>
      <span className="text-xs text-muted-foreground">EST</span>
    </div>
  );
}
