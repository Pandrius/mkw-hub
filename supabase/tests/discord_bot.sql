-- Prueba de las funciones del bot de Discord (migración 0012) como service_role, actuando
-- como el usuario Peckmat; todo se deshace con ROLLBACK.
-- Uso: psql "$DATABASE_URL" -f supabase/tests/discord_bot.sql
begin;

create temp table _out (step text, ok boolean, detail text) on commit drop;
grant all on _out to service_role, authenticated;

set local role service_role;

do $$
declare
  peck uuid := '62d2437c-68d6-4b3b-ae68-b9b0d949c285';
  other uuid := (select id from public.profiles where role = 'user' and id <> '62d2437c-68d6-4b3b-ae68-b9b0d949c285' limit 1);
  ev uuid;
  p bigint[];
  sub bigint;
begin
  -- Discord ID → perfil
  insert into _out values ('discord id lookup',
    public.bot_profile_for_discord((select discord_id from public.profiles where id = peck)) = peck, null);
  insert into _out values ('unknown discord id', public.bot_profile_for_discord('1') is null, null);

  -- Actor inexistente
  begin
    perform public.bot_create_event('00000000-0000-0000-0000-000000000000', 'lounge', null, null, array[]::text[]);
    insert into _out values ('unknown actor rejected', false, 'accepted!');
  exception when others then
    insert into _out values ('unknown actor rejected', sqlerrm like 'forbidden%', sqlerrm);
  end;

  -- War creada por Peckmat (created_by = Peckmat, no service_role)
  ev := public.bot_create_event(peck, 'war', 'MKH', 'ABC', array['Peckmat = tortelini', 'Bob', 'Carl', 'Dan', 'Eve', 'Fay']);
  select array_agg(id order by id) into p from public.event_players where event_id = ev;
  insert into _out values ('create war as actor',
    (select created_by = peck from public.events where id = ev) and array_length(p, 1) = 6, null);

  perform public.bot_save_race(peck, ev, 1::smallint, 'rainbow-road', jsonb_build_array(
    jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', p[2], 'position', 3),
    jsonb_build_object('player_id', p[3], 'position', 5), jsonb_build_object('player_id', p[4], 'position', 7),
    jsonb_build_object('player_id', p[5], 'position', 9), jsonb_build_object('player_id', p[6], 'position', 11)));
  insert into _out values ('race 1 saved', (select count(*) = 6 from public.race_results rr join public.event_races r on r.id = rr.race_id where r.event_id = ev), null);

  -- Las mismas validaciones que la web
  begin
    perform public.bot_save_race(peck, ev, 2::smallint, 'crown-city', jsonb_build_array(
      jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', p[2], 'position', 1)));
    insert into _out values ('validation shared', false, 'accepted!');
  exception when others then
    insert into _out values ('validation shared', sqlerrm like 'invalid%', sqlerrm);
  end;

  sub := public.bot_add_event_player(peck, ev, 'Gus');
  perform public.bot_save_race(peck, ev, 2::smallint, 'crown-city', jsonb_build_array(
    jsonb_build_object('player_id', p[1], 'position', 1), jsonb_build_object('player_id', sub, 'position', 2),
    jsonb_build_object('player_id', p[3], 'position', 4), jsonb_build_object('player_id', p[4], 'position', 6),
    jsonb_build_object('player_id', p[5], 'position', 8)), 1::smallint, 0::smallint);
  insert into _out values ('sub + 11P race', (select count(*) = 2 from public.event_races where event_id = ev), null);

  insert into _out values ('can edit (creator)', public.bot_can_edit_event(peck, ev), null);

  -- Otro usuario (no creador, no jugador, no admin) no puede tocar la war
  if other is not null then
    insert into _out values ('cannot edit (other)', not public.bot_can_edit_event(other, ev), other::text);
    begin
      perform public.bot_finish_event(other, ev);
      insert into _out values ('other cannot finish', false, 'finished!');
    exception when others then
      insert into _out values ('other cannot finish', sqlerrm like 'forbidden%', sqlerrm);
    end;
  end if;

  perform public.bot_finish_event(peck, ev);
  insert into _out values ('finished', (select status = 'finished' from public.events where id = ev), null);

  -- Tabla de eventos activos por canal
  insert into public.discord_channel_events (channel_id, event_id, lineup, started_by) values ('123456789', ev, p, peck);
  insert into _out values ('channel table', (select lineup = p from public.discord_channel_events where channel_id = '123456789'), null);
end $$;

-- service_role no puede llamar directamente a bot_act_as
do $$
begin
  perform public.bot_act_as('62d2437c-68d6-4b3b-ae68-b9b0d949c285');
  insert into _out values ('act_as not callable', false, 'called!');
exception when insufficient_privilege then
  insert into _out values ('act_as not callable', true, sqlerrm);
end $$;

-- Un usuario normal (authenticated) no puede usar las funciones del bot ni la tabla
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

do $$
begin
  begin
    perform public.bot_create_event('62d2437c-68d6-4b3b-ae68-b9b0d949c285', 'lounge', null, null, array[]::text[]);
    insert into _out values ('authenticated denied (rpc)', false, 'called!');
  exception when insufficient_privilege then
    insert into _out values ('authenticated denied (rpc)', true, sqlerrm);
  end;
  begin
    perform public.bot_profile_for_discord('1');
    insert into _out values ('authenticated denied (lookup)', false, 'called!');
  exception when insufficient_privilege then
    insert into _out values ('authenticated denied (lookup)', true, sqlerrm);
  end;
  begin
    perform 1 from public.discord_channel_events limit 1;
    insert into _out values ('authenticated denied (table)', false, 'read!');
  exception when insufficient_privilege then
    insert into _out values ('authenticated denied (table)', true, sqlerrm);
  end;
end $$;

reset role;
select * from _out;
rollback;
