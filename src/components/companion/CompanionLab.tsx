import { useRef, useState } from 'react';
import { X, Drumstick, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCompanionRig } from '@/hooks/use-companion-rig';
import {
  ACCENT_SWATCHES, BELLY_SWATCHES, EYE_SWATCHES, PELT_SWATCHES, NAME_MAX, TITLE_MAX,
  addBond, bondLabel, CompanionRig,
} from '@/lib/companion-rig';
import { CompanionCanvas, CompanionCanvasHandle } from './CompanionCanvas';

interface Props { open: boolean; onClose: () => void }

type Opt<T extends string> = { v: T; l: string };
const CHASSIS: Opt<CompanionRig['chassis']>[] = [
  { v: 'prowler', l: 'Prowler (wolf / panther)' }, { v: 'behemoth', l: 'Behemoth (bear / owlbear)' },
  { v: 'drake', l: 'Drake (scaled wyrmling)' }, { v: 'automaton', l: 'Automaton (clockwork)' },
];
const EARS: Opt<CompanionRig['ears']>[] = [{ v: 'pricked', l: 'Pricked ears' }, { v: 'tufted', l: 'Lynx tufts' }, { v: 'horns', l: 'Ram horns' }, { v: 'frills', l: 'Drake frills' }, { v: 'none', l: 'None' }];
const TAILS: Opt<CompanionRig['tail']>[] = [{ v: 'plume', l: 'Plume' }, { v: 'whip', l: 'Whip' }, { v: 'club', l: 'Spiked club' }, { v: 'chain', l: 'Segmented' }];
const PATTERNS: Opt<CompanionRig['pattern']>[] = [{ v: 'solid', l: 'Solid' }, { v: 'stripes', l: 'Stripes' }, { v: 'spots', l: 'Spots' }, { v: 'cracks', l: 'Molten cracks' }, { v: 'runes', l: 'Glowing runes' }];
const COLLARS: Opt<CompanionRig['collar']>[] = [{ v: 'none', l: 'None' }, { v: 'leather', l: 'Studded leather' }, { v: 'spiked', l: 'Spiked iron' }, { v: 'pendant', l: 'Rune pendant' }];
const ARMORS: Opt<CompanionRig['armor']>[] = [{ v: 'none', l: 'None' }, { v: 'leather', l: 'Boiled leather' }, { v: 'chain', l: 'Chain barding' }, { v: 'plate', l: 'Dwarven plate' }];
const PAWS: Opt<CompanionRig['paws']>[] = [{ v: 'none', l: 'None' }, { v: 'wraps', l: 'Linen wraps' }, { v: 'blades', l: 'Bladed claws' }];
const TEMPERS: Opt<CompanionRig['temperament']>[] = [
  { v: 'feral', l: 'Feral — restless and wild' }, { v: 'sentinel', l: 'Sentinel — calm, watchful' },
  { v: 'reckless', l: 'Reckless — eager, bouncy' }, { v: 'cunning', l: 'Cunning — sly, half-lidded' },
];

