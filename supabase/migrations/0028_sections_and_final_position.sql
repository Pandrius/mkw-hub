-- ============================================================
-- Tramos (carreras que no son circuitos) y puesto final en el evento
-- ============================================================
-- Un tramo cuenta para el evento, los logros y las estadísticas generales, pero no como pista: no entra en las
-- estadísticas de ninguna pista ni en los dueños de pista.
alter table public.event_races add column is_section boolean not null default false;

-- Puesto en el que quedó cada jugador en el evento (lo pone un perfil de confianza; sustituye al calculado)
alter table public.event_players
  add column final_position smallint check (final_position between 1 and 12);

-- save_race con la marca de tramo (las llamadas antiguas de 7 argumentos siguen valiendo)
drop function if exists public.save_race(uuid, smallint, text, jsonb, smallint, smallint, jsonb);

create or replace function public.save_race(
  target uuid,
  race_no smallint,
  track_id text,
  results jsonb,
  missing_home smallint default 0,
  missing_away smallint default 0,
  opponent_results jsonb default null,
  is_section boolean default false
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
  player_ids bigint[];
  positions smallint[];
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  select * into ev from public.events where id = target;

  select coalesce(array_agg((x ->> 'player_id')::bigint), '{}'), coalesce(array_agg((x ->> 'position')::smallint), '{}')
  into player_ids, positions
  from jsonb_array_elements(results) x;
  n_results := coalesce(array_length(player_ids, 1), 0);

  if exists (
    select 1 from unnest(player_ids) pid
    where not exists (select 1 from public.event_players p where p.id = pid and p.event_id = target)
  ) then
    raise exception 'invalid: player does not belong to this event';
  end if;
  if (select count(distinct pid) from unnest(player_ids) pid) <> n_results then
    raise exception 'invalid: repeated player';
  end if;
  if (select count(distinct pos) from unnest(positions) pos) <> n_results then
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
    if exists (select 1 from unnest(positions) pos where pos < 1 or pos > racers) then
      raise exception 'invalid: position out of range for a % player race', racers;
    end if;
  else
    if n_results <> 1 or missing_home <> 0 or missing_away <> 0 then
      raise exception 'invalid: a lounge race has exactly one result';
    end if;
    if positions[1] < 1 or positions[1] > 24 then
      raise exception 'invalid: position out of range';
    end if;
  end if;

  insert into public.event_races as r (event_id, race_no, track_id, missing_home, missing_away, opponent_results, is_section)
  values (target, save_race.race_no, save_race.track_id, save_race.missing_home, save_race.missing_away, save_race.opponent_results, coalesce(save_race.is_section, false))
  on conflict on constraint event_races_event_id_race_no_key do update
    set track_id = excluded.track_id,
        missing_home = excluded.missing_home,
        missing_away = excluded.missing_away,
        opponent_results = excluded.opponent_results,
        is_section = excluded.is_section
  returning r.id into race;

  delete from public.race_results where race_id = race;
  insert into public.race_results (race_id, player_id, position)
  select race, pid, pos from unnest(player_ids, positions) as u (pid, pos);
end;
$$;

revoke execute on function public.save_race(uuid, smallint, text, jsonb, smallint, smallint, jsonb, boolean) from public, anon;
grant execute on function public.save_race(uuid, smallint, text, jsonb, smallint, smallint, jsonb, boolean) to authenticated;

-- Al validar la war de un rival, la copia conserva qué carreras eran tramos
create or replace function public.accept_opponent_war(target uuid, team_names jsonb DEFAULT '{}'::jsonb, opponent_names jsonb DEFAULT '{}'::jsonb, penalty_labels jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  me uuid := auth.uid();
  ev public.events;
  new_id uuid;
  a_names text[];
  b_names text[];
  a_final text[] := '{}';
  a_map jsonb := '{}'::jsonb;
  b_map jsonb := '{}'::jsonb;
  b_prof jsonb := '{}'::jsonb;
  b_ids jsonb := '{}'::jsonb;
  nm text;
  mapped text;
  rname text;
  rprofile uuid;
  pid bigint;
  r record;
  res jsonb;
  new_race bigint;
  racers int;
  remaining int[];
  active text[];
  k int;
  pens jsonb;
  subs jsonb;
  cname text;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;
  if jsonb_typeof(team_names) <> 'object' or jsonb_typeof(opponent_names) <> 'object'
     or jsonb_typeof(penalty_labels) <> 'object' then
    raise exception 'invalid: corrections must be objects';
  end if;
  if (select count(*) from jsonb_object_keys(team_names)) > 30
     or (select count(*) from jsonb_object_keys(opponent_names)) > 30
     or (select count(*) from jsonb_object_keys(penalty_labels)) > 30 then
    raise exception 'invalid: too many corrections';
  end if;

  -- Se bloquea la war: dos validaciones a la vez se ponen en cola y la segunda ya la ve validada
  select * into ev from public.events where id = target for update;
  if ev.id is null or ev.kind <> 'war' or ev.status <> 'finished' then
    raise exception 'invalid: only finished wars can be validated';
  end if;
  if ev.mirror_of is not null then
    raise exception 'invalid: this war is already a copy';
  end if;
  if not public.can_validate_war(target) then
    raise exception 'forbidden: only the opponent team or the players named on its side can validate this war';
  end if;
  if ev.opponent_confirmed is true then
    raise exception 'conflict: this war has already been validated by another member';
  end if;

  -- Quién juega en cada equipo
  a_names := array(select p.name from public.event_players p where p.event_id = target order by p.id);
  b_names := coalesce(
    ev.opponent_players,
    array(select coalesce(nullif(ev.opponent_tag, ''), 'Rival') || ' ' || g from generate_series(1, 6) g)
  );
  for r in
    select distinct x ->> 'name' as n
      from public.event_races er,
           jsonb_array_elements(case when jsonb_typeof(er.opponent_results) = 'array' then er.opponent_results else '[]'::jsonb end) x
     where er.event_id = target
  loop
    if r.n is not null and not (r.n = any (b_names)) then
      b_names := b_names || r.n;
    end if;
  end loop;
  for r in select s ->> 'in' as n from jsonb_array_elements(ev.substitutions) s where s ->> 'side' = 'away' loop
    if r.n is not null and not (r.n = any (b_names)) then
      b_names := b_names || r.n;
    end if;
  end loop;

  -- Nombres del equipo que subió la war, con las correcciones
  foreach nm in array a_names loop
    mapped := btrim(coalesce(opponent_names ->> nm, nm));
    if char_length(mapped) not between 1 and 40 then
      raise exception 'invalid: names must have 1-40 characters';
    end if;
    a_map := a_map || jsonb_build_object(nm, mapped);
    a_final := a_final || mapped;
  end loop;
  if (select count(distinct v) <> count(*) from jsonb_each_text(a_map) as t (k, v)) then
    raise exception 'invalid: that name is already used in this event';
  end if;
  if cardinality(a_final) > 12 then
    raise exception 'invalid: a war can have at most 12 player names per team';
  end if;

  -- Nombres del equipo que valida: igual que al crear una war, admiten "Usuario = nombre en el juego"
  foreach nm in array b_names loop
    mapped := btrim(coalesce(team_names ->> nm, nm));
    select x.name, x.profile_id into rname, rprofile from public.resolve_player(mapped) x;
    if char_length(rname) not between 1 and 40 then
      raise exception 'invalid: names must have 1-40 characters';
    end if;
    b_map := b_map || jsonb_build_object(nm, rname);
    b_prof := b_prof || jsonb_build_object(nm, rprofile);
  end loop;
  if (select count(distinct v) <> count(*) from jsonb_each_text(b_map) as t (k, v)) then
    raise exception 'invalid: that name is already used in this event';
  end if;

  -- Penalties y cambios vistos desde el otro lado: cambia el equipo y se corrigen los nombres
  pens := coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'side', case when pn ->> 'side' = 'home' then 'away' else 'home' end,
               'label', case
                          when char_length(btrim(coalesce(penalty_labels ->> (ord - 1)::text, ''))) between 1 and 40
                            then btrim(penalty_labels ->> (ord - 1)::text)
                          else pn ->> 'label'
                        end,
               'points', (pn ->> 'points')::int)
             order by ord)
      from jsonb_array_elements(ev.penalties) with ordinality as t (pn, ord)), '[]'::jsonb);
  subs := coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'side', case when sb ->> 'side' = 'home' then 'away' else 'home' end,
               'out', coalesce((case when sb ->> 'side' = 'home' then a_map else b_map end) ->> (sb ->> 'out'), sb ->> 'out'),
               'in', coalesce((case when sb ->> 'side' = 'home' then a_map else b_map end) ->> (sb ->> 'in'), sb ->> 'in'),
               'race_no', (sb ->> 'race_no')::int)
             order by ord)
      from jsonb_array_elements(ev.substitutions) with ordinality as t (sb, ord)), '[]'::jsonb);

  -- La war nueva: su equipo a la izquierda. Conserva las fechas de la original para que cuente como la misma
  insert into public.events (
    kind, status, team_tag, team_name, team_id, opponent_tag, opponent_name, opponent_team_id,
    opponent_players, created_by, created_at, finished_at, opponent_confirmed, mirror_of, penalties, substitutions
  )
  values (
    'war', 'finished', ev.opponent_tag, ev.opponent_name, ev.opponent_team_id, ev.team_tag, ev.team_name, ev.team_id,
    a_final, me, ev.created_at, ev.finished_at, true, ev.id, pens, subs
  )
  returning id into new_id;

  foreach nm in array b_names loop
    insert into public.event_players (event_id, name, profile_id)
    values (new_id, b_map ->> nm, nullif(b_prof ->> nm, '')::uuid)
    returning id into pid;
    b_ids := b_ids || jsonb_build_object(nm, pid);
  end loop;

  -- Las carreras al revés: los que faltan se intercambian y cada equipo cuenta con sus posiciones.
  -- Puntuaciones y pistas no se tocan.
  for r in select * from public.event_races where event_id = target order by race_no loop
    insert into public.event_races (event_id, race_no, track_id, missing_home, missing_away, opponent_results, is_section)
    values (
      new_id, r.race_no, r.track_id, r.missing_away, r.missing_home,
      (select coalesce(jsonb_agg(jsonb_build_object('name', a_map ->> pl.name, 'position', rr.position) order by rr.position), '[]'::jsonb)
         from public.race_results rr
         join public.event_players pl on pl.id = rr.player_id
        where rr.race_id = r.id),
      r.is_section
    )
    returning id into new_race;

    if jsonb_typeof(r.opponent_results) = 'array' and jsonb_array_length(r.opponent_results) > 0 then
      for res in select value from jsonb_array_elements(r.opponent_results) loop
        if b_ids ? (res ->> 'name') then
          insert into public.race_results (race_id, player_id, position)
          values (new_race, (b_ids ->> (res ->> 'name'))::bigint, (res ->> 'position')::int);
        end if;
      end loop;
    else
      -- Sin posiciones por jugador: se reparten las que quedan entre los rivales que corrían, como en la tabla original
      racers := 12 - r.missing_home - r.missing_away;
      remaining := array(
        select g from generate_series(1, racers) g
         where g not in (select rr.position from public.race_results rr where rr.race_id = r.id)
         order by g);
      active := array(
        select t.n
          from unnest(b_names) with ordinality as t (n, ix)
         where not exists (select 1 from jsonb_array_elements(ev.substitutions) s
                            where s ->> 'side' = 'away' and s ->> 'in' = t.n and (s ->> 'race_no')::int > r.race_no)
           and not exists (select 1 from jsonb_array_elements(ev.substitutions) s
                            where s ->> 'side' = 'away' and s ->> 'out' = t.n and (s ->> 'race_no')::int <= r.race_no)
         order by t.ix);
      for k in 1 .. least(coalesce(cardinality(remaining), 0), coalesce(cardinality(active), 0)) loop
        insert into public.race_results (race_id, player_id, position)
        values (new_race, (b_ids ->> active[k])::bigint, remaining[k]);
      end loop;
    end if;
  end loop;

  update public.events set opponent_confirmed = true, confirmed_by = me where id = target;
  return new_id;
