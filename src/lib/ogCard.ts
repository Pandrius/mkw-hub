/**
 * Imágenes de vista previa (1200×630) para compartir un perfil o una tabla en Discord y otros chats. Las pinta el servidor
 * (api/og.ts) con satori y resvg; aquí solo están el diseño y el dibujo, sin red.
 * Misma estética que la web: asfalto, amarillo kart, sin esquinas redondeadas.
 */
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

export const CARD_W = 1200
export const CARD_H = 630

const BG = '#141414'
const SURFACE = '#1c1c1b'
const SURFACE2 = '#292927'
const INK = '#f4f2ec'
const MUTED = '#a5a29a'
const YELLOW = '#ffd500'
const RED = '#ff5a4d'

type Style = Record<string, string | number>
type Node = { type: string; props: { style: Style; children?: Node | string | (Node | string)[]; [k: string]: unknown } }

/** Elemento de satori sin JSX: `div` en columna o en fila (todo es flex) */
function h(style: Style, children?: Node | string | (Node | string)[]): Node {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } }
}

const display = (size: number, color = INK): Style => ({ fontFamily: 'Big Shoulders', fontWeight: 900, fontSize: size, color, textTransform: 'uppercase', lineHeight: 1 })

/** Cuerpo común: franja amarilla arriba, contenido y pie con el nombre de la web */
function frame(content: Node[], footer: string): Node {
  return h({ flexDirection: 'column', width: CARD_W, height: CARD_H, background: BG, fontFamily: 'Barlow', color: INK }, [
    h({ height: 14, width: CARD_W, background: YELLOW }),
    h({ flex: 1, flexDirection: 'column', padding: '40px 56px 0 56px' }, content),
    h({ justifyContent: 'space-between', alignItems: 'center', padding: '0 56px 30px 56px', fontSize: 22, color: MUTED }, [
      h({ ...display(30, YELLOW) }, 'MKW Hub'),
      h({}, footer),
    ]),
  ])
}

export type ProfileCard = {
  name: string
  country: string | null
  title: string | null
  /** Foto como data URI (null si no hay o no se pudo descargar) */
  avatar: string | null
  stats: { label: string; value: string }[]
  badges: { name: string; tier: string; color: string }[]
  footer: string
}

export function profileCardNode(c: ProfileCard): Node {
  const initial = (c.name.trim()[0] ?? '?').toUpperCase()
  return frame(
    [
      h({ alignItems: 'center', gap: 32 }, [
        c.avatar
          ? ({ type: 'img', props: { src: c.avatar, width: 150, height: 150, style: { width: 150, height: 150, borderRadius: 75 } } } as Node)
          : h({ width: 150, height: 150, borderRadius: 75, background: SURFACE2, alignItems: 'center', justifyContent: 'center', ...display(80, YELLOW) }, initial),
        h({ flexDirection: 'column', gap: 14, flex: 1 }, [
          h({ ...display(c.name.length > 16 ? 64 : 84), maxWidth: 900, overflow: 'hidden' }, c.name),
          h({ alignItems: 'center', gap: 16, fontSize: 30, color: MUTED }, [
            ...(c.title ? [h({ background: YELLOW, color: BG, padding: '4px 16px', fontWeight: 700, fontSize: 28 }, c.title)] : []),
            ...(c.country ? [h({}, c.country)] : []),
          ]),
        ]),
      ]),
      h(
        { gap: 14, marginTop: 40 },
        c.stats.map((s) =>
          h({ flexDirection: 'column', flex: 1, background: SURFACE, borderTop: `6px solid ${YELLOW}`, padding: '16px 18px', gap: 8 }, [
            h({ ...display(58) }, s.value),
            h({ fontSize: 22, color: MUTED }, s.label),
          ]),
        ),
      ),
      h(
        { gap: 20, marginTop: 28 },
        c.badges.map((b) =>
          h({ width: 350, alignItems: 'center', gap: 14, background: SURFACE, padding: '14px 18px' }, [
            h({ width: 22, height: 22, borderRadius: 11, background: b.color }),
            h({ flexDirection: 'column', gap: 2 }, [h({ fontSize: 26, fontWeight: 700 }, b.name), h({ fontSize: 20, color: MUTED }, b.tier)]),
          ]),
        ),
      ),
    ],
    c.footer,
  )
}

export type TableCardTeam = { tag: string; total: number; players: { name: string; points: number }[]; color: string }
export type TableCard = { title: string; home: TableCardTeam; away: TableCardTeam; more: string | null; footer: string }

/** Jugadores por equipo que caben en la imagen; el resto se resume en «y N más» */
export const TABLE_CARD_ROWS = 6

export function tableCardNode(c: TableCard): Node {
  const column = (team: TableCardTeam) =>
    h({ flex: 1, flexDirection: 'column', gap: 6 }, [
      h({ alignItems: 'center', justifyContent: 'space-between', background: SURFACE, borderLeft: `10px solid ${team.color}`, padding: '8px 22px', height: 84 }, [
        h({ ...display(team.tag.length > 8 ? 44 : 58, team.color), maxWidth: 300, overflow: 'hidden' }, team.tag),
        h({ ...display(72) }, String(team.total)),
      ]),
      ...team.players.map((p, i) =>
        h({ alignItems: 'center', background: i % 2 ? SURFACE : '#242422', padding: '0 20px', height: 46 }, [
          h({ width: 44, ...display(26, i < 3 ? YELLOW : MUTED) }, String(i + 1)),
          h({ flex: 1, fontSize: 24, fontWeight: 600, overflow: 'hidden' }, p.name),
          h({ fontFamily: 'Big Shoulders', fontWeight: 900, fontSize: 30, color: p.points < 0 ? RED : INK }, String(p.points)),
        ]),
      ),
    ])
  return frame(
    [
      h({ ...display(c.title.length > 26 ? 44 : 56), marginBottom: 22, overflow: 'hidden' }, c.title),
      h({ gap: 24 }, [column(c.home), column(c.away)]),
      ...(c.more ? [h({ marginTop: 10, fontSize: 22, color: MUTED }, c.more)] : []),
    ],
    c.footer,
  )
}

export type CardFonts = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 900 }[]

/** Dibuja el árbol en un PNG de 1200×630 */
export async function renderCard(node: Node, fonts: CardFonts): Promise<Uint8Array> {
  const svg = await satori(node as unknown as Parameters<typeof satori>[0], {
    width: CARD_W,
    height: CARD_H,
    fonts: fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: 'normal' as const })),
  })
  return new Resvg(svg, { fitTo: { mode: 'width', value: CARD_W } }).render().asPng()
}
