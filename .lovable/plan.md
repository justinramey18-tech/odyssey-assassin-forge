

## Plan: Enable Homebrew Content Creation in AI Assistant

The AI assistant currently only handles basic character config (name, class, stats, presets). This plan adds full homebrew creation for gear, spells, abilities, and consumables — with mechanics, lore, and auto-application.

### 1. Expand the Edge Function System Prompt
**File:** `supabase/functions/ai-creation-assistant/index.ts`

Add new sections to the system prompt covering:
- **Homebrew Gear Creation** — AI can generate custom equipment items with slot type, rarity, stats (AC, damage, attack bonus, ability modifiers), properties, weight, value, description, and lore. Knows all valid slot types and stat fields from `EquipmentStats`.
- **Homebrew Spell Creation** — AI can create custom spells with level (0-9), school, casting time, range, components (V/S/M), duration, concentration, ritual, damage dice/type, description, and higher-level scaling.
- **Homebrew Ability Creation** — AI can design custom abilities for any tree (hunter/warrior/assassin) with type (active/passive), action type, usage type, tier effects (3 tiers with descriptions), dice per tier, cooldown, attack type, and prerequisites.
- **Custom Consumables** — AI can create potions, poisons, and scrolls with rarity, effect text, duration, usage type, and description.

Update the JSON output schema to include arrays: `homebrewGear`, `homebrewSpells`, `homebrewAbilities`, `homebrewConsumables` alongside existing fields. When a user asks for custom content (e.g., "flight leathers"), the AI generates fully-specced items with all required fields.

### 2. Expand CharacterBuildData Interface
**File:** `src/hooks/use-ai-creation-chat.ts`

Add to `CharacterBuildData`:
```typescript
homebrewGear?: Array<{
  name: string; slotType: EquipmentSlotType; rarity: Rarity;
  level: number; icon: string; weight: number; value: number;
  description: string; lore: string; properties: string[];
  stats: Record<string, number | string>; damage: string;
}>;
homebrewSpells?: Array<{
  name: string; level: number; school: string;
  castingTime: string; range: string;
  components: { verbal: boolean; somatic: boolean; material?: string };
  duration: string; concentration: boolean; ritual: boolean;
  description: string; damageType?: string; damageDice?: string;
  iconName: string;
}>;
homebrewAbilities?: Array<{
  name: string; tree: string; icon: string;
  type: 'active' | 'passive'; actionType: string; usageType: string;
  tierEffects: Array<{ tier: number; description: string }>;
  dice?: { tier1?: { count: number; die: number }; ... };
  cooldownMinutes: number; attackType?: string; notes?: string;
}>;
homebrewConsumables?: Array<{
  name: string; type: 'potion' | 'poison' | 'scroll';
  rarity: string; effect: string; duration: string;
  description: string; usageType: string; icon: string;
}>;
```

### 3. Update Apply Logic to Save Homebrew Content
**File:** `src/pages/AICreationAssistant.tsx`

In `handleApply`, before navigating, save all homebrew content directly to localStorage using the existing save functions:
- **Gear:** Import `saveHomebrewGear`/`loadHomebrewGear` from `homebrewGear.ts`, convert each item via `formToEquipmentItem`, append to existing homebrew gear, and save.
- **Spells:** Import `saveSpellCustomization`/`loadSpellCustomization` from `spellCustomization/utils.ts`, create `HomebrewSpell` objects with generated IDs, append to existing state, and save.
- **Abilities:** Load/save the ability customization state from localStorage key (`odyssey-ability-customization` or similar — will verify), create `HomebrewAbility` objects with generated IDs, append, and save.
- **Consumables:** Save as custom consumable inventory items to the character-scoped consumable storage key.

Also pass the homebrew gear to the equipment slots if slot types match (auto-equip created gear).

### 4. Update Index.tsx to Dispatch Events
**File:** `src/pages/Index.tsx`

After applying the AI character state, dispatch `odyssey-character-loaded` event so hooks that read from localStorage (spell customization, ability customization, homebrew gear) re-initialize and pick up the newly saved homebrew content.

### 5. Update Summary Display
The system prompt summary section will be expanded to list all homebrew items created:
```
🗡️ Custom Gear: Flight Leathers (chest, rare), Rider's Blade (primary, uncommon)
📜 Custom Spells: Dragon's Breath (3rd, evocation)
⚡ Custom Abilities: Wing Slash (hunter, active)
🧪 Custom Consumables: Rider's Tonic (potion, uncommon)
```

