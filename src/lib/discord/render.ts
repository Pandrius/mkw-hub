import { getTrack } from '../../data/tracks.js'
import type { EventDetail } from '../events'
import { buildWarTable, lorenziEditorUrl, lorenziText } from '../warTable.js'
import { msg, type BotLang } from './messages.js'
import type { Embed, EmbedField } from './types.js'
import { RACES_PER_EVENT, type LineupPlayer } from './parse.js'

/** Construcción de los embeds del marcador (lógica pura). */

const COLOR_WIN = 0x2fd07a
const COLOR_LOSE = 0xff3b3b
const COLOR_TIE = 0xc0c6dc
/** Límites de Discord para el texto de un campo y la URL de un embed */
const FIELD_MAX = 1024
const URL_MAX = 2048

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
const trackLabel = (id: string) => getTrack(id)?.abbr ?? id
/** Bloque de código monoespaciado; si no cabe, se quitan líneas del principio (las más antiguas) */
const code = (lines: string[]) => {
  let shown = lines
  while (shown.join('\n').length + 8 > FIELD_MAX && shown.length > 1) shown = shown.slice(1)
  return '```\n' + shown.join('\n') + '\n```'
}
const ordinal = (lang: BotLang, n: number) => {
  if (lang === 'es') return `${n}.º`
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`
}

export function eventUrl(siteUrl: string, eventId: string): string {
  return `${siteUrl.replace(/\/$/, '')}/eventos/${eventId}`
}

/** Marcador de una war: totales, carreras, puntos por jugador y alineación actual. */
function warEmbed(detail: EventDetail, lang: BotLang, siteUrl: string, lineup: LineupPlayer[]): Embed {
  const { event, players, races } = detail
  const table = buildWarTable(players, races, event.opponent_players)
  const home = event.team_tag || 'Home'
  const away = event.opponent_tag || 'Away'
  const last = table.races.at(-1)

  const fields: EmbedField[] = []
  if (table.races.length > 0) {
    fields.push({
      name: msg(lang, 'races'),
      value: code(
        table.races.map(
          (r) =>
            `${String(r.race.race_no).padStart(2)} ${trackLabel(r.race.track_id).padEnd(5)} ${String(r.home).padStart(2)}-${String(r.away).padStart(2)} ${signed(r.diff).padStart(4)} ${signed(r.runningDiff).padStart(5)}`,
        ),
      ),
    })
    const nameWidth = Math.min(16, Math.max(...table.players.map((p) => p.player.name.length), 4))
    const playerLines = table.players.map((p) => {
      const perRace = Object.keys(p.positions)
        .map(Number)
        .sort((a, b) => a - b)
        .map((no) => p.positions[no])
        .join(' ')
      return `${p.player.name.slice(0, nameWidth).padEnd(nameWidth)} ${String(p.points).padStart(3)}  ${perRace}`
    })
    if (table.missingPoints) playerLines.push(`${'DC'.padEnd(nameWidth)} ${String(table.missingPoints).padStart(3)}`)
    fields.push({ name: msg(lang, 'players'), value: code(playerLines) })
  } else {
    fields.push({ name: msg(lang, 'races'), value: msg(lang, 'noRaces') })
  }

  if (event.status === 'open' && lineup.length > 0) {
    fields.push({ name: msg(lang, 'lineup'), value: lineup.map((p, i) => `${i + 1}. ${p.name}`).join('\n').slice(0, FIELD_MAX) })
  }

  if (event.status === 'finished' && table.races.length > 0) {
    const link = lorenziEditorUrl(lorenziText(home, away, table))
    if (link.length <= FIELD_MAX - 40) fields.push({ name: msg(lang, 'lorenzi'), value: `[${msg(lang, 'lorenzi')}](${link})` })
  }

  const status = msg(lang, event.status === 'open' ? 'statusOpen' : 'statusFinished')
  const url = eventUrl(siteUrl, event.id)
  return {
    title: `${home} ${table.home} – ${table.away} ${away} (${signed(table.diff)})`,
    description: last
      ? `${msg(lang, 'race')} ${last.race.race_no}/${RACES_PER_EVENT} · ${getTrack(last.race.track_id)?.name ?? last.race.track_id} · ${status}`
      : `War · ${status}`,
    url: url.length <= URL_MAX ? url : undefined,
    color: table.diff > 0 ? COLOR_WIN : table.diff < 0 ? COLOR_LOSE : COLOR_TIE,
    fields,
    footer: { text: msg(lang, 'web') },
  }
}

/** Resumen de un lounge: posición en cada carrera y media. */
function loungeEmbed(detail: EventDetail, lang: BotLang, siteUrl: string): Embed {
  const { event, players, races } = detail
  const name = players[0]?.name ?? 'Lounge'
  const rows = [...races].sort((a, b) => a.race_no - b.race_no)
  const positions = rows.flatMap((r) => r.race_results.map((x) => x.position))
  const avg = positions.length ? (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(2) : '–'
  const status = msg(lang, event.status === 'open' ? 'statusOpen' : 'statusFinished')
  return {
    title: `Lounge · ${name}`,
    description: `${msg(lang, 'average', { avg })} · ${status}`,
    url: eventUrl(siteUrl, event.id),
    color: COLOR_TIE,
    fields: [
      {
        name: msg(lang, 'races'),
        value: rows.length
          ? code(
              rows.map(
                (r) =>
                  `${String(r.race_no).padStart(2)} ${trackLabel(r.track_id).padEnd(5)} ${r.race_results[0] ? ordinal(lang, r.race_results[0].position) : '–'}`,
              ),
            )
          : msg(lang, 'noRaces'),
      },
    ],
    footer: { text: msg(lang, 'web') },
  }
}

export function scoreboardEmbed(
  detail: EventDetail,
  lang: BotLang,
  siteUrl: string,
  lineup: LineupPlayer[] = [],
): Embed {
  return detail.event.kind === 'war' ? warEmbed(detail, lang, siteUrl, lineup) : loungeEmbed(detail, lang, siteUrl)
}
