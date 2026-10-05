/* TEMPORARY verification harness — deleted after the row-guide fix is checked. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cinzel/400.css';
import '@fontsource/inter/400.css';
import './index.css';
import { registerCustomSpell, getSpellById } from '@/lib/magic/spells';
import { registerSpellCaster, registerMagicResourceInspector } from '@/lib/magic/castBus';
import { PartyDMQuickActions } from '@/components/ai-dm/PartyDMQuickActions';
import type { CharacterContext } from '@/components/oracle/types';

const TABLE = [
  'You target one creature you can see within 60 feet.',
  '',
  'LIBIDO LOBOTOMY ROLL: the DM reads the row matching your natural d20.',
  ...Array.from({ length: 20 }, (_, i) => `${i + 1}: Row ${i + 1} outcome.`),
].join('\n');

const guides: Record<string, string> = {};
for (let r = 1; r <= 20; r++) guides[String(r)] = `GUIDE-${r}-MARKER: narrate row ${r} this way.`;

const base = {
  name: 'Libido Lobotomy',
  level: 2 as const,
  school: 'enchantment' as const,
  castingTime: '1 action',
  range: '60 feet',
  duration: 'instant',
  concentration: false,
  ritual: false,
  description: TABLE,
  isHomebrew: true,
};

// Older copy first (no guides), newer copy second (all 20 guides) — the exact
// registry order that made the old name lookup return the guideless copy.
registerCustomSpell({ ...base, id: 'hb-old', updatedAt: 100 } as never);
registerCustomSpell({ ...base, id: 'hb-new', updatedAt: 200, rowGuides: guides } as never);

// Mirror PromptDrawerProvider's preparedSpellDetails mapping exactly:
// preparedSpells.map(getSpellById) then a field list that starts with id.
const details = ['hb-old', 'hb-new']
  .map(id => getSpellById(id))
  .filter((s): s is NonNullable<typeof s> => !!s)
  .map(s => ({
    id: s.id,
    name: s.name,
    level: s.level,
    school: s.school,
    castingTime: s.castingTime,
    range: s.range,
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    description: s.description,
    isHomebrew: (s as { isHomebrew?: boolean }).isHomebrew === true ? true : undefined,
  }));

const ctx: CharacterContext = {
  name: 'Kade',
  level: 5,
  currentHP: 30,
  maxHP: 30,
  abilities: [],
  equippedAbilities: [],
  equipment: [],
  activeSetBonuses: [],
  consumables: [],
  cooldowns: { active: [], ready: [] },
  prestigeLevel: 0,
  prestigeAbilities: [],
  spellcasting: {
    path: 'wizard',
    spellAttackBonus: 5,
    spellSaveDC: 13,
    totalSlotsRemaining: 3,
    concentratingOn: null,
    preparedSpells: ['hb-old', 'hb-new'],
    slots: [{ level: 2, current: 3, max: 3 }],
    preparedSpellDetails: details,
  },
};

declare global {
  interface Window { __castPrompts: string[] }
}
window.__castPrompts = [];

// The spellcasting hook normally registers these; the harness stands in for it
// so the pre-roll sheet has a real slot to offer.
registerSpellCaster(req => ({
  ok: true,
  slotLevel: req.level === 0 ? undefined : 2,
  remaining: 2,
  totalRemaining: 2,
  isCantrip: req.level === 0,
}));
registerMagicResourceInspector(() => ({
  spellAttackBonus: 5,
  spellSaveDC: 13,
  slots: [{ level: 2, current: 3, max: 3 }],
  concentratingOn: null,
  activeEffects: [],
}));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PartyDMQuickActions
      open
      onOpenChange={() => {}}
      characterContext={ctx}
      characterName="Kade"
      onUsePrompt={p => { window.__castPrompts.push(p); }}
    />
  </StrictMode>,
);
