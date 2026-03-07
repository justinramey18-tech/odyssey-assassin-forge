import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Sword, Sparkles, BookOpen, Flame, FlaskConical, ChevronDown, Wand2, Zap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { scoreToModifier, modifierToString } from '@/lib/abilityScores/types';
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

function SubSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 px-2 hover:bg-muted/10 rounded transition-colors">
        {icon}
        <span className="text-[11px] font-semibold">{title}</span>
        <span className="text-[10px] text-muted-foreground">({count})</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground ml-auto transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pb-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

const ABILITY_META = [
  { key: 'str', label: 'STR', color: 'text-red-400' },
  { key: 'dex', label: 'DEX', color: 'text-green-400' },
  { key: 'con', label: 'CON', color: 'text-orange-400' },
  { key: 'int', label: 'INT', color: 'text-blue-400' },
  { key: 'wis', label: 'WIS', color: 'text-purple-400' },
  { key: 'cha', label: 'CHA', color: 'text-pink-400' },
] as const;

function AbilityScoresGrid({ scores }: { scores: { str: number; dex: number; con: number; int: number; wis: number; cha: number } }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {ABILITY_META.map(({ key, label, color }) => {
        const score = scores[key];
        const mod = scoreToModifier(score);
        return (
          <div key={key} className="flex flex-col items-center py-1.5 rounded bg-muted/20">
            <span className={cn("text-[9px] font-bold", color)}>{label}</span>
            <span className="text-sm font-bold text-foreground">{score}</span>
            <span className="text-[10px] text-muted-foreground">{modifierToString(mod)}</span>
          </div>
        );
      })}
    </div>
  );
}

