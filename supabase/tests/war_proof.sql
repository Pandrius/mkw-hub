-- Captura de la sala final y revisores de wars; todo se deshace con ROLLBACK (requiere la migración 0027)
begin;
create temp table _out (step text, ok boolean, detail text) on commit drop;
grant all on _out to authenticated;

do $$
declare
  ev uuid;
  other uuid;
  me uuid := '62d2437c-68d6-4b3b-ae68-b9b0d949c285';
begin
  select e.id into ev from public.events e where e.kind = 'war' and e.status = 'finished' and e.mirror_of is null
    and exists (select 1 from public.race_results rr join public.event_races r on r.id = rr.race_id join public.event_players p on p.id = rr.player_id where r.event_id = e.id and p.profile_id is not null)
    limit 1;
  select id into other from public.profiles where id <> me limit 1;
  -- La war de prueba nace sin verificar y hay un revisor además de Peckmat
  update public.events set trusted = false, vouched_by = null, lounge_table_id = null, proof_status = null where id = ev;
  update public.profiles set war_checker = true where id = other;
  create temp table _ctx on commit drop as select ev, other;
  grant select on _ctx to authenticated;
end $$;

set local role authenticated;
set local request.jwt.claims = '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}';

do $$
declare
  ev uuid := (select c.ev from _ctx c);
  other uuid := (select c.other from _ctx c);
  st text;
begin
  insert into _out values ('starts unverified', (select not bool_or(verified) from public.player_results where event_id = ev), null);
  st := public.submit_war_proof(ev, ev || '/a.jpg', repeat('a', 64), false, '{"matched":2}');
  insert into _out values ('mismatch goes pending', st = 'pending', st);
  insert into _out values ('pending does not verify', (select not bool_or(verified) from public.player_results where event_id = ev), null);
end $;

-- El otro revisor ve el aviso (cada uno solo ve los suyos)
select set_config('request.jwt.claims', json_build_object('sub', (select c.other from _ctx c), 'role', 'authenticated')::text, true);
insert into _out select 'reviewers notified', (select count(*) from public.notifications where kind = 'war_proof') = 1, null;
select set_config('request.jwt.claims', '{"sub":"62d2437c-68d6-4b3b-ae68-b9b0d949c285","role":"authenticated"}', true);

do $
declare
  ev uuid := (select c.ev from _ctx c);
begin
  begin
    perform public.submit_war_proof(ev, ev || '/b.jpg', repeat('b', 64), true);
    insert into _out values ('second proof refused', false, 'accepted!');
  exception when others then
    insert into _out values ('second proof refused', sqlerrm like 'invalid%', sqlerrm);
  end;
  -- Aprobar la captura la verifica y retira el aviso a todos
  perform public.review_war_proof(ev, true);
  insert into _out values ('approve verifies', (select bool_and(verified) from public.player_results where event_id = ev), null);
  insert into _out values ('notices cleared', (select count(*) from public.notifications where kind = 'war_proof' and event_id = ev) = 0, null);
  begin
    perform public.review_war_proof(ev, false);
    insert into _out values ('second review refused', false, 'accepted!');
  exception when others then
    insert into _out values ('second review refused', sqlerrm like 'invalid%', sqlerrm);
  end;
end $$;

-- Un usuario cualquiera no puede revisar ni marcar revisores
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare
  ev uuid := (select c.ev from _ctx c);
begin
  begin
    perform public.review_war_proof(ev, true);
    insert into _out values ('stranger cannot review', false, 'accepted!');
  exception when others then
    insert into _out values ('stranger cannot review', sqlerrm like 'forbidden%' or sqlerrm like 'invalid%', sqlerrm);
  end;
  begin
    perform public.set_war_checker('62d2437c-68d6-4b3b-ae68-b9b0d949c285', true);
    insert into _out values ('stranger cannot set checker', false, 'accepted!');
  exception when others then
    insert into _out values ('stranger cannot set checker', sqlerrm like 'forbidden%', sqlerrm);
  end;
end $$;

reset role;
select * from _out;
rollback;
