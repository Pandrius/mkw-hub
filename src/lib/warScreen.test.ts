import { describe, expect, it } from 'vitest'
import { bestCandidate, findBarStack, pickByTag, runsOf, widestRun } from './warScreen'

describe('runsOf', () => {
  it('rachas seguidas de true como [inicio, fin)', () => {
    expect(runsOf([false, true, true, false, true])).toEqual([[1, 3], [4, 5]])
    expect(runsOf([true, true])).toEqual([[0, 2]])
    expect(runsOf([false, false])).toEqual([])
  })
})

describe('findBarStack', () => {
  const MIN = 25.6
  const MAX = 76.8

  it('la columna derecha de la captura de referencia: 6 barras entre franjas de fondo', () => {
    const runs: [number, number][] = [[0, 20], [80, 109], [199, 218], [277, 298], [332, 347], [489, 497], [523, 570], [574, 621], [626, 673], [677, 724], [728, 775], [779, 827], [828, 835]]
    const bars = findBarStack(runs, MIN, MAX)
    expect(bars).toHaveLength(6)
    expect(bars[0]).toEqual({ y0: 523, y1: 570 })
    expect(bars[5]).toEqual({ y0: 779, y1: 827 })
  })

  it('la columna izquierda: las dos primeras barras vienen pegadas en una racha de 99', () => {
    const runs: [number, number][] = [[0, 27], [34, 43], [80, 109], [279, 347], [492, 496], [523, 622], [626, 673], [676, 724], [727, 776], [777, 827], [829, 835]]
    const bars = findBarStack(runs, MIN, MAX)
    expect(bars).toHaveLength(6)
    expect(bars[0].y0).toBe(523)
    expect(bars[1].y0).toBeGreaterThan(565)
    expect(bars[1].y1).toBeLessThan(626)
    expect(bars[5]).toEqual({ y0: 777, y1: 827 })
  })

  it('rellena la barra que falta dentro de la pila (la resaltada, de otro color)', () => {
    const runs: [number, number][] = [[526, 570], [577, 621], [679, 723], [730, 774]] // falta la de ~628
    const bars = findBarStack(runs, MIN, MAX)
    expect(bars).toHaveLength(5)
    expect(bars[2].y0).toBeGreaterThan(621)
    expect(bars[2].y1).toBeLessThan(679)
  })

  it('sin una pila de barras iguales y regulares no devuelve nada', () => {
    expect(findBarStack([[80, 109], [279, 347], [400, 440]], MIN, MAX)).toEqual([])
    expect(findBarStack([], MIN, MAX)).toEqual([])
  })
})

describe('widestRun y bestCandidate', () => {
  it('la zona con color más ancha de una fila', () => {
    expect(widestRun([false, true, false, true, true, true, false])).toEqual([3, 6])
    expect(widestRun([false, false])).toBeNull()
  })

  it('la lectura más segura, ignorando las vacías', () => {
    expect(bestCandidate([{ text: 'I', confidence: 40 }, { text: '92: ', confidence: 88 }, { text: '', confidence: 99 }])).toEqual({ text: '92: ', confidence: 88 })
    expect(bestCandidate([{ text: ' ', confidence: 90 }])).toBeNull()
  })
})

describe('pickByTag', () => {
  const c = (text: string, confidence: number) => ({ text, confidence })

  it('gana la lectura que empieza por el tag que llevan los de la columna, aunque tenga menos confianza', () => {
    const rows = [
      [c('92: Ines', 80)],
      [c('—_ ES J', 70), c('92:', 55)], // fila que solo lleva el tag: la basura tiene más confianza
      [c('921 sphinx', 70)],
      [c('2: Aegis', 60)], // al OCR se le ha comido el 9
    ]
    expect(pickByTag(rows).map((x) => x?.text)).toEqual(['92: Ines', '92:', '921 sphinx', '2: Aegis'])
  })

  it('una fila sin ninguna lectura que encaje y casi ilegible se toma por una que solo lleva el tag', () => {
    const rows = [[c('92: Ines', 80)], [c('92: sphinx', 80)], [c('—_ ES J', 5)], [c('Mikuel (muy raro)', 70)]]
    expect(pickByTag(rows).map((x) => x?.text)).toEqual(['92: Ines', '92: sphinx', '92:', 'Mikuel (muy raro)'])
  })

  it('sin un tag que se repita, gana la más segura de cada fila', () => {
    expect(pickByTag([[c('Ana 80', 50), c('Ana 8O', 70)], [c('Beto', 40)]]).map((x) => x?.text)).toEqual(['Ana 8O', 'Beto'])
  })

  it('una fila sin ninguna lectura sale como null', () => {
    expect(pickByTag([[c('GO Dani', 90)], [c(' ', 80)], [c('GO Eva', 70)]])[1]).toBeNull()
  })
})
