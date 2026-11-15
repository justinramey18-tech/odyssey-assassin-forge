-- Solo Empyrean engine (master plan 2026-11-15): one record set, one clock, one inbox.
--   empyrean_riders          progress that follows the rider across campaigns (Signet Mastery)
--   empyrean_campaign_state  rule state for one solo campaign (rests, conditions, injuries, needs, events)
--   empyrean_rule_events     history of every rule result AND the list of results waiting for the phone
--   solo_campaign_maps       the campaign atlas; its campaignMinute is the campaign's only clock
--   solo_location_guides     the player's private area guides for that atlas
--   solo_travel_events       private journey encounters planned by the server (never readable by players)
-- Players read their own rows. Rule state and the ledger are written only by the server
-- (edge function empyrean-rules, service role). The atlas is written through
-- write_solo_campaign_atlas (owner only). Nothing here touches a party table.

create table if not exists public.empyrean_riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  rider_key text not null check (char_length(rider_key) between 1 and 80),
  signet_xp integer not null default 0 check (signet_xp >= 0),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rider_key)
);

create table if not exists public.empyrean_campaign_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.ai_dm_campaigns(id) on delete cascade,
  rider_key text not null default 'local' check (char_length(rider_key) between 1 and 80),
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, campaign_id)
);

create table if not exists public.empyrean_rule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.ai_dm_campaigns(id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  reason text check (reason is null or char_length(reason) <= 300),
  xp integer not null default 0,
  gold integer not null default 0,
  hp integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  idem_key text not null check (char_length(idem_key) between 1 and 200),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  unique (user_id, idem_key)
);
create index if not exists empyrean_rule_events_waiting
  on public.empyrean_rule_events (user_id, campaign_id, created_at) where applied_at is null;
create index if not exists empyrean_rule_events_history
  on public.empyrean_rule_events (user_id, campaign_id, created_at desc);

create table if not exists public.solo_campaign_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null unique references public.ai_dm_campaigns(id) on delete cascade,
  state_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.solo_location_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  campaign_id uuid not null references public.ai_dm_campaigns(id) on delete cascade,
  map_id uuid not null,
  scope text not null check (scope in ('map','location')),
  location_id text,
  name text not null check (btrim(name) <> '' and char_length(name) <= 120),
  content text not null check (char_length(content) <= 30000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint solo_location_guides_scope_location check (
    (scope = 'map' and location_id is null)
    or (scope = 'location' and location_id is not null and btrim(location_id) <> '' and char_length(location_id) <= 200)
  )
);
create unique index if not exists solo_location_guides_one_map_guide
  on public.solo_location_guides (campaign_id, map_id) where scope = 'map';
create unique index if not exists solo_location_guides_one_location_guide
  on public.solo_location_guides (campaign_id, map_id, location_id) where scope = 'location';

create table if not exists public.solo_travel_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.ai_dm_campaigns(id) on delete cascade,
  status text not null check (status in ('planned','scheduled','firing','posted','no_event','cancelled','failed')),
  destination_location_id text,
  tranche_key text not null,
  event_type text,
  premise text check (premise is null or char_length(premise) <= 2000),
  target_fraction double precision check (target_fraction is null or (target_fraction > 0 and target_fraction < 1)),
  scheduled_at timestamptz,
  fire_token_hash text,
  dm_context text check (dm_context is null or char_length(dm_context) <= 60000),
  dm_model text,
  attempt_count integer not null default 0,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists solo_travel_events_one_open
  on public.solo_travel_events (campaign_id) where status in ('planned','scheduled','firing');
create index if not exists solo_travel_events_recent on public.solo_travel_events (user_id, created_at desc);

revoke all on public.empyrean_riders, public.empyrean_campaign_state, public.empyrean_rule_events,
  public.solo_campaign_maps, public.solo_location_guides, public.solo_travel_events from public, anon, authenticated;
