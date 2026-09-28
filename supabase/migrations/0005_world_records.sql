-- ============================================================
-- Récords mundiales (historial completo) desde mkwrs.com / @MKWorldRecords
-- ============================================================
-- Se sincroniza a diario con api/sync.ts usando el CSV público de mkwrs.com.
-- Solo lectura desde la web: no hay políticas de escritura (solo la clave secreta escribe).

create table public.world_records (
  id integer primary key,               -- id del registro en mkwrs
  track_id text not null,
  time_ms integer not null,
  player_name text not null,
  country_code text,
  achieved_on date not null,
  days_held integer,
  video_url text,
  character text,
  vehicle text,
  splits text[] not null default '{}',
  synced_at timestamptz not null default now()
);

create index world_records_track_idx on public.world_records (track_id, time_ms, achieved_on);

alter table public.world_records enable row level security;

create policy "Récords visibles para todos"
  on public.world_records for select using (true);

-- Récord vigente de cada pista
create view public.current_world_records
with (security_invoker = true)
as
select distinct on (track_id) *
from public.world_records
order by track_id, time_ms, achieved_on;

-- El top 10 de MKC deja de usarse: sus datos no están al día
delete from public.time_trials where source = 'mkc';
