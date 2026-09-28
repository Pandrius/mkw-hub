-- ============================================================
-- Eventos (war / lounge), carreras y resultados por jugador
-- ============================================================
-- Toda la escritura pasa por funciones (create_event, save_race, …) que validan las
-- reglas. Así la web y el bot de Discord comparten exactamente la misma lógica.
--
-- War: 6v6, 12 carreras. Se guardan las posiciones de los jugadores del equipo propio;
--      las del rival son las posiciones restantes. Carreras de 11 o 10 jugadores
--      indicando cuántos faltan de cada equipo.
-- Lounge: se guarda la posición del jugador (1..24).

create type public.event_kind as enum ('war', 'lounge');
create type public.event_status as enum ('open', 'finished');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  kind public.event_kind not null,
  status public.event_status not null default 'open',
  team_tag text check (char_length(team_tag) <= 12),
  opponent_tag text check (char_length(opponent_tag) <= 12),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index events_created_by_idx on public.events (created_by, created_at desc);

-- Jugadores del evento. name = nombre en el juego; profile_id = usuario de la web (si lo tiene)
create table public.event_players (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, name)
);

create index event_players_profile_idx on public.event_players (profile_id);

create table public.event_races (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.events on delete cascade,
  race_no smallint not null check (race_no between 1 and 12),
  track_id text not null,
  missing_home smallint not null default 0 check (missing_home between 0 and 2),
  missing_away smallint not null default 0 check (missing_away between 0 and 2),
  created_at timestamptz not null default now(),
  check (missing_home + missing_away <= 2),
  unique (event_id, race_no)
);

create table public.race_results (
  race_id bigint not null references public.event_races on delete cascade,
  player_id bigint not null references public.event_players on delete cascade,
  position smallint not null check (position between 1 and 24),
  primary key (race_id, player_id),
  unique (race_id, position)
);

-- Lectura pública (las estadísticas son visibles para todos); escritura solo por funciones
alter table public.events enable row level security;
alter table public.event_players enable row level security;
alter table public.event_races enable row level security;
alter table public.race_results enable row level security;

create policy "Eventos visibles" on public.events for select using (true);
create policy "Jugadores visibles" on public.event_players for select using (true);
create policy "Carreras visibles" on public.event_races for select using (true);
create policy "Resultados visibles" on public.race_results for select using (true);

revoke insert, update, delete on public.events, public.event_players, public.event_races, public.race_results
  from anon, authenticated;

-- ¿Puede el usuario actual modificar el evento? Abierto y (creador o jugador vinculado)
create function public.can_edit_event(target uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = target
      and e.status = 'open'
      and (
        e.created_by = auth.uid()
        or exists (select 1 from public.event_players p where p.event_id = e.id and p.profile_id = auth.uid())
      )
  );
$$;

-- "Peckmat = tortelini" → usuario Peckmat, nombre en el juego tortelini.
-- Sin "=", el nombre sirve para las dos cosas. Devuelve (name, profile_id).
create function public.resolve_player(entry text)
returns table (name text, profile_id uuid)
language plpgsql stable
security definer set search_path = ''
as $$
declare
  account text;
  ingame text;
begin
  if position('=' in entry) > 0 then
    account := btrim(split_part(entry, '=', 1));
    ingame := btrim(substr(entry, position('=' in entry) + 1));
  else
    account := btrim(entry);
    ingame := account;
  end if;
  if ingame = '' then
    raise exception 'invalid: empty player name';
  end if;
  return query
    select ingame, (select p.id from public.profiles p where lower(p.username) = lower(account) limit 1);
end;
$$;

