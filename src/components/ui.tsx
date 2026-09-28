import type { ReactNode } from 'react'
import { countryName } from '../lib/countries'

/** Título de página: grande, en mayúsculas y con una barra amarilla debajo. */
export function PageHeader({
  title,
  subtitle,
  kicker,
  children,
}: {
  title: string
  subtitle?: string
  /** Texto pequeño encima del título (p. ej. el número de sección) */
  kicker?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {kicker && <p className="mb-1 font-mono text-xs font-bold tracking-widest text-kart-yellow">{kicker}</p>}
        <h1 className="font-display text-5xl leading-[0.85] font-black sm:text-7xl">{title}</h1>
        <div className="mt-3 h-2 w-24 bg-kart-yellow" />
        {subtitle && <p className="mt-4 max-w-2xl text-ink/80">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

/** Estado vacío: bloque rayado, sin iconos. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel relative overflow-hidden px-6 py-10">
      <div className="hazard absolute inset-x-0 top-0 h-1.5 opacity-80" />
      <p className="font-display text-2xl font-extrabold">{title}</p>
      {children && <div className="mt-2 max-w-lg text-sm text-muted">{children}</div>}
    </div>
  )
}

/** Pestañas inclinadas, la activa en amarillo. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`slant px-5 py-2 font-display text-base font-extrabold whitespace-nowrap transition-colors ${
            value === tab.id ? 'bg-kart-yellow text-bg' : 'bg-surface-2 text-muted hover:bg-line hover:text-ink'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center border px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wide uppercase"
      style={color ? { borderColor: color, color } : undefined}
    >
      {children}
    </span>
  )
}

/** Abreviatura de pista como placa de kart, del color de su copa */
export function Plate({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span className="plate" style={color ? ({ '--plate': color } as React.CSSProperties) : undefined}>
      {children}
    </span>
  )
}

/** Bandera de un país a partir de su código ISO (ES, US…) */
export function Flag({ code, locale }: { code: string | null; locale: string }) {
  if (!code) return null
  const name = countryName(code, locale)
  return (
    <img
      src={`https://flagcdn.com/20x15/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/40x30/${code.toLowerCase()}.png 2x`}
      alt={name}
      title={name}
      width={20}
      height={15}
      className="inline-block shrink-0"
    />
  )
}
