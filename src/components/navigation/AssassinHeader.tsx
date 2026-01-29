import { Home, Settings, Crosshair, Swords, Backpack, Trophy, Sparkles, BookOpen, Cloud } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AssassinHeaderProps {
  onHomeClick: () => void;
  onSettingsClick: () => void;
  onCloudSaveClick?: () => void;
}

export function AssassinHeader({ onHomeClick, onSettingsClick, onCloudSaveClick }: AssassinHeaderProps) {
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
      
      {/* Main navigation content */}
      <div className="h-full w-full flex items-center px-2">
        {/* Home Button */}
        <Button
          variant="ghost"
          onClick={onHomeClick}
          className="h-full aspect-square flex flex-col items-center justify-center gap-1 rounded-none border-r border-red-900/40 hover:bg-red-600/20 hover:text-red-400 transition-all group"
        >
          <span className="relative">
            <Home className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform" />
            <span className="absolute inset-0 blur-sm bg-red-400 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
          </span>
          <span className="font-cinzel uppercase tracking-wider text-[8px] text-muted-foreground group-hover:text-red-400">Home</span>
        </Button>

        {/* Main Tab Navigation - Horizontally Scrollable */}
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <TabsList className="h-full flex bg-transparent p-0 rounded-none min-w-max">
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
            
            <TabsTrigger 
              value="skills" 
              className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-red-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-red-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-red-900/20"
            >
              <span className="relative">
                <Swords className="w-5 h-5 relative z-10 group-hover:animate-tab-swords group-data-[state=active]:animate-tab-swords group-data-[state=active]:text-red-400" />
                <span className="absolute inset-0 blur-md bg-red-500 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
              </span>
              <span className="group-data-[state=active]:text-red-300 whitespace-nowrap">Skills</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="gear" 
              className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-amber-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-amber-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-amber-900/20"
            >
              <span className="relative">
                <Backpack className="w-5 h-5 relative z-10 group-hover:animate-tab-backpack group-data-[state=active]:animate-tab-backpack group-data-[state=active]:text-amber-400" />
                <span className="absolute inset-0 blur-md bg-amber-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
              </span>
              <span className="group-data-[state=active]:text-amber-300 whitespace-nowrap">Gear</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="feats" 
              className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-purple-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-purple-900/20"
            >
              <span className="relative">
                <Trophy className="w-5 h-5 relative z-10 group-hover:animate-tab-trophy group-data-[state=active]:animate-tab-trophy group-data-[state=active]:text-purple-400" />
                <span className="absolute inset-0 blur-md bg-purple-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
              </span>
              <span className="group-data-[state=active]:text-purple-300 whitespace-nowrap">Feats</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="stars" 
              className="group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px] rounded-none border-x border-red-900/20 data-[state=active]:bg-gradient-to-b data-[state=active]:from-cyan-600/30 data-[state=active]:to-transparent data-[state=active]:border-b-2 data-[state=active]:border-b-cyan-500 font-cinzel uppercase tracking-wider text-[10px] transition-all hover:bg-cyan-900/20"
            >
              <span className="relative">
                <Sparkles className="w-5 h-5 relative z-10 group-hover:animate-tab-sparkles group-data-[state=active]:animate-tab-sparkles group-data-[state=active]:text-cyan-400" />
                <span className="absolute inset-0 blur-md bg-cyan-400 rounded-full opacity-0 group-data-[state=active]:opacity-70 group-data-[state=active]:animate-glow-pulse transition-opacity" />
              </span>
              <span className="group-data-[state=active]:text-cyan-300 whitespace-nowrap">Stars</span>
            </TabsTrigger>
            
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
          </TabsList>
        </div>

        {/* Cloud Save Button */}
        {onCloudSaveClick && (
          <Button
            variant="ghost"
            onClick={onCloudSaveClick}
            className="h-full aspect-square flex flex-col items-center justify-center gap-1 rounded-none border-l border-red-900/40 hover:bg-cyan-600/20 hover:text-cyan-400 transition-all group"
          >
            <span className="relative">
              <Cloud className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform" />
              <span className="absolute inset-0 blur-sm bg-cyan-400 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
            </span>
            <span className="font-cinzel uppercase tracking-wider text-[8px] text-muted-foreground group-hover:text-cyan-400">Cloud</span>
          </Button>
        )}

        {/* Settings Button */}
        <Button
          variant="ghost"
          onClick={onSettingsClick}
          className="h-full aspect-square flex flex-col items-center justify-center gap-1 rounded-none border-l border-red-900/40 hover:bg-red-600/20 hover:text-red-400 transition-all group"
        >
          <span className="relative">
            <Settings className="w-5 h-5 relative z-10 group-hover:rotate-90 transition-transform duration-500" />
            <span className="absolute inset-0 blur-sm bg-red-400 rounded-full opacity-0 group-hover:opacity-40 transition-opacity" />
          </span>
          <span className="font-cinzel uppercase tracking-wider text-[8px] text-muted-foreground group-hover:text-red-400">Settings</span>
        </Button>
      </div>
      
      {/* Decorative side tribal marks */}
      <div className="absolute top-1/2 left-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent" />
      <div className="absolute top-1/2 right-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent" />
    </header>
  );
}