grant select on public.empyrean_riders, public.empyrean_campaign_state, public.empyrean_rule_events,
  public.solo_campaign_maps to authenticated;
grant select, insert, update, delete on public.solo_location_guides to authenticated;
grant all on public.empyrean_riders, public.empyrean_campaign_state, public.empyrean_rule_events,
  public.solo_campaign_maps, public.solo_location_guides, public.solo_travel_events to service_role;

-- updated_at
drop trigger if exists empyrean_riders_updated_at on public.empyrean_riders;
create trigger empyrean_riders_updated_at before update on public.empyrean_riders
  for each row execute function public.update_updated_at_column();
drop trigger if exists empyrean_campaign_state_updated_at on public.empyrean_campaign_state;
create trigger empyrean_campaign_state_updated_at before update on public.empyrean_campaign_state
  for each row execute function public.update_updated_at_column();
drop trigger if exists solo_campaign_maps_updated_at on public.solo_campaign_maps;
create trigger solo_campaign_maps_updated_at before update on public.solo_campaign_maps
  for each row execute function public.update_updated_at_column();
drop trigger if exists solo_location_guides_updated_at on public.solo_location_guides;
create trigger solo_location_guides_updated_at before update on public.solo_location_guides
  for each row execute function public.update_updated_at_column();
drop trigger if exists solo_travel_events_updated_at on public.solo_travel_events;
create trigger solo_travel_events_updated_at before update on public.solo_travel_events
  for each row execute function public.update_updated_at_column();

-- Access: players read their own rows; only the area guides are theirs to write directly.
alter table public.empyrean_riders enable row level security;
alter table public.empyrean_campaign_state enable row level security;
alter table public.empyrean_rule_events enable row level security;
alter table public.solo_campaign_maps enable row level security;
alter table public.solo_location_guides enable row level security;
alter table public.solo_travel_events enable row level security;


drop policy if exists "Owners read their rider progress" on public.empyrean_riders;
create policy "Owners read their rider progress" on public.empyrean_riders
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owners read their campaign rule state" on public.empyrean_campaign_state;
create policy "Owners read their campaign rule state" on public.empyrean_campaign_state
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owners read their rule events" on public.empyrean_rule_events;
create policy "Owners read their rule events" on public.empyrean_rule_events
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owners read their solo map" on public.solo_campaign_maps;
create policy "Owners read their solo map" on public.solo_campaign_maps
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owners read their solo area guides" on public.solo_location_guides;
create policy "Owners read their solo area guides" on public.solo_location_guides
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Owners add their solo area guides" on public.solo_location_guides;
create policy "Owners add their solo area guides" on public.solo_location_guides
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.ai_dm_campaigns c where c.id = campaign_id and c.user_id = auth.uid()));
drop policy if exists "Owners update their solo area guides" on public.solo_location_guides;
create policy "Owners update their solo area guides" on public.solo_location_guides
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Owners delete their solo area guides" on public.solo_location_guides;
create policy "Owners delete their solo area guides" on public.solo_location_guides
  for delete to authenticated using (user_id = auth.uid());

-- The owner saves the whole atlas, compare-and-swap on updated_at (same contract as the party's
-- write_campaign_atlas). In-game time never runs backward through this door.
create or replace function public.write_solo_campaign_atlas(_campaign_id uuid, _envelope jsonb, _expected_updated_at timestamptz)
returns table(id uuid, state_data jsonb, updated_at timestamptz, server_time timestamptz)
language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := auth.uid();
  cur public.solo_campaign_maps%rowtype;
  have boolean;
  persisted numeric; next_rev numeric; env jsonb; old_minute numeric; new_minute numeric;
