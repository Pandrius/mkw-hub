import { useId } from 'react'
import type { CrownPeriod } from '../lib/crowns'

/**
 * Insignia de corona: la casilla de «pole» de la parrilla de salida, pintada en el asfalto. Cada periodo tiene su marca de
 * cronometraje (24H, 7D, ALL) y su color y marco:
 *  - día: amarillo MK con marco de línea simple,
 *  - semana: azul hielo con doble marco,
 *  - trono: oro con marco grueso de esquinas cortadas, franja de meta a cuadros y un reflejo.
 *
 * Estados: `now` (la llevas ahora, iluminada), `ever` (la has llevado alguna vez: casilla fantasma, a trazos y solo el contorno,
 * con las veces) y `none` (aún no, apagada).
 */
export type CrownState = 'now' | 'ever' | 'none'

const TAG: Record<CrownPeriod, string> = { day: '24H', week: '7D', all: 'ALL' }
const ACCENT: Record<CrownPeriod, string> = { day: '#ffd500', week: '#28d7f5', all: '#ffd34d' }
const OFF = '#4a4a46'
/** Esquinas cortadas de la casilla del trono (48 × 46, corte de 5) */
const CHAMFER = 'M5 0H43L48 5V41L43 46H5L0 41V5Z'

export function CrownBadge({ period, state, count, size = 64 }: { period: CrownPeriod; state: CrownState; count?: number; size?: number }) {
  const id = useId().replace(/:/g, '')
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const lit = state === 'now'
  const ghost = state === 'ever'
  const off = state === 'none'
  const accent = off ? OFF : ACCENT[period]
  const tag = ghost && count ? `${TAG[period]} ×${count}` : TAG[period]
  const dash = ghost || off ? '4 3' : undefined
  const frameOpacity = ghost ? 0.85 : 1

  return (
    <div className="flex shrink-0 flex-col items-center" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" style={{ overflow: 'visible' }} className="block drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6c2" />
            <stop offset="0.5" stopColor="#ffd34d" />
            <stop offset="1" stopColor="#b8860b" />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}c`}>
            <path d={CHAMFER} />
          </clipPath>
        </defs>

        {/* Todo el dibujo está inclinado, como las placas de la web */}
        <g transform="translate(9 3) skewX(-8)">
          {/* Asfalto */}
          {off ? null : <path d={period === 'all' ? CHAMFER : 'M0 0H48V46H0Z'} fill={ghost ? '#141414' : '#161616'} fillOpacity={ghost ? 0.55 : 1} />}

          {/* Marco de cada corona */}
          {period === 'day' && <rect x="1" y="1" width="46" height="44" fill="none" stroke={accent} strokeWidth="2" strokeDasharray={dash} strokeOpacity={frameOpacity} />}
          {period === 'week' && (
            <>
              <rect x="0.8" y="0.8" width="46.4" height="44.4" fill="none" stroke={accent} strokeWidth="1.4" strokeDasharray={dash} strokeOpacity={frameOpacity} />
              {!off && <rect x="4.2" y="4.2" width="39.6" height="37.6" fill="none" stroke={accent} strokeWidth="1" strokeDasharray={ghost ? '3 3' : undefined} strokeOpacity={ghost ? 0.5 : 0.9} />}
            </>
          )}
          {period === 'all' && (
            <>
              <path d={CHAMFER} fill="none" stroke={off ? OFF : lit ? `url(#${id}g)` : accent} strokeWidth={lit ? 3.2 : 2} strokeDasharray={dash} strokeOpacity={frameOpacity} />
              {!off && <path d="M7 4H41L44 7V39L41 42H7L4 39V7Z" fill="none" stroke={accent} strokeWidth="0.9" strokeOpacity={ghost ? 0.45 : 0.8} />}
            </>
          )}

          {/* Esquinas de la casilla de salida, pintadas en blanco (la del trono ya lleva su marco) */}
          {!off && period !== 'all' && (
            <path
              d={period === 'week' ? 'M9 15V9H15M33 9H39V15M39 31V37H33M15 37H9V31' : 'M7 13V7H13M35 7H41V13M41 33V39H35M13 39H7V33'}
              fill="none"
              stroke={ghost ? accent : '#f4f4f0'}
              strokeOpacity={ghost ? 0.7 : 0.85}
              strokeWidth="1.6"
              strokeLinecap="square"
            />
          )}

          {/* Franja de meta a cuadros entre la casilla y la marca, solo en el trono iluminado */}
          {period === 'all' &&
            lit &&
            Array.from({ length: 32 }, (_, i) => <rect key={i} x={(i % 16) * 3} y={46 + Math.floor(i / 16) * 1.5} width="3" height="1.5" fill={((i % 16) + Math.floor(i / 16)) % 2 === 0 ? '#f4f4f0' : '#161616'} />)}

          {/* P1 */}
          <text
            x="24"
            y="32"
            textAnchor="middle"
            className="font-display"
            style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}
            fill={ghost || off ? 'none' : period === 'all' ? `url(#${id}g)` : period === 'week' ? '#f4f4f0' : accent}
            stroke={ghost || off ? accent : '#161616'}
            strokeWidth={ghost || off ? 1.1 : 0.6}
            paintOrder="stroke"
          >
            P1
          </text>

          {/* Marca de cronometraje (y las veces, si es la fantasma) */}
          <rect x="0" y="49" width="48" height="10" fill={off ? 'none' : accent} stroke={off ? OFF : 'none'} strokeWidth="1" />
          <text x="24" y="57" textAnchor="middle" className="font-mono" style={{ fontSize: 7.5, fontWeight: 800 }} fill={off ? OFF : '#141414'}>
            {tag}
          </text>

          {/* Reflejo que cruza la casilla iluminada del trono */}
          {lit && period === 'all' && !reduceMotion && (
            <g clipPath={`url(#${id}c)`}>
              <rect x="-20" y="0" width="16" height="46" fill={`url(#${id}s)`}>
                <animate attributeName="x" values="-20;56;56" keyTimes="0;0.45;1" dur="3.6s" repeatCount="indefinite" />
              </rect>
            </g>
          )}
        </g>
      </svg>
    </div>
  )
}
