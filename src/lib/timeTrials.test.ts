import { describe, expect, it } from 'vitest'
import { bestPerPlayer, type TimeTrial } from './timeTrials'

const t = (id: number, player_name: string, time_ms: number, profile_id: string | null = null): TimeTrial => ({
  id,
  track_id: 'rainbow-road',
  category: 'race',
  nita: false,
  time_ms,
  player_name,
  country_code: null,
  proof_url: null,
  achieved_on: null,
  source: 'manual',
  profile_id,
})

describe('bestPerPlayer', () => {
  it('se queda con el mejor tiempo de cada jugador y ordena', () => {
    const r = bestPerPlayer([t(1, 'Peckmat', 300), t(2, 'Vike', 200), t(3, 'peckmat ', 150)])
    expect(r.map((x) => x.id)).toEqual([3, 2])
  })

  it('agrupa por usuario registrado aunque cambie el nombre', () => {
    const r = bestPerPlayer([t(1, 'Peckmat', 300, 'u1'), t(2, 'tortelini', 250, 'u1'), t(3, 'Peckmat', 280)])
    expect(r.map((x) => x.id)).toEqual([2, 3])
  })
})
