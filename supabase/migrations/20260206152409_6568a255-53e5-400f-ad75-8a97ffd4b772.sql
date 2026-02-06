-- Add extended_data column to store all additional save data (spellcasting, conditions, etc.)
ALTER TABLE public.character_saves 
ADD COLUMN extended_data JSONB DEFAULT '{}'::jsonb;

-- Add a comment to document the extended data structure
COMMENT ON COLUMN public.character_saves.extended_data IS 'Extended save data including: spellcasting, activeSpells, conditions, prestigeTree, shopGold, loot, proficiencies, expertise, inspiration, combatSettings, abilityScores, hpState, deathSaves';