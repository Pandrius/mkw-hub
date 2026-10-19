/**
 * Imágenes de vista previa (1200×630) para compartir un perfil o una tabla en Discord y otros chats. Las pinta el servidor
 * (api/og.ts) con satori y resvg; aquí solo están el diseño y el dibujo, sin red.
 * Misma estética que la web: asfalto, amarillo kart, sin esquinas redondeadas.
 */
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import type { TitleSpec } from './ogTitle.js'

export const CARD_W = 1200
export const CARD_H = 630

const BG = '#141414'
const SURFACE = '#1c1c1b'
const SURFACE2 = '#292927'
const INK = '#f4f2ec'
const MUTED = '#a5a29a'
const LINE = '#3b3b38'
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
  /** Bandera del país como data URI (null si no tiene país o no se pudo descargar) */
  flag: string | null
  /** Título con el aspecto de su placa en la web; `chevrons` son los galones de los rangos de guerra (data URI) */
  title: { text: string; spec: TitleSpec; chevrons?: string } | null
  /** Foto como data URI (null si no hay o no se pudo descargar) */
  avatar: string | null
  stats: { label: string; value: string }[]
  /** Insignias destacadas: la medalla de la web (data URI), su nombre, el nivel y los niveles conseguidos de los posibles */
  medals: { src: string; name: string; tier: string; color: string; levels: number; earned: number }[]
  footer: string
}

const TITLE_FONT = { fontFamily: 'Big Shoulders', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1 } as const

/** El título como su placa de la web (colores, degradados y filetes de index.css; los rangos de guerra llevan sus galones) */
function titleNode(title: NonNullable<ProfileCard['title']>): Node {
  const s = title.spec
  const text = (color: string): Style => ({ ...TITLE_FONT, fontSize: 30, color })
  if (s.war) {
    return h({ alignItems: 'stretch' }, [
      h({ background: '#141414', padding: '8px 16px 8px 12px', alignItems: 'center' }, { type: 'img', props: { src: title.chevrons ?? '', width: 20, height: 28, style: { width: 20, height: 28 } } } as Node),
      h({ background: s.bg ?? '#ffd500', padding: '8px 18px 8px 12px', alignItems: 'center', ...text('#141414') }, title.text),
    ])
  }
  const box: Style = { alignItems: 'center', padding: '8px 18px', ...text(s.ink) }
  if (s.bg) box.backgroundColor = s.bg
  if (s.image) box.backgroundImage = s.image
  if (s.edge) box.border = `${s.edge.width}px solid ${s.edge.color}`
  return h(box, title.text)
}

export function profileCardNode(c: ProfileCard): Node {
  const initial = (c.name.trim()[0] ?? '?').toUpperCase()
  return frame(
    [
      h({ alignItems: 'center', gap: 32 }, [
        c.avatar
          ? ({ type: 'img', props: { src: c.avatar, width: 150, height: 150, style: { width: 150, height: 150, borderRadius: 75 } } } as Node)
          : h({ width: 150, height: 150, borderRadius: 75, background: SURFACE2, alignItems: 'center', justifyContent: 'center', ...display(80, YELLOW) }, initial),
        h({ flexDirection: 'column', gap: 16, flex: 1 }, [
          // Nombre y, a su derecha, la bandera de su país
          h({ alignItems: 'center', gap: 24 }, [
            h({ ...display(c.name.length > 14 ? 60 : 84), maxWidth: c.flag ? 800 : 900, overflow: 'hidden', whiteSpace: 'nowrap' }, c.name),
            ...(c.flag ? [{ type: 'img', props: { src: c.flag, width: 60, height: 45, style: { width: 60, height: 45 } } } as Node] : []),
          ]),
          ...(c.title ? [h({}, titleNode(c.title))] : []),
        ]),
      ]),
      h(
        { gap: 14, marginTop: 36 },
        c.stats.map((s) =>
          h({ flexDirection: 'column', flex: 1, background: SURFACE, borderTop: `6px solid ${YELLOW}`, padding: '16px 18px', gap: 8 }, [
            h({ ...display(58) }, s.value),
            h({ fontSize: 22, color: MUTED }, s.label),
          ]),
        ),
      ),
      h(
        { gap: 20, marginTop: 24 },
        c.medals.map((m) =>
          h({ width: 350, alignItems: 'center', gap: 16, background: SURFACE, padding: '12px 18px' }, [
            { type: 'img', props: { src: m.src, width: 56, height: 62, style: { width: 56, height: 62 } } } as Node,
            h({ flexDirection: 'column', gap: 6 }, [
              h({ fontSize: 24, fontWeight: 700 }, m.name),
              h({ alignItems: 'center', gap: 10 }, [
                h({ fontSize: 19, color: m.color, fontWeight: 700 }, m.tier),
                h(
                  { gap: 3 },
                  Array.from({ length: m.levels }, (_, k) => h({ width: 9, height: 9, background: k < m.earned ? m.color : LINE })),
                ),
              ]),
            ]),
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
