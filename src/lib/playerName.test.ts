import { describe, expect, it } from 'vitest'
import { cleanPlayerName, MAX_NAME_LENGTH, stripSharedTag } from './playerName'

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

describe('stripSharedTag', () => {
  it('quita el tag sin corchetes que repiten varios del mismo equipo', () => {
    expect(stripSharedTag(['NEB Ana', 'NEB Beto', 'NEB Carla', 'Dani'])).toEqual(['Ana', 'Beto', 'Carla', 'Dani'])
    expect(stripSharedTag(['Ana NEB', 'Beto NEB'])).toEqual(['Ana', 'Beto'])
  })

  it('no toca nombres que solo comparten una palabra larga o no llegan a la mitad', () => {
    expect(stripSharedTag(['Super Ana', 'Super Beto'])).toEqual(['Super Ana', 'Super Beto'])
    expect(stripSharedTag(['NEB Ana', 'Beto', 'Carla', 'Dani'])).toEqual(['NEB Ana', 'Beto', 'Carla', 'Dani'])
    expect(stripSharedTag(['Ana'])).toEqual(['Ana'])
  })

  it('un nombre que es solo el tag no se queda vacío', () => {
    expect(stripSharedTag(['NEB', 'NEB Beto', 'NEB Ana'])).toEqual(['NEB', 'Beto', 'Ana'])
  })
})
