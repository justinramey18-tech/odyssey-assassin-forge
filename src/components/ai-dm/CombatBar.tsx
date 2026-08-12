import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Flag,
  Footprints,
  Heart,
  Settings,
  Shield,
  Sparkles,
  Sword,
  User,
  Zap,
} from 'lucide-react';

import { Sheet, SheetContent } from '@/components/ui/sheet';

import { DMDiceRoller } from './DMDiceRoller';

import { PartyDMQuickActions } from './PartyDMQuickActions';

import { useActionEconomy } from '@/hooks/use-action-economy';

import { movementSteps, resolveMaxMovement } from '@/lib/combat/speed';

import type { ActionCost } from '@/lib/combat/actionCost';

import type { UsePartyCombatTurnReturn } from '@/hooks/use-party-combat-turn';

import type { CharacterContext } from '@/components/oracle/types';

import type { HealRollResult } from '@/lib/promptAutoRoll';



export interface CombatBarProps {

  characterContext?: CharacterContext;

  characterName: string;

  /** Feeds the dice roller's result back into the composer. */

  onDiceRoll: (message: string) => void;

  /** Puts a generated prompt into the composer. */

  onUsePrompt: (prompt: string) => void;

  onHealingItemUsed?: (itemName: string, healRoll: HealRollResult) => string | null;

  empyreanDragonName?: string;

  isGenerating?: boolean;



  /** Host sees the gear button and the turn stepper. */

  isHost: boolean;

  /** Built lazily so the settings tree is not mounted until it is opened. */

  renderSettings?: () => React.ReactNode;



  /** Party turn state from usePartyCombatTurn. */

  turn: UsePartyCombatTurnReturn;



  /** Opens the full character sheet. */

  onOpenCharacterSheet?: () => void;



  /** Wild Shape, so the movement box shows the beast's real speed. */

  isTransformed?: boolean;

  wildShapeSpeed?: string | null;

}



type SheetKind = 'dice' | 'settings' | null;

type ActionsKind = 'combat' | 'magic' | null;



