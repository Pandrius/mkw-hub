import { describe, expect, it } from 'vitest'
import type { EventDetail, EventPlayer, EventRace } from '../events'
import { handleInteraction, type ActiveEvent, type BotStore, type CreateEventArgs } from './bot'
import { EPHEMERAL, InteractionType, ResponseType, type CommandOption, type Interaction } from './types'

/** BotStore en memoria: lo justo para recorrer una war completa sin base de datos */
function memoryStore(linked: Record<string, string> = { '111': 'profile-1' }) {
  const active = new Map<string, ActiveEvent>()
  const events = new Map<string, EventDetail>()
  let nextPlayer = 1
  let nextRace = 1

  const store: BotStore = {
    profileForDiscord: async (id) => linked[id] ?? null,
    getActive: async (channel) => active.get(channel) ?? null,
    setActive: async (channel, a) => void active.set(channel, a),
    setLineup: async (channel, lineup) => void active.set(channel, { ...active.get(channel)!, lineup }),
    getEvent: async (id) => structuredClone(events.get(id) ?? null),
    teamsOf: async () => [{ id: 10, name: 'MKW Hub', tag: 'MKH' }],
    teamsByTag: async (tag) => (tag.toLowerCase() === 'abc' ? [{ id: 20, name: 'Alphabet', tag: 'ABC' }] : []),
    canEdit: async (actor, id) => events.get(id)?.event.created_by === actor && events.get(id)?.event.status === 'open',
    async createEvent(actor, a: CreateEventArgs) {
      const id = `ev-${events.size + 1}`
      const players: EventPlayer[] = a.players.map((entry) => ({
        id: nextPlayer++,
        event_id: id,
        name: entry.includes('=') ? entry.split('=')[1].trim() : entry,
        profile_id: null,
      }))
      events.set(id, {
        event: {
          id,
          kind: a.kind,
          status: 'open',
          team_tag: a.teamTag,
          team_name: a.teamName,
          team_id: a.teamId,
          opponent_tag: a.opponentTag,
          opponent_name: a.opponentName,
          opponent_team_id: a.opponentTeamId,
          opponent_players: null,
          created_by: actor,
          created_at: '2026-10-05T20:00:00Z',
          finished_at: null,
        },
        players,
        races: [],
      })
      return id
    },
    async addPlayer(_actor, id, entry) {
      const p = { id: nextPlayer++, event_id: id, name: entry, profile_id: null }
      events.get(id)!.players.push(p)
      return p.id
    },
    async saveRace(_actor, id, raceNo, trackId, results, missingHome, missingAway) {
      const ev = events.get(id)!
      const race: EventRace = { id: nextRace++, race_no: raceNo, track_id: trackId, missing_home: missingHome, missing_away: missingAway, race_results: results }
      ev.races = [...ev.races.filter((r) => r.race_no !== raceNo), race].sort((a, b) => a.race_no - b.race_no)
    },
    async finishEvent(_actor, id) {
      const ev = events.get(id)!
      if (ev.races.length === 0) throw new Error('invalid: event has no races')
      ev.event.status = 'finished'
    },
  }
  return { store, events, active }
}

const opt = (name: string, value: string | number | boolean): CommandOption => ({ name, type: 3, value })

function command(name: string, options: CommandOption[], user = '111'): Interaction {
  return { type: InteractionType.ApplicationCommand, channel_id: '999', locale: 'es-ES', member: { user: { id: user } }, data: { name, options } }
}

const evento = (sub: string, options: CommandOption[] = [], user?: string) =>
  command('evento', [{ name: sub, type: 1, options }], user)

const SITE = { siteUrl: 'https://mkw-hub.vercel.app' }
const PLAYERS = 'Peckmat = tortelini, Bob, Carl, Dan, Eve, Fay'

