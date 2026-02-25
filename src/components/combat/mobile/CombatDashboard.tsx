import { useState, useCallback } from 'react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import { Enemy } from '@/lib/combat/targetTypes';
import { UseTargetsReturn } from '@/hooks/use-targets';
import { UseInitiativeReturn } from '@/hooks/use-initiative';
import { PartyInitiativeState } from '@/hooks/use-party-sync';
import { SituationStrip } from './SituationStrip';
import { CombatDiceRoller } from './CombatDiceRoller';
import { TargetTrackerPanel } from './TargetTrackerPanel';
import { InitiativeTracker } from './InitiativeTracker';
import { ActionEconomyBar } from './ActionEconomyBar';

type PanelId = 'situation' | 'targets' | 'initiative';

interface CooldownWarningInfo {
  abilityId: string;
  name: string;
  remaining: number;
  actionType: 'action' | 'bonus_action' | 'reaction';
}

interface CombatDashboardProps {
  // Situation strip
  conditions: string[];
  onConditionsChange: (conditions: string[]) => void;

  // Dice roller
  onShareToParty?: (label: string, expression: string, result: number, details: unknown) => void;

  // Target tracker
  targetTracker: UseTargetsReturn;
  onMarkTarget?: (enemy: Enemy) => void;

  // Initiative tracker
  initiativeTracker: UseInitiativeReturn;
  onUpdateEnemyInitiative: (id: string, initiative: number | undefined) => void;
  dexModifier: number;
  onBroadcastInitiative?: (order: Array<{ name: string; initiative: number; isCurrentTurn: boolean }>, round: number) => void;
  onClearInitiative?: () => void;
  partyInitiatives?: PartyInitiativeState[];

  // Action economy bar
  actionEconomy: ActionEconomy;
  onEconomyChange: (economy: ActionEconomy) => void;
  actionCount: number;
  bonusCount: number;
  reactionCount: number;
  round: number;
  coolingAbilities?: CooldownWarningInfo[];
  onEndTurn: () => void;
  onEndTurnWithSynthesis?: () => void;
}

/**
 * CombatDashboard orchestrates the five sticky panels above the scrollable
 * combat sections. It enforces an "accordion" rule: only one collapsible
 * panel (Situation, Targets, Initiative) can be expanded at a time.
 * CombatDiceRoller and ActionEconomyBar are always visible.
 */
export function CombatDashboard({
  // Situation
  conditions,
  onConditionsChange,
  // Dice
  onShareToParty,
  // Targets
  targetTracker,
  onMarkTarget,
  // Initiative
  initiativeTracker,
  onUpdateEnemyInitiative,
  dexModifier,
  onBroadcastInitiative,
  onClearInitiative,
  partyInitiatives,
  // Action economy
  actionEconomy,
  onEconomyChange,
  actionCount,
  bonusCount,
  reactionCount,
  round,
  coolingAbilities,
  onEndTurn,
  onEndTurnWithSynthesis,
}: CombatDashboardProps): JSX.Element {
  // Only one collapsible panel can be open at a time; null = all collapsed
  const [expandedPanel, setExpandedPanel] = useState<PanelId | null>(null);

  const handlePanelToggle = useCallback((panel: PanelId, wantsCollapsed: boolean) => {
    if (wantsCollapsed) {
      // Collapsing the currently open panel
      setExpandedPanel(null);
    } else {
      // Expanding this panel — auto-collapse any other
      setExpandedPanel(panel);
    }
  }, []);

  return (
    <>
      {/* Situation Strip */}
      <SituationStrip
        conditions={conditions}
        onConditionsChange={onConditionsChange}
        isCollapsed={expandedPanel !== 'situation'}
        onCollapsedChange={(collapsed) => handlePanelToggle('situation', collapsed)}
      />

      {/* Compact Dice Roller Widget — always visible */}
      <CombatDiceRoller onShareToParty={onShareToParty} />

      {/* Target/Enemy Tracker */}
      <TargetTrackerPanel
        targets={targetTracker}
        isCollapsed={expandedPanel !== 'targets'}
        onCollapsedChange={(collapsed) => handlePanelToggle('targets', collapsed)}
        onMarkTarget={onMarkTarget}
      />

      {/* Initiative Tracker */}
      <InitiativeTracker
        initiative={initiativeTracker}
        enemies={targetTracker.enemies}
        onUpdateEnemyInitiative={onUpdateEnemyInitiative}
        dexModifier={dexModifier}
        isCollapsed={expandedPanel !== 'initiative'}
        onCollapsedChange={(collapsed) => handlePanelToggle('initiative', collapsed)}
        onBroadcastInitiative={onBroadcastInitiative}
        onClearInitiative={onClearInitiative}
        partyInitiatives={partyInitiatives}
      />

      {/* Action Economy Bar — always visible */}
      <ActionEconomyBar
        economy={actionEconomy}
        onEconomyChange={onEconomyChange}
        actionCount={actionCount}
        bonusCount={bonusCount}
        reactionCount={reactionCount}
        round={round}
        coolingAbilities={coolingAbilities}
        onEndTurn={onEndTurn}
        onEndTurnWithSynthesis={onEndTurnWithSynthesis}
      />
    </>
  );
}
