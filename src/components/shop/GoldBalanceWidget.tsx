// Gold Balance Widget - Shows current gold with manual adjustment

import { useState } from 'react';
import { Coins, Plus, Minus, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

interface GoldBalanceWidgetProps {
  currentGold: number;
  onAdjustGold?: (amount: number) => void;
  onSetGold?: (amount: number) => void;
  className?: string;
}

export function GoldBalanceWidget({ 
  currentGold, 
  onAdjustGold,
  onSetGold,
  className 
}: GoldBalanceWidgetProps) {
  const [open, setOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [mode, setMode] = useState<'adjust' | 'set'>('adjust');
  const { toast } = useToast();

  const formattedGold = Math.max(0, currentGold).toLocaleString();
  const canEdit = onAdjustGold || onSetGold;

  const handleQuickAdjust = (amount: number) => {
    if (onAdjustGold) {
      onAdjustGold(amount);
      toast({
        title: amount > 0 ? 'Gold Added' : 'Gold Spent',
        description: `${amount > 0 ? '+' : ''}${amount} GP`,
      });
    }
  };

  const handleSubmit = () => {
    const value = parseInt(adjustAmount, 10);
    if (isNaN(value)) return;

    if (mode === 'adjust' && onAdjustGold) {
      onAdjustGold(value);
      toast({
        title: value > 0 ? 'Gold Added' : 'Gold Spent',
        description: `${value > 0 ? '+' : ''}${value} GP`,
      });
    } else if (mode === 'set' && onSetGold) {
      const safeValue = Math.max(0, Math.min(value, 9999999));
      onSetGold(safeValue);
      toast({
        title: 'Gold Set',
        description: `Balance set to ${safeValue.toLocaleString()} GP`,
      });
    }

    setAdjustAmount('');
    setOpen(false);
  };

  if (!canEdit) {
    // Read-only display
    return (
      <div className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg",
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/10",
        "border border-amber-500/30",
        className
      )}>
        <Coins className="w-5 h-5 text-amber-400" />
        <span className="font-cinzel text-lg font-bold text-amber-300">
          {formattedGold}
        </span>
        <span className="text-xs text-amber-400/70 uppercase tracking-wider">GP</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-gradient-to-r from-amber-500/20 to-yellow-500/10",
            "border border-amber-500/30",
            "hover:from-amber-500/30 hover:to-yellow-500/20",
            "transition-colors cursor-pointer group",
            className
          )}
        >
          <Coins className="w-5 h-5 text-amber-400" />
          <span className="font-cinzel text-lg font-bold text-amber-300">
            {formattedGold}
          </span>
          <span className="text-xs text-amber-400/70 uppercase tracking-wider">GP</span>
          <Edit2 className="w-3 h-3 text-amber-400/50 group-hover:text-amber-400 ml-1 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-4" 
        align="end"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
            <p className="font-cinzel text-2xl font-bold text-amber-400">
              {formattedGold} <span className="text-sm">GP</span>
            </p>
          </div>

          {/* Quick Adjust Buttons */}
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdjust(-10)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              -10
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdjust(-1)}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              -1
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdjust(1)}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              +1
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdjust(10)}
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
            >
              +10
            </Button>
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === 'adjust' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('adjust')}
                className="flex-1 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add/Subtract
              </Button>
              <Button
                variant={mode === 'set' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('set')}
                className="flex-1 text-xs"
              >
                Set Total
              </Button>
            </div>

            {/* Custom Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="gold-amount" className="text-xs">
                {mode === 'adjust' ? 'Amount (use negative to subtract)' : 'New Balance'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="gold-amount"
                  type="number"
                  placeholder={mode === 'adjust' ? 'e.g. 50 or -25' : 'e.g. 500'}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                  min={mode === 'set' ? 0 : undefined}
                  max={9999999}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSubmit}
                  disabled={!adjustAmount || isNaN(parseInt(adjustAmount, 10))}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500"
                >
                  {mode === 'adjust' ? (
                    parseInt(adjustAmount, 10) < 0 ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />
                  ) : (
                    'Set'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}