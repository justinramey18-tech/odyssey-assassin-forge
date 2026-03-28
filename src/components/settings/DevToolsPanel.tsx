import { useState } from 'react';
import { Copy, Check, Wrench } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { CodebaseUploader } from './CodebaseUploader';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface FileMapSection {
  title: string;
  description: string;
  content: string;
}

interface PromptTemplate {
  label: string;
  text: string;
}

const FILE_MAP: FileMapSection[] = [
  {
    title: 'Pages (Routes)',
    description: 'The main screens of the app — each URL or route loads one of these files.',
    content: `src/pages/Index.tsx          — Main app shell, tab routing
src/pages/CharacterRoster.tsx — Character selection / roster
src/pages/AICreationAssistant.tsx — AI-powered character creator
src/pages/Auth.tsx            — Login / signup page`,
  },
  {
    title: 'Home Tab',
    description: 'The home dashboard — what you see first after picking a character.',
    content: `src/components/home/HomeScreen.tsx         — Main home dashboard
src/components/home/DynamicHealthBar.tsx   — Animated HP bar
src/components/home/ModeSelectionScreen.tsx — Solo/party mode selector
src/components/home/CharacterNamePlaque.tsx — Name display plaque`,
  },
  {
    title: 'Fighting Tabs',
    description: 'Everything combat-related — attacks, abilities, spells, and prestige powers.',
    content: `src/components/combat/CombatTabScreen.tsx     — Combat tab container
src/components/abilities/AbilitiesScreen.tsx  — Abilities skill tree
src/components/magic/MagicScreen.tsx          — Arcana / magic tab
src/components/prestige/PrestigeTreeScreen.tsx — Legacy prestige tree`,
  },
  {
    title: 'Inventory Tabs',
    description: 'Gear, loot, shopping, and consumables — all the stuff your character carries.',
    content: `src/components/inventory/InventoryScreen.tsx          — Gear / equipment
src/components/inventory/ShopScreen.tsx               — Item shop
src/components/inventory/LootScreen.tsx                — Loot drops
src/components/inventory/ConsumablesInventoryWidget.tsx — Consumables panel`,
  },
  {
    title: 'AI DM System',
    description: 'The AI Dungeon Master — runs solo adventures, party sessions, and world-building.',
    content: `src/components/ai-dm/AIDMScreen.tsx           — Solo AI DM screen
src/components/ai-dm/PartyDMScreen.tsx        — Party AI DM screen
src/components/ai-dm/GeraltGameplayWidget.tsx — Geralt companion widget
src/components/ai-dm/WorldBuilderWizard.tsx   — World builder wizard`,
  },
  {
    title: 'Companion (Geralt)',
    description: 'Geralt is your AI companion NPC — his stats, health, and management screen.',
    content: `src/components/geralt/GeraltCompanionScreen.tsx — Geralt management overlay
src/lib/geralt-data.ts                         — Geralt state utilities
src/components/geralt/GeraltSubheader.tsx       — Geralt HP sub-header`,
  },
  {
    title: 'Party System',
    description: 'Multiplayer features — party chat and group voting.',
    content: `src/components/party/PartyPanel.tsx          — Party management panel
src/components/party/PartyChat.tsx           — Party text chat (OOC messaging)
src/components/party/FullscreenPartyChat.tsx — Full-screen chat overlay

src/components/party/PartyVote.tsx           — Party voting system
src/components/party/PartyMemberCard.tsx     — Player card with HP, class, status
src/components/party/PartyLootQueue.tsx      — Shared loot claim queue
src/components/party/PartyCombatLog.tsx      — Shared combat log feed
src/components/party/PartyRollFeed.tsx       — Live dice roll feed
src/components/party/PartyPingBar.tsx        — Player ping notifications
src/components/party/PartyFocusTargetBanner.tsx — Focus target banner
src/components/party/SendItemScreen.tsx      — Send item to another player
src/components/party/IncomingTradeNotification.tsx — Incoming trade popup
src/components/party/IncomingHealNotification.tsx  — Incoming heal popup
src/components/party/HealTargetPicker.tsx    — Pick a party member to heal
src/components/party/CreatePartyDialog.tsx   — Create a new party dialog
src/components/party/JoinPartyDialog.tsx     — Join existing party dialog`,
  },
  {
    title: 'Party DM (Multiplayer AI Sessions)',
    description: 'Everything that powers the multiplayer AI Dungeon Master — the shared chat, round queue, settings panel, split-party mode, and AFK auto-pilot.',
    content: `src/components/ai-dm/PartyDMScreen.tsx        — Main party DM chat screen (message rendering, AFK badges, round generation)
src/components/ai-dm/StandalonePartyDMScreen.tsx — Standalone wrapper that loads party DM outside the main app shell
src/components/ai-dm/PartyDMSettings.tsx      — Settings drawer (share mode, auto-sync, push, timer, tools, party management)
src/components/ai-dm/PartyDMQuickActions.tsx   — Quick-action buttons below the party DM input
src/components/ai-dm/DMBottomNav.tsx           — Bottom navigation bar for DM screens
src/components/ai-dm/DMToolsDrawer.tsx         — Solo DM tools drawer (also used for model selector, guides, world state)
src/components/ai-dm/DMDiceRoller.tsx           — Dice roller panel inside the DM screen
src/components/ai-dm/RoundTimer.tsx             — Configurable round timer with countdown display
src/components/ai-dm/PartySplitUI.tsx           — Split-party mode UI (team assignment, regroup, summaries)
src/components/ai-dm/PartyCampaignSaves.tsx     — Campaign save/load for party sessions
src/components/ai-dm/AfkPersonalityGuide.tsx    — AFK personality guide editor (set how AI plays your character)
src/components/ai-dm/WhisperTray.tsx            — Whisper message tray for private DM messages
src/components/ai-dm/OracleWhisperFeed.tsx      — Oracle whisper feed overlay

src/components/ai-dm/NarrationSpeedPopover.tsx   — Narration speed control popover
src/components/ai-dm/AutoSyncBanner.tsx          — Banner shown when auto-sync is extracting changes
src/components/ai-dm/InfinityStoneDMDrawer.tsx   — Infinity Stone stat reference in DM context

src/hooks/use-party-dm.ts                     — Core party DM hook (round queue, prompt submission, generation trigger)
src/hooks/use-party-sync.ts                   — Realtime sync for party state (members, prompts, messages)

src/lib/rpPromptGenerator.ts                  — Builds the system prompt sent to the AI for DM sessions
src/lib/gmGuidePrompts.ts                     — Injects GM Guide content into AI prompts
src/lib/dm-models.ts                          — AI model list and selection config`,
  },
  {
    title: 'Drawers & Overlays',
    description: 'Slide-out panels for quick reference — AI context, oracle lookups, conditions, stats.',
    content: `src/components/prompts/PromptDrawerProvider.tsx — AI context drawer
src/components/oracle/OracleDrawer.tsx          — Oracle lookup drawer
src/components/conditions/ConditionDrawer.tsx    — Conditions reference
src/components/stats/StatsDrawer.tsx             — Stats detail drawer`,
  },
  {
    title: 'Character Creation',
    description: 'The step-by-step wizard for building a new character from scratch.',
    content: `src/components/character/CharacterWizard.tsx        — Character creation wizard
src/components/character/InfinityGauntletScreen.tsx — Stat allocation screen`,
  },
  {
    title: 'Settings',
    description: 'App settings, preferences, and this developer reference panel.',
    content: `src/components/settings/SettingsModal.tsx      — Settings modal shell
src/components/settings/SettingsContent.tsx    — Tab content router
src/components/settings/MobileSettingsTabs.tsx — Tab navigation
src/components/settings/SettingsSection.tsx    — Collapsible section
src/components/settings/DevToolsPanel.tsx      — This file (R&D dev tools)`,
  },
  {
    title: 'Hooks (Game Logic)',
    description: 'The brains behind each feature — they manage data, handle button presses, and keep the screen up to date.',
    content: `src/hooks/use-ai-dm.ts            — AI DM conversation engine
src/hooks/use-combat-actions.ts   — Combat action handling
src/hooks/use-spellcasting.ts     — Spell slot & casting logic
src/hooks/use-loot.ts             — Loot drop & management
src/hooks/use-conditions.ts       — Status conditions tracker
src/hooks/use-cooldowns.ts        — Ability cooldown timers
src/hooks/use-party-sync.ts       — Party realtime sync
src/hooks/use-prestige.ts         — Prestige tree progression
src/hooks/use-xp-progression.ts   — XP & leveling system
src/hooks/use-wild-shape.ts       — Wild Shape transformations
src/hooks/use-oracle.ts           — Oracle table lookups
src/hooks/use-consumables.ts      — Consumable item tracking
src/hooks/use-equipment-stats.ts  — Equipment stat bonuses
src/hooks/use-ability-scores.ts   — Ability score management
src/hooks/use-multiclass.ts       — Multiclass level tracking
src/hooks/use-initiative.ts       — Initiative order tracker
src/hooks/use-worldbuilder.ts     — World builder wizard logic`,
  },
  {
    title: 'Data & Rules (src/lib)',
    description: "The game's rulebook — item stats, spell tables, class configs, and all the numbers that make the game work.",
    content: `src/lib/combat/       — Attack tables, damage calc, action economy
src/lib/magic/        — Spell lists, slot tables, channel divinity
src/lib/inventory/    — Equipment definitions, weight, properties
src/lib/classes/      — Class features, progression tables
src/lib/conditions/   — Status effects, durations, mechanics
src/lib/consumables/  — Potion & scroll definitions
src/lib/cooldowns/    — Cooldown durations & reset rules
src/lib/prestige/     — Prestige tree nodes & requirements
src/lib/abilityTrees/ — Skill tree layouts & dependencies
src/lib/loot/         — Loot tables, rarity, generation
src/lib/shop/         — Shop inventory & pricing
src/lib/spellCustomization/ — Spell modification rules
src/lib/abilityScores/      — Score calculations & modifiers
src/lib/scribe/       — Session scribe parsing
src/lib/chronicleSync/ — Chronicle campaign sync`,
  },
  {
    title: 'Type Definitions',
    description: 'Blueprints that define the shape of every character, item, spell, and ability so the code stays consistent.',
    content: `src/lib/types.ts              — Core character & game types
src/lib/loot/types.ts         — Loot item & drop types
src/lib/combat/types.ts       — Combat action & damage types
src/lib/magic/types.ts        — Spell & slot types
src/lib/conditions/types.ts   — Condition & effect types
src/lib/consumables/types.ts  — Consumable item types
src/lib/prestige/types.ts     — Prestige node types`,
  },
  {
    title: 'Utilities',
    description: 'Small helper tools used everywhere — dice rolling, HP math, data storage shortcuts.',
    content: `src/lib/diceRoller.ts      — Dice rolling engine (d4–d100)
src/lib/hpCalculation.ts   — HP calculation & modifiers
src/lib/iconUtils.ts       — Icon mapping helpers
src/lib/scoped-storage.ts  — Character-scoped localStorage
src/lib/xpSystem.ts        — XP thresholds & level math
src/lib/resetApp.ts        — Full app reset utility
src/lib/fourthWallTime.ts  — Real-world time prefix for prompts
src/lib/utils.ts           — General utility functions (cn, etc.)
src/lib/rollQuality.ts     — Roll quality classification
src/lib/tts-utils.ts       — Text-to-speech helpers`,
  },
  {
    title: 'AI & Prompts',
    description: 'The instructions and templates sent to the AI when it plays as the DM, generates stories, or builds worlds.',
    content: `src/lib/rpPromptGenerator.ts        — Main RP prompt builder
src/lib/empyreanPrompts.ts         — Empyrean-tier prompt templates
src/lib/characterPrompts.ts        — Character context for AI
src/lib/gmGuidePrompts.ts          — GM Guide injection system
src/lib/dm-models.ts               — AI model selection & config
src/lib/narrativeProcessor.ts      — Story response processing
src/lib/wildShapePrompts.ts        — Wild Shape narration prompts
src/lib/scribe-models.ts           — Scribe AI model config
src/lib/loot/prompts.ts            — Loot use/discovery prompts
src/lib/magic/channelDivinityPrompts.ts — Channel Divinity narration`,
  },
];

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    label: 'Sync / State Bugs',
    text: 'When I [do X] in [ComponentA], [ComponentB] doesn\'t update. Check if they share the same storage key, event name, and characterId.',
  },
  {
    label: 'UI / Visual Changes',
    text: 'On the [ScreenName] screen, change [element] to [desired look]. Keep everything else the same.',
  },
  {
    label: 'Add a New Feature',
    text: 'Add [feature] to [ScreenName]. It should [behavior]. Store data scoped to characterId in localStorage key odyssey_${characterId}_[key].',
  },
  {
    label: 'Fix a Bug',
    text: 'On [Screen], when I [action], [what goes wrong] instead of [expected]. Check [ComponentA] and [ComponentB] for mismatched keys or missing event listeners.',
  },
  {
    label: 'AI DM / Prompt Tuning',
    text: 'The AI DM response when I [trigger action] is [problem — too long / wrong tone / missing info]. Update the prompt in [file] to [desired change].',
  },
  {
    label: 'Data Not Saving',
    text: 'When I [change X] on [Screen], it doesn\'t persist after reload. Check the save logic in [hook/component] — verify the localStorage key and JSON.parse/stringify error handling.',
  },
  {
    label: 'Add New Game Content',
    text: 'Add a new [spell/ability/item/class] called [Name] with these stats: [stats]. Follow the same pattern as existing entries in [file].',
  },
];