export function CombatBar({

  characterContext,

  characterName,

  onDiceRoll,

  onUsePrompt,

  onHealingItemUsed,

  empyreanDragonName,

  isGenerating,

  isHost,

  renderSettings,

  turn,

  onOpenCharacterSheet,

  isTransformed,

  wildShapeSpeed,

}: CombatBarProps) {

  const economy = useActionEconomy();

  const [sheet, setSheet] = useState<SheetKind>(null);

  const [actionsSheet, setActionsSheet] = useState<ActionsKind>(null);

  const [movementOpen, setMovementOpen] = useState(false);



  const maxMovement = useMemo(

    () => resolveMaxMovement({ isTransformed, wildShapeSpeed }),

    [isTransformed, wildShapeSpeed],
  );



  // Keep the store's max in step with the character's real speed.

  // MUST be an effect: the store notifies subscribers synchronously, so writing

  // to it during render would re-enter render and loop.

  const setMax = economy.setMaxMovement;

  const storedMax = economy.economy.maxMovement;

  useEffect(() => {

    if (storedMax !== maxMovement) setMax(maxMovement);

  }, [storedMax, maxMovement, setMax]);



  const currentHP = characterContext?.currentHP ?? 0;

  const maxHP = characterContext?.maxHP ?? 0;

  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 0;

  const hpTone =

    hpPct <= 25 ? 'bg-red-500' : hpPct <= 50 ? 'bg-amber-500' : 'bg-emerald-500';



  const handleSpend = useCallback(

    (cost: ActionCost, name: string) => {

      economy.spend(cost, name);

    },

    [economy],
  );



  const spentCosts = useMemo(

    () => ({

      action: economy.economy.actionUsed,

      bonus: economy.economy.bonusActionUsed,

      reaction: economy.economy.reactionUsed,

    }),

    [economy.economy.actionUsed, economy.economy.bonusActionUsed, economy.economy.reactionUsed],

  );



  const waiting = turn.isStarted && !turn.isMyTurn;



  return (

    <>

      <div className="shrink-0 border-t border-red-900/40 bg-black/70 backdrop-blur-sm">

        {/* ── Turn banner ─────────────────────────────────────────────── */}

        {turn.isStarted && (

          <div

            className={cn(

              'flex items-center gap-2 px-3 py-1.5 border-b',

              turn.isMyTurn

                ? 'border-amber-500/40 bg-amber-500/10'

                : 'border-white/10 bg-white/[0.03]',

            )}

          >

            <span className="text-[10px] font-mono text-white/40 shrink-0">

              R{turn.turn.round}

            </span>

            <span

              className={cn(

                'text-xs font-semibold truncate flex-1',

                turn.isMyTurn ? 'text-amber-300' : 'text-white/60',

              )}

            >

              {turn.isMyTurn ? 'YOUR TURN' : `${turn.activeName}'s turn`}

            </span>

            {!turn.isMyTurn && turn.myTurnsAway !== null && turn.myTurnsAway > 0 && (

              <span className="text-[10px] text-white/35 shrink-0">

                {turn.myTurnsAway} away

              </span>

            )}

            {isHost && (

              <div className="flex items-center gap-1 shrink-0">

                <button

                  onClick={turn.previousTurn}

                  aria-label="Previous turn"

                  className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10"

                  style={{ touchAction: 'manipulation' }}

                >

                  <ChevronLeft className="w-3.5 h-3.5 text-white/60" />

                </button>

                <button

                  onClick={turn.nextTurn}

                  aria-label="Next turn"

                  className="p-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30"

                  style={{ touchAction: 'manipulation' }}

                >

                  <ChevronRight className="w-3.5 h-3.5 text-amber-300" />

                </button>

              </div>

            )}

          </div>

        )}



        {/* ── Action economy strip ────────────────────────────────────── */}

        <div className="flex border-b border-red-900/30">

          <EconomyBox

            icon={<Sword className="w-4 h-4" />}

            label="ACTION"

            used={economy.economy.actionUsed}

            tone="red"

            onToggle={() =>

              economy.economy.actionUsed ? economy.restoreAction() : economy.useAction()

            }

          />

          <div className="w-px bg-red-900/30" />

          <EconomyBox

            icon={<Zap className="w-4 h-4" />}

            label="BONUS"

            used={economy.economy.bonusActionUsed}

            tone="amber"

            onToggle={() =>

              economy.economy.bonusActionUsed ? economy.restoreBonus() : economy.useBonus()

            }

          />

          <div className="w-px bg-red-900/30" />

          <EconomyBox

            icon={<Shield className="w-4 h-4" />}

            label="REACT"

            used={economy.economy.reactionUsed}

            tone="cyan"

            /* Reactions are usable on other creatures' turns, so this box never dims for waiting. */

            onToggle={() =>

              economy.economy.reactionUsed ? economy.restoreReaction() : economy.useReaction()

            }

          />

          <div className="w-px bg-red-900/30" />

          <button

            onClick={() => setMovementOpen(true)}

            aria-label="Set movement used"

            className={cn(

              'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all active:scale-95',

              economy.economy.movementUsed >= maxMovement

                ? 'bg-muted/20 opacity-50'

                : 'bg-green-500/10',

            )}

            style={{ touchAction: 'manipulation' }}

          >

            <Footprints

              className={cn(

                'w-4 h-4',

                economy.economy.movementUsed >= maxMovement

                  ? 'text-muted-foreground'

                  : 'text-green-400',

              )}

            />

            <span className="text-[11px] font-mono font-bold text-white/80">

              {economy.economy.movementUsed}/{maxMovement}

            </span>

            <span className="text-[8px] font-mono text-white/40">MOVE</span>

          </button>

        </div>



        {/* ── HP + end turn ───────────────────────────────────────────── */}

        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">

          <button

            onClick={onOpenCharacterSheet}

            disabled={!onOpenCharacterSheet}

            aria-label="Open character sheet"

            className="shrink-0 w-8 h-8 rounded-full border border-amber-500/40 bg-amber-500/10 flex items-center justify-center disabled:opacity-50"

            style={{ touchAction: 'manipulation' }}

          >

            <User className="w-4 h-4 text-amber-300" />

          </button>



          <div className="flex-1 min-w-0">

            <div className="flex items-center gap-2">

              <span className="text-xs font-cinzel text-foreground truncate">

                {characterContext?.name || characterName || 'Adventurer'}

              </span>

              <span className="text-[10px] text-white/45 shrink-0 flex items-center gap-1">

                <Heart className="w-3 h-3 text-red-400" />

                {maxHP > 0 ? `${currentHP}/${maxHP}` : '—'}

              </span>

            </div>

            <div className="mt-1 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">

              <div

                className={cn('h-full rounded-full transition-all duration-300', hpTone)}

                style={{ width: `${hpPct}%` }}

              />

            </div>

          </div>



          <button

            onClick={economy.endTurn}

            aria-label="End turn"

            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 transition-all"

            style={{ touchAction: 'manipulation' }}

          >

            <Flag className="w-3.5 h-3.5 text-amber-300" />

            <span className="text-[11px] font-semibold text-amber-300">END</span>

          </button>

        </div>



        {/* ── Buttons ─────────────────────────────────────────────────── */}

        <div className="flex items-stretch gap-2 px-3 py-2.5">

          <BarButton

            icon={<Dices className="w-5 h-5" />}

            label="DICE"

            tone="amber"

            disabled={isGenerating || !characterContext}

            onClick={() => setSheet('dice')}

          />

          <BarButton

            icon={<Sword className="w-5 h-5" />}

            label="ACTIONS"

            tone="emerald"

            disabled={isGenerating || !characterContext}

            onClick={() => setActionsSheet('combat')}

          />

          <BarButton

            icon={<Sparkles className="w-5 h-5" />}

            label="SPELLS"

            tone="violet"

            disabled={isGenerating || !characterContext}

            onClick={() => setActionsSheet('magic')}

          />

          {renderSettings && (

            <button

              onClick={() => setSheet('settings')}

              aria-label="Host settings"

              className="shrink-0 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center"

              style={{ touchAction: 'manipulation' }}

            >

              <Settings className="w-5 h-5 text-white/70" />

            </button>

          )}

        </div>



        {waiting && (

          <p className="px-3 pb-2 -mt-1 text-[10px] text-white/35">

            Waiting on {turn.activeName}. Your reaction is still available.

          </p>

        )}

      </div>



      {/* ── Movement picker ───────────────────────────────────────────── */}

      <Sheet open={movementOpen} onOpenChange={setMovementOpen}>

        <SheetContent side="bottom" className="h-[42vh] rounded-t-2xl">

          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />

          <p className="text-center text-sm font-cinzel text-green-400 mb-4">Movement Used</p>

          <div className="grid grid-cols-4 gap-3">

            {movementSteps(maxMovement).map(value => (

              <button

                key={value}

                onClick={() => {

                  economy.updateMovement(value);

                  setMovementOpen(false);

                }}

                className={cn(

                  'h-14 rounded-lg text-base font-mono border transition-colors',

                  economy.economy.movementUsed === value

                    ? 'bg-green-500/20 border-green-500/50 text-green-300'

                    : 'border-white/10 text-white/70 hover:bg-white/5',

                )}

                style={{ touchAction: 'manipulation' }}

              >

                {value}ft

              </button>

            ))}

          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">

            Max movement: {maxMovement}ft

          </p>

        </SheetContent>

      </Sheet>



      {/* ── Dice / settings ───────────────────────────────────────────── */}

      <Sheet open={sheet !== null} onOpenChange={open => !open && setSheet(null)}>

        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl overflow-y-auto p-0">

          <div className="w-12 h-1 bg-muted rounded-full mx-auto my-3" />

          {sheet === 'dice' && characterContext && (

            <div className="px-3 pb-6">

              <DMDiceRoller

                characterContext={characterContext}

                onRollResult={message => {

                  onDiceRoll(message);

                  setSheet(null);

                }}

                disabled={isGenerating}

              />

            </div>

          )}

          {sheet === 'settings' && renderSettings && (

            <div className="pb-6">{renderSettings()}</div>

          )}

        </SheetContent>

      </Sheet>



      {/* ── Actions / spells ──────────────────────────────────────────── */}

      <PartyDMQuickActions

        open={actionsSheet !== null}

        onOpenChange={open => !open && setActionsSheet(null)}

        characterContext={characterContext}

        characterName={characterName}

        onUsePrompt={onUsePrompt}

        onHealingItemUsed={onHealingItemUsed}

        empyreanDragonName={empyreanDragonName}

        sectionFilter={actionsSheet ?? undefined}

        spentCosts={spentCosts}

        onActionSpent={handleSpend}

      />

    </>

  );

}



