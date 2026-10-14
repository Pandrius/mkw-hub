-- Día jugado, límite de eventos abiertos, perfiles de confianza y ranking; todo se deshace con ROLLBACK
-- (requiere las migraciones 0019 y 0020; se ejecuta como el admin Peckmat)
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

create temp table _out (step text, ok boolean, detail text) on commit drop;

do $$
declare
  ev uuid;
  today date := (now() at time zone 'utc')::date;
  n int := 0;
  rows int;
begin
  -- Sin día: hoy (UTC); con día: ese día
  ev := public.create_event('lounge', null, null, array[]::text[]);
  insert into _out values ('default played_on', (select played_on = today from public.events where id = ev), null);
  perform public.delete_event(ev);
  ev := public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, today - 3);
  insert into _out values ('played_on kept', (select played_on = today - 3 from public.events where id = ev), null);
  perform public.delete_event(ev);

  -- Futuro y más de 7 días
  begin
    perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, today + 3);
    insert into _out values ('future rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('future rejected', sqlerrm like 'invalid%', sqlerrm);
  end;
  begin
    perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, today - 12);
    insert into _out values ('older than 7 days rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('older than 7 days rejected', sqlerrm like 'invalid%', sqlerrm);
  end;

  -- Varios Lounge el mismo día sí se pueden
  perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, today - 1);
  perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, today - 1);
  insert into _out values ('same day twice', true, null);

  -- Máximo 6 abiertos a la vez
  begin
    loop
      perform public.create_event('lounge', null, null, array[]::text[]);
      n := n + 1;
      exit when n > 10;
    end loop;
    insert into _out values ('open limit', false, 'created ' || n);
  exception when others then
    insert into _out values ('open limit', sqlerrm like 'invalid: ya tienes 6%' and n <= 6, 'created ' || n || ' before the limit');
  end;

  -- Perfiles de confianza: set_trusted solo para admins y los eventos lo heredan
  for ev in select id from public.events where created_by = '62d2437c-68d6-4b3b-ae68-b9b0d949c285' and status = 'open' loop
    perform public.delete_event(ev);
  end loop;
  perform public.set_trusted('62d2437c-68d6-4b3b-ae68-b9b0d949c285', true);
  ev := public.create_event('lounge', null, null, array[]::text[]);
  insert into _out values ('event inherits trust', (select trusted from public.events where id = ev), null);
  perform public.save_race(ev, 1::smallint, 'rainbow-road', jsonb_build_array(
    jsonb_build_object('player_id', (select id from public.event_players where event_id = ev), 'position', 3)));
  perform public.finish_event(ev);
  insert into _out values ('trusted event verified in view', (select bool_and(verified) from public.player_results where event_id = ev), null);
  perform public.set_trusted('62d2437c-68d6-4b3b-ae68-b9b0d949c285', false);
  insert into _out values ('revoking trust unverifies', (select not bool_or(verified) from public.player_results where event_id = ev), null);

  -- Ranking: solo cuenta lo verificado y exige un mínimo de carreras
  perform public.set_trusted('62d2437c-68d6-4b3b-ae68-b9b0d949c285', true);
  select count(*) into rows from public.verified_ranking(1);
  insert into _out values ('ranking lists verified players', rows >= 1, rows::text);
  select count(*) into rows from public.verified_ranking(100000);
  insert into _out values ('ranking min races', rows = 0, rows::text);
  perform public.set_trusted('62d2437c-68d6-4b3b-ae68-b9b0d949c285', false);
  select count(*) into rows from public.verified_ranking(100000);
  insert into _out values ('ranking min races', true, null);
end $$;

-- Un usuario normal no puede dar la confianza ni verificarse a sí mismo
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
begin
  begin
    perform public.set_trusted('62d2437c-68d6-4b3b-ae68-b9b0d949c285', true);
    insert into _out values ('non-admin cannot trust', false, 'accepted!');
  exception when others then
    insert into _out values ('non-admin cannot trust', sqlerrm like 'forbidden%', sqlerrm);
  end;
  begin
    update public.profiles set trusted = true where id = '62d2437c-68d6-4b3b-ae68-b9b0d949c285';
    insert into _out values ('cannot self-trust', false, 'accepted!');
  exception when others then
    insert into _out values ('cannot self-trust', sqlerrm like 'permission denied%', sqlerrm);
  end;
end $$;

reset role;
select * from _out;
rollback;
