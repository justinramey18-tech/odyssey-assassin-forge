// Empyrean quest hub: the solo Empyrean screen's quest board, with categories,
// standing ranks, category rewards and "Seek a quest". Quests and standing live in
// the solo game state's quest_flags (dm_game_state), like the regular solo DM's board.
// The decisions are made by planQuestUpdates (empyrean-quest-hub.ts); this hook applies them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  HUB_KEY,
  currentQuest,
  hubCategory,
  isHubCategory,
  normalizeHubState,
  planQuestUpdates,
  questCategory,
  rankInfo,
  signetStrainCeiling,
  storedHubState,
  type HubCategoryId,
  type HubState,
  type SeekContext,
} from '@/lib/empyrean-quest-hub';
import { seekQuests } from '@/lib/empyrean-quest-seeker';
import {
  WORLD_STATE_KEY,
  buildQuestKickoffPrompt,
  mergeWorldState,
  normalizeQuest,
  normalizeQuestMap,
  normalizeWorldState,
  questFromOffer,
  questTitle,
  toStored,
  toStoredWorldState,
  withQuestEvent,
  worldEntryFromQuest,
  type Quest,
  type RawQuestOffer,
  type WorldStateEntry,
} from '@/lib/quests';

export interface UseEmpyreanQuestsOptions {
  /** gameState.quest_flags from useDMGameState. */
  questFlags: Record<string, any> | undefined | null;
  upsertQuest: (key: string, patch: any) => void;
  removeQuest: (key: string) => void;
  onAddXP?: (amount: number, source: string) => void;
  onGoldChange?: (netChange: number) => void;
  /** Dragon & Bond rewards (useDragonBond().processQuestReward). */
  onBondReward?: (bondDelta: number, trustDelta: number, reason: string) => void;
  /** Signet quests clear strain. */
  onStrainRelief?: (amount: number) => void;
  /** Sends a message to the Empyrean DM (used when a quest is accepted). */
  sendMessage?: (text: string) => void;
  /** Story context for "Seek a quest", read at the moment of the tap. */
  getSeekContext: () => Omit<SeekContext, 'existingTitles'>;
}

