-- NPC Quick Build 1/4: the host's reusable NPC templates (personal, usable in any party)
CREATE TABLE IF NOT EXISTS public.npc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_templates TO authenticated;
GRANT ALL ON public.npc_templates TO service_role;
CREATE INDEX IF NOT EXISTS npc_templates_user ON public.npc_templates (user_id, updated_at DESC);
DROP TRIGGER IF EXISTS npc_templates_updated_at ON public.npc_templates;
CREATE TRIGGER npc_templates_updated_at BEFORE UPDATE ON public.npc_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.npc_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can see their NPC templates" ON public.npc_templates;
CREATE POLICY "Owners can see their NPC templates" ON public.npc_templates FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owners can add NPC templates" ON public.npc_templates;
CREATE POLICY "Owners can add NPC templates" ON public.npc_templates FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Owners can change NPC templates" ON public.npc_templates;
CREATE POLICY "Owners can change NPC templates" ON public.npc_templates FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Owners can delete NPC templates" ON public.npc_templates;
CREATE POLICY "Owners can delete NPC templates" ON public.npc_templates FOR DELETE USING (user_id = auth.uid());