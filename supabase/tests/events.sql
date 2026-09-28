-- Prueba de extremo a extremo como el usuario Peckmat; todo se deshace con ROLLBACK
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

create temp table _out (step text, ok boolean, detail text) on commit drop;

do $$
declare
  ev uuid;
  p bigint[];
  sub bigint;
  err text;
begin
  ev := public.create_event('war', 'MKH', 'ABC', array['Peckmat = tortelini', 'Bob', 'Carl', 'Dan', 'Eve', 'Fay']);
  select array_agg(id order by id) into p from public.event_players where event_id = ev;
  insert into _out values ('create war', array_length(p, 1) = 6, (select string_agg(name || ':' || coalesce(profile_id::text, '-'), ', ') from public.event_players where event_id = ev));

  -- Carrera 1 normal
  perform public.save_race(ev, 1::smallint, 'rainbow-road', jsonb_build_array(
    jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', p[2], 'position', 3),
    jsonb_build_object('player_id', p[3], 'position', 5), jsonb_build_object('player_id', p[4], 'position', 7),
    jsonb_build_object('player_id', p[5], 'position', 9), jsonb_build_object('player_id', p[6], 'position', 11)));
  insert into _out values ('race 1 saved', (select count(*) = 6 from public.race_results rr join public.event_races r on r.id = rr.race_id where r.event_id = ev), null);

  -- Repetir carrera 1 (corrección) en la misma transacción
  perform public.save_race(ev, 1::smallint, 'dk-pass', jsonb_build_array(
    jsonb_build_object('player_id', p[1], 'position', 2), jsonb_build_object('player_id', p[2], 'position', 3),
    jsonb_build_object('player_id', p[3], 'position', 5), jsonb_build_object('player_id', p[4], 'position', 7),
    jsonb_build_object('player_id', p[5], 'position', 9), jsonb_build_object('player_id', p[6], 'position', 11)));
  insert into _out values ('race 1 corrected', (select track_id = 'dk-pass' from public.event_races where event_id = ev and race_no = 1), null);

  -- Sustituto y carrera de 11 (falta uno nuestro)
  sub := public.add_event_player(ev, 'Gus');
  perform public.save_race(ev, 2::smallint, 'crown-city', jsonb_build_array(
    jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', sub, 'position', 2),
    jsonb_build_object('player_id', p[3], 'position', 4), jsonb_build_object('player_id', p[4], 'position', 6),
    jsonb_build_object('player_id', p[5], 'position', 8)), 1::smallint, 0::smallint);
  insert into _out values ('11P race with sub', true, null);

  -- Errores esperados
  begin
    perform public.save_race(ev, 3::smallint, 'crown-city', jsonb_build_array(
      jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', p[2], 'position', 1)));
    insert into _out values ('repeated position rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('repeated position rejected', sqlerrm like '%repeated%' or sqlerrm like '%6 players%', sqlerrm);
  end;

  begin
    perform public.save_race(ev, 3::smallint, 'crown-city', jsonb_build_array(
      jsonb_build_object('player_id', p[1], 'position', 12), jsonb_build_object('player_id', p[2], 'position', 2),
      jsonb_build_object('player_id', p[3], 'position', 3), jsonb_build_object('player_id', p[4], 'position', 4),
      jsonb_build_object('player_id', p[5], 'position', 5)), 1::smallint, 0::smallint);
    insert into _out values ('pos 12 in 11P rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('pos 12 in 11P rejected', sqlerrm like '%out of range%', sqlerrm);
  end;

  perform public.finish_event(ev);
  insert into _out values ('finished', (select status = 'finished' from public.events where id = ev), null);

  begin
    perform public.delete_race(ev, 1::smallint);
    insert into _out values ('locked after finish', false, 'deleted!');
  exception when others then
    insert into _out values ('locked after finish', sqlerrm like 'forbidden%', sqlerrm);
  end;

  insert into _out values ('stats view', (select count(*) >= 2 from public.player_results where profile_id = '62d2437c-68d6-4b3b-ae68-b9b0d949c285' and event_id = ev),
    (select string_agg(track_id || '=' || position, ', ') from public.player_results where event_id = ev and profile_id is not null));

  -- Lounge
  ev := public.create_event('lounge', null, null, array[]::text[]);
  perform public.save_race(ev, 1::smallint, 'rainbow-road', jsonb_build_array(
    jsonb_build_object('player_id', (select id from public.event_players where event_id = ev), 'position', 17)));
  insert into _out values ('lounge race pos 17', true, (select name from public.event_players where event_id = ev));
end $$;

reset role;
select * from _out;
rollback;
