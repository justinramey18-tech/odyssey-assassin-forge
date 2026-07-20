import { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Copy, Users, LogOut, Plus, LogIn, ChevronDown, ChevronUp, Save, ScrollText, MapPin, User as UserIcon, Skull, Link2, Radio, Play, Check, X, Send, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useLinkedUniverse, type LinkedUniverseController, type RelationKind, RELATION_LABELS, type UniverseRelationship } from '@/hooks/use-linked-universe';

const RELATION_OPTIONS: RelationKind[] = ['ally', 'friend', 'rival', 'enemy', 'owes-you', 'you-owe-them', 'acquaintance'];

function RelationshipEditor({
  memberId,
  characterName,
  current,
  onSave,
  compact,
}: {
  memberId: string;
  characterName: string;
  current: UniverseRelationship | undefined;
  onSave: (rel: RelationKind, note: string | null) => Promise<boolean> | void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rel, setRel] = useState<RelationKind>(current?.relation ?? 'acquaintance');
  const [note, setNote] = useState<string>(current?.note ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setRel(current?.relation ?? 'acquaintance');
    setNote(current?.note ?? '');
  }, [current?.id, current?.relation, current?.note]);

  const label = current ? RELATION_LABELS[current.relation] : 'Set relationship';
  return (
    <div className={`rounded-md border border-slate-700/60 bg-black/25 ${compact ? 'p-2' : 'p-2.5'} space-y-2`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full min-h-[36px] flex items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/60">
          <Heart className="w-3 h-3 text-rose-300/70" />
          {current ? `You: ${label}` : `How do you see ${characterName}?`}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
      </button>
      {open && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {RELATION_OPTIONS.map(opt => {
              const active = rel === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRel(opt)}
                  className={`min-h-[36px] rounded-md px-2 py-1.5 text-[11px] font-medium border transition ${
                    active
                      ? 'bg-rose-500/20 border-rose-400/50 text-rose-100'
                      : 'bg-black/30 border-slate-700/60 text-white/70 hover:bg-black/50'
                  }`}
                >
                  {RELATION_LABELS[opt]}
                </button>
              );
            })}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            placeholder="Optional note — e.g. Stole my wardstone at Basgiath"
            className="min-h-[56px] bg-black/40 border-slate-700 text-[12px]"
            maxLength={500}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/40">{note.length}/500 · Only your side is saved</span>
            <Button
              size="sm"
              className="min-h-[36px] bg-rose-500/70 hover:bg-rose-500 text-white"
              disabled={saving || (rel === (current?.relation ?? 'acquaintance') && (note.trim() || null) === (current?.note ?? null))}
              onClick={async () => {
                setSaving(true);
                await onSave(rel, note.trim() ? note.trim() : null);
                setSaving(false);
                setOpen(false);
              }}
            >
              <Save className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props {
  campaignId: string | null;
  characterName: string;
  controller?: LinkedUniverseController;
}

const DIGEST_PLACEHOLDER =
  'Describe your character and current story in a few lines. Other players\' DMs will see this. Example: CHARACTER: Ramey, 2nd-year rider, lightning signet. LOCATION: Basgiath east wing. RECENT: Survived a venin ambush at the ward line. HOOKS: Carries a stolen wardstone fragment.';

export function LinkedUniverseSection({ campaignId, characterName, controller }: Props) {
  const internal = useLinkedUniverse({ campaignId: controller ? null : campaignId });
  const hook = controller ?? internal;

  const {
    universe,
    members,
    events,
    crossovers,
    isLoading,
    createUniverse,
    joinUniverse,
    leaveUniverse,
    isSignedIn,
    ownMember,
    saveMyDigest,
    requestCrossover,
    respondCrossover,
    activateCrossover,
    activeCrossoverId,
    pendingCrossoversForMe,
    unseenEvents,
    markSeen,
    myVisibility,
    setVisibility,
    myRegion,
    setRegion,
    setRelationship,
    relationshipByMember,
  } = hook;

  // One-time prompt after a crossover completes: nudge player to set relationship
  const promptedCrossoverRef = useRef<Set<string>>(new Set());
  const [relationshipPromptFor, setRelationshipPromptFor] = useState<string | null>(null);
  useEffect(() => {
    if (!crossovers || crossovers.length === 0) return;
    for (const cx of crossovers) {
      if (cx.status !== 'completed') continue;
      if (promptedCrossoverRef.current.has(cx.id)) continue;
      promptedCrossoverRef.current.add(cx.id);
      const otherMemberId = cx.mySide === 'a' ? cx.toMember : cx.fromMember;
      if (relationshipByMember.get(otherMemberId)) continue;
      setRelationshipPromptFor(otherMemberId);
      break;
    }
  }, [crossovers, relationshipByMember]);

  // Clear unseen badge when the section mounts / campaign switches
  useEffect(() => {
    if (universe) markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universe?.id]);


  const rumorFeed = useMemo(
    () => [...events].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    }).slice(0, 25),
    [events]
  );

  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [name, setName] = useState('Shared Universe');
  const [code, setCode] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const [digestOpen, setDigestOpen] = useState(false);
  const [rumorOpen, setRumorOpen] = useState(false);
  const [crossoversOpen, setCrossoversOpen] = useState(false);
  const [digestDraft, setDigestDraft] = useState('');
  const [savingDigest, setSavingDigest] = useState(false);
  const [crossoverDraftFor, setCrossoverDraftFor] = useState<string | null>(null);
  const [crossoverPremise, setCrossoverPremise] = useState('');
  const [regionDraft, setRegionDraft] = useState('');
  const [savingRegion, setSavingRegion] = useState(false);
  useEffect(() => {
    setDigestDraft(ownMember?.storyDigest ?? '');
  }, [ownMember?.id, ownMember?.storyDigest]);
  useEffect(() => {
    setRegionDraft(ownMember?.region ?? '');
  }, [ownMember?.id, ownMember?.region]);

  const otherMembers = useMemo(
    () => members.filter(m => m.campaignId !== campaignId),
    [members, campaignId]
  );
  const incomingPending = useMemo(
    () => crossovers.filter(c => c.direction === 'incoming' && c.status === 'pending'),
    [crossovers]
  );
  const outgoingPending = useMemo(
    () => crossovers.filter(c => c.direction === 'outgoing' && c.status === 'pending'),
    [crossovers]
  );
  const acceptedCrossovers = useMemo(
    () => crossovers.filter(c => c.status === 'accepted'),
    [crossovers]
  );
  const completedCrossovers = useMemo(
    () => crossovers.filter(c => c.status === 'completed').slice(0, 5),
    [crossovers]
  );
  const crossoverBadge = incomingPending.length;

  const disabled = !isSignedIn || !campaignId;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Copy failed')
    );
  };

  if (disabled) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-black/30 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-medium text-white/85">Linked Universe</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Sign in and save your campaign to link universes.
        </p>
      </div>
    );
  }

  if (universe) {
    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-cinzel font-semibold text-amber-200 truncate">
            {universe.name}
          </span>
          {(pendingCrossoversForMe + unseenEvents) > 0 && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-400/90 text-black">
              {pendingCrossoversForMe + unseenEvents}
            </span>
          )}
        </div>


        <button
          onClick={() => copy(universe.linkCode)}
          className="w-full min-h-[44px] flex items-center justify-between gap-2 rounded-md border border-amber-400/30 bg-black/40 px-3 py-2 hover:bg-black/60 active:bg-black/70 transition"
        >
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-widest text-amber-300/70">Invite Code</div>
            <div className="font-mono text-lg font-bold text-amber-100 tracking-widest">
              {universe.linkCode}
            </div>
          </div>
          <Copy className="w-4 h-4 text-amber-300/80" />
        </button>

        {/* Story Visibility — controls what other DMs receive about you */}
        <div className="rounded-md border border-slate-700/60 bg-black/25 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/60">
            <UserIcon className="w-3 h-3" />
            Story Visibility
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['full', 'headline', 'hidden'] as const).map(v => {
              const active = myVisibility === v;
              const label = v === 'full' ? 'Full' : v === 'headline' ? 'Headline' : 'Hidden';
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => { if (!active) setVisibility(v); }}
                  className={`min-h-[44px] rounded-md px-2 py-1.5 text-xs font-medium border transition ${
                    active
                      ? 'bg-amber-500/25 border-amber-400/60 text-amber-100'
                      : 'bg-black/30 border-slate-700/60 text-white/70 hover:bg-black/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {myVisibility === 'full' && 'Other DMs see your whole digest.'}
            {myVisibility === 'headline' && 'Other DMs only know you exist.'}
            {myVisibility === 'hidden' && 'You stay invisible to other stories.'}
          </p>
        </div>



        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
            <Users className="w-3 h-3" />
            Roster ({members.length})
          </div>
          <div className="space-y-1.5">
            {members.map(m => {
              const isMe = m.campaignId === campaignId;
              const vis = m.visibility === 'hidden' ? 'Hidden' : m.visibility === 'headline' ? 'Headline' : 'Full';
              return (
                <div
                  key={m.id}
                  className="rounded-md border border-slate-700/50 bg-black/25 px-2.5 py-2 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white/90 truncate">
                      {m.characterName}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] text-amber-300/70">(you)</span>
                      )}
                    </span>
                    {m.digestUpdatedAt && (
                      <span className="text-[10px] text-white/50 shrink-0">
                        {timeAgo(m.digestUpdatedAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-slate-700/60 text-white/70">
                      <MapPin className="w-3 h-3 text-amber-300/70" />
                      {m.region?.trim() || 'Global'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-black/40 border border-slate-700/60 text-white/70">
                      {vis}
                    </span>
                  </div>
                  {isMe && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Input
                        value={regionDraft}
                        onChange={(e) => setRegionDraft(e.target.value.slice(0, 64))}
                        placeholder="Set your region — e.g. Basgiath, The Front"
                        className="h-9 bg-black/40 border-slate-700 text-xs flex-1"
                        maxLength={64}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[36px] px-2 text-[11px] border-amber-400/30 text-amber-200 hover:bg-amber-500/10"
                        disabled={savingRegion || (regionDraft.trim() || null) === (m.region ?? null)}
                        onClick={async () => {
                          setSavingRegion(true);
                          await setRegion(regionDraft.trim() ? regionDraft.trim() : null);
                          setSavingRegion(false);
                        }}
                      >
                        Save
                      </Button>
                      {(m.region || regionDraft) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-[36px] px-2 text-[11px] text-white/60"
                          disabled={savingRegion}
                          onClick={async () => {
                            setSavingRegion(true);
                            setRegionDraft('');
                            await setRegion(null);
                            setSavingRegion(false);
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                  {!m.storyDigest && (
                    <p className="text-[11px] text-muted-foreground italic">
                      No story shared yet
                    </p>
                  )}
                  {!isMe && (
                    <RelationshipEditor
                      memberId={m.id}
                      characterName={m.characterName}
                      current={relationshipByMember.get(m.id)}
                      onSave={(rel, note) => setRelationship(m.id, rel, note)}
                      compact
                    />
                  )}
                </div>
              );
            })}
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No linked riders yet.</p>
            )}
          </div>
          <p className="text-[10px] text-white/40 italic mt-1.5 leading-snug">
            Region is optional. With a region set, your DM prioritizes same-region riders in context.
          </p>
        </div>

        {/* Rumor Feed — read-only shared canon */}
        <div className="rounded-md border border-slate-700/60 bg-black/25">
          <button
            onClick={() => setRumorOpen(v => !v)}
            className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-white/70">
              <Radio className="w-3.5 h-3.5 text-amber-300/80" />
              Rumor Feed
              {rumorFeed.length > 0 && (
                <span className="ml-1 text-[10px] text-amber-300/70 normal-case tracking-normal">
                  ({rumorFeed.length})
                </span>
              )}
            </span>
            {rumorOpen ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
          </button>
          {rumorOpen && (
            <div className="px-3 pb-3">
              {rumorFeed.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic leading-snug">
                  No rumors yet. As linked riders play, world events will appear here.
                </p>
              ) : (
                <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
                  {rumorFeed.map(ev => {
                    const Icon =
                      ev.eventType === 'location' ? MapPin :
                      ev.eventType === 'npc' ? UserIcon :
                      ev.eventType === 'death' ? Skull :
                      ev.eventType === 'crossover' ? Link2 :
                      ScrollText;
                    const isMajor = ev.importance >= 3;
                    return (
                      <div
                        key={ev.id}
                        className={`rounded-md bg-black/30 px-2.5 py-2 border-l-2 ${
                          isMajor ? 'border-amber-400/70' : 'border-slate-600/50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isMajor ? 'text-amber-300' : 'text-white/50'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              {isMajor && (
                                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">
                                  Major
                                </span>
                              )}
                              <span className="text-[10px] text-white/45">{timeAgo(ev.createdAt)}</span>
                            </div>
                            <p className="text-[12px] text-white/85 leading-snug break-words">
                              {ev.eventText}
                            </p>
                            {ev.createdByName && (
                              <p className="text-[10px] text-white/40 italic mt-0.5">
                                — via {ev.createdByName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Crossovers — opt-in shared scenes */}
        {otherMembers.length > 0 && (
          <div className="rounded-md border border-slate-700/60 bg-black/25">
            <button
              onClick={() => setCrossoversOpen(v => !v)}
              className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-white/70">
                <Link2 className="w-3.5 h-3.5 text-amber-300/80" />
                Crossovers
                {crossoverBadge > 0 && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-100 border border-amber-400/40 normal-case tracking-normal">
                    {crossoverBadge}
                  </span>
                )}
              </span>
              {crossoversOpen ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
            </button>
            {crossoversOpen && (
              <div className="px-3 pb-3 space-y-3">
                {/* Incoming pending — accept/decline */}
                {incomingPending.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Invitations</div>
                    {incomingPending.map(cx => (
                      <div key={cx.id} className="rounded-md bg-black/40 border border-amber-400/25 p-2.5 space-y-2">
                        <div className="text-[12px] text-white/85">
                          <span className="font-semibold text-amber-200">{cx.otherCharacterName}</span> wants a scene with you.
                        </div>
                        {cx.scenePremise && (
                          <p className="text-[11px] text-white/70 italic leading-snug">"{cx.scenePremise}"</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 min-h-[44px] bg-emerald-600/80 hover:bg-emerald-600 text-white"
                            onClick={() => respondCrossover(cx.id, true)}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 min-h-[44px]"
                            onClick={() => respondCrossover(cx.id, false)}
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Accepted — Play this scene */}
                {acceptedCrossovers.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-widest text-emerald-300/80">Ready to Play</div>
                    {acceptedCrossovers.map(cx => (
                      <div key={cx.id} className="rounded-md bg-emerald-900/15 border border-emerald-500/30 p-2.5 space-y-2">
                        <div className="text-[12px] text-white/90">
                          Scene with <span className="font-semibold text-emerald-200">{cx.otherCharacterName}</span>
                        </div>
                        {cx.scenePremise && (
                          <p className="text-[11px] text-white/70 italic leading-snug">"{cx.scenePremise}"</p>
                        )}
                        <Button
                          size="sm"
                          className="w-full min-h-[44px] bg-amber-500/80 hover:bg-amber-500 text-black"
                          disabled={activeCrossoverId === cx.id}
                          onClick={() => {
                            activateCrossover(cx.id);
                            toast.success('Send your next DM message to play the scene');
                          }}
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          {activeCrossoverId === cx.id ? 'Armed — send your next message' : 'Play this scene'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Outgoing pending — waiting */}
                {outgoingPending.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-widest text-white/50">Awaiting response</div>
                    {outgoingPending.map(cx => (
                      <div key={cx.id} className="rounded-md bg-black/25 border border-slate-700/50 p-2.5">
                        <div className="text-[12px] text-white/80">
                          Waiting on <span className="font-semibold">{cx.otherCharacterName}</span>
                        </div>
                        {cx.scenePremise && (
                          <p className="text-[11px] text-white/60 italic leading-snug mt-0.5">"{cx.scenePremise}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Request a new crossover */}
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-widest text-white/50">Request a Crossover</div>
                  {otherMembers.map(m => {
                    const isDrafting = crossoverDraftFor === m.id;
                    return (
                      <div key={m.id} className="rounded-md bg-black/25 border border-slate-700/50 p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] text-white/85 truncate">{m.characterName}</span>
                          {!isDrafting ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-[36px] px-3 border-amber-400/30 text-amber-200 hover:bg-amber-500/10"
                              onClick={() => {
                                setCrossoverDraftFor(m.id);
                                setCrossoverPremise('');
                              }}
                            >
                              <Link2 className="w-3.5 h-3.5 mr-1" />
                              Request
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-[36px] px-2 text-white/60"
                              onClick={() => setCrossoverDraftFor(null)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                        {isDrafting && (
                          <div className="space-y-2">
                            <Textarea
                              value={crossoverPremise}
                              onChange={(e) => setCrossoverPremise(e.target.value)}
                              placeholder="Scene premise — e.g. Meet at the flight field before dawn"
                              className="min-h-[64px] bg-black/40 border-slate-700 text-sm"
                              maxLength={500}
                            />
                            <Button
                              size="sm"
                              className="w-full min-h-[44px] bg-amber-500/80 hover:bg-amber-500 text-black"
                              disabled={!crossoverPremise.trim()}
                              onClick={async () => {
                                const ok = await requestCrossover(m.id, crossoverPremise);
                                if (ok) {
                                  setCrossoverDraftFor(null);
                                  setCrossoverPremise('');
                                }
                              }}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              Send Invitation
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Completed — read-only mementos */}
                {completedCrossovers.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-widest text-white/50">Shared Memories</div>
                    {completedCrossovers.map(cx => {
                      const otherMemberId = cx.mySide === 'a' ? cx.toMember : cx.fromMember;
                      return (
                      <div key={cx.id} className="rounded-md bg-black/30 border border-slate-700/50 p-2.5 space-y-2">
                        <div className="text-[11px] text-amber-200/90 font-semibold">
                          With {cx.otherCharacterName}
                          {cx.scenePremise && <span className="text-white/60 font-normal italic"> — "{cx.scenePremise}"</span>}
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="rounded bg-black/40 p-2">
                            <div className="text-[9px] uppercase tracking-widest text-white/50 mb-1">Your Side</div>
                            <p className="text-[11px] text-white/80 whitespace-pre-wrap leading-snug">
                              {(cx.mySide === 'a' ? cx.narrationA : cx.narrationB) || <span className="italic text-white/40">Not saved</span>}
                            </p>
                          </div>
                          <div className="rounded bg-black/40 p-2">
                            <div className="text-[9px] uppercase tracking-widest text-white/50 mb-1">{cx.otherCharacterName}'s Side</div>
                            <p className="text-[11px] text-white/80 whitespace-pre-wrap leading-snug">
                              {(cx.mySide === 'a' ? cx.narrationB : cx.narrationA) || <span className="italic text-white/40">Not saved yet</span>}
                            </p>
                          </div>
                        </div>
                        <RelationshipEditor
                          memberId={otherMemberId}
                          characterName={cx.otherCharacterName}
                          current={relationshipByMember.get(otherMemberId)}
                          onSave={(rel, note) => setRelationship(otherMemberId, rel, note)}
                          compact
                        />
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}




        {ownMember && (
          <div className="rounded-md border border-slate-700/60 bg-black/25">
            <button
              onClick={() => setDigestOpen(v => !v)}
              className="w-full min-h-[44px] flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="text-xs uppercase tracking-widest text-white/70">My Story Digest</span>
              {digestOpen ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
            </button>
            {digestOpen && (
              <div className="px-3 pb-3 space-y-2">
                <Textarea
                  value={digestDraft}
                  onChange={(e) => setDigestDraft(e.target.value)}
                  placeholder={DIGEST_PLACEHOLDER}
                  className="min-h-[180px] bg-black/40 border-slate-700 text-sm"
                  maxLength={5000}
                />
                <p className="text-[10px] text-white/50 italic leading-snug">
                  Auto-updates as you play. Edit anytime to override until the next auto-update.
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-white/40">
                    {digestDraft.length}/5000 · Other players' DMs will see this
                  </span>
                  <Button
                    size="sm"
                    className="min-h-[36px] bg-amber-500/80 hover:bg-amber-500 text-black"
                    disabled={savingDigest || digestDraft === (ownMember.storyDigest ?? '')}
                    onClick={async () => {
                      setSavingDigest(true);
                      await saveMyDigest(digestDraft);
                      setSavingDigest(false);
                    }}
                  >
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <Button
          variant="destructive"
          size="sm"
          className="w-full min-h-[44px]"
          onClick={() => setConfirmUnlink(true)}
          disabled={isLoading}
        >
          <LogOut className="w-4 h-4 mr-1.5" />
          Unlink
        </Button>

        <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unlink from this universe?</AlertDialogTitle>
              <AlertDialogDescription>
                Your campaign keeps everything — it just stops sharing and receiving story updates.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await leaveUniverse();
                  setConfirmUnlink(false);
                }}
              >
                Unlink
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/60 bg-black/30 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300" />
        <span className="text-sm font-medium text-white/85">Linked Universe</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Connect two solo campaigns so their stories share a world.
      </p>

      {mode === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] border-amber-400/30 text-amber-200 hover:bg-amber-500/10"
            onClick={() => setMode('create')}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px] border-slate-600 text-white/85 hover:bg-white/5"
            onClick={() => setMode('join')}
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            Join with Code
          </Button>
        </div>
      )}

      {mode === 'create' && (
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Universe name"
            className="h-10 bg-black/40 border-slate-700 text-sm"
            maxLength={64}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px]"
              onClick={() => setMode('idle')}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 min-h-[44px] bg-amber-500/80 hover:bg-amber-500 text-black"
              disabled={isLoading}
              onClick={async () => {
                const ok = await createUniverse(name.trim() || 'Shared Universe', characterName);
                if (ok) setMode('idle');
              }}
            >
              Create Universe
            </Button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="space-y-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="6-CHAR CODE"
            className="h-11 bg-black/40 border-slate-700 text-center font-mono text-lg tracking-widest"
            maxLength={6}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px]"
              onClick={() => {
                setMode('idle');
                setCode('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 min-h-[44px] bg-amber-500/80 hover:bg-amber-500 text-black"
              disabled={code.length !== 6 || isLoading}
              onClick={async () => {
                const ok = await joinUniverse(code, characterName);
                if (ok) {
                  setMode('idle');
                  setCode('');
                }
              }}
            >
              Join
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