function Pick<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={v => onChange(v as T)}>
        <SelectTrigger className="w-full h-12"><SelectValue /></SelectTrigger>
        <SelectContent className="z-[90]">{options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Swatches({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (c: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {colors.map(c => (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={`Colour ${c}`}
            className={cn('h-12 w-12 rounded-full border-2 transition-transform active:scale-95', value === c ? 'border-primary scale-105' : 'border-border')}
            style={{ backgroundColor: c, touchAction: 'manipulation' }} />
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[48px] items-center justify-between rounded-lg border border-border bg-card/40 px-3" style={{ touchAction: 'manipulation' }}>
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function CompanionLab({ open, onClose }: Props) {
  const { rig, update, setRig } = useCompanionRig();
  const canvas = useRef<CompanionCanvasHandle>(null);
  const [line, setLine] = useState('Stroke its chin, press its forehead, tap its nose, or double-tap its flank.');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-cinzel text-lg font-bold text-primary">{rig.name || 'Unnamed'}</h2>
          <p className="truncate text-xs text-muted-foreground">{rig.title}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={onClose} aria-label="Close companion" style={{ touchAction: 'manipulation' }}>
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative h-[42dvh] min-h-[240px] w-full shrink-0">
        <CompanionCanvas
          ref={canvas}
          rig={rig}
          active={open}
          onBond={amt => setRig(r => addBond(r, amt))}
          onReaction={setLine}
        />
        <p className="pointer-events-none absolute inset-x-3 bottom-2 rounded-md bg-background/70 px-2 py-1 text-center text-xs text-foreground backdrop-blur-sm">{line}</p>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-xs"><span className="font-cinzel">Bond · {bondLabel(rig.bond)}</span><span>{rig.bond}/100</span></div>
          <Progress value={rig.bond} className="mt-1 h-2" />
        </div>
        <Button variant="outline" className="h-12" onClick={() => canvas.current?.tossTreat()} style={{ touchAction: 'manipulation' }}>
          <Drumstick className="mr-1 h-4 w-4" /> Treat
        </Button>
        <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => canvas.current?.wake()} aria-label="Wake up" style={{ touchAction: 'manipulation' }}>
          <Sun className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="form" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-2 grid h-12 grid-cols-5">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="color">Colour</TabsTrigger>
          <TabsTrigger value="marks">Marks</TabsTrigger>
          <TabsTrigger value="gear">Gear</TabsTrigger>
          <TabsTrigger value="spirit">Spirit</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 pt-3">
          <TabsContent value="form" className="mt-0 space-y-4">
            <Pick label="Body" value={rig.chassis} options={CHASSIS} onChange={v => update({ chassis: v })} />
            <div className="space-y-2"><Label>Build — lithe to massive</Label><Slider value={[rig.build * 100]} onValueChange={([v]) => update({ build: v / 100 })} /></div>
            <div className="space-y-2"><Label>Muzzle — blunt to long</Label><Slider value={[rig.muzzle * 100]} onValueChange={([v]) => update({ muzzle: v / 100 })} /></div>
            <Pick label="Ears / horns" value={rig.ears} options={EARS} onChange={v => update({ ears: v })} />
            <Pick label="Tail" value={rig.tail} options={TAILS} onChange={v => update({ tail: v })} />
          </TabsContent>
          <TabsContent value="color" className="mt-0 space-y-4">
            <Swatches label="Coat" value={rig.pelt} colors={PELT_SWATCHES} onChange={c => update({ pelt: c })} />
            <Swatches label="Underbelly" value={rig.belly} colors={BELLY_SWATCHES} onChange={c => update({ belly: c })} />
            <Swatches label="Eyes" value={rig.eye} colors={EYE_SWATCHES} onChange={c => update({ eye: c })} />
            <Toggle label="Glowing eyes" checked={rig.glowEyes} onChange={v => update({ glowEyes: v })} />
            <Swatches label="Accent (runes, spikes, gems)" value={rig.accent} colors={ACCENT_SWATCHES} onChange={c => update({ accent: c })} />
          </TabsContent>
          <TabsContent value="marks" className="mt-0 space-y-3">
            <Pick label="Pattern" value={rig.pattern} options={PATTERNS} onChange={v => update({ pattern: v })} />
            <Toggle label="Blinded, scarred eye" checked={rig.scars.eye} onChange={v => update({ scars: { ...rig.scars, eye: v } })} />
            <Toggle label="Notched ear" checked={rig.scars.ear} onChange={v => update({ scars: { ...rig.scars, ear: v } })} />
            <Toggle label="Slash across muzzle" checked={rig.scars.muzzle} onChange={v => update({ scars: { ...rig.scars, muzzle: v } })} />
            <Toggle label="Claw furrows on ribs" checked={rig.scars.ribs} onChange={v => update({ scars: { ...rig.scars, ribs: v } })} />
          </TabsContent>
          <TabsContent value="gear" className="mt-0 space-y-4">
            <Pick label="Collar" value={rig.collar} options={COLLARS} onChange={v => update({ collar: v })} />
            <Pick label="Barding" value={rig.armor} options={ARMORS} onChange={v => update({ armor: v })} />
            <Pick label="Front paws" value={rig.paws} options={PAWS} onChange={v => update({ paws: v })} />
          </TabsContent>
          <TabsContent value="spirit" className="mt-0 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between"><Label htmlFor="cmp-name">Name</Label><span className="text-xs text-muted-foreground">{rig.name.length}/{NAME_MAX}</span></div>
              <Input id="cmp-name" className="h-12 w-full" maxLength={NAME_MAX} value={rig.name} onChange={e => update({ name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><Label htmlFor="cmp-title">Title</Label><span className="text-xs text-muted-foreground">{rig.title.length}/{TITLE_MAX}</span></div>
              <Input id="cmp-title" className="h-12 w-full" maxLength={TITLE_MAX} value={rig.title} onChange={e => update({ title: e.target.value })} />
            </div>
            <Pick label="Temperament" value={rig.temperament} options={TEMPERS} onChange={v => update({ temperament: v })} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
