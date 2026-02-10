import { useState } from 'react';
import { Heart, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface PendingHealAction {
  id: string;
  senderName: string;
  source: string;
  hpHealed: number;
}

interface IncomingHealNotificationProps {
  action: PendingHealAction;
  onAccept: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

export function IncomingHealNotification({ action, onAccept, onReject }: IncomingHealNotificationProps) {
  const [responding, setResponding] = useState(false);

  const handleAccept = () => {
    setResponding(true);
    onAccept(action.id);
  };

  const handleReject = () => {
    setResponding(true);
    onReject(action.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90vw] max-w-sm"
    >
      <div className="rounded-xl border border-emerald-500/40 bg-card/95 backdrop-blur-lg shadow-lg shadow-emerald-500/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-emerald-400 animate-pulse" />
          <span className="font-cinzel font-semibold text-sm text-foreground">
            Incoming Heal
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{action.senderName}</span>
          {' '}wants to heal you for{' '}
          <span className="font-bold text-emerald-400">+{action.hpHealed} HP</span>
          {' '}with <span className="italic">{action.source}</span>.
        </p>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={responding}
            onClick={handleAccept}
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={responding}
            onClick={handleReject}
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface IncomingHealOverlayProps {
  pendingHeals: PendingHealAction[];
  onAccept: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

export function IncomingHealOverlay({ pendingHeals, onAccept, onReject }: IncomingHealOverlayProps) {
  return (
    <AnimatePresence>
      {pendingHeals.length > 0 && (
        <IncomingHealNotification
          key={pendingHeals[0].id}
          action={pendingHeals[0]}
          onAccept={onAccept}
          onReject={onReject}
        />
      )}
    </AnimatePresence>
  );
}
