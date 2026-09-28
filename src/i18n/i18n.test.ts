import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { format } from './format'

describe('diccionarios', () => {
  it('inglés y español tienen las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
  })

  it('las variables {x} coinciden en ambos idiomas', () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(vars(en[key]), key).toEqual(vars(es[key]))
    }
  })

  it('ningún texto está vacío', () => {
    for (const [key, value] of Object.entries(en)) expect(value.trim(), key).not.toBe('')
  })
})

describe('format', () => {
  it('sustituye variables y deja las desconocidas', () => {
    expect(format('{user} ahora es {role}', { user: 'Peckmat', role: 'Admin' })).toBe('Peckmat ahora es Admin')
    expect(format('Hola {x}', {})).toBe('Hola {x}')
  })
})
