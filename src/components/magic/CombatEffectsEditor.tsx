import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SpellCombatEffect } from '@/lib/magic/types';
import { COMBAT_EFFECT_LIMITS, validateCombatEffects } from '@/lib/spellResolve';

export function CombatEffectsEditor({ value, onChange }: {
  value: SpellCombatEffect[] | undefined;
  onChange: (effects: SpellCombatEffect[] | undefined) => void;
}) {
  const rows = Array.isArray(value) ? value : [];
  const { errors } = validateCombatEffects(value);
  const replace = (index: number, effect: SpellCombatEffect) => onChange(rows.map((row, i) => i === index ? effect : row));
  return <div className="space-y-3 border-t border-border pt-3">
    <div className="flex items-center justify-between gap-2">
      <Label className="font-cinzel">Combat Support</Label>
      <Button variant="outline" className="min-h-12 min-w-12" style={{ touchAction: 'manipulation' }} aria-label="Add combat effect"
        disabled={rows.length >= 3} onClick={() => {
          const kind = (['ac_bonus', 'attack_bonus', 'temporary_hp'] as const).find(k => !rows.some(row => row.kind === k));
          if (kind) onChange([...rows, { kind, amount: 1, durationSeconds: 60 }]);
        }}><Plus className="h-4 w-4" /></Button>
    </div>
    {rows.map((row, index) => <div key={index} className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Select value={row.kind} onValueChange={kind => replace(index, { kind: kind as SpellCombatEffect['kind'], amount: 1, durationSeconds: row.durationSeconds })}>
          <SelectTrigger aria-label={`Effect ${index + 1} kind`} className="min-h-12"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ac_bonus">AC bonus</SelectItem>
            <SelectItem value="attack_bonus">Attack bonus</SelectItem>
            <SelectItem value="temporary_hp">Temporary HP</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" className="min-h-12 min-w-12 text-destructive" style={{ touchAction: 'manipulation' }} aria-label={`Remove effect ${index + 1}`}
          onClick={() => { const next = rows.filter((_, i) => i !== index); onChange(next.length ? next : undefined); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <Label htmlFor={`combat-amount-${index}`}>{row.kind === 'temporary_hp' ? 'HP amount or dice' : 'Bonus'}</Label>
      <Input id={`combat-amount-${index}`} className="min-h-12" value={row.formula ?? (Number.isFinite(row.amount) ? row.amount : '')}
        placeholder={row.kind === 'temporary_hp' ? 'e.g. 8 or 1d8+3' : `1–${COMBAT_EFFECT_LIMITS[row.kind]}`}
        onChange={event => {
          const raw = event.target.value;
          if (row.kind === 'temporary_hp' && raw.trim() && !/^[+-]?\d+(?:\.\d+)?$/.test(raw.trim())) {
            replace(index, { kind: row.kind, formula: raw, durationSeconds: row.durationSeconds });
          } else replace(index, { kind: row.kind, amount: raw.trim() ? Number(raw) : NaN, durationSeconds: row.durationSeconds });
        }} />
      <Label htmlFor={`combat-duration-${index}`}>Duration (seconds)</Label>
      <Input id={`combat-duration-${index}`} type="number" min={1} max={COMBAT_EFFECT_LIMITS.durationSeconds} step={1} className="min-h-12"
        value={Number.isFinite(row.durationSeconds) ? row.durationSeconds : ''}
        onChange={event => replace(index, { ...row, durationSeconds: event.target.value.trim() ? Number(event.target.value) : NaN })} />
    </div>)}
    {errors.length > 0 && <p role="alert" className="text-sm text-destructive">{errors[0]}</p>}
  </div>;
}