function BuildOverview({ status }: { status: PartyMember['character_status'] }) {
  const identityLine = [status.gender, status.race].filter(Boolean).join(' ');
  const multiclassEntries = status.multiclassLevels ? Object.entries(status.multiclassLevels) : [];
  const hasMulticlass = multiclassEntries.length > 1;
  const gear = status.equippedGear ?? [];

  return (
    <div className="space-y-2 pb-2 border-b border-border/30">
      {/* Identity line */}
      {identityLine && (
        <div className="text-[11px] text-muted-foreground px-1">{identityLine}</div>
      )}

      {/* Multiclass breakdown */}
      {hasMulticlass && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {multiclassEntries.map(([cls, lvl]) => (
            <span key={cls} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium capitalize">
              {cls} {lvl}
            </span>
          ))}
        </div>
      )}

      {/* Ability Scores */}
      {status.abilityScores && <AbilityScoresGrid scores={status.abilityScores} />}

      {/* Equipped Gear */}
      {gear.length > 0 && (
        <Section title="Equipped Gear" icon={<Shield className="w-3.5 h-3.5 text-muted-foreground" />} count={gear.length} defaultOpen={false}>
          {gear.map((g, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
              <span className="font-medium">{g.name}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{g.slot.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

export function PartyMemberQuickActionsViewer({ member, open, onOpenChange }: PartyMemberQuickActionsViewerProps) {
  const status = member?.character_status;
  const qa: QuickActions = status?.quickActions ?? { weapons: [], abilities: [], spells: [], cantrips: [], consumables: [] };

  // Full viewport height on mobile
  const [containerHeight, setContainerHeight] = React.useState('auto');

  React.useEffect(() => {
    if (typeof window !== 'undefined' && open) {
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      setContainerHeight(`${Math.max(vh - 120, 400)}px`);
    }
  }, [open]);

  // Compute homebrew aggregation
  const homebrewData = useMemo(() => {
    const hbAbilities = qa.abilities.filter(a => a.isHomebrew);
    const abilityByTree: Record<string, typeof hbAbilities> = {};
    hbAbilities.forEach(a => {
      const tree = a.tree || 'other';
      if (!abilityByTree[tree]) abilityByTree[tree] = [];
      abilityByTree[tree].push(a);
    });

    const hbSpells = qa.spells.filter(s => s.isHomebrew);
    const hbCantrips = qa.cantrips.filter(c => c.isHomebrew);
    const spellsByLevel: Record<number, typeof hbSpells> = {};
    if (hbCantrips.length > 0) {
      spellsByLevel[0] = hbCantrips.map(c => ({ name: c.name, level: 0, school: c.school, concentration: false, isHomebrew: true as const }));
    }
    hbSpells.forEach(s => {
      if (!spellsByLevel[s.level]) spellsByLevel[s.level] = [];
      spellsByLevel[s.level].push(s);
    });

    const totalCount = hbAbilities.length + hbSpells.length + hbCantrips.length;
    return { abilityByTree, spellsByLevel, totalCount };
  }, [qa]);

  const hasBuildOverview = !!(status?.race || status?.gender || status?.abilityScores || (status?.equippedGear && status.equippedGear.length > 0) || (status?.multiclassLevels && Object.keys(status.multiclassLevels).length > 1));

  if (!member) return null;

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
          {/* Build Overview */}
          {hasBuildOverview && <BuildOverview status={status} />}

          {/* Weapons */}
          <Section title="Weapons" icon={<Sword className="w-3.5 h-3.5 text-red-400" />} count={qa.weapons.length}>
            {qa.weapons.map((w, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <span className="font-medium">{w.name}</span>
                <span className="text-muted-foreground">{w.damage} {w.damageType}</span>
              </div>
            ))}
          </Section>

          {/* Abilities (non-homebrew only) */}
          <Section title="Abilities" icon={<Flame className="w-3.5 h-3.5 text-amber-400" />} count={qa.abilities.filter(a => !a.isHomebrew).length}>
            {qa.abilities.filter(a => !a.isHomebrew).map((a, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                <div className="flex items-center gap-1.5">
                  {a.image ? (
                    <img src={a.image} alt={a.name} className="w-5 h-5 rounded object-cover shrink-0" />
                  ) : null}
                  <span className="font-medium">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">{a.tree} T{a.tier}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{a.actionType}</span>
              </div>
            ))}
          </Section>

          {/* Spells (non-homebrew only) */}
          <Section title="Prepared Spells" icon={<BookOpen className="w-3.5 h-3.5 text-blue-400" />} count={qa.spells.filter(s => !s.isHomebrew).length}>
            {qa.spells.filter(s => !s.isHomebrew).map((s, i) => (
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

          {/* Cantrips (non-homebrew only) */}
          <Section title="Cantrips" icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />} count={qa.cantrips.filter(c => !c.isHomebrew).length}>
            {qa.cantrips.filter(c => !c.isHomebrew).map((c, i) => (
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

          {/* ── HOMEBREW (Aggregated) ── */}
          {homebrewData.totalCount > 0 && (
            <Section title="Homebrew" icon={<Flame className="w-3.5 h-3.5 text-amber-400" />} count={homebrewData.totalCount} defaultOpen={false}>
              {/* Ability sub-categories by tree */}
              {(['hunter', 'warrior', 'assassin'] as const).map(tree => {
                const items = homebrewData.abilityByTree[tree];
                if (!items || items.length === 0) return null;
                const treeColor = tree === 'hunter' ? 'text-green-400' : tree === 'warrior' ? 'text-red-400' : 'text-purple-400';
                const treeName = tree.charAt(0).toUpperCase() + tree.slice(1);
                return (
                  <SubSection key={tree} title={treeName} icon={<Zap className={cn("w-3 h-3", treeColor)} />} count={items.length}>
                    {items.map((a, i) => (
                      <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                        <div className="flex items-center gap-1.5">
                          {a.image ? (
                            <img src={a.image} alt={a.name} className="w-5 h-5 rounded object-cover shrink-0" />
                          ) : null}
                          <span className="font-medium">{a.name}</span>
                          <span className="text-[10px] text-amber-400 font-mono">T{a.tier}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{a.actionType}</span>
                      </div>
                    ))}
                  </SubSection>
                );
              })}

              {/* Spell sub-categories by level */}
              {Object.keys(homebrewData.spellsByLevel)
                .map(Number)
                .sort((a, b) => a - b)
                .map(level => {
                  const spells = homebrewData.spellsByLevel[level];
                  const levelLabel = level === 0 ? 'Cantrips' : `${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'} Level`;
                  const LevelIcon = level === 0 ? Sparkles : Wand2;
                  return (
                    <SubSection key={`lvl-${level}`} title={levelLabel} icon={<LevelIcon className={cn("w-3 h-3", level === 0 ? "text-cyan-400" : "text-indigo-400")} />} count={spells.length}>
                      {spells.map((s, i) => (
                        <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/20 text-xs">
                          <div>
                            <span className="font-medium">{s.name}</span>
                            {level > 0 && <span className="text-[10px] text-muted-foreground ml-1.5">Lv.{s.level}</span>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{s.school}</span>
                        </div>
                      ))}
                    </SubSection>
                  );
                })}
            </Section>
          )}

          {/* Empty state */}
          {qa.weapons.length === 0 && qa.abilities.length === 0 && qa.spells.length === 0 &&
           qa.cantrips.length === 0 && qa.consumables.length === 0 && !hasBuildOverview && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No quick actions shared yet
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
