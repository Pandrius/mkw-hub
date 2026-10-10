import { mirrorPenalties, parsePenalties, penaltyTotals, type Penalty } from './penalties'
import { pointsForPosition, scoreTeamRace } from './scoring'
import { supabase } from './supabase'

/** Resultado de un jugador del equipo en una carrera de war */
export type TeamWarResult = { name: string; profileId: string | null; position: number }

export type TeamWarRace = {
  track_id: string
  race_no: number
  missing_home: number
  missing_away: number
  positions: number[]
  /** Quién quedó en cada posición (para las estadísticas por jugador) */
  results?: TeamWarResult[]
}

export type TeamWar = {
  id: string
  team_id: number
  team_tag: string | null
  team_name: string | null
  opponent_team_id: number | null
  opponent_tag: string | null
  opponent_name: string | null
  created_at: string
  finished_at: string | null
  races: TeamWarRace[]
  /** Penalties de la war, desde el punto de vista de este equipo (home = el propio) */
  penalties?: Penalty[]
  /** Si es la copia que subió el rival al validar una war, la war original */
  mirrorOf?: string | null
}

export type TeamRivalMatch = {
  eventId: string
  date: string | null
  homeScore: number
  awayScore: number
  diff: number
  result: 'W' | 'L' | 'T'
}

export type TeamRivalStats = {
  opponentKey: string
  opponentId: number | null
  opponentTag: string
  opponentName: string
  wars: number
  wins: number
  losses: number
  ties: number
  pointsHome: number
  pointsAway: number
  diff: number
  matches: TeamRivalMatch[]
}

export type TeamTrackStats = {
  trackId: string
  races: number
  pointsHome: number
  pointsAway: number
  avgHome: number
  avgAway: number
  diff: number // avgHome - avgAway (+/- diferencial de puntos medios)
  avgPosHome: number
  avgPosAway: number
}

export type TeamStats = {
  teamId: number
  wars: number
  wins: number
  losses: number
  ties: number
  winRate: number
  totalPointsHome: number
  totalPointsAway: number
  totalRaces: number
  avgDiff: number // general +/- diferencial medio por carrera
  rivals: TeamRivalStats[]
  tracks: TeamTrackStats[]
  bestTracks: TeamTrackStats[]
  worstTracks: TeamTrackStats[]
}

