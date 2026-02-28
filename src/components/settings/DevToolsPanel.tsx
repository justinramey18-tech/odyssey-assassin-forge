import { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SettingsSection } from './SettingsSection';

const FILE_MAP: { title: string; content: string }[] = [
  {
    title: 'Pages (Routes)',
    content: `src/pages/Index.tsx          — Main app shell, tab routing
src/pages/CharacterRoster.tsx — Character selection / roster
src/pages/AICreationAssistant.tsx — AI-powered character creator
src/pages/Auth.tsx            — Login / signup page`,
  },
  {
    title: 'Home Tab',
    content: `src/components/home/HomeScreen.tsx         — Main home dashboard
src/components/home/DynamicHealthBar.tsx   — Animated HP bar
src/components/home/ModeSelectionScreen.tsx — Solo/party mode selector
src/components/home/CharacterNamePlaque.tsx — Name display plaque`,
  },
  {
    title: 'Fighting Tabs',
    content: `src/components/combat/CombatTabScreen.tsx     — Combat tab container
src/components/abilities/AbilitiesScreen.tsx  — Abilities skill tree
src/components/magic/MagicScreen.tsx          — Arcana / magic tab
src/components/prestige/PrestigeTreeScreen.tsx — Legacy prestige tree`,
  },
  {
    title: 'Inventory Tabs',
    content: `src/components/inventory/InventoryScreen.tsx          — Gear / equipment
src/components/inventory/ShopScreen.tsx               — Item shop
src/components/inventory/LootScreen.tsx                — Loot drops
src/components/inventory/ConsumablesInventoryWidget.tsx — Consumables panel`,
  },
  {
    title: 'AI DM System',
    content: `src/components/ai-dm/AIDMScreen.tsx           — Solo AI DM screen
src/components/ai-dm/PartyDMScreen.tsx        — Party AI DM screen
src/components/ai-dm/GeraltGameplayWidget.tsx — Geralt companion widget
src/components/ai-dm/WorldBuilderWizard.tsx   — World builder wizard`,
  },
  {
    title: 'Companion (Geralt)',
    content: `src/components/geralt/GeraltCompanionScreen.tsx — Geralt management overlay
src/lib/geralt-data.ts                         — Geralt state utilities
src/components/geralt/GeraltSubheader.tsx       — Geralt HP sub-header`,
  },
  {
    title: 'Party System',
    content: `src/components/party/PartyPanel.tsx      — Party management panel
src/components/party/PartyChat.tsx       — Party chat
src/components/party/PartyBattleMap.tsx   — Battle map
src/components/party/PartyVote.tsx        — Party voting system`,
  },
  {
    title: 'Drawers & Overlays',
    content: `src/components/prompts/PromptDrawerProvider.tsx — AI context drawer
src/components/oracle/OracleDrawer.tsx          — Oracle lookup drawer
src/components/conditions/ConditionDrawer.tsx    — Conditions reference
src/components/stats/StatsDrawer.tsx             — Stats detail drawer`,
  },
  {
    title: 'Character Creation',
    content: `src/components/character/CharacterWizard.tsx        — Character creation wizard
src/components/character/InfinityGauntletScreen.tsx — Stat allocation screen`,
  },
  {
    title: 'Settings',
    content: `src/components/settings/SettingsModal.tsx      — Settings modal shell
src/components/settings/SettingsContent.tsx    — Tab content router
src/components/settings/MobileSettingsTabs.tsx — Tab navigation
src/components/settings/SettingsSection.tsx    — Collapsible section
src/components/settings/DevToolsPanel.tsx      — This file (R&D dev tools)`,
  },
];

const CORRECT_PASSWORD = 'JRDP2026!';

export function DevToolsPanel() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
        <div className="p-3 rounded-full bg-rose-500/10">
          <Lock className="w-8 h-8 text-rose-400" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="font-cinzel font-bold text-lg">R&D Developer Tools</h3>
          <p className="text-sm text-muted-foreground">Enter password to access internal reference</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            className={error ? 'border-destructive' : ''}
            autoFocus
          />
          {error && <p className="text-xs text-destructive text-center">Incorrect password</p>}
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-rose-500/20 text-rose-300 font-cinzel text-sm font-semibold hover:bg-rose-500/30 transition-colors border border-rose-500/30"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Unlock className="w-3.5 h-3.5 text-rose-400" />
        <span>File map reference — re-locks when settings close</span>
      </div>

      {FILE_MAP.map((section) => (
        <SettingsSection key={section.title} title={section.title}>
          <pre className="text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-words px-2 overflow-y-auto max-h-[40vh]">
            {section.content}
          </pre>
        </SettingsSection>
      ))}
    </div>
  );
}
