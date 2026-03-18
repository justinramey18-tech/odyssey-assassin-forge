import { useState, useCallback, useEffect } from 'react';
import { X, Gem, BookOpen, Sparkles, ScrollText, Map, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { EmpyreanCampaignPack } from '@/components/settings/EmpyreanCampaignPack';
import { EmpyreanPromptLibrary } from '@/components/settings/EmpyreanPromptLibrary';
import { SessionZeroWizard } from '@/components/empyrean/SessionZeroWizard';
import { ArcPlannerWizard } from '@/components/empyrean/ArcPlannerWizard';
import { SessionPlannerWizard } from '@/components/empyrean/SessionPlannerWizard';
import { EmpyreanCampaignSetup } from '@/components/empyrean/EmpyreanCampaignSetup';
import { EmpyreanDMScreen } from '@/components/empyrean/EmpyreanDMScreen';
import { loadEmpyreanDMConfig, EmpyreanDMConfig } from '@/lib/empyreanDMPersona';
import { CharacterContext } from '@/components/oracle/types';

interface EmpyreanScreenProps {
  open: boolean;
  onClose: () => void;
  characterName: string;
  characterContext: CharacterContext;
}

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  onClick: () => void;
}

function SectionCard({ icon, title, description, color, borderColor, onClick }: SectionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-4 rounded-xl",
        "border bg-card/30 backdrop-blur-sm",
        "hover:bg-card/50 active:scale-[0.98] transition-all duration-200",
        borderColor,
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        color,
      )}>
        {icon}
      </div>
      <div className="text-left min-w-0">
        <p className="text-sm font-cinzel font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-2">{description}</p>
      </div>
    </button>
  );
}

export function EmpyreanScreen({ open, onClose, characterName }: EmpyreanScreenProps) {
  const { guides, addGuide, deleteGuide, updateGuide } = useGMGuides();
  const [showPack, setShowPack] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showSessionZero, setShowSessionZero] = useState(false);
  const [showArcPlanner, setShowArcPlanner] = useState(false);
  const [showSessionPlanner, setShowSessionPlanner] = useState(false);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-background via-background to-background/95">
      {/* Fixed Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">📖</span>
          <h2 className="text-lg font-cinzel font-bold text-purple-400">The Empyrean Campaign</h2>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-muted/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto pb-20">
          {/* Intro */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            All Empyrean campaign tools in one place — prompts, guides, session builders, and arc planners.
          </p>

          {/* Section: Prompts */}
          <div className="space-y-2">
            <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-purple-400/70 px-1">
              Prompts & Guides
            </h3>
            <SectionCard
              icon={<Gem className="w-6 h-6 text-amber-400" />}
              title="Empyrean Prompt Library"
              description="59 themed RP prompts across 8 Infinity Stones — copy & paste into your AI DM"
              color="bg-amber-500/15"
              borderColor="border-amber-500/25"
              onClick={() => setShowPrompts(true)}
            />
            <SectionCard
              icon={<BookOpen className="w-6 h-6 text-cyan-400" />}
              title="GM Guides — Campaign Pack"
              description="Lore, tone, pacing, and session type guides — install to shape your AI DM"
              color="bg-cyan-500/15"
              borderColor="border-cyan-500/25"
              onClick={() => setShowPack(true)}
            />
          </div>

          {/* Section: Wizards */}
          <div className="space-y-2">
            <h3 className="text-xs font-cinzel font-bold uppercase tracking-wider text-purple-400/70 px-1">
              Campaign Builders
            </h3>
            <SectionCard
              icon={<ScrollText className="w-6 h-6 text-emerald-400" />}
              title="Session Zero Wizard"
              description="Set content boundaries, backstory depth, and player style preferences"
              color="bg-emerald-500/15"
              borderColor="border-emerald-500/25"
              onClick={() => setShowSessionZero(true)}
            />
            <SectionCard
              icon={<Map className="w-6 h-6 text-indigo-400" />}
              title="Arc Planner Wizard"
              description="Build multi-session arcs with templates, pacing, and branching paths"
              color="bg-indigo-500/15"
              borderColor="border-indigo-500/25"
              onClick={() => setShowArcPlanner(true)}
            />
            <SectionCard
              icon={<Target className="w-6 h-6 text-rose-400" />}
              title="Session Planner"
              description="Plan individual sessions with objectives, NPCs, and complications"
              color="bg-rose-500/15"
              borderColor="border-rose-500/25"
              onClick={() => setShowSessionPlanner(true)}
            />
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-4">
            Empyrean Campaign System v2.0
          </p>
        </div>
      </div>

      {/* Sub-screens */}
      <EmpyreanPromptLibrary
        open={showPrompts}
        onOpenChange={setShowPrompts}
        characterName={characterName}
      />
      <EmpyreanCampaignPack
        open={showPack}
        onOpenChange={setShowPack}
        guides={guides}
        addGuide={addGuide}
        deleteGuide={deleteGuide}
        updateGuide={updateGuide}
      />
      <SessionZeroWizard
        open={showSessionZero}
        onClose={() => setShowSessionZero(false)}
        addGuide={addGuide}
      />
      <ArcPlannerWizard
        open={showArcPlanner}
        onClose={() => setShowArcPlanner(false)}
        addGuide={addGuide}
      />
      <SessionPlannerWizard
        open={showSessionPlanner}
        onClose={() => setShowSessionPlanner(false)}
        addGuide={addGuide}
      />
    </div>
  );
}
