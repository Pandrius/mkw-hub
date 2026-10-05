import type { EventDetail, EventKind } from '../events'
import { langFromLocale, msg, type BotLang, type BotMessageKey } from './messages.js'
import {
  RACES_PER_EVENT,
  findLineupSlot,
  findTrack,
  inGameName,
  isParseError,
  lineupPlayers,
  nextRaceNo,
  parseLoungePosition,
  parsePlayerList,
  parseWarPositions,
  trackChoices,
  type LineupPlayer,
} from './parse.js'
import { scoreboardEmbed } from './render.js'
import {
  EPHEMERAL,
  InteractionType,
  ResponseType,
  type CommandOption,
  type Embed,
  type Interaction,
  type InteractionResponse,
  type MessageData,
} from './types.js'

/**
 * Lógica de los comandos del bot. No sabe nada de HTTP ni de Supabase: recibe la interacción
 * ya verificada y un BotStore (en producción, src/lib/discord/store.ts; en los tests, uno falso).
 *
 * Evento activo: uno por canal de Discord (o MD con el bot). Así toda la war de un equipo se
 * lleva en su canal y cualquiera con permiso puede registrar carreras sin indicar el evento.
 */

export type TeamRef = { id: number; name: string; tag: string }

export type ActiveEvent = { eventId: string; lineup: number[] }

export type CreateEventArgs = {
  kind: EventKind
  teamTag: string
  opponentTag: string
  players: string[]
  teamId: number | null
  teamName: string | null
  opponentTeamId: number | null
  opponentName: string | null
}

/** Acceso a datos. `actor` es el id del perfil de MKW Hub de quien ejecuta el comando. */
export interface BotStore {
  profileForDiscord(discordUserId: string): Promise<string | null>
  getActive(channelId: string): Promise<ActiveEvent | null>
  setActive(channelId: string, active: ActiveEvent, startedBy: string): Promise<void>
  setLineup(channelId: string, lineup: number[]): Promise<void>
  getEvent(eventId: string): Promise<EventDetail | null>
  teamsOf(profileId: string): Promise<TeamRef[]>
  teamsByTag(tag: string): Promise<TeamRef[]>
  canEdit(actor: string, eventId: string): Promise<boolean>
  createEvent(actor: string, args: CreateEventArgs): Promise<string>
  addPlayer(actor: string, eventId: string, entry: string): Promise<number>
  saveRace(
    actor: string,
    eventId: string,
    raceNo: number,
    trackId: string,
    results: { player_id: number; position: number }[],
    missingHome: number,
    missingAway: number,
  ): Promise<void>
  finishEvent(actor: string, eventId: string): Promise<void>
}

export type BotOptions = { siteUrl: string }

type Ctx = { i: Interaction; store: BotStore; lang: BotLang; siteUrl: string }

/** Error que se muestra tal cual al usuario (mensaje efímero) */
class UserError extends Error {
  readonly key: BotMessageKey
  readonly vars?: Record<string, string | number>
  constructor(key: BotMessageKey, vars?: Record<string, string | number>) {
    super(key)
    this.key = key
    this.vars = vars
  }
}

const NO_MENTIONS = { parse: [] as string[] }

export const reply = (data: MessageData, ephemeral = false): InteractionResponse => ({
  type: ResponseType.ChannelMessage,
  data: { allowed_mentions: NO_MENTIONS, ...data, ...(ephemeral ? { flags: EPHEMERAL } : {}) },
})

const update = (data: MessageData): InteractionResponse => ({
  type: ResponseType.UpdateMessage,
  data: { allowed_mentions: NO_MENTIONS, components: [], ...data },
})

/** Traduce los errores de la base de datos (create_event, save_race…) a un texto para el usuario. */
export function errorText(lang: BotLang, error: unknown): string {
  if (error instanceof UserError) return msg(lang, error.key, error.vars)
  const m = error instanceof Error ? error.message : String(error)
  if (/could not find the (function|table)|schema cache|does not exist/i.test(m)) return msg(lang, 'notConfigured')
  if (/^forbidden/i.test(m)) return msg(lang, 'forbidden')
  if (/has no races/i.test(m)) return msg(lang, 'finishNoRaces')
  // Solo los errores pensados para el usuario ("invalid: …") se muestran tal cual; el resto, genérico
  if (/^invalid:/i.test(m)) return msg(lang, 'error', { message: m.replace(/^invalid:\s*/i, '') })
  return msg(lang, 'unexpected')
}

