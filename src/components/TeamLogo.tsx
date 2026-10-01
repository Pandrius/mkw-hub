import { useState } from 'react'

type Props = {
  logoUrl?: string | null
  tag: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'size-7 text-[10px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
  xl: 'size-16 sm:size-20 text-sm sm:text-base font-bold',
}

export function TeamLogo({ logoUrl, tag, name, size = 'md', className = '' }: Props) {
  const [error, setError] = useState(false)

  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setError(true)}
        className={`${sizeClasses[size]} shrink-0 rounded-lg border-2 border-line bg-surface object-contain p-1 shadow-sm ${className}`}
      />
    )
  }

  // Elegante fallback si no tiene logo o si falla la carga: badge con la etiqueta/tag del equipo
  return (
    <div
      title={name}
      aria-label={name}
      className={`${sizeClasses[size]} shrink-0 flex items-center justify-center rounded-lg border-2 border-line bg-surface-2 font-mono font-bold text-muted select-none ${className}`}
    >
      <span className="truncate max-w-full px-1">{tag || name.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}
