import { Heart, Timer, Package, Wand2, Eye, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CharacterContext } from './types';

interface ContextChipBarProps {
  context: CharacterContext;
  onChipClick: (query: string) => void;
  disabled?: boolean;
}

interface ChipData {
  icon: typeof Heart;
  label: string;
  color: string;
  query: string;
  subtext?: string;
  pulse?: boolean;
}

export function ContextChipBar({ context, onChipClick, disabled }: ContextChipBarProps) {
  const hpPercent = Math.round((context.currentHP / context.maxHP) * 100);
  const hpColor = hpPercent > 50 ? 'text-emerald-400' : hpPercent > 25 ? 'text-amber-400' : 'text-rose-400';
  
  const readyCount = context.cooldowns.ready.length;
  const activeCount = context.cooldowns.active.length;
  
  const consumableCount = context.consumables.reduce((sum, c) => sum + c.quantity, 0);

  // Spellcasting context
  const spell = context.spellcasting;
  const hasSpells = spell?.path && spell.preparedSpells.length > 0;
  const isConcentrating = !!spell?.concentratingOn;
  const slotsRemaining = spell?.totalSlotsRemaining ?? 0;

  // Loot context
  const loot = context.loot;
  const hasLoot = loot && loot.items.length > 0;

  const chips: ChipData[] = [
    {
      icon: Heart,
      label: `${context.currentHP}/${context.maxHP}`,
      color: hpColor,
      query: 'What are my healing options right now?',
      subtext: `${hpPercent}%`,
    },
    {
      icon: Timer,
      label: `${readyCount} Ready`,
      color: readyCount > 0 ? 'text-cyan-400' : 'text-white/50',
      query: 'Which abilities are ready and what should I prioritize?',
      subtext: activeCount > 0 ? `${activeCount} cooling` : undefined,
    },
    {
      icon: Package,
      label: `${consumableCount} Items`,
      color: consumableCount > 0 ? 'text-purple-400' : 'text-white/50',
      query: 'What consumables should I use in my current situation?',
      subtext: consumableCount > 0 ? 'tap for advice' : 'none',
    },
  ];

  // Add loot chip if character has found loot
  if (hasLoot) {
    chips.push({
      icon: Coins,
      label: `${loot.items.length} Loot`,
      color: 'text-amber-400',
      query: 'What\'s the most valuable or useful loot I have? Should I sell any of it or keep something for later?',
      subtext: `${loot.totalValue}gp value`,
    });
  }

  // Add spells chip if character has spellcasting
  if (hasSpells) {
    chips.push({
      icon: isConcentrating ? Eye : Wand2,
      label: isConcentrating ? 'Concentrating' : `${slotsRemaining} Slots`,
      color: isConcentrating ? 'text-amber-400' : slotsRemaining > 0 ? 'text-indigo-400' : 'text-white/50',
      query: isConcentrating 
        ? 'What should I consider regarding my concentration spell? When should I break it?'
        : slotsRemaining > 0
          ? 'Which spells should I prioritize casting with my remaining slots?'
          : 'I\'m out of spell slots. What are my best non-spell options?',
      subtext: isConcentrating 
        ? spell.concentratingOn 
        : spell.preparedSpells.length + ' prepared',
      pulse: isConcentrating,
    });
  }

  return (
    <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
      {chips.map((chip, index) => (
        <button
          key={index}
          onClick={() => !disabled && onChipClick(chip.query)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            'bg-black/40 border border-white/10 backdrop-blur-sm',
            'transition-all duration-200',
            'hover:bg-white/10 hover:border-white/20',
            'active:scale-95',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <chip.icon className={cn('w-4 h-4', chip.color, chip.pulse && 'animate-pulse')} />
          <div className="flex flex-col items-start">
            <span className={cn('text-sm font-medium', chip.color)}>
              {chip.label}
            </span>
            {chip.subtext && (
              <span className="text-[10px] text-white/40 truncate max-w-[80px]">{chip.subtext}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
