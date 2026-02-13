import { useState } from 'react';
import { Check, X, Coins, Package, Sword, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export interface PendingTradeAction {
  id: string;
  senderName: string;
  tradeType: 'send_gold' | 'send_consumable' | 'send_gear' | 'send_loot';
  itemName: string;
  amount?: number; // for gold
  rarity?: string;
}

interface IncomingTradeNotificationProps {
  action: PendingTradeAction;
  onAccept: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

const tradeTypeConfig: Record<string, { icon: typeof Coins; color: string; borderColor: string; label: string }> = {
  send_gold: { icon: Coins, color: 'text-amber-400', borderColor: 'border-amber-500/40', label: 'Gold' },
  send_consumable: { icon: ScrollText, color: 'text-rose-400', borderColor: 'border-rose-500/40', label: 'Consumable' },
  send_gear: { icon: Sword, color: 'text-blue-400', borderColor: 'border-blue-500/40', label: 'Gear' },
  send_loot: { icon: Package, color: 'text-purple-400', borderColor: 'border-purple-500/40', label: 'Loot' },
};

function IncomingTradeNotification({ action, onAccept, onReject }: IncomingTradeNotificationProps) {
  const [responding, setResponding] = useState(false);
  const config = tradeTypeConfig[action.tradeType] || tradeTypeConfig.send_gold;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90vw] max-w-sm"
    >
      <div className={`rounded-xl border ${config.borderColor} bg-card/95 backdrop-blur-lg shadow-lg p-4 space-y-3`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color} animate-pulse`} />
          <span className="font-cinzel font-semibold text-sm text-foreground">
            Incoming {config.label}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{action.senderName}</span>
          {' '}wants to send you{' '}
          {action.tradeType === 'send_gold' ? (
            <span className="font-bold text-amber-400">{action.amount} gold</span>
          ) : (
            <span className="font-bold text-foreground">{action.itemName}</span>
          )}
          .
        </p>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={responding}
            onClick={() => { setResponding(true); onAccept(action.id); }}
          >
            <Check className="w-3.5 h-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={responding}
            onClick={() => { setResponding(true); onReject(action.id); }}
          >
            <X className="w-3.5 h-3.5" />
            Reject
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface IncomingTradeOverlayProps {
  pendingTrades: PendingTradeAction[];
  onAccept: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

export function IncomingTradeOverlay({ pendingTrades, onAccept, onReject }: IncomingTradeOverlayProps) {
  return (
    <AnimatePresence>
      {pendingTrades.length > 0 && (
        <IncomingTradeNotification
          key={pendingTrades[0].id}
          action={pendingTrades[0]}
          onAccept={onAccept}
          onReject={onReject}
        />
      )}
    </AnimatePresence>
  );
}
