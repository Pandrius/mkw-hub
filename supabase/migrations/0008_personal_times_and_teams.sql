-- ============================================================
-- Tiempos personales, vínculo con Mario Kart Central y equipos
-- ============================================================

-- Perfil: país y jugador de MKC (se rellenan con api/mkc-link al iniciar sesión)
alter table public.profiles
  add column country_code text check (country_code ~ '^[A-Z]{2}$'),
  add column mkc_player_id integer unique,
  add column mkc_synced_at timestamptz;

-- Equipos de MKW registrados en MKC (id = id del equipo en MKC)
create table public.teams (
  id integer primary key,
  name text not null,
  tag text not null,
  color integer,
  updated_at timestamptz not null default now()
);

create table public.team_members (
  team_id integer not null references public.teams on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  primary key (team_id, profile_id)
);

create index team_members_profile_idx on public.team_members (profile_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
create policy "Equipos visibles" on public.teams for select using (true);
create policy "Miembros visibles" on public.team_members for select using (true);
revoke insert, update, delete on public.teams, public.team_members from anon, authenticated;

-- Tiempos: cualquier usuario añade los suyos con add_my_time(); los editores, de cualquiera
create function public.add_my_time(
  track_id text,
  category public.tt_category,
  nita boolean,
  time_ms integer,
  proof_url text default null,
  achieved_on date default null
)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  me public.profiles;
  new_id bigint;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then
    raise exception 'forbidden: sign in first';
  end if;
  insert into public.time_trials (track_id, category, nita, time_ms, player_name, country_code, profile_id, proof_url, achieved_on, created_by)
  values (add_my_time.track_id, add_my_time.category, add_my_time.nita, add_my_time.time_ms, me.username, me.country_code,
          me.id, nullif(btrim(add_my_time.proof_url), ''), coalesce(add_my_time.achieved_on, current_date), me.id)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.add_my_time from public, anon;
grant execute on function public.add_my_time to authenticated;

-- Cada jugador puede borrar sus propios tiempos (además de los editores)
drop policy "Editores de contrarreloj borran tiempos" on public.time_trials;
create policy "Borrar tiempos propios o como editor"
  on public.time_trials for delete to authenticated
  using (source = 'manual' and (profile_id = auth.uid() or public.is_tt_editor()));

-- Si un editor añade un tiempo con el nombre de un usuario registrado, se vincula a su perfil
create function public.link_time_to_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.profile_id is null then
    select p.id into new.profile_id from public.profiles p where lower(p.username) = lower(btrim(new.player_name)) limit 1;
  end if;
  return new;
end;
$$;

create trigger time_trials_link_profile
  before insert on public.time_trials
  for each row execute function public.link_time_to_profile();

-- Mejor tiempo de cada jugador registrado por pista y categoría
create view public.player_best_times
with (security_invoker = true)
as
select distinct on (profile_id, track_id, category, nita)
  profile_id, track_id, category, nita, time_ms, achieved_on, proof_url, id
from public.time_trials
where profile_id is not null
order by profile_id, track_id, category, nita, time_ms, achieved_on;
