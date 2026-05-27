UPDATE public.character_saves
SET extended_data = jsonb_set(
  coalesce(extended_data, '{}'::jsonb),
  '{campaignType}',
  to_jsonb('empyrean'::text),
  true
)
WHERE (extended_data IS NOT NULL)
  AND (
    (extended_data ? 'empyreanStatus') OR
    (extended_data ? 'dragonName') OR
    (extended_data ? 'signetType') OR
    (extended_data ? 'riderEmotionalLog') OR
    ((extended_data->>'isEmpyrean')::boolean = true)
  )
  AND (extended_data->>'campaignType' IS NULL);

UPDATE public.character_saves
SET extended_data = jsonb_set(
  coalesce(extended_data, '{}'::jsonb),
  '{campaignType}',
  to_jsonb('dnd'::text),
  true
)
WHERE extended_data IS NULL OR extended_data->>'campaignType' IS NULL;