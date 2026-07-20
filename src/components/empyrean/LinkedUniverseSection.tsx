import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Copy, Users, LogOut, Plus, LogIn, ChevronDown, ChevronUp, Save, ScrollText, MapPin, User as UserIcon, Skull, Link2, Radio, Play, Check, X, Send } from 'lucide-react';
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
import { useLinkedUniverse, type LinkedUniverseController } from '@/hooks/use-linked-universe';

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
  } = hook;

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
  useEffect(() => {
    setDigestDraft(ownMember?.storyDigest ?? '');
  }, [ownMember?.id, ownMember?.storyDigest]);

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
  const crossoverBadge = incomingPending.length + acceptedCrossovers.length;

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

        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/50 mb-1.5">
            <Users className="w-3 h-3" />
            Linked Riders ({members.length})
          </div>
          <div className="space-y-1.5">
            {members.map(m => (
              <div
                key={m.id}
                className="rounded-md border border-slate-700/50 bg-black/25 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-white/90 truncate">
                    {m.characterName}
                    {m.campaignId === campaignId && (
                      <span className="ml-1.5 text-[10px] text-amber-300/70">(you)</span>
                    )}
                  </span>
                  {m.digestUpdatedAt && (
                    <span className="text-[10px] text-white/50 shrink-0">
                      {timeAgo(m.digestUpdatedAt)}
                    </span>
                  )}
                </div>
                {!m.storyDigest && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">
                    No story shared yet
                  </p>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No linked riders yet.</p>
            )}
          </div>
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
                    {completedCrossovers.map(cx => (
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
                      </div>
                    ))}
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