/** Opciones del comando (o del subcomando) como objeto nombre → valor */
function optionsOf(options: CommandOption[] | undefined): Record<string, string | number | boolean | undefined> {
  const out: Record<string, string | number | boolean | undefined> = {}
  for (const o of options ?? []) out[o.name] = o.value
  return out
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
const int = (v: unknown) => (typeof v === 'number' ? v : undefined)
const discordUserId = (i: Interaction) => i.member?.user.id ?? i.user?.id

async function requireActor({ i, store, siteUrl }: Ctx): Promise<string> {
  const id = discordUserId(i)
  const actor = id ? await store.profileForDiscord(id) : null
  if (!actor) throw new UserError('notLinked', { site: siteUrl })
  return actor
}

function requireChannel({ i }: Ctx): string {
  if (!i.channel_id) throw new UserError('noChannel')
  return i.channel_id
}

/** Evento activo del canal con sus datos; error si no hay o (con mustBeOpen) si ya está finalizado */
async function requireEvent(ctx: Ctx, mustBeOpen: boolean): Promise<{ active: ActiveEvent; detail: EventDetail }> {
  const active = await ctx.store.getActive(requireChannel(ctx))
  const detail = active ? await ctx.store.getEvent(active.eventId) : null
  if (!active || !detail) throw new UserError('noEvent')
  if (mustBeOpen && detail.event.status !== 'open') throw new UserError('eventFinished')
  return { active, detail }
}

const boardFor = (ctx: Ctx, detail: EventDetail, lineup: LineupPlayer[]): Embed =>
  scoreboardEmbed(detail, ctx.lang, ctx.siteUrl, lineup)

// --- /evento iniciar ----------------------------------------------------------------------------
async function startEvent(ctx: Ctx, opts: Record<string, unknown>): Promise<InteractionResponse> {
  const channel = requireChannel(ctx)
  const kind: EventKind = opts.tipo === 'lounge' ? 'lounge' : 'war'
  const players = parsePlayerList(str(opts.jugadores))
  if (kind === 'war' && players.length !== 6) throw new UserError('warNeedsSix', { n: players.length })

  const [actor, current] = await Promise.all([requireActor(ctx), ctx.store.getActive(channel)])
  if (current && opts.forzar !== true) {
    const old = await ctx.store.getEvent(current.eventId)
    if (old?.event.status === 'open') throw new UserError('eventOpenHere')
  }
  // Forzar solo puede quien también puede editar el evento abierto que se sustituye
  if (current && opts.forzar === true && !(await ctx.store.canEdit(actor, current.eventId))) {
    const old = await ctx.store.getEvent(current.eventId)
    if (old?.event.status === 'open') throw new UserError('forbidden')
  }

  const args: CreateEventArgs = {
    kind,
    teamTag: '',
    opponentTag: '',
    players,
    teamId: null,
    teamName: null,
    opponentTeamId: null,
    opponentName: null,
  }
  if (kind === 'war') {
    // Como en la web: por defecto, el primer equipo del usuario; con tag, el suyo que coincida
    const tag = str(opts.tag)?.trim() ?? ''
    const rival = str(opts.rival)?.trim() ?? ''
    const [mine, rivals] = await Promise.all([ctx.store.teamsOf(actor), rival ? ctx.store.teamsByTag(rival) : []])
    const team = tag ? mine.find((t) => t.tag.toLowerCase() === tag.toLowerCase()) : mine[0]
    const opponent = rivals.length === 1 && rivals[0].id !== team?.id ? rivals[0] : undefined
    Object.assign(args, {
      teamTag: tag || team?.tag || '',
      opponentTag: rival,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      opponentTeamId: opponent?.id ?? null,
      opponentName: opponent?.name ?? null,
    })
  }

  const eventId = await ctx.store.createEvent(actor, args)
  const detail = await ctx.store.getEvent(eventId)
  if (!detail) throw new UserError('noEvent')
  const lineup = kind === 'war' ? lineupPlayers([], detail.players) : []
  await ctx.store.setActive(channel, { eventId, lineup: lineup.map((p) => p.id) }, actor)
  return reply({
    content: msg(ctx.lang, 'started', { kind: kind === 'war' ? 'War' : 'Lounge' }),
    embeds: [boardFor(ctx, detail, lineup)],
  })
}

// --- /evento ver --------------------------------------------------------------------------------
async function showEvent(ctx: Ctx): Promise<InteractionResponse> {
  const { active, detail } = await requireEvent(ctx, false)
  return reply({ embeds: [boardFor(ctx, detail, lineupPlayers(active.lineup, detail.players))] })
}

// --- /evento finalizar (con confirmación por botones) -------------------------------------------
async function askFinish(ctx: Ctx): Promise<InteractionResponse> {
  const actor = await requireActor(ctx)
  const { detail } = await requireEvent(ctx, true)
  if (detail.races.length === 0) throw new UserError('finishNoRaces')
  if (!(await ctx.store.canEdit(actor, detail.event.id))) throw new UserError('forbidden')
  return reply({
    content: msg(ctx.lang, 'finishConfirm'),
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 4, label: msg(ctx.lang, 'finishYes'), custom_id: `finish:${detail.event.id}` },
          { type: 2, style: 2, label: msg(ctx.lang, 'finishNo'), custom_id: `cancel:${detail.event.id}` },
        ],
      },
    ],
  })
}

