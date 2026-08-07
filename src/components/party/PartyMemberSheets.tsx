import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, Heart, Shield, Sword, Sparkles, BookOpen, FlaskConical, Flame, Users, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { scoreToModifier, modifierToString } from '@/lib/abilityScores/types';

type Status = {
  currentHP?: number;
  maxHP?: number;
  tempHP?: number;
  ac?: number;
  conditions?: string[];
  spellSlots?: Record<string, { current: number; max: number }>;
  level?: number;
  className?: string;
  profileImage?: string | null;
  race?: string;
  gender?: string;
  abilityScores?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  equippedGear?: Array<{ slot: string; name: string }>;
  multiclassLevels?: Record<string, number>;
  quickActions?: {
    weapons?: Array<{ name: string; damage?: string; damageType?: string }>;
    abilities?: Array<{ name: string; tree?: string; tier?: number; actionType?: string }>;
    spells?: Array<{ name: string; level?: number; school?: string; concentration?: boolean }>;
    cantrips?: Array<{ name: string; school?: string }>;
    consumables?: Array<{ name: string; quantity?: number; effect?: string }>;
  };
};

export interface PartySheetMember {
  user_id: string;
  character_name: string;
  character_status?: Record<string, unknown>;
}

interface PartyMemberSheetsProps {
  open: boolean;
  onClose: () => void;
  members: PartySheetMember[];
  currentUserId?: string;
}

const ABILITY_META = [
  { key: 'str', label: 'STR', color: 'text-red-400' },
  { key: 'dex', label: 'DEX', color: 'text-green-400' },
  { key: 'con', label: 'CON', color: 'text-orange-400' },
  { key: 'int', label: 'INT', color: 'text-blue-400' },
  { key: 'wis', label: 'WIS', color: 'text-purple-400' },
  { key: 'cha', label: 'CHA', color: 'text-pink-400' },
] as const;

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-white/[0.04] text-xs">
      <span className="font-medium text-foreground truncate">{left}</span>
      {right ? <span className="text-[10px] text-muted-foreground shrink-0">{right}</span> : null}
    </div>
  );
}

function Block({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2 px-1">
        {icon}
        <h3 className="text-[11px] font-cinzel uppercase tracking-wider text-amber-200/80">{title}</h3>
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function MemberSheet({ member }: { member: PartySheetMember }) {
  const s = (member.character_status ?? {}) as Status;
  const qa = s.quickActions ?? {};
  const weapons = qa.weapons ?? [];
  const abilities = qa.abilities ?? [];
  const spells = qa.spells ?? [];
  const cantrips = qa.cantrips ?? [];
  const consumables = qa.consumables ?? [];
  const gear = s.equippedGear ?? [];
  const conditions = s.conditions ?? [];
  const slots = Object.entries(s.spellSlots ?? {}).filter(([, v]) => v && v.max > 0);
  const multiclass = Object.entries(s.multiclassLevels ?? {});
  const maxHP = s.maxHP ?? 0;
  const curHP = s.currentHP ?? 0;
  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (curHP / maxHP) * 100)) : 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Vitals */}
      <div className="rounded-xl border border-amber-900/25 bg-black/30 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-red-400" />
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full', hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-white/60 tabular-nums">
            {curHP}/{maxHP}{s.tempHP ? ` (+${s.tempHP})` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-sky-400" />AC {s.ac ?? '—'}</span>
          {s.race && <span className="capitalize">{[s.gender, s.race].filter(Boolean).join(' ')}</span>}
        </div>
        {conditions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 capitalize">{c}</span>
            ))}
          </div>
        )}
        {multiclass.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {multiclass.map(([cls, lvl]) => (
              <span key={cls} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary capitalize">{cls} {lvl}</span>
            ))}
          </div>
        )}
      </div>

      {/* Ability scores */}
      {s.abilityScores && (
        <div className="grid grid-cols-6 gap-1">
          {ABILITY_META.map(({ key, label, color }) => {
            const score = s.abilityScores![key];
            return (
              <div key={key} className="flex flex-col items-center py-1.5 rounded bg-white/[0.04]">
                <span className={cn('text-[9px] font-bold', color)}>{label}</span>
                <span className="text-sm font-bold text-foreground">{score}</span>
                <span className="text-[10px] text-muted-foreground">{modifierToString(scoreToModifier(score))}</span>
              </div>
            );
          })}
        </div>
      )}

      {slots.length > 0 && (
        <Block title="Spell Slots" icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />} count={slots.length}>
          {slots.map(([lvl, v]) => <Row key={lvl} left={`Level ${lvl}`} right={`${v.current}/${v.max}`} />)}
        </Block>
      )}

      <Block title="Equipped Gear" icon={<Shield className="w-3.5 h-3.5 text-sky-400" />} count={gear.length}>
        {gear.map((g, i) => <Row key={i} left={g.name} right={g.slot?.replace(/_/g, ' ')} />)}
      </Block>

      <Block title="Weapons" icon={<Sword className="w-3.5 h-3.5 text-red-400" />} count={weapons.length}>
        {weapons.map((w, i) => <Row key={i} left={w.name} right={[w.damage, w.damageType].filter(Boolean).join(' ')} />)}
      </Block>

      <Block title="Abilities" icon={<Flame className="w-3.5 h-3.5 text-amber-400" />} count={abilities.length}>
        {abilities.map((a, i) => <Row key={i} left={a.name} right={[a.tree, a.tier ? `T${a.tier}` : '', a.actionType].filter(Boolean).join(' · ')} />)}
      </Block>

      <Block title="Spells" icon={<BookOpen className="w-3.5 h-3.5 text-blue-400" />} count={spells.length}>
        {spells.map((sp, i) => <Row key={i} left={sp.name} right={`Lv.${sp.level ?? 0}${sp.concentration ? ' · C' : ''}`} />)}
      </Block>

      <Block title="Cantrips" icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />} count={cantrips.length}>
        {cantrips.map((c, i) => <Row key={i} left={c.name} right={c.school} />)}
      </Block>

      <Block title="Consumables" icon={<FlaskConical className="w-3.5 h-3.5 text-emerald-400" />} count={consumables.length}>
        {consumables.map((c, i) => <Row key={i} left={`${c.name}${c.quantity ? ` ×${c.quantity}` : ''}`} right={c.effect} />)}
      </Block>
    </div>
  );
}