/** Calcula estadísticas completas para un equipo a partir de sus wars finalizadas (función pura) */
export function computeTeamStats(teamId: number, wars: TeamWar[]): TeamStats {
  let wins = 0
  let losses = 0
  let ties = 0
  let totalPointsHome = 0
  let totalPointsAway = 0
  let totalRaces = 0

  const rivalsMap = new Map<string, TeamRivalStats>()
  const trackMap = new Map<
    string,
    {
      races: number
      pointsHome: number
      pointsAway: number
      positionsHomeSum: number
      positionsAwaySum: number
      racersCount: number
    }
  >()

  for (const war of wars) {
    let warHomeScore = 0
    let warAwayScore = 0

    for (const r of war.races) {
      const score = scoreTeamRace(r.positions, r.missing_home, r.missing_away)
      warHomeScore += score.home
      warAwayScore += score.away
      totalRaces += 1

      // Acumulador de pista
      const currentTrack = trackMap.get(r.track_id) ?? {
        races: 0,
        pointsHome: 0,
        pointsAway: 0,
        positionsHomeSum: 0,
        positionsAwaySum: 0,
        racersCount: 0,
      }
      currentTrack.races += 1
      currentTrack.pointsHome += score.home
      currentTrack.pointsAway += score.away

      const homeRacers = r.positions.length
      const totalRacerSlots = 12 - r.missing_home - r.missing_away
      const taken = new Set(r.positions)
      const awayRacers = Array.from({ length: totalRacerSlots }, (_, i) => i + 1).filter((pos) => !taken.has(pos))

      currentTrack.positionsHomeSum += r.positions.reduce((a, b) => a + b, 0)
      currentTrack.positionsAwaySum += awayRacers.reduce((a, b) => a + b, 0)
      currentTrack.racersCount += homeRacers

      trackMap.set(r.track_id, currentTrack)
    }

    // Las penalties restan al resultado de la war (no a las pistas)
    const pen = penaltyTotals(war.penalties)
    warHomeScore += pen.home
    warAwayScore += pen.away

    totalPointsHome += warHomeScore
    totalPointsAway += warAwayScore

    let result: 'W' | 'L' | 'T'
    if (warHomeScore > warAwayScore) {
      wins += 1
      result = 'W'
    } else if (warHomeScore < warAwayScore) {
      losses += 1
      result = 'L'
    } else {
      ties += 1
      result = 'T'
    }

    // Histórico contra rivales
    const oppKey = war.opponent_team_id
      ? `id:${war.opponent_team_id}`
      : `tag:${(war.opponent_tag || war.opponent_name || 'Rival').trim().toLowerCase()}`

    const oppTag = war.opponent_tag?.trim() || war.opponent_name?.trim() || 'Rival'
    const oppName = war.opponent_name?.trim() || war.opponent_tag?.trim() || 'Rival'

    const rival = rivalsMap.get(oppKey) ?? {
      opponentKey: oppKey,
      opponentId: war.opponent_team_id,
      opponentTag: oppTag,
      opponentName: oppName,
      wars: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsHome: 0,
      pointsAway: 0,
      diff: 0,
      matches: [],
    }

    rival.wars += 1
    if (result === 'W') rival.wins += 1
    else if (result === 'L') rival.losses += 1
    else rival.ties += 1

    rival.pointsHome += warHomeScore
    rival.pointsAway += warAwayScore
    rival.diff = rival.pointsHome - rival.pointsAway

    rival.matches.push({
      eventId: war.id,
      date: war.finished_at || war.created_at,
      homeScore: warHomeScore,
      awayScore: warAwayScore,
      diff: warHomeScore - warAwayScore,
      result,
    })

    rivalsMap.set(oppKey, rival)
  }

  // Lista de rivales ordenada por número de wars y diferencial
  const rivals = [...rivalsMap.values()]
    .map((rv) => ({
      ...rv,
      matches: rv.matches.sort((a, b) => (b.date && a.date ? b.date.localeCompare(a.date) : 0)),
    }))
    .sort((a, b) => b.wars - a.wars || b.diff - a.diff)

  // Rendimiento por pista
  const tracks: TeamTrackStats[] = [...trackMap.entries()]
    .map(([trackId, data]) => {
      const avgHome = Number((data.pointsHome / data.races).toFixed(2))
      const avgAway = Number((data.pointsAway / data.races).toFixed(2))
      const diff = Number((avgHome - avgAway).toFixed(2))
      const avgPosHome = Number((data.positionsHomeSum / (data.racersCount || 1)).toFixed(2))
      const avgPosAway = Number((data.positionsAwaySum / (data.racersCount || 1)).toFixed(2))
      return {
        trackId,
        races: data.races,
        pointsHome: data.pointsHome,
        pointsAway: data.pointsAway,
        avgHome,
        avgAway,
        diff,
        avgPosHome,
        avgPosAway,
      }
    })
    .sort((a, b) => b.diff - a.diff)

  const bestTracks = tracks.filter((t) => t.diff > 0).slice(0, 3)
  const worstTracks = [...tracks].filter((t) => t.diff < 0).reverse().slice(0, 3)

  const warsCount = wars.length
  const winRate = warsCount > 0 ? Number(((wins / warsCount) * 100).toFixed(1)) : 0
  const avgDiff = totalRaces > 0 ? Number(((totalPointsHome - totalPointsAway) / totalRaces).toFixed(2)) : 0

  return {
    teamId,
    wars: warsCount,
    wins,
    losses,
    ties,
    winRate,
    totalPointsHome,
    totalPointsAway,
    totalRaces,
    avgDiff,
    rivals,
    tracks,
    bestTracks,
    worstTracks,
  }
}

export type TeamPlayerStats = {
  key: string
  name: string
  profileId: string | null
  wars: number
  races: number
  points: number
  avgPoints: number // puntos por carrera
  avgPos: number
  top3Rate: number // % de carreras en el podio
  bestTrack: { trackId: string; avgPoints: number; races: number } | null
  /** Pista con menos puntos de media (null si solo ha corrido una) */
  worstTrack: { trackId: string; avgPoints: number; races: number } | null
}

/**
 * Estadísticas de cada jugador del equipo en sus wars (función pura).
 * Se agrupa por usuario de la web si está vinculado y, si no, por el nombre en el juego.
 * Las wars vienen de la más reciente a la más antigua: se muestra el último nombre usado.
 */
