-- ============================================================
-- Perfiles, roles y consejos por pista
-- ============================================================

create type public.user_role as enum ('user', 'editor', 'admin');

-- Un perfil por usuario de Discord ------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  discord_id text unique,
  username text not null,
  avatar_url text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Perfiles visibles para todos"
  on public.profiles for select using (true);

-- Nadie puede cambiar su rol desde la web: solo se permite actualizar
-- columnas concretas, y el rol lo cambia un admin con set_user_role().
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;

create policy "Cada usuario edita su perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Rellena el perfil al entrar por primera vez con Discord
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, discord_id, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'provider_id',
    coalesce(
      new.raw_user_meta_data -> 'custom_claims' ->> 'global_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Jugador'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de rol -------------------------------------------------------------
create function public.current_role_is(roles public.user_role[])
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (roles)
  );
$$;

create function public.is_editor()
returns boolean
language sql stable
as $$ select public.current_role_is(array['editor', 'admin']::public.user_role[]) $$;

create function public.is_admin()
returns boolean
language sql stable
as $$ select public.current_role_is(array['admin']::public.user_role[]) $$;

-- Solo un admin puede dar o quitar roles
create function public.set_user_role(target uuid, new_role public.user_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un admin puede cambiar roles';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

revoke execute on function public.set_user_role from anon;

-- Consejos por pista ------------------------------------------------------------
-- kind: 'time_trial' = guía de contrarreloj, 'race' = guía de carreras (strats e items)
create type public.tip_kind as enum ('time_trial', 'race');

create table public.track_tips (
  id bigint generated always as identity primary key,
  track_id text not null,
  kind public.tip_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  content text not null default '' check (char_length(content) <= 5000),
  video_url text check (video_url is null or video_url ~ '^https://'),
  position integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index track_tips_track_idx on public.track_tips (track_id, kind, position);

alter table public.track_tips enable row level security;

create policy "Consejos visibles para todos"
  on public.track_tips for select using (true);

create policy "Editores crean consejos"
  on public.track_tips for insert to authenticated with check (public.is_editor());

create policy "Editores editan consejos"
  on public.track_tips for update to authenticated using (public.is_editor()) with check (public.is_editor());

create policy "Editores borran consejos"
  on public.track_tips for delete to authenticated using (public.is_editor());

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger track_tips_touch
  before update on public.track_tips
  for each row execute function public.touch_updated_at();
