/**
 * Definición de los comandos de barra del bot (se registran con scripts/register-discord-commands.mjs).
 * Sin imports a propósito: el script de registro lo carga directamente con Node.
 *
 * Tipos de opción: 1 = subcomando, 3 = texto, 4 = entero, 5 = sí/no.
 * contexts: 0 = servidor, 1 = MD con el bot. integration_types: 0 = instalado en servidor.
 */

const en = (text: string) => ({ 'en-US': text, 'en-GB': text })

const trackOption = {
  name: 'pista',
  name_localizations: { 'en-US': 'track', 'en-GB': 'track' },
  description: 'Abreviatura de la pista (p. ej. rDKP, CC, RR)',
  description_localizations: en('Track abbreviation (e.g. rDKP, CC, RR)'),
  type: 3,
  required: true,
  autocomplete: true,
}

const positionsOption = {
  name: 'posiciones',
  name_localizations: { 'en-US': 'positions', 'en-GB': 'positions' },
  description: 'War: "1 3 5 7 9 11" en orden de alineación (x = ausente) o "nombre=pos, …". Lounge: tu posición',
  description_localizations: en('War: "1 3 5 7 9 11" in lineup order (x = absent) or "name=pos, …". Lounge: your position'),
  type: 3,
  required: true,
}

const missingAwayOption = {
  name: 'faltan_rival',
  name_localizations: { 'en-US': 'missing_opponent', 'en-GB': 'missing_opponent' },
  description: 'Jugadores del rival que faltan en esta carrera (0-2)',
  description_localizations: en('Opponent players missing in this race (0-2)'),
  type: 4,
  min_value: 0,
  max_value: 2,
}

const raceNoOption = (required: boolean) => ({
  name: 'numero',
  name_localizations: { 'en-US': 'number', 'en-GB': 'number' },
  description: required ? 'Número de la carrera a corregir (1-12)' : 'Número de carrera (por defecto, la siguiente)',
  description_localizations: en(required ? 'Race number to fix (1-12)' : 'Race number (defaults to the next one)'),
  type: 4,
  required,
  min_value: 1,
  max_value: 12,
})

const base = { type: 1, contexts: [0, 1], integration_types: [0] }

export const COMMANDS = [
  {
    ...base,
    name: 'evento',
    name_localizations: { 'en-US': 'event', 'en-GB': 'event' },
    description: 'Eventos de MKW Hub (war o lounge) en este canal',
    description_localizations: en('MKW Hub events (war or lounge) in this channel'),
    options: [
      {
        type: 1,
        name: 'iniciar',
        name_localizations: { 'en-US': 'start', 'en-GB': 'start' },
        description: 'Empieza una war o un lounge en este canal',
        description_localizations: en('Start a war or a lounge in this channel'),
        options: [
          {
            name: 'tipo',
            name_localizations: { 'en-US': 'kind', 'en-GB': 'kind' },
            description: 'War (6v6) o Lounge',
            description_localizations: en('War (6v6) or Lounge'),
            type: 3,
            required: true,
            choices: [
              { name: 'War', value: 'war' },
              { name: 'Lounge', value: 'lounge' },
            ],
          },
          {
            name: 'jugadores',
            name_localizations: { 'en-US': 'players', 'en-GB': 'players' },
            description: 'War: 6 jugadores separados por comas (Usuario = nombre en el juego). Lounge: tu nombre',
            description_localizations: en('War: 6 comma-separated players (User = in-game name). Lounge: your name'),
            type: 3,
          },
          {
            name: 'tag',
            description: 'Tag de tu equipo (por defecto, tu equipo de MKC)',
            description_localizations: en('Your team tag (defaults to your MKC team)'),
            type: 3,
            max_length: 12,
          },
          {
            name: 'rival',
            name_localizations: { 'en-US': 'opponent', 'en-GB': 'opponent' },
            description: 'Tag del equipo rival',
            description_localizations: en('Opponent team tag'),
            type: 3,
            max_length: 12,
          },
          {
            name: 'forzar',
            name_localizations: { 'en-US': 'force', 'en-GB': 'force' },
            description: 'Sustituye el evento abierto de este canal (sigue abierto en la web)',
            description_localizations: en('Replace the open event of this channel (it stays open on the website)'),
            type: 5,
          },
        ],
      },
      {
        type: 1,
        name: 'ver',
        name_localizations: { 'en-US': 'show', 'en-GB': 'show' },
        description: 'Muestra el marcador del evento de este canal',
        description_localizations: en('Show the scoreboard of this channel’s event'),
      },
      {
        type: 1,
        name: 'finalizar',
        name_localizations: { 'en-US': 'finish', 'en-GB': 'finish' },
        description: 'Finaliza el evento (pide confirmación; después queda bloqueado)',
        description_localizations: en('Finish the event (asks for confirmation; it is locked afterwards)'),
      },
    ],
  },
  {
    ...base,
    name: 'carrera',
    name_localizations: { 'en-US': 'race', 'en-GB': 'race' },
    description: 'Registra una carrera del evento de este canal',
    description_localizations: en('Record a race of this channel’s event'),
    options: [trackOption, positionsOption, raceNoOption(false), missingAwayOption],
  },
  {
    ...base,
    name: 'corregir',
    name_localizations: { 'en-US': 'fix', 'en-GB': 'fix' },
    description: 'Corrige una carrera ya registrada',
    description_localizations: en('Fix an already recorded race'),
    options: [raceNoOption(true), trackOption, positionsOption, missingAwayOption],
  },
  {
    ...base,
    name: 'sub',
    description: 'Sustitución en la war de este canal',
    description_localizations: en('Substitution in this channel’s war'),
    options: [
      {
        name: 'sale',
        name_localizations: { 'en-US': 'out', 'en-GB': 'out' },
        description: 'Jugador que sale (nombre o número en la alineación)',
        description_localizations: en('Player going out (name or lineup number)'),
        type: 3,
        required: true,
        autocomplete: true,
      },
      {
        name: 'entra',
        name_localizations: { 'en-US': 'in', 'en-GB': 'in' },
        description: 'Jugador que entra (Usuario = nombre en el juego)',
        description_localizations: en('Player coming in (User = in-game name)'),
        type: 3,
        required: true,
        max_length: 80,
      },
    ],
  },
]
