// Settings → Empyrean account: the opt-in switch for a separate Empyrean account on this
// phone, and the ways in and out (see src/lib/account-space.ts).
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { currentSpace, isSeparateEmpyreanOn, setSeparateEmpyrean } from '@/lib/account-space';
import { enterEmpyreanAccount, returnToOdyssey } from '@/lib/account-space-switch';

export function EmpyreanAccountSettings() {
  const inEmpyrean = currentSpace() === 'empyrean';
  const [on, setOn] = useState(() => isSeparateEmpyreanOn());

  if (inEmpyrean) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">You're in your separate Empyrean account.</p>
        <p className="text-xs text-muted-foreground">
          Your Odyssey characters are put away safely on this phone until you return.
        </p>
        <Button
          variant="outline"
          onClick={() => { void returnToOdyssey(); }}
          className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          style={{ touchAction: 'manipulation' }}
        >
          Return to Odyssey
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-foreground">Separate Empyrean account</p>
          <p className="text-xs text-muted-foreground mt-1">
            When on, picking Empyrean on this phone opens a second account just for your riders and
            campaigns. Your Odyssey characters stay in this account. Other players are not affected.
          </p>
        </div>
        <Switch
          checked={on}
          onCheckedChange={next => {
            setSeparateEmpyrean(next);
            setOn(next);
            toast(next ? 'Empyrean will open its own account on this phone' : 'Empyrean opens in this account again');
          }}
          aria-label="Separate Empyrean account"
        />
      </div>
      {on && (
        <Button
          variant="outline"
          onClick={() => { void enterEmpyreanAccount(); }}
          className="w-full h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          style={{ touchAction: 'manipulation' }}
        >
          🐉 Open Empyrean account
        </Button>
      )}
    </div>
  );
}
