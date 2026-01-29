import { useState, useMemo } from 'react';
import { Character, getAbilityPointsForLevel, getTotalPointsSpent, getPointsSpentInTree, getActiveSlotsByLevel } from '@/lib/types';
import { allAbilities } from '@/lib/abilities';
import { CharacterEquipment, EquipmentItem, legendarySetDefinitions } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { 
  User, Heart, Shield, Swords, Package, Trophy, 
  Sparkles, Moon, Scroll, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AssassinZone } from './AssassinZone';
import { HomeDataModal } from './HomeDataModal';
import {
  CharacterStatsContent,
  SkillsOverviewContent,
  GearOverviewContent,
  AchievementsOverviewContent,
  ConstellationOverviewContent,
  RestActionsContent,
  DailyQuoteContent,
} from './HomeModalContents';
import homeBackground from '@/assets/home-background.jpg';

// Deadpool-style quotes
const deadpoolQuotes = [
  "Maximum effort!",
  "I'm touching myself tonight.",
  "You may be wondering why the red suit? So bad guys can't see me bleed.",
  "I know, right? Whose balls did I have to fondle to get my own movie?",
  "Time to make the chimichangas!",
  "I'm gonna do what's right. You know what that is?",
  "Fourth wall break inside a fourth wall break? That's like... 16 walls!",
  "Did I leave the stove on?",
  "Superhero landing! She's gonna do a superhero landing!",
  "Pump the hate brakes, Thanos.",
];

// Assassin zone configurations - positioned to match silhouettes in the generated image
// These are approximate positions based on a group of 6 assassins
const assassinZones = [
  { 
    id: 'character', 
    label: 'Character', 
    color: '#ef4444', // red
    position: { left: '8%', top: '25%' },
    icon: User,
  },
  { 
    id: 'skills', 
    label: 'Skills', 
    color: '#22c55e', // green
    position: { left: '25%', top: '18%' },
    icon: Swords,
  },
  { 
    id: 'gear', 
    label: 'Gear', 
    color: '#f59e0b', // amber
    position: { left: '42%', top: '22%' },
    icon: Package,
  },
  { 
    id: 'feats', 
    label: 'Feats', 
    color: '#a855f7', // purple
    position: { right: '42%', top: '22%' },
    icon: Trophy,
  },
  { 
    id: 'stars', 
    label: 'Stars', 
    color: '#06b6d4', // cyan
    position: { right: '25%', top: '18%' },
    icon: Sparkles,
  },
  { 
    id: 'rest', 
    label: 'Rest', 
    color: '#3b82f6', // blue
    position: { right: '8%', top: '25%' },
    icon: Moon,
  },
  { 
    id: 'wisdom', 
    label: 'Wisdom', 
    color: '#dc2626', // red-600
    position: { left: '50%', top: '12%', transform: 'translateX(-50%)' },
    icon: Scroll,
  },
];

interface HomeScreenProps {
  character: Character;
  equipment: CharacterEquipment;
  achievements: Achievement[];
  onBack: () => void;
  onNavigateToTab: (tab: 'abilities' | 'inventory' | 'achievements' | 'constellation') => void;
  onShortRest: () => void;
  onLongRest: () => void;
}

export function HomeScreen({ 
  character, 
  equipment, 
  achievements,
  onBack,
  onNavigateToTab,
  onShortRest,
  onLongRest
}: HomeScreenProps) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Daily quote (changes based on date)
  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return deadpoolQuotes[dayOfYear % deadpoolQuotes.length];
  }, []);

  const handleZoneClick = (zoneId: string) => {
    setActiveModal(zoneId);
  };

  const closeModal = () => setActiveModal(null);

  const navigateAndClose = (tab: 'abilities' | 'inventory' | 'achievements' | 'constellation') => {
    closeModal();
    onNavigateToTab(tab);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Static Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${homeBackground})` }}
      >
        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
      </div>

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 border-b border-red-900/30 bg-background/70 backdrop-blur-md z-20">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-cinzel font-bold text-lg uppercase tracking-wider text-red-400">
          {character.name || 'Home Base'}
        </h1>
        <div className="w-9" />
      </header>

      {/* Main Content Area with Clickable Assassin Zones */}
      <div className="flex-1 relative z-10">
        {/* Assassin Zone Buttons */}
        {assassinZones.map((zone) => {
          const IconComponent = zone.icon;
          return (
            <AssassinZone
              key={zone.id}
              label={zone.label}
              icon={<IconComponent className="w-3.5 h-3.5" />}
              onClick={() => handleZoneClick(zone.id)}
              accentColor={zone.color}
              style={zone.position as React.CSSProperties}
            />
          );
        })}

        {/* Bottom hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
          <p className="text-xs text-muted-foreground/70 backdrop-blur-sm bg-black/30 px-4 py-2 rounded-full">
            Tap an assassin to view details
          </p>
        </div>
      </div>

      {/* Modals for each zone */}
      <HomeDataModal
        open={activeModal === 'character'}
        onOpenChange={(open) => !open && closeModal()}
        title="Character Stats"
        icon={<User className="w-5 h-5" />}
        accentColor="#ef4444"
      >
        <CharacterStatsContent character={character} />
      </HomeDataModal>

      <HomeDataModal
        open={activeModal === 'skills'}
        onOpenChange={(open) => !open && closeModal()}
        title="Skills Overview"
        icon={<Swords className="w-5 h-5" />}
        accentColor="#22c55e"
      >
        <SkillsOverviewContent 
          character={character} 
          onNavigate={() => navigateAndClose('abilities')} 
        />
      </HomeDataModal>

      <HomeDataModal
        open={activeModal === 'gear'}
        onOpenChange={(open) => !open && closeModal()}
        title="Gear Overview"
        icon={<Package className="w-5 h-5" />}
        accentColor="#f59e0b"
      >
        <GearOverviewContent 
          equipment={equipment} 
          onNavigate={() => navigateAndClose('inventory')} 
        />
      </HomeDataModal>

      <HomeDataModal
        open={activeModal === 'feats'}
        onOpenChange={(open) => !open && closeModal()}
        title="Feats Overview"
        icon={<Trophy className="w-5 h-5" />}
        accentColor="#a855f7"
      >
        <AchievementsOverviewContent 
          achievements={achievements} 
          onNavigate={() => navigateAndClose('achievements')} 
        />
      </HomeDataModal>

      <HomeDataModal
        open={activeModal === 'stars'}
        onOpenChange={(open) => !open && closeModal()}
        title="Constellations"
        icon={<Sparkles className="w-5 h-5" />}
        accentColor="#06b6d4"
      >
        <ConstellationOverviewContent 
          equipment={equipment} 
          onNavigate={() => navigateAndClose('constellation')} 
        />
      </HomeDataModal>

      <HomeDataModal
        open={activeModal === 'rest'}
        onOpenChange={(open) => !open && closeModal()}
        title="Rest & Recovery"
        icon={<Moon className="w-5 h-5" />}
        accentColor="#3b82f6"
      >
        <RestActionsContent 
          onShortRest={() => { onShortRest(); closeModal(); }}
          onLongRest={() => { onLongRest(); closeModal(); }}
        />
      </HomeDataModal>

      <HomeDataModal
        open={activeModal === 'wisdom'}
        onOpenChange={(open) => !open && closeModal()}
        title="Daily Wisdom"
        icon={<Scroll className="w-5 h-5" />}
        accentColor="#dc2626"
      >
        <DailyQuoteContent quote={dailyQuote} />
      </HomeDataModal>
    </div>
  );
}
