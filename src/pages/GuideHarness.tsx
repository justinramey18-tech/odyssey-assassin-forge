// TEMPORARY visual harness — removed after checking row guides.
import { DiceOutcomeTable } from '@/components/magic/DiceOutcomeTable';
import type { RollTable } from '@/lib/magic/parseRollTable';

const table: RollTable = {
  title: 'DICK PIC DIAGNOSIS',
  preamble: 'Roll a d20 and read the row.',
  rows: Array.from({ length: 20 }, (_, i) => ({
    roll: i + 1,
    text:
      i + 1 === 1
        ? 'Total collapse, the pic goes soft mid-sentence.'
        : i + 1 === 20
          ? 'Legendary erection, the whole tavern applauds.'
          : `Outcome number ${i + 1} for this dice table row.`,
    tags: i + 1 === 1 ? [{ label: '−1 Charisma', tone: 'minus' as const }] : [],
  })),
};

const guides: Record<string, string> = {
  '3': 'Narrate the failure as a slow, humiliating deflation.\n\nThe bartender notices. So does his mother.',
  '7': 'Short guide: he stammers an excuse and backs out of the room.',
  '20': 'Describe the crowd going feral. Then cut to the aftermath.',
};

export default function GuideHarness() {
  return (
    <div style={{ background: '#0b0709', minHeight: '100vh', padding: 12 }}>
      <DiceOutcomeTable table={table} highlight={7} guides={guides} defaultOpen />
      <div style={{ height: 24 }} />
      <DiceOutcomeTable table={table} highlight={20} defaultOpen />
    </div>
  );
}
