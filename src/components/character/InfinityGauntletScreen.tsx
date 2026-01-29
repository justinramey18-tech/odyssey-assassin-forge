import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { characterPrompts, CharacterPrompt } from '@/lib/characterPrompts';
import { PromptEditModal } from './PromptEditModal';
import gauntletBackground from '@/assets/infinity-gauntlet-screen.jpg';
import './InfinityGauntletStyles.css';

// Map categories to Infinity Stones - positioned to match gauntlet image
// Knuckle row (L to R): Orange, Red, Purple, Orange/Green, Red(thumb)
// Large central stone: Orange/Yellow
// Forearm stone: Red/Pink
const infinityStones = [
  {
    id: 'soul',
    name: 'Soul Stone',
    color: '#f97316', // Orange - pinky knuckle (leftmost)
    glowColor: 'rgba(249, 115, 22, 0.6)',
    categories: ['Emotional', 'Social'],
    position: { top: '19.5%', left: '24%' },
  },
  {
    id: 'reality',
    name: 'Reality Stone',
    color: '#ef4444', // Red - ring finger knuckle
    glowColor: 'rgba(239, 68, 68, 0.6)',
    categories: ['World'],
    position: { top: '17%', left: '36%' },
  },
  {
    id: 'power',
    name: 'Power Stone',
    color: '#a855f7', // Purple - middle finger knuckle
    glowColor: 'rgba(168, 85, 247, 0.6)',
    categories: ['Combat'],
    position: { top: '15.5%', left: '50%' },
  },
  {
    id: 'time',
    name: 'Time Stone',
    color: '#22c55e', // Green - index finger knuckle
    glowColor: 'rgba(34, 197, 94, 0.6)',
    categories: ['Meta Requests'],
    position: { top: '17%', left: '64%' },
  },
  {
    id: 'mind',
    name: 'Mind Stone',
    color: '#eab308', // Yellow - large central stone on back of hand
    glowColor: 'rgba(234, 179, 8, 0.6)',
    categories: ['Investigation'],
    position: { top: '31%', left: '50%' },
  },
  {
    id: 'space',
    name: 'Space Stone',
    color: '#3b82f6', // Blue - forearm stone
    glowColor: 'rgba(59, 130, 246, 0.6)',
    categories: ['Voice & Tone', 'Narrative'],
    position: { top: '50%', left: '50%' },
  },
];

interface InfinityGauntletScreenProps {
  characterName: string;
  open: boolean;
  onClose: () => void;
}

