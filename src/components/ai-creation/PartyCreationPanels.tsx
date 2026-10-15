import { Loader2, RefreshCw, Users, ScrollText, AlertTriangle, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CharacterBuildData } from '@/hooks/use-ai-creation-chat';
import type { PartyBrief, RosterEntry, PartyCreationPhase } from '@/hooks/use-party-creation';
import type { PartyRules } from '@/lib/ai-creation/party-creation-state';

export function PartyPreparing({ phase, message, onRetry }: { phase: PartyCreationPhase; message: string | null; onRetry: () => void }) {
  if (phase === 'error') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-4 text-sm space-y-3">
        <p className="flex items-start gap-2 text-destructive"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{message || 'We couldn’t prepare your campaign.'}</p>
        <p className="text-xs text-muted-foreground">Your character in progress is kept safe.</p>
        <Button onClick={onRetry} variant="outline" className="w-full min-h-12" style={{ touchAction: 'manipulation' }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-primary/30 bg-black/60 p-4 text-sm flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
      <div>
        <p className="font-cinzel text-foreground">{phase === 'updating' ? 'Updating your campaign…' : 'Preparing your campaign…'}</p>
        <p className="text-xs text-muted-foreground">Reading the party’s world, rules and current situation.</p>
      </div>
    </div>
  );
}

export function PartyBriefCard({ label, brief, rules, roster }: { label: string; brief: PartyBrief | null; rules: PartyRules | null; roster: RosterEntry[] }) {
  return (
    <details className="rounded-lg border border-primary/30 bg-black/60 backdrop-blur-sm text-sm" open>
      <summary className="cursor-pointer px-3 py-3 font-cinzel text-primary min-h-12 flex items-center gap-2" style={{ touchAction: 'manipulation' }}>
        <ScrollText className="w-4 h-4" /> {label}
      </summary>
      <div className="px-3 pb-3 space-y-3 text-foreground/90">
        {brief?.setting && <p>{brief.setting}</p>}
        {brief?.currentSituation && <p><span className="text-muted-foreground">Right now: </span>{brief.currentSituation}</p>}
        {brief?.whereThePartyIs && <p><span className="text-muted-foreground">The party is at: </span>{brief.whereThePartyIs}</p>}
        {!!brief?.entryHooks?.length && (
          <div><p className="text-muted-foreground text-xs mb-1">Ways your hero could arrive</p>
            <ul className="list-disc list-inside space-y-0.5">{brief.entryHooks.map((h, i) => <li key={i}>{h}</li>)}</ul></div>
        )}
        <RulesList rules={rules} />
        {roster.length > 0 && (
          <div>
            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> The party</p>
            <ul className="space-y-0.5">
              {roster.map((m, i) => (
                <li key={i}>{m.name}{m.race ? ` · ${m.race}` : ''}{m.className ? ` · ${m.className}` : ''}{m.level ? ` · level ${m.level}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function RulesList({ rules }: { rules: PartyRules | null }) {
  if (!rules) return null;
  const items: { text: string; isDefault?: boolean }[] = [];
  const defaults = rules.defaults || [];
  const levelIsDefault = defaults.some(d => /level/i.test(d));
  if (rules.startingLevel) items.push({ text: `Start at level ${rules.startingLevel}`, isDefault: levelIsDefault });
  if (rules.startingGold != null) items.push({ text: `Up to ${rules.startingGold} gold` });
  if (rules.allowedClasses?.length) items.push({ text: `Classes: ${rules.allowedClasses.join(', ')}` });
  if (rules.allowedRaces?.length) items.push({ text: `Races: ${rules.allowedRaces.join(', ')}` });
  if (rules.xpMode) items.push({ text: `XP: ${rules.xpMode}` });
  if (rules.diceMode) items.push({ text: `Dice: ${rules.diceMode}` });
  for (const r of rules.restrictions || []) items.push({ text: r });
  return (
    <div>
      <p className="text-muted-foreground text-xs mb-1">Starting rules</p>
      <ul className="space-y-0.5">
        {items.map((it, i) => (
          <li key={i}>• {it.text}{it.isDefault && <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground">(app default)</span>}</li>
        ))}
      </ul>
      {!!rules.unresolved?.length && (
        <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive space-y-1">
          <p className="font-bold">The campaign’s guides disagree on a rule:</p>
          {rules.unresolved.map((u, i) => <p key={i}>{u}</p>)}
        </div>
      )}
    </div>
  );
}

export function PartyBuildReview({ build, rules, issues, stale, canJoin, joining, joinError, onJoin }: {
  build: CharacterBuildData; rules: PartyRules | null; issues: string[]; stale: boolean;
  canJoin: boolean; joining: boolean; joinError: string | null; onJoin: () => void;
}) {
  const s = build.abilityScores;
  const startingGoldDefault = rules?.startingGold == null;
  return (
    <div className="rounded-lg border border-primary/40 bg-black/70 p-3 text-sm space-y-2">
      <p className="font-cinzel text-primary">Final review</p>
      <p><b>{build.name}</b> · level {build.level} · {build.primaryClass}{build.race ? ` · ${build.race}` : ''}{build.gender ? ` · ${build.gender}` : ''}</p>
      {s && <p className="text-xs text-muted-foreground">STR {s.strength} · DEX {s.dexterity} · CON {s.constitution} · INT {s.intelligence} · WIS {s.wisdom} · CHA {s.charisma}</p>}
      <p className="text-xs"><span className="text-muted-foreground">Gear: </span>{build.selectedPresetId || 'custom'}{build.homebrewGear?.length ? ` + ${build.homebrewGear.map(g => g.name).slice(0, 5).join(', ')}` : ''}</p>
      {(build.starterAbilities?.length || build.homebrewSpells?.length || build.homebrewAbilities?.length) ? (
        <p className="text-xs"><span className="text-muted-foreground">Abilities & spells: </span>
          {[...(build.starterAbilities || []).map(a => a.abilityId), ...(build.homebrewSpells || []).map(x => x.name), ...(build.homebrewAbilities || []).map(x => x.name)].slice(0, 10).join(', ')}</p>
      ) : null}
      {!!build.consumables?.length && <p className="text-xs"><span className="text-muted-foreground">Items: </span>{build.consumables.slice(0, 8).join(', ')}</p>}
      <p className="text-xs"><span className="text-muted-foreground">Starting gold: </span>{startingGoldDefault ? 'app default (the campaign doesn’t say)' : `up to ${rules?.startingGold} (campaign rule)`}</p>
      {build.backstory && <p className="text-xs text-foreground/80 line-clamp-4">{build.backstory}</p>}
      {stale && <p className="text-xs text-amber-400">The campaign’s rules were updated. Ask the creator to re-check your build before joining.</p>}
      {issues.map((x, i) => <p key={i} className="text-xs text-destructive">{x}</p>)}
      {joinError && <p className="text-xs text-destructive">{joinError}</p>}
      <Button disabled={!canJoin || joining} onClick={onJoin} className="w-full min-h-12 font-display tracking-wider" size="lg" style={{ touchAction: 'manipulation' }}>
        {joining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Swords className="w-4 h-4 mr-2" />} {joining ? 'Joining…' : 'Join the Adventure'}
      </Button>
    </div>
  );
}