export function computeTeamPlayerStats(wars: TeamWar[]): TeamPlayerStats[] {
  type Acc = {
    name: string
    profileId: string | null
    wars: Set<string>
    races: number
    points: number
    positions: number
    top3: number
    tracks: Map<string, { points: number; races: number }>
  }
  const map = new Map<string, Acc>()

  for (const war of wars) {
    for (const race of war.races) {
      for (const res of race.results ?? []) {
        const key = res.profileId ? `id:${res.profileId}` : `name:${res.name.trim().toLowerCase()}`
        const acc = map.get(key) ?? {
          name: res.name,
          profileId: res.profileId,
          wars: new Set<string>(),
          races: 0,
          points: 0,
          positions: 0,
          top3: 0,
          tracks: new Map(),
        }
        const pts = pointsForPosition(res.position)
        acc.wars.add(war.id)
        acc.races += 1
        acc.points += pts
        acc.positions += res.position
        if (res.position <= 3) acc.top3 += 1
        const tr = acc.tracks.get(race.track_id) ?? { points: 0, races: 0 }
        tr.points += pts
        tr.races += 1
        acc.tracks.set(race.track_id, tr)
        map.set(key, acc)
      }
    }
  }

  const round = (n: number) => Number(n.toFixed(2))

  return [...map.entries()]
    .map(([key, a]) => {
      // Mejor pista: la de más puntos de media, con al menos 2 carreras si las hay
      const tracks = [...a.tracks.entries()].map(([trackId, t]) => ({
        trackId,
        avgPoints: round(t.points / t.races),
        races: t.races,
      }))
      const pool = tracks.some((t) => t.races >= 2) ? tracks.filter((t) => t.races >= 2) : tracks
      const ranked = [...pool].sort((x, y) => y.avgPoints - x.avgPoints || y.races - x.races)
      const bestTrack = ranked[0] ?? null
      // La peor: la de menos puntos de media; con una sola pista no hay "peor"
      const worst = [...pool].sort((x, y) => x.avgPoints - y.avgPoints || y.races - x.races)[0] ?? null
      const worstTrack = worst && bestTrack && worst.trackId !== bestTrack.trackId ? worst : null
      return {
        key,
        name: a.name,
        profileId: a.profileId,
        wars: a.wars.size,
        races: a.races,
        points: a.points,
        avgPoints: round(a.points / a.races),
        avgPos: round(a.positions / a.races),
        top3Rate: Math.round((a.top3 / a.races) * 100),
        bestTrack,
        worstTrack,
      }
    })
    .sort((x, y) => y.avgPoints - x.avgPoints || y.races - x.races)
}

/** War apuntada por el equipo rival, vista desde este equipo */
export type MirroredWar = TeamWar & {
  /** null = pendiente de confirmar, true = confirmada, false = rechazada */
  confirmed: boolean | null
}

type RawRace = TeamWarRace & { opponent_results: { name: string; position: number }[] | null }
type RawWar = Omit<TeamWar, 'races'> & { races: RawRace[]; opponent_confirmed: boolean | null }

/**
 * Da la vuelta a una war apuntada por el rival: sus posiciones pasan a ser las del rival,
 * y los rivales que apuntó (si los puso) pasan a ser nuestros jugadores (función pura).
 */
export function mirrorWar(war: RawWar): MirroredWar {
  // Los nombres por defecto ("CK 1"…"CK 6") no son jugadores reales: no cuentan en sus estadísticas
  const placeholders = new Set(
    [war.opponent_tag?.trim(), 'Away', 'Rival'].filter(Boolean).flatMap((tag) => [1, 2, 3, 4, 5, 6].map((n) => `${tag} ${n}`)),
  )
  return {
    id: war.id,
    team_id: war.opponent_team_id ?? 0,
    team_tag: war.opponent_tag,
    team_name: war.opponent_name,
    opponent_team_id: war.team_id,
    opponent_tag: war.team_tag,
    opponent_name: war.team_name,
    created_at: war.created_at,
    finished_at: war.finished_at,
    confirmed: war.opponent_confirmed,
    penalties: mirrorPenalties(war.penalties ?? []),
    races: war.races.map((r) => {
      const racers = 12 - r.missing_home - r.missing_away
      const taken = new Set(r.positions)
      return {
        track_id: r.track_id,
        race_no: r.race_no,
        missing_home: r.missing_away,
        missing_away: r.missing_home,
        positions: Array.from({ length: racers }, (_, i) => i + 1).filter((p) => !taken.has(p)),
        results: (r.opponent_results ?? [])
          .filter((o) => !placeholders.has(o.name))
          .map((o) => ({ name: o.name, profileId: null, position: o.position })),
      }
    }),
  }
}

const SAME_WAR_MS = 6 * 60 * 60 * 1000

/**
 * Junta las wars propias con las que apuntó el rival (función pura).
 * Si los dos equipos apuntaron la misma war (mismo rival, con menos de 6 h de diferencia) vale la propia.
 * Devuelve las que cuentan para las estadísticas y las que esperan confirmación.
 */
