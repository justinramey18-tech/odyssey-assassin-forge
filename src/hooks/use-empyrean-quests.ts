// Empyrean quest hub: the solo Empyrean screen's quest board, with categories,
// standing ranks, category rewards and "Seek a quest". Quests and standing live in
// the solo game state's quest_flags (dm_game_state), like the regular solo DM's board.
// The decisions are made by planQuestUpdates (empyrean-quest-hub.ts); this hook applies them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  HUB_KEY,
  PAYOUTS_KEY,
  currentQuest,
  hubPayout,
  hubCategory,
  isHubCategory,
  normalizeHubState,
  normalizePendingPayouts,
  planQuestUpdates,
  questCategory,
  rankInfo,
  signetStrainCeiling,
  storedHubState,
  CARDS_KEY,
  addQuestCards,
  cardsFromUpdate,
  normalizeQuestCards,
  storedQuestCards,
  type QuestCard,
  storedPendingPayouts,
  withQuestRewards,
  type HubCategoryId,
  type HubState,
  type HubPayout,
  type QuestPayResult,
  type SeekContext,
} from '@/lib/empyrean-quest-hub';
import { seekQuests } from '@/lib/empyrean-quest-seeker';

import {

  GUIDES_KEY,

  MAX_GUIDED_QUESTS,

  finishedGuideKeys,

  guideSlotFree,

  guideStages,

  keepsObjectives,

  normalizeQuestGuides,

  progressFromTags,

  readQuestTags,

  storedQuestGuides,

  type GuideContext,

  type QuestGuide,

  type QuestGuideMap,

} from '@/lib/empyrean-quest-guide';

import { writeQuestGuide } from '@/lib/empyrean-quest-guide-writer';
import { addPendingDmItems } from '@/lib/pendingDmItems';
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
  /** Rules engine: send this quest's XP and gold to the server (see QuestPayResult). Without it, quests pay on the phone. */
  payQuest?: (payout: HubPayout) => Promise<QuestPayResult>;
  /** Sends a message to the Empyrean DM (used when a quest is accepted). Resolving false means the DM was busy and nothing was sent. */
  sendMessage?: (text: string) => unknown;

  /** Story context for a quest's GM guide, read when the writer is called. Without it the Seek context is used. */

  getGuideContext?: () => Omit<GuideContext, 'otherQuests'>;
  /** Story context for "Seek a quest", read at the moment of the tap. */
  getSeekContext: () => Omit<SeekContext, 'existingTitles'>;
}

