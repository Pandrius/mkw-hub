-- ============================================================
-- Wars libres (equipos no registrados) y avisos a los jugadores apuntados
-- ============================================================
-- Una war puede jugarla cualquier equipo, esté registrado o no (sub-equipos, mixtos, otras competiciones): team_id y
-- opponent_team_id ya podían ser null. Ahora, además:
--  * Al finalizar una war, a cada jugador apuntado que tenga perfil (de cualquiera de los dos lados, menos quien la subió)
--    le llega un aviso. A los del lado rival se les ofrece subirla también desde su lado (la validación de siempre).
--  * La validación (y el rechazo) ya no exigen dos equipos registrados: la puede hacer alguien del equipo rival registrado o
--    cualquier jugador con perfil apuntado en el lado rival. Sigue habiendo una sola copia por war.

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('war_posted')),
  event_id uuid not null references public.events (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  -- true si está apuntado en el lado rival y puede subir su copia de la war
  can_upload boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (profile_id, kind, event_id)
);
create index if not exists notifications_profile_idx on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Avisos propios" on public.notifications for select to authenticated using (profile_id = (select auth.uid()));
create policy "Marcar avisos propios" on public.notifications for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "Borrar avisos propios" on public.notifications for delete to authenticated using (profile_id = (select auth.uid()));
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ¿Puede quien llama validar o rechazar esta war? Admin, miembro del equipo rival registrado o apuntado en el lado rival
create or replace function public.can_validate_war(target uuid)
returns boolean
language plpgsql stable
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ev public.events;
begin
  if me is null then
    return false;
  end if;
  select * into ev from public.events where id = target;
  if ev.id is null or ev.kind <> 'war' or ev.mirror_of is not null then
    return false;
  end if;
  if public.is_admin() then
    return true;
  end if;
  if ev.opponent_team_id is not null
     and exists (select 1 from public.team_members tm where tm.team_id = ev.opponent_team_id and tm.profile_id = me) then
    return true;
  end if;
  return exists (
    select 1
      from unnest(coalesce(ev.opponent_players, '{}'::text[])) e,
           lateral public.resolve_player(e) r
     where btrim(e) <> '' and r.profile_id = me
  );
end;
$$;
revoke execute on function public.can_validate_war(uuid) from public, anon;
grant execute on function public.can_validate_war(uuid) to authenticated;

-- Avisa a los jugadores apuntados en una war recién finalizada (se llama desde finish_event)
create or replace function public.notify_war_players(target uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = target;
  if ev.id is null or ev.kind <> 'war' or ev.mirror_of is not null then
    return;
  end if;
  insert into public.notifications (profile_id, kind, event_id, actor_id, can_upload)
  select x.pid, 'war_posted', target, ev.created_by, bool_or(x.upload)
    from (
      select p.profile_id as pid, false as upload
        from public.event_players p
       where p.event_id = target and p.profile_id is not null
      union all
      select r.profile_id, true
        from unnest(coalesce(ev.opponent_players, '{}'::text[])) e,
             lateral public.resolve_player(e) r
       where btrim(e) <> '' and r.profile_id is not null
    ) x
   where x.pid <> ev.created_by
   group by x.pid
  on conflict (profile_id, kind, event_id) do nothing;
end;
$$;
revoke execute on function public.notify_war_players(uuid) from public, anon, authenticated;

create or replace function public.finish_event(target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  if not exists (select 1 from public.event_races where event_id = target) then
    raise exception 'invalid: the event has no races';
  end if;
  update public.events set status = 'finished', finished_at = now() where id = target;
  perform public.notify_war_players(target);
end;
$$;

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

create or replace function public.confirm_opponent_war(target uuid, accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  ev public.events;
begin
  if accept then
    raise exception 'invalid: validate a war with accept_opponent_war';
  end if;
  select * into ev from public.events where id = target for update;
  if ev.id is null or ev.kind <> 'war' or ev.status <> 'finished' then
    raise exception 'invalid: only finished wars can be rejected';
  end if;
  if not public.can_validate_war(target) then
    raise exception 'forbidden: only the opponent team or the players named on its side can reject this war';
  end if;
  if ev.opponent_confirmed is true then
    raise exception 'conflict: this war has already been validated';
  end if;
  update public.events set opponent_confirmed = false where id = target;
end;
$$;

revoke execute on function public.finish_event(uuid) from public, anon;
grant execute on function public.finish_event(uuid) to authenticated;
revoke execute on function public.accept_opponent_war(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.accept_opponent_war(uuid, jsonb, jsonb, jsonb) to authenticated;
revoke execute on function public.confirm_opponent_war(uuid, boolean) from public, anon;
grant execute on function public.confirm_opponent_war(uuid, boolean) to authenticated;
