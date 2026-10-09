-- ============================================================
-- Corregir nombres de jugadores en mitad de una war
-- ============================================================
-- Mismas reglas que el resto de escrituras: solo con el evento abierto y por quien puede editarlo.

-- Jugador del equipo propio. Admite "Usuario = nombre en el juego" igual que al crear la war,
-- y vuelve a vincular (o desvincular) el usuario de la web según el nuevo nombre.
create function public.rename_event_player(target uuid, player_id bigint, entry text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.can_edit_event(target) then
    raise exception 'forbidden: event is closed or not yours';
  end if;
  if not exists (
    select 1 from public.event_players p where p.id = rename_event_player.player_id and p.event_id = target
  ) then
    raise exception 'invalid: player does not belong to this event';
  end if;

  update public.event_players p
     set name = r.name, profile_id = r.profile_id
    from public.resolve_player(entry) r
   where p.id = rename_event_player.player_id;
exception
  when unique_violation then
    raise exception 'invalid: that name is already used in this event';
end;
$$;

-- Jugador rival: se cambia en la lista de rivales y en los resultados de cada carrera.
-- Las wars antiguas sin lista de rivales usan los nombres por defecto ("TAG 1" … "TAG 6").
create function public.rename_opponent_player(target uuid, old_name text, new_name text)
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

revoke execute on function public.rename_event_player(uuid, bigint, text),
  public.rename_opponent_player(uuid, text, text) from public, anon;
grant execute on function public.rename_event_player(uuid, bigint, text),
  public.rename_opponent_player(uuid, text, text) to authenticated;
