// DM Chat Visual Theme Definitions
// Each theme skins the solo DM chat with different colors, textures, and typography.

export type DMChatThemeId =
  | 'default'
  | 'parchment'
  | 'arcane-tome'
  | 'war-table'
  | 'dungeon-stone'
  | 'astral-plane'
  | 'blood-ink'
  | 'elvish-grove'
  | 'dragons-hoard'
  | 'basgiath-stone'
  | 'dragon-fire'
  | 'ward-line';

export interface DMChatTheme {
  id: DMChatThemeId;
  name: string;
  icon: string;
  description: string;
  /** Preview swatch colors [bg, accent, text] */
  swatch: [string, string, string];
  /** Chat scroll area background */
  chatBg: string;
  /** DM message bubble classes */
  dmBubble: string;
  /** DM message bubble inline styles (optional) */
  dmBubbleStyle?: React.CSSProperties;
  /** User message bubble classes */
  userBubble: string;
  /** DM avatar container classes */
  dmAvatar: string;
  /** DM avatar icon color class */
  dmAvatarIconColor: string;
  /** User avatar container classes */
  userAvatar: string;
  /** Strong/bold text color in markdown */
  accentColor: string;
  /** Heading color in markdown */
  headingColor: string;
  /** Blockquote border color class */
  blockquoteBorder: string;
  /** Loading indicator text */
  loadingText: string;
  /** Loading spinner color */
  loadingColor: string;
  /** Input area background class */
  inputBg: string;
  /** Input border class */
  inputBorder: string;
  /** Send button active classes */
  sendBtnActive: string;
  /** Font class for DM messages (optional, for thematic fonts) */
  dmFontClass?: string;
  /** Italic/em text color */
  emColor: string;
  /** Mobile action menu bg */
  actionMenuBg: string;
  /** Action menu border */
  actionMenuBorder: string;
  /** Code block bg */
  codeBg: string;
  /** HR color */
  hrColor: string;
}

