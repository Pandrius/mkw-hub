-- ============================================================
-- Sustituciones en una war: sale un jugador y entra otro desde una carrera
-- ============================================================
--   [{ "side": "home" | "away", "out": "Peckmat", "in": "Polimar", "race_no": 9 }, …]
-- El jugador que sale corre hasta la carrera anterior a race_no y el que entra desde race_no.
-- Los puntos y las carreras jugadas de cada uno salen de los resultados guardados, así que
-- el número de carrera es lo que decide qué jugadores aparecen en cada formulario de carrera.

alter table public.events add column if not exists substitutions jsonb not null default '[]'::jsonb;

-- side: 'home' (tu equipo) o 'away' (rival). out_name: quien sale. in_entry: quien entra
-- (en tu equipo admite "Usuario = nombre en el juego"). from_race: carrera desde la que entra;
-- por defecto la siguiente a las ya guardadas. Devuelve la carrera desde la que cuenta.
create function public.substitute_player(
  target uuid,
  side text,
  out_name text,
  in_entry text,
  from_race int default null
)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  ev public.events;
  race int;
  incoming text;
  incoming_profile uuid;
  names text[];
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  select * into ev from public.events where id = target;
  if ev.kind <> 'war' then
    raise exception 'invalid: only wars have substitutes';
  end if;
  if side not in ('home', 'away') then
    raise exception 'invalid: side must be home or away';
  end if;

  race := coalesce(from_race, (select coalesce(max(r.race_no), 0) + 1 from public.event_races r where r.event_id = target));
  if race not between 1 and 12 then
    raise exception 'invalid: the substitution must start from a race between 1 and 12';
  end if;
  if jsonb_array_length(ev.substitutions) >= 24 then
    raise exception 'invalid: too many substitutions';
  end if;
  -- Un jugador solo puede salir una vez
  if exists (
    select 1 from jsonb_array_elements(ev.substitutions) s
     where s ->> 'side' = side and s ->> 'out' = out_name
  ) then
    raise exception 'invalid: that player has already been substituted';
  end if;

  if side = 'home' then
    if not exists (select 1 from public.event_players p where p.event_id = target and p.name = out_name) then
      raise exception 'invalid: unknown player';
    end if;
    select r.name, r.profile_id into incoming, incoming_profile from public.resolve_player(in_entry) r;
    insert into public.event_players (event_id, name, profile_id) values (target, incoming, incoming_profile);
  else
    names := coalesce(
      ev.opponent_players,
      array(select coalesce(nullif(ev.opponent_tag, ''), 'Rival') || ' ' || i from generate_series(1, 6) i)
    );
    if not (out_name = any (names)) then
      raise exception 'invalid: unknown opponent player';
    end if;
    incoming := btrim(in_entry);
    if incoming is null or char_length(incoming) not between 1 and 40 then
      raise exception 'invalid: the name must have 1-40 characters';
    end if;
    if incoming = any (names) then
      raise exception 'invalid: that name is already used in this event';
    end if;
    update public.events set opponent_players = names || incoming where id = target;
  end if;

  update public.events
     set substitutions = substitutions || jsonb_build_array(
       jsonb_build_object('side', side, 'out', out_name, 'in', incoming, 'race_no', race))
   where id = target;
  return race;
exception
  when unique_violation then
    raise exception 'invalid: that name is already used in this event';
  when check_violation then
    raise exception 'invalid: a war can have at most 12 opponent names';
end;
$$;

revoke execute on function public.substitute_player(uuid, text, text, text, int) from public, anon;
grant execute on function public.substitute_player(uuid, text, text, text, int) to authenticated;

-- Al corregir el nombre de un jugador, las sustituciones que lo mencionan siguen apuntando a él
create function public.rename_in_substitutions(target uuid, side text, old_name text, new_name text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.events e
     set substitutions = coalesce((
       select jsonb_agg(
                jsonb_set(
                  jsonb_set(s, '{out}', to_jsonb(case when s ->> 'side' = side and s ->> 'out' = old_name then new_name else s ->> 'out' end)),
                  '{in}', to_jsonb(case when s ->> 'side' = side and s ->> 'in' = old_name then new_name else s ->> 'in' end))
                order by ord)
         from jsonb_array_elements(e.substitutions) with ordinality as t (s, ord)), '[]'::jsonb)
   where e.id = target;
$$;
revoke execute on function public.rename_in_substitutions(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.rename_event_player(target uuid, player_id bigint, entry text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  old_name text;
  new_name text;
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  select p.name into old_name from public.event_players p
   where p.id = rename_event_player.player_id and p.event_id = target;
  if old_name is null then
    raise exception 'invalid: player does not belong to this event';
  end if;

  update public.event_players p
     set name = r.name, profile_id = r.profile_id
    from public.resolve_player(entry) r
   where p.id = rename_event_player.player_id
  returning p.name into new_name;

  if new_name is distinct from old_name then
    perform public.rename_in_substitutions(target, 'home', old_name, new_name);
  end if;
exception
  when unique_violation then
    raise exception 'invalid: that name is already used in this event';
end;
$$;

create or replace function public.rename_opponent_player(target uuid, old_name text, new_name text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  ev public.events;
  clean text := btrim(new_name);
  names text[];
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  select * into ev from public.events where id = target;
  if ev.kind <> 'war' then
    raise exception 'invalid: only wars have opponents';
  end if;
  if clean is null or char_length(clean) not between 1 and 40 then
    raise exception 'invalid: the name must have 1-40 characters';
  end if;

  names := coalesce(
    ev.opponent_players,
    array(select coalesce(nullif(ev.opponent_tag, ''), 'Rival') || ' ' || i from generate_series(1, 6) i)
  );
  if not (old_name = any (names)) then
    raise exception 'invalid: unknown opponent player';
  end if;
  if clean = old_name then
    return;
  end if;
  if clean = any (names) then
    raise exception 'invalid: that name is already used in this event';
  end if;

  update public.events set opponent_players = array_replace(names, old_name, clean) where id = target;
  perform public.rename_in_substitutions(target, 'away', old_name, clean);

  update public.event_races r
     set opponent_results = (
       select jsonb_agg(
                case when x ->> 'name' = old_name then jsonb_set(x, '{name}', to_jsonb(clean)) else x end
                order by ord)
         from jsonb_array_elements(r.opponent_results) with ordinality as t (x, ord))
   where r.event_id = target
     and jsonb_typeof(r.opponent_results) = 'array'
     and jsonb_array_length(r.opponent_results) > 0;
end;
$$;
