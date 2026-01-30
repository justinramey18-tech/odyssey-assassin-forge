import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Glass } from '@/components/ui/glass';

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
    <Glass
      variant="default"
      rounded="full"
      className="flex items-center gap-2 px-3 py-1.5 text-sm font-mono tracking-wide"
    >
      <Clock className="w-3.5 h-3.5 text-red-400" />
      <span className="text-white">{time}</span>
      <span className="text-xs text-white/60">EST</span>
    </Glass>
  );
}
