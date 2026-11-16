-- Solo Empyrean Live NPCs (DECISIONS D-38, 2026-11-16).
-- One row per NPC a player has met (or built) in one solo campaign: how they feel about the
-- rider, what they remember, and whether they are met, knocked out, dead or hidden from the
-- roster. Built-in canon characters are not stored here (their minds ship with the app); a
-- row for one holds only its campaign state. A Quick Build NPC keeps its mind in `custom`.
-- Owner-only: each player reads and writes only their own rows. No live updates.

create table if not exists public.solo_npcs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  campaign_id uuid not null references public.ai_dm_campaigns(id) on delete cascade,
  npc_key text not null check (char_length(npc_key) between 1 and 80),
  name text not null check (char_length(name) between 1 and 80),
  custom jsonb,
  attitude integer not null default 0 check (attitude between -3 and 3),
  memories jsonb not null default '[]'::jsonb,
  status text not null default 'met' check (status in ('met', 'knocked_out', 'dead', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_id, npc_key)
);

grant select, insert, update, delete on public.solo_npcs to authenticated;
grant all on public.solo_npcs to service_role;

create index if not exists solo_npcs_campaign_idx on public.solo_npcs (user_id, campaign_id);

alter table public.solo_npcs enable row level security;

create policy "Owners read their solo NPCs" on public.solo_npcs
  for select to authenticated using (auth.uid() = user_id);
create policy "Owners add their solo NPCs" on public.solo_npcs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Owners update their solo NPCs" on public.solo_npcs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners delete their solo NPCs" on public.solo_npcs
  for delete to authenticated using (auth.uid() = user_id);