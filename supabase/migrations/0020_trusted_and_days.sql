-- ============================================================
-- Día jugado (en vez de hora), perfiles de confianza, límite de eventos abiertos y ranking verificado
-- ============================================================

-- 1. Día jugado -------------------------------------------------------------------------------
-- Con la hora en punto el bot de Discord y la web podían discrepar por la zona horaria; basta con el día
-- (la verificación con el Lounge mira una ventana que cubre cualquier zona horaria).
drop index if exists public.events_lounge_hour_idx;
alter table public.events rename column played_at to played_on;
alter table public.events alter column played_on type date using played_on::date;

-- 2. Perfiles de confianza ---------------------------------------------------------------------
-- Lo que sube un perfil de confianza cuenta como verificado. Solo un admin los gestiona.
alter table public.profiles add column trusted boolean not null default false;
alter table public.events add column trusted boolean not null default false;

-- Todo evento nuevo hereda la confianza de quien lo crea (web, bot y validación de wars por igual)
create function public.events_inherit_trust()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.trusted := coalesce((select p.trusted from public.profiles p where p.id = new.created_by), false);
  return new;
end;
$$;

create trigger events_inherit_trust before insert on public.events
  for each row execute function public.events_inherit_trust();

create function public.set_trusted(target uuid, value boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: solo un admin puede gestionar los perfiles de confianza';
  end if;
  update public.profiles set trusted = value where id = target;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  update public.events set trusted = value where created_by = target;
end;
$$;

revoke execute on function public.set_trusted from public, anon;
grant execute on function public.set_trusted to authenticated;

-- 3. create_event: día jugado y máximo de eventos abiertos ---------------------------------------
drop function if exists public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[], timestamptz);

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
  played_on date default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  entry text;
  day_played date;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;

  -- Día jugado: sin fechas futuras (un día de margen por las zonas horarias) ni de más de 7 días
  day_played := coalesce(played_on, (now() at time zone 'utc')::date);
  if day_played > (now() at time zone 'utc')::date + 1 then
    raise exception 'invalid: el día jugado no puede estar en el futuro';
  end if;
  if day_played < (now() at time zone 'utc')::date - 8 then
    raise exception 'invalid: el día jugado no puede tener más de 7 días';
  end if;

  -- Como mucho 6 eventos abiertos a la vez
  if (select count(*) from public.events e where e.created_by = me and e.status = 'open') >= 6 then
    raise exception 'invalid: ya tienes 6 eventos abiertos, finaliza o borra alguno';
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
    team_id, team_name, opponent_team_id, opponent_name, opponent_players, played_on
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
    day_played
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

revoke execute on function public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[], date) from public, anon;
grant execute on function public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[], date) to authenticated;

-- 4. player_results: la confianza también verifica; se añade el tier (SQ...) ------------------------
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
  e.trusted
    or case
      when e.kind = 'lounge' then e.lounge_change_id is not null
      else coalesce(e.opponent_confirmed, false) or e.lounge_table_id is not null
    end as verified,
  e.lounge_tier as tier
from public.race_results rr
join public.event_players p on p.id = rr.player_id
join public.event_races r on r.id = rr.race_id
join public.events e on e.id = r.event_id
where e.status = 'finished' and p.profile_id is not null;

-- 5. Puesto en el ranking de su país en el Lounge ---------------------------------------------------
alter table public.lounge_players
  add column country_rank integer,
  add column country_total integer;

-- 6. Ranking de la web con eventos verificados ---------------------------------------------------
-- Puntos por carrera con la tabla de la war (15-12-10-9-8-7-6-5-4-3-2-1). Mínimo de carreras para entrar.
create function public.verified_ranking(
  min_races integer default 50,
  country text default null,
  only_kind public.event_kind default null
)
returns table (
  profile_id uuid,
  username text,
  avatar_url text,
  country_code text,
  title_id text,
  races bigint,
  events bigint,
  avg_pos numeric,
  avg_points numeric,
  win_rate numeric,
  podium_rate numeric
)
language sql stable
set search_path = ''
as $$
  with pts(pos, p) as (values (1, 15), (2, 12), (3, 10), (4, 9), (5, 8), (6, 7), (7, 6), (8, 5), (9, 4), (10, 3), (11, 2), (12, 1))
  select
    pr.profile_id,
    pf.username,
    pf.avatar_url,
    pf.country_code,
    pf.title_id,
    count(*) as races,
    count(distinct pr.event_id) as events,
    round(avg(pr.position), 2) as avg_pos,
    round(avg(coalesce(pts.p, 0)), 2) as avg_points,
    round(100.0 * avg((pr.position = 1)::int), 1) as win_rate,
    round(100.0 * avg((pr.position <= 3)::int), 1) as podium_rate
  from public.player_results pr
  join public.profiles pf on pf.id = pr.profile_id
  left join pts on pts.pos = pr.position
  where pr.verified
    and (only_kind is null or pr.kind = only_kind)
    and (verified_ranking.country is null or pf.country_code = verified_ranking.country)
  group by pr.profile_id, pf.username, pf.avatar_url, pf.country_code, pf.title_id
  having count(*) >= greatest(min_races, 1)
  order by avg(coalesce(pts.p, 0)) desc
  limit 200;
$$;

grant execute on function public.verified_ranking to anon, authenticated;
