import { useId } from 'react'
import type { CrownPeriod } from '../lib/crowns'

/**
 * Insignia de corona: la casilla de «pole» pintada en el asfalto de la parrilla de salida. Cada periodo tiene su marca de
 * cronometraje (24H, 7D, ALL) y su acabado: la del día es amarillo MK; la de la semana, blanca con pianos rojos y blancos a los
 * lados; la del trono, dorada con el piano rodeando toda la casilla y la bandera de cuadros.
 *
 *  - `now`: la llevas ahora, la casilla iluminada.
 *  - `ever`: la has llevado alguna vez, la casilla fantasma (a trazos y solo el contorno) con las veces que la has ganado.
 *  - `none`: aún no, la casilla apagada.
 */
export type CrownState = 'now' | 'ever' | 'none'

const TAG: Record<CrownPeriod, string> = { day: '24H', week: '7D', all: 'ALL' }
const ACCENT: Record<CrownPeriod, string> = { day: '#ffd500', week: '#f4f4f0', all: '#ffd34d' }
const KERB_RED = '#e8112d'
const OFF = '#4a4a46'

export function CrownBadge({ period, state, count, size = 64 }: { period: CrownPeriod; state: CrownState; count?: number; size?: number }) {
  const id = useId().replace(/:/g, '')
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const lit = state === 'now'
  const ghost = state === 'ever'
  const accent = state === 'none' ? OFF : ACCENT[period]
  const kerbs = state !== 'none' && period !== 'day'
  const ring = period === 'all'
  const tag = ghost && count ? `${TAG[period]} ×${count}` : TAG[period]

  return (
    <div className="flex shrink-0 flex-col items-center" aria-hidden>
      <svg width={size} height={size * 1.1} viewBox="0 0 56 62" style={{ overflow: 'visible' }} className="block drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]">
        <defs>
          {/* Piano (kerb) a 45°, como los de las curvas */}
          <pattern id={`${id}k`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <rect width="8" height="4" fill={KERB_RED} />
            <rect y="4" width="8" height="4" fill="#f4f4f0" />
          </pattern>
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
            <rect x="0" y="0" width="48" height="46" />
          </clipPath>
        </defs>

        {/* Todo el dibujo está inclinado, como las placas de la web */}
        <g transform="translate(9 3) skewX(-8)">
          {/* Asfalto */}
          {state === 'none' ? (
            <rect x="0" y="0" width="48" height="46" fill="none" stroke={OFF} strokeWidth="1.5" strokeDasharray="3 3" />
          ) : ghost ? (
            <rect x="0" y="0" width="48" height="46" fill="#141414" fillOpacity="0.55" stroke={accent} strokeWidth="1.5" strokeDasharray="4 3" />
          ) : (
            <rect x="0" y="0" width="48" height="46" fill="#161616" />
          )}

          {/* Pianos: a los lados en la semana, rodeando la casilla en el trono */}
          {kerbs && lit && (ring ? <rect x="2" y="2" width="44" height="42" fill="none" stroke={`url(#${id}k)`} strokeWidth="4" /> : <><rect x="0" y="0" width="4" height="46" fill={`url(#${id}k)`} /><rect x="44" y="0" width="4" height="46" fill={`url(#${id}k)`} /></>)}
          {kerbs && ghost && <rect x="2" y="2" width="44" height="42" fill="none" stroke={`url(#${id}k)`} strokeWidth="3" strokeOpacity="0.35" />}

          {/* Esquinas de la casilla de salida, pintadas en blanco */}
          {state !== 'none' && (
            <path
              d="M7 13V7H13M35 7H41V13M41 33V39H35M13 39H7V33"
              fill="none"
              stroke={ghost ? accent : '#f4f4f0'}
              strokeOpacity={ghost ? 0.7 : 0.9}
              strokeWidth="1.8"
              strokeLinecap="square"
            />
          )}

          {/* Franja de cuadros de meta entre la casilla y la marca, solo en el trono */}
          {ring &&
            lit &&
            Array.from({ length: 32 }, (_, i) => (
              <rect key={i} x={(i % 16) * 3} y={46 + Math.floor(i / 16) * 1.5} width="3" height="1.5" fill={(i % 16 + Math.floor(i / 16)) % 2 === 0 ? '#f4f4f0' : '#161616'} />
            ))}

          {/* P1 */}
          <text
            x="24"
            y="32"
            textAnchor="middle"
            className="font-display"
            style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}
            fill={ghost || state === 'none' ? 'none' : ring ? `url(#${id}g)` : accent}
            stroke={ghost || state === 'none' ? accent : '#161616'}
            strokeWidth={ghost || state === 'none' ? 1.1 : 0.6}
            paintOrder="stroke"
          >
            P1
          </text>

          {/* Marca de cronometraje (y las veces, si es la fantasma) */}
          <rect x="0" y="49" width="48" height="10" fill={state === 'none' ? 'none' : accent} stroke={state === 'none' ? OFF : 'none'} strokeWidth="1" />
          <text x="24" y="57" textAnchor="middle" className="font-mono" style={{ fontSize: 7.5, fontWeight: 800 }} fill={state === 'none' ? OFF : '#141414'}>
            {tag}
          </text>

          {/* Reflejo que cruza la casilla iluminada del trono */}
          {lit && ring && !reduceMotion && (
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
