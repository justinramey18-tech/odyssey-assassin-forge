import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RollTable } from '@/lib/magic/parseRollTable';
import frameArt from '@/assets/dice-table/dice-table-frame.png';
import headerArt from '@/assets/dice-table/dice-table-header.png';
import dividerArt from '@/assets/dice-table/dice-table-divider.png';
import d20Fail from '@/assets/dice-table/d20-fail.png';
import d20Normal from '@/assets/dice-table/d20-normal.png';
import d20Crit from '@/assets/dice-table/d20-crit.png';

interface DiceOutcomeTableProps {
  table: RollTable;
  /** The last number actually rolled for this spell, if known. That row is highlighted. */
  highlight?: number;
  defaultOpen?: boolean;
}

/** Ornate collapsible dice table: header plaque (tap to open), framed rows, a d20 badge per row. */
export function DiceOutcomeTable({ table, highlight, defaultOpen = false }: DiceOutcomeTableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const max = table.rows.reduce((m, r) => Math.max(m, r.roll), 0) || 20;
  const failCutoff = Math.max(1, Math.round(max / 4));
  const tierOf = (roll: number) => (roll >= max ? 'crit' : roll <= failCutoff ? 'fail' : 'normal');
  const badgeArt = { fail: d20Fail, normal: d20Normal, crit: d20Crit } as const;

  return (
    <div className="relative mt-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        className="relative z-[2] block w-full select-none"
        style={{ touchAction: 'manipulation', marginBottom: open ? -14 : 0 }}
      >
        <img src={headerArt} alt="" draggable={false} className="pointer-events-none block w-full" />
        <span
          className="absolute flex items-center justify-center gap-1.5 font-cinzel text-[12px] font-bold uppercase tracking-[0.14em] text-[#f5c97a] [text-shadow:0_1px_2px_#000]"
          style={{ left: '24%', right: '13%', top: '33%', bottom: '35%' }}
        >
          <span className="truncate">{table.title}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div
          className="px-1 pb-4 pt-5"
          style={{
            borderStyle: 'solid',
            borderWidth: 14,
            borderImage: `url(${frameArt}) 150 / 34px / 0 stretch round`,
            backgroundColor: 'rgba(8,4,6,0.82)',
            backgroundClip: 'padding-box',
          }}
        >
          {table.preamble && (
            <p className="px-1 pb-2 text-[10.5px] italic leading-snug text-white/55">{table.preamble}</p>
          )}
          <ul className="m-0 list-none p-0">
            {table.rows.map((row, i) => {
              const tier = tierOf(row.roll);
              const isHit = highlight === row.roll;
              return (
                <li key={`${row.roll}-${i}`}>
                  {i > 0 && (
                    <div
                      aria-hidden="true"
                      className="mx-1.5 my-px h-2"
                      style={{ background: `url(${dividerArt}) center / 100% 100% no-repeat` }}
                    />
                  )}
                  <div
                    className={cn(
                      'grid grid-cols-[36px_1fr] items-center gap-2 rounded-md px-1 py-1',
                      isHit && 'bg-[rgba(245,201,122,0.14)] shadow-[inset_0_0_0_1px_rgba(245,201,122,0.55)]',
                    )}
                  >
                    <span className="relative h-9 w-9">
                      <img src={badgeArt[tier]} alt="" draggable={false} className="h-full w-full" />
                      <b
                        className={cn(
                          'absolute inset-x-0 top-[44%] -translate-y-1/2 text-center font-cinzel text-[12px] font-extrabold',
                          tier === 'crit'
                            ? 'text-[#3a2200] [text-shadow:0_0_3px_#fff6d8]'
                            : 'text-[#fff3dc] [text-shadow:0_0_3px_#000,0_1px_2px_#000]',
                        )}
                      >
                        {row.roll}
                      </b>
                    </span>
                    <span className="text-[11.5px] leading-[1.4] text-[#EDE6D8] [text-shadow:0_1px_2px_#000]">
                      {row.text}
                      {row.tags.map((tag, t) => (
                        <span
                          key={t}
                          className={cn(
                            'ml-1 inline-block rounded-full border px-1.5 align-[1px] text-[9.5px] font-bold uppercase tracking-[0.05em]',
                            tag.tone === 'minus'
                              ? 'border-red-400/70 bg-red-700/35 text-red-100'
                              : 'border-yellow-400/75 bg-yellow-600/30 text-yellow-100',
                          )}
                        >
                          {tag.label}
                        </span>
                      ))}
                      {isHit && <span className="ml-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#f5c97a]">you rolled this</span>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
