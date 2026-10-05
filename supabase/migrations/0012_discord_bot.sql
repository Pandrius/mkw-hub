-- ============================================================
-- Bot de Discord (api/discord.ts)
-- ============================================================
-- El bot llama a Supabase con la clave secreta (rol service_role), así que auth.uid() es null.
-- Para no duplicar las reglas de create_event, save_race, etc., cada función bot_* recibe el
-- perfil que ejecuta el comando (resuelto a partir de su Discord ID), fija ese usuario como
-- "usuario actual" SOLO durante la transacción y llama a la función original. Así la web y el
-- bot comparten exactamente las mismas comprobaciones (can_edit_event, miembros del equipo…).
--
-- Seguridad: estas funciones solo las puede ejecutar service_role. Ni anon ni authenticated
-- pueden llamarlas (si pudieran, cualquiera podría actuar en nombre de otro usuario).

-- Evento activo en cada canal de Discord (o MD con el bot) ------------------------------------
-- lineup = ids de event_players en el orden en que se escriben las posiciones en /carrera
create table public.discord_channel_events (
  channel_id text primary key check (channel_id ~ '^[0-9]{1,25}$'),
  event_id uuid not null references public.events on delete cascade,
  lineup bigint[] not null default '{}',
  started_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index discord_channel_events_event_idx on public.discord_channel_events (event_id);

-- Sin políticas: solo service_role (que se salta RLS) lee y escribe esta tabla
alter table public.discord_channel_events enable row level security;
revoke all on public.discord_channel_events from anon, authenticated;

-- Perfil de la web a partir del Discord ID ------------------------------------------------------
-- Solo la identidad de Discord de Supabase Auth (auth.identities.provider_id = ID de usuario de
-- Discord). profiles.discord_id NO se usa: no es una prueba de que la cuenta sea de esa persona.
create function public.bot_profile_for_discord(discord_user_id text)
returns uuid
language sql stable
security definer set search_path = ''
as $$
  select p.id
    from auth.identities i
    join public.profiles p on p.id = i.user_id
   where i.provider = 'discord' and i.provider_id = discord_user_id
   limit 1;
$$;

-- Fija "actor" como usuario actual hasta el final de la transacción (lo que lee auth.uid()).
-- Comprueba que el perfil exista para no actuar en nombre de nadie.
create function public.bot_act_as(actor uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor) then
    raise exception 'forbidden: unknown profile';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', actor::text, true);
end;
$$;

create function public.bot_create_event(
  actor uuid,
  kind public.event_kind,
  team_tag text,
  opponent_tag text,
  players text[],
  team_id integer default null,
  team_name text default null,
  opponent_team_id integer default null,
  opponent_name text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.bot_act_as(actor);
  return public.create_event(
    kind, team_tag, opponent_tag, players,
    team_id, team_name, opponent_team_id, opponent_name, null
  );
end;
$$;

create function public.bot_add_event_player(actor uuid, target uuid, entry text)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.bot_act_as(actor);
  return public.add_event_player(target, entry);
end;
$$;

create function public.bot_save_race(
  actor uuid,
  target uuid,
  race_no smallint,
  track_id text,
  results jsonb,
  missing_home smallint default 0,
  missing_away smallint default 0
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.bot_act_as(actor);
  -- opponent_results null: el bot solo registra las posiciones del equipo propio
  perform public.save_race(target, race_no, track_id, results, missing_home, missing_away, null::jsonb);
end;
$$;

create function public.bot_finish_event(actor uuid, target uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.bot_act_as(actor);
  perform public.finish_event(target);
end;
$$;

create function public.bot_can_edit_event(actor uuid, target uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  perform public.bot_act_as(actor);
  return public.can_edit_event(target);
end;
$$;

-- Solo service_role (la función de Vercel). En Supabase las funciones nuevas de public se
-- conceden por defecto a anon y authenticated, así que se revocan explícitamente.
revoke execute on function
  public.bot_profile_for_discord(text),
  public.bot_act_as(uuid),
  public.bot_create_event(uuid, public.event_kind, text, text, text[], integer, text, integer, text),
  public.bot_add_event_player(uuid, uuid, text),
  public.bot_save_race(uuid, uuid, smallint, text, jsonb, smallint, smallint),
  public.bot_finish_event(uuid, uuid),
  public.bot_can_edit_event(uuid, uuid)
  from public, anon, authenticated;
-- bot_act_as solo se usa desde las funciones bot_* (que se ejecutan como su propietario)
revoke execute on function public.bot_act_as(uuid) from service_role;

grant execute on function
  public.bot_profile_for_discord(text),
  public.bot_create_event(uuid, public.event_kind, text, text, text[], integer, text, integer, text),
  public.bot_add_event_player(uuid, uuid, text),
  public.bot_save_race(uuid, uuid, smallint, text, jsonb, smallint, smallint),
  public.bot_finish_event(uuid, uuid),
  public.bot_can_edit_event(uuid, uuid)
  to service_role;
