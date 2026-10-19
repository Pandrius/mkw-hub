/**
 * La medalla de la web (Medal.tsx) como un SVG suelto y sin animaciones, para dibujarla en las imágenes de vista previa del servidor:
 * mismo escudo, mismos metales por nivel y mismos dibujos. Si cambian allí (METALS, SPECIAL_METALS, GLYPHS), cambiarlos aquí.
 */
import type { Glyph } from './achievements'
import type { Tier } from './badges'

/** Dibujos de las medallas en una cuadrícula de 24 × 24 (los mismos que GLYPHS de Medal.tsx) */
const GLYPHS: Record<Glyph, string> = {
  podium: '<rect x="2" y="11" width="6" height="11"/><rect x="9" y="4" width="6" height="18"/><rect x="16" y="14" width="6" height="8"/>',
  flag:
    [0, 1, 2, 3]
      .flatMap((x) => [0, 1, 2].map((y) => ((x + y) % 2 === 0 ? `<rect x="${3 + x * 4.5}" y="${5 + y * 4.5}" width="4.5" height="4.5"/>` : '')))
      .join('') + '<rect x="2" y="3" width="1.6" height="19"/>',
  chevrons: '<polygon points="2,4 9,12 2,20 2,15 5,12 2,9"/><polygon points="9,4 16,12 9,20 9,15 12,12 9,9"/><polygon points="16,4 23,12 16,20 16,15 19,12 16,9"/>',
  bars: '<rect x="2" y="15" width="4" height="7"/><rect x="7.5" y="11" width="4" height="11"/><rect x="13" y="7" width="4" height="15"/><rect x="18.5" y="3" width="3.5" height="19"/>',
  ring: '<path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12a6 6 0 0 1 0-12z" fill-rule="evenodd"/><rect x="9.5" y="9.5" width="5" height="5"/>',
  crown: '<polygon points="2,18 3.5,6 8.5,11.5 12,3 15.5,11.5 20.5,6 22,18"/><rect x="2" y="19.5" width="20" height="2.5"/>',
  bolt: '<polygon points="14,2 4,14 11,14 9,22 20,9 13,9"/>',
  trophy: '<path d="M6 2h12v6a6 6 0 0 1-12 0z"/><path d="M6 4H2v2a4 4 0 0 0 4 4zM18 4h4v2a4 4 0 0 1-4 4z"/><rect x="10.5" y="13" width="3" height="5"/><rect x="7" y="18" width="10" height="3"/>',
  star: '<polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.2,21 12,17.3 5.8,21 7.4,14 2,9.3 9.1,8.6"/>',
}

type Metal = { stops: string[]; rim: string; ink: string; light?: boolean }

/** Metales de cada nivel (los mismos que METALS de Medal.tsx) */
const METALS: Record<1 | 2 | 3 | 4 | 5, Metal> = {
  5: { stops: ['#d4ffe6', '#34e68f', '#0a8a4a', '#42d68f', '#d8ffec'], rim: '#04442a', ink: '#033a22' },
  1: { stops: ['#f8c9a0', '#dc8c46', '#8a4a1c', '#c9773a', '#f2b686'], rim: '#5a2c0e', ink: '#4a230c' },
  2: { stops: ['#ffffff', '#d7dce3', '#848d9a', '#c3c9d2', '#f6f8fa'], rim: '#474d56', ink: '#363b43' },
  3: { stops: ['#fff6b0', '#ffd500', '#b58300', '#f2c200', '#fff2a0'], rim: '#664500', ink: '#4a3200' },
  4: { stops: ['#eaffff', '#3fe0fa', '#0a8aa6', '#55d6ec', '#cdf8ff'], rim: '#04506a', ink: '#04384a' },
}
/** Evento legendario («ruby») y logro supremo («legend»): los mismos que SPECIAL_METALS de Medal.tsx (el multicolor, aquí quieto) */
const SPECIAL_METALS: Record<'ruby' | 'legend', Metal> = {
  ruby: { stops: ['#ff8a96', '#e8112d', '#8c0a1d', '#d4112b', '#ff6b7d'], rim: '#3a040c', ink: '#14040a' },
  legend: { stops: ['#7df9ff', '#a78bfa', '#ff7ad9', '#ffc46b', '#7dffb2', '#6ea8ff', '#e879f9', '#fff1a8', '#7df9ff'], rim: '#3b2a6b', ink: '#16121f' },
}

const STOP_AT = [0, 0.3, 0.5, 0.72, 1]
const stopAt = (i: number, n: number) => (n === STOP_AT.length ? STOP_AT[i] : i / (n - 1))

export type MedalKind = 'metal' | 'ruby' | 'legend'

/** Medalla como texto SVG de 56 × 62 (sin conseguir, solo el contorno apagado, como en la web) */
export function medalSvg(glyph: Glyph, tier: Tier, kind: MedalKind = 'metal'): string {
  const head = '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="62" viewBox="0 0 56 62">'
  if (tier <= 0) {
    return `${head}<polygon points="7,0 49,0 56,9 56,40 28,62 0,40 0,9" fill="none" stroke="#5d5b55" stroke-width="2.5" stroke-dasharray="4 3"/><svg x="14" y="10" width="28" height="28" viewBox="0 0 24 24" fill="#5d5b55">${GLYPHS[glyph]}</svg></svg>`
  }
  const metal = kind === 'metal' ? METALS[tier as 1 | 2 | 3 | 4 | 5] : SPECIAL_METALS[kind]
  const stops = metal.stops.map((c, i) => `<stop offset="${stopAt(i, metal.stops.length)}" stop-color="${c}"/>`).join('')
  return (
    `${head}<defs>` +
    `<linearGradient id="o" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>` +
    `<linearGradient id="i" x1="1" y1="1" x2="0" y2="0">${stops}</linearGradient>` +
    `<clipPath id="c"><polygon points="9,3 47,3 53,10 53,39 28,58 3,39 3,10"/></clipPath></defs>` +
    `<polygon points="7,0 49,0 56,9 56,40 28,62 0,40 0,9" fill="url(#o)" stroke="${metal.rim}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<polygon points="9,3 47,3 53,10 53,39 28,58 3,39 3,10" fill="url(#i)" stroke="rgba(255,255,255,0.45)" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<g clip-path="url(#c)"><polygon points="0,0 34,0 0,36" fill="#fff" opacity="0.18"/><polygon points="56,62 56,28 24,62" fill="#000" opacity="0.14"/></g>` +
    `<svg x="14.5" y="11.5" width="27" height="27" viewBox="0 0 24 24" fill="rgba(255,255,255,0.55)">${GLYPHS[glyph]}</svg>` +
    `<svg x="14" y="11" width="27" height="27" viewBox="0 0 24 24" fill="${metal.ink}">${GLYPHS[glyph]}</svg></svg>`
  )
}

/** La medalla como data URI, lista para usar de `src` en una imagen */
export const medalDataUri = (glyph: Glyph, tier: Tier, kind: MedalKind = 'metal') => `data:image/svg+xml;base64,${Buffer.from(medalSvg(glyph, tier, kind)).toString('base64')}`

/** Galones del rango de guerra (dibujo de la placa .war-rank): tantos como el nivel */
export function chevronsSvg(level: number, color: string): string {
  const lines = Array.from({ length: level }, (_, k) => `<polyline points="1,${19 - k * 3.6} 8,${15 - k * 3.6} 15,${19 - k * 3.6}"/>`).join('')
  return `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="miter">${lines}</svg>`).toString('base64')}`
}
