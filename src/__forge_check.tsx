import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PartyDMQuickActions } from '@/components/ai-dm/PartyDMQuickActions';

const ctx = {
  name: 'Test Hero',
  characterClass: 'Wizard',
  level: 5,
  spellcasting: {
    homebrewSpells: [{ name: 'Existing Homebrew' }],
    preparedSpellDetails: [{ name: 'Fireball' }],
  },
} as any;

function App() {
  const [open, setOpen] = useState(true);
  return (
    <PartyDMQuickActions
      open={open}
      onOpenChange={setOpen}
      characterContext={ctx}
      characterName="Test Hero"
      onUsePrompt={(p: string) => console.log('[prompt]', p)}
      sectionFilter="magic"
    />
  );
}

createRoot(document.getElementById('root')!).render(<App />);
