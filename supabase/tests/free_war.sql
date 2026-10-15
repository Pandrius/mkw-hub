-- Wars libres (equipos no registrados) y avisos; todo se deshace con ROLLBACK (requiere la migración 0025)
-- Peckmat sube la war: Rayito1005 juega a su lado y Polimar y Kikee en el rival
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

create temp table _out (step text, ok boolean, detail text) on commit drop;
create temp table _ctx (ev uuid) on commit drop;

do $$
declare
  ev uuid;
  p bigint[];
begin
  ev := public.create_event('war', 'NBX', 'ZZZ',
    array['Peckmat', 'Rayito1005', 'Bob', 'Carl', 'Dan', 'Eve'],
    null, 'Nebulosa mixto', null, 'Los Otros',
    array['Polimar', 'Kikee = kik', 'R3', 'R4', 'R5', 'R6']);
  insert into _ctx values (ev);
  insert into _out values ('free war created without registered teams',
    (select team_id is null and opponent_team_id is null from public.events where id = ev), null);

  select array_agg(id order by id) into p from public.event_players where event_id = ev;
  perform public.save_race(ev, 1::smallint, 'rainbow-road', jsonb_build_array(
    jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', p[2], 'position', 3),
    jsonb_build_object('player_id', p[3], 'position', 5), jsonb_build_object('player_id', p[4], 'position', 7),
    jsonb_build_object('player_id', p[5], 'position', 9), jsonb_build_object('player_id', p[6], 'position', 11)));

  -- Nadie recibe aviso mientras está abierta
  insert into _out values ('no notices while open', (select count(*) = 0 from public.notifications where event_id = ev), null);

  perform public.finish_event(ev);
end $$;

-- Los avisos se miran como administrador de la BD (cada usuario solo ve los suyos)
reset role;
do $$
declare
  ev uuid := (select ev from _ctx);
begin
  insert into _out values ('same side player notified, cannot upload',
    (select count(*) = 1 and not bool_or(can_upload) from public.notifications
      where event_id = ev and profile_id = 'd73fbba6-6e91-4334-8adf-ade5bc33553f'), null);
  insert into _out values ('rival players notified and can upload',
    (select count(*) = 2 and bool_and(can_upload) from public.notifications
      where event_id = ev and profile_id in ('5c9a7dbf-1991-4e47-a64c-7046fd76144e', 'f59923bc-2bfe-4d27-8120-3ac73c9718e5')), null);
  insert into _out values ('creator not notified',
    (select count(*) = 0 from public.notifications where event_id = ev and profile_id = '62d2437c-68d6-4b3b-ae68-b9b0d949c285'), null);
end $$;
set local role authenticated;

-- Un jugador del lado de quien la subió no puede validarla
set local request.jwt.claims = '{"sub":"d73fbba6-6e91-4334-8adf-ade5bc33553f","role":"authenticated"}';
do $$
declare
  ev uuid := (select ev from _ctx);
begin
  insert into _out values ('same side cannot validate', not public.can_validate_war(ev), null);
  begin
    perform public.accept_opponent_war(ev);
    insert into _out values ('same side accept rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('same side accept rejected', sqlerrm like 'forbidden%', sqlerrm);
  end;
end $$;

-- Un jugador del lado rival, aunque su equipo no esté registrado, sí
set local request.jwt.claims = '{"sub":"f59923bc-2bfe-4d27-8120-3ac73c9718e5","role":"authenticated"}';
do $$
declare
  ev uuid := (select ev from _ctx);
  copy uuid;
begin
  insert into _out values ('rival player can validate', public.can_validate_war(ev), null);
  copy := public.accept_opponent_war(ev);
  insert into _out values ('copy created from the rival side',
    (select mirror_of = ev and team_tag = 'ZZZ' and opponent_tag = 'NBX' and team_id is null from public.events where id = copy), null);
  insert into _out values ('rival players have the war in their stats',
    (select count(*) = 2 from public.event_players
      where event_id = copy and profile_id in ('5c9a7dbf-1991-4e47-a64c-7046fd76144e', 'f59923bc-2bfe-4d27-8120-3ac73c9718e5')), null);
  begin
    perform public.accept_opponent_war(ev);
    insert into _out values ('only one copy', false, 'accepted!');
  exception when others then
    insert into _out values ('only one copy', sqlerrm like 'conflict%', sqlerrm);
  end;
end $$;

-- Los avisos son de cada uno: nadie lee ni marca los de otro
do $$
declare
  n int;
begin
  insert into _out values ('only own notices visible', (select bool_and(profile_id = 'f59923bc-2bfe-4d27-8120-3ac73c9718e5') from public.notifications), null);
  update public.notifications set read_at = now() where profile_id = 'f59923bc-2bfe-4d27-8120-3ac73c9718e5';
  get diagnostics n = row_count;
  insert into _out values ('can mark own as read', n = 1, null);
  update public.notifications set read_at = null where profile_id = '5c9a7dbf-1991-4e47-a64c-7046fd76144e';
  get diagnostics n = row_count;
  insert into _out values ('cannot touch others', n = 0, null);
end $$;

reset role;
select * from _out;
rollback;
