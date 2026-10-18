/**
 * Imagen de vista previa (PNG 1200×630) de un perfil o de una tabla, para los enlaces que se pegan en Discord y otros chats.
 *   /api/og?kind=profile&id=<uuid>[&lang=es|en]
 *   /api/og?kind=table&d=<tabla codificada>[&lang=es|en]
 * Solo enseña datos que ya son públicos (la web muestra los perfiles a cualquiera): el perfil con sus eventos verificados.
 */
import { createClient } from '@supabase/supabase-js'
import { getTrack, TRACKS } from '../src/data/tracks.js'
import { en } from '../src/i18n/en.js'
import { es, type MessageKey } from '../src/i18n/es.js'
import { achievementTotals, computeAchievements } from '../src/lib/achievements.js'
import { computeBadges } from '../src/lib/badges.js'
import { decodeTable, rankRows, type FreeRow } from '../src/lib/freeTable.js'
import { profileCardNode, renderCard, tableCardNode, TABLE_CARD_ROWS, type CardFonts, type ProfileCard } from '../src/lib/ogCard.js'
import { POINTS } from '../src/lib/scoring.js'
import { featurable } from '../src/lib/titles.js'
import { fetchTimeline } from '../src/lib/timelineQuery.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIER_HEX = ['#3b3b38', '#d98a45', '#c9ced6', '#ffd500', '#28d7f5', '#22e07f']
const RUBY = '#e8112d'

type Lang = 'es' | 'en'
const translator = (lang: Lang) => (key: MessageKey, vars?: Record<string, string | number>) =>
  (lang === 'en' ? en : es)[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars?.[k] ?? ''))

const FONT_FILES = [
  { file: 'barlow-latin-600-normal.woff', name: 'Barlow', weight: 600 },
  { file: 'barlow-latin-700-normal.woff', name: 'Barlow', weight: 700 },
  { file: 'big-shoulders-display-latin-900-normal.woff', name: 'Big Shoulders', weight: 900 },
] as const

// Las fuentes están en public/fonts: se piden a la propia web una vez y se guardan mientras viva la función
let fontCache: CardFonts | null = null
const PRODUCTION = 'https://mkw-hub.vercel.app'
async function loadFonts(origin: string): Promise<CardFonts> {
  if (fontCache) return fontCache
  const get = async (base: string) =>
    Promise.all(
      FONT_FILES.map(async (f) => {
        const res = await fetch(`${base}/fonts/${f.file}`)
        if (!res.ok) throw new Error(`font ${f.file}: ${res.status}`)
        return { name: f.name, weight: f.weight, data: await res.arrayBuffer() }
      }),
    )
  // Si la propia dirección no responde (previsualizaciones protegidas), se piden a producción
  fontCache = await get(origin).catch(() => get(PRODUCTION))
  return fontCache
}

/** Foto de perfil como data URI (null si no se puede descargar a tiempo) */
async function fetchAvatar(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith('https://')) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) return null
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

function featuredLabel(id: string, tier: number, t: ReturnType<typeof translator>): string {
  const [kind, key] = id.split(':')
  if (id === 'ach:warWins') return t(`ach.warWins.rank.${tier}` as MessageKey)
  if (kind === 'ach') return t(`ach.${key}.name` as MessageKey)
  if (kind === 'badge') return t(`badge.${key}` as MessageKey)
  const track = getTrack(key)
  return t('showcase.trackBadge', { track: track?.abbr ?? track?.name ?? key })
}

function titleLabel(id: string, t: ReturnType<typeof translator>): string {
  const [kind, param = ''] = id.split(':')
  const track = () => getTrack(param)?.abbr ?? getTrack(param)?.name ?? param
  if (kind === 'owner') return t('title.owner.name', { track: track() })
  if (kind === 'rank') return t(`rank.${param}` as MessageKey)
  if (kind === 'top') return t('title.top.name', { pct: param })
  return t(`title.${id}.name` as MessageKey)
}

async function profileCard(id: string, lang: Lang): Promise<ProfileCard | null> {
  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
  const { data: prof } = await admin.from('profiles').select('username, avatar_url, country_code, featured_badges, title_id').eq('id', id).maybeSingle()
  if (!prof) return null
  const t = translator(lang)
  const timeline = (await fetchTimeline(admin, id)).filter((r) => r.verified)
  const achievements = computeAchievements(timeline, TRACKS.length)
  const badges = computeBadges(timeline, TRACKS.length)
  const totals = achievementTotals(achievements)
  const owned = featurable(achievements, badges)
  const points = timeline.reduce((n, r) => n + (POINTS[r.position - 1] ?? 0), 0)
  const perWar = timeline.length ? Math.round((points / timeline.length) * 12) : 0

  const featured = ((prof.featured_badges as string[] | null) ?? []).flatMap((fid) => {
    const f = owned.find((o) => o.id === fid)
    if (!f) return []
    const color = fid === 'ach:legendEvent' ? RUBY : fid === 'ach:allAchievements' ? '#ffffff' : TIER_HEX[f.tier]
    const tierName = fid === 'ach:legendEvent' ? t('badge.tier.ruby') : fid === 'ach:allAchievements' ? t('badge.tier.legendary') : t(`badge.tier.${f.tier}` as MessageKey)
    return [{ name: featuredLabel(fid, f.tier, t), tier: tierName, color }]
  })

  const nf = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES')
  return {
    name: String(prof.username ?? '?'),
    country: (prof.country_code as string | null) ?? null,
    title: prof.title_id ? titleLabel(prof.title_id as string, t) : null,
    avatar: await fetchAvatar((prof.avatar_url as string | null) ?? null),
    stats: [
      { label: t('og.events'), value: nf.format(new Set(timeline.map((r) => r.eventId)).size) },
      { label: t('stats.races'), value: nf.format(timeline.length) },
      { label: t('an.perWar'), value: String(perWar) },
      { label: t('og.achievements'), value: `${totals.earned}/${totals.possible}` },
    ],
    badges: featured,
    footer: 'mkw-hub.vercel.app',
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lang: Lang = url.searchParams.get('lang') === 'en' ? 'en' : 'es'
  const t = translator(lang)
  try {
    const fonts = await loadFonts(url.origin)
    let node
    if (url.searchParams.get('kind') === 'profile') {
      const id = url.searchParams.get('id') ?? ''
      const card = UUID.test(id) ? await profileCard(id, lang) : null
      if (!card) return new Response('Not found', { status: 404 })
      node = profileCardNode(card)
    } else if (url.searchParams.get('kind') === 'table') {
      const table = decodeTable(url.searchParams.get('d'))
      if (!table) return new Response('Bad request', { status: 400 })
      const rows = rankRows(table.rows.map((r, i): FreeRow => ({ id: i, name: r.name, points: r.points })))
      node = tableCardNode({
        title: table.title.trim() || t('free.defaultTitle'),
        rows: rows.slice(0, TABLE_CARD_ROWS),
        more: rows.length > TABLE_CARD_ROWS ? t('og.more', { n: rows.length - TABLE_CARD_ROWS }) : null,
        footer: 'mkw-hub.vercel.app/tablas',
      })
    } else {
      return new Response('Bad request', { status: 400 })
    }
    const png = await renderCard(node, fonts)
    return new Response(Buffer.from(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('og', err)
    return new Response('Error', { status: 500 })
  }
}
