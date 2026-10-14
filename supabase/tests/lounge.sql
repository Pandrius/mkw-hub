-- Hora jugada y vista player_results.verified; todo se deshace con ROLLBACK (requiere la migración 0019)
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

create temp table _out (step text, ok boolean, detail text) on commit drop;

do $$
declare
  ev uuid;
  ev2 uuid;
  hr timestamptz := date_trunc('hour', now()) - interval '3 hours';
begin
  -- Sin hora: la hora actual en punto
  ev := public.create_event('lounge', null, null, array[]::text[]);
  insert into _out values ('default played_at', (select played_at = date_trunc('hour', now()) from public.events where id = ev), null);

  -- Con hora: se redondea a la hora en punto
  ev := public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, hr + interval '40 minutes');
  insert into _out values ('played_at truncated', (select played_at = hr from public.events where id = ev), null);

  -- Un Lounge por hora
  begin
    perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, hr + interval '5 minutes');
    insert into _out values ('one lounge per hour', false, 'accepted!');
  exception when others then
    insert into _out values ('one lounge per hour', sqlerrm like 'invalid%', sqlerrm);
  end;

  -- Futuro y más de 7 días
  begin
    perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, now() + interval '2 hours');
    insert into _out values ('future rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('future rejected', sqlerrm like 'invalid%', sqlerrm);
  end;
  begin
    perform public.create_event('lounge', null, null, array[]::text[], null, null, null, null, null, now() - interval '8 days');
    insert into _out values ('older than 7 days rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('older than 7 days rejected', sqlerrm like 'invalid%', sqlerrm);
  end;

  -- Dos wars a la misma hora sí se permiten (solo el Lounge tiene límite)
  ev := public.create_event('war', 'MKH', 'ABC', array['Peckmat', 'B', 'C', 'D', 'E', 'F'], null, null, null, null, null, hr);
  ev2 := public.create_event('war', 'MKH', 'XYZ', array['Peckmat', 'B', 'C', 'D', 'E', 'F'], null, null, null, null, null, hr);
  insert into _out values ('two wars same hour', ev <> ev2, null);

  -- El cliente no puede verificarse a sí mismo
  begin
    update public.events set lounge_change_id = 1 where id = ev;
    insert into _out values ('cannot self-verify', (select lounge_change_id is null from public.events where id = ev), 'update silently ignored');
  exception when others then
    insert into _out values ('cannot self-verify', true, sqlerrm);
  end;
end $$;

reset role;
select * from _out;
rollback;
