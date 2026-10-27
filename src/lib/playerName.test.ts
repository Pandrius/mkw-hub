import { describe, expect, it } from 'vitest'
import { cleanPlayerName, extractTag, MAX_NAME_LENGTH, splitSharedTags } from './playerName'

describe('cleanPlayerName', () => {
  it('deja intactos los nombres normales, con acentos y números', () => {
    expect(cleanPlayerName('Peckmat')).toBe('Peckmat')
    expect(cleanPlayerName('Rayito1005')).toBe('Rayito1005')
    expect(cleanPlayerName('José Ñandú')).toBe('José Ñandú')
    expect(cleanPlayerName('lucía!!')).toBe('lucía')
  })

  it('admite letras griegas, cirílicas, japonesas, coreanas y chinas', () => {
    expect(cleanPlayerName('Αλέξανδρος')).toBe('Αλέξανδρος')
    expect(cleanPlayerName('ηβ Nebulosa')).toBe('ηβ Nebulosa')
    expect(cleanPlayerName('Дмитрий')).toBe('Дмитрий')
    expect(cleanPlayerName('たろう')).toBe('たろう')
    expect(cleanPlayerName('ハルカ')).toBe('ハルカ')
    expect(cleanPlayerName('山田太郎')).toBe('山田太郎')
    expect(cleanPlayerName('김민수')).toBe('김민수')
  })

  it('junta los espacios que el OCR mete entre caracteres japoneses', () => {
    expect(cleanPlayerName('た ろう')).toBe('たろう')
    expect(cleanPlayerName('山田 太郎')).toBe('山田太郎')
    expect(cleanPlayerName('ハ ル カ')).toBe('ハルカ')
    // Las palabras latinas siguen separadas
    expect(cleanPlayerName('Ana 山田')).toBe('Ana 山田')
  })

  it('convierte las letras de ancho completo a las normales', () => {
    expect(cleanPlayerName('Ａｎａ')).toBe('Ana')
  })

  it('quita el tag entre corchetes, paréntesis o llaves, en cualquier lado', () => {
    expect(cleanPlayerName('[NEB] Peckmat')).toBe('Peckmat')
    expect(cleanPlayerName('Peckmat [NEB]')).toBe('Peckmat')
    expect(cleanPlayerName('(RKL)Ana')).toBe('Ana')
    expect(cleanPlayerName('【ηβ】たろう')).toBe('たろう')
    expect(cleanPlayerName('{X} Beto <Y>')).toBe('Beto')
  })

  it('quita el tag cuando el OCR se come un corchete o lo separa con una barra', () => {
    expect(cleanPlayerName('NEB] Peckmat')).toBe('Peckmat')
    expect(cleanPlayerName('Peckmat [NEB')).toBe('Peckmat')
    expect(cleanPlayerName('NEB | Peckmat')).toBe('Peckmat')
    expect(cleanPlayerName('Peckmat | NEB')).toBe('Peckmat')
    expect(cleanPlayerName('NEB: Peckmat')).toBe('Peckmat')
  })

  it('quita el tag conocido solo si es una palabra entera', () => {
    expect(cleanPlayerName('NEB Peckmat', ['NEB'])).toBe('Peckmat')
    expect(cleanPlayerName('Peckmat neb', ['NEB'])).toBe('Peckmat')
    expect(cleanPlayerName('Nebula', ['NEB'])).toBe('Nebula')
    expect(cleanPlayerName('ηβ Ana', ['ηβ'])).toBe('Ana')
  })

  it('quita los símbolos raros y recorta los separadores de las puntas', () => {
    expect(cleanPlayerName('§ Bob ~ ^ ')).toBe('Bob')
    expect(cleanPlayerName('★Ana★')).toBe('Ana')
    expect(cleanPlayerName('..__Ana--')).toBe('Ana')
    expect(cleanPlayerName('A|n$a')).toBe('A n a')
    expect(cleanPlayerName("O'Neil")).toBe("O'Neil")
  })

  it('si todo el nombre estaba entre corchetes, lo conserva', () => {
    expect(cleanPlayerName('[Ana]')).toBe('Ana')
    expect(cleanPlayerName('[NEB]', ['NEB'])).toBe('NEB')
  })

  it('no devuelve nombres larguísimos ni símbolos solos', () => {
    expect(cleanPlayerName('a'.repeat(100))).toHaveLength(MAX_NAME_LENGTH)
    expect(cleanPlayerName('@@@ ###')).toBe('')
  })
})

describe('extractTag', () => {
  it('saca el tag entre corchetes, paréntesis o llaves, en cualquier lado', () => {
    expect(extractTag('[NEB] Peckmat')).toBe('NEB')
    expect(extractTag('Peckmat [NEB]')).toBe('NEB')
    expect(extractTag('(RKL)Ana')).toBe('RKL')
    expect(extractTag('【ηβ】たろう')).toBe('ηβ')
    expect(extractTag('{X} Beto')).toBe('X')
  })

  it('saca el tag cuando el OCR se come un corchete o lo separa con una barra', () => {
    expect(extractTag('NEB] Peckmat')).toBe('NEB')
    expect(extractTag('Peckmat [NEB')).toBe('NEB')
    expect(extractTag('NEB | Peckmat')).toBe('NEB')
    expect(extractTag('Peckmat | NEB')).toBe('NEB')
  })

  it('reconoce los tags ya conocidos pegados al nombre, sin confundir palabras más largas', () => {
    expect(extractTag('NEB Peckmat', ['NEB'])).toBe('NEB')
    expect(extractTag('Peckmat neb', ['NEB'])).toBe('NEB')
    expect(extractTag('Nebula', ['NEB'])).toBeNull()
  })

  it('un nombre sin tag no tiene tag', () => {
    expect(extractTag('Peckmat')).toBeNull()
    expect(extractTag('Rayito1005')).toBeNull()
  })

  it('ignora lo que no parece un tag (demasiado largo)', () => {
    expect(extractTag('[Nombre larguísimo] Ana')).toBeNull()
  })
})

describe('splitSharedTags', () => {
  it('saca el tag sin corchetes que repiten varios nombres, hasta dos equipos', () => {
    const out = splitSharedTags(['NEB Ana', 'RKL Beto', 'NEB Carla', 'RKL Dani', 'Eva'])
    expect(out.tags).toEqual(['NEB', 'RKL', 'NEB', 'RKL', null])
    expect(out.names).toEqual(['Ana', 'Beto', 'Carla', 'Dani', 'Eva'])
  })

  it('también cuando el tag va al final', () => {
    const out = splitSharedTags(['Ana NEB', 'Beto NEB'])
    expect(out.tags).toEqual(['NEB', 'NEB'])
    expect(out.names).toEqual(['Ana', 'Beto'])
  })

  it('una palabra repetida larga o que solo sale una vez no es un tag', () => {
    expect(splitSharedTags(['Super Ana', 'Super Beto']).tags).toEqual([null, null])
    expect(splitSharedTags(['NEB Ana', 'Beto', 'Carla']).tags).toEqual([null, null, null])
  })

  it('un nombre que es solo el tag no se queda vacío', () => {
    expect(splitSharedTags(['NEB', 'NEB Beto', 'NEB Ana']).names).toEqual(['NEB', 'Beto', 'Ana'])
  })
})
