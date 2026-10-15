-- Nombre de cada compañero de equipo (alineado con partner_ids; null = desconocido), para las estadísticas de compañeros
alter table public.lounge_changes add column partner_names text[] not null default '{}';