export function useEmpyreanQuests(opts: UseEmpyreanQuestsOptions) {
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  // Every quest shows (and pays) its listed reward kept inside its challenge's range.
  const quests = useMemo(() => normalizeQuestMap(opts.questFlags).map(withQuestRewards), [opts.questFlags]);
  const worldState = useMemo(() => normalizeWorldState(opts.questFlags), [opts.questFlags]);
  const hub = useMemo(() => normalizeHubState(opts.questFlags?.[HUB_KEY]), [opts.questFlags]);
  // Which DM reply offered or settled each quest (the cards under the story's replies).
  const cards = useMemo(() => normalizeQuestCards(opts.questFlags?.[CARDS_KEY]), [opts.questFlags]);

  // Refs hold the newest values, including writes not yet re-rendered, so two quick
  // updates can never pay the same quest twice or lose a standing point.
  const questsRef = useRef<Quest[]>(quests);
  const hubRef = useRef<HubState>(hub);
  const worldRef = useRef<WorldStateEntry[]>(worldState);
  useEffect(() => { questsRef.current = quests; }, [quests]);
  useEffect(() => { hubRef.current = hub; }, [hub]);
  const cardsRef = useRef<QuestCard[]>(cards);
  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { worldRef.current = worldState; }, [worldState]);



  // GM guides (empyrean-quest-guide.ts): one hidden guide per active quest, written when it is accepted.

  const guides = useMemo(() => normalizeQuestGuides(opts.questFlags?.[GUIDES_KEY]), [opts.questFlags]);

  const guidesRef = useRef<QuestGuideMap>(guides);

  useEffect(() => { guidesRef.current = guides; }, [guides]);

  const writeGuides = useCallback((next: QuestGuideMap) => {

    guidesRef.current = next;

    optsRef.current.upsertQuest(GUIDES_KEY, storedQuestGuides(next));

  }, []);

  /** Quests whose guide is being written right now. */

  const [preparing, setPreparing] = useState<string[]>([]);

  const preparingRef = useRef(new Set<string>());

  const setBusy = useCallback((key: string, busy: boolean) => {

    if (busy) preparingRef.current.add(key); else preparingRef.current.delete(key);

    setPreparing([...preparingRef.current]);

  }, []);

  const writeQuest = useCallback((key: string, stored: Record<string, unknown>) => {
    optsRef.current.upsertQuest(key, stored);
    const next = withQuestRewards(normalizeQuest(key, stored));
    const list = questsRef.current.filter(q => q.key !== key);
    questsRef.current = [...list, next];
  }, []);

  // Payouts sent to the rules server that never got an answer: sent again until it answers.
  const pendingRef = useRef<HubPayout[]>(normalizePendingPayouts(opts.questFlags?.[PAYOUTS_KEY]));
  const pendingJson = JSON.stringify(opts.questFlags?.[PAYOUTS_KEY]?.pending ?? []);
  useEffect(() => { pendingRef.current = normalizePendingPayouts(opts.questFlags?.[PAYOUTS_KEY]); }, [pendingJson]); // eslint-disable-line react-hooks/exhaustive-deps
  const sendingRef = useRef(new Set<string>());
  const writePending = useCallback((list: HubPayout[]) => {
    pendingRef.current = list;
    optsRef.current.upsertQuest(PAYOUTS_KEY, storedPendingPayouts(list));
  }, []);

  /** Pays a finished quest's XP and gold exactly once: through the rules server when it is on, else here. */
  const settlePayout = useCallback(async (p: HubPayout, retry: boolean) => {
    if (sendingRef.current.has(p.questKey)) return;
    sendingRef.current.add(p.questKey);
    try {
      const o = optsRef.current;
      let result: QuestPayResult = 'off';
      try { result = o.payQuest ? await o.payQuest(p) : 'off'; } catch { result = 'unconfirmed'; }
      // A retry while the engine is off waits: the first send may already be on the server.
      if (result === 'unconfirmed' || (retry && result === 'off')) {
        if (!pendingRef.current.some(x => x.questKey === p.questKey)) {
          writePending([...pendingRef.current, p]);
          toast(`${p.title}: reward waiting for the game server`, { description: 'It is sent again automatically and paid once.', icon: '⏳' });
        }
        return;
      }
      if (result !== 'paid') {
        if (p.xp > 0) o.onAddXP?.(p.xp, `Quest: ${p.title}`);
        if (p.gold > 0) o.onGoldChange?.(p.gold);
      }
      if (pendingRef.current.some(x => x.questKey === p.questKey)) writePending(pendingRef.current.filter(x => x.questKey !== p.questKey));
    } finally {
      sendingRef.current.delete(p.questKey);
    }
  }, [writePending]);

  useEffect(() => {
    const tick = () => { for (const p of pendingRef.current) void settlePayout(p, true); };
    const first = window.setTimeout(tick, 5000);
    const timer = window.setInterval(tick, 60000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [settlePayout]);
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

  /** The story extractor's quest results (useDmAutoSync onQuestUpdate). sourceMessageId: the DM reply they were read from. */
  const applyExtraction = useCallback((offers: RawQuestOffer[], progress: any[], sourceMessageId?: string) => {
    const before = questsRef.current;
    const plan = planQuestUpdates(before, hubRef.current, offers, progress);
    const o = optsRef.current;
    if (sourceMessageId) {
      const made = cardsFromUpdate(plan, before, offers, sourceMessageId, new Date().toISOString());
      if (made.length > 0) {
        cardsRef.current = addQuestCards(cardsRef.current, made);
        o.upsertQuest(CARDS_KEY, storedQuestCards(cardsRef.current));
      }
    }
    for (const u of plan.upserts) writeQuest(u.key, u.stored);
    for (const q of plan.offered) {
      const cat = hubCategory(questCategory(q));
      toast(`New quest: ${questTitle(q)}`, { description: `${cat.emoji} ${cat.label} — open the Quest Hub to accept it.`, icon: '📜' });
    }
    for (const p of plan.payouts) {
      // With the rules engine on, the server records the XP and gold once per quest; otherwise they pay here.
      void settlePayout(hubPayout(p.quest), false);
      // Item rewards wait in the loot review (Accept / Discard) like the DM's own awards.
      const items = (p.quest.itemRewards ?? []).filter(it => it && typeof it.name === 'string' && it.name.trim());
      if (items.length > 0) addPendingDmItems(items.map(it => ({ ...it, name: it.name as string })));
      const parts = [p.xp ? `${p.xp} XP` : '', p.gold ? `${p.gold} gold` : '', items.length ? `${items.length} item${items.length === 1 ? '' : 's'} to review` : '', `+${p.points} standing`].filter(Boolean);
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
  }, [writeQuest, recordWorldState, settlePayout]);

  // The opening message for an accepted quest. With a guide it waits until the guide has reached

  // the DM's instructions (the next render), and it is sent again while the DM is busy.

  const kickoffRef = useRef<{ key: string; text: string; tries: number } | null>(null);

  const kickoffTimer = useRef<number | null>(null);

  const tryKickoff = useCallback(() => {

    const k = kickoffRef.current;

    if (!k) return;

    const quest = questsRef.current.find(q => q.key === k.key);

    if (!quest || quest.status !== 'active') { kickoffRef.current = null; return; }

    k.tries += 1;

    Promise.resolve(optsRef.current.sendMessage?.(k.text)).then(sent => {

      if (kickoffRef.current !== k) return;

      if (sent === false && k.tries < 60) kickoffTimer.current = window.setTimeout(tryKickoff, 3000);

      else kickoffRef.current = null;

    }).catch(() => { if (kickoffRef.current === k) kickoffRef.current = null; });

  }, []);

  useEffect(() => {

    const k = kickoffRef.current;

    if (k && k.tries === 0 && guides[k.key]) tryKickoff();

  }, [guides, tryKickoff]);

  useEffect(() => () => { if (kickoffTimer.current !== null) window.clearTimeout(kickoffTimer.current); }, []);



  // A finished or failed quest's guide is deleted (it stops reaching the DM the moment the quest stops being active).

  useEffect(() => {

    const gone = finishedGuideKeys(guidesRef.current, quests);

    if (gone.length === 0) return;

    const next = { ...guidesRef.current };

    for (const key of gone) delete next[key];

    writeGuides(next);

  }, [quests, guides, writeGuides]);



  const guideContext = useCallback((key: string): GuideContext => {

    const o = optsRef.current;

    const seek = o.getSeekContext();

    const base = o.getGuideContext?.() ?? {

      characterName: seek.characterName, dragonName: seek.dragonName, signetType: seek.signetType,

      yearAtBasgiath: seek.yearAtBasgiath, campaignSummary: seek.campaignSummary, recentStory: seek.latestScene,

    };

    return { ...base, otherQuests: questsRef.current.filter(q => q.status === 'active' && q.key !== key).map(q => questTitle(q)) };

  }, []);



  /** Accept an offer. A GM guide is written first (unless three active quests already have one); if the writers fail the quest starts without one. */

  const accept = useCallback((key: string) => {
    const quest = questsRef.current.find(q => q.key === key);
    if (!quest || quest.status !== 'offered' || preparingRef.current.has(key)) return;

    const start = (q: Quest, guide: QuestGuide | null) => {

      const base = guide ? { ...q, stages: guideStages(key, guide) } : q;

      const accepted = withQuestEvent({ ...base, status: 'active', category: questCategory(q) }, 'accepted', 'Quest accepted — the DM is now tracking it.');

      if (guide) writeGuides({ ...guidesRef.current, [key]: guide });

      writeQuest(key, toStored(accepted));

      toast.success(`Accepted: ${questTitle(q)}`);

      kickoffRef.current = { key, text: buildQuestKickoffPrompt(accepted), tries: 0 };

      if (!guide) tryKickoff();

    };

    if (!guideSlotFree(guidesRef.current, questsRef.current)) {

      toast(`${questTitle(quest)} starts without a GM guide`, { description: `${MAX_GUIDED_QUESTS} active quests already have one.`, icon: '📜' });

      start(quest, null);

      return;

    }

    setBusy(key, true);

    toast(`Preparing your quest: ${questTitle(quest)}`, { description: 'The DM is being briefed. This can take a minute or two.', icon: '📜' });

    void writeQuestGuide(quest, guideContext(key)).then(result => {

      setBusy(key, false);

      // Declined or changed while the guide was being written: nothing to start.

      const now = questsRef.current.find(q => q.key === key);

      if (!now || now.status !== 'offered') return;

      const guide = result.guide && guideSlotFree(guidesRef.current, questsRef.current) ? result.guide : null;

      if (!guide) toast(`${questTitle(now)} starts without a GM guide`, { description: result.error || `${MAX_GUIDED_QUESTS} active quests already have one.`, icon: '📜' });

      start(now, guide);

    });

    // writeGuides, setBusy, guideContext and tryKickoff never change, so they are not listed below.
  }, [writeQuest]);

  /** Write a GM guide for a quest that is already active and has none. Its objectives are kept when it has at least two. */

  const prepareGuide = useCallback((key: string) => {

    const quest = questsRef.current.find(q => q.key === key);

    if (!quest || quest.status !== 'active' || guidesRef.current[key] || preparingRef.current.has(key)) return;

    if (!guideSlotFree(guidesRef.current, questsRef.current)) {

      toast.error(`${MAX_GUIDED_QUESTS} active quests already have a GM guide`, { description: 'Finish one of them first.' });

      return;

    }

    const keep = keepsObjectives(quest);

    setBusy(key, true);

    void writeQuestGuide(quest, guideContext(key)).then(result => {

      setBusy(key, false);

      const now = questsRef.current.find(q => q.key === key);

      if (!now || now.status !== 'active' || guidesRef.current[key]) return;

      if (!result.guide) { toast.error('No GM guide this time', { description: result.error }); return; }

      if (!guideSlotFree(guidesRef.current, questsRef.current)) { toast.error(`${MAX_GUIDED_QUESTS} active quests already have a GM guide`); return; }

      const next = keep

        ? withQuestEvent(now, 'note', 'A GM guide was prepared for the DM.')

        : withQuestEvent({ ...now, stages: guideStages(key, result.guide) }, 'note', 'A GM guide was prepared for the DM, with new objectives.');

      writeGuides({ ...guidesRef.current, [key]: result.guide });

      writeQuest(key, toStored(next));

      toast.success(`GM guide ready: ${questTitle(now)}`);

    });

  }, [writeQuest, writeGuides, setBusy, guideContext]);



  /** The DM's hidden quest tags in one finished reply: tick the steps, finish or fail the quest (paid once, like any quest). */

  const applyQuestTags = useCallback((content: string, sourceMessageId?: string) => {

    const progress = progressFromTags(readQuestTags(content), guidesRef.current, questsRef.current);

    if (progress.length > 0) applyExtraction([], progress, sourceMessageId);

  }, [applyExtraction]);



  const decline = useCallback((key: string) => {
    optsRef.current.removeQuest(key);
    questsRef.current = questsRef.current.filter(q => q.key !== key);

    // An offer declined while its guide exists loses the guide too (writeGuides never changes, so it is not listed below).

    if (guidesRef.current[key]) {

      const next = { ...guidesRef.current };

      delete next[key];

      writeGuides(next);

    }
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

  const guidedKeys = useMemo(() => Object.keys(guides), [guides]);

  return {
    quests,
    worldState,
    hub,
    cards,
    current,
    strainCeiling,
    seeking,
    getActiveQuests,
    applyExtraction,
    recordWorldState,
    accept,
    decline,

    /** Keys of quests that have a GM guide (the guide text itself stays out of the screens). */

    guidedKeys,

    /** Keys of quests whose guide is being written right now. */

    preparing,

    prepareGuide,

    applyQuestTags,
    moveCategory,
    seek,
  };
}

export type EmpyreanQuests = ReturnType<typeof useEmpyreanQuests>;
