-- ============================================================
-- Instantánea de la comunidad (rankings de logros, récords y coronas) y avisos de récord / trono perdido
-- ============================================================
-- Calcular los rankings recorre las carreras verificadas de todos los jugadores; se guarda el resultado (y se recalcula como
-- mucho cada pocos minutos) para que lo lean la web, las comprobaciones de insignias y títulos, y el cron diario. Al guardar una
-- instantánea nueva se compara con la anterior: a quien le quitan un récord o el trono le llega un aviso.

create table if not exists public.community_snapshots (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.community_snapshots enable row level security;
-- Sin políticas: solo el servidor (clave de servicio) la lee y la escribe
revoke all on public.community_snapshots from anon, authenticated;

-- Avisos que no son de una war: récord o trono perdido. `data` lleva los detalles y `dedupe` evita avisar dos veces de lo mismo
alter table public.notifications alter column event_id drop not null;
alter table public.notifications add column if not exists data jsonb;
alter table public.notifications add column if not exists dedupe text;
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('war_posted', 'war_proof', 'record_lost', 'throne_lost'));
alter table public.notifications add constraint notifications_event_check check (kind not in ('war_posted', 'war_proof') or event_id is not null);
alter table public.notifications add constraint notifications_dedupe_key unique (profile_id, kind, dedupe);