begin
  if uid is null or not exists (select 1 from public.ai_dm_campaigns c where c.id = _campaign_id and c.user_id = uid) then
    raise exception 'Only the campaign''s owner can save its map' using errcode = '42501';
  end if;
  perform public.campaign_atlas_validate(_envelope);

  select * into cur from public.solo_campaign_maps m where m.campaign_id = _campaign_id for update;
  have := found;
  if not have then
    if _expected_updated_at is not null then raise exception 'Campaign map changed; reload first' using errcode = '40001'; end if;
    persisted := -1;
  else
    if cur.user_id <> uid then raise exception 'Only the campaign''s owner can save its map' using errcode = '42501'; end if;
    if _expected_updated_at is null or cur.updated_at <> _expected_updated_at then
      raise exception 'Campaign map changed; reload first' using errcode = '40001';
    end if;
    persisted := coalesce((cur.state_data->>'revision')::numeric, -1);
  end if;
  if (_envelope->>'revision')::numeric <> greatest(persisted, 0) then
    raise exception 'Atlas revision does not match the saved map' using errcode = '40001';
  end if;
  next_rev := persisted + 1;
  env := jsonb_set(jsonb_set(_envelope, '{revision}', to_jsonb(next_rev)), '{sourcePartyId}', to_jsonb(_campaign_id::text));
  if have then
    old_minute := coalesce((cur.state_data->>'campaignMinute')::numeric, 0);
    new_minute := coalesce((env->>'campaignMinute')::numeric, 0);
    if new_minute < old_minute then env := jsonb_set(env, '{campaignMinute}', to_jsonb(old_minute)); end if;
  end if;

  if not have then
    insert into public.solo_campaign_maps as m (user_id, campaign_id, state_data)
      values (uid, _campaign_id, env)
      on conflict (campaign_id) do nothing
      returning m.id, m.state_data, m.updated_at into id, state_data, updated_at;
    if id is null then raise exception 'Campaign map was created elsewhere; reload first' using errcode = '40001'; end if;
  else
    update public.solo_campaign_maps m set state_data = env, updated_at = clock_timestamp()
      where m.id = cur.id
      returning m.id, m.state_data, m.updated_at into id, state_data, updated_at;
  end if;
  server_time := now();
  return next;
