import { useState, useMemo, useRef, useEffect } from 'react';
import { Character } from '@/lib/types';
import { CharacterEquipment } from '@/lib/inventory';
import { Achievement } from '@/lib/achievements';
import { 
  User, Swords, Package, Trophy, 
  Sparkles, Moon, Scroll, ArrowLeft
} from 'lucide-react';
import { AssassinZone } from './AssassinZone';
import { ActionWheelButton } from '../character/ActionWheelButton';
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
import homeBackground from '@/assets/home-assassins-wide.jpg';

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

// Assassin zone configurations - positioned at pelvis level of each assassin
// 7 assassins spread evenly across the wide panoramic image
const assassinZones = [
  { 
    id: 'character', 
    label: 'Character', 
    color: '#ef4444', // red
    leftPercent: 7.5, // Altair (leftmost)
    icon: User,
  },
  { 
    id: 'skills', 
    label: 'Skills', 
    color: '#22c55e', // green
    leftPercent: 21, // Ezio
    icon: Swords,
  },
  { 
    id: 'gear', 
    label: 'Gear', 
    color: '#f59e0b', // amber
    leftPercent: 35.5, // Connor
    icon: Package,
  },
  { 
    id: 'wisdom', 
    label: 'Wisdom', 
    color: '#dc2626', // red-600
    leftPercent: 50, // Edward (center)
    icon: Scroll,
  },
  { 
    id: 'feats', 
    label: 'Feats', 
    color: '#a855f7', // purple
    leftPercent: 64.5, // Arno
    icon: Trophy,
  },
  { 
    id: 'stars', 
    label: 'Stars', 
    color: '#06b6d4', // cyan
    leftPercent: 78.5, // Jacob
    icon: Sparkles,
  },
  { 
    id: 'rest', 
    label: 'Rest', 
    color: '#3b82f6', // blue
    leftPercent: 92.5, // Bayek (rightmost)
    icon: Moon,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });

  // Daily quote (changes based on date)
  const dailyQuote = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return deadpoolQuotes[dayOfYear % deadpoolQuotes.length];
  }, []);

  // Center the scroll position on mount
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
      const scrollTop = (container.scrollHeight - container.clientHeight) / 2;
      container.scrollLeft = scrollLeft;
      container.scrollTop = scrollTop;
    }
  }, []);

  // Handle mouse/touch drag for panning
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    if (containerRef.current) {
      setScrollPos({ 
        x: containerRef.current.scrollLeft, 
        y: containerRef.current.scrollTop 
      });
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    containerRef.current.scrollLeft = scrollPos.x - dx;
    containerRef.current.scrollTop = scrollPos.y - dy;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleZoneClick = (zoneId: string) => {
    if (!isDragging) {
      setActiveModal(zoneId);
    }
  };

  const closeModal = () => setActiveModal(null);

  const navigateAndClose = (tab: 'abilities' | 'inventory' | 'achievements' | 'constellation') => {
    closeModal();
    onNavigateToTab(tab);
  };

  // Image dimensions for proper button positioning
  const imageAspectRatio = 1920 / 1080;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
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

      {/* 4-Directional Scrollable Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto cursor-grab active:cursor-grabbing scrollbar-hide"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Large panoramic image container - bigger than viewport for panning */}
        <div 
          className="relative select-none"
          style={{ 
            width: '200vw',
            height: `calc(200vw / ${imageAspectRatio})`,
            minHeight: '200vh',
          }}
        >
          {/* Background Image */}
          <img 
            src={homeBackground} 
            alt="Deadpool Assassins"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
          
          {/* Subtle vignette overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-transparent to-background/40 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-background/20 pointer-events-none" />

          {/* Assassin Zone Buttons - positioned horizontally along the image at pelvis height */}
          {assassinZones.map((zone) => {
            const IconComponent = zone.icon;
            return (
              <AssassinZone
                key={zone.id}
                label={zone.label}
                icon={<IconComponent className="w-3.5 h-3.5" />}
                onClick={() => handleZoneClick(zone.id)}
                accentColor={zone.color}
                style={{
                  left: `${zone.leftPercent}%`,
                  top: '65%',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            );
          })}

          {/* Action Wheel Button - positioned over the leaping Deadpool */}
          <div 
            className="absolute z-20"
            style={{
              left: '50%',
              top: '25%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <ActionWheelButton characterName={character.name} isEmbedded />
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <p className="text-xs text-muted-foreground/70 backdrop-blur-sm bg-black/50 px-4 py-2 rounded-full flex items-center gap-2">
          <span>←↑↓→</span>
          <span>Drag to explore</span>
        </p>
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

      {/* Hide scrollbar with CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}