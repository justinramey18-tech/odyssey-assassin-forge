// Solo Empyrean's battle screen: the same stage, command box and Counter Clash ring the party
// fights use, driven by the solo fight hook. The server runs the fight in real time; this file
// only draws it and sends the rider's choices.

import { useEffect, useMemo, useState } from 'react';
import { buildQuickActionSections } from '@/components/ai-dm/PartyDMQuickActions';
import { BattleStage, type StageFighter, type StageLine } from '@/components/ai-dm/battle/BattleStage';
import { BattleCommandBox, type BattleMove, type BattleTarget } from '@/components/ai-dm/battle/BattleCommandBox';
import { CounterClashRing } from '@/components/ai-dm/CounterClashRing';
import type * as M from '@/lib/combatMinigames';
import type { CharacterContext } from '@/components/oracle/types';
import type { SoloFightApi } from '@/hooks/use-solo-fight';
import { signetStrainCost, type FightView, type RulesContext } from '@/lib/empyrean-rules-client';
import '@/components/ai-dm/battle/battle.css';

const SIGNET_LEVELS = [{ intensity: 2, label: 'focused' }, { intensity: 4, label: 'strong' }, { intensity: 6, label: 'all-out' }];
const TONE: Record<string, 'neutral' | 'warn' | 'good' | 'bad'> = { info: 'neutral', muted: 'neutral', warn: 'warn', good: 'good' };

/** The rider's sheet as a fight sees it: level, HP, armor, and the weapons from Quick Actions. */
export function buildFightSheet(ctx: CharacterContext | undefined, currentHp: number): NonNullable<RulesContext['sheet']> {
  const sections = buildQuickActionSections(ctx, ctx?.name || 'The rider');
  const weapons = sections.weapons
    .flatMap(w => !w.isEmptyWeaponSlot && w.weaponStats?.damage
      ? [{ name: w.name, damage: String(w.weaponStats.damage) }] : []).slice(0, 8);
  const bonus = sections.weapons.map(w => w.attackBonus).find(b => typeof b === 'number' && Number.isFinite(b));
  return {
    level: ctx?.level ?? 1, maxHp: ctx?.maxHP ?? 10, hp: Math.max(1, Math.min(ctx?.maxHP ?? 10, Math.round(currentHp) || 1)),
    ac: ctx?.defenses?.armorClass ?? 12, attackBonus: typeof bonus === 'number' ? bonus : null, weapons,
  };
}

interface Props {
  fight: SoloFightApi;
  characterContext: CharacterContext | undefined;
  bonded: boolean;
  signetName?: string;
  masteryRank: number;
  /** Strain the rider can still take before burning out. */
  strainRoom: number;
  onUseConsumableByName?: (name: string, quantity?: number) => boolean;
  /** The player left the finished fight. */
  onClosed: (view: FightView) => void;
}

