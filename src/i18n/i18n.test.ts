import { describe, expect, it } from 'vitest'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { format } from './format'
import { ja } from './ja'

const OTHERS = { en, fr, ja }

describe('diccionarios', () => {
  for (const [name, dict] of Object.entries(OTHERS)) {
    it(`${name} tiene las mismas claves que español`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(es).sort())
    })

    it(`las variables {x} de ${name} coinciden con español`, () => {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
      for (const key of Object.keys(es) as (keyof typeof es)[]) {
        expect(vars(dict[key]), key).toEqual(vars(es[key]))
      }
    })

    it(`ningún texto de ${name} está vacío`, () => {
      for (const [key, value] of Object.entries(dict)) expect(value.trim(), key).not.toBe('')
    })
  }

  it('cada idioma lleva su locale', () => {
    expect([es['meta.lang'], en['meta.lang'], fr['meta.lang'], ja['meta.lang']]).toEqual(['es-ES', 'en-GB', 'fr-FR', 'ja-JP'])
  })
})
describe('format', () => {
  it('sustituye variables y deja las desconocidas', () => {
    expect(format('{user} ahora es {role}', { user: 'Peckmat', role: 'Admin' })).toBe('Peckmat ahora es Admin')
    expect(format('Hola {x}', {})).toBe('Hola {x}')
  })
})
