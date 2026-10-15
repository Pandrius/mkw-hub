-- ============================================================
-- Dueños de pista: el 1 % mejor de cada pista según los eventos verificados
-- ============================================================
-- Un jugador entra en el ranking de una pista con al menos 20 carreras verificadas en ella. Se ordena por los puntos por carrera
-- ajustados (con pocas carreras se acercan a la media de todos en esa pista, como los puntos ajustados de las estadísticas) y se
-- da el título «Dueño de …» al 1 % mejor (siempre al menos al primero). Puede cambiar si otro jugador lo supera.
create function public.track_owners(min_races integer default 20, prior integer default 10, top_share numeric default 0.01)
returns table (
  profile_id uuid,
  track_id text,
  races bigint,
  adj_points numeric,
  rank integer,
  players integer
)
language sql stable
set search_path = ''
as $$
  with pts(pos, p) as (values (1, 15), (2, 12), (3, 10), (4, 9), (5, 8), (6, 7), (7, 6), (8, 5), (9, 4), (10, 3), (11, 2), (12, 1)),
  per as (
    select pr.profile_id, pr.track_id, count(*) as n, sum(coalesce(pts.p, 0))::numeric as s
    from public.player_results pr
    left join pts on pts.pos = pr.position
    where pr.verified
    group by pr.profile_id, pr.track_id
  ),
  glob as (
    select per.track_id, sum(per.s) / sum(per.n) as g from per group by per.track_id
  ),
  elig as (
    select per.profile_id, per.track_id, per.n, (per.s + track_owners.prior * glob.g) / (per.n + track_owners.prior) as adj
    from per join glob on glob.track_id = per.track_id
    where per.n >= track_owners.min_races
  ),
  ranked as (
    select elig.*, rank() over (partition by elig.track_id order by elig.adj desc) as rk,
           count(*) over (partition by elig.track_id) as total
    from elig
  )
  select ranked.profile_id, ranked.track_id, ranked.n, round(ranked.adj, 2), ranked.rk::integer, ranked.total::integer
  from ranked
  where ranked.rk <= greatest(1, ceil(ranked.total * track_owners.top_share))
  order by ranked.track_id, ranked.rk;
$$;

grant execute on function public.track_owners to anon, authenticated;

-- Jugadores con algún evento verificado (para las estadísticas de logros de api/achievement-stats.ts)
create function public.verified_player_ids()
returns table (profile_id uuid)
language sql stable
set search_path = ''
as $$
  select distinct pr.profile_id from public.player_results pr where pr.verified;
$$;

grant execute on function public.verified_player_ids to anon, authenticated;
