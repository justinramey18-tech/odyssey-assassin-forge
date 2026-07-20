import { useState, useEffect } from 'react';
import { Sparkles, Copy, Users, LogOut, Plus, LogIn, ChevronDown, ChevronUp, Save } from 'lucide-react';
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
    isLoading,
    createUniverse,
    joinUniverse,
    leaveUniverse,
    isSignedIn,
    ownMember,
    saveMyDigest,
  } = hook;

  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [name, setName] = useState('Shared Universe');
  const [code, setCode] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const [digestOpen, setDigestOpen] = useState(false);
  const [digestDraft, setDigestDraft] = useState('');
  const [savingDigest, setSavingDigest] = useState(false);
  useEffect(() => {
    setDigestDraft(ownMember?.storyDigest ?? '');
  }, [ownMember?.id, ownMember?.storyDigest]);

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
                  className="min-h-[140px] bg-black/40 border-slate-700 text-sm"
                  maxLength={5000}
                />
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
