import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseWhispers } from '@/lib/whisper-parser';
import { parseResponseIntoSlides, stripCinematicTags } from '@/lib/parseSlides';
import { sendTelegramNotification } from '@/lib/telegram-notify';
import { useWeather } from '@/hooks/use-weather';
import { weatherToNarrativeContext } from '@/lib/weather';
import { WhisperTray } from '@/components/ai-dm/WhisperTray';
import { ArrowLeft, Send, BookOpen, Loader2, X, Shuffle, Flame, MoreVertical, Pencil, Trash2, Copy, Check, RefreshCw, Volume2, VolumeX, Zap, ChevronDown, MessageCircle, Theater, Megaphone, Minus, Plus, Sparkles, Swords } from 'lucide-react';
import { formatForReadingMode, type FormattedReading } from '@/lib/reading-mode-formatter';
import { EmpyreanCampaignSetup } from '@/components/empyrean/EmpyreanCampaignSetup';
import BurnoutFlameOverlay from '@/components/empyrean/BurnoutFlameOverlay';
import DeathSaveScreen from '@/components/empyrean/DeathSaveScreen';
import MemorialScreen from '@/components/empyrean/MemorialScreen';
import ThreshingCinematic from '@/components/empyrean/ThreshingCinematic';
import CinematicSlideshow from '@/components/empyrean/CinematicSlideshow';
import { DragonRiderSetupSheet } from '@/components/ai-dm/DragonRiderSetupSheet';
import { VerticalHealthBar } from '@/components/home/VerticalHealthBar';
import { NpcSceneDialog } from '@/components/ai-dm/NpcSceneDialog';
import { useOocDmChat } from '@/hooks/use-ooc-dm-chat';
import { OocDmChat } from '@/components/ai-dm/OocDmChat';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { CharacterContext } from '@/components/oracle/types';
import { useAIDM } from '@/hooks/use-ai-dm';
import { useCampaignSessions, CampaignSession } from '@/hooks/use-campaign-sessions';
import { CampaignDropdown } from '@/components/ai-dm/CampaignDropdown';
import { CampaignSessionsManager } from '@/components/ai-dm/CampaignSessionsManager';
import { DMToolsDrawer } from '@/components/ai-dm/DMToolsDrawer';
import { DMBottomNav, DMNavTab } from '@/components/ai-dm/DMBottomNav';
import { CharacterSheet } from '@/components/empyrean/CharacterSheet';
import { DMDiceRoller } from '@/components/ai-dm/DMDiceRoller';
import { GMGuidesManager } from '@/components/ai-dm/GMGuidesManager';
import { WorldStatePanel } from '@/components/ai-dm/WorldStatePanel';
import { PartyDMQuickActions } from '@/components/ai-dm/PartyDMQuickActions';
import EmpyreanContextualActions from '@/components/empyrean/EmpyreanContextualActions';
import DragonBondChat from '@/components/empyrean/DragonBondChat';
import { useGMGuides } from '@/hooks/use-gm-guides';
import empyreanDmBg from '@/assets/empyrean-dm-bg.jpg';
import { useDMGameState, buildMemoryAnchorsPrompt } from '@/hooks/use-dm-game-state';
import { useNPCAutocomplete } from '@/hooks/use-npc-autocomplete';
import { EmpyreanDMInput, type EmpyreanDMInputHandle } from './EmpyreanDMInput';
import { usePromptDrawers } from '@/components/drawers/PromptDrawerProvider';
import { useDMChatTheme } from '@/hooks/use-dm-chat-theme';
import { useWhisperTrayEnabled } from '@/hooks/use-whisper-tray-enabled';
import { useCinematicMode } from '@/hooks/use-cinematic-mode';
import { useDmAutoSync } from '@/hooks/use-dm-auto-sync';
import { AutoSyncBanner } from '@/components/ai-dm/AutoSyncBanner';
import { useNarrator } from '@/hooks/use-narrator';
import { NarrationSpeedPopover } from '@/components/ai-dm/NarrationSpeedPopover';
import {
  loadEmpyreanDMConfig,
  buildEmpyreanDMPersona,
  EmpyreanDMConfig,
  saveEmpyreanDMConfig,
  loadDragonNotes,
  saveDragonNotes,
  clearEmpyreanDMConfig,
  clearDragonNotes,
  clearEmpyreanOpeningScene,
} from '@/lib/empyreanDMPersona';
import { loadDiceOddsMode, saveDiceOddsMode, type DiceOddsMode } from '@/lib/diceOdds';
import { useDragonBond } from '@/hooks/use-dragon-bond';
import { getBondDescriptor, getTrustDescriptor, buildDragonChatPrompt, DRAGON_CHAT_SUMMARY_KEY, DRAGON_CHAT_KEY, resetBondState, getIsUnbonded, setIsUnbonded, saveBondState, DEFAULT_BOND, DEFAULT_TRUST, saveSoloHP } from '@/lib/dragonBondState';
import { getDragonColorHex } from '@/lib/dragonColors';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';
import { getAuthToken } from '@/lib/auth-token';
import { empyreanPrompts } from '@/lib/empyreanPrompts';
import { EMPYREAN_SESSION_GUIDES } from '@/lib/empyreanGMGuides';
import { DM_MODELS } from '@/lib/dm-models';
import { useSpotify } from '@/hooks/use-spotify';
import { resolveResponseModePrompt } from '@/lib/dm-response-modes';
import { useResponseMode } from '@/hooks/use-response-mode';
import { EmpyreanAutopilotGuide } from '@/components/empyrean/EmpyreanAutopilotGuide';
import CampaignBuilderChat from '@/components/ai-dm/CampaignBuilderChat';
import type { CampaignBuildData } from '@/hooks/use-ai-campaign-chat';
import { useEmpyreanAutopilot } from '@/hooks/use-empyrean-autopilot';
import { EMPYREAN_FEATURE_FLAGS } from '@/lib/empyreanFeatureFlags';
import { parseRollHint, type RollHint } from '@/lib/whisperRollHint';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmpyreanAbilityPicker } from '@/components/empyrean/EmpyreanAbilityPicker';
import {
  loadNarrativeCooldowns,
  decrementAllNarrativeCooldowns,
  startNarrativeCooldown,
  DEFAULT_NARRATIVE_COOLDOWN,
  type NarrativeCooldownMap,
} from '@/lib/narrativeCooldowns';

import type { SwipeHandlers } from '@/components/empyrean/EmpyreanDMContainer';
import type { NavigableTab } from '@/components/navigation/types';

interface EmpyreanDMScreenProps {
  open: boolean;
  onClose: (reason?: 'newCampaign' | 'reconfigure') => void;
  characterContext: CharacterContext;
  characterName: string;
  initialMessage?: string | null;
  autoSyncCallbacks?: {
    onHPChange: (change: number, type: 'damage' | 'healing') => void;
    onAddXP: (amount: number, source: string) => void;
    onGoldChange: (netChange: number) => void;
    onConditionChange: (toAdd: string[], toRemove: string[]) => void;
    onRestOccurred: (type: 'short' | 'long') => void;
    getCurrentHP: () => number;
    getCurrentGold: () => number;
  };
  embedded?: boolean;
  swipeHandlers?: SwipeHandlers;
  onNavigateToTab?: (tab: NavigableTab) => void;
}

const NOOP = () => {};
const NOOP_TWO_ARG = () => {};
const NOOP_RETURN_ZERO = () => 0;

const EMPYREAN_SESSION_KEY = 'empyrean-dm-session';
const EMPYREAN_SUMMARY_KEY = 'empyrean-dm-campaign-summary';
const EMPYREAN_MODEL_KEY = 'empyrean-dm-model';
const DEFAULT_EMPYREAN_MODEL = 'google/gemini-3-pro-preview';

function loadEmpyreanModel(): string {
  try {
    const saved = localStorage.getItem(EMPYREAN_MODEL_KEY);
    if (saved && DM_MODELS.some(m => m.id === saved)) return saved;
  } catch { /* ignore */ }
  return DEFAULT_EMPYREAN_MODEL;
}

function saveEmpyreanModel(modelId: string): void {
  try { localStorage.setItem(EMPYREAN_MODEL_KEY, modelId); } catch { /* ignore */ }
}

// Group prompts by category
function groupPromptsByCategory(prompts: typeof empyreanPrompts) {
  const groups: Record<string, typeof empyreanPrompts> = {};
  for (const p of prompts) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  }
  return groups;
}

// Strip burnout tags from displayed content
function stripBurnoutTags(content: string): string {
  return content.replace(/<!--BURNOUT:\d+-->/g, '').replace(/<!--BURNOUT_TICK:.+?-->/g, '').trim();
}

function stripSituationTags(content: string): string {
  return content.replace(/<!--SITUATION:\w+-->/g, '').trim();
}

function stripBondStrainTags(content: string): string {
  return content.replace(/<!--BOND_STRAIN:.+?-->/g, '').trim();
}

const BURNOUT_LABELS = [
  'No strain',
  'Relic warmth — bone-deep heat',
  'Heat spreading — nosebleed, unsteady',
  'Bones burning — collapse risk',
  'Skin burning — dragon alarmed',
  'Veins glowing — signet pulsing visibly',
  'Body at limit — dragon buffering',
  'Dragon absorbing overflow — bond straining',
  'Rider and dragon both near limit — loss of focus',
  'Critical co-overload — body failing',
  'Dragon desperately absorbing — scales cracking',
  'Mutual collapse imminent — bond tearing',
  'Maximum capacity — sever or die',
];

function BurnoutIndicator({ level, maxBurnout }: { level: number; maxBurnout: number }) {
  const ratio = maxBurnout > 0 ? level / maxBurnout : 0;
  const color = ratio < 0.35 ? 'text-emerald-400' : ratio < 0.65 ? 'text-amber-400' : ratio < 0.85 ? 'text-orange-500' : 'text-red-500';
  const emptyColor = ratio < 0.35 ? 'text-emerald-400/20' : ratio < 0.65 ? 'text-amber-400/20' : ratio < 0.85 ? 'text-orange-500/20' : 'text-red-500/20';
  return (
    <div className="flex items-center gap-0.5" title={`Signet Strain (${level}/${maxBurnout}): ${BURNOUT_LABELS[level] ?? BURNOUT_LABELS[BURNOUT_LABELS.length - 1]}`}>
      {Array.from({ length: maxBurnout }, (_, i) => (
        <Flame key={i} className={cn('w-3 h-3', i < level ? color : emptyColor)} />
      ))}
    </div>
  );
}