export function mergeTeamWars(own: TeamWar[], mirrored: MirroredWar[]): { wars: TeamWar[]; pending: MirroredWar[] } {
  const duplicated = (m: MirroredWar) =>
    own.some(
      (w) =>
        w.opponent_team_id === m.opponent_team_id &&
        Math.abs(Date.parse(w.created_at) - Date.parse(m.created_at)) < SAME_WAR_MS,
    )
  const fresh = mirrored.filter((m) => !duplicated(m))
  return {
    wars: [...own, ...fresh.filter((m) => m.confirmed === true)].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    pending: fresh.filter((m) => m.confirmed === null),
  }
}

/** Wars finalizadas de un equipo: las propias y las confirmadas que apuntó el rival */
export async function getTeamWars(teamId: number): Promise<TeamWar[]> {
  return (await getTeamWarsWithPending(teamId)).wars
}

/** Igual que getTeamWars, y además las wars del rival que este equipo aún no ha confirmado */
export async function getTeamWarsWithPending(teamId: number): Promise<{ wars: TeamWar[]; pending: MirroredWar[] }> {
  const [own, theirs] = await Promise.all([fetchWars('team_id', teamId), fetchWars('opponent_team_id', teamId)])
  // Las copias que subió este equipo al validar no se vuelven a invertir, y las wars que ya tienen copia propia tampoco
  const copied = new Set(own.map((w) => w.mirrorOf).filter(Boolean))
  const mirrored = theirs
    .filter((w) => w.team_id !== null && w.team_id !== teamId && !w.mirrorOf && !copied.has(w.id))
    .map(mirrorWar)
  return mergeTeamWars(own, mirrored)
}

/** Consulta en Supabase las wars finalizadas en las que un equipo es el que apunta o el rival */
async function fetchWars(column: 'team_id' | 'opponent_team_id', teamId: number): Promise<RawWar[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data: events, error: evError } = await supabase
    .from('events')
    .select(
      'id, team_id, team_tag, team_name, opponent_team_id, opponent_tag, opponent_name, created_at, finished_at, opponent_confirmed, penalties, mirror_of',
    )
    .eq(column, teamId)
    .eq('kind', 'war')
    .eq('status', 'finished')
    .order('created_at', { ascending: false })

  if (evError) throw evError
  if (!events || events.length === 0) return []

  const eventIds = events.map((e) => e.id as string)

  const [{ data: races, error: raceError }, { data: players, error: playerError }] = await Promise.all([
    supabase
      .from('event_races')
      .select('id, event_id, race_no, track_id, missing_home, missing_away, opponent_results, race_results(position, player_id)')
      .in('event_id', eventIds)
      .order('race_no', { ascending: true }),
    supabase.from('event_players').select('id, name, profile_id').in('event_id', eventIds),
  ])

  if (raceError) throw raceError
  if (playerError) throw playerError

  const playerById = new Map((players ?? []).map((p) => [p.id as number, p]))

  const racesByEvent = new Map<string, RawRace[]>()
  for (const r of races ?? []) {
    const list = racesByEvent.get(r.event_id as string) ?? []
    const results = (r.race_results as unknown as { position: number; player_id: number }[]) ?? []
    const opp = r.opponent_results as unknown
    list.push({
      track_id: r.track_id as string,
      race_no: r.race_no as number,
      missing_home: r.missing_home as number,
      missing_away: r.missing_away as number,
      positions: results.map((res) => res.position),
      results: results.map((res) => {
        const p = playerById.get(res.player_id)
        return {
          name: (p?.name as string | undefined) ?? '?',
          profileId: (p?.profile_id as string | null | undefined) ?? null,
          position: res.position,
        }
      }),
      // Campo libre: solo se usa si tiene la forma esperada
      opponent_results: Array.isArray(opp)
        ? opp.filter((x) => x && typeof x.name === 'string' && Number.isInteger(x.position)).slice(0, 12)
        : null,
    })
    racesByEvent.set(r.event_id as string, list)
  }

  return events.map((ev) => ({
    id: ev.id as string,
    team_id: ev.team_id as number,
    team_tag: ev.team_tag as string | null,
    team_name: ev.team_name as string | null,
    opponent_team_id: ev.opponent_team_id as number | null,
    opponent_tag: ev.opponent_tag as string | null,
    opponent_name: ev.opponent_name as string | null,
    created_at: ev.created_at as string,
    finished_at: ev.finished_at as string | null,
    opponent_confirmed: (ev.opponent_confirmed as boolean | null) ?? null,
    penalties: parsePenalties(ev.penalties),
    mirrorOf: (ev.mirror_of as string | null) ?? null,
    races: racesByEvent.get(ev.id as string) ?? [],
  }))
}