describe('handleInteraction', () => {
  it('responde PONG al PING', async () => {
    const { store } = memoryStore()
    expect(await handleInteraction({ type: InteractionType.Ping }, store, SITE)).toEqual({ type: ResponseType.Pong })
  })

  it('una war completa: iniciar, carrera, sub, corregir y finalizar', async () => {
    const { store, events } = memoryStore()

    const start = await handleInteraction(evento('iniciar', [opt('tipo', 'war'), opt('jugadores', PLAYERS), opt('rival', 'abc')]), store, SITE)
    expect(start).toMatchObject({ type: ResponseType.ChannelMessage, data: { content: expect.stringContaining('War iniciada') } })
    const ev = events.get('ev-1')!
    expect(ev.event).toMatchObject({ team_tag: 'MKH', team_id: 10, opponent_tag: 'abc', opponent_team_id: 20 })

    const race1 = await handleInteraction(command('carrera', [opt('pista', 'rdkp'), opt('posiciones', '1 2 3 4 5 6')]), store, SITE)
    expect(race1).toMatchObject({ data: { content: expect.stringContaining('Carrera 1 guardada') } })
    expect(race1).toMatchObject({ data: { embeds: [{ title: expect.stringContaining('MKH 61 – 21 abc (+40)') }] } })

    const sub = await handleInteraction(command('sub', [opt('sale', 'Fay'), opt('entra', 'Gus')]), store, SITE)
    expect(sub).toMatchObject({ data: { content: 'Sustitución: sale Fay, entra Gus.' } })

    // Gus ocupa el hueco 6 de la alineación
    await handleInteraction(command('carrera', [opt('pista', 'CC'), opt('posiciones', '7 8 9 10 11 12')]), store, SITE)
    const gus = events.get('ev-1')!.players.find((p) => p.name === 'Gus')!
    expect(events.get('ev-1')!.races[1].race_results).toContainEqual({ player_id: gus.id, position: 12 })

    const fix = await handleInteraction(command('corregir', [{ ...opt('numero', 2), type: 4 }, opt('pista', 'CC'), opt('posiciones', '1 2 3 4 5 x')]), store, SITE)
    expect(fix).toMatchObject({ data: { content: expect.stringContaining('Carrera 2 corregida') } })
    expect(events.get('ev-1')!.races[1].missing_home).toBe(1)

    const ask = await handleInteraction(evento('finalizar'), store, SITE)
    expect(ask).toMatchObject({ data: { components: [{ components: [{ custom_id: 'finish:ev-1' }, { custom_id: 'cancel:ev-1' }] }] } })
    const done = await handleInteraction(
      { type: InteractionType.MessageComponent, channel_id: '999', member: { user: { id: '111' } }, data: { custom_id: 'finish:ev-1' } },
      store,
      SITE,
    )
    expect(done).toMatchObject({ type: ResponseType.UpdateMessage })
    expect(events.get('ev-1')!.event.status).toBe('finished')
  })

  it('errores para el usuario como mensajes efímeros', async () => {
    const { store } = memoryStore()
    const notLinked = await handleInteraction(evento('iniciar', [opt('tipo', 'lounge')], '222'), store, SITE)
    expect(notLinked).toMatchObject({ data: { flags: EPHEMERAL, content: expect.stringContaining('No encuentro tu cuenta') } })

    const noEvent = await handleInteraction(command('carrera', [opt('pista', 'CC'), opt('posiciones', '3')]), store, SITE)
    expect(noEvent).toMatchObject({ data: { flags: EPHEMERAL, content: expect.stringContaining('No hay ningún evento') } })

    const fewPlayers = await handleInteraction(evento('iniciar', [opt('tipo', 'war'), opt('jugadores', 'A, B')]), store, SITE)
    expect(fewPlayers).toMatchObject({ data: { flags: EPHEMERAL, content: expect.stringContaining('6 jugadores') } })
  })

  it('no deja abrir otro evento en el canal sin forzar', async () => {
    const { store } = memoryStore()
    await handleInteraction(evento('iniciar', [opt('tipo', 'lounge'), opt('jugadores', 'tortelini')]), store, SITE)
    const again = await handleInteraction(evento('iniciar', [opt('tipo', 'lounge')]), store, SITE)
    expect(again).toMatchObject({ data: { flags: EPHEMERAL, content: expect.stringContaining('Ya hay un evento abierto') } })
    const forced = await handleInteraction(evento('iniciar', [opt('tipo', 'lounge'), opt('forzar', true)]), store, SITE)
    expect(forced).toMatchObject({ data: { content: expect.stringContaining('Lounge iniciada') } })
  })

  it('autocompleta pistas', async () => {
    const { store } = memoryStore()
    const res = await handleInteraction(
      { type: InteractionType.Autocomplete, data: { name: 'carrera', options: [{ name: 'pista', type: 3, value: 'dkp', focused: true }] } },
      store,
      SITE,
    )
    expect(res).toMatchObject({ type: ResponseType.AutocompleteResult, data: { choices: [{ value: 'rDKP' }] } })
  })
})
