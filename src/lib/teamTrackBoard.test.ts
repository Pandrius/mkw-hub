import { describe, expect, it } from 'vitest'
import { buildTeamTrackBoards, raceDiff, TEAM_MIN_RACES, type TeamWarInput } from './teamTrackBoard'

const teams = new Map([
  [1, { tag: 'NEB', name: 'Nebulosa' }],
  [2, { tag: 'RKL', name: 'Rival' }],
])
// Un equipo que queda 1.º a 6.º en la carrera: 15+12+10+9+8+7 = 61 frente a 21 → +40
const WIN = [1, 2, 3, 4, 5, 6]
const war = (id: string, races: number, extra: Partial<TeamWarInput> = {}, positions = WIN): TeamWarInput => ({
  id,
  teamId: 1,
  opponentTeamId: 2,
  mirrorOf: null,
  races: Array.from({ length: races }, () => ({ trackId: 'rr', section: false, missingHome: 0, missingAway: 0, positions })),
  ...extra,
})

describe('raceDiff', () => {
  it('puntos propios menos los del rival, con ausentes', () => {
    expect(raceDiff({ missingHome: 0, missingAway: 0, positions: WIN })).toBe(61 - 21)
    expect(raceDiff({ missingHome: 1, missingAway: 0, positions: [1, 2, 3, 4, 5] })).toBe(1 + 15 + 12 + 10 + 9 + 8 - (7 + 6 + 5 + 4 + 3 + 2))
  })
})

describe('buildTeamTrackBoards', () => {
  it('pide un mínimo de carreras del equipo en la pista', () => {
    expect(buildTeamTrackBoards([war('a', TEAM_MIN_RACES - 1)], teams).rr).toBeUndefined()
    expect(buildTeamTrackBoards([war('a', TEAM_MIN_RACES)], teams).rr?.[0]).toMatchObject({ teamId: 1, tag: 'NEB', races: TEAM_MIN_RACES, avg: 40 })
  })

  it('la war también cuenta para el rival registrado, al revés, y una sola vez si subió su copia', () => {
    const board = buildTeamTrackBoards([war('a', 4)], teams).rr
    expect(board?.map((e) => [e.teamId, e.avg])).toEqual([[1, 40], [2, -40]])
    // El rival sube su copia: cada equipo cuenta solo con su propia versión
    const withCopy = buildTeamTrackBoards([war('a', 4), war('b', 4, { teamId: 2, opponentTeamId: 1, mirrorOf: 'a' }, [7, 8, 9, 10, 11, 12])], teams).rr
    expect(withCopy?.find((e) => e.teamId === 1)?.races).toBe(4)
    expect(withCopy?.find((e) => e.teamId === 2)?.races).toBe(4)
  })

  it('con pocas carreras el +/- se acerca a 0: muchas carreras buenas superan a pocas muy buenas', () => {
    const wars = [war('a', 3, { opponentTeamId: null }), war('b', 12, { teamId: 2, opponentTeamId: null }, [1, 2, 3, 4, 5, 7])]
    const board = buildTeamTrackBoards(wars, teams).rr!
    expect(board[0].teamId).toBe(2) // 12 carreras de +38 pesan más que 3 de +40
  })

  it('los tramos y los equipos sin registrar no cuentan', () => {
    const section = war('a', 5, {}, WIN)
    section.races.forEach((r) => (r.section = true))
    expect(buildTeamTrackBoards([section], teams).rr).toBeUndefined()
    expect(buildTeamTrackBoards([war('x', 5, { teamId: 99, opponentTeamId: null })], teams).rr).toBeUndefined()
  })
})
