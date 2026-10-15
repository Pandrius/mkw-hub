-- ============================================================
-- Rayos de los escudos legendarios (premio del evento perfecto y de la leyenda absoluta)
-- ============================================================
-- Quien ha conseguido alguno de los dos elige cómo se ven los rayos de esos escudos en su perfil: simples (por defecto),
-- ramificados o sin rayos. Solo se guarda desde api/showcase.ts, que comprueba que lo ha conseguido (las columnas de
-- perfil no se pueden editar desde el navegador).

alter table public.profiles
  add column if not exists bolt_style text not null default 'simple'
  check (bolt_style in ('simple', 'forked', 'none'));
