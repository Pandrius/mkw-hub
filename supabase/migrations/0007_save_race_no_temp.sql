-- save_race sin tabla temporal: así se puede llamar varias veces en la misma transacción
create or replace function public.save_race(
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

  insert into public.event_races as r (event_id, race_no, track_id, missing_home, missing_away)
  values (target, save_race.race_no, save_race.track_id, save_race.missing_home, save_race.missing_away)
  on conflict on constraint event_races_event_id_race_no_key do update
    set track_id = excluded.track_id, missing_home = excluded.missing_home, missing_away = excluded.missing_away
  returning r.id into race;

  delete from public.race_results where race_id = race;
  insert into public.race_results (race_id, player_id, position)
  select race, pid, pos from unnest(player_ids, positions) as u (pid, pos);
end;
$$;