function CopyablePrompt({ template }: { template: PromptTemplate }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.text);
      setCopied(true);
      toast({ title: 'Copied!', description: `"${template.label}" template copied.`, className: 'border-rose-500 bg-rose-500/10' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy Failed', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-cinzel font-semibold text-foreground">{template.label}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="w-full text-left group relative rounded-md border border-border/40 bg-background/50 p-2.5 hover:border-rose-500/40 transition-colors"
      >
        <pre className="text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-words pr-7">
          {template.text}
        </pre>
        <span className="absolute top-2 right-2 text-muted-foreground group-hover:text-rose-400 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </span>
      </button>
    </div>
  );
}

export function DevToolsPanel() {
  return (
    <div className="space-y-3 pb-6">
      <CodebaseUploader />

      <SettingsSection title="Dev Assistant" defaultOpen>
        <div className="px-2">
          <DevAssistantChat />
        </div>
      </SettingsSection>

      <Separator className="my-4" />

      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Wrench className="w-3.5 h-3.5 text-rose-400" />
        <span>File map reference</span>
      </div>

      {FILE_MAP.map((section) => (
        <SettingsSection key={section.title} title={section.title}>
          <p className="text-xs italic text-muted-foreground px-2 mb-2">{section.description}</p>
          <pre className="text-xs font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap break-words px-2 overflow-y-auto max-h-[40vh]">
            {section.content}
          </pre>
        </SettingsSection>
      ))}

      <SettingsSection title="Ideal Prompts for Lovable">
        <p className="text-xs italic text-muted-foreground px-2 mb-3">
          Copy-paste templates for talking to Lovable. Fill in the [brackets] with your specifics.
        </p>
        <div className="space-y-3 px-2">
          {PROMPT_TEMPLATES.map((t) => (
            <CopyablePrompt key={t.label} template={t} />
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
