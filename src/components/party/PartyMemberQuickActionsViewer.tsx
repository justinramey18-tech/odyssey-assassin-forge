import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Sword, Sparkles, BookOpen, Flame, FlaskConical, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { PartyMember, QuickActions } from '@/hooks/use-party-sync';

interface PartyMemberQuickActionsViewerProps {
  member: PartyMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({
  title,
  icon,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 hover:bg-muted/10 rounded transition-colors">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-muted-foreground ml-1">({count})</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function PartyMemberQuickActionsViewer({ member, open, onOpenChange }: PartyMemberQuickActionsViewerProps) {
  if (!member) return null;

  const status = member.character_status;
  const qa: QuickActions = status.quickActions ?? { weapons: [], abilities: [], spells: [], cantrips: [], consumables: [] };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[75vh] rounded-t-2xl bg-card/95 backdrop-blur-xl border-t border-border/40"
      >
        <SheetHeader className="pb-3 border-b border-border/30">
          <SheetTitle className="flex items-center gap-3">
            <Avatar className="w-9 h-9">
              {status.profileImage ? (
                <AvatarImage src={status.profileImage} alt={member.character_name} />
              ) : null}
              <AvatarFallback className="text-sm font-bold bg-primary/20 text-primary">
                {member.character_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-cinzel text-base">{member.character_name}</div>
              <div className="text-[11px] text-muted-foreground font-normal">
                {status.className && <span>{status.className}</span>}
                {status.level && <span> · Lv.{status.level}</span>}
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto max-h-[55vh] py-3 space-y-1">
          {/* Weapons */}
          <Section title="Weapons" icon={<Sword className="w-3.5 h-3.5 text-red-400" />} count={qa.weapons.length}>
            {qa.weapons.map((w, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <span className="font-medium">{w.name}</span>
                <span className="text-muted-foreground">{w.damage} {w.damageType}</span>
              </div>
            ))}
          </Section>

          {/* Abilities */}
          <Section title="Abilities" icon={<Flame className="w-3.5 h-3.5 text-amber-400" />} count={qa.abilities.length}>
            {qa.abilities.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <div>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">{a.tree} T{a.tier}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{a.actionType}</span>
              </div>
            ))}
          </Section>

          {/* Spells */}
          <Section title="Prepared Spells" icon={<BookOpen className="w-3.5 h-3.5 text-blue-400" />} count={qa.spells.length}>
            {qa.spells.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">Lv.{s.level}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{s.school}</span>
                  {s.concentration && (
                    <span className="px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px]">C</span>
                  )}
                </div>
              </div>
            ))}
          </Section>

          {/* Cantrips */}
          <Section title="Cantrips" icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />} count={qa.cantrips.length}>
            {qa.cantrips.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <span className="font-medium">{c.name}</span>
                <span className="text-[10px] text-muted-foreground">{c.school}</span>
              </div>
            ))}
          </Section>

          {/* Consumables */}
          <Section title="Consumables" icon={<FlaskConical className="w-3.5 h-3.5 text-emerald-400" />} count={qa.consumables.length}>
            {qa.consumables.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">×{c.quantity}</span>
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.effect}</span>
              </div>
            ))}
          </Section>

          {/* Empty state */}
          {qa.weapons.length === 0 && qa.abilities.length === 0 && qa.spells.length === 0 &&
           qa.cantrips.length === 0 && qa.consumables.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No quick actions shared yet
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
