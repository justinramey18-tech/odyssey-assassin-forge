import { cn } from '@/lib/utils';
import { Gamepad2, FileText, HelpCircle, User, Dices, Wand2, ChevronRight } from 'lucide-react';

export type SettingsTab = 'game' | 'setup' | 'faq' | 'character' | 'tools' | 'customizations';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const tabs: TabConfig[] = [
  { 
    id: 'game', 
    label: 'Game Mode', 
    icon: Gamepad2, 
    description: 'XP & difficulty settings',
    color: 'text-red-400'
  },
  { 
    id: 'setup', 
    label: 'AI Set Up', 
    icon: FileText, 
    description: 'Sync with your GM',
    color: 'text-amber-400'
  },
  { 
    id: 'customizations', 
    label: 'Customizations', 
    icon: Wand2, 
    description: 'Homebrew abilities',
    color: 'text-violet-400'
  },
  { 
    id: 'faq', 
    label: 'Help & FAQ', 
    icon: HelpCircle, 
    description: 'Common questions',
    color: 'text-cyan-400'
  },
  { 
    id: 'character', 
    label: 'Character', 
    icon: User, 
    description: 'Edit & reset options',
    color: 'text-purple-400'
  },
  { 
    id: 'tools', 
    label: 'Dice Tools', 
    icon: Dices, 
    description: 'Roll odds & modifiers',
    color: 'text-green-400'
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
