-- ============================================================
-- Validar la war del rival: se sube de verdad, al revés, desde su perspectiva
-- ============================================================
-- Cuando un equipo sube una war contra otro equipo registrado, los jugadores del rival la ven
-- pendiente. Uno de ellos la revisa (con vista previa de la tabla), puede corregir nombres de
-- jugadores y de penalties —pero no puntuaciones ni pistas— y la valida: se crea una copia de la war
-- desde su punto de vista (su equipo a la izquierda, resultados al revés), que cuenta en sus
-- estadísticas y en las de sus jugadores. Solo una persona puede validarla.

alter table public.events
  add column if not exists mirror_of uuid references public.events (id) on delete set null,
  add column if not exists confirmed_by uuid references public.profiles (id) on delete set null;

-- Una war solo puede tener una copia: aunque dos personas pulsen a la vez, la segunda falla
create unique index if not exists events_mirror_of_key on public.events (mirror_of) where mirror_of is not null;

-- team_names: nombres de los jugadores del equipo que valida (los que escribió el rival) → corregidos.
-- opponent_names: nombres de los jugadores del equipo que subió la war → corregidos.
-- penalty_labels: posición de la penalty (0, 1…) → nombre corregido. Solo se cambian nombres.
-- Devuelve el id de la war nueva.
create function public.accept_opponent_war(
  target uuid,
  team_names jsonb default '{}'::jsonb,
  opponent_names jsonb default '{}'::jsonb,
  penalty_labels jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
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
  if ev.id is null or ev.kind <> 'war' or ev.status <> 'finished'
     or ev.team_id is null or ev.opponent_team_id is null then
    raise exception 'invalid: only finished wars between two registered teams can be validated';
  end if;
  if ev.mirror_of is not null then
    raise exception 'invalid: this war is already a copy';
  end if;
  if not (
    public.is_admin()
    or exists (select 1 from public.team_members tm where tm.team_id = ev.opponent_team_id and tm.profile_id = me)
  ) then
    raise exception 'forbidden: only members of the opponent team can validate this war';
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
    insert into public.event_races (event_id, race_no, track_id, missing_home, missing_away, opponent_results)
    values (
      new_id, r.race_no, r.track_id, r.missing_away, r.missing_home,
      (select coalesce(jsonb_agg(jsonb_build_object('name', a_map ->> pl.name, 'position', rr.position) order by rr.position), '[]'::jsonb)
         from public.race_results rr
         join public.event_players pl on pl.id = rr.player_id
        where rr.race_id = r.id)
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

-- Rechazar sigue siendo posible (y se puede cambiar de opinión), pero ya no se acepta sin copiar la war:
-- aceptar se hace siempre con accept_opponent_war. Una war ya validada no se puede rechazar.
create or replace function public.confirm_opponent_war(target uuid, accept boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  ev public.events;
begin
  if accept then
    raise exception 'invalid: validate a war with accept_opponent_war';
  end if;
  select * into ev from public.events where id = target for update;
  if ev.id is null or ev.kind <> 'war' or ev.status <> 'finished' or ev.opponent_team_id is null then
    raise exception 'invalid: only finished wars against a registered team can be rejected';
  end if;
  if not (
    public.is_admin()
    or exists (
      select 1 from public.team_members tm where tm.team_id = ev.opponent_team_id and tm.profile_id = auth.uid()
    )
  ) then
    raise exception 'forbidden: only members of the opponent team can reject this war';
  end if;
  if ev.opponent_confirmed is true then
    raise exception 'conflict: this war has already been validated';
  end if;
  update public.events set opponent_confirmed = false where id = target;
end;
$$;

revoke execute on function public.confirm_opponent_war(uuid, boolean) from public, anon;
grant execute on function public.confirm_opponent_war(uuid, boolean) to authenticated;
