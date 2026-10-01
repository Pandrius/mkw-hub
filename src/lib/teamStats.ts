import { scoreTeamRace } from './scoring'
import { supabase } from './supabase'

export type TeamWarRace = {
  track_id: string
  race_no: number
  missing_home: number
  missing_away: number
  positions: number[]
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

/** Consulta en Supabase las wars finalizadas registradas para un equipo dado */
export async function getTeamWars(teamId: number): Promise<TeamWar[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data: events, error: evError } = await supabase
    .from('events')
    .select('id, team_id, team_tag, team_name, opponent_team_id, opponent_tag, opponent_name, created_at, finished_at')
    .eq('team_id', teamId)
    .eq('kind', 'war')
    .eq('status', 'finished')
    .order('created_at', { ascending: false })

  if (evError) throw evError
  if (!events || events.length === 0) return []

  const eventIds = events.map((e) => e.id as string)

  const { data: races, error: raceError } = await supabase
    .from('event_races')
    .select('id, event_id, race_no, track_id, missing_home, missing_away, race_results(position)')
    .in('event_id', eventIds)
    .order('race_no', { ascending: true })

  if (raceError) throw raceError

  const racesByEvent = new Map<string, TeamWarRace[]>()
  for (const r of races ?? []) {
    const list = racesByEvent.get(r.event_id as string) ?? []
    const results = (r.race_results as unknown as { position: number }[]) ?? []
    list.push({
      track_id: r.track_id as string,
      race_no: r.race_no as number,
      missing_home: r.missing_home as number,
      missing_away: r.missing_away as number,
      positions: results.map((res) => res.position),
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
    races: racesByEvent.get(ev.id as string) ?? [],
  }))
}
