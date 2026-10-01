-- ============================================================
-- Rosters y sub-equipos de Mario Kart World
-- ============================================================
-- Cada registro en public.teams representa un roster oficial de Mario Kart World en MKC
-- (ej. Nebulosa vs Nebulosa del Cangrejo; Rozando la Katástrofe vs Lobos / Exodus / etc.)
-- parent_team_id guarda el id del equipo/club matriz en MKC
-- logo_url guarda la URL directa del logo oficial en MKC

alter table public.teams
  add column if not exists parent_team_id integer,
  add column if not exists parent_name text,
  add column if not exists logo_url text;

create index if not exists teams_parent_team_id_idx on public.teams (parent_team_id);
