-- ============================================================
-- Editores separados: contrarreloj y strats
-- ============================================================
-- Los permisos de editor pasan a ser dos marcas independientes (se pueden tener
-- las dos). El rol queda para la jerarquía user < moderator < admin.
-- El valor 'editor' del enum queda sin uso: Postgres no permite borrar valores de un enum.

alter table public.profiles
  add column tt_editor boolean not null default false,
  add column strat_editor boolean not null default false;

update public.profiles set tt_editor = true, strat_editor = true, role = 'user' where role = 'editor';

alter table public.profiles add constraint profiles_no_legacy_editor check (role <> 'editor');

create function public.is_tt_editor()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (tt_editor or role in ('moderator', 'admin'))
  );
$$;

create function public.is_strat_editor()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (strat_editor or role in ('moderator', 'admin'))
  );
$$;

-- Consejos por pista: editores de strats
drop policy "Editores crean consejos" on public.track_tips;
drop policy "Editores editan consejos" on public.track_tips;
drop policy "Editores borran consejos" on public.track_tips;

create policy "Editores de strats crean consejos"
  on public.track_tips for insert to authenticated with check (public.is_strat_editor());
create policy "Editores de strats editan consejos"
  on public.track_tips for update to authenticated using (public.is_strat_editor()) with check (public.is_strat_editor());
create policy "Editores de strats borran consejos"
  on public.track_tips for delete to authenticated using (public.is_strat_editor());

-- Tiempos: editores de contrarreloj
drop policy "Editores añaden tiempos" on public.time_trials;
drop policy "Editores editan tiempos manuales" on public.time_trials;
drop policy "Editores borran tiempos manuales" on public.time_trials;

create policy "Editores de contrarreloj añaden tiempos"
  on public.time_trials for insert to authenticated
  with check (public.is_tt_editor() and source = 'manual' and external_id is null);
create policy "Editores de contrarreloj editan tiempos"
  on public.time_trials for update to authenticated
  using (public.is_tt_editor() and source = 'manual')
  with check (public.is_tt_editor() and source = 'manual' and external_id is null);
create policy "Editores de contrarreloj borran tiempos"
  on public.time_trials for delete to authenticated
  using (public.is_tt_editor() and source = 'manual');

drop function public.is_editor();

-- Roles (user / moderator / admin): solo el admin, y nunca sobre sí mismo
create or replace function public.set_user_role(target uuid, new_role public.user_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: only admins can change roles';
  end if;
  if target = auth.uid() then
    raise exception 'forbidden: you cannot change your own role';
  end if;
  if new_role = 'editor' then
    raise exception 'invalid: use set_editor_permissions';
  end if;
  update public.profiles set role = new_role where id = target;
  if not found then
    raise exception 'not_found: user not found';
  end if;
end;
$$;

-- Permisos de editor: moderadores y admins, solo sobre usuarios con rol 'user'
-- (moderadores y admins ya tienen ambos permisos)
create function public.set_editor_permissions(target uuid, tt boolean, strat boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_role public.user_role;
begin
  if not public.is_moderator() then
    raise exception 'forbidden: only moderators and admins can manage editors';
  end if;
  if target = auth.uid() then
    raise exception 'forbidden: you cannot change your own permissions';
  end if;
  select role into target_role from public.profiles where id = target;
  if not found then
    raise exception 'not_found: user not found';
  end if;
  if target_role <> 'user' then
    raise exception 'invalid: moderators and admins already have every editor permission';
  end if;
  update public.profiles set tt_editor = tt, strat_editor = strat where id = target;
end;
$$;

revoke execute on function public.set_editor_permissions from public, anon;
grant execute on function public.set_editor_permissions to authenticated;