exception
  when unique_violation then
    get stacked diagnostics cname = constraint_name;
    if cname = 'events_mirror_of_key' then
      raise exception 'conflict: this war has already been validated by another member';
    end if;
    raise exception 'invalid: that name is already used in this event';
end;
$$;

revoke execute on function public.accept_opponent_war(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.accept_opponent_war(uuid, jsonb, jsonb, jsonb) to authenticated;

-- player_results: marca de tramo al final (las estadísticas por pista la excluyen)
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
    or e.vouched_by is not null
    or coalesce(e.proof_status in ('auto', 'approved'), false)
    or case
      when e.kind = 'lounge' then e.lounge_change_id is not null
      else e.lounge_table_id is not null
    end as verified,
  e.lounge_tier as tier,
  r.is_section as section
from public.race_results rr
join public.event_players p on p.id = rr.player_id
join public.event_races r on r.id = rr.race_id
join public.events e on e.id = r.event_id
where e.status = 'finished' and p.profile_id is not null;

-- Dueños de pista: los tramos no cuentan como pista
create or replace function public.track_owners(min_races integer default 20, prior integer default 10, top_share numeric default 0.01)
returns table (
  profile_id uuid,
  track_id text,
  races bigint,
  adj_points numeric,
  rank integer,
  players integer
)
language sql stable
set search_path = ''
as $$
  with pts(pos, p) as (values (1, 15), (2, 12), (3, 10), (4, 9), (5, 8), (6, 7), (7, 6), (8, 5), (9, 4), (10, 3), (11, 2), (12, 1)),
  per as (
    select pr.profile_id, pr.track_id, count(*) as n, sum(coalesce(pts.p, 0))::numeric as s
    from public.player_results pr
    left join pts on pts.pos = pr.position
    where pr.verified and not pr.section
    group by pr.profile_id, pr.track_id
  ),
  glob as (
    select per.track_id, sum(per.s) / sum(per.n) as g from per group by per.track_id
  ),
  elig as (
    select per.profile_id, per.track_id, per.n, (per.s + track_owners.prior * glob.g) / (per.n + track_owners.prior) as adj
    from per join glob on glob.track_id = per.track_id
    where per.n >= track_owners.min_races
  ),
  ranked as (
    select elig.*, rank() over (partition by elig.track_id order by elig.adj desc) as rk,
           count(*) over (partition by elig.track_id) as total
    from elig
  )
  select ranked.profile_id, ranked.track_id, ranked.n, round(ranked.adj, 2), ranked.rk::integer, ranked.total::integer
  from ranked
  where ranked.rk <= greatest(1, ceil(ranked.total * track_owners.top_share))
  order by ranked.track_id, ranked.rk;
$$;
grant execute on function public.track_owners to anon, authenticated;

-- Puesto final de los jugadores (positions: {"<id del jugador del evento>": puesto | null}). Solo un perfil de confianza que
-- jugó en el evento (o lo creó), o un admin, y con el evento abierto o finalizado.
create function public.set_final_positions(target uuid, positions jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  k text;
  v jsonb;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;
  if not exists (select 1 from public.events where id = target) then
    raise exception 'invalid: el evento no existe';
  end if;
  if not (
    public.is_admin()
    or (
      exists (select 1 from public.profiles p where p.id = me and p.trusted)
      and (
        exists (select 1 from public.event_players ep where ep.event_id = target and ep.profile_id = me)
        or exists (select 1 from public.events e where e.id = target and e.created_by = me)
      )
    )
  ) then
    raise exception 'forbidden: solo un perfil de confianza que jugó en el evento, o un admin, puede poner el puesto final';
  end if;
  for k, v in select * from jsonb_each(positions) loop
    if not exists (select 1 from public.event_players ep where ep.id = k::bigint and ep.event_id = target) then
      raise exception 'invalid: el jugador no es de este evento';
    end if;
    update public.event_players
       set final_position = case when jsonb_typeof(v) = 'null' then null else (v #>> '{}')::smallint end
     where id = k::bigint;
  end loop;
end;
$$;
revoke execute on function public.set_final_positions(uuid, jsonb) from public, anon;
grant execute on function public.set_final_positions(uuid, jsonb) to authenticated;
