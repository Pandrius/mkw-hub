-- ============================================================
-- Avisos de ranking: corona ganada, pista ganada y pista perdida
-- ============================================================
-- Se suman a los de récord y trono perdido (0029). `data` lleva los detalles (qué corona o pista y de qué periodo).
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('war_posted', 'war_proof', 'record_lost', 'throne_lost', 'crown_won', 'track_won', 'track_lost')
);
