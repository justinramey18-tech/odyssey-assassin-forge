// TEMPORARY harness — verifies a forged draft's rowGuides reach the installer. Removed after checking.
import { SpellForgeChat } from '@/components/magic/SpellForgeChat';

const rows = Array.from({ length: 20 }, (_, i) => `${i + 1}: Outcome number ${i + 1}.`).join('\n');
const DRAFT = {
  name: 'Harness Hex',
  level: 2,
  school: 'evocation',
  castingTime: 'action',
  range: '60 feet',
  duration: 'instantaneous',
  concentration: false,
  ritual: false,
  components: { verbal: true, somatic: true, material: null },
  attackType: 'spell',
  saveStat: 'dex',
  damageFormula: '4d6',
  damageType: 'fire',
  healingFormula: null,
  higherLevels: '+1d6 per slot',
  description: `Roll a d20.\n${rows}`,
  rowGuides: {
    '1': 'Guide one.',
    '3': '  Guide three with padding.  ',
    '5': '   ',
    '8': 12,
    '21': 'Out of range key.',
    '20': 'Guide twenty.',
  },
};

const BLOCK = `[[SPELL]]\n${JSON.stringify(DRAFT, null, 2)}\n[[/SPELL]]`;
const MSG = `[FORGE_READY]\n\nHere it is, fresh off the anvil.\n\n${BLOCK}`;

try {
  localStorage.setItem(
    'odyssey-spell-forge-chat-HarnessRider',
    JSON.stringify([{ role: 'assistant', content: MSG }]),
  );
} catch { /* ignore */ }

export default function ForgeHarness() {
  return (
    <div style={{ background: '#0b0709', minHeight: '100vh' }}>
      <SpellForgeChat
        open
        onClose={() => {}}
        character={{ name: 'HarnessRider', className: 'Wizard', level: 5 }}
        onInstall={async (draft) => {
          try { localStorage.setItem('harness-last-draft', JSON.stringify(draft)); } catch { /* ignore */ }
          return { ok: true, message: 'stub install ok' };
        }}
      />
    </div>
  );
}
