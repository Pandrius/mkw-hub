-- ============================================================
-- Endurecimiento de seguridad (auditoría de octubre de 2026)
-- ============================================================
-- 1. El Discord ID de un perfil solo puede venir de una identidad de Discord real de Supabase Auth.
-- 2. Los usuarios ya no pueden cambiarse el nombre ni el avatar a mano (la web no lo usa).
-- 3. Vincular por nombre (jugadores de una war, tiempos) solo cuando el nombre es único.
-- 4. Límites de forma y tamaño en los campos libres de las wars.
--
-- ANTES de aplicar, revisar el resultado de la consulta del paso 0 (perfiles afectados).

-- 0. Revisión (solo lectura): perfiles con un discord_id que no coincide con su identidad de Discord
--
-- select p.id, p.username, p.discord_id
--   from public.profiles p
--  where p.discord_id is not null
--    and not exists (
--      select 1 from auth.identities i
--       where i.user_id = p.id and i.provider = 'discord' and i.provider_id = p.discord_id);

-- 1a. Alta de usuarios: discord_id y avatar solo si el alta viene de Discord ------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  from_discord boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') = 'discord';
begin
  insert into public.profiles (id, discord_id, username, avatar_url)
  values (
    new.id,
    case when from_discord then new.raw_user_meta_data ->> 'provider_id' end,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data -> 'custom_claims' ->> 'global_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      'Jugador'
    ), 32),
    case when from_discord then new.raw_user_meta_data ->> 'avatar_url' end
  );
  return new;
end;
$$;

-- 1b. Limpieza: quita los discord_id que no son de una identidad de Discord real, y los equipos
--     de quien no tiene identidad de Discord (se recalculan con la siguiente sincronización con MKC)
update public.profiles p
   set discord_id = null, mkc_player_id = null
 where p.discord_id is not null
   and not exists (
     select 1 from auth.identities i
      where i.user_id = p.id and i.provider = 'discord' and i.provider_id = p.discord_id);

delete from public.team_members tm
 where not exists (
   select 1 from auth.identities i where i.user_id = tm.profile_id and i.provider = 'discord');

-- 2. Perfil de solo lectura para los usuarios ---------------------------------------------------
drop policy if exists "Cada usuario edita su perfil" on public.profiles;
revoke update (username, avatar_url) on public.profiles from authenticated;

-- 3a. Jugadores de una war: solo se vinculan a un perfil si el nombre es único -------------------
create or replace function public.resolve_player(entry text)
returns table (name text, profile_id uuid)
language plpgsql stable
security definer set search_path = ''
as $$
declare
  account text;
  ingame text;
begin
  if position('=' in entry) > 0 then
    account := btrim(split_part(entry, '=', 1));
    ingame := btrim(substr(entry, position('=' in entry) + 1));
  else
    account := btrim(entry);
    ingame := account;
  end if;
  if ingame = '' then
    raise exception 'invalid: empty player name';
  end if;
  return query
    select ingame, (
      select case when count(*) = 1 then (array_agg(p.id))[1] end
        from public.profiles p
       where lower(p.username) = lower(account));
end;
$$;

-- 3b. Tiempos de contrarreloj: igual, solo con nombre único -----------------------------------
create or replace function public.link_time_to_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.profile_id is null then
    select case when count(*) = 1 then (array_agg(p.id))[1] end
      into new.profile_id
      from public.profiles p
     where lower(p.username) = lower(btrim(new.player_name));
  end if;
  return new;
end;
$$;

-- 4. Forma y tamaño de los campos libres de las wars ---------------------------------------------
--    (si alguna fila existente no cumple, la sentencia falla: revisar con las consultas de abajo)
-- select id from public.event_races where opponent_results is not null
--    and (jsonb_typeof(opponent_results) <> 'array' or jsonb_array_length(opponent_results) > 12);
-- select id from public.events where char_length(team_name) > 60 or char_length(opponent_name) > 60
--    or coalesce(array_length(opponent_players, 1), 0) > 12;
alter table public.event_races
  add constraint event_races_opponent_results_shape
  check (opponent_results is null
         or (jsonb_typeof(opponent_results) = 'array' and jsonb_array_length(opponent_results) <= 12));

alter table public.events
  add constraint events_team_name_len check (char_length(team_name) <= 60),
  add constraint events_opponent_name_len check (char_length(opponent_name) <= 60),
  add constraint events_opponent_players_len check (coalesce(array_length(opponent_players, 1), 0) <= 12);