export function SoloBattleScreen({ fight, characterContext, bonded, signetName, masteryRank, strainRoom, onUseConsumableByName, onClosed }: Props) {
  const view = fight.fight;
  const [, setBeat] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const running = view?.status === 'active';
  // Countdowns redraw four times a second; nothing here writes or calls the server.
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setBeat(n => n + 1), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  const sections = useMemo(() => buildQuickActionSections(characterContext, characterContext?.name || 'The rider'), [characterContext]);
  const potions = useMemo(() => sections.consumables.filter(c => c.rollKind === 'heal' && c.healingDice), [sections]);

  if (!view) return null;
  const now = fight.serverTime();
  const secs = (at: number) => Math.max(0, Math.ceil((at - now) / 1000));
  const standing = view.enemies.filter(e => e.status === 'up');
  const target = standing.find(e => e.id === picked) ?? standing.find(e => e.pending && e.pending.target !== 'dragon') ?? standing.slice().sort((a, b) => a.hp - b.hp)[0] ?? null;

  const enemies: StageFighter[] = view.enemies.map(e => {
    let line: StageLine | null = null;
    if (e.status === 'up' && e.pending) {
      const who = e.pending.target === 'dragon' ? (view.dragon?.name ?? 'your dragon').toUpperCase() : e.pending.target === 'both' ? 'EVERYONE' : 'YOU';
      line = { text: `▼ ${e.pending.label.toUpperCase()} at ${who} · ${secs(e.pending.strikeAt)}s`, tone: 'warn', blink: true };
    } else if (e.status === 'up') line = { text: `Acts in ${secs(e.nextAt)}s`, tone: 'muted' };
    return { id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, status: e.status === 'up' ? 'up' : view.lethal ? 'dead' : 'ko', tag: view.challenge, line, chips: e.pending?.warded ? ['WARDED'] : [] };
  });
  const me: StageFighter = { id: view.rider.id, name: view.rider.name, hp: view.rider.hp, maxHp: view.rider.maxHp, status: view.rider.hp > 0 ? 'up' : 'down', level: view.rider.level };
  const party: StageFighter[] = view.dragon ? [{ id: view.dragon.id, name: view.dragon.name, hp: view.dragon.hp, maxHp: view.dragon.maxHp, status: view.dragon.status === 'up' ? 'up' : 'dead', ally: true }] : [];

  const moves: BattleMove[] = [];
  const weapons = view.rider.weapons.length ? view.rider.weapons : ['Unarmed strike'];
  for (const name of weapons) {
    const w = sections.weapons.find(x => x.name === name);
    moves.push({ id: `w:${name}`, name, row: 'attack', side: 'enemy', sub: w?.weaponStats?.damage ? String(w.weaponStats.damage) : undefined });
  }
  if (bonded) for (const s of SIGNET_LEVELS) {
    const cost = signetStrainCost(s.intensity, masteryRank);
    moves.push({
      id: `s:${s.intensity}`, name: `${signetName || 'Signet'} (${s.label})`, row: 'spell', side: 'enemy', level: null, school: 'signet',
      sub: `${s.intensity}d6 · ${cost} strain`, disabledReason: cost > strainRoom ? 'Too much strain' : null,
    });
  }
  for (const p of potions) moves.push({ id: `p:${p.name}`, name: p.name, row: 'item', side: 'ally', sub: p.healingDice?.formula ?? undefined });

  const asTarget = (e: (typeof view.enemies)[number]): BattleTarget => ({ id: e.id, name: e.name, sub: `${e.hp}/${e.maxHp}` });
  const meTarget: BattleTarget = { id: me.id, name: me.name, sub: `${me.hp}/${me.maxHp}`, me: true };
  const onUse = (move: BattleMove, ids: string[]) => {
    const targetId = ids[0] ?? target?.id ?? '';
    if (move.id.startsWith('w:')) void fight.act({ type: 'attack', targetId, weapon: move.name });
    else if (move.id.startsWith('s:')) void fight.act({ type: 'signet', targetId, intensity: Number(move.id.slice(2)), strainRoom });
    else if (move.id.startsWith('p:')) {
      const potion = potions.find(p => p.name === move.name);
      void fight.act({ type: 'potion', name: move.name, dice: potion?.healingDice?.formula ?? undefined }).then(ok => {
        if (ok) onUseConsumableByName?.(move.name, 1);
      });
    }
  };

  const cooldownLeft = running ? secs(view.rider.readyAt) : 0;
  const aiming = running ? view.enemies.find(e => e.status === 'up' && e.pending?.clash && e.pending.target !== 'dragon') : undefined;
  const chain = aiming?.pending?.clash ?? null;
  const ended = view.status === 'ended';
  const title = ended ? (view.outcome === 'victory' ? 'VICTORY!' : view.outcome === 'fled' ? 'ESCAPED' : view.outcome === 'yield' ? 'YIELDED' : 'DEFEAT…') : view.lethal ? 'BATTLE!' : 'SPARRING';
  const endColor = view.outcome === 'victory' ? '#1e6a34' : view.outcome === 'defeat' ? '#7a1e14' : 'var(--b-ink)';
  const endNote = view.dragonDied ? `${view.dragon?.name ?? 'Your dragon'} is dead, and the bond takes you with it.`
    : view.riderDown ? 'You are down. What happens next is not up to you.'
    : view.outcome === 'victory' ? 'The result goes to the DM with your next message.'
    : view.outcome === 'defeat' ? 'Beaten, but breathing.' : 'The result goes to the DM with your next message.';

  return (
    <div className="battle-root fixed inset-0 z-[70] flex flex-col" style={{ background: 'var(--b-night)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="h-11 shrink-0 flex items-center gap-1 pl-3 pr-1" style={{ color: '#f4ecd8' }}>
        <span className="flex-1 text-[15px] font-bold tracking-[0.12em]" style={{ color: '#ff8a72' }}>{title}</span>
        <button type="button" onClick={() => setShowLog(v => !v)} aria-pressed={showLog} className="min-h-[44px] px-2.5 text-[13px] font-semibold" style={{ color: '#cfd6ec', touchAction: 'manipulation' }}>LOG</button>
      </div>

      <div className="relative flex-1 min-h-[300px]">
        <BattleStage enemies={enemies} party={party} me={me} targetId={target?.id ?? null} onPickEnemy={setPicked} flashes={fight.flashes} />
        {showLog && (
          <div className="absolute inset-2 battle-text p-3 overflow-y-auto overscroll-contain z-[4]" role="log" aria-label="Fight log">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[15px] font-bold">FIGHT LOG</span>
              <button type="button" onClick={() => setShowLog(false)} className="min-h-[40px] px-3 rounded text-[13px] font-bold text-white" style={{ background: '#4a4160', touchAction: 'manipulation' }}>CLOSE</button>
            </div>
            {view.log.length === 0 && <p className="text-[13px]">Nothing yet.</p>}
            {view.log.map(l => <p key={l.n} className="text-[13px] leading-snug">{l.text}</p>)}
          </div>
        )}
      </div>

      <div className="shrink-0 px-2 pt-2" style={{ background: 'var(--b-panel)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
        <BattleCommandBox
          feed={fight.line ? { text: fight.line.text, tone: TONE[fight.line.tone] ?? 'neutral' } : null}
          onSkipFeed={fight.skipFeed}
          idleText={target ? `What will ${view.rider.name.toUpperCase()} do?` : 'No one left to fight.'}
          rolling={fight.busy}
          locked={ended ? 'The fight is over.' : null}
          cooldownLeft={cooldownLeft}
          cooldownMax={8}
          moves={moves}
          enemyTarget={target ? asTarget(target) : null}
          enemies={standing.map(asTarget)}
          friends={[meTarget]}
          onUse={onUse}
          aidFor={() => []}
          special={ended ? null : view.lethal
            ? { label: 'FLEE', sub: view.dragon?.status === 'up' ? 'your dragon helps' : 'a hard roll', tone: 'wind', disabled: cooldownLeft > 0, onPress: () => void fight.act({ type: 'flee' }) }
            : { label: 'YIELD', sub: 'end the match', tone: 'wind', onPress: () => void fight.act({ type: 'yield' }) }}
          onChat={() => setShowLog(true)}
          chatLabel="FIGHT LOG"
          castLabel="SIGNET"
          noAid
          unread={0}
        />
      </div>

      {chain && aiming?.pending && (
        <CounterClashRing
          key={chain.id}
          skillName={aiming.pending.label}
          npcName={aiming.name}
          clash={chain as unknown as M.Clash}
          hitAt={aiming.pending.strikeAt}
          results={(view.rider.clash?.id === chain.id ? view.rider.clash.r : []) as Array<M.ClashQ | null>}
          serverTime={fight.serverTime}
          frozenAt={null}
          onTap={(side, tapAt) => fight.clash(aiming.id, side, tapAt)}
        />
      )}

      {ended && (
        <div className="battle-root fixed inset-x-3 top-1/2 -translate-y-1/2 z-[71] battle-text p-4 flex flex-col gap-3" role="dialog" aria-label={title}>
          <p className="text-[28px] font-bold text-center" style={{ color: endColor }}>{title}</p>
          <p className="text-[15px] text-center" style={{ color: 'var(--b-ink-soft)' }}>{endNote}</p>
          <button type="button" onClick={() => { const done = view; void fight.close().then(() => onClosed(done)); }}
            className="min-h-[48px] rounded-lg text-[16px] font-bold text-white" style={{ background: '#3a6ea8', border: '3px solid var(--b-edge)', touchAction: 'manipulation' }}>
            BACK TO THE STORY
          </button>
        </div>
      )}
    </div>
  );
}