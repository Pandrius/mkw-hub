/*
 * Diseño de la imagen de la tabla de la war: un preset de colores, retoques de color propios,
 * una foto de fondo opcional y las franjas de peligro de la cabecera. Solo datos: el dibujo está
 * en warImageDraw.ts y el guardado en warDesignStore.ts.
 */

export type Palette = {
  bg: string
  surface: string
  surface2: string
  line: string
  ink: string
  muted: string
  /** Color de acento: tu equipo, marca, franjas */
  accent: string
  red: string
  green: string
}

export type PresetId = 'asphalt' | 'official' | 'light' | 'neon' | 'sunset' | 'ocean'

/** Cómo se dibuja: "standard" (placas inclinadas, franjas) o "elegant" (serif, filetes finos y marco) */
export type PresetStyle = 'standard' | 'elegant'

export const PRESETS: Record<PresetId, Palette> = {
  // El de siempre: asfalto y amarillo kart
  asphalt: { bg: '#141414', surface: '#1c1c1b', surface2: '#292927', line: '#3b3b38', ink: '#f4f2ec', muted: '#a5a29a', accent: '#ffd500', red: '#e8112d', green: '#19c15a' },
  // Oficial: negro de invitación de gala, champán y oro, para las competiciones más importantes
  official: { bg: '#050505', surface: '#0a0a09', surface2: '#14120d', line: '#3a3015', ink: '#f2e8cf', muted: '#a09375', accent: '#d4af37', red: '#c0364d', green: '#3da57a' },
  // Claro: todo en tonos crema, sin blancos
  light: { bg: '#ece3cf', surface: '#f7f0df', surface2: '#e6dcc4', line: '#cfc3a6', ink: '#2b2417', muted: '#7b6f58', accent: '#c98a00', red: '#c4122b', green: '#12874a' },
  // Neón: violeta casi negro con magenta (el Océano es azul con acento celeste)
  neon: { bg: '#0c0716', surface: '#150d24', surface2: '#20143a', line: '#3a2761', ink: '#f7f0ff', muted: '#a595c9', accent: '#ff2bd6', red: '#ff3b5c', green: '#2ee59d' },
  sunset: { bg: '#1d1020', surface: '#2a1630', surface2: '#3a1f42', line: '#5a3560', ink: '#fff3e8', muted: '#c9a7b8', accent: '#ff8a3d', red: '#ff4d5e', green: '#4be08a' },
  ocean: { bg: '#08141f', surface: '#0e2233', surface2: '#153247', line: '#265068', ink: '#eaf6ff', muted: '#8fb2c8', accent: '#35c7ff', red: '#ff5470', green: '#3ddc97' },
}

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[]

export const PRESET_STYLE: Record<PresetId, PresetStyle> = {
  asphalt: 'standard',
  official: 'elegant',
  light: 'standard',
  neon: 'standard',
  sunset: 'standard',
  ocean: 'standard',
}

/** Colores que se pueden retocar sobre el preset */
export const EDITABLE_COLORS = ['accent', 'bg', 'surface', 'ink'] as const
export type EditableColor = (typeof EDITABLE_COLORS)[number]

export type WarDesign = {
  preset: PresetId
  /** Colores propios que sustituyen a los del preset */
  colors: Partial<Record<EditableColor, string>>
  /** Foto de fondo (data URL ya reducida) y cuánto se oscurece (0 a 0.9) */
  photo: { dataUrl: string; dim: number } | null
  /** Franjas amarillas y negras de la cabecera (si no, una barra lisa) */
  stripes: boolean
  /**
   * Imagen neutral: igual para los dos equipos, sin diferencias ni quién va ganando y con los equipos
   * en orden alfabético, en lugar de verla desde el equipo que la sube
   */
  neutral: boolean
}

export const DEFAULT_DESIGN: WarDesign = { preset: 'asphalt', colors: {}, photo: null, stripes: true, neutral: false }

const HEX = /^#[0-9a-f]{6}$/i
export const MAX_PHOTO_CHARS = 1_500_000
export const MAX_DIM = 0.9

/** Paleta final: la del preset con los colores propios por encima */
export function resolvePalette(design: WarDesign): Palette {
  const palette = { ...PRESETS[design.preset] }
  for (const key of EDITABLE_COLORS) {
    const color = design.colors[key]
    if (color && HEX.test(color)) palette[key] = color
  }
  return palette
}

/** Mezcla dos colores #rrggbb: t = 0 es el primero, t = 1 el segundo */
export function mixColors(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0'))
  return `#${out.join('')}`
}

/** Luminosidad relativa de un color #rrggbb (0 oscuro, 1 claro) */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** Color de texto legible sobre un fondo dado: casi negro sobre claros y blanco sobre oscuros */
export function readable(background: string): string {
  return luminance(background) > 0.35 ? '#141414' : '#ffffff'
}

/** Lo guardado en el navegador puede estar roto o ser de otra versión: se queda solo con lo válido */
export function parseDesign(raw: unknown): WarDesign {
  if (!raw || typeof raw !== 'object') return DEFAULT_DESIGN
  const r = raw as Record<string, unknown>
  const preset = PRESET_IDS.includes(r.preset as PresetId) ? (r.preset as PresetId) : DEFAULT_DESIGN.preset
  const colors: WarDesign['colors'] = {}
  if (r.colors && typeof r.colors === 'object') {
    for (const key of EDITABLE_COLORS) {
      const v = (r.colors as Record<string, unknown>)[key]
      if (typeof v === 'string' && HEX.test(v)) colors[key] = v.toLowerCase()
    }
  }
  const p = r.photo as { dataUrl?: unknown; dim?: unknown } | null | undefined
  const photo =
    p && typeof p.dataUrl === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(p.dataUrl) && p.dataUrl.length <= MAX_PHOTO_CHARS
      ? { dataUrl: p.dataUrl, dim: typeof p.dim === 'number' && p.dim >= 0 ? Math.min(p.dim, MAX_DIM) : 0.55 }
      : null
  return { preset, colors, photo, stripes: r.stripes !== false, neutral: r.neutral === true }
}

/** Tamaño de una imagen reducida para que ninguno de sus lados pase de `max` (sin agrandar nunca) */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

/** Recorte "cover": qué parte de la foto cubre todo el lienzo sin deformarse, centrada */
export function coverRect(
  imgW: number,
  imgH: number,
  canvasW: number,
  canvasH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const ratio = Math.max(canvasW / imgW, canvasH / imgH)
  const sw = canvasW / ratio
  const sh = canvasH / ratio
  return { sx: (imgW - sw) / 2, sy: (imgH - sh) / 2, sw, sh }
}
