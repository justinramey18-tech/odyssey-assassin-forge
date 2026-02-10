import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PartyMember } from '@/hooks/use-party-sync';

interface HealTargetPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selfName: string;
  partyMembers: PartyMember[];
  currentUserId: string;
  onSelectSelf: () => void;
  onSelectMember: (member: PartyMember) => void;
  healDescription: string;
}

export function HealTargetPicker({
  open,
  onOpenChange,
  selfName,
  partyMembers,
  currentUserId,
  onSelectSelf,
  onSelectMember,
  healDescription,
}: HealTargetPickerProps) {
  const others = partyMembers.filter(m => m.user_id !== currentUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-emerald-400" />
            Choose Heal Target
          </DialogTitle>
          <DialogDescription>{healDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Self option */}
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-14 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => { onSelectSelf(); onOpenChange(false); }}
          >
            <User className="w-5 h-5 text-emerald-400" />
            <div className="text-left">
              <p className="font-semibold text-sm">{selfName}</p>
              <p className="text-[10px] text-muted-foreground">Heal yourself</p>
            </div>
          </Button>

          {/* Party members */}
          {others.map(member => {
            const hp = member.character_status.currentHP ?? 0;
            const maxHp = member.character_status.maxHP ?? 1;
            const percent = Math.round((hp / maxHp) * 100);
            return (
              <Button
                key={member.id}
                variant="outline"
                className="w-full justify-start gap-3 h-14 border-primary/30 hover:bg-primary/10"
                onClick={() => { onSelectMember(member); onOpenChange(false); }}
              >
                <Users className="w-5 h-5 text-primary" />
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm">{member.character_name}</p>
                  <p className={cn(
                    "text-[10px]",
                    percent > 50 ? "text-emerald-400" : percent > 25 ? "text-amber-400" : "text-red-400"
                  )}>
                    {hp}/{maxHp} HP ({percent}%)
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
