import { format } from '../../i18n/format.js'

/**
 * Textos del bot en español e inglés. El idioma sale del `locale` de Discord de quien
 * ejecuta el comando (es-ES, es-419 → español; el resto → inglés).
 */
const es = {
  notLinked:
    'No encuentro tu cuenta de MKW Hub. Inicia sesión una vez con Discord en {site} y vuelve a intentarlo.',
  noChannel: 'Este comando solo funciona en un canal o en MD con el bot.',
  noEvent: 'No hay ningún evento en este canal. Empieza uno con `/evento iniciar`.',
  eventFinished: 'El evento de este canal ya está finalizado. Empieza otro con `/evento iniciar`.',
  eventOpenHere:
    'Ya hay un evento abierto en este canal. Finalízalo con `/evento finalizar` o usa `forzar: True` para empezar otro.',
  warNeedsSix: 'Una war necesita exactamente 6 jugadores separados por comas (tienes {n}).',
  started: '{kind} iniciada. Registra las carreras con `/carrera`.',
  unknownTrack: 'No reconozco la pista «{track}». Usa la abreviatura (rDKP, CC, RR…).',
  raceNoRange: 'El número de carrera debe estar entre 1 y 12.',
  eventFull: 'El evento ya tiene 12 carreras. Usa `/corregir` o `/evento finalizar`.',
  raceSaved: 'Carrera {n} guardada: {track}.',
  raceFixed: 'Carrera {n} corregida: {track}.',
  posEmpty: 'Escribe las posiciones.',
  posBadToken: '«{token}» no es una posición válida.',
  posCount: 'Hay {n} posiciones pero la alineación tiene {lineup} jugadores (usa x para un ausente).',
  posMissing: 'Como máximo puede haber 2 ausentes en tu equipo.',
  posTotalMissing: 'Entre los dos equipos solo pueden faltar 2 jugadores.',
  posRange: 'La posición {pos} no es válida en una carrera de {racers} jugadores.',
  posRepeated: 'La posición {pos} está repetida.',
  posUnknownPlayer: 'No hay ningún jugador «{name}» en este evento.',
  posRepeatedPlayer: '{name} aparece dos veces.',
  posLounge: 'En un lounge escribe solo tu posición (1-24).',
  subWarOnly: 'Las sustituciones solo existen en las wars.',
  subUnknownOut: '«{name}» no está en la alineación actual.',
  subAlreadyIn: '{name} ya está en la alineación.',
  subDone: 'Sustitución: sale {out}, entra {in}.',
  forbidden: 'No puedes modificar este evento (está finalizado o no eres creador, jugador ni miembro del equipo).',
  notConfigured: 'El bot todavía no está configurado en la base de datos (falta la migración 0012).',
  error: 'No se ha podido completar: {message}',
  finishConfirm: '¿Finalizar el evento? Después quedará bloqueado y contará en las estadísticas.',
  finishYes: 'Finalizar',
  finishNo: 'Cancelar',
  finishCancelled: 'Finalización cancelada.',
  finished: 'Evento finalizado.',
  finishNoRaces: 'El evento no tiene ninguna carrera todavía.',
  unknownCommand: 'Comando desconocido.',
  lineup: 'Alineación (orden de las posiciones)',
  races: 'Carreras',
  players: 'Jugadores',
  race: 'Carrera',
  noRaces: 'Todavía no hay carreras.',
  average: 'Posición media: {avg}',
  web: 'Ver en MKW Hub',
  lorenzi: 'Tabla en Lorenzi',
  statusOpen: 'abierto',
  statusFinished: 'finalizado',
  absent: 'ausente',
}

type Messages = Record<keyof typeof es, string>

const en: Messages = {
  notLinked: "I can't find your MKW Hub account. Sign in once with Discord at {site} and try again.",
  noChannel: 'This command only works in a channel or in DMs with the bot.',
  noEvent: 'There is no event in this channel. Start one with `/event start`.',
  eventFinished: 'This channel’s event is already finished. Start another with `/event start`.',
  eventOpenHere:
    'There is already an open event in this channel. Finish it with `/event finish` or use `force: True` to start another.',
  warNeedsSix: 'A war needs exactly 6 comma-separated players (you gave {n}).',
  started: '{kind} started. Record races with `/race`.',
  unknownTrack: "I don't recognise the track “{track}”. Use the abbreviation (rDKP, CC, RR…).",
  raceNoRange: 'The race number must be between 1 and 12.',
  eventFull: 'The event already has 12 races. Use `/fix` or `/event finish`.',
  raceSaved: 'Race {n} saved: {track}.',
  raceFixed: 'Race {n} fixed: {track}.',
  posEmpty: 'Write the positions.',
  posBadToken: '“{token}” is not a valid position.',
  posCount: 'There are {n} positions but the lineup has {lineup} players (use x for an absent player).',
  posMissing: 'Your team can have at most 2 absent players.',
  posTotalMissing: 'At most 2 players can be missing between both teams.',
  posRange: 'Position {pos} is not valid in a {racers} player race.',
  posRepeated: 'Position {pos} is repeated.',
  posUnknownPlayer: 'There is no player “{name}” in this event.',
  posRepeatedPlayer: '{name} appears twice.',
  posLounge: 'In a lounge just write your position (1-24).',
  subWarOnly: 'Substitutions only exist in wars.',
  subUnknownOut: '“{name}” is not in the current lineup.',
  subAlreadyIn: '{name} is already in the lineup.',
  subDone: 'Substitution: {out} out, {in} in.',
  forbidden: "You can't edit this event (it is finished or you are not its creator, a player or a team member).",
  notConfigured: 'The bot is not set up in the database yet (migration 0012 is missing).',
  error: 'Could not complete it: {message}',
  finishConfirm: 'Finish the event? It will be locked and count towards the stats.',
  finishYes: 'Finish',
  finishNo: 'Cancel',
  finishCancelled: 'Finishing cancelled.',
  finished: 'Event finished.',
  finishNoRaces: 'The event has no races yet.',
  unknownCommand: 'Unknown command.',
  lineup: 'Lineup (order of the positions)',
  races: 'Races',
  players: 'Players',
  race: 'Race',
  noRaces: 'No races yet.',
  average: 'Average position: {avg}',
  web: 'View on MKW Hub',
  lorenzi: 'Lorenzi table',
  statusOpen: 'open',
  statusFinished: 'finished',
  absent: 'absent',
}

export type BotLang = 'es' | 'en'
export type BotMessageKey = keyof typeof es

export const langFromLocale = (locale: string | undefined): BotLang => (locale?.startsWith('es') ? 'es' : 'en')

export function msg(lang: BotLang, key: BotMessageKey, vars?: Record<string, string | number>): string {
  return format((lang === 'es' ? es : en)[key], vars)
}