export function useEmpyreanQuests(opts: UseEmpyreanQuestsOptions) {
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const quests = useMemo(() => normalizeQuestMap(opts.questFlags), [opts.questFlags]);
  const worldState = useMemo(() => normalizeWorldState(opts.questFlags), [opts.questFlags]);
  const hub = useMemo(() => normalizeHubState(opts.questFlags?.[HUB_KEY]), [opts.questFlags]);

  // Refs hold the newest values, including writes not yet re-rendered, so two quick
  // updates can never pay the same quest twice or lose a standing point.
  const questsRef = useRef<Quest[]>(quests);
  const hubRef = useRef<HubState>(hub);
  const worldRef = useRef<WorldStateEntry[]>(worldState);
  useEffect(() => { questsRef.current = quests; }, [quests]);
  useEffect(() => { hubRef.current = hub; }, [hub]);
  useEffect(() => { worldRef.current = worldState; }, [worldState]);

  const writeQuest = useCallback((key: string, stored: Record<string, unknown>) => {
    optsRef.current.upsertQuest(key, stored);
    const next = normalizeQuest(key, stored);
    const list = questsRef.current.filter(q => q.key !== key);
    questsRef.current = [...list, next];
  }, []);

  /** Record permanent outcomes on the world-state tracker, skipping repeats. */
  const recordWorldState = useCallback((raw: any[]) => {
    const { entries, added } = mergeWorldState(worldRef.current, raw ?? []);
    if (added.length === 0) return;
    worldRef.current = entries;
    optsRef.current.upsertQuest(WORLD_STATE_KEY, toStoredWorldState(entries) as any);
    toast(added.length === 1 ? 'The world has changed' : `${added.length} things changed the world`, {
      description: added.map(e => e.title).join(' · '),
      icon: '🌍',
    });
  }, []);

  /** The story extractor's quest results (useDmAutoSync onQuestUpdate). */
  const applyExtraction = useCallback((offers: RawQuestOffer[], progress: any[]) => {
    const plan = planQuestUpdates(questsRef.current, hubRef.current, offers, progress);
    const o = optsRef.current;
    for (const u of plan.upserts) writeQuest(u.key, u.stored);
    for (const q of plan.offered) {
      const cat = hubCategory(questCategory(q));
      toast(`New quest: ${questTitle(q)}`, { description: `${cat.emoji} ${cat.label} — open the Quest Hub to accept it.`, icon: '📜' });
    }
    for (const p of plan.payouts) {
      if (p.xp > 0) o.onAddXP?.(p.xp, `Quest: ${questTitle(p.quest)}`);
      if (p.gold > 0) o.onGoldChange?.(p.gold);
      const parts = [p.xp ? `${p.xp} XP` : '', p.gold ? `${p.gold} gold` : '', `+${p.points} standing`].filter(Boolean);
      toast.success(`Quest complete: ${questTitle(p.quest)}`, { description: parts.join(', ') });
    }
    for (const q of plan.failed) toast(`Quest failed: ${questTitle(q)}`, { icon: '🥀' });
    if (plan.hub) {
      hubRef.current = plan.hub;
      o.upsertQuest(HUB_KEY, storedHubState(plan.hub));
    }
    for (const r of plan.rankUps) {
      const cat = hubCategory(r.category);
      toast.success(`${cat.emoji} ${cat.label}: you are now ${r.to}`, { description: `Up from ${r.from}. Harder work is open to you.` });
    }
    if (plan.bondDelta || plan.trustDelta) o.onBondReward?.(plan.bondDelta, plan.trustDelta, 'Dragon & Bond quest');
    if (plan.strainRelief > 0) o.onStrainRelief?.(plan.strainRelief);
    if (plan.settled.length) recordWorldState(plan.settled.map(worldEntryFromQuest));
  }, [writeQuest, recordWorldState]);

  const accept = useCallback((key: string) => {
    const quest = questsRef.current.find(q => q.key === key);
    if (!quest || quest.status !== 'offered') return;
    const accepted = withQuestEvent({ ...quest, status: 'active', category: questCategory(quest) }, 'accepted', 'Quest accepted — the DM is now tracking it.');
    writeQuest(key, toStored(accepted));
    toast.success(`Accepted: ${questTitle(quest)}`);
    optsRef.current.sendMessage?.(buildQuestKickoffPrompt(accepted));
  }, [writeQuest]);

  const decline = useCallback((key: string) => {
    optsRef.current.removeQuest(key);
    questsRef.current = questsRef.current.filter(q => q.key !== key);
  }, []);

  /** Move a quest to another category (the player's call wins over the word sort). */
  const moveCategory = useCallback((key: string, category: HubCategoryId) => {
    if (!isHubCategory(category)) return;
    const quest = questsRef.current.find(q => q.key === key);
    if (!quest || questCategory(quest) === category) return;
    writeQuest(key, toStored({ ...quest, category }));
  }, [writeQuest]);

  const [seeking, setSeeking] = useState<HubCategoryId | null>(null);
  const seekingRef = useRef(false);

  /** "Seek a quest": 2–3 new offers in one category, fitted to the story and the rank. */
  const seek = useCallback(async (category: HubCategoryId) => {
    if (seekingRef.current) return;
    seekingRef.current = true;
    setSeeking(category);
    try {
      const rank = rankInfo(category, hubRef.current.points[category]);
      const ctx: SeekContext = {
        ...optsRef.current.getSeekContext(),
        existingTitles: questsRef.current.map(q => questTitle(q)),
      };
      const result = await seekQuests(category, rank.index, ctx);
      if (result.offers.length === 0) {
        toast.error('No quests this time', { description: result.error });
        return;
      }
      let added = 0;
      for (const offer of result.offers) {
        const quest = questFromOffer(offer);
        if (!quest || questsRef.current.some(q => q.key === quest.key)) continue;
        writeQuest(quest.key, toStored(withQuestEvent({ ...quest, category }, 'note', 'Found through the Quest Hub.')));
        added += 1;
      }
      const cat = hubCategory(category);
      if (added > 0) toast(`${added} new ${cat.label} quest${added === 1 ? '' : 's'}`, { icon: cat.emoji });
      else toast.error('No new quests this time', { description: 'They matched quests already on your board.' });
    } finally {
      seekingRef.current = false;
      setSeeking(null);
    }
  }, [writeQuest]);

  const getActiveQuests = useCallback(() => questsRef.current.filter(q => q.status === 'active'), []);
  const strainCeiling = signetStrainCeiling(hub.points.signet);
  const current = useMemo(() => currentQuest(quests), [quests]);

  return {
    quests,
    worldState,
    hub,
    current,
    strainCeiling,
    seeking,
    getActiveQuests,
    applyExtraction,
    recordWorldState,
    accept,
    decline,
    moveCategory,
    seek,
  };
}

export type EmpyreanQuests = ReturnType<typeof useEmpyreanQuests>;
