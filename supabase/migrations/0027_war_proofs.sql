-- ============================================================
-- Verificación de wars con la captura de la sala final + rol «Comprobar wars»
-- ============================================================
-- Quien jugó una war que aún no está verificada puede subir la captura de la sala final. El navegador lee los puntos de la
-- captura (OCR) y los compara con los de la war:
--   · si coinciden → proof_status = 'auto': la war cuenta como verificada de inmediato, a la espera de que un revisor la confirme;
--   · si no coinciden (o no se leen bien) → 'pending': no cuenta hasta que un revisor la apruebe.
-- Los revisores son los perfiles con profiles.war_checker (los marca un admin; los admins también pueden revisar). Al subir una
-- captura se avisa a todos los revisores y, en cuanto uno la resuelve (aprobada o rechazada), el aviso desaparece de los demás.
-- Como la lectura se hace en el navegador, un 'auto' puede ser falso: por eso un revisor siempre tiene la última palabra y un
-- rechazo quita la verificación.

alter table public.profiles add column war_checker boolean not null default false;

alter table public.events
  add column proof_path text,
  add column proof_hash text,
  add column proof_status text check (proof_status in ('auto', 'pending', 'approved', 'rejected')),
  add column proof_uploader uuid references public.profiles (id) on delete set null,
  add column proof_reviewer uuid references public.profiles (id) on delete set null,
  -- Lo que leyó el navegador (jugadores leídos, coincidencias y diferencias), para que el revisor lo vea
  add column proof_reading jsonb,
  add column proof_at timestamptz,
  add column proof_reviewed_at timestamptz;

-- La misma imagen no puede respaldar dos wars (los rechazos no bloquean)
create unique index events_proof_hash_key on public.events (proof_hash) where proof_status in ('auto', 'pending', 'approved');

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('war_posted', 'war_proof'));

-- Cuenta como verificada: la captura leída (a falta de revisar) o aprobada
create or replace view public.player_results
with (security_invoker = true)
as
select
  p.profile_id,
  e.kind,
  e.id as event_id,
  e.finished_at,
  r.track_id,
  rr.position,
  case when e.kind = 'war' then 12 - r.missing_home - r.missing_away end as racers,
  e.trusted
    or e.vouched_by is not null
    or coalesce(e.proof_status in ('auto', 'approved'), false)
    or case
      when e.kind = 'lounge' then e.lounge_change_id is not null
      else e.lounge_table_id is not null
    end as verified,
  e.lounge_tier as tier
from public.race_results rr
join public.event_players p on p.id = rr.player_id
join public.event_races r on r.id = rr.race_id
join public.events e on e.id = r.event_id
where e.status = 'finished' and p.profile_id is not null;

-- Revisores: perfiles marcados por un admin, y los admins
create function public.can_review_wars()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select public.is_admin() or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.war_checker);
$$;
revoke execute on function public.can_review_wars() from public, anon;
grant execute on function public.can_review_wars() to authenticated;

create function public.set_war_checker(target uuid, value boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: solo un admin puede gestionar los revisores de wars';
  end if;
  update public.profiles set war_checker = value where id = target;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  if not value then
    delete from public.notifications where profile_id = target and kind = 'war_proof';
  end if;
end;
$$;
revoke execute on function public.set_war_checker from public, anon;
grant execute on function public.set_war_checker to authenticated;

-- ¿Puede quien llama subir la captura de esta war? Quien la subió, un jugador apuntado con perfil o un admin
create function public.can_submit_proof(target uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = target and e.kind = 'war' and e.status = 'finished'
      and (
        public.is_admin()
        or e.created_by = (select auth.uid())
        or exists (select 1 from public.event_players ep where ep.event_id = e.id and ep.profile_id = (select auth.uid()))
      )
  );
$$;
revoke execute on function public.can_submit_proof(uuid) from public, anon;
grant execute on function public.can_submit_proof(uuid) to authenticated;

-- Sube la captura (ya guardada en el bucket) y la deja en revisión
create function public.submit_war_proof(target uuid, path text, hash text, auto_match boolean, reading jsonb default null)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ev public.events%rowtype;
  new_status text := case when auto_match then 'auto' else 'pending' end;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;
  select * into ev from public.events where id = target for update;
  if not found or ev.kind <> 'war' or ev.status <> 'finished' then
    raise exception 'invalid: la war no existe o no está finalizada';
  end if;
  if not public.can_submit_proof(target) then
    raise exception 'forbidden: solo quien jugó o subió la war puede enviar la captura';
  end if;
  if ev.trusted or ev.vouched_by is not null or ev.lounge_table_id is not null then
    raise exception 'invalid: esta war ya está verificada';
  end if;
  if ev.proof_status in ('auto', 'pending', 'approved') then
    raise exception 'invalid: esta war ya tiene una captura enviada';
  end if;
  if path is null or path not like target::text || '/%' then
    raise exception 'invalid: ruta de captura no válida';
  end if;
  if hash is null or hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid: huella de la captura no válida';
  end if;
  if exists (select 1 from public.events o where o.proof_hash = hash and o.proof_status in ('auto', 'pending', 'approved')) then
    raise exception 'invalid: esta captura ya se usó en otra war';
  end if;

  update public.events set
    proof_path = path, proof_hash = hash, proof_status = new_status, proof_uploader = me, proof_reviewer = null,
    proof_reading = reading, proof_at = now(), proof_reviewed_at = null
  where id = target;

  -- Aviso a todos los revisores (menos a quien la sube)
  delete from public.notifications where kind = 'war_proof' and event_id = target;
  insert into public.notifications (profile_id, kind, event_id, actor_id)
  select p.id, 'war_proof', target, me from public.profiles p where p.war_checker and p.id <> me;
  return new_status;
end;
$$;
revoke execute on function public.submit_war_proof from public, anon;
grant execute on function public.submit_war_proof to authenticated;

-- Un revisor aprueba o rechaza la captura. El primero que la resuelve se la quita a los demás
create function public.review_war_proof(target uuid, approve boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ev public.events%rowtype;
begin
  if me is null or not public.can_review_wars() then
    raise exception 'forbidden: solo los revisores de wars pueden hacerlo';
  end if;
  select * into ev from public.events where id = target for update;
  if not found or ev.proof_status not in ('auto', 'pending') then
    raise exception 'invalid: esta captura ya está revisada o no existe';
  end if;
  if ev.proof_uploader = me and not public.is_admin() then
    raise exception 'forbidden: no puedes revisar tu propia captura';
  end if;
  update public.events set
    proof_status = case when approve then 'approved' else 'rejected' end, proof_reviewer = me, proof_reviewed_at = now()
  where id = target;
  delete from public.notifications where kind = 'war_proof' and event_id = target;
end;
$$;
revoke execute on function public.review_war_proof from public, anon;
grant execute on function public.review_war_proof to authenticated;

-- Bucket privado de capturas: las ve quien puede subirlas a esa war y los revisores
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('war-proofs', 'war-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Subir capturas de wars" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'war-proofs'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and public.can_submit_proof(((storage.foldername(name))[1])::uuid)
  );
create policy "Ver capturas de wars" on storage.objects for select to authenticated
  using (
    bucket_id = 'war-proofs'
    and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    and (public.can_submit_proof(((storage.foldername(name))[1])::uuid) or public.can_review_wars())
  );
