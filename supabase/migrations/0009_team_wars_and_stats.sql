-- ============================================================
-- Wars por equipo, historial de rivales y estadísticas
-- ============================================================

-- Columnas de equipo y rival en la tabla events
alter table public.events
  add column if not exists team_id integer references public.teams (id) on delete set null,
  add column if not exists team_name text,
  add column if not exists opponent_team_id integer references public.teams (id) on delete set null,
  add column if not exists opponent_name text,
  add column if not exists opponent_players text[];

create index if not exists events_team_id_idx on public.events (team_id, status);
create index if not exists events_opponent_team_id_idx on public.events (opponent_team_id);

-- can_edit_event: si es war de equipo, cualquier miembro del equipo puede editarla mientras esté abierta
create or replace function public.can_edit_event(target uuid)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = target
      and e.status = 'open'
      and (
        e.created_by = auth.uid()
        or public.is_admin()
        or exists (select 1 from public.event_players p where p.event_id = e.id and p.profile_id = auth.uid())
        or (e.team_id is not null and exists (
          select 1 from public.team_members tm where tm.team_id = e.team_id and tm.profile_id = auth.uid()
        ))
      )
  );
$$;

-- Reemplaza create_event
drop function if exists public.create_event(public.event_kind, text, text, text[]);
drop function if exists public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[]);

create or replace function public.create_event(
  kind public.event_kind,
  team_tag text,
  opponent_tag text,
  players text[],
  team_id integer default null,
  team_name text default null,
  opponent_team_id integer default null,
  opponent_name text default null,
  opponent_players text[] default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  entry text;
begin
  if me is null then
    raise exception 'forbidden: sign in first';
  end if;

  -- Verificación estricta: solo miembros del equipo (o admins) pueden registrar wars en nombre de un equipo
  if kind = 'war' and team_id is not null then
    if not (
      public.is_admin()
      or exists (select 1 from public.team_members tm where tm.team_id = create_event.team_id and tm.profile_id = me)
    ) then
      raise exception 'forbidden: solo los miembros de este equipo pueden registrar sus wars';
    end if;
  end if;

  insert into public.events (
    kind, team_tag, opponent_tag, created_by,
    team_id, team_name, opponent_team_id, opponent_name, opponent_players
  )
  values (
    kind,
    case when kind = 'war' then nullif(btrim(team_tag), '') end,
    case when kind = 'war' then nullif(btrim(opponent_tag), '') end,
    me,
    case when kind = 'war' then create_event.team_id end,
    case when kind = 'war' then nullif(btrim(create_event.team_name), '') end,
    case when kind = 'war' then create_event.opponent_team_id end,
    case when kind = 'war' then nullif(btrim(create_event.opponent_name), '') end,
    case when kind = 'war' then create_event.opponent_players end
  )
  returning id into new_id;

  if kind = 'lounge' then
    insert into public.event_players (event_id, name, profile_id)
    select new_id, coalesce(nullif(btrim(players[1]), ''), p.username), me
    from public.profiles p where p.id = me;
  else
    if coalesce(array_length(players, 1), 0) <> 6 then
      raise exception 'invalid: a war needs exactly 6 players';
    end if;
    foreach entry in array players loop
      insert into public.event_players (event_id, name, profile_id)
      select new_id, r.name, r.profile_id from public.resolve_player(entry) r;
    end loop;
  end if;

  return new_id;
end;
$$;

revoke execute on function public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[]) from public, anon;
grant execute on function public.create_event(public.event_kind, text, text, text[], integer, text, integer, text, text[]) to authenticated;