export const DM_CHAT_THEMES: DMChatTheme[] = [
  {
    id: 'default',
    name: 'Default',
    icon: '⚔️',
    description: 'Classic amber & gold',
    swatch: ['#1a1520', '#f59e0b', '#fef3c7'],
    chatBg: 'bg-transparent',
    dmBubble: 'bg-amber-950/50 border border-amber-500/20 rounded-bl-sm',
    userBubble: 'bg-white/10 text-white rounded-br-sm border border-white/10',
    dmAvatar: 'bg-amber-900/60 border border-amber-500/40',
    dmAvatarIconColor: 'text-amber-400',
    userAvatar: 'bg-white/10',
    accentColor: 'text-amber-300',
    headingColor: 'text-amber-300',
    blockquoteBorder: 'border-amber-500/40',
    loadingText: 'The DM weaves the tale...',
    loadingColor: 'text-amber-400/60',
    inputBg: 'bg-white/5',
    inputBorder: 'border-amber-900/30',
    sendBtnActive: 'bg-amber-900/40 border-amber-500/30 hover:bg-amber-900/60',
    emColor: 'text-white/70',
    actionMenuBg: 'bg-[#1a1520]',
    actionMenuBorder: 'border-amber-500/30',
    codeBg: 'bg-black/30',
    hrColor: 'border-amber-500/20',
  },
  {
    id: 'parchment',
    name: 'Parchment & Quill',
    icon: '📜',
    description: 'Aged paper, sepia ink',
    swatch: ['#3d2b1f', '#8b6914', '#f5e6c8'],
    chatBg: 'bg-[#2a1f14]/60',
    dmBubble: 'bg-[#f5e6c8]/10 border border-[#8b6914]/30 rounded-bl-sm',
    userBubble: 'bg-[#5c3d1e]/40 text-[#f5e6c8] rounded-br-sm border border-[#8b6914]/20',
    dmAvatar: 'bg-[#5c3d1e]/60 border border-[#8b6914]/40',
    dmAvatarIconColor: 'text-[#d4a843]',
    userAvatar: 'bg-[#5c3d1e]/40',
    accentColor: 'text-[#d4a843]',
    headingColor: 'text-[#d4a843]',
    blockquoteBorder: 'border-[#8b6914]/50',
    loadingText: 'The quill scratches across parchment...',
    loadingColor: 'text-[#d4a843]/60',
    inputBg: 'bg-[#2a1f14]/60',
    inputBorder: 'border-[#8b6914]/30',
    sendBtnActive: 'bg-[#5c3d1e]/60 border-[#8b6914]/40 hover:bg-[#5c3d1e]/80',
    emColor: 'text-[#f5e6c8]/60',
    actionMenuBg: 'bg-[#2a1f14]',
    actionMenuBorder: 'border-[#8b6914]/30',
    codeBg: 'bg-[#1a1108]/50',
    hrColor: 'border-[#8b6914]/30',
  },
  {
    id: 'arcane-tome',
    name: 'Arcane Tome',
    icon: '🔮',
    description: 'Leather-bound, runic glow',
    swatch: ['#1a0a2e', '#a855f7', '#e9d5ff'],
    chatBg: 'bg-[#0f0520]/60',
    dmBubble: 'bg-purple-950/50 border border-purple-500/25 rounded-bl-sm',
    userBubble: 'bg-purple-900/20 text-purple-100 rounded-br-sm border border-purple-500/15',
    dmAvatar: 'bg-purple-900/60 border border-purple-500/40',
    dmAvatarIconColor: 'text-purple-400',
    userAvatar: 'bg-purple-900/30',
    accentColor: 'text-purple-300',
    headingColor: 'text-purple-300',
    blockquoteBorder: 'border-purple-500/40',
    loadingText: 'Ancient runes shimmer to life...',
    loadingColor: 'text-purple-400/60',
    inputBg: 'bg-purple-950/30',
    inputBorder: 'border-purple-500/20',
    sendBtnActive: 'bg-purple-900/40 border-purple-500/30 hover:bg-purple-900/60',
    emColor: 'text-purple-200/60',
    actionMenuBg: 'bg-[#0f0520]',
    actionMenuBorder: 'border-purple-500/30',
    codeBg: 'bg-purple-950/40',
    hrColor: 'border-purple-500/20',
  },
  {
    id: 'war-table',
    name: 'War Table',
    icon: '⚔️',
    description: 'Tactical dispatches on oak',
    swatch: ['#2d1b0e', '#b45309', '#fcd34d'],
    chatBg: 'bg-[#1c1208]/60',
    dmBubble: 'bg-[#3d2510]/60 border border-[#b45309]/30 rounded-bl-sm',
    userBubble: 'bg-[#2d1b0e]/60 text-[#fcd34d]/90 rounded-br-sm border border-[#b45309]/20',
    dmAvatar: 'bg-[#4a2c12]/70 border border-[#b45309]/40',
    dmAvatarIconColor: 'text-[#fcd34d]',
    userAvatar: 'bg-[#3d2510]/50',
    accentColor: 'text-[#fcd34d]',
    headingColor: 'text-[#fcd34d]',
    blockquoteBorder: 'border-[#b45309]/50',
    loadingText: 'Dispatches arriving from the front...',
    loadingColor: 'text-[#fcd34d]/60',
    inputBg: 'bg-[#1c1208]/60',
    inputBorder: 'border-[#b45309]/30',
    sendBtnActive: 'bg-[#4a2c12]/60 border-[#b45309]/40 hover:bg-[#4a2c12]/80',
    emColor: 'text-[#fcd34d]/50',
    actionMenuBg: 'bg-[#1c1208]',
    actionMenuBorder: 'border-[#b45309]/30',
    codeBg: 'bg-[#0f0a04]/50',
    hrColor: 'border-[#b45309]/25',
  },
  {
    id: 'dungeon-stone',
    name: 'Dungeon Stone',
    icon: '🏰',
    description: 'Dark stone, torchlight glow',
    swatch: ['#1a1a1a', '#ea580c', '#fed7aa'],
    chatBg: 'bg-[#121212]/60',
    dmBubble: 'bg-[#2a2a2a]/70 border border-[#ea580c]/20 rounded-bl-sm',
    userBubble: 'bg-[#1e1e1e]/70 text-stone-200 rounded-br-sm border border-stone-600/30',
    dmAvatar: 'bg-[#2a2020]/70 border border-[#ea580c]/30',
    dmAvatarIconColor: 'text-orange-400',
    userAvatar: 'bg-stone-800/50',
    accentColor: 'text-orange-300',
    headingColor: 'text-orange-300',
    blockquoteBorder: 'border-orange-500/30',
    loadingText: 'Torches flicker in the darkness...',
    loadingColor: 'text-orange-400/60',
    inputBg: 'bg-stone-900/40',
    inputBorder: 'border-stone-600/30',
    sendBtnActive: 'bg-orange-900/40 border-orange-500/30 hover:bg-orange-900/60',
    emColor: 'text-stone-400',
    actionMenuBg: 'bg-[#1a1a1a]',
    actionMenuBorder: 'border-orange-500/25',
    codeBg: 'bg-black/40',
    hrColor: 'border-stone-600/30',
  },
  {
    id: 'astral-plane',
    name: 'Astral Plane',
    icon: '🌌',
    description: 'Deep space, ethereal glow',
    swatch: ['#0a0a1a', '#06b6d4', '#cffafe'],
    chatBg: 'bg-[#050510]/60',
    dmBubble: 'bg-cyan-950/40 border border-cyan-500/20 rounded-bl-sm',
    userBubble: 'bg-indigo-950/30 text-cyan-100 rounded-br-sm border border-indigo-500/15',
    dmAvatar: 'bg-cyan-900/50 border border-cyan-500/30',
    dmAvatarIconColor: 'text-cyan-400',
    userAvatar: 'bg-indigo-900/30',
    accentColor: 'text-cyan-300',
    headingColor: 'text-cyan-300',
    blockquoteBorder: 'border-cyan-500/30',
    loadingText: 'Drifting through the Astral Sea...',
    loadingColor: 'text-cyan-400/60',
    inputBg: 'bg-indigo-950/30',
    inputBorder: 'border-cyan-500/15',
    sendBtnActive: 'bg-cyan-900/40 border-cyan-500/30 hover:bg-cyan-900/60',
    emColor: 'text-cyan-200/50',
    actionMenuBg: 'bg-[#050510]',
    actionMenuBorder: 'border-cyan-500/25',
    codeBg: 'bg-indigo-950/40',
    hrColor: 'border-cyan-500/15',
  },
  {
    id: 'blood-ink',
    name: 'Blood & Ink',
    icon: '🩸',
    description: 'Crimson horror journal',
    swatch: ['#1a0505', '#dc2626', '#fca5a5'],
    chatBg: 'bg-[#0f0505]/60',
    dmBubble: 'bg-red-950/50 border border-red-500/25 rounded-bl-sm',
    userBubble: 'bg-red-950/20 text-red-100 rounded-br-sm border border-red-800/20',
    dmAvatar: 'bg-red-900/50 border border-red-500/30',
    dmAvatarIconColor: 'text-red-400',
    userAvatar: 'bg-red-950/30',
    accentColor: 'text-red-300',
    headingColor: 'text-red-300',
    blockquoteBorder: 'border-red-500/30',
    loadingText: 'Ink bleeds across the page...',
    loadingColor: 'text-red-400/60',
    inputBg: 'bg-red-950/20',
    inputBorder: 'border-red-800/25',
    sendBtnActive: 'bg-red-900/40 border-red-500/30 hover:bg-red-900/60',
    emColor: 'text-red-200/50',
    actionMenuBg: 'bg-[#0f0505]',
    actionMenuBorder: 'border-red-500/25',
    codeBg: 'bg-red-950/40',
    hrColor: 'border-red-800/25',
  },
  {
    id: 'elvish-grove',
    name: 'Elvish Grove',
    icon: '🧝',
    description: 'Woodland green & gold',
    swatch: ['#0a1a0a', '#22c55e', '#dcfce7'],
    chatBg: 'bg-[#060f06]/60',
    dmBubble: 'bg-green-950/50 border border-green-500/20 rounded-bl-sm',
    userBubble: 'bg-emerald-950/20 text-green-100 rounded-br-sm border border-green-700/15',
    dmAvatar: 'bg-green-900/50 border border-green-500/30',
    dmAvatarIconColor: 'text-green-400',
    userAvatar: 'bg-emerald-900/30',
    accentColor: 'text-green-300',
    headingColor: 'text-green-300',
    blockquoteBorder: 'border-green-500/30',
    loadingText: 'Leaves whisper ancient words...',
    loadingColor: 'text-green-400/60',
    inputBg: 'bg-green-950/20',
    inputBorder: 'border-green-700/20',
    sendBtnActive: 'bg-green-900/40 border-green-500/30 hover:bg-green-900/60',
    emColor: 'text-green-200/50',
    actionMenuBg: 'bg-[#060f06]',
    actionMenuBorder: 'border-green-500/25',
    codeBg: 'bg-green-950/40',
    hrColor: 'border-green-700/20',
  },
  {
    id: 'dragons-hoard',
    name: "Dragon's Hoard",
    icon: '🐉',
    description: 'Molten gold & obsidian',
    swatch: ['#1a1000', '#eab308', '#fef08a'],
    chatBg: 'bg-[#0f0a00]/60',
    dmBubble: 'bg-yellow-950/50 border border-yellow-500/25 rounded-bl-sm',
    userBubble: 'bg-yellow-950/15 text-yellow-100 rounded-br-sm border border-yellow-600/15',
    dmAvatar: 'bg-yellow-900/50 border border-yellow-500/35',
    dmAvatarIconColor: 'text-yellow-400',
    userAvatar: 'bg-yellow-950/30',
    accentColor: 'text-yellow-300',
    headingColor: 'text-yellow-300',
    blockquoteBorder: 'border-yellow-500/35',
    loadingText: 'Gold gleams in the dragon fire...',
    loadingColor: 'text-yellow-400/60',
    inputBg: 'bg-yellow-950/20',
    inputBorder: 'border-yellow-700/25',
    sendBtnActive: 'bg-yellow-900/40 border-yellow-500/30 hover:bg-yellow-900/60',
    emColor: 'text-yellow-200/50',
    actionMenuBg: 'bg-[#0f0a00]',
    actionMenuBorder: 'border-yellow-500/25',
    codeBg: 'bg-yellow-950/40',
    hrColor: 'border-yellow-600/20',
  },
  {
    id: 'basgiath-stone',
    name: 'Basgiath Stone',
    icon: '🏔️',
    description: 'Cold mountain fortress — grey stone and steel',
    swatch: ['#1a1d24', '#64748b', '#cbd5e1'],
    chatBg: 'bg-[#12151a]/60',
    dmBubble: 'bg-slate-900/60 border border-slate-600/25 rounded-bl-sm',
    userBubble: 'bg-slate-800/40 text-slate-200 rounded-br-sm border border-slate-600/15',
    dmAvatar: 'bg-slate-800/60 border border-slate-500/30',
    dmAvatarIconColor: 'text-slate-400',
    userAvatar: 'bg-slate-800/40',
    accentColor: 'text-blue-300',
    headingColor: 'text-blue-300',
    blockquoteBorder: 'border-slate-500/30',
    loadingText: 'Wind howls through the fortress walls...',
    loadingColor: 'text-slate-400/60',
    inputBg: 'bg-slate-900/40',
    inputBorder: 'border-slate-600/25',
    sendBtnActive: 'bg-slate-700/50 border-slate-500/30 hover:bg-slate-700/70',
    emColor: 'text-slate-300/50',
    actionMenuBg: 'bg-[#12151a]',
    actionMenuBorder: 'border-slate-600/25',
    codeBg: 'bg-slate-950/40',
    hrColor: 'border-slate-600/20',
  },
  {
    id: 'dragon-fire',
    name: 'Dragon Fire',
    icon: '🔥',
    description: 'Deep ember glow of dragonfire',
    swatch: ['#1a0f05', '#d97706', '#fde68a'],
    chatBg: 'bg-[#0f0805]/60',
    dmBubble: 'bg-amber-950/50 border border-amber-600/25 rounded-bl-sm',
    userBubble: 'bg-amber-900/20 text-amber-100 rounded-br-sm border border-amber-700/15',
    dmAvatar: 'bg-amber-900/60 border border-amber-600/35',
    dmAvatarIconColor: 'text-amber-400',
    userAvatar: 'bg-amber-900/30',
    accentColor: 'text-amber-300',
    headingColor: 'text-amber-300',
    blockquoteBorder: 'border-amber-600/35',
    loadingText: 'Embers crackle in the dragon den...',
    loadingColor: 'text-amber-400/60',
    inputBg: 'bg-amber-950/30',
    inputBorder: 'border-amber-700/25',
    sendBtnActive: 'bg-amber-900/50 border-amber-600/30 hover:bg-amber-900/70',
    emColor: 'text-amber-200/50',
    actionMenuBg: 'bg-[#0f0805]',
    actionMenuBorder: 'border-amber-600/25',
    codeBg: 'bg-amber-950/40',
    hrColor: 'border-amber-700/20',
  },
  {
    id: 'ward-line',
    name: 'Ward Line',
    icon: '⚡',
    description: 'Crackling purple ward energy',
    swatch: ['#0f0520', '#8b5cf6', '#ddd6fe'],
    chatBg: 'bg-[#0a0318]/60',
    dmBubble: 'bg-violet-950/50 border border-violet-500/25 rounded-bl-sm',
    userBubble: 'bg-violet-900/20 text-violet-100 rounded-br-sm border border-violet-600/15',
    dmAvatar: 'bg-violet-900/60 border border-violet-500/35',
    dmAvatarIconColor: 'text-violet-400',
    userAvatar: 'bg-violet-900/30',
    accentColor: 'text-teal-300',
    headingColor: 'text-violet-300',
    blockquoteBorder: 'border-violet-500/35',
    loadingText: 'The ward line crackles and shifts...',
    loadingColor: 'text-violet-400/60',
    inputBg: 'bg-violet-950/30',
    inputBorder: 'border-violet-600/20',
    sendBtnActive: 'bg-violet-900/40 border-violet-500/30 hover:bg-violet-900/60',
    emColor: 'text-violet-200/50',
    actionMenuBg: 'bg-[#0a0318]',
    actionMenuBorder: 'border-violet-500/25',
    codeBg: 'bg-violet-950/40',
    hrColor: 'border-violet-500/20',
  },
];

export function getDMChatTheme(id: DMChatThemeId): DMChatTheme {
  return DM_CHAT_THEMES.find(t => t.id === id) || DM_CHAT_THEMES[0];
}
