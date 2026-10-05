/**
 * Registra (o actualiza) los comandos de barra del bot en Discord.
 *
 *   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs
 *   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs <guild_id>
 *
 * Sin guild_id se registran globalmente (pueden tardar un rato en aparecer); con guild_id, solo en
 * ese servidor y al instante (útil para probar). Sustituye la lista entera de comandos (PUT).
 * Necesita Node 22.18+ (carga el .ts de los comandos directamente).
 */
import { COMMANDS } from '../src/lib/discord/commands.ts'

const appId = process.env.DISCORD_APP_ID
const token = process.env.DISCORD_BOT_TOKEN
const guildId = process.argv[2]

if (!appId || !token) {
  console.error('Faltan las variables DISCORD_APP_ID y DISCORD_BOT_TOKEN.')
  process.exit(1)
}

const url = guildId
  ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${appId}/commands`

const res = await fetch(url, {
  method: 'PUT',
  headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(COMMANDS),
})

if (!res.ok) {
  console.error(`Discord respondió ${res.status}:`, await res.text())
  process.exit(1)
}

const saved = await res.json()
console.log(`${saved.length} comandos registrados ${guildId ? `en el servidor ${guildId}` : 'globalmente'}:`)
for (const c of saved) console.log(` - /${c.name}`)