-- Crea un evento. War: lista de jugadores (6). Lounge: el propio usuario.
create function public.create_event(kind public.event_kind, team_tag text, opponent_tag text, players text[])
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  entry text;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;

  insert into public.events (kind, team_tag, opponent_tag, created_by)
  values (
    kind,
    case when kind = 'war' then nullif(btrim(team_tag), '') end,
    case when kind = 'war' then nullif(btrim(opponent_tag), '') end,
    me
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

-- Añade un jugador (sustituto) a una war abierta. Devuelve su id.
create function public.add_event_player(target uuid, entry text)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  new_id bigint;
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  if (select kind from public.events where id = target) <> 'war' then
    raise exception 'invalid: only wars have substitutes';
  end if;
  insert into public.event_players (event_id, name, profile_id)
  select target, r.name, r.profile_id from public.resolve_player(entry) r
  returning id into new_id;
  return new_id;
end;
$$;

-- Guarda (crea o sustituye) una carrera con sus resultados.
-- results: [{"player_id": 1, "position": 3}, …]
create function public.save_race(
  target uuid,
  race_no smallint,
  track_id text,
  results jsonb,
  missing_home smallint default 0,
  missing_away smallint default 0
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  ev public.events;
  racers int;
  n_results int;
  race bigint;
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  select * into ev from public.events where id = target;

  create temp table _res on commit drop as
    select (x ->> 'player_id')::bigint as player_id, (x ->> 'position')::smallint as position
    from jsonb_array_elements(results) x;

  n_results := (select count(*) from _res);

  if exists (select 1 from _res r where not exists (
    select 1 from public.event_players p where p.id = r.player_id and p.event_id = target)) then
    raise exception 'invalid: player does not belong to this event';
  end if;
  if (select count(distinct player_id) from _res) <> n_results then
    raise exception 'invalid: repeated player';
  end if;
  if (select count(distinct position) from _res) <> n_results then
    raise exception 'invalid: repeated position';
  end if;

  if ev.kind = 'war' then
    if missing_home + missing_away > 2 then
      raise exception 'invalid: at most 2 missing players';
    end if;
    if n_results + missing_home <> 6 then
      raise exception 'invalid: your team must have 6 players (results + missing)';
    end if;
    racers := 12 - missing_home - missing_away;
    if exists (select 1 from _res where position < 1 or position > racers) then
      raise exception 'invalid: position out of range for a % player race', racers;
    end if;
  else
    if n_results <> 1 or missing_home <> 0 or missing_away <> 0 then
      raise exception 'invalid: a lounge race has exactly one result';
    end if;
  end if;

  insert into public.event_races (event_id, race_no, track_id, missing_home, missing_away)
  values (target, race_no, track_id, missing_home, missing_away)
  on conflict (event_id, race_no) do update
    set track_id = excluded.track_id, missing_home = excluded.missing_home, missing_away = excluded.missing_away
  returning id into race;

  delete from public.race_results where race_id = race;
  insert into public.race_results (race_id, player_id, position)
  select race, player_id, position from _res;
end;
$$;

create function public.delete_race(target uuid, race_no smallint)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  delete from public.event_races r where r.event_id = target and r.race_no = delete_race.race_no;
end;
$$;

-- Finaliza el evento: a partir de aquí queda bloqueado
create function public.finish_event(target uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  if not exists (select 1 from public.event_races where event_id = target) then
    raise exception 'invalid: the event has no races';
  end if;
  update public.events set status = 'finished', finished_at = now() where id = target;
end;
$$;

-- Borrar: el creador mientras esté abierto, o un admin siempre
create function public.delete_event(target uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or exists (select 1 from public.events where id = target and status = 'open' and created_by = auth.uid())
  ) then
    raise exception 'forbidden: only the creator (while open) or an admin can delete it';
  end if;
  delete from public.events where id = target;
end;
$$;

revoke execute on function public.create_event, public.add_event_player, public.save_race,
  public.delete_race, public.finish_event, public.delete_event, public.resolve_player
  from public, anon;
grant execute on function public.create_event, public.add_event_player, public.save_race,
  public.delete_race, public.finish_event, public.delete_event
  to authenticated;

-- Resultados finalizados de jugadores registrados (para estadísticas)
create view public.player_results
with (security_invoker = true)
as
select
  p.profile_id,
  e.kind,
  e.id as event_id,
  e.finished_at,
  r.track_id,
  rr.position,
  case when e.kind = 'war' then 12 - r.missing_home - r.missing_away end as racers
from public.race_results rr
join public.event_players p on p.id = rr.player_id
join public.event_races r on r.id = rr.race_id
join public.events e on e.id = r.event_id
where e.status = 'finished' and p.profile_id is not null;
