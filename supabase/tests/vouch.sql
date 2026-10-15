-- Aval de eventos y validación del rival; todo se deshace con ROLLBACK (requiere la migración 0022; se ejecuta como el admin Peckmat)
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

create temp table _out (step text, ok boolean, detail text) on commit drop;

do $$
declare
  ev uuid;
begin
  -- Peckmat deja de ser de confianza para esta prueba: su evento nace sin verificar
  perform public.set_trusted('62d2437c-68d6-4b3b-ae68-b9b0d949c285', false);
  ev := public.create_event('lounge', null, null, array[]::text[]);
  perform public.save_race(ev, 1::smallint, 'rainbow-road', jsonb_build_array(
    jsonb_build_object('player_id', (select id from public.event_players where event_id = ev), 'position', 1)));
  perform public.finish_event(ev);
  insert into _out values ('unverified by default', (select not bool_or(verified) from public.player_results where event_id = ev), null);

  -- Un admin puede avalarlo y pasa a contar
  perform public.vouch_event(ev);
  insert into _out values ('admin vouch verifies', (select bool_and(verified) from public.player_results where event_id = ev), null);
  perform public.vouch_event(ev, false);
  insert into _out values ('unvouch', (select not bool_or(verified) from public.player_results where event_id = ev), null);
end $$;

-- Un usuario sin confianza ni rol no puede avalar
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare
  ev uuid := (select id from public.events where status = 'finished' limit 1);
begin
  begin
    perform public.vouch_event(ev);
    insert into _out values ('stranger cannot vouch', false, 'accepted!');
  exception when others then
    insert into _out values ('stranger cannot vouch', sqlerrm like 'forbidden%', sqlerrm);
  end;
end $$;

reset role;
select * from _out;
rollback;
