-- ============================================================
-- Moderadores y tiempos de contrarreloj
-- ============================================================

-- Los moderadores también son editores
create or replace function public.is_editor()
returns boolean
language sql stable
as $$ select public.current_role_is(array['editor', 'moderator', 'admin']::public.user_role[]) $$;

create function public.is_moderator()
returns boolean
language sql stable
as $$ select public.current_role_is(array['moderator', 'admin']::public.user_role[]) $$;

-- Reglas para cambiar roles:
--   · Admin: puede poner cualquier rol a cualquier usuario, salvo a sí mismo.
--   · Moderador: solo puede cambiar entre 'user' y 'editor' a usuarios que sean 'user' o 'editor'.
create or replace function public.set_user_role(target uuid, new_role public.user_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  current_target_role public.user_role;
begin
  if target = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol';
  end if;

  select role into current_target_role from public.profiles where id = target;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  if public.is_admin() then
    null;
  elsif public.is_moderator() then
    if current_target_role not in ('user', 'editor') or new_role not in ('user', 'editor') then
      raise exception 'Un moderador solo puede dar o quitar el rol de editor';
    end if;
  else
    raise exception 'No tienes permiso para cambiar roles';
  end if;

  update public.profiles set role = new_role where id = target;
end;
$$;

revoke execute on function public.set_user_role from public, anon;
grant execute on function public.set_user_role to authenticated;

-- Tiempos de contrarreloj ------------------------------------------------------
--   category: 'race' = carrera completa, 'flap' = vuelta rápida
--   nita:     true = sin items (No Items Time Attack)
--   source:   'manual' = añadido por un editor, 'mkc' = importado de Mario Kart Central
create type public.tt_category as enum ('race', 'flap');
create type public.tt_source as enum ('manual', 'mkc');

create table public.time_trials (
  id bigint generated always as identity primary key,
  track_id text not null,
  category public.tt_category not null,
  nita boolean not null,
  time_ms integer not null check (time_ms between 1000 and 3600000),
  player_name text not null check (char_length(player_name) between 1 and 60),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  profile_id uuid references public.profiles (id) on delete set null,
  proof_url text check (proof_url is null or proof_url ~ '^https://'),
  achieved_on date,
  source public.tt_source not null default 'manual',
  external_id text unique,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index time_trials_board_idx on public.time_trials (track_id, category, nita, time_ms);
create index time_trials_player_idx on public.time_trials (lower(player_name), track_id);

alter table public.time_trials enable row level security;

create policy "Tiempos visibles para todos"
  on public.time_trials for select using (true);

-- Los editores solo gestionan tiempos manuales; los de MKC los mantiene la sincronización.
create policy "Editores añaden tiempos"
  on public.time_trials for insert to authenticated
  with check (public.is_editor() and source = 'manual' and external_id is null);

create policy "Editores editan tiempos manuales"
  on public.time_trials for update to authenticated
  using (public.is_editor() and source = 'manual')
  with check (public.is_editor() and source = 'manual' and external_id is null);

create policy "Editores borran tiempos manuales"
  on public.time_trials for delete to authenticated
  using (public.is_editor() and source = 'manual');
