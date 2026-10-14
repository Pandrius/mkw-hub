-- ============================================================
-- Lounge de MKCentral: cuenta enlazada, historial de MMR y verificación de eventos
-- ============================================================
-- El enlace sale del Discord ID de la identidad de Discord que gestiona Supabase Auth (el
-- mismo que usa api/mkc-link.ts), nunca de algo que el usuario pueda escribir.
-- Estas tablas SOLO las escribe la función api/lounge.ts con la clave de servicio.
--
-- Un evento queda "verificado" cuando:
--   · Lounge: existe un cambio de MMR del jugador con la misma puntuación total y a la hora
--     jugada (events.lounge_change_id).
--   · War: la valida el equipo rival (opponent_confirmed) o coincide con una mesa SQ 6v6 del
--     Lounge (events.lounge_table_id).
-- Solo los eventos verificados cuentan para los logros.

-- 1. Cuenta del Lounge enlazada (temporada actual) -----------------------------------------
create table public.lounge_players (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  lounge_id integer not null,
  mkc_id integer,
  name text not null,
  country_code text,
  season smallint not null,
  mmr integer,
  max_mmr integer,
  overall_rank integer,
  total_players integer,
  events_played integer,
  win_rate numeric,
  average_score numeric,
  no_sq_average_score numeric,
  partner_average numeric,
  largest_gain integer,
  rank_name text,
  -- Resumen de cada temporada: [{season, mmr, maxMmr, overallRank, eventsPlayed, winRate, averageScore}]
  seasons jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

-- 2. Historial de cambios de MMR (todas las temporadas) ------------------------------------
create table public.lounge_changes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  change_id bigint not null,
  season smallint not null,
  time timestamptz not null,
  new_mmr integer not null,
  delta integer not null,
  reason text not null,
  score smallint,
  partner_scores smallint[] not null default '{}',
  rank smallint,
  tier text,
  num_teams smallint,
  num_players smallint,
  -- Los identificadores de bonos y penalizaciones no son únicos frente a los de las mesas, por eso entra el motivo
  primary key (profile_id, reason, change_id)
);

create index lounge_changes_time_idx on public.lounge_changes (profile_id, time desc);

alter table public.lounge_players enable row level security;
alter table public.lounge_changes enable row level security;

create policy "Lounge visible" on public.lounge_players for select using (true);
create policy "Cambios de MMR visibles" on public.lounge_changes for select using (true);

revoke insert, update, delete on public.lounge_players, public.lounge_changes from anon, authenticated;

-- 3. Hora jugada y verificación en los eventos ----------------------------------------------
alter table public.events
  add column played_at timestamptz,
  add column lounge_change_id bigint unique,
  add column lounge_table_id bigint,
  add column lounge_tier text,
  add column verified_at timestamptz;

-- Un evento Lounge por jugador y hora jugada
create unique index events_lounge_hour_idx on public.events (created_by, played_at)
  where kind = 'lounge' and played_at is not null;

-- 4. Insignias destacadas y título del perfil (las escribe api/showcase.ts, ya validadas) ----
alter table public.profiles
  add column featured_badges text[] not null default '{}' check (cardinality(featured_badges) <= 3),
  add column title_id text check (char_length(title_id) <= 40);

-- 5. create_event con hora jugada -----------------------------------------------------------
drop function if exists public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[]);

create function public.create_event(
  kind public.event_kind,
  team_tag text,
  opponent_tag text,
  players text[],
  team_id integer default null,
  team_name text default null,
  opponent_team_id integer default null,
  opponent_name text default null,
  opponent_players text[] default null,
  played_at timestamptz default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  entry text;
  hour_played timestamptz;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;

  -- Hora jugada: en punto, sin fechas futuras ni de más de 7 días. Sin indicarla, la hora actual.
  hour_played := date_trunc('hour', coalesce(played_at, now()));
  if hour_played > now() then
    raise exception 'invalid: la hora jugada no puede estar en el futuro';
  end if;
  if hour_played < date_trunc('hour', now()) - interval '7 days' then
    raise exception 'invalid: la hora jugada no puede tener más de 7 días';
  end if;
  if kind = 'lounge' and exists (
    select 1 from public.events e where e.created_by = me and e.kind = 'lounge' and e.played_at = hour_played
  ) then
    raise exception 'invalid: ya tienes un evento Lounge a esa hora';
  end if;

  -- Verificación estricta: solo miembros del equipo (o admins) pueden registrar wars en nombre de un equipo
  if kind = 'war' and team_id is not null then
    if not (
      public.is_admin()
      or exists (select 1 from public.team_members tm where tm.team_id = create_event.team_id and tm.profile_id = me)
    ) then
      raise exception 'forbidden: solo los miembros de este equipo pueden registrar sus wars';
    end if;
  end if;

  insert into public.events (
    kind, team_tag, opponent_tag, created_by,
    team_id, team_name, opponent_team_id, opponent_name, opponent_players, played_at
  )
  values (
    kind,
    case when kind = 'war' then nullif(btrim(team_tag), '') end,
    case when kind = 'war' then nullif(btrim(opponent_tag), '') end,
    me,
    case when kind = 'war' then create_event.team_id end,
    case when kind = 'war' then nullif(btrim(create_event.team_name), '') end,
    case when kind = 'war' then create_event.opponent_team_id end,
    case when kind = 'war' then nullif(btrim(create_event.opponent_name), '') end,
    case when kind = 'war' then create_event.opponent_players end,
    hour_played
  )
  returning id into new_id;

  if kind = 'lounge' then
    insert into public.event_players (event_id, name, profile_id)
    select new_id, coalesce(nullif(btrim(players[1]), ''), p.username), me
    from public.profiles p where p.id = me;
  else
    if coalesce(array_length(players, 1), 0) <> 6 then
      raise exception 'invalid: a war needs exactly 6 players';
    end if;
    foreach entry in array players loop
      insert into public.event_players (event_id, name, profile_id)
      select new_id, r.name, r.profile_id from public.resolve_player(entry) r;
    end loop;
  end if;

  return new_id;
end;
$$;

revoke execute on function public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[], timestamptz) from public, anon;
grant execute on function public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[], timestamptz) to authenticated;

-- 6. player_results indica si el evento está verificado ------------------------------------
create or replace view public.player_results
with (security_invoker = true)
as
select
  p.profile_id,
  e.kind,
  e.id as event_id,
  e.finished_at,
  r.track_id,
  rr.position,
  case when e.kind = 'war' then 12 - r.missing_home - r.missing_away end as racers,
  case
    when e.kind = 'lounge' then e.lounge_change_id is not null
    else coalesce(e.opponent_confirmed, false) or e.lounge_table_id is not null
  end as verified
from public.race_results rr
join public.event_players p on p.id = rr.player_id
join public.event_races r on r.id = rr.race_id
join public.events e on e.id = r.event_id
where e.status = 'finished' and p.profile_id is not null;
