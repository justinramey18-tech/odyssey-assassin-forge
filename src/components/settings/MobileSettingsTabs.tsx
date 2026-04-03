import { cn } from '@/lib/utils';
import { User, Swords, Wand2, BookOpen, Settings, ChevronRight, Mic, Code, Music, Send, Cloud } from 'lucide-react';

export type SettingsTab = 'character' | 'gameplay' | 'customizations' | 'gameMaster' | 'elevenlabs' | 'spotify' | 'telegram' | 'weather' | 'appSystem' | 'devTools';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const tabs: TabConfig[] = [
  { 
    id: 'character', 
    label: 'Character & Party', 
    icon: User, 
    description: 'Your hero & teammates',
    color: 'text-purple-400'
  },
  {
    id: 'gameplay', 
    label: 'Gameplay', 
    icon: Swords, 
    description: 'Rules & progression',
    color: 'text-red-400'
  },
  { 
    id: 'customizations', 
    label: 'Customizations', 
    icon: Wand2, 
    description: 'Homebrew rules & images',
    color: 'text-violet-400'
  },
  { 
    id: 'gameMaster', 
    label: 'Game Master', 
    icon: BookOpen, 
    description: 'AI dungeon master',
    color: 'text-amber-400'
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    icon: Mic,
    description: 'Voice & audio settings',
    color: 'text-sky-400'
  },
  {
    id: 'spotify',
    label: 'Spotify',
    icon: Music,
    description: 'Ambient music & playlists',
    color: 'text-green-400'
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: Send,
    description: 'Notifications & commands',
    color: 'text-sky-400'
  },
  {
    id: 'weather',
    label: 'Weather',
    icon: Cloud,
    description: 'Live weather overlays',
    color: 'text-sky-400'
  },
  { 
    id: 'appSystem',
    label: 'App & System', 
    icon: Settings, 
    description: 'App settings & data',
    color: 'text-emerald-400'
  },
  {
    id: 'devTools',
    label: 'R&D Developer Tools',
    icon: Code,
    description: 'AI debugger & file reference',
    color: 'text-rose-400'
  },
];

interface MobileSettingsTabsProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function MobileSettingsTabs({ activeTab, onTabChange }: MobileSettingsTabsProps) {
  return (
    <div className="flex flex-col gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-all text-left",
              "border border-transparent",
              isActive 
                ? "bg-primary/10 border-primary/30" 
                : "bg-muted/20 hover:bg-muted/40 active:scale-[0.98]"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              isActive ? "bg-primary/20" : "bg-muted/30"
            )}>
              <Icon className={cn(
                "w-5 h-5 transition-colors",
                isActive ? tab.color : "text-muted-foreground"
              )} />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-sm transition-colors",
                isActive ? "text-foreground" : "text-foreground/80"
              )}>
                {tab.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {tab.description}
              </p>
            </div>
            
            <ChevronRight className={cn(
              "w-4 h-4 transition-all",
              isActive 
                ? "text-primary opacity-100" 
                : "text-muted-foreground opacity-50"
            )} />
          </button>
        );
      })}
    </div>
  );
}

export { tabs as settingsTabs };