async function onButton(ctx: Ctx): Promise<InteractionResponse> {
  const [action, eventId] = (ctx.i.data?.custom_id ?? '').split(':')
  if (action === 'cancel') return update({ content: msg(ctx.lang, 'finishCancelled') })
  if (action !== 'finish' || !eventId) throw new UserError('unknownCommand')
  const actor = await requireActor(ctx)
  await ctx.store.finishEvent(actor, eventId)
  const detail = await ctx.store.getEvent(eventId)
  return update({ content: msg(ctx.lang, 'finished'), embeds: detail ? [boardFor(ctx, detail, [])] : [] })
}

// --- /carrera y /corregir -----------------------------------------------------------------------
async function saveRace(ctx: Ctx, opts: Record<string, unknown>, fix: boolean): Promise<InteractionResponse> {
  const [actor, { active, detail }] = await Promise.all([requireActor(ctx), requireEvent(ctx, true)])
  const track = findTrack(str(opts.pista))
  if (!track) throw new UserError('unknownTrack', { track: str(opts.pista) ?? '' })

  const given = int(opts.numero)
  const raceNo = given ?? nextRaceNo(detail.races)
  if (raceNo > RACES_PER_EVENT) throw new UserError(given ? 'raceNoRange' : 'eventFull')
  if (raceNo < 1) throw new UserError('raceNoRange')

  const isWar = detail.event.kind === 'war'
  const missingAway = isWar ? (int(opts.faltan_rival) ?? 0) : 0
  const lineup = lineupPlayers(active.lineup, detail.players)
  const positions = str(opts.posiciones) ?? ''
  const parsed = isWar
    ? parseWarPositions(positions, lineup, detail.players, missingAway)
    : parseLoungePosition(positions, detail.players[0]?.id ?? 0)
  if (isParseError(parsed)) throw new UserError(parsed.error, parsed.vars)

  const existed = detail.races.some((r) => r.race_no === raceNo)
  await ctx.store.saveRace(actor, detail.event.id, raceNo, track.id, parsed.results, parsed.missingHome, missingAway)
  const updated = (await ctx.store.getEvent(detail.event.id)) ?? detail
  return reply({
    content: msg(ctx.lang, fix || existed ? 'raceFixed' : 'raceSaved', { n: raceNo, track: `${track.abbr} · ${track.name}` }),
    embeds: [boardFor(ctx, updated, lineup)],
  })
}