// ─── Pieces ───────────────────────────────────────────────────────────────────



const ECONOMY_TONES = {

  red: 'bg-red-500/15 text-red-300',

  amber: 'bg-amber-500/15 text-amber-300',

  cyan: 'bg-cyan-500/15 text-cyan-300',

} as const;



function EconomyBox({

  icon,

  label,

  used,

  tone,

  onToggle,

}: {

  icon: React.ReactNode;

  label: string;

  used: boolean;

  tone: keyof typeof ECONOMY_TONES;

  onToggle: () => void;

}) {

  return (

    <button

      onClick={onToggle}

      aria-label={`${label}: ${used ? 'used, tap to restore' : 'ready, tap to mark used'}`}

      aria-pressed={used}

      className={cn(

        'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all active:scale-95',

        used ? 'bg-muted/20 text-muted-foreground opacity-50' : ECONOMY_TONES[tone],

      )}

      style={{ touchAction: 'manipulation' }}

    >

      {icon}

      <span className={cn('text-[9px] font-mono', used && 'line-through')}>{label}</span>

      <span className="text-[8px] font-mono text-white/40">{used ? 'USED' : 'READY'}</span>

    </button>

  );

}



const BAR_TONES = {

  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',

  emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',

  violet: 'border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',

} as const;



function BarButton({

  icon,

  label,

  tone,

  disabled,

  onClick,

}: {

  icon: React.ReactNode;

  label: string;

  tone: keyof typeof BAR_TONES;

  disabled?: boolean;

  onClick: () => void;

}) {

  return (

    <button

      onClick={onClick}

      disabled={disabled}

      className={cn(

        'flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all active:scale-95',

        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',

        BAR_TONES[tone],

      )}

      style={{ touchAction: 'manipulation' }}

    >

      {icon}

      <span className="text-[10px] font-semibold tracking-wide">{label}</span>

    </button>

  );

}