export function InfinityGauntletScreen({ characterName, open, onClose }: InfinityGauntletScreenProps) {
  const [activeStone, setActiveStone] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<CharacterPrompt | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  if (!open) return null;

  const handleStoneClick = (stoneId: string) => {
    setActiveStone(activeStone === stoneId ? null : stoneId);
  };

  const handlePromptClick = (prompt: CharacterPrompt) => {
    setSelectedPrompt(prompt);
    setShowEditModal(true);
    setActiveStone(null);
  };

  const getPromptsForStone = (stoneId: string) => {
    const stone = infinityStones.find(s => s.id === stoneId);
    if (!stone) return [];
    return characterPrompts.filter(p => stone.categories.includes(p.category));
  };

  const activeStoneData = infinityStones.find(s => s.id === activeStone);

  return (
    <div className="fixed inset-0 z-[60] bg-black animate-in fade-in duration-300">
      {/* Background Image */}
      <img 
        src={gauntletBackground} 
        alt="Infinity Gauntlet"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      
      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
      
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-3 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 hover:bg-black/70 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Title */}
      <div className="absolute top-6 left-0 right-0 text-center z-10">
        <h1 className="font-cinzel text-2xl font-bold text-white drop-shadow-lg tracking-wider">
          RP Action Prompts
        </h1>
        <p className="text-white/70 text-sm mt-1">Tap an Infinity Stone</p>
      </div>

      {/* Infinity Stones - Invisible tap targets */}
      <div className="absolute inset-0 z-10">
        {infinityStones.map((stone) => (
          <button
            key={stone.id}
            onClick={() => handleStoneClick(stone.id)}
            className={cn(
              'absolute w-14 h-14 rounded-full transition-all duration-300',
              'transform -translate-x-1/2 -translate-y-1/2',
              activeStone === stone.id ? 'scale-125 z-20' : 'hover:scale-110'
            )}
            style={{
              top: stone.position.top,
              left: stone.position.left,
              backgroundColor: 'transparent',
            }}
            title={stone.name}
          >
            <span className="sr-only">{stone.name}</span>
          </button>
        ))}
      </div>

      {/* Stone Dropdown Menu */}
      {activeStone && activeStoneData && (
        <div 
          className="absolute z-30 w-72 max-h-[45vh] overflow-y-auto rounded-xl border-2 bg-card/95 backdrop-blur-md shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{
            top: '55%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderColor: activeStoneData.color,
            boxShadow: `0 0 30px ${activeStoneData.glowColor}`,
          }}
        >
          {/* Stone Header with Close Button */}
          <div 
            className="sticky top-0 z-10 p-3 border-b backdrop-blur-md"
            style={{ 
              backgroundColor: `${activeStoneData.color}20`,
              borderColor: `${activeStoneData.color}50`,
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 
                  className="font-display text-lg font-bold flex items-center gap-2"
                  style={{ color: activeStoneData.color }}
                >
                  <span 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: activeStoneData.color }}
                  />
                  {activeStoneData.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeStoneData.categories.join(' & ')}
                </p>
              </div>
              <button
                onClick={() => setActiveStone(null)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: activeStoneData.color }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Prompts List */}
          <div className="p-2 space-y-1">
            {getPromptsForStone(activeStone).map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => handlePromptClick(prompt)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg',
                  'bg-background/50 hover:bg-accent/30 border border-transparent',
                  'transition-all duration-200 group'
                )}
                style={{
                  ['--hover-border-color' as string]: `${activeStoneData.color}50`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${activeStoneData.color}50`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{prompt.icon}</span>
                  <span className="font-body text-sm text-foreground group-hover:text-white transition-colors">
                    {prompt.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {activeStone && (
        <div 
          className="absolute inset-0 z-5"
          onClick={() => setActiveStone(null)}
        />
      )}

      {/* Prompt Edit Modal */}
      {selectedPrompt && (
        <PromptEditModal
          prompt={selectedPrompt}
          characterName={characterName}
          open={showEditModal}
          onOpenChange={setShowEditModal}
        />
      )}

      {/* Stone Legend at Bottom - Energy Flow Buttons */}
      <div className="absolute bottom-6 left-0 right-0 z-10 px-4">
        <div className="flex flex-wrap justify-center gap-2">
          {infinityStones.map((stone, index) => (
            <button
              key={stone.id}
              onClick={() => handleStoneClick(stone.id)}
              className={cn(
                'energy-button relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium overflow-hidden',
                'backdrop-blur-sm transition-all duration-300',
                activeStone === stone.id 
                  ? 'scale-110 z-20' 
                  : 'hover:scale-105'
              )}
              style={{
                '--stone-color': stone.color,
                '--stone-glow': stone.glowColor,
                '--animation-delay': `${index * 0.15}s`,
                background: `linear-gradient(135deg, ${stone.color}20, ${stone.color}40)`,
                border: `1px solid ${stone.color}60`,
                boxShadow: activeStone === stone.id 
                  ? `0 0 25px ${stone.glowColor}, 0 0 50px ${stone.glowColor}` 
                  : `0 0 10px ${stone.glowColor}`,
              } as React.CSSProperties}
            >
              {/* Energy flow background */}
              <div className="energy-flow" style={{ background: `linear-gradient(90deg, transparent, ${stone.color}, transparent)` }} />
              <div className="energy-pulse" style={{ background: `radial-gradient(circle, ${stone.color}80, transparent)` }} />
              <div className="electricity-arc" style={{ background: `linear-gradient(90deg, transparent, ${stone.color}, transparent)` }} />
              
              {/* Stone indicator or X close button when active */}
              {activeStone === stone.id ? (
                <span 
                  className="relative z-10 w-4 h-4 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </span>
              ) : (
                <span 
                  className="relative z-10 w-3 h-3 rounded-full animate-pulse"
                  style={{ 
                    backgroundColor: stone.color,
                    boxShadow: `0 0 8px ${stone.color}, 0 0 16px ${stone.glowColor}`,
                  }}
                />
              )}
              <span className="relative z-10 text-white font-semibold tracking-wide drop-shadow-lg">
                {stone.categories[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
