-- Compañeros de equipo de cada mesa del Lounge y su MMR antes de la mesa (para la media de MMR de los compañeros en SQ).
-- partner_mmrs va alineado con partner_ids; null = no se ha podido averiguar.
alter table public.lounge_changes
  add column partner_ids integer[] not null default '{}',
  add column partner_mmrs integer[] not null default '{}';
