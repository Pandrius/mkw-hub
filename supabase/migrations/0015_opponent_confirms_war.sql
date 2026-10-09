-- ============================================================
-- Una war apuntada por un equipo cuenta también para el rival (invertida) si este la confirma
-- ============================================================

-- null = pendiente, true = confirmada por el rival, false = rechazada por el rival
alter table public.events add column if not exists opponent_confirmed boolean;

-- Confirma o rechaza una war que apuntó el otro equipo. Solo miembros del equipo rival (o admins),
-- con la war ya finalizada. Se puede cambiar de opinión volviendo a llamarla.
create function public.confirm_opponent_war(target uuid, accept boolean)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = target;
  if ev.id is null or ev.kind <> 'war' or ev.status <> 'finished' or ev.opponent_team_id is null then
    raise exception 'invalid: only finished wars against a registered team can be confirmed';
  end if;
  if not (
    public.is_admin()
    or exists (
      select 1 from public.team_members tm where tm.team_id = ev.opponent_team_id and tm.profile_id = auth.uid()
    )
  ) then
    raise exception 'forbidden: only members of the opponent team can confirm this war';
  end if;
  update public.events set opponent_confirmed = accept where id = target;
end;
$$;

revoke execute on function public.confirm_opponent_war(uuid, boolean) from public, anon;
grant execute on function public.confirm_opponent_war(uuid, boolean) to authenticated;
