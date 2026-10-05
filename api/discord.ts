/**
 * Bot de Discord por HTTP (Interactions Endpoint URL = https://<web>/api/discord).
 *
 * Discord envía cada comando como un POST firmado con Ed25519; aquí se verifica la firma con
 * DISCORD_PUBLIC_KEY y se responde en la misma petición (Discord da 3 s), sin servidor aparte.
 * La lógica de los comandos está en src/lib/discord/ (con tests).
 *
 * Desactivado de forma segura: sin DISCORD_PUBLIC_KEY, VITE_SUPABASE_URL o SUPABASE_SECRET_KEY
 * responde 503 y no hace nada más. Los imports llevan .js (ver api/sync.ts).
 */
import { createClient } from '@supabase/supabase-js'
import { handleInteraction } from '../src/lib/discord/bot.js'
import { supabaseBotStore } from '../src/lib/discord/store.js'
import { InteractionType, ResponseType } from '../src/lib/discord/types.js'
import type { Interaction } from '../src/lib/discord/types.js'
import { verifyDiscordSignature } from '../src/lib/discord/verify.js'

const DEFAULT_SITE_URL = 'https://mkw-hub.vercel.app'

export async function POST(request: Request): Promise<Response> {
  const publicKey = process.env.DISCORD_PUBLIC_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!publicKey || !supabaseUrl || !secretKey) {
    return new Response('Discord bot not configured', { status: 503 })
  }

  const body = await request.text()
  const valid = await verifyDiscordSignature(
    publicKey,
    request.headers.get('x-signature-ed25519'),
    request.headers.get('x-signature-timestamp'),
    body,
  )
  if (!valid) return new Response('Invalid request signature', { status: 401 })

  let interaction: Interaction
  try {
    interaction = JSON.parse(body) as Interaction
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  // PING de Discord al guardar la URL del endpoint: no hace falta tocar la base de datos
  if (interaction.type === InteractionType.Ping) return Response.json({ type: ResponseType.Pong })

  const db = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } })
  const response = await handleInteraction(interaction, supabaseBotStore(db), {
    siteUrl: process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL,
  })
  return Response.json(response)
}

/** GET: comprobación rápida de que la función está desplegada y configurada (sin datos sensibles). */
export function GET(): Response {
  const configured = Boolean(
    process.env.DISCORD_PUBLIC_KEY && process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  )
  return Response.json({ ok: configured }, { status: configured ? 200 : 503 })
}