export function PartyMemberSheets({ open, onClose, members, currentUserId }: PartyMemberSheetsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const others = useMemo(
    () => members.filter(m => m.user_id !== currentUserId),
    [members, currentUserId]
  );
  const selected = others.find(m => m.user_id === selectedId) ?? null;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-background flex flex-col">
      <header className="flex items-center gap-2 px-3 py-3 border-b border-amber-900/25 bg-black/40">
        {selected ? (
          <button
            onClick={() => setSelectedId(null)}
            aria-label="Back to party roster"
            className="p-2 rounded-lg hover:bg-white/10"
            style={{ touchAction: 'manipulation', minHeight: 44, minWidth: 44 }}
          >
            <ArrowLeft className="w-4 h-4 text-amber-300" />
          </button>
        ) : (
          <Users className="w-4 h-4 text-amber-300 mx-2" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-cinzel text-sm text-foreground truncate">
            {selected ? selected.character_name : 'Party Character Sheets'}
          </h2>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Eye className="w-3 h-3" /> View only
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close party sheets"
          className="p-2 rounded-lg hover:bg-white/10"
          style={{ touchAction: 'manipulation', minHeight: 44, minWidth: 44 }}
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {selected ? (
          <MemberSheet member={selected} />
        ) : others.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-16">
            No other players in the party yet.
          </div>
        ) : (
          <div className="space-y-2 pb-24">
            {others.map(m => {
              const s = (m.character_status ?? {}) as Status;
              const maxHP = s.maxHP ?? 0;
              const curHP = s.currentHP ?? 0;
              const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (curHP / maxHP) * 100)) : 0;
              return (
                <button
                  key={m.user_id}
                  onClick={() => setSelectedId(m.user_id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-900/25 bg-black/30 hover:bg-black/45 text-left transition-colors"
                  style={{ touchAction: 'manipulation', minHeight: 56 }}
                >
                  <Avatar className="w-9 h-9">
                    {s.profileImage ? <AvatarImage src={s.profileImage} alt={m.character_name} /> : null}
                    <AvatarFallback className="text-sm font-bold bg-primary/20 text-primary">
                      {m.character_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-cinzel text-foreground truncate">{m.character_name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {[s.className, s.level ? `Lv.${s.level}` : ''].filter(Boolean).join(' · ') || 'Adventurer'}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-white/50 tabular-nums">{curHP}/{maxHP}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
