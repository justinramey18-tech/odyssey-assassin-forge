// Homebrew Spell Creation Sheet
// 3-step progressive form for creating custom spells with AI assist

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Wand2, Sparkles, ChevronDown, ChevronUp, Plus, Loader2, Trash2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HomebrewSpell } from '@/lib/spellCustomization/types';
import {
  SPELL_SCHOOL_OPTIONS,
  SPELL_LEVEL_OPTIONS,
  CASTING_TIME_OPTIONS,
  DAMAGE_TYPE_OPTIONS,
  SPELL_ICON_OPTIONS,
} from '@/lib/spellCustomization/types';
import { createDefaultHomebrewSpell, validateHomebrewSpell, generateHomebrewSpellId } from '@/lib/spellCustomization/utils';
import { SpellSchool, CastingTime, SaveStat } from '@/lib/magic/types';
import { applyTimePrefix } from '@/lib/fourthWallTime';
import { toast } from 'sonner';

interface HomebrewSpellCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (spell: HomebrewSpell) => void;
  editSpell?: HomebrewSpell | null;
  primaryClass?: string;
}

export function HomebrewSpellCreateSheet({
  isOpen,
  onClose,
  onSave,
  editSpell,
  primaryClass = 'wizard',
}: HomebrewSpellCreateSheetProps) {
  const [spell, setSpell] = useState<Partial<HomebrewSpell>>(() =>
    editSpell || createDefaultHomebrewSpell()
  );
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(false);
  const [step3Open, setStep3Open] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Reset form when opening
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setSpell(editSpell || createDefaultHomebrewSpell());
      setStep1Open(true);
      setStep2Open(false);
      setStep3Open(false);
    } else {
      onClose();
    }
  };

  const updateField = useCallback(<K extends keyof HomebrewSpell>(key: K, value: HomebrewSpell[K]) => {
    setSpell(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const ASSISTANT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homebrew-assistant`;
      const prompt = applyTimePrefix(
        `Create a complete ${spell.level === 0 ? 'cantrip' : `level ${spell.level}`} ${spell.school || 'evocation'} spell for a ${primaryClass}. Make it balanced for D&D 5e. Return ONLY a JSON object with: name, level (number 0-9), school, castingTime (action/bonus_action/reaction/ritual/1_minute/10_minutes), range (string like "60 feet"), duration (string like "1 minute" or "Instantaneous"), concentration (boolean), ritual (boolean), description (string), higherLevels (optional string), damageFormula (optional string like "3d8"), damageType (optional string), attackType (optional: melee/ranged/save/auto), saveStat (optional: STR/DEX/CON/INT/WIS/CHA), healingFormula (optional string), iconName (one of: ${SPELL_ICON_OPTIONS.join(', ')}), personalityQuips (object with thunderhead, jarvis, deadpool strings - short combat quips in each voice).`
      );

      const response = await fetch(ASSISTANT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          context: { tree: 'hunter', type: 'active', currentName: spell.name || undefined },
          mode: 'spell_concept',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || `Request failed (${response.status})`);
        return;
      }

      const data = await response.json();
      const result = data.result;
      if (!result) return;

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSpell(prev => ({
          ...prev,
          id: prev.id || generateHomebrewSpellId(),
          name: parsed.name || prev.name,
          level: parsed.level ?? prev.level,
          school: parsed.school || prev.school,
          castingTime: parsed.castingTime || prev.castingTime,
          range: parsed.range || prev.range,
          duration: parsed.duration || prev.duration,
          concentration: parsed.concentration ?? prev.concentration,
          ritual: parsed.ritual ?? prev.ritual,
          description: parsed.description || prev.description,
          higherLevels: parsed.higherLevels || prev.higherLevels,
          damageFormula: parsed.damageFormula || prev.damageFormula,
          damageType: parsed.damageType || prev.damageType,
          attackType: parsed.attackType || prev.attackType,
          saveStat: parsed.saveStat || prev.saveStat,
          healingFormula: parsed.healingFormula || prev.healingFormula,
          iconName: parsed.iconName || prev.iconName,
          personalityQuips: parsed.personalityQuips || prev.personalityQuips,
          aiGenerated: true,
          isHomebrew: true as const,
        }));
        setStep1Open(true);
        setStep2Open(true);
        setStep3Open(true);
        toast.success('AI spell generated! Review and adjust as needed.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate spell');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = () => {
    const errors = validateHomebrewSpell(spell);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    const finalSpell: HomebrewSpell = {
      id: spell.id || generateHomebrewSpellId(),
      name: spell.name!,
      level: spell.level as HomebrewSpell['level'],
      school: spell.school as SpellSchool,
      castingTime: (spell.castingTime || 'action') as CastingTime,
      range: spell.range || '60 feet',
      components: spell.components || { verbal: true, somatic: true },
      duration: spell.duration || 'Instantaneous',
      concentration: spell.concentration || false,
      ritual: spell.ritual || false,
      description: spell.description!,
      higherLevels: spell.higherLevels,
      attackType: spell.attackType,
      saveStat: spell.saveStat as SaveStat | undefined,
      damageType: spell.damageType,
      damageFormula: spell.damageFormula,
      healingFormula: spell.healingFormula,
      iconName: spell.iconName || 'Sparkles',
      classes: spell.classes,
      personalityQuips: spell.personalityQuips || {
        thunderhead: '',
        jarvis: '',
        deadpool: '',
      },
      isHomebrew: true,
      createdAt: editSpell?.createdAt || Date.now(),
      updatedAt: Date.now(),
      notes: spell.notes,
      aiGenerated: spell.aiGenerated,
    };

    onSave(finalSpell);
    onClose();
  };

  const iconLookup = LucideIcons as unknown as Record<string, LucideIcon>;
  const SelectedIcon = iconLookup[spell.iconName || 'Sparkles'] || LucideIcons.Sparkles;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-t border-indigo-500/30">
        <SheetHeader className="pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-cinzel text-lg flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-400" />
              {editSpell ? 'Edit Spell' : 'Create Homebrew Spell'}
            </SheetTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIGenerate}
              disabled={aiLoading}
              className="border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              AI Generate
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-3 mt-4 pb-20">
          {/* Step 1: Basics */}
          <Collapsible open={step1Open} onOpenChange={setStep1Open}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-indigo-600/15 border border-indigo-500/25 hover:bg-indigo-600/25 transition-colors">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-600/50 text-indigo-200 text-[10px]">1</Badge>
                <span className="font-cinzel text-sm">The Basics</span>
              </div>
              {step1Open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              {/* Name */}
              <div>
                <Label className="text-xs text-muted-foreground">Spell Name</Label>
                <Input
                  value={spell.name || ''}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g. Arcane Barrage"
                  className="bg-background/50 border-white/10"
                />
              </div>

              {/* Level & School side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Level</Label>
                  <Select
                    value={String(spell.level ?? 1)}
                    onValueChange={v => updateField('level', parseInt(v) as HomebrewSpell['level'])}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPELL_LEVEL_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">School</Label>
                  <Select
                    value={spell.school || 'evocation'}
                    onValueChange={v => updateField('school', v as SpellSchool)}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPELL_SCHOOL_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <Label className="text-xs text-muted-foreground">Icon</Label>
                <Collapsible open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-background/50 border-white/10">
                      <SelectedIcon className="w-4 h-4 text-indigo-400" />
                      {spell.iconName || 'Sparkles'}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="grid grid-cols-6 gap-2 p-2 rounded-lg bg-background/50 border border-white/10">
                      {SPELL_ICON_OPTIONS.map(iconName => {
                        const Icon = iconLookup[iconName] || LucideIcons.Sparkles;
                        return (
                          <button
                            key={iconName}
                            onClick={() => { updateField('iconName', iconName); setIconPickerOpen(false); }}
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                              spell.iconName === iconName
                                ? "bg-indigo-600/40 border border-indigo-500/60"
                                : "hover:bg-white/10"
                            )}
                          >
                            <Icon className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Step 2: Casting Mechanics */}
          <Collapsible open={step2Open} onOpenChange={setStep2Open}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-purple-600/15 border border-purple-500/25 hover:bg-purple-600/25 transition-colors">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-600/50 text-purple-200 text-[10px]">2</Badge>
                <span className="font-cinzel text-sm">Casting Mechanics</span>
              </div>
              {step2Open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Casting Time</Label>
                  <Select
                    value={spell.castingTime || 'action'}
                    onValueChange={v => updateField('castingTime', v as CastingTime)}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASTING_TIME_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Range</Label>
                  <Input
                    value={spell.range || ''}
                    onChange={e => updateField('range', e.target.value)}
                    placeholder="e.g. 60 feet"
                    className="bg-background/50 border-white/10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <Input
                  value={spell.duration || ''}
                  onChange={e => updateField('duration', e.target.value)}
                  placeholder="e.g. 1 minute, Instantaneous"
                  className="bg-background/50 border-white/10"
                />
              </div>

              {/* Components */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Components</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={spell.components?.verbal ?? true}
                      onCheckedChange={v => updateField('components', { ...spell.components!, verbal: v })}
                    />
                    <span>V</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={spell.components?.somatic ?? true}
                      onCheckedChange={v => updateField('components', { ...spell.components!, somatic: v })}
                    />
                    <span>S</span>
                  </label>
                </div>
                <Input
                  value={spell.components?.material || ''}
                  onChange={e => updateField('components', { ...spell.components!, material: e.target.value || undefined })}
                  placeholder="Material component (optional)"
                  className="bg-background/50 border-white/10"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={spell.concentration ?? false}
                    onCheckedChange={v => updateField('concentration', v)}
                  />
                  Concentration
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={spell.ritual ?? false}
                    onCheckedChange={v => updateField('ritual', v)}
                  />
                  Ritual
                </label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Step 3: Effects */}
          <Collapsible open={step3Open} onOpenChange={setStep3Open}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-violet-600/15 border border-violet-500/25 hover:bg-violet-600/25 transition-colors">
              <div className="flex items-center gap-2">
                <Badge className="bg-violet-600/50 text-violet-200 text-[10px]">3</Badge>
                <span className="font-cinzel text-sm">Effects & Description</span>
              </div>
              {step3Open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-3 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  value={spell.description || ''}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Describe what the spell does..."
                  rows={4}
                  className="bg-background/50 border-white/10"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">At Higher Levels</Label>
                <Textarea
                  value={spell.higherLevels || ''}
                  onChange={e => updateField('higherLevels', e.target.value)}
                  placeholder="What changes when cast at a higher level? (optional)"
                  rows={2}
                  className="bg-background/50 border-white/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Damage Formula</Label>
                  <Input
                    value={spell.damageFormula || ''}
                    onChange={e => updateField('damageFormula', e.target.value || undefined)}
                    placeholder="e.g. 3d8"
                    className="bg-background/50 border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Damage Type</Label>
                  <Select
                    value={spell.damageType || ''}
                    onValueChange={v => updateField('damageType', v)}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {DAMAGE_TYPE_OPTIONS.map(type => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Attack Type</Label>
                  <Select
                    value={spell.attackType || ''}
                    onValueChange={v => updateField('attackType', v as HomebrewSpell['attackType'])}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="melee">Melee</SelectItem>
                      <SelectItem value="ranged">Ranged</SelectItem>
                      <SelectItem value="save">Saving Throw</SelectItem>
                      <SelectItem value="auto">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Save Stat</Label>
                  <Select
                    value={spell.saveStat || ''}
                    onValueChange={v => updateField('saveStat', v as SaveStat)}
                  >
                    <SelectTrigger className="bg-background/50 border-white/10">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="STR">STR</SelectItem>
                      <SelectItem value="DEX">DEX</SelectItem>
                      <SelectItem value="CON">CON</SelectItem>
                      <SelectItem value="INT">INT</SelectItem>
                      <SelectItem value="WIS">WIS</SelectItem>
                      <SelectItem value="CHA">CHA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Healing Formula (optional)</Label>
                <Input
                  value={spell.healingFormula || ''}
                  onChange={e => updateField('healingFormula', e.target.value || undefined)}
                  placeholder="e.g. 2d8+4"
                  className="bg-background/50 border-white/10"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                <Textarea
                  value={spell.notes || ''}
                  onChange={e => updateField('notes', e.target.value)}
                  placeholder="Personal notes about this spell..."
                  rows={2}
                  className="bg-background/50 border-white/10"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Save Button */}
          <div className="pt-4 flex gap-3">
            <Button
              onClick={handleSave}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              {editSpell ? 'Update Spell' : 'Create Spell'}
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
