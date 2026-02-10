import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  Heart, 
  AlertTriangle, 
  Target, 
  CheckCircle2, 
  HandHelping, 
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export interface PingType {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  emoji: string;
}

export const PING_TYPES: PingType[] = [
  { id: 'need_heal', label: 'Need Heal', icon: Heart, color: 'text-rose-400', bgColor: 'bg-rose-500/20', borderColor: 'border-rose-500/40', emoji: '❤️‍🩹' },
  { id: 'danger', label: 'Danger!', icon: AlertTriangle, color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500/40', emoji: '⚠️' },
  { id: 'focus_target', label: 'Focus Fire', icon: Target, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/40', emoji: '🎯' },
  { id: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-500/40', emoji: '✅' },
  { id: 'help', label: 'Help!', icon: HandHelping, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/40', emoji: '🆘' },
  { id: 'retreat', label: 'Retreat', icon: ShieldAlert, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500/40', emoji: '🏃' },
];

interface PartyPingBarProps {
  onSendPing: (pingType: string) => Promise<void>;
  disabled?: boolean;
}

export function PartyPingBar({ onSendPing, disabled }: PartyPingBarProps) {
  const [cooldown, setCooldown] = useState<string | null>(null);

  const handlePing = useCallback(async (ping: PingType) => {
    if (cooldown || disabled) return;
    
    setCooldown(ping.id);
    try {
      await onSendPing(ping.id);
    } catch {
      toast.error('Failed to send ping');
    }
    // 3s cooldown per ping
    setTimeout(() => setCooldown(null), 3000);
  }, [cooldown, disabled, onSendPing]);

  return (
    <div className="space-y-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-cinzel">
        Tactical Pings
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {PING_TYPES.map((ping) => {
          const Icon = ping.icon;
          const isCooling = cooldown === ping.id;
          const isDisabled = disabled || !!cooldown;
          
          return (
            <button
              key={ping.id}
              onClick={() => handlePing(ping)}
              disabled={isDisabled}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                "min-h-[52px] active:scale-95",
                ping.bgColor, ping.borderColor,
                isDisabled && "opacity-40 cursor-not-allowed",
                !isDisabled && "hover:opacity-80",
              )}
            >
              {isCooling ? (
                <Loader2 className={cn("w-4 h-4 animate-spin", ping.color)} />
              ) : (
                <Icon className={cn("w-4 h-4", ping.color)} />
              )}
              <span className={cn("text-[9px] font-semibold uppercase tracking-wide", ping.color)}>
                {ping.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