// --- /sub ---------------------------------------------------------------------------------------
async function substitute(ctx: Ctx, opts: Record<string, unknown>): Promise<InteractionResponse> {
  const [actor, { detail, active }] = await Promise.all([requireActor(ctx), requireEvent(ctx, true)])
  if (detail.event.kind !== 'war') throw new UserError('subWarOnly')

  const lineup = lineupPlayers(active.lineup, detail.players)
  const out = str(opts.sale) ?? ''
  const slot = findLineupSlot(lineup, out)
  if (slot < 0) throw new UserError('subUnknownOut', { name: out })

  const entry = (str(opts.entra) ?? '').trim()
  const name = inGameName(entry)
  const known = detail.players.find((p) => p.name.toLowerCase() === name.toLowerCase())
  if (known && lineup.some((p) => p.id === known.id)) throw new UserError('subAlreadyIn', { name: known.name })
  if (!(await ctx.store.canEdit(actor, detail.event.id))) throw new UserError('forbidden')

  // Si ya jugó antes en este evento se reutiliza; si no, se añade como sustituto
  const incoming = known ?? { id: await ctx.store.addPlayer(actor, detail.event.id, entry), name }
  const newLineup = lineup.map((p, i) => (i === slot ? incoming : p))
  await ctx.store.setLineup(requireChannel(ctx), newLineup.map((p) => p.id))
  return reply({
    content: msg(ctx.lang, 'subDone', { out: lineup[slot].name, in: incoming.name }),
    embeds: [boardFor(ctx, detail, newLineup)],
  })
}

// --- Autocompletado -----------------------------------------------------------------------------
async function autocomplete(ctx: Ctx): Promise<InteractionResponse> {
  const all = [...(ctx.i.data?.options ?? []), ...(ctx.i.data?.options ?? []).flatMap((o) => o.options ?? [])]
  const focused = all.find((o) => o.focused)
  let choices: { name: string; value: string }[] = []
  if (focused?.name === 'pista') choices = trackChoices(str(focused.value))
  if (focused?.name === 'sale' && ctx.i.channel_id) {
    try {
      const { active, detail } = await requireEvent(ctx, false)
      const q = (str(focused.value) ?? '').toLowerCase()
      choices = lineupPlayers(active.lineup, detail.players)
        .filter((p) => p.name.toLowerCase().includes(q))
        .map((p) => ({ name: p.name, value: p.name }))
    } catch {
      choices = []
    }
  }
  return { type: ResponseType.AutocompleteResult, data: { choices: choices.slice(0, 25) } }
}

/** Punto de entrada: interacción verificada → respuesta para Discord. Nunca lanza. */
export async function handleInteraction(i: Interaction, store: BotStore, options: BotOptions): Promise<InteractionResponse> {
  const ctx: Ctx = { i, store, lang: langFromLocale(i.locale), siteUrl: options.siteUrl }
  try {
    switch (i.type) {
      case InteractionType.Ping:
        return { type: ResponseType.Pong }
      case InteractionType.Autocomplete:
        return await autocomplete(ctx)
      case InteractionType.MessageComponent:
        return await onButton(ctx)
      case InteractionType.ApplicationCommand:
        break
      default:
        throw new UserError('unknownCommand')
    }

    const name = i.data?.name
    const top = i.data?.options ?? []
    if (name === 'evento') {
      const sub = top[0]
      if (sub?.name === 'iniciar') return await startEvent(ctx, optionsOf(sub.options))
      if (sub?.name === 'ver') return await showEvent(ctx)
      if (sub?.name === 'finalizar') return await askFinish(ctx)
    }
    if (name === 'carrera') return await saveRace(ctx, optionsOf(top), false)
    if (name === 'corregir') return await saveRace(ctx, optionsOf(top), true)
    if (name === 'sub') return await substitute(ctx, optionsOf(top))
    throw new UserError('unknownCommand')
  } catch (error) {
    if (!(error instanceof UserError)) console.error('discord bot:', error)
    if (i.type === InteractionType.Autocomplete) return { type: ResponseType.AutocompleteResult, data: { choices: [] } }
    return reply({ content: errorText(ctx.lang, error) }, true)
  }
}
