-- ============================================================
-- Verificación de wars: la validación del rival ya no basta; hace falta un perfil de confianza o la mesa del Lounge
-- ============================================================
-- Dos equipos (o dos cuentas) podían ponerse de acuerdo para validarse una war inventada. Ahora una war cuenta como verificada si:
--   · la sube un perfil de confianza (events.trusted),
--   · un perfil de confianza que jugó en ella (o un admin) la avala (events.vouched_by), incluida la validación de una war por
--     parte de un perfil de confianza del equipo rival, o
--   · coincide con una mesa SQ 6v6 del Lounge (events.lounge_table_id).
alter table public.events add column vouched_by uuid references public.profiles (id) on delete set null;

-- Un perfil de confianza (o un admin) que jugó en el evento lo avala; value = false retira su aval
create function public.vouch_event(target uuid, value boolean default true)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ev public.events%rowtype;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;
  select * into ev from public.events where id = target;
  if not found or ev.status <> 'finished' then
    raise exception 'invalid: el evento no existe o no está finalizado';
  end if;
  if not (
    public.is_admin()
    or (
      exists (select 1 from public.profiles p where p.id = me and p.trusted)
      and exists (select 1 from public.event_players ep where ep.event_id = target and ep.profile_id = me)
    )
  ) then
    raise exception 'forbidden: solo un perfil de confianza que jugó en el evento, o un admin, puede avalarlo';
  end if;
  if value then
    update public.events set vouched_by = me where id = target;
  else
    update public.events set vouched_by = null where id = target and (vouched_by = me or public.is_admin());
  end if;
end;
$$;

revoke execute on function public.vouch_event from public, anon;
grant execute on function public.vouch_event to authenticated;

-- Si un perfil de confianza valida la war del rival (se crea la copia a su nombre), la war original queda avalada por él
create function public.events_vouch_original()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.mirror_of is not null and new.trusted then
    update public.events set vouched_by = new.created_by where id = new.mirror_of and vouched_by is null;
  end if;
  return new;
end;
$$;

create trigger events_vouch_original after insert on public.events
  for each row execute function public.events_vouch_original();

-- Quitar la confianza a un perfil anula también lo que había avalado
create or replace function public.set_trusted(target uuid, value boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: solo un admin puede gestionar los perfiles de confianza';
  end if;
  update public.profiles set trusted = value where id = target;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  update public.events set trusted = value where created_by = target;
  if not value then
    update public.events set vouched_by = null where vouched_by = target;
  else
    -- Las wars de otros equipos que ya había validado como rival quedan avaladas
    update public.events o set vouched_by = target
    from public.events m
    where m.mirror_of = o.id and m.created_by = target and o.vouched_by is null;
  end if;
end;
$$;

-- player_results: la validación del rival por sí sola ya no verifica
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

-- Las wars ya validadas por un rival que es perfil de confianza
update public.events o set vouched_by = m.created_by
from public.events m
join public.profiles pf on pf.id = m.created_by and pf.trusted
where m.mirror_of = o.id and o.vouched_by is null;
