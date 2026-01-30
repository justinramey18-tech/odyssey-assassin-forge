import { Home, Settings, Crosshair, Swords, Backpack, Trophy, Sparkles, BookOpen, Cloud, FlaskConical, Search, Zap, Crown, Lock } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface AssassinHeaderProps {
  onHomeClick: () => void;
  onSettingsClick: () => void;
  onCloudSaveClick?: () => void;
  isLegacyUnlocked?: boolean;
  legacyProgress?: { current: number; required: number };
}

export function AssassinHeader({ 
  onHomeClick, 
  onSettingsClick, 
  onCloudSaveClick,
  isLegacyUnlocked = false,
  legacyProgress = { current: 0, required: 72 },
}: AssassinHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full h-[10vh] min-h-[70px] max-h-[100px] bg-gradient-to-b from-black via-background/98 to-background/90 backdrop-blur-md">
      {/* Assassin's Creed Top Border Art */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
      <div className="absolute top-[3px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
      
      {/* Angular corner decorations - Assassin's Creed style */}
      <div className="absolute top-0 left-0 w-8 h-8">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-transparent" />
        <div className="absolute top-0 left-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-[8px] left-[8px] w-4 h-4 border-t-2 border-l-2 border-red-400/60 rotate-0" />
      </div>
      <div className="absolute top-0 right-0 w-8 h-8">
        <div className="absolute top-0 right-0 w-full h-[3px] bg-gradient-to-l from-red-500 to-transparent" />
        <div className="absolute top-0 right-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-[8px] right-[8px] w-4 h-4 border-t-2 border-r-2 border-red-400/60" />
      </div>
      
      {/* Bottom decorative border with angular accent */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-red-900/80 to-transparent" />
        {/* Center diamond accent */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-3 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500/40 rotate-45 border border-red-400/60" />
        </div>
      </div>
      
      {/* Main navigation content - Horizontally Scrollable */}
      <div className="h-full w-full overflow-x-auto scrollbar-hide">
        <TabsList className="h-full flex bg-transparent p-0 rounded-none min-w-max">
          {/* Home Tab */}
          <TabsTrigger 
            value="home" 
            onClick={onHomeClick}
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-green-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-green-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-green-900/20"
          >
            <span className="relative">
              <Home className="w-5 h-5 relative z-10 group-hover:scale-110 group-data-[state=active]:text-green-400 transition-transform" />
              <span className="absolute inset-0 blur-md bg-green-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-green-300 whitespace-nowrap">Home</span>
          </TabsTrigger>

          {/* Combat Tab */}
          <TabsTrigger 
            value="combat" 
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-red-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-red-900/20"
          >
            <span className="relative">
              <Crosshair className="w-5 h-5 relative z-10 group-hover:animate-tab-crosshair group-data-[state=active]:animate-tab-crosshair group-data-[state=active]:text-red-400" />
              <span className="absolute inset-0 blur-md bg-red-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-red-300 whitespace-nowrap">Combat</span>
          </TabsTrigger>
          
          {/* Skills Tab */}
          <TabsTrigger 
            value="skills" 
            data-tutorial-id="tab-skills"
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-red-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-red-900/20"
          >
            <span className="relative">
              <Swords className="w-5 h-5 relative z-10 group-hover:animate-tab-swords group-data-[state=active]:animate-tab-swords group-data-[state=active]:text-red-400" />
              <span className="absolute inset-0 blur-md bg-red-500 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-red-300 whitespace-nowrap">Skills</span>
          </TabsTrigger>

          {/* Abilities Tab */}
          <TabsTrigger 
            value="abilities" 
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-violet-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-violet-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-violet-900/20"
          >
            <span className="relative">
              <Zap className="w-5 h-5 relative z-10 group-hover:scale-110 group-data-[state=active]:text-violet-400 transition-transform" />
              <span className="absolute inset-0 blur-md bg-violet-500 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-violet-300 whitespace-nowrap">Abilities</span>
          </TabsTrigger>
          
          {/* Gear Tab */}
          <TabsTrigger 
            value="gear" 
            data-tutorial-id="tab-gear"
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-amber-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-amber-900/20"
          >
            <span className="relative">
              <Backpack className="w-5 h-5 relative z-10 group-hover:animate-tab-backpack group-data-[state=active]:animate-tab-backpack group-data-[state=active]:text-amber-400" />
              <span className="absolute inset-0 blur-md bg-amber-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-amber-300 whitespace-nowrap">Gear</span>
          </TabsTrigger>

          {/* Consumables Tab */}
          <TabsTrigger 
            value="consumables" 
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-emerald-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-emerald-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-emerald-900/20"
          >
            <span className="relative">
              <FlaskConical className="w-5 h-5 relative z-10 group-hover:animate-pulse group-data-[state=active]:animate-pulse group-data-[state=active]:text-emerald-400" />
              <span className="absolute inset-0 blur-md bg-emerald-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-emerald-300 whitespace-nowrap">Consumables</span>
          </TabsTrigger>
          
          {/* Feats Tab */}
          <TabsTrigger 
            value="feats" 
            data-tutorial-id="tab-feats"
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-purple-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-purple-900/20"
          >
            <span className="relative">
              <Trophy className="w-5 h-5 relative z-10 group-hover:animate-tab-trophy group-data-[state=active]:animate-tab-trophy group-data-[state=active]:text-purple-400" />
              <span className="absolute inset-0 blur-md bg-purple-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-purple-300 whitespace-nowrap">Feats</span>
          </TabsTrigger>
          
          {/* Stars Tab */}
          <TabsTrigger 
            value="stars" 
            data-tutorial-id="tab-stars"
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-cyan-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-cyan-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-cyan-900/20"
          >
            <span className="relative">
              <Sparkles className="w-5 h-5 relative z-10 group-hover:animate-tab-sparkles group-data-[state=active]:animate-tab-sparkles group-data-[state=active]:text-cyan-400" />
              <span className="absolute inset-0 blur-md bg-cyan-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-cyan-300 whitespace-nowrap">Stars</span>
          </TabsTrigger>
          
          {/* Scribe Tab */}
          <TabsTrigger 
            value="scribe" 
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-amber-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-amber-900/20"
          >
            <span className="relative">
              <BookOpen className="w-5 h-5 relative z-10 group-hover:animate-tab-book group-data-[state=active]:animate-tab-book group-data-[state=active]:text-amber-400" />
              <span className="absolute inset-0 blur-md bg-amber-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-amber-300 whitespace-nowrap">Scribe</span>
          </TabsTrigger>

          {/* Chronicle Tab */}
          <TabsTrigger 
            value="chronicle" 
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-blue-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-blue-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-blue-900/20"
          >
            <span className="relative">
              <Search className="w-5 h-5 relative z-10 group-hover:scale-110 group-data-[state=active]:text-blue-400 transition-transform" />
              <span className="absolute inset-0 blur-md bg-blue-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-blue-300 whitespace-nowrap">Chronicle</span>
          </TabsTrigger>

          {/* Drizzt's Legacy Tab */}
          <TabsTrigger 
            value="legacy" 
            disabled={!isLegacyUnlocked}
            className={cn(
              "group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20",
              "data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-transparent",
              "data-[state=active]:border-b-2 data-[state=active]:border-b-purple-500",
              "font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-purple-900/20",
              !isLegacyUnlocked && "opacity-60"
            )}
          >
            <span className="relative">
              {isLegacyUnlocked ? (
                <Crown className="w-5 h-5 relative z-10 group-hover:scale-110 group-data-[state=active]:text-purple-400 transition-transform" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="absolute inset-0 blur-md bg-purple-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
              {!isLegacyUnlocked && (
                <span className="absolute -top-1 -right-2 text-[8px] text-muted-foreground">
                  {legacyProgress.current}/{legacyProgress.required}
                </span>
              )}
            </span>
            <span className="group-data-[state=active]:text-purple-300 whitespace-nowrap">Legacy</span>
          </TabsTrigger>

          {/* Cloud Save Tab */}
          {onCloudSaveClick && (
            <TabsTrigger 
              value="cloud" 
              onClick={onCloudSaveClick}
              className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-sky-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-sky-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-sky-900/20"
            >
              <span className="relative">
                <Cloud className="w-5 h-5 relative z-10 group-hover:scale-110 group-data-[state=active]:text-sky-400 transition-transform" />
                <span className="absolute inset-0 blur-md bg-sky-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
              </span>
              <span className="group-data-[state=active]:text-sky-300 whitespace-nowrap">Cloud</span>
            </TabsTrigger>
          )}

          {/* Settings Tab */}
          <TabsTrigger 
            value="settings" 
            data-tutorial-id="settings-button"
            onClick={onSettingsClick}
            className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-slate-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-slate-400 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-slate-900/20"
          >
            <span className="relative">
              <Settings className="w-5 h-5 relative z-10 group-hover:rotate-90 group-data-[state=active]:text-slate-300 transition-transform duration-500" />
              <span className="absolute inset-0 blur-md bg-slate-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
            </span>
            <span className="group-data-[state=active]:text-slate-300 whitespace-nowrap">Settings</span>
          </TabsTrigger>
        </TabsList>
      </div>
      
      {/* Decorative side tribal marks */}
      <div className="absolute top-1/2 left-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 right-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent pointer-events-none" />
    </header>
  );
}
