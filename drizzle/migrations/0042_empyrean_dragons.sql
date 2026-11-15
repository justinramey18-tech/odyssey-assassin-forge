-- Empyrean dragon record (DECISIONS D-30, 2026-11-15).
-- One row per rider and bonded dragon: the bond and trust meters, open trust wounds, the
-- dragon's mood, and a snapshot of its phone-side state (memories, speech habits, emotional
-- log, counters). A new dragon after rebirth is a new row; the same dragon carries across
-- campaigns. Every meter change is logged with its reason in empyrean_dragon_events.
-- Owner-only: each player reads and writes only their own dragons.

create table if not exists public.empyrean_dragons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  rider_key text not null,
  dragon_name text not null,
  rider_name text,
  bond integer not null default 15 check (bond between 0 and 100),
  trust integer not null default 10 check (trust between 0 and 100),
  wounds integer not null default 0 check (wounds between 0 and 3),
  mood text not null default 'calm',
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rider_key, dragon_name)
);

grant select, insert, update, delete on public.empyrean_dragons to authenticated;
grant all on public.empyrean_dragons to service_role;

create table if not exists public.empyrean_dragon_events (
  id uuid primary key default gen_random_uuid(),
  dragon_id uuid not null references public.empyrean_dragons(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  source text not null,
  reason text,
  bond_delta integer not null default 0,
  trust_delta integer not null default 0,
  wounds_delta integer not null default 0,
  bond_after integer not null,
  trust_after integer not null,
  wounds_after integer not null,
  created_at timestamptz not null default now()
);

grant select, insert on public.empyrean_dragon_events to authenticated;
grant all on public.empyrean_dragon_events to service_role;

create index if not exists empyrean_dragon_events_dragon_created_idx
  on public.empyrean_dragon_events (dragon_id, created_at desc);

alter table public.empyrean_dragons enable row level security;
alter table public.empyrean_dragon_events enable row level security;

create policy "Owners read their dragons" on public.empyrean_dragons
  for select to authenticated using (auth.uid() = user_id);
create policy "Owners add their dragons" on public.empyrean_dragons
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Owners update their dragons" on public.empyrean_dragons
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners delete their dragons" on public.empyrean_dragons
  for delete to authenticated using (auth.uid() = user_id);

create policy "Owners read their dragon history" on public.empyrean_dragon_events
  for select to authenticated using (auth.uid() = user_id);
create policy "Owners add to their dragon history" on public.empyrean_dragon_events
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (select 1 from public.empyrean_dragons d where d.id = dragon_id and d.user_id = auth.uid())
  );

-- One atomic save: the new meters and state, guarded by the row's version, plus one history
-- row when a meter moved. Returns the saved row as JSON, or null when the version no longer
-- matches (another device saved first) so the app can reload and try again.
create or replace function public.apply_dragon_change(
  p_dragon_id uuid,
  p_expected_version integer,
  p_bond integer,
  p_trust integer,
  p_wounds integer,
  p_mood text,
  p_state jsonb,
  p_source text,
  p_reason text,
  p_bond_delta integer,
  p_trust_delta integer,
  p_wounds_delta integer
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved public.empyrean_dragons;
begin
  update public.empyrean_dragons
     set bond = p_bond,
         trust = p_trust,
         wounds = p_wounds,
         mood = coalesce(p_mood, mood),
         state = coalesce(p_state, state),
         version = version + 1,
         updated_at = now()
   where id = p_dragon_id
     and user_id = auth.uid()
     and version = p_expected_version
  returning * into saved;

  if not found then
    return null;
  end if;

  if p_source is not null and (coalesce(p_bond_delta, 0) <> 0 or coalesce(p_trust_delta, 0) <> 0 or coalesce(p_wounds_delta, 0) <> 0) then
    insert into public.empyrean_dragon_events
      (dragon_id, user_id, source, reason, bond_delta, trust_delta, wounds_delta, bond_after, trust_after, wounds_after)
    values
      (saved.id, saved.user_id, p_source, left(p_reason, 300), coalesce(p_bond_delta, 0), coalesce(p_trust_delta, 0), coalesce(p_wounds_delta, 0), saved.bond, saved.trust, saved.wounds);
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.apply_dragon_change(uuid, integer, integer, integer, integer, text, jsonb, text, text, integer, integer, integer) from public;
grant execute on function public.apply_dragon_change(uuid, integer, integer, integer, integer, text, jsonb, text, text, integer, integer, integer) to authenticated;