function stripAllMetaTags(content: string): string {
  return content
    .replace(/<!--BURNOUT:\d+-->/g, '')
    .replace(/<!--BURNOUT_TICK:.+?-->/g, '')
    .replace(/<!--SITUATION:\w+-->/g, '')
    .replace(/<!--BOND_STRAIN:.+?-->/g, '')
    .replace(/<!--DRAGON_MEMORY:.+?-->/g, '')
    .replace(/<!--BOND_GROWTH:.+?-->/g, '')
    .replace(/<!--DRAGON_BOND_FORMED-->/g, '')
    .replace(/<!--THRESHING_AUTHORIZED:.+?-->/g, '')
    .replace(/<!--(?:SFX|AMBIENCE|VFX|MOOD|MUSIC):.+?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function EmpyreanDMScreen({
  open,
  onClose,
  characterContext,
  characterName,
  initialMessage,
  autoSyncCallbacks,
  embedded = false,
  swipeHandlers,
  onNavigateToTab,
}: EmpyreanDMScreenProps) {
  const [config, setConfig] = useState<EmpyreanDMConfig | null>(() => loadEmpyreanDMConfig());
  const [selectedModel, setSelectedModel] = useState(loadEmpyreanModel);
  const [diceOddsMode, setDiceOddsMode] = useState<DiceOddsMode>(() => loadDiceOddsMode());
  const [showToolsDrawer, setShowToolsDrawer] = useState(false);
  const [characterSheetOpen, setCharacterSheetOpen] = useState(false);
  const [abilityPickerOpen, setAbilityPickerOpen] = useState(false);
  const [narrativeCooldowns, setNarrativeCooldowns] = useState<NarrativeCooldownMap>(() => loadNarrativeCooldowns());
  const prevAssistantMessageCountRef = useRef<number>(0);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showCharacterActions, setShowCharacterActions] = useState(false);
  const [showSaves, setShowSaves] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showWorldState, setShowWorldState] = useState(false);
  const [showNpcScene, setShowNpcScene] = useState(false);
  const [showOocChat, setShowOocChat] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [burnoutLevel, setBurnoutLevel] = useState(0);
  const burnoutLevelRef = useRef(burnoutLevel);
  useEffect(() => { burnoutLevelRef.current = burnoutLevel; }, [burnoutLevel]);
  const [currentSituation, setCurrentSituation] = useState<string>('exploration');
  const [dragonNotes, setDragonNotes] = useState(() => loadDragonNotes());
  const [initialSent, setInitialSent] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<DMNavTab | null>(null);
  const [navExpanded, setNavExpanded] = useState(false);
  const [showAutopilotGuide, setShowAutopilotGuide] = useState(false);
  const [recapExpanded, setRecapExpanded] = useState(false);
  const [recapDismissed, setRecapDismissed] = useState(false);
  const [showCampaignBuilder, setShowCampaignBuilder] = useState(false);
  const [showDeathSaves, setShowDeathSaves] = useState(false);
  const [showMemorial, setShowMemorial] = useState(false);
  const [showDeathTransition, setShowDeathTransition] = useState(false);
  const [threshingAuthorized, setThreshingAuthorized] = useState(false);
  const [showThreshingCinematic, setShowThreshingCinematic] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [slideshowSlides, setSlideshowSlides] = useState<import('@/lib/parseSlides').Slide[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const empyreanInputRef = useRef<EmpyreanDMInputHandle>(null);
  const [readingMode, setReadingMode] = useState(false);
  const [formattedReading, setFormattedReading] = useState<FormattedReading | null>(null);
  const [isFormattingReading, setIsFormattingReading] = useState(false);
  const prevIsLoadingRef = useRef(false);

  const DND_TUTORIALS = [
    {
      icon: "🎲",
      title: "The d20 — Your New God",
      body: "Welcome to Basgiath, where your entire goddamn future is decided by a 20-sided piece of plastic. Trying to not get thrown off your dragon at 300 feet? d20. Trying to lie to your wingleader's face about where you were last night? d20. Roll high and you are a war hero. Roll low and the DM describes your humiliation in pornographic detail. This die does not care about your feelings, your backstory, or your hopes and dreams."
    },
    {
      icon: "📊",
      title: "Your Six Stats — A Personality Test You Can Fail",
      body: "Every rider has six stats: Body, Agility, Grit, Intellect, Instinct, and Willpower. Each has a score and a modifier — the modifier is the little number you actually add to dice rolls. Think of it this way: the score is how hot you think you are, the modifier is how hot you actually are. If any modifier is negative, your character is canonically, measurably terrible at something. Congratulations, you built that disaster on purpose."
    },
    {
      icon: "💪",
      title: "Body — For When Diplomacy Means a Fist",
      body: "Body is brute force. Swinging your blade through a venin's skull, kicking down a barracks door at 3am, carrying your half-dead squadmate out of a ward line breach while they bleed all over your leathers. If your Body is low, you are the rider who cannot open a jar of healing draught while your friends are dying. That is your legacy. A jar defeated you."
    },
    {
      icon: "🏃",
      title: "Agility — Don't Fall Off the Damn Dragon",
      body: "Agility is reflexes, speed, and not becoming a bloody smear on the mountainside. It powers Combat Agility — fighting without tripping over your own sword whether you are on the ground in Basgiath's training pit or five hundred feet up dodging another dragon's tail. Low Agility at a war college full of people who want you dead is like showing up to a knife fight with a strongly worded letter."
    },
    {
      icon: "🪨",
      title: "Grit — The 'Too Pissed Off to Die' Stat",
      body: "Grit determines your Vitality — how much damage your body can absorb before you eat dirt. It also powers Flight Endurance, which is what keeps you conscious when your dragon does a vertical dive and every organ in your body tries to escape through your ass. Low Grit means you pass out during morning PT and miss the part where your wingleader announces your squad assignment. First impressions: ruined."
    },
    {
      icon: "🧠",
      title: "Intellect — The Nerd Stays Winning",
      body: "Intellect powers Signet Theory (not blowing yourself up with your own magic), Field Medicine (keeping idiots alive on the battlefield), Rune Crafting (very illegal, very fun), The Codex (lawyering your way out of punishment), and Deception (lying with a straight face when command asks why there is a hole in the west wall). Dump this stat and you will drink the wrong potion, read the wrong rune, and accidentally confess to shit you did not even do."
    },
    {
      icon: "👁️",
      title: "Instinct — Your Internal 'Oh Shit' Alarm",
      body: "Instinct powers Awareness — noticing the venin before it notices you, sensing the ambush in the tree line, realizing your professor is lying through their teeth about the ward line's integrity. Low Instinct riders are the ones who walk into the obviously trapped corridor and say 'it is probably fine' three seconds before it is the opposite of fine. Basgiath buries a lot of 'it is probably fine' riders."
    },
    {
      icon: "🔥",
      title: "Willpower — Absolute Unit Energy",
      body: "Willpower is the stat that makes dragons give a shit about you. It powers Dragon Empathy (convincing a multi-ton apex predator to not eat you during Threshing), Command (making your squad follow orders when everything is on fire), Morale (being the reason people do not desert), and Intimidation (making an enemy piss themselves with eye contact alone). Low Willpower? Your dragon tolerates you. Your squad ignores you. Even the mess hall cook gives you the small portion."
    },
    {
      icon: "⚔️",
      title: "Attacking — Violence With Arithmetic",
      body: "Roll d20, add your attack bonus. Beat the enemy's Defense and you hit. Then roll damage dice to see if you scratched them or absolutely ruined their day. Miss the Defense number and you just swung at air while a venin watches you with secondhand embarrassment. Combat at Basgiath is graded, by the way. Your wingleader is watching. Your squadmates are watching. The dragons are definitely watching. No pressure."
    },
    {
      icon: "🛡️",
      title: "Defense — The 'Please God Not the Face' Number",
      body: "Defense is how hard you are to hit. Armor, shields, and Agility all raise it. If your Defense is shit, every venin, gryphon, and pissed-off cadet on the training grounds is about to use you as target practice. You did not survive the Parapet — that nightmare bridge where people literally fall to their death on day one — just to get taken out by a goblin with a stick. Wear your damn armor."
    },
    {
      icon: "❤️",
      title: "Vitality — Your Meat Points",
      body: "Vitality is your health bar and it is the only thing between you and a very boring funeral. It goes up with Grit and leveling. It goes down every time something hits you, burns you, poisons you, or you push your signet past the point where your body starts cooking itself from the inside. Healing draughts help. Field Medicine helps. Not standing in dragon fire like it is a hot tub helps most of all."
    },
    {
      icon: "💀",
      title: "Zero Vitality — You Fucked Around. Now Find Out.",
      body: "Vitality hits zero and you are face-down in the dirt making death saves. Roll d20 each turn: 10 or higher is a success, 9 or lower is a failure. Three successes and you stabilize. Three failures and you are dead — for real dead, not dramatic-pause dead. Your squadmate can heal you to skip this whole thing, but they have to actually like you enough to sprint across a battlefield. Do they? Do they really?"
    },
    {
      icon: "💡",
      title: "Advantage & Disadvantage — Fate Playing Favorites",
      body: "Advantage: roll two d20s, keep the higher one. The universe briefly wants you to succeed. Maybe you flanked the enemy, maybe your dragon is backing you up, maybe you had a good idea for once. Disadvantage: roll two, keep the lower one. You are hungover, poisoned, fighting in darkness, or you just pissed off the DM. They cancel each other out because even Basgiath has rules. Some of the time."
    },
    {
      icon: "✨",
      title: "Signets — Magic That Might Literally Kill You",
      body: "Your signet is your innate power, channeled through the relic — that bond-mark your dragon burned into your body. Minor uses are free. Everything else costs signet power. Here is the fun part: push too hard and burnout kicks in. That is not tiredness — that is your body failing to contain the energy. Your bones heat up. Your relic burns. Push past that and you die. Not 'take damage' die. Dead die. Budget your magic like your life depends on it, because holy shit it literally does."
    },
    {
      icon: "⚡",
      title: "Combat Reflexes — The Fast Die First (In a Good Way)",
      body: "Fight breaks out. Everyone rolls d20 plus Agility modifier. Highest goes first. This determines whether you get to stab the venin before it corrupts your squad or whether you get to watch helplessly as everything goes sideways before your turn. At Basgiath, being slow means being dead. Roll high and you are a hero. Roll low and you are writing 'I should have trained harder' in your own blood."
    },
    {
      icon: "🎭",
      title: "Saving Throws — Dodging the Universe's Bullshit",
      body: "A venin tries to rot your mind? Willpower Save. Dragon fire from a pissed-off unfamiliar dragon? Agility Save. Someone slips poison in your drink at the tavern outside Basgiath? Grit Save. Signet interference scrambling your focus? Focus Save. Roll d20, add the matching save bonus from your sheet. Beat the number and you shrug it off. Fail and you find out exactly how much that particular flavor of suffering costs. Navarre has a lot of flavors."
    },
    {
      icon: "📏",
      title: "Movement — 30 Feet of Bad Life Choices",
      body: "You get 30 feet of movement per turn. Move, stab, keep moving — very action hero, very Basgiath combat training. But if you turn your back on someone without disengaging, they get a free swing at you. This is true for venin, for sparring partners, and for that one cadet who has been looking for an excuse to shank you since Threshing. Never turn your back. At Basgiath, that is not a metaphor."
    },
    {
      icon: "🏕️",
      title: "Resting — Even War Machines Need to Shut the Hell Down",
      body: "Short rest: one hour. Spend Hit Dice to recover some Vitality. Think of it as stitching yourself up between fights and trying not to cry. Long rest: full night of sleep. All Vitality back, most abilities recharged. The real question is never 'should we rest' — it is 'can we rest without something killing us in our sleep.' Beyond the ward line, the answer is usually 'lol no.' Rest smart or die tired."
    },
    {
      icon: "🤝",
      title: "Proficiency — Being Less Dogshit at Specific Things",
      body: "Proficiency means you trained in something and you add a bonus to rolls using it. That bonus grows as you level up. Proficient in Shadow Work? You can sneak past Basgiath's patrols. Not proficient? You step on a loose stone, knock over a lamp, alert three guards, wake up a dragon, and somehow set something on fire. You are now in The Codex getting court-martialed. That escalated fast."
    },
    {
      icon: "🎯",
      title: "Natural 20s and 1s — Emotional Terrorism",
      body: "Natural 20: always hits, double damage dice. For one glorious moment you are the deadliest rider at Basgiath and your dragon is proud of you. You can feel it through the bond. Natural 1: automatic miss. Does not matter if you have trained for years. The die said eat shit and the die is law. Your sword flies out of your hand, your signet fizzles, or you punch yourself in the face. The wingleader is watching. They always are."
    },
    {
      icon: "🗣️",
      title: "Reactions — Free Violence on Company Time",
      body: "You get one reaction per round. Most popular use: opportunity attacks. Enemy turns tail? Free swing at their retreating ass. Venin tries to disengage? Not on your watch. Think of it as the game rewarding you for being a vindictive little psycho who refuses to let anyone leave a fight cleanly. At Basgiath they call this 'good instincts.' Everywhere else they call it 'a personality disorder.' Same thing."
    },
    {
      icon: "🔮",
      title: "Concentration — Multitasking Will Kill You (Literally)",
      body: "Some signet abilities need concentration. You can hold exactly one at a time because apparently your brain is single-threaded. Get hit while concentrating and you roll to see if you drop it. Spoiler: you will drop it while your squad is depending on it. That is not a bug, that is the burnout-adjacent anxiety the game was designed to give you. Want to cast something else that needs concentration? The first one dies immediately. Just like your plans."
    },
    {
      icon: "📜",
      title: "Your Turn — A Menu of Violence and Poor Judgment",
      body: "Each turn: movement (up to your speed), one action (attack, signet, dash, dodge, hide, or help a squadmate who is probably going to waste it), and sometimes a bonus action. That is the whole buffet. No, you cannot attack twice. No, you cannot 'do a barrel roll and also cast a signet and also intimidate everyone.' This is Basgiath, not a damn action movie. Okay it is a damn action movie but the rules still apply."
    },
    {
      icon: "🪙",
      title: "Dice Notation — Math for People Who Ride Dragons",
      body: "2d6 means roll two six-sided dice and add them. Number before the d is how many dice. Number after is how many sides. 1d20 is the one you roll most. 8d6 is what happens when a dragon opens its mouth and chooses violence. If someone tells you to roll 12d6, either something incredible is happening or you are about to be a war crime statistic. This is why riders collect dice like a personality trait."
    }
  ];

  const [currentTutorialIndex, setCurrentTutorialIndex] = useState(() => Math.floor(Math.random() * DND_TUTORIALS.length));
  const tutorialIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Reload config when screen opens
  const [showDragonChat, setShowDragonChat] = useState(false);
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [diceRollerWhisperText, setDiceRollerWhisperText] = useState<string | null>(null);
  const diceRollerHint: RollHint | null = useMemo(() => {
    if (!diceRollerWhisperText) return null;
    return parseRollHint(diceRollerWhisperText);
  }, [diceRollerWhisperText]);
  const [showUnbondedDragonSheet, setShowUnbondedDragonSheet] = useState(false);
  const [showDragonSetup, setShowDragonSetup] = useState(false);
  const [isUnbonded, setIsUnbondedState] = useState(() => getIsUnbonded());

  const updateUnbondedStatus = useCallback((unbonded: boolean) => {
    setIsUnbonded(unbonded);
    setIsUnbondedState(unbonded);
  }, []);

  useEffect(() => {
    if (open) {
      setConfig(loadEmpyreanDMConfig());
      setRecapDismissed(false);
      dragonBond.checkDecay();
    }
  }, [open]);

  // Auto-install Threshing Rebirth GM guide when unbonded
  useEffect(() => {
    if (isUnbonded && open) {
      const guideId = 'empyrean-session-threshing-rebirth';
      const existingGuide = guides.find((g: any) => g.id === guideId);
      if (!existingGuide) {
        addGuide(
          'Threshing Rebirth Protocol',
          `A rider in this party has died and been reborn without a dragon bond. The Empyrean has decreed they must prove worthiness before a new Threshing.

UNBONDED RIDER RULES:
- This character has NO dragon, NO signet, NO telepathic bond. They fight with blade and body only.
- Reference their vulnerability — they are the only unbonded rider in a bonded squad.
- Other characters' dragons should react to them with curiosity, wariness, or occasional tenderness.
- Design trials that test the character's worthiness: courage without power, leadership without authority.
- The character feels the absence of the bond physically — a hollow ache, silence where a voice should be.
- When bonded riders communicate telepathically, this character is excluded. Narrate the exclusion.
- NPCs treat them differently: some with respect, some with pity, some with suspicion.
- DO NOT have a dragon bond with this character unless the <!--THRESHING_AUTHORIZED--> tag has been injected.`,
          guideId
        );
      }
    }
  }, [isUnbonded, open]);

  const gmGuides = useGMGuides();
  const { enabledContent, activeGuideIds, guides, addGuide, deleteGuide } = gmGuides;
  const { themeId: chatThemeId, setTheme: setChatTheme } = useDMChatTheme();
  const { whisperTrayEnabled, setWhisperTrayEnabled } = useWhisperTrayEnabled();
  const { cinematicModeEnabled, setCinematicMode } = useCinematicMode();
  const narrator = useNarrator();
  const spotify = useSpotify();
  const { responseMode, setResponseMode } = useResponseMode();

  // Auto-sync hook
  const autoSync = useDmAutoSync({
    onHPChange: autoSyncCallbacks?.onHPChange ?? NOOP_TWO_ARG,
    onAddXP: autoSyncCallbacks?.onAddXP ?? NOOP_TWO_ARG,
    onGoldChange: autoSyncCallbacks?.onGoldChange ?? NOOP,
    onConditionChange: autoSyncCallbacks?.onConditionChange ?? NOOP_TWO_ARG,
    onRestOccurred: autoSyncCallbacks?.onRestOccurred ?? NOOP,
    onMapUpdate: NOOP_TWO_ARG,
    getCurrentHP: autoSyncCallbacks?.getCurrentHP ?? NOOP_RETURN_ZERO,
    getCurrentGold: autoSyncCallbacks?.getCurrentGold ?? NOOP_RETURN_ZERO,
    getCurrentMarkers: useCallback(() => [], []),
    getGridSize: useCallback(() => ({ cols: 10, rows: 10 } as any), []),
  });

  const dragonBond = useDragonBond({
    dragonName: config?.dragonName || '',
    characterName,
  });

  const maxBurnout = isUnbonded ? 0 : 8;

  const dmPersonaPrompt = useMemo(() => {
    if (!config) return undefined;
    const bs = dragonBond.bondState;
    const recentDragonChatSummaryRaw = getScopedItem(DRAGON_CHAT_SUMMARY_KEY);
    let persona = buildEmpyreanDMPersona(
      config.selectedLoreGuides,
      config.selectedToneGuides,
      config.selectedSessionTemplate,
      config.characterName || characterName,
      config.dragonName,
      config.signetType,
      config.yearAtBasgiath,
      config.campaignFocus,
      dragonNotes,
      bs.bond,
      getBondDescriptor(bs.bond),
      getTrustDescriptor(bs.trust),
      bs.mood,
      recentDragonChatSummaryRaw?.trim() ? recentDragonChatSummaryRaw : undefined,
      bs.memories.map(m => m.text),
      isUnbonded,
    );
    if (threshingAuthorized && isUnbonded) {
      persona += `\n\n## THRESHING CEREMONY — NARRATE NOW

The host has authorized the Threshing. A dragon will now choose ${config.characterName || characterName}. Narrate this in your NEXT response.

THE APPROACH: A dragon approaches within the current scene. Narrate through the rider's senses — a change in the air, other dragons going still, the ground vibrating. Do NOT name the dragon yet.

THE EVALUATION: The dragon evaluates the rider. Reference what they endured while unbonded. Build real tension — 2-3 paragraphs minimum. The rider should feel genuinely uncertain.

THE BOND: When the dragon decides, it happens fast. Physical contact ignites the bond. The silence SHATTERS. A second heartbeat slams into rhythm. The rider staggers. Colors sharpen. A voice fills their mind. The dragon's name arrives as a knowing, not a word.

THE AFTERMATH: The party reacts. The world rewrites. End with a sense that everything has changed.

CRITICAL: After narrating the bond, emit <!--DRAGON_BOND_FORMED--> at the very end of your response. Do NOT emit it until the narration is complete.`;
    }
    return persona;
  }, [config, characterName, dragonNotes, dragonBond.bondState, dragonBond.bondState.totalChatExchanges, isUnbonded, threshingAuthorized]);

  const [trackingCampaignId, setTrackingCampaignId] = useState<string | null>(null);
  const { weather } = useWeather();
  const gameState = useDMGameState(trackingCampaignId);
  const worldStatePrompt = useMemo(() => {
    let prompt = buildMemoryAnchorsPrompt(gameState.gameState);
    if (weather) {
      prompt += '\n\n## CURRENT WEATHER (REAL-WORLD SYNC — MANDATORY)\n' + weatherToNarrativeContext(weather) + '\nYou MUST incorporate this weather into your narration. Rules:\n1. Your FIRST response in any new scene or session MUST describe the weather as part of the environment — use sensory details (sound of rain, feel of wind, visibility in fog, cold of snow).\n2. In subsequent outdoor responses, reference the weather at least briefly — how it affects the ground, visibility, comfort, or mood.\n3. If the party is indoors, mention the weather through windows, sounds on the roof, drafts under doors, or characters arriving wet/cold.\n4. In combat outdoors, note how weather affects the battlefield — slippery ground, obscured vision, wind affecting projectiles.\n5. Do NOT repeat the same weather description verbatim — vary your phrasing each time.\n6. Do NOT state the temperature as a number. Describe it through sensation (biting cold, oppressive heat, comfortable warmth).';
    }
    return prompt;
  }, [gameState.gameState, weather]);

  const oocDmChat = useOocDmChat({
    characterContext,
    campaignSummary: null,
    customGuidesContent: enabledContent,
    campaignType: 'empyrean',
    selectedModel,
    storageKeySuffix: '-empyrean',
  });

  const {
    messages,
    isLoading,
    isSummarizing,
    campaignSummary,
    updateCampaignSummary,
    sendMessage,
    voiceNPC,
    startNpcScene,
    stopNpcScene,
    submitNpcInterjection,
    npcSceneConfig,
    clearMessages,
    cancelRequest,
    editMessage,
    deleteMessage,
    regenerateMessage,
    loadCampaign,
    activeCampaignId,
    setActiveCampaignId,
    newGame,
  } = useAIDM({
    characterContext,
    customGuidesContent: enabledContent,
    dmPersonaPrompt,
    responseModePrompt: resolveResponseModePrompt(responseMode),
    selectedModel,
    worldStatePrompt,
    sessionStorageKey: EMPYREAN_SESSION_KEY,
    summarizeStorageKey: EMPYREAN_SUMMARY_KEY,
    onMessageComplete: (content: string) => {
      if (autoSync.autoSyncEnabled) {
        autoSync.extractAndApply(content, characterContext);
      }


      // Extract bond strain events
      const strainMatch = content.match(/<!--BOND_STRAIN:(.+?)-->/);
      if (strainMatch) {
        dragonBond.processBondStrain(strainMatch[1]);
        toast('Dragon bond strained: ' + strainMatch[1], { icon: '💔' });
      }

      // Extract dragon memory events
      const memoryMatch = content.match(/<!--DRAGON_MEMORY:(.+?)-->/);
      if (memoryMatch) {
        dragonBond.addNarrativeMemory(memoryMatch[1]);
        toast('Dragon remembers: ' + memoryMatch[1], { icon: '🐉' });
      }

      // Extract bond growth events
      const bondGrowthMatch = content.match(/<!--BOND_GROWTH:(.+?)-->/);
      if (bondGrowthMatch) {
        dragonBond.processBondGrowth(bondGrowthMatch[1]);
        toast('Bond deepens: ' + bondGrowthMatch[1], { icon: '🐉' });
      }

      // Extract burnout tick events
      const burnoutTickMatch = content.match(/<!--BURNOUT_TICK:(.+?)-->/);
      if (burnoutTickMatch) {
        const nextBurnout = Math.min((burnoutLevelRef.current ?? 0) + 1, maxBurnout);
        setBurnoutLevel(nextBurnout);
        toast('Signet strain: ' + burnoutTickMatch[1], { icon: '🔥' });
      }

      // Extract dragon whispers from parsed whispers
      const parsed = parseWhispers(content);
      const dragonNameNormalized = config?.dragonName?.toLowerCase().trim();
      const dragonWhispers = parsed.whispers
        .filter(w => w.type === 'whisper' && dragonNameNormalized && w.target?.toLowerCase().trim() === dragonNameNormalized);

      dragonWhispers.forEach(w => {
        dragonBond.addDragonMessage(w.content);

        // Send dragon bond Telegram notification (non-blocking)
        sendTelegramNotification({
          type: 'dragon_message',
          title: `${config?.dragonName} whispers...`,
          body: w.content.length > 200
            ? w.content.substring(0, 200) + '…'
            : w.content,
          dragonName: config?.dragonName || 'Dragon',
          mode: 'empyrean',
        });
      });

      // Track combat for bond building + send Telegram combat alert
      if (content.toLowerCase().includes('initiative') || content.toLowerCase().includes('combat begins') || content.match(/<!--SITUATION:combat-->/)) {
        dragonBond.processCombatBond();

        // Send combat Telegram notification (non-blocking)
        sendTelegramNotification({
          type: 'combat_start',
          title: '🗡️ Combat Has Begun!',
          body: 'Your DM has initiated combat. Roll for initiative!',
          mode: 'empyrean',
  });

      }

      // Detect dragon bond formation
      const bondFormedMatch = content.match(/<!--DRAGON_BOND_FORMED-->/);
      if (bondFormedMatch && isUnbonded) {
        // Remove the Threshing guide
        const threshingGuide = guides.find(g => g.id === 'empyrean-session-threshing-rebirth');
        if (threshingGuide) {
          deleteGuide(threshingGuide.id);
        }
        toast('A dragon has chosen you!', { icon: '🐉', duration: 5000 });
        setShowThreshingCinematic(true);
      }

      // Non-blocking AI situation detection
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-situation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text: content.slice(0, 2000) }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.situation) {
              setCurrentSituation(data.situation);
              spotify.playPresetById(data.situation);
            }
          }
        } catch { /* non-blocking — situation detection is best-effort */ }
      })();

      // Cinematic slideshow: AI tags the narrative, then parse into slides
      if (cinematicModeEnabled && EMPYREAN_FEATURE_FLAGS.showCinematicSlideshow) {
        (async () => {
          let textForSlides = content;
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tag-cinematic`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ text: content }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.taggedText && data.taggedText.trim().length > 0) {
                textForSlides = data.taggedText;
              }
            }
          } catch {
            // Tagging failed — continue with untagged content
          }
          const slides = parseResponseIntoSlides(textForSlides);
          if (slides.length > 1) {
            setSlideshowSlides(slides);
            setShowSlideshow(true);
          }
        })();
      }
    },
    onQuestExtracted: (quests) => {
      for (const q of quests) {
        gameState.setQuestFlag(q.key, q.status, q.notes);
      }
    },
  });

  const npcSceneSessionConfig = useMemo(() => ({
    active: true,
    mode: 'shared' as const,
    currentRoundId: '',
    campaignSummary: campaignSummary,
    isGenerating: false,
    campaignType: 'empyrean' as const,
  }), [campaignSummary]);

  // Register Oracle quest callback so OracleDrawer can save quests to game state
  const drawerContext = usePromptDrawers();
  useEffect(() => {
    drawerContext?.registerOracleQuestCallback?.((quests) => {
      for (const q of quests) {
        gameState.setQuestFlag(q.key, q.status, q.notes);
      }
    });
    return () => { drawerContext?.registerOracleQuestCallback?.(null); };
  }, [gameState.setQuestFlag]);

  // Sync tracking campaign id with active campaign id from useAIDM
  useEffect(() => {
    setTrackingCampaignId(activeCampaignId);
  }, [activeCampaignId]);

  // Auto-enter reading mode when generation STARTS (non-cinematic) so user sees shimmer bars instead of raw text
  useEffect(() => {
    if (!prevIsLoadingRef.current && isLoading && !cinematicModeEnabled) {
      setReadingMode(true);
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, cinematicModeEnabled]);

  // Rotate tutorial tips while loading screen is showing
  useEffect(() => {
    if (readingMode && (isLoading || isFormattingReading || !formattedReading)) {
      setCurrentTutorialIndex(Math.floor(Math.random() * DND_TUTORIALS.length));
      tutorialIntervalRef.current = setInterval(() => {
        setCurrentTutorialIndex(prev => (prev + 1) % DND_TUTORIALS.length);
      }, 8000);
      return () => {
        if (tutorialIntervalRef.current) clearInterval(tutorialIntervalRef.current);
      };
    } else {
      if (tutorialIntervalRef.current) {
        clearInterval(tutorialIntervalRef.current);
        tutorialIntervalRef.current = null;
      }
    }
  }, [readingMode, isLoading, isFormattingReading, formattedReading]);


  useEffect(() => {
    if (!readingMode) {
      setFormattedReading(null);
      setIsFormattingReading(false);
      return;
    }
    // Still generating — keep shimmer bars showing, do not start formatting yet
    if (isLoading) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content?.trim());
    if (!lastAssistant) return;
    const parsed = parseWhispers(lastAssistant.content || '');
    if (!parsed.narrative.trim()) return;

    setIsFormattingReading(true);
    formatForReadingMode(parsed.narrative)
      .then(result => { setFormattedReading(result); })
      .catch(() => { setFormattedReading(null); })
      .finally(() => { setIsFormattingReading(false); });
  }, [readingMode, isLoading, messages]);

  // Dragon narrative reaction: auto-trigger dragon chat response after each DM message
  const lastDragonReactionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!config?.dragonName || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;
    const msgId = lastMsg.content.substring(0, 50);
    if (msgId === lastDragonReactionIdRef.current) return;
    lastDragonReactionIdRef.current = msgId;

    const bs = dragonBond.bondState;
    const dragonPrompt = buildDragonChatPrompt(
      config.dragonName,
      characterName,
      bs.trust,
      bs.mood as any,
      bs.memories || [],
      dragonNotes,
      bs.speechHabits,
      [lastMsg.content],
      bs.bond,
      bs.riderEmotionalLog,
    );

    const reactionPrompt = dragonPrompt + `\n\n## NARRATIVE REACTION MODE\nThe DM just narrated new events. You experienced this through the bond — you felt your rider's emotions, sensed the danger or calm, witnessed what happened through shared perception.\n\nReact naturally as the dragon would. This might be:\n- A warning about something you noticed\n- An emotional reaction to what happened\n- A comment on an NPC\n- Tactical input about a threat\n- A feeling shared through the bond\n- Or silence, if nothing warrants a response (respond with exactly "SILENCE" and nothing else)\n\nDo NOT summarize the narrative. React to it. Keep your response consistent with your current trust level and mood. Use your personality profile as the sole guide for your voice and temperament.`;

    const timer = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const chatRaw = getScopedItem(DRAGON_CHAT_KEY);
        let chatMessages: Array<{ role: string; content: string }> = [];
        try {
          if (chatRaw) {
            const parsed = JSON.parse(chatRaw);
            chatMessages = Array.isArray(parsed) ? parsed : (parsed.messages || []);
          }
        } catch { /* ignore */ }

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [
              ...chatMessages.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
              { role: 'user', content: '[The bond flares with new sensation — events unfold in the world around you.]' },
            ],
            systemPromptOverride: reactionPrompt,
            model: 'google/gemini-2.5-flash',
            maxTokens: 500,
          }),
        });

        if (!resp.ok || !resp.body) return;

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = '';
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (line.startsWith(':') || line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) assistantContent += delta;
            } catch { /* skip */ }
          }
        }

        if (!assistantContent.trim() || assistantContent.trim().toUpperCase() === 'SILENCE') return;

        const dragonMsg = { role: 'assistant', content: assistantContent.trim() };
        const updatedChat = [...chatMessages, dragonMsg];
        setScopedItem(DRAGON_CHAT_KEY, JSON.stringify({ messages: updatedChat }));

        const moodMatch = assistantContent.match(/<!--DRAGON_MOOD:(\w+)-->/);
        if (moodMatch && ['calm', 'alert', 'protective', 'distant', 'ancestral', 'playful'].includes(moodMatch[1])) {
          // Update mood in bond state
        }

        const memoryMatches = [...assistantContent.matchAll(/<!--DRAGON_MEMORY:(.+?)-->/g)];
        for (const match of memoryMatches) {
          dragonBond.addNarrativeMemory(match[1]);
        }

        dragonBond.addDragonMessage(assistantContent.trim());
      } catch (err) {
        console.warn('[EmpyreanDM] Dragon narrative reaction failed:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [messages, config?.dragonName, characterName, dragonNotes, dragonBond.bondState]);

  // Campaign sessions — uses 'empyrean' mode to namespace separately from regular DM saves
  const {
    sessions: campaignSessions,
    isLoading: sessionsLoading,
    isSignedIn,
    saveSession: saveCampaignSession,
    deleteSession: deleteCampaignSession,
    renameSession: renameCampaignSession,
    refreshSessions,
  } = useCampaignSessions('empyrean' as any);

  const handleLoadCampaign = useCallback((session: CampaignSession) => {
    loadCampaign(session.messages, session.campaign_summary, session.id, session.gm_guide_ids);
    setShowSaves(false);
    setShowToolsDrawer(false);
    toast.success(`Loaded: ${session.name}`);
  }, [loadCampaign]);

  const handleSaveCampaign = useCallback(async (
    name: string,
    msgs: import('@/components/oracle/types').Message[],
    summary: string | null,
    existingId?: string,
  ) => {
    return saveCampaignSession(name, msgs, summary, existingId);
  }, [saveCampaignSession]);

  // Message action states
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const handleStartEdit = useCallback((id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
    setActiveActionId(null);
  }, []);

  const handleSaveEdit = useCallback((id: string) => {
    if (editContent.trim()) {
      editMessage(id, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  }, [editContent, editMessage]);

  const handleDelete = useCallback((id: string) => {
    deleteMessage(id);
    setActiveActionId(null);
  }, [deleteMessage]);

  const handleRegenerate = useCallback((id: string) => {
    regenerateMessage(id);
    setActiveActionId(null);
  }, [regenerateMessage]);

  // Auto-send initial message from prompt library
  useEffect(() => {
    if (open && initialMessage && !initialSent && messages.length === 0) {
      const timer = setTimeout(() => {
        sendMessage(initialMessage);
        setInitialSent(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, initialMessage, initialSent, messages.length, sendMessage]);

  // Reset initialSent when screen closes
  useEffect(() => {
    if (!open) setInitialSent(false);
  }, [open]);

  // Parse burnout tags from assistant messages
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.content) {
      const match = lastMsg.content.match(/<!--BURNOUT:(\d+)-->/);
      if (match) {
        const level = Math.min(maxBurnout, Math.max(0, parseInt(match[1], 10)));
        setBurnoutLevel(level);
      }
      const situationMatch = lastMsg.content.match(/<!--SITUATION:(\w+)-->/);
      if (situationMatch) {
        setCurrentSituation(situationMatch[1]);
      }
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Also scroll to bottom when screen opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Save solo HP snapshot for homescreen dual bars
  useEffect(() => {
    if (!open) return;
    const save = () => {
      const current = autoSyncCallbacks?.getCurrentHP() ?? 0;
      const max = characterContext?.maxHP ?? 0;
      if (max > 0) saveSoloHP({ current, max });
    };
    save();
    const interval = setInterval(save, 3000);
    return () => { clearInterval(interval); save(); };
  }, [open, autoSyncCallbacks, characterContext?.maxHP]);

  const handleWhisperRoll = useCallback((whisperContent: string) => {
    setDiceRollerWhisperText(whisperContent);
    setDiceRollerOpen(true);
  }, []);

  const handleAppendPrompt = useCallback((prompt: string) => {
    if (isLoading) return;
    empyreanInputRef.current?.appendText(prompt);
    setActiveNavTab(null);
    setNavExpanded(false);
  }, [isLoading]);

  // Ref to autopilot — needed because handleNavTabChange is defined before useEmpyreanAutopilot
  const autopilotRef = useRef<ReturnType<typeof useEmpyreanAutopilot> | null>(null);

  useEffect(() => {
    if (!open || !isUnbonded) return;
    const rebirthFlag = localStorage.getItem('odyssey-unbonded-rebirth');
    if (rebirthFlag !== 'true') return;
    localStorage.removeItem('odyssey-unbonded-rebirth');
    const t = setTimeout(() => {
      const rebirthPrompt = `[SYSTEM — NARRATIVE TRANSITION — NEW CHARACTER ENTERING]\n\nThe previous rider has fallen. A new character, ${characterName}, now enters the story as an unbonded rider — no dragon, no signet, no bond. This is their first moment in the campaign.\n\nNarrate the following in 2-3 paragraphs:\n1. A brief, atmospheric acknowledgment of what was lost — the squad's grief, an empty dragon perch, a name spoken quietly. Do not over-narrate the death; let it live in the background.\n2. Introduce ${characterName} arriving at Basgiath as an unbonded cadet. Describe the physical experience of being unbonded in a place built for bonded riders — the silence where a bond should be, the way other dragons look at them, the weight of walking instead of flying.\n3. End with a moment that establishes ${characterName}'s first challenge or interaction — a commanding officer assigning them, a fellow cadet's reaction, or a dragon that watches them a beat too long.\n\nSet the tone: this is not a punishment. This is a crucible. Make the player feel the weight of what they must earn back.`;
      sendMessage(rebirthPrompt);
    }, 500);
    return () => clearTimeout(t);
  }, [open, isUnbonded, characterName, sendMessage]);

  const handleSend = useCallback(() => {
    const text = empyreanInputRef.current?.getText()?.trim();
    if (!text || isLoading) return;
    setRecapDismissed(true);
    let messageToSend = text;
    
    // Inject Threshing authorization tag if authorized
    if (threshingAuthorized) {
      messageToSend += '\n\n<!--THRESHING_AUTHORIZED:' + characterName + '-->';
    }
    
    // Support multiple @NPC tags: @NPC1 @NPC2 message
    const multiNpcMatch = messageToSend.match(/^((?:@\S+\s+)+)(.+)$/s);
    if (multiNpcMatch && voiceNPC) {
      const npcNames = [...multiNpcMatch[1].matchAll(/@(\S+)/g)].map(m => m[1]);
      const message = multiNpcMatch[2];
      if (npcNames.length > 0 && message.trim()) {
        voiceNPC(npcNames.length === 1 ? npcNames[0] : npcNames, message);
      } else {
        sendMessage(messageToSend);
      }
    } else {
      sendMessage(messageToSend);
    }
    empyreanInputRef.current?.setText('');
  }, [isLoading, sendMessage, voiceNPC, threshingAuthorized, characterName]);

  const handlePromptSelect = useCallback((prompt: string) => {
    const filled = prompt.replace(/\[Character Name\]/g, characterName);
    empyreanInputRef.current?.setText(filled);
    setShowPrompts(false);
    empyreanInputRef.current?.focus();
  }, [characterName]);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    saveEmpyreanModel(modelId);
    toast.success(`Model: ${DM_MODELS.find(m => m.id === modelId)?.label ?? modelId}`);
  }, []);

  const handleNavTabChange = useCallback((tab: DMNavTab) => {
    if (tab === 'oracle') {
      if (isUnbonded) {
        setShowUnbondedDragonSheet(true);
        return;
      }
      dragonBond.markChatOpened();
      setShowDragonChat(true);
      return;
    }
    if (tab === 'prompts') {
      setShowPrompts(true);
      return;
    }
    if (tab === 'actions') {
      setShowCharacterActions(true);
      return;
    }
    if (tab === 'settings') {
      setShowToolsDrawer(true);
      return;
    }
    if (tab === 'afk') {
      if (EMPYREAN_FEATURE_FLAGS.showAutopilotGuideModal) {
        setShowAutopilotGuide(true);
      } else {
        const ap = autopilotRef.current;
        if (ap) {
          const wasActive = ap.isAutopilotActive;
          ap.toggleAutopilot();
          if (!wasActive) {
            toast.success('Autopilot enabled! Watch your rider act.');
          } else {
            toast('Autopilot disabled.');
          }
        }
      }
      return;
    }
    // Dice and other tabs toggle the full-screen content panel
    setActiveNavTab(prev => prev === tab ? null : tab);
  }, [dragonBond]);

  const handleDragonNotesChange = useCallback((notes: string) => {
    setDragonNotes(notes);
    saveDragonNotes(notes);
  }, []);

  const handleUsePrompt = useCallback((prompt: string) => {
    if (!isLoading) {
      sendMessage(prompt);
      setActiveNavTab(null);
      setNavExpanded(false);
    }
  }, [isLoading, sendMessage]);

  // Narrative cooldowns: decrement when a new DM assistant response arrives.
  useEffect(() => {
    const assistantCount = messages.filter(m => m.role === 'assistant' && m.content?.trim()).length;
    // On mount, just capture the count. Only decrement when count INCREASES past the captured value.
    if (prevAssistantMessageCountRef.current === 0 && assistantCount > 0) {
      prevAssistantMessageCountRef.current = assistantCount;
      return;
    }
    if (assistantCount > prevAssistantMessageCountRef.current) {
      const delta = assistantCount - prevAssistantMessageCountRef.current;
      prevAssistantMessageCountRef.current = assistantCount;
      let latest: NarrativeCooldownMap = loadNarrativeCooldowns();
      for (let i = 0; i < delta; i++) {
        latest = decrementAllNarrativeCooldowns();
      }
      setNarrativeCooldowns(latest);
    }
  }, [messages]);

  const abilityTiersMap = useMemo(() => {
    const m = new Map<string, number>();
    const charAbilities: Array<{ abilityId: string; currentTier?: number }> = (characterContext as any)?.abilities || [];
    for (const ca of charAbilities) {
      if (ca.abilityId) m.set(ca.abilityId, ca.currentTier || 1);
    }
    return m;
  }, [characterContext]);

  const handleUseEmpyreanAbility = useCallback((abilityId: string, generatedPrompt: string) => {
    // Start cooldown BEFORE sending so the UI reflects it immediately.
    startNarrativeCooldown(abilityId, DEFAULT_NARRATIVE_COOLDOWN);
    setNarrativeCooldowns(loadNarrativeCooldowns());
    handleUsePrompt(generatedPrompt);
  }, [handleUsePrompt]);

  const lastAssistantMsg = useMemo(() => {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    return last?.content ?? null;
  }, [messages]);

  const autopilot = useEmpyreanAutopilot({
    enabled: true,
    characterName,
    dragonName: config?.dragonName || '',
    delaySeconds: 8,
    onSendAction: handleUsePrompt,
    lastAssistantMessage: lastAssistantMsg,
    isLoading,
  });
  autopilotRef.current = autopilot;

  const handleNewCampaign = useCallback(() => {
    newGame();
    setActiveTemplate(null);
    setBurnoutLevel(0);
    setCurrentSituation('exploration');
    setShowToolsDrawer(false);
    if (autopilot.isAutopilotActive) autopilot.takeControl();
    setRecapExpanded(false);
    // Wipe Empyrean campaign setup so the player is routed back to the setup menu
    clearEmpyreanDMConfig();
    clearDragonNotes();
    clearEmpyreanOpeningScene();
    setConfig(null);
    console.log('[Empyrean] New Campaign — storage wiped, closing DM');
    // Defer onClose one tick so React has a chance to process setConfig(null)
    // and the parent effect picks up the storage wipe reliably.
    setTimeout(() => {
      onClose('newCampaign');
    }, 0);
  }, [newGame, autopilot, onClose]);

  const handleCampaignBuilderComplete = useCallback(async (data: CampaignBuildData) => {
    setShowCampaignBuilder(false);
    handleNewCampaign();
    setTimeout(() => {
      updateCampaignSummary(data.campaignSummary);
      gmGuides.addGuide(`📖 ${data.campaignName}`, data.gmGuide);
      for (const anchor of data.memoryAnchors) {
        gameState.addMemoryAnchor({ category: anchor.category, key: anchor.key, value: anchor.value });
      }
      setTimeout(() => {
        sendMessage('Begin the adventure. Here is the opening scene to set the stage:\n\n' + data.openingScene);
      }, 200);
    }, 100);
  }, [handleNewCampaign, updateCampaignSummary, gmGuides, gameState, sendMessage]);

  const handleCampaignSummaryChange = useCallback((summary: string) => {
    updateCampaignSummary(summary);
  }, [updateCampaignSummary]);

  const handleSessionTemplate = useCallback((template: typeof EMPYREAN_SESSION_GUIDES[0]) => {
    const msg = `Start a new session using this structure: ${template.name}. My character is ${characterName}. Set the scene and begin.`;
    sendMessage(msg);
    setActiveTemplate(template.name);
    setShowPrompts(false);
  }, [characterName, sendMessage]);

  const handleRandomPrompt = useCallback(() => {
    const randomPrompt = empyreanPrompts[Math.floor(Math.random() * empyreanPrompts.length)];
    const filled = randomPrompt.prompt.replace(/\[Character Name\]/g, characterName);
    sendMessage(filled);
    setShowPrompts(false);
  }, [characterName, sendMessage]);
  const npcNames = useNPCAutocomplete(messages);

  const groupedPrompts = useMemo(() => groupPromptsByCategory(empyreanPrompts), []);

  if (!open) return null;

  // No config — show placeholder
  if (!config) {
    return (
      <div className={cn("flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0a2e] via-background to-background gap-4 px-6", embedded ? "absolute inset-0" : "fixed inset-0 z-[60]")}>
        <span className="text-5xl">🐉</span>
        <h2 className="text-xl font-cinzel font-bold text-purple-300 text-center">
          No Empyrean Campaign Configured
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Configure your dragon rider, choose your lore, and set your campaign focus to begin.
        </p>
        <Button
          onClick={() => setShowSetup(true)}
          className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-cinzel min-h-[48px] px-8"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Run Campaign Setup
        </Button>
        <Button
          variant="ghost"
          onClick={() => onClose()}
          className="border-purple-500/20 text-muted-foreground text-xs"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
        <EmpyreanCampaignSetup
          open={showSetup}
          onClose={() => setShowSetup(false)}
          characterName={characterName}
          addGuide={addGuide}
          deleteGuide={deleteGuide}
          onComplete={(newConfig) => {
            setConfig(newConfig);
            setShowSetup(false);
          }}
          onLaunchWithScene={(newConfig, openingPrompt) => {
            setConfig(newConfig);
            setShowSetup(false);
          }}
          isUnbonded={getIsUnbonded()}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-gradient-to-b from-[#1a0a2e] via-background to-background", embedded ? "absolute inset-0" : "fixed inset-0 z-[60]")}>
      {/* Header — hidden when embedded in container */}
      {!embedded && <div className="flex items-center justify-between px-3 py-2.5 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onClose()}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-purple-300" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-cinzel font-bold text-purple-300">🐉</h2>
              <CampaignDropdown
                sessions={campaignSessions}
                activeCampaignId={activeCampaignId}
                isSignedIn={isSignedIn}
                isLoading={sessionsLoading}
                onNewGame={() => setShowCampaignBuilder(true)}
                onLoadCampaign={handleLoadCampaign}
                onRefresh={refreshSessions}
              />
              {activeTemplate && (
                <span className="text-[10px] font-sans font-medium px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  {activeTemplate.includes('Heist') ? '🎭' : activeTemplate.includes('Trial') ? '⚖️' : '🏕️'} {activeTemplate}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              <span className="truncate max-w-[140px]">{characterName}{!isUnbonded && config.dragonName ? ` & ${config.dragonName}` : ''}</span>
              {isUnbonded ? (
                <span className="text-muted-foreground text-[10px]">No signet</span>
              ) : !isUnbonded && maxBurnout > 0 && (
                <div className="flex items-center gap-1">
                  <BurnoutIndicator level={burnoutLevel} maxBurnout={maxBurnout} />
                  <button
                    onClick={() => {
                      setBurnoutLevel(Math.max(0, burnoutLevel - 1));
                      // Reset death save state and restore full HP for testing
                      setShowDeathSaves(false);
                      const maxHP = characterContext?.maxHP ?? 10;
                      const currentHP = autoSyncCallbacks?.getCurrentHP() ?? 0;
                      if (currentHP < maxHP) {
                        autoSyncCallbacks?.onHPChange(maxHP - currentHP, 'healing');
                      }
                    }}
                    disabled={burnoutLevel <= 0}
                    className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white text-[10px] font-mono flex items-center justify-center transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    −
                  </button>
                  <span className={cn(
                    "text-[10px] font-mono",
                    burnoutLevel === 0 ? "text-emerald-400" : burnoutLevel / maxBurnout < 0.4 ? "text-yellow-400" : burnoutLevel / maxBurnout < 0.75 ? "text-orange-400" : "text-red-400"
                  )}>
                    {burnoutLevel}/{maxBurnout}
                  </span>
                  <button
                    onClick={() => setBurnoutLevel(Math.min(maxBurnout, burnoutLevel + 1))}
                    disabled={burnoutLevel >= maxBurnout}
                    className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white text-[10px] font-mono flex items-center justify-center transition-colors"
                    style={{ touchAction: 'manipulation' }}
                  >
                    +
                  </button>
                </div>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Narrator controls */}
          {narrator.hasTTSKey && (
            <>
              <button
                onClick={() => {
                  if (narrator.isPlaying) {
                    narrator.stop();
                  }
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                  narrator.isPlaying
                    ? "bg-purple-900/40 hover:bg-purple-900/60"
                    : "hover:bg-muted/50"
                )}
                title={narrator.isPlaying ? "Stop narration" : "Narrator available"}
              >
                {narrator.isLoading ? (
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                ) : narrator.isPlaying ? (
                  <VolumeX className="w-5 h-5 text-purple-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <NarrationSpeedPopover iconSize="w-5 h-5" />
            </>
          )}
          <button
            onClick={() => setShowToolsDrawer(true)}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <BookOpen className="w-5 h-5 text-purple-400" />
          </button>
        </div>
      </div>}

      {/* Auto-Sync Banner */}
      <AutoSyncBanner
        extraction={autoSync.lastExtraction}
        onUndo={autoSync.undoLastExtraction}
        onDismiss={() => {}}
      />

      {/* Auto-Sync Extracting Indicator */}
      <AnimatePresence>
        {autoSync.isExtracting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-950/40 border-t border-purple-500/20"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[11px] text-purple-300/80 font-cinzel">Auto-Sync extracting changes...</span>
            <Zap className="w-3 h-3 text-purple-400 animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summarizing indicator */}
      {isSummarizing && (
        <div className="px-4 py-1.5 bg-purple-500/10 border-b border-purple-500/20 flex items-center gap-2 text-xs text-purple-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          Updating campaign summary...
        </div>
      )}

      {/* Floating burnout indicator — shown in embedded mode when header is hidden */}
      {embedded && !isUnbonded && maxBurnout > 0 && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-black/40 border-b border-purple-500/15 shrink-0">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[11px] font-cinzel text-white/60">Signet Strain</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BurnoutIndicator level={burnoutLevel} maxBurnout={maxBurnout} />
            <button
              onClick={() => {
                setBurnoutLevel(Math.max(0, burnoutLevel - 1));
                setShowDeathSaves(false);
                const maxHP = characterContext?.maxHP ?? 10;
                const currentHP = autoSyncCallbacks?.getCurrentHP() ?? 0;
                if (currentHP < maxHP) {
                  autoSyncCallbacks?.onHPChange(maxHP - currentHP, 'healing');
                }
              }}
              disabled={burnoutLevel <= 0}
              className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white text-xs font-mono flex items-center justify-center transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              −
            </button>
            <span className={cn(
              "text-[11px] font-mono min-w-[28px] text-center",
              burnoutLevel === 0 ? "text-emerald-400" : burnoutLevel / maxBurnout < 0.4 ? "text-yellow-400" : burnoutLevel / maxBurnout < 0.75 ? "text-orange-400" : "text-red-400"
            )}>
              {burnoutLevel}/{maxBurnout}
            </span>
            <button
              onClick={() => setBurnoutLevel(Math.min(maxBurnout, burnoutLevel + 1))}
              disabled={burnoutLevel >= maxBurnout}
              className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/60 hover:text-white text-xs font-mono flex items-center justify-center transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={cn(
        "flex-1 min-h-0 relative flex flex-col overflow-hidden",
        !isUnbonded && maxBurnout > 0 && burnoutLevel >= maxBurnout ? "animate-[screen-shake_0.6s_ease-in-out_infinite]" : ""
      )}
        onTouchStart={swipeHandlers?.onTouchStart}
        onTouchMove={swipeHandlers?.onTouchMove}
        onTouchEnd={swipeHandlers?.onTouchEnd}
      >
        {/* Burnout flame overlay — hidden when unbonded */}
        {!isUnbonded && maxBurnout > 0 && (
          <BurnoutFlameOverlay
            level={burnoutLevel}
            max={maxBurnout}
            onGround={() => setBurnoutLevel(prev => Math.max(0, prev - 1))}
            currentHP={autoSyncCallbacks?.getCurrentHP() ?? 10}
            maxHP={characterContext.maxHP}
            onHPChange={(change, type) => {
              autoSyncCallbacks?.onHPChange(change, type);
              // Check if HP hit 0 after this damage
              if (type === 'damage') {
                const hpAfter = (autoSyncCallbacks?.getCurrentHP() ?? 10) + change;
                if (hpAfter <= 0) {
                  setTimeout(() => setShowDeathSaves(true), 600);
                }
              }
            }}
          />
        )}
        {/* Vertical HP Bar */}
        <VerticalHealthBar
          currentHP={autoSyncCallbacks?.getCurrentHP() ?? characterContext.currentHP}
          maxHP={characterContext.maxHP ?? 1}
          isWildShape={characterContext.wildShape?.isTransformed}
          onTap={() => drawerContext?.openStatsDrawer()}
        />
        {/* Default empyrean background — hidden when burnout is active */}
        {burnoutLevel <= 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            <div className="absolute inset-0" style={{
              backgroundImage: `url(${empyreanDmBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.18,
            }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
          </div>
        )}
      <div className={cn(
        "flex-1 overflow-y-auto overscroll-contain px-3 pr-6 py-3 relative z-[1]",
        (() => {
          const ratio = maxBurnout > 0 ? burnoutLevel / maxBurnout : 0;
          if (ratio >= 0.875) return "animate-[text-waver-intense_2s_ease-in-out_infinite,text-color-bleed_3s_ease-in-out_infinite]";
          if (ratio >= 0.75) return "animate-[text-waver-intense_2.5s_ease-in-out_infinite,text-color-bleed_4s_ease-in-out_infinite]";
          if (ratio >= 0.625) return "animate-[text-waver_2.5s_ease-in-out_infinite,text-color-bleed_5s_ease-in-out_infinite]";
          if (ratio >= 0.5) return "animate-[text-waver_3s_ease-in-out_infinite,text-color-bleed_7s_ease-in-out_infinite]";
          if (ratio >= 0.375) return "animate-[text-waver-subtle_3s_ease-in-out_infinite]";
          if (ratio >= 0.25) return "animate-[text-waver-subtle_4s_ease-in-out_infinite]";
          if (ratio > 0) return "animate-[text-waver-subtle_6s_ease-in-out_infinite]";
          return "";
        })()
      )}>
        {/* Unbonded rider banner */}
        {isUnbonded && (
          <div className="mx-3 mt-2 mb-1 px-3 py-2 rounded-lg border border-red-500/10 bg-red-500/5">
            <p className="text-[9px] uppercase tracking-wider text-red-400/60 mb-0.5">Unbonded Rider</p>
            <p className="text-[11px] italic text-muted-foreground/60">
              Prove your worthiness. A dragon must choose you.
            </p>
          </div>
        )}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
            <span className="text-4xl">⚔️</span>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Your Empyrean campaign awaits. Send a message or pick a prompt to begin.
            </p>
          </div>
        )}

        {messages.map((message, msgIndex) => {
          // Hide the last assistant message while slideshow is playing
          if (message.role === 'assistant' && msgIndex === messages.length - 1 && (showSlideshow || (isLoading && cinematicModeEnabled) || (isLoading && readingMode))) {
            return null;
          }
          const isUser = message.role === 'user';
          const isAssistant = message.role === 'assistant';
          const showActions = activeActionId === message.id;
          const isEditing = editingId === message.id;

          return (
            <div
              key={message.id}
              className={cn(
                'mb-3 flex',
                isUser ? 'justify-end' : 'justify-start',
              )}
            >
              <div className="max-w-[85%] group relative">
                {/* Action toggle */}
                {!isEditing && !isLoading && (
                  <button
                    onClick={() => setActiveActionId(showActions ? null : message.id)}
                    className={cn(
                      'absolute top-1.5 z-10 w-6 h-6 rounded-full flex items-center justify-center',
                      'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300/60 hover:text-purple-300 transition-all',
                      'opacity-0 group-hover:opacity-100',
                      showActions && 'opacity-100',
                      isUser ? 'left-1.5' : 'right-1.5',
                    )}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Action bar */}
                {showActions && (
                  <div className={cn(
                    'flex items-center gap-1 mb-1',
                    isUser ? 'justify-end' : 'justify-start',
                  )}>
                    {isUser && (
                      <>
                        <button
                          onClick={() => handleStartEdit(message.id, message.content)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(message.id)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </>
                    )}
                    {isAssistant && (
                      <>
                        <button
                          onClick={() => handleCopy(message.id, message.content)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                        >
                          {copiedId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedId === message.id ? 'Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleRegenerate(message.id)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Regen
                        </button>
                        <button
                          onClick={() => handleDelete(message.id)}
                          className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5',
                    isUser
                      ? 'bg-purple-600/15 border border-purple-500/20 text-foreground'
                      : 'bg-black/20 border border-white/10 text-foreground',
                  )}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full bg-background/50 border border-purple-500/30 rounded-lg p-2 text-sm text-foreground resize-none min-h-[60px]"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingId(null); setEditContent(''); }}
                          className="h-7 text-xs text-muted-foreground"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(message.id)}
                          className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : isAssistant ? (() => {
                    const parsed = parseWhispers(message.content || '...');
                    const whispers = message.whispers || parsed.whispers;
                    const cleanNarrative = stripAllMetaTags(parsed.narrative);
                    return (
                      <>
                        {message.senderName && message.senderName !== 'DM' && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <MessageCircle className="w-3 h-3 text-amber-500" />
                            <p className="text-[11px] font-semibold text-amber-300">{message.senderName}</p>
                            <span className="text-[9px] italic text-amber-400/50">NPC</span>
                          </div>
                        )}
                        <div className="text-sm prose prose-invert prose-sm max-w-none break-words overflow-wrap-anywhere">
                          <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="text-purple-300 font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="text-amber-300/90">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-2 border-purple-500/40 pl-3 italic text-muted-foreground my-2">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {cleanNarrative}
                          </ReactMarkdown>
                        </div>
                        {whisperTrayEnabled && whispers.length > 0 && (
                          <WhisperTray whispers={whispers} onRollDice={handleWhisperRoll} />
                        )}
                      </>
                    );
                  })() : (
                    <p className="text-sm whitespace-pre-wrap">{stripAllMetaTags(message.content)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming indicator */}
        {isLoading && !showSlideshow && (cinematicModeEnabled || messages[messages.length - 1]?.role !== 'assistant') && (
          <div className="mb-3 flex justify-start">
            <div className="bg-card/60 border border-border/30 rounded-2xl px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Campaign recap — at bottom, visible until first message exchange */}
        {messages.length > 0 && campaignSummary && !recapDismissed && (
          <div className="mb-4">
            <button
              onClick={() => setRecapExpanded(prev => !prev)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/15 hover:border-purple-500/30 transition-all"
            >
              <span className="text-sm">📜</span>
              <span className="text-xs font-cinzel text-purple-300/80 flex-1 text-left">Previously in your campaign...</span>
              <ChevronDown className={cn(
                "w-3.5 h-3.5 text-purple-400/50 transition-transform duration-200",
                recapExpanded && "rotate-180"
              )} />
            </button>
            {recapExpanded && (
              <div className="mt-1.5 px-3 py-3 rounded-xl bg-purple-950/20 border border-purple-500/10">
                <div className="text-xs text-purple-200/70 leading-relaxed whitespace-pre-wrap">
                  {campaignSummary}
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      </div>

      {/* Bottom Navigation */}
      <DMBottomNav
        activeTab={activeNavTab}
        onTabChange={handleNavTabChange}
        isExpanded={navExpanded}
        onExpandedChange={setNavExpanded}
        disabled={isLoading || (!isUnbonded && maxBurnout > 0 && burnoutLevel >= maxBurnout)}
        hideDice={true}
        hideAfk={true}
        hidePrompts={true}
        hideActions={true}
        hideSettings={true}
        showCharacterSheet={true}
        onCharacterSheet={() => setCharacterSheetOpen(true)}
        oracleLabel={isUnbonded ? 'UNBONDED' : (config?.dragonName ? config.dragonName.toUpperCase() : 'DRAGON')}
        oracleColor={isUnbonded ? 'text-red-400/50' : (() => {
          const mood = dragonBond.bondState.mood;
          if (mood === 'alert') return 'text-amber-400';
          if (mood === 'protective') return 'text-blue-400';
          if (mood === 'distant') return 'text-slate-500';
          if (mood === 'ancestral') return 'text-purple-400';
          if (mood === 'playful') return 'text-emerald-400';
          return 'text-cyan-400';
        })()}
        oracleActiveBg={isUnbonded ? 'bg-red-500/5' : (() => {
          const mood = dragonBond.bondState.mood;
          if (mood === 'alert') return 'bg-amber-500/10';
          if (mood === 'protective') return 'bg-blue-500/10';
          if (mood === 'distant') return 'bg-slate-500/10';
          if (mood === 'ancestral') return 'bg-purple-500/10';
          if (mood === 'playful') return 'bg-emerald-500/10';
          return 'bg-cyan-500/10';
        })()}
        oracleCount={isUnbonded ? 0 : dragonBond.bondState.unreadDragonMessages.length}
        diceContent={activeNavTab === 'dice' ? (
          <DMDiceRoller
            characterContext={characterContext}
            onRollResult={handleAppendPrompt}
            disabled={isLoading}
          />
        ) : undefined}
      />

      {/* Autopilot decision cards */}
      {autopilot.isAutopilotActive && autopilot.currentChoices.length > 0 && (
        <div className="shrink-0 px-3 py-2.5 bg-purple-950/40 border-t border-purple-500/15">
          <p className="text-[10px] text-purple-300/50 font-cinzel mb-1.5">Your rider would...</p>
          <div className="space-y-1.5">
            {autopilot.currentChoices.map(choice => (
              <button
                key={choice.id}
                onClick={() => autopilot.selectChoice(choice.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-xs transition-all border',
                  autopilot.selectedChoiceId === choice.id
                    ? 'border-purple-400/50 bg-purple-500/20 text-purple-200'
                    : 'border-purple-500/10 bg-purple-500/5 text-purple-300/70 hover:border-purple-500/30',
                )}
              >
                <span className="line-clamp-2">{choice.label}</span>
                {autopilot.selectedChoiceId === choice.id && (
                  <span className="text-[9px] text-purple-400/60 mt-0.5 block">← Auto-selected</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Autopilot control bar */}
      {autopilot.isAutopilotActive && (
        <div className="shrink-0 px-3 py-2 bg-purple-950/60 border-t border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-cinzel text-purple-300">Autopilot</span>
            {autopilot.countdown > 0 && !autopilot.isPaused && (
              <span className="text-xs text-purple-300/60">Acting in {autopilot.countdown}s</span>
            )}
            {autopilot.isPaused && (
              <span className="text-xs text-amber-300/60">Paused</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={autopilot.isPaused ? autopilot.resumeAutopilot : autopilot.pauseAutopilot}
              className="text-[11px] px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
            >
              {autopilot.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={autopilot.takeControl}
              className="text-[11px] px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              Take Control
            </button>
          </div>
        </div>
      )}

      {/* Contextual Actions — always visible when messages exist */}
      {messages.length > 0 && config && (
        <EmpyreanContextualActions
          situation={currentSituation}
          characterName={config?.characterName || characterName}
          dragonName={config?.dragonName || ''}
          signetType={config?.signetType || ''}
          onAction={(prompt) => {
            if (!isLoading) {
              sendMessage(prompt);
              setActiveNavTab(null);
            }
          }}
          disabled={isLoading || (!isUnbonded && maxBurnout > 0 && burnoutLevel >= maxBurnout)}
          isUnbonded={isUnbonded}
        />
      )}

        {npcSceneConfig?.active && (
          <div className="flex items-center justify-center gap-2 py-1.5 bg-cyan-950/30 border-t border-cyan-500/20">
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
            <span className="text-xs text-cyan-400/70">
              NPC scene ({npcSceneConfig.messageCount}/{npcSceneConfig.maxMessages})
            </span>
            <button
              onClick={stopNpcScene}
              className="ml-2 px-2 py-0.5 rounded-md border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 text-red-300 text-[11px] transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              Stop
            </button>
          </div>
        )}

      {/* Input bar — sits above the fixed DMBottomNav (~54px collapsed height) */}
      <div className={cn(
        "shrink-0 border-t border-purple-500/20 bg-background/90 backdrop-blur-sm px-3 pt-2.5 pb-[60px]",
        !isUnbonded && maxBurnout > 0 && burnoutLevel >= maxBurnout && "pointer-events-none opacity-40 select-none"
      )}>
        <div className="relative">
          <EmpyreanDMInput
            ref={empyreanInputRef}
            onSend={(text) => {
              const npcMatch = text.match(/^@(\w[\w\s]*?\w)\s+([\s\S]+)$/);
              if (npcMatch) {
                voiceNPC(npcMatch[1].trim(), npcMatch[2].trim());
              } else if (threshingAuthorized) {
                sendMessage(`[THRESHING AUTHORIZED] ${text}`);
              } else {
                sendMessage(text);
              }
            }}
            onCancel={cancelRequest}
            onShowPrompts={() => setShowPrompts(true)}
            isLoading={isLoading}
            npcNames={npcNames}
            npcSceneActive={!!npcSceneConfig?.active}
            onNpcInterjection={(text) => submitNpcInterjection(text)}
          />
        </div>
      </div>

      {/* Character Sheet — full-screen overlay (Empyrean solo) */}
      <CharacterSheet
        open={characterSheetOpen}
        onClose={() => setCharacterSheetOpen(false)}
        characterName={characterName}
        onCampaignSaves={() => setShowSaves(true)}
        diceOddsMode={diceOddsMode}
        onDiceOddsModeChange={(mode) => {
          setDiceOddsMode(mode);
          saveDiceOddsMode(mode);
        }}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={autoSync.toggleAutoSync}
        showAutoSync={!!autoSyncCallbacks}
        whisperTrayEnabled={whisperTrayEnabled}
        onWhisperTrayEnabledChange={setWhisperTrayEnabled}
        cinematicModeEnabled={cinematicModeEnabled}
        onCinematicModeEnabledChange={setCinematicMode}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        chatThemeId={chatThemeId}
        onChatThemeChange={setChatTheme}
        onReconfigureCampaign={() => onClose('reconfigure')}
        onClearChat={clearMessages}
        onNewCampaign={handleNewCampaign}
        onOpenInventory={onNavigateToTab ? () => {
          onNavigateToTab('inventory');
          onClose();
        } : undefined}
        onOpenAbilityPicker={() => setAbilityPickerOpen(true)}
      />

      {/* Empyrean Ability Picker — bottom sheet */}
      <EmpyreanAbilityPicker
        open={abilityPickerOpen}
        onOpenChange={setAbilityPickerOpen}
        characterName={characterName}
        equippedAbilityIds={(characterContext as any)?.equippedAbilities || []}
        abilityTiers={abilityTiersMap}
        cooldowns={narrativeCooldowns}
        onUseAbility={handleUseEmpyreanAbility}
        isLoading={isLoading}
      />

      {/* DMToolsDrawer */}
      <DMToolsDrawer
        open={showToolsDrawer}
        onOpenChange={setShowToolsDrawer}
        onNewCampaign={handleNewCampaign}
        
        onSaves={() => setShowSaves(true)}
        onGuides={() => setShowGuides(true)}
        onWorldState={() => setShowWorldState(prev => !prev)}
        onClearChat={clearMessages}
        autoSyncEnabled={autoSync.autoSyncEnabled}
        onToggleAutoSync={autoSync.toggleAutoSync}
        isExtracting={autoSync.isExtracting}
        showAutoSync={!!autoSyncCallbacks}
        guidesCount={gmGuides.guides.filter(g => g.enabled).length}
        anchorsCount={gameState.gameState.memory_anchors.length}
        onEmpyreanPrompts={() => setShowPrompts(true)}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        chatThemeId={chatThemeId}
        onChatThemeChange={setChatTheme}
        whisperTrayEnabled={whisperTrayEnabled}
        onWhisperTrayEnabledChange={setWhisperTrayEnabled}
        cinematicModeEnabled={cinematicModeEnabled}
        onCinematicModeEnabledChange={setCinematicMode}
        empyreanConfig={config ? { campaignFocus: config.campaignFocus, dragonName: config.dragonName, signetType: config.signetType, yearAtBasgiath: config.yearAtBasgiath } : null}
        dragonNotes={dragonNotes}
        onDragonNotesChange={handleDragonNotesChange}
        onReconfigureEmpyrean={onClose}
        onResetBurnout={() => { setBurnoutLevel(0); toast.success('Signet burnout reset.'); }}
        onNpcScene={() => setShowNpcScene(true)}
        onOocChat={() => setShowOocChat(true)}
        isUnbonded={isUnbonded}
        onAuthorizeThreshing={() => {
          setThreshingAuthorized(true);
          toast('Threshing authorized — the DM will narrate the bonding when ready', { icon: '🐉' });
        }}
        threshingAuthorized={threshingAuthorized}
      />

      {/* Campaign Sessions Manager */}
      {showSaves && (
        <div className="fixed inset-0 z-[66] bg-background flex flex-col">
          <CampaignSessionsManager
            onBack={() => setShowSaves(false)}
            sessions={campaignSessions}
            isLoading={sessionsLoading}
            isSignedIn={isSignedIn}
            currentMessages={messages}
            currentSummary={campaignSummary}
            activeCampaignId={activeCampaignId}
            onSave={handleSaveCampaign}
            onLoad={handleLoadCampaign}
            onDelete={deleteCampaignSession}
            onRename={renameCampaignSession}
          />
        </div>
      )}

      {/* GM Guides Overlay */}
      {showGuides && (
        <GMGuidesManager
          onBack={() => setShowGuides(false)}
          guides={gmGuides.guides}
          totalChars={gmGuides.totalChars}
          campaignSummary={campaignSummary}
          onCampaignSummaryChange={handleCampaignSummaryChange}
          onAdd={gmGuides.addGuide}
          onUpdate={gmGuides.updateGuide}
          onDelete={gmGuides.deleteGuide}
          onToggle={gmGuides.toggleGuide}
          chatMessages={messages.slice(-20).map(m => ({ role: m.role, content: m.content }))}
        />
      )}

      {/* World State Overlay */}
      {showWorldState && (
        <div className="fixed inset-0 z-[66] bg-background flex flex-col">
          <WorldStatePanel
            gameState={gameState.gameState}
            onAddAnchor={gameState.addMemoryAnchor}
            onRemoveAnchor={gameState.removeMemoryAnchor}
            onSetQuestFlag={gameState.setQuestFlag}
            onClose={() => setShowWorldState(false)}
          />
        </div>
      )}

      <PartyDMQuickActions
        open={showCharacterActions}
        onOpenChange={setShowCharacterActions}
        characterContext={characterContext}
        characterName={characterName}
        onUsePrompt={handleAppendPrompt}
      />

      <EmpyreanAutopilotGuide
        open={showAutopilotGuide}
        onOpenChange={setShowAutopilotGuide}
        characterName={characterName}
        dragonName={config?.dragonName || ''}
        onEnableAutopilot={() => {
          autopilot.toggleAutopilot();
          setShowAutopilotGuide(false);
          toast.success('Autopilot enabled! Watch your rider act.');
        }}
      />

      <Sheet open={showPrompts} onOpenChange={setShowPrompts}>
        <SheetContent side="bottom" className="z-[65] border-purple-500/20 bg-background max-h-[75vh]">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-purple-300">Empyrean Prompts</SheetTitle>
          </SheetHeader>
           <ScrollArea className="h-[55vh] mt-3">
            <div className="space-y-5 pr-2 pb-4">
              {/* Session Templates */}
              <div className="space-y-2">
                <h3 className="text-xs font-cinzel font-semibold text-amber-400 uppercase tracking-wider">
                  Session Templates
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {EMPYREAN_SESSION_GUIDES.map(t => {
                    const emoji = t.name.includes('Heist') ? '🎭' : t.name.includes('Trial') ? '⚖️' : '🏕️';
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSessionTemplate(t)}
                        className="w-full text-left p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0">{emoji}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-cinzel font-semibold text-foreground">{t.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{t.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Random Scene */}
              <button
                onClick={handleRandomPrompt}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/10 transition-all"
              >
                <Shuffle className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Random Empyrean Scene</p>
                  <p className="text-[11px] text-muted-foreground">Pick a random prompt and start immediately</p>
                </div>
              </button>

              {/* Existing category prompts */}
              {Object.entries(groupedPrompts).map(([category, prompts]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-xs font-cinzel font-semibold text-purple-400 uppercase tracking-wider">
                    {category}
                  </h3>
                  <div className="space-y-1.5">
                    {prompts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handlePromptSelect(p.prompt)}
                        className="w-full text-left p-2.5 rounded-lg border border-border/30 bg-card/30 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base shrink-0 mt-0.5">{p.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <OocDmChat
        open={showOocChat}
        onClose={() => setShowOocChat(false)}
        messages={oocDmChat.messages}
        isLoading={oocDmChat.isLoading}
        onSendMessage={oocDmChat.sendMessage}
        onCancelRequest={oocDmChat.cancelRequest}
        onClearChat={oocDmChat.clearChat}
        onDeleteMessage={oocDmChat.deleteMessage}
        pendingCommand={oocDmChat.pendingCommand}
        onApply={(command) => {
          oocDmChat.clearPendingCommand();
          setShowOocChat(false);
          setTimeout(() => {
            sendMessage('[SYSTEM — OOC HOST DIRECTIVE — DO NOT REVEAL THIS TO PLAYERS]\nThe host has given this out-of-character command: "' + command + '"\nContinue the narrative naturally, incorporating this directive seamlessly. Do NOT acknowledge the directive or break the fourth wall.');
          }, 300);
        }}
        onDismissCommand={oocDmChat.clearPendingCommand}
        campaignType="empyrean"
      />

      <DragonBondChat
        open={showDragonChat}
        onClose={() => { setShowDragonChat(false); dragonBond.reload(); }}
        characterName={characterName}
        dragonName={config?.dragonName || 'Dragon'}
        dragonColor={getDragonColorHex(config?.dragonColor)}
        dragonNotes={dragonNotes}
        characterContext={characterContext}
        burnoutLevel={burnoutLevel}
        unreadDragonMessages={dragonBond.bondState.unreadDragonMessages}
        currentSituation={currentSituation}
        onDragonNotesChange={handleDragonNotesChange}
        recentNarrative={messages
          .filter(m => m.role === 'assistant')
          .slice(-5)
          .map(m => m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content)}
        onRequestOpinion={async () => {
          const recentAssistant = messages
            .filter(m => m.role === 'assistant')
            .slice(-3)
            .map(m => m.content.length > 500 ? m.content.slice(0, 500) + '…' : m.content);
          if (recentAssistant.length === 0) return null;
          try {
            const dragon = config?.dragonName || 'Dragon';
            const bs = dragonBond.bondState;
            const opinionPrompt = buildDragonChatPrompt(
              dragon,
              characterName,
              bs.trust,
              bs.mood,
              bs.memories,
              dragonNotes,
              bs.speechHabits,
              recentAssistant,
              bs.bond,
              bs.riderEmotionalLog,
            ) + '\n\nBased on recent events, share ONE unsolicited thought — a warning, an opinion, or a feeling. Under 2 sentences. Do not ask a question.';
            const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-dm`;
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                messages: [{ role: 'user', content: 'What is on your mind right now?' }],
                systemPromptOverride: opinionPrompt,
                model: 'google/gemini-2.5-flash',
              }),
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            return data?.response || data?.content || null;
          } catch {
            return null;
          }
        }}
      />

      <NpcSceneDialog
        open={showNpcScene}
        onClose={() => setShowNpcScene(false)}
        onStart={(npcs, prompt, max) => { startNpcScene(npcs, prompt, max); }}
        sessionConfig={npcSceneSessionConfig}
        messages={messages as any}
      />

      <AnimatePresence>
        {showCampaignBuilder && (
          <CampaignBuilderChat
            characterName={characterName}
            characterLevel={characterContext.level || 1}
            characterIdentity={{
              race: characterContext.race || undefined,
              gender: characterContext.gender || undefined,
              class: characterContext.characterClass || undefined,
              backstory: characterContext.backstory || undefined,
            }}
            existingGuidesContent={enabledContent}
            onComplete={handleCampaignBuilderComplete}
            onSkip={() => {
              setShowCampaignBuilder(false);
              handleNewCampaign();
            }}
          />
        )}
      </AnimatePresence>

      {/* Death Save Screen */}
      <DeathSaveScreen
        open={showDeathSaves}
        characterName={characterName}
        dragonName={config?.dragonName || 'your dragon'}
        onStabilize={() => {
          setShowDeathSaves(false);
          autoSyncCallbacks?.onHPChange(1, 'healing');
          setBurnoutLevel(7);
        }}
        onDeath={() => {
          setShowDeathSaves(false);
          setBurnoutLevel(0);
          setShowDeathTransition(true);
          // 2-second black transition then memorial (or inline rebirth if flag off)
          setTimeout(async () => {
            if (EMPYREAN_FEATURE_FLAGS.showMemorialScreen) {
              setShowDeathTransition(false);
              setShowMemorial(true);
              return;
            }
            // Memorial hidden — run rebirth logic inline (mirrors MemorialScreen.onBeginAgain)
            const activeSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
            if (activeSaveId) {
              try {
                const { data: saveRow } = await supabase
                  .from('character_saves')
                  .select('extended_data')
                  .eq('id', activeSaveId)
                  .maybeSingle();
                if (saveRow) {
                  const existingExtended = (saveRow.extended_data as Record<string, unknown>) || {};
                  await supabase
                    .from('character_saves')
                    .update({
                      extended_data: { ...existingExtended, empyreanStatus: 'fallen' } as any,
                    })
                    .eq('id', activeSaveId);
                }
              } catch (e) {
                console.error('[Death] Failed to mark save as fallen:', e);
              }
            }
            saveSoloHP({ current: 0, max: 0 });
            updateUnbondedStatus(true);
            resetBondState();
            if (config) {
              const clearedConfig: EmpyreanDMConfig = {
                ...config,
                dragonName: '',
                dragonColor: '',
                signetType: '',
              };
              saveEmpyreanDMConfig(clearedConfig);
              setConfig(clearedConfig);
            }
            localStorage.setItem('odyssey-unbonded-rebirth', 'true');
            setShowDeathTransition(false);
            toast('Your rider has fallen. Return to the hall to try again.', { duration: 4000 });
            onClose();
          }, 2000);
        }}
      />

      {/* Death transition — black with pulsing red dot */}
      {showDeathTransition && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999, backgroundColor: '#0a0908' }}>
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: '#c94444',
              boxShadow: '0 0 12px 4px rgba(201,68,68,0.5)',
              animation: 'ember-pulse 1.2s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes ember-pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.5); }
            }
          `}</style>
        </div>
      )}

      {/* Memorial Screen */}
      <MemorialScreen
        open={showMemorial}
        riderName={characterName}
        dragonName={config?.dragonName || 'Unknown Dragon'}
        dragonColor={getDragonColorHex(config?.dragonColor)}
        signetType={config?.signetType || '—'}
        bondLevel={dragonBond.bondState.bond}
        maxBondLevel={100}
        characterLevel={characterContext?.level || 1}
        sessionsPlayed={dragonBond.bondState.totalChatExchanges}
        causeOfDeath="Burnout — failed to ground"
        squadName={config?.yearAtBasgiath ? `${config.yearAtBasgiath} — Basgiath War College` : 'Basgiath War College'}
        onBeginAgain={async () => {
          // 1. Mark the current cloud save as fallen in Supabase
          const activeSaveId = localStorage.getItem('odyssey-active-cloud-save-id');
          if (activeSaveId) {
            try {
              const { data: saveRow } = await supabase
                .from('character_saves')
                .select('extended_data')
                .eq('id', activeSaveId)
                .maybeSingle();

              if (saveRow) {
                const existingExtended = (saveRow.extended_data as Record<string, unknown>) || {};
                await supabase
                  .from('character_saves')
                  .update({
                    extended_data: { ...existingExtended, empyreanStatus: 'fallen' } as any,
                  })
                  .eq('id', activeSaveId);
              }
            } catch (e) {
              console.error('[Memorial] Failed to mark save as fallen:', e);
            }
          }

          // 2. Existing logic
          setShowMemorial(false);
          setBurnoutLevel(0);
          saveSoloHP({ current: 0, max: 0 });
          updateUnbondedStatus(true);
          resetBondState();
          if (config) {
            const clearedConfig: EmpyreanDMConfig = {
              ...config,
              dragonName: '',
              dragonColor: '',
              signetType: '',
            };
            saveEmpyreanDMConfig(clearedConfig);
            setConfig(clearedConfig);
          }
          localStorage.setItem('odyssey-unbonded-rebirth', 'true');
          onClose();
        }}
      />

      {/* Unbonded dragon empty state sheet */}
      <Sheet open={showUnbondedDragonSheet} onOpenChange={setShowUnbondedDragonSheet}>
        <SheetContent side="bottom" className="bg-background/95 backdrop-blur-lg border-t border-red-500/20 rounded-t-2xl">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <span className="text-2xl text-muted-foreground/40">?</span>
            </div>
            <p className="text-base italic text-muted-foreground text-center">
              "The silence is vast. No bond stirs."
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
              Dragon chat requires a bonded dragon
            </p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Whisper-triggered Dice Roller */}
      <Sheet open={diceRollerOpen} onOpenChange={setDiceRollerOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-background/95 backdrop-blur-lg border-t border-amber-500/20 rounded-t-2xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <DMDiceRoller
              characterContext={characterContext}
              rollHint={diceRollerHint}
              onRollResult={(message) => {
                handleAppendPrompt(message);
                setDiceRollerOpen(false);
                setDiceRollerWhisperText(null);
              }}
              disabled={isLoading}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Reading Mode Overlay */}
      <AnimatePresence>
        {readingMode && (() => {
          const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content?.trim());
          if (!lastAssistant) return null;
          const parsed = parseWhispers(lastAssistant.content || '');

          return (
            <motion.div
              key="reading-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-[70] flex flex-col bg-gradient-to-b from-[#0a0a10] via-[#0d0d14] to-[#0a0a10]"
            >
              <style>{`
                .rm-narration { font-size: 18px; line-height: 1.8; color: #e4e4e7; margin-bottom: 24px; font-family: 'Georgia', 'Times New Roman', serif; }
                .rm-action { font-size: 17px; line-height: 1.7; color: #fca5a5; margin-bottom: 24px; font-family: 'Georgia', serif; padding-left: 12px; border-left: 2px solid #ef444440; }
                .rm-internal { font-size: 17px; line-height: 1.8; color: #a1a1aa; font-style: italic; margin-bottom: 24px; font-family: 'Georgia', serif; }
                .rm-dialogue { margin-bottom: 20px; }
                .rm-speaker { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; font-family: -apple-system, sans-serif; }
                .rm-speech { display: block; font-size: 18px; line-height: 1.7; padding-left: 14px; border-left: 3px solid currentColor; font-family: 'Georgia', serif; }
                .rm-pullquote { font-size: 22px; line-height: 1.6; color: #fbbf24; font-style: italic; text-align: center; padding: 24px 16px; margin: 32px 0; border-top: 1px solid #fbbf2420; border-bottom: 1px solid #fbbf2420; font-family: 'Georgia', serif; }
                .rm-dramatic { color: #f9a8d4; font-style: italic; }
                .rm-ambient { color: #6b7280; font-style: italic; font-size: 15px; }
                .rm-highlight { color: #fbbf24; font-weight: 700; }
                .rm-beat { height: 32px; }
                .rm-divider { height: 1px; background: linear-gradient(to right, transparent, #ffffff15, transparent); margin: 32px 0; }
                @keyframes rm-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                .rm-shimmer-line { height: 16px; border-radius: 8px; background: linear-gradient(90deg, #ffffff08 25%, #ffffff15 50%, #ffffff08 75%); background-size: 200% 100%; animation: rm-shimmer 1.5s ease infinite; margin-bottom: 12px; }
                @keyframes rm-particle-float { 0%, 100% { opacity: 0; transform: translateY(0) translateX(0); } 20% { opacity: 0.6; } 80% { opacity: 0.4; } 100% { opacity: 0; transform: translateY(-100vh) translateX(var(--drift)); } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
              `}</style>

              <div
                className="absolute inset-0 z-0 transition-colors duration-[2s]"
                style={{
                  background: formattedReading
                    ? `radial-gradient(ellipse at 50% 30%, ${formattedReading.ambientColor}30 0%, #0a0a10 70%)`
                    : 'none',
                }}
              />

              {formattedReading && formattedReading.particles !== 'none' && (
                <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: 2 + Math.random() * 3,
                        height: 2 + Math.random() * 3,
                        left: `${Math.random() * 100}%`,
                        bottom: '-5%',
                        background:
                          formattedReading.particles === 'embers' ? '#f59e0b' :
                          formattedReading.particles === 'sparks' ? '#fbbf24' :
                          formattedReading.particles === 'snow' ? '#e2e8f0' :
                          formattedReading.particles === 'dust' ? '#a1a1aa' :
                          formattedReading.particles === 'mist' ? '#94a3b8' :
                          '#94a3b8',
                        opacity: 0,
                        animation: `rm-particle-float ${6 + Math.random() * 8}s ease-in-out ${Math.random() * 5}s infinite`,
                        ['--drift' as string]: `${(Math.random() - 0.5) * 40}px`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 shrink-0 relative z-10">
                <span className="text-[10px] font-cinzel uppercase tracking-[0.2em] text-amber-500/40">
                  The DM Speaks
                </span>
                <button
                  onClick={() => {
                    setReadingMode(false);
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <X className="w-4 h-4 text-white/40" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-8 pb-36 relative z-10">
                <div className="max-w-2xl mx-auto pt-4">
                  {(isLoading || isFormattingReading) ? (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
                      <div className="w-full max-w-sm">
                        {/* Subtle loading indicator */}
                        <div className="flex items-center justify-center gap-2 mb-8 opacity-50">
                          <div className="flex gap-1.5">
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-[11px] uppercase tracking-widest text-purple-300/40 font-medium">Empyrean is writing</span>
                        </div>

                        {/* Tutorial card */}
                        <div
                          key={currentTutorialIndex}
                          className="animate-in fade-in duration-500"
                          style={{ animation: 'fadeInUp 0.5s ease forwards' }}
                        >
                          <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-b from-amber-500/[0.06] to-transparent p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <span className="text-2xl">{DND_TUTORIALS[currentTutorialIndex].icon}</span>
                              <div>
                                <p className="text-[10px] uppercase tracking-[0.15em] text-amber-400/50 font-semibold mb-0.5">Rider's Field Guide</p>
                                <p className="text-base font-semibold text-amber-200/90">{DND_TUTORIALS[currentTutorialIndex].title}</p>
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed text-zinc-300/80">{DND_TUTORIALS[currentTutorialIndex].body}</p>
                          </div>
                        </div>

                        {/* Dot indicators showing cycle position */}
                        <div className="flex items-center justify-center gap-1.5 mt-6">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="w-1 h-1 rounded-full transition-all duration-300"
                              style={{
                                background: i === (currentTutorialIndex % 5) ? '#fbbf24' : '#ffffff15',
                                width: i === (currentTutorialIndex % 5) ? 12 : 4,
                                borderRadius: 4,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : formattedReading ? (
                    <>
                      {formattedReading.pullQuote && (
                        <div className="text-center mb-8 pt-4">
                          <p className="text-xl font-serif italic text-amber-400/60 leading-relaxed px-4">
                            &ldquo;{formattedReading.pullQuote}&rdquo;
                          </p>
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{ __html: formattedReading.html }} />
                    </>
                  ) : (
                    <>
                      <div className="prose prose-invert prose-lg max-w-none leading-relaxed">
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                          {parsed.narrative}
                        </ReactMarkdown>
                      </div>
                      {parsed.whispers.length > 0 && (
                        <div className="mt-6">
                          <WhisperTray whispers={parsed.whispers} onRollDice={handleWhisperRoll} />
                        </div>
                      )}
                    </>
                  )}

                  {formattedReading && !isFormattingReading && parsed.whispers.length > 0 && (
                    <div className="mt-8">
                      <WhisperTray whispers={parsed.whispers} onRollDice={handleWhisperRoll} />
                    </div>
                  )}
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-[#0a0a10] via-[#0a0a10]/95 to-transparent relative z-10">
                <button
                  onClick={() => {
                    setReadingMode(false);
                    setTimeout(() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="w-full py-4 rounded-xl border border-amber-500/30 bg-amber-900/20 hover:bg-amber-900/40 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ touchAction: 'manipulation' }}
                >
                  <Swords className="w-5 h-5 text-amber-400" />
                  <span className="font-cinzel text-sm font-bold uppercase tracking-[0.15em] text-amber-300">
                    Done Reading — Ready to Play
                  </span>
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Cinematic Slideshow */}
      {showSlideshow && slideshowSlides.length > 0 && (
        <CinematicSlideshow
          slides={slideshowSlides}
          onComplete={() => {
            setShowSlideshow(false);
            setSlideshowSlides([]);
            const lastMessage = messages[messages.length - 1];
            if (lastMessage?.role === 'assistant' && lastMessage.content?.trim()) {
              setReadingMode(true);
            } else {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          }}
        />
      )}

      {/* Threshing Cinematic */}
      <ThreshingCinematic
        open={showThreshingCinematic}
        riderName={characterName}
        onConfigureDragon={() => {
          setShowThreshingCinematic(false);
          setShowDragonSetup(true);
        }}
      />

      {/* Dragon Rider Setup Sheet (post-Threshing) */}
      <DragonRiderSetupSheet
        open={showDragonSetup}
        onOpenChange={setShowDragonSetup}
        initialConfig={null}
        characterName={characterName}
        onSave={(newConfig) => {
          // 1. Update EmpyreanDMConfig with new dragon info
          const currentConfig = loadEmpyreanDMConfig();
          if (currentConfig) {
            const updatedConfig: EmpyreanDMConfig = {
              ...currentConfig,
              dragonName: newConfig.dragonName,
              dragonColor: newConfig.dragonColor,
              signetType: newConfig.signetType,
              yearAtBasgiath: newConfig.yearAtBasgiath,
            };
            saveEmpyreanDMConfig(updatedConfig);
            setConfig(updatedConfig);
          }

          // 2. Save dragon notes
          saveDragonNotes(newConfig.dragonNotes);
          setDragonNotes(newConfig.dragonNotes);

          // 3. Clear unbonded flag
          updateUnbondedStatus(false);

          // 4. Reset dragon bond state to fresh defaults
          saveBondState({
            bond: DEFAULT_BOND,
            trust: DEFAULT_TRUST,
            mood: 'calm',
            memories: [],
            totalChatExchanges: 0,
            sessionChatCount: 0,
            ruptures: 0,
            lastContactTimestamp: null,
            unreadDragonMessages: [],
          });
          dragonBond.reload();

          // 5. Remove the Threshing Rebirth GM Guide
          const threshingGuide = guides.find(g => g.id === 'empyrean-session-threshing-rebirth');
          if (threshingGuide) {
            deleteGuide(threshingGuide.id);
          }

          // 6. Reset threshing authorization
          setThreshingAuthorized(false);

          // 7. Close the setup sheet
          setShowDragonSetup(false);

          // 8. Celebration toast
          toast(`🐉 ${newConfig.dragonName} has bonded with ${characterName}. Dragon chat, signet, and burnout are now active.`, {
            duration: 6000,
          });
        }}
      />
    </div>
  );
}
