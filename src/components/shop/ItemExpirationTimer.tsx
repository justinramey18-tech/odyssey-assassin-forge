// Item Expiration Timer - Countdown display for shop items

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItemExpirationTimerProps {
  expiresAt: string;
  onExpired: () => void;
  className?: string;
}

export function ItemExpirationTimer({
  expiresAt,
  onExpired,
  className,
}: ItemExpirationTimerProps) {
  const [remaining, setRemaining] = useState<number>(() => {
    const expiryTime = new Date(expiresAt).getTime();
    return Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) {
      onExpired();
      return;
    }

    const interval = setInterval(() => {
      const expiryTime = new Date(expiresAt).getTime();
      const newRemaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      
      setRemaining(newRemaining);
      
      if (newRemaining <= 0) {
        onExpired();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, remaining, onExpired]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Color based on time remaining
  const getTimerColor = () => {
    if (remaining <= 60) return 'text-red-400 bg-red-500/20 border-red-500/50';
    if (remaining <= 180) return 'text-amber-400 bg-amber-500/20 border-amber-500/50';
    return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/50';
  };

  const isUrgent = remaining <= 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
        "text-xs font-mono font-semibold",
        getTimerColor(),
        isUrgent && "animate-pulse",
        className,
      )}
    >
      <Timer className="w-3 h-3" />
      <span>{formatTime(remaining)}</span>
    </motion.div>
  );
}