end $$;
revoke all on function public.write_solo_campaign_atlas(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.write_solo_campaign_atlas(uuid, jsonb, timestamptz) to authenticated, service_role;

-- The one atomic save for a rule result (server only): the campaign's rule state (version-checked),
-- the rider's Signet Mastery, the in-game clock, and the ledger rows, all or nothing.
-- _advance_minutes adds time; _set_minute jumps forward to an exact minute (a long rest to dawn).
-- Time cannot move while the rider is in the air (active travel with a start time). While a leg
-- is paused (an encounter, a stop), time passes by sliding that leg's start forward.
create or replace function public.empyrean_commit(
  _user_id uuid, _campaign_id uuid, _rider_key text, _expected_version integer, _state jsonb,
  _signet_xp_delta integer default 0, _advance_minutes double precision default 0,
  _set_minute double precision default null, _events jsonb default '[]'::jsonb)
returns jsonb
language plpgsql security invoker set search_path to 'public' as $$
declare
  cs public.empyrean_campaign_state%rowtype;
  mp public.solo_campaign_maps%rowtype;
  have_state boolean;
  travel jsonb; env jsonb; node_index integer; paused boolean := false;
  cur_minute double precision; next_minute double precision; new_version integer; new_xp integer;
begin
  if not exists (select 1 from public.ai_dm_campaigns c where c.id = _campaign_id and c.user_id = _user_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;
  select * into cs from public.empyrean_campaign_state s
    where s.user_id = _user_id and s.campaign_id = _campaign_id for update;
  have_state := found;
  if coalesce(cs.version, 0) <> coalesce(_expected_version, 0) then
    return jsonb_build_object('ok', false, 'reason', 'version', 'version', coalesce(cs.version, 0));
  end if;

  if coalesce(_advance_minutes, 0) > 0 or _set_minute is not null then
    select * into mp from public.solo_campaign_maps m where m.campaign_id = _campaign_id and m.user_id = _user_id for update;
    if not found then return jsonb_build_object('ok', false, 'reason', 'no_map'); end if;
    select (ord - 1)::integer, n->'state'->'activeTravel' into node_index, travel
      from jsonb_array_elements(mp.state_data->'maps') with ordinality as a(n, ord)
      where n->>'id' = mp.state_data->>'activeMapId' limit 1;
    cur_minute := coalesce((mp.state_data->>'campaignMinute')::double precision, 0);
    if travel is not null and jsonb_typeof(travel) = 'object' then
      if jsonb_typeof(travel->'startedAt') = 'number' then
        return jsonb_build_object('ok', false, 'reason', 'traveling');
      end if;
      -- A paused leg carries its own clock: time passes by sliding the leg's start forward.
      cur_minute := coalesce((travel->>'startCampaignMinute')::double precision, cur_minute)
        + coalesce((travel->>'gameMinutes')::double precision, 0) * least(greatest(coalesce((travel->>'pausedFraction')::double precision, 0), 0), 1);
      paused := true;
    end if;
    next_minute := greatest(cur_minute + greatest(coalesce(_advance_minutes, 0), 0), coalesce(_set_minute, 0));
    env := jsonb_set(mp.state_data, '{campaignMinute}',
      to_jsonb(coalesce((mp.state_data->>'campaignMinute')::double precision, 0) + (next_minute - cur_minute)));
    if paused then
      env := jsonb_set(env, array['maps', node_index::text, 'state', 'activeTravel', 'startCampaignMinute'],
        to_jsonb(coalesce((travel->>'startCampaignMinute')::double precision, 0) + (next_minute - cur_minute)));
    end if;
    env := jsonb_set(env, '{revision}', to_jsonb(coalesce((env->>'revision')::numeric, 0) + 1));
    update public.solo_campaign_maps m set state_data = env, updated_at = clock_timestamp() where m.id = mp.id;
  end if;

  if have_state then
    update public.empyrean_campaign_state s
      set state = _state, version = s.version + 1, rider_key = coalesce(_rider_key, s.rider_key)
      where s.id = cs.id returning s.version into new_version;
  else
    insert into public.empyrean_campaign_state (user_id, campaign_id, rider_key, state, version)
      values (_user_id, _campaign_id, coalesce(_rider_key, 'local'), _state, 1)
      returning version into new_version;
  end if;

  insert into public.empyrean_riders as r (user_id, rider_key, signet_xp)
    values (_user_id, coalesce(_rider_key, 'local'), greatest(coalesce(_signet_xp_delta, 0), 0))
    on conflict (user_id, rider_key) do update
      set signet_xp = greatest(r.signet_xp + coalesce(_signet_xp_delta, 0), 0)
    returning r.signet_xp into new_xp;

  insert into public.empyrean_rule_events (user_id, campaign_id, kind, reason, xp, gold, hp, payload, idem_key)
    select _user_id, _campaign_id, left(e->>'kind', 40), left(e->>'reason', 300),
           coalesce((e->>'xp')::integer, 0), coalesce((e->>'gold')::integer, 0), coalesce((e->>'hp')::integer, 0),
           coalesce(e->'payload', '{}'::jsonb), left(e->>'idem_key', 200)
    from jsonb_array_elements(coalesce(_events, '[]'::jsonb)) as t(e)
    where coalesce(e->>'kind', '') <> '' and coalesce(e->>'idem_key', '') <> ''
    on conflict (user_id, idem_key) do nothing;

  return jsonb_build_object('ok', true, 'version', new_version, 'signet_xp', new_xp, 'minute', next_minute);
end $$;
revoke all on function public.empyrean_commit(uuid, uuid, text, integer, jsonb, integer, double precision, double precision, jsonb) from public, anon, authenticated;
grant execute on function public.empyrean_commit(uuid, uuid, text, integer, jsonb, integer, double precision, double precision, jsonb) to service_role;