/**
 * Tipos mínimos de las Interactions de Discord (solo lo que usa el bot).
 * Referencia: https://discord.com/developers/docs/interactions/receiving-and-responding
 */

export const InteractionType = {
  Ping: 1,
  ApplicationCommand: 2,
  MessageComponent: 3,
  Autocomplete: 4,
} as const

export const ResponseType = {
  Pong: 1,
  ChannelMessage: 4,
  UpdateMessage: 7,
  AutocompleteResult: 8,
} as const

export const OptionType = {
  SubCommand: 1,
  String: 3,
  Integer: 4,
  Boolean: 5,
} as const

/** Mensaje visible solo para quien ejecuta el comando */
export const EPHEMERAL = 64

export type CommandOption = {
  name: string
  type: number
  value?: string | number | boolean
  focused?: boolean
  options?: CommandOption[]
}

export type DiscordUser = { id: string; username?: string; global_name?: string | null }

export type Interaction = {
  id?: string
  type: number
  token?: string
  locale?: string
  channel_id?: string
  /** En servidores el usuario viene dentro de member; en MD, directamente en user */
  member?: { user: DiscordUser }
  user?: DiscordUser
  data?: {
    name?: string
    options?: CommandOption[]
    /** Botones (MESSAGE_COMPONENT) */
    custom_id?: string
  }
}

export type EmbedField = { name: string; value: string; inline?: boolean }

export type Embed = {
  title?: string
  description?: string
  url?: string
  color?: number
  fields?: EmbedField[]
  footer?: { text: string }
}

export type Button = { type: 2; style: number; label: string; custom_id: string }
export type ActionRow = { type: 1; components: Button[] }

export type MessageData = {
  content?: string
  embeds?: Embed[]
  components?: ActionRow[]
  flags?: number
  allowed_mentions?: { parse: string[] }
}

export type InteractionResponse =
  | { type: typeof ResponseType.Pong }
  | { type: typeof ResponseType.ChannelMessage | typeof ResponseType.UpdateMessage; data: MessageData }
  | { type: typeof ResponseType.AutocompleteResult; data: { choices: { name: string; value: string }[] } }
