import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncAllRegisteredUsersMkc, syncPlayerRoster } from './mkc'

describe('syncPlayerRoster', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('devuelve vacío y actualiza mkc_synced_at si no tiene discord_id ni mkc_player_id', async () => {
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return { update: updateMock }
        return {}
      }),
    } as any

    const res = await syncPlayerRoster(adminMock, {
      id: 'user-1',
      discord_id: null,
      mkc_player_id: null,
    })

    expect(res.ok).toBe(true)
    expect(res.mkcPlayer).toBeNull()
    expect(res.teams).toEqual([])
    expect(updateMock).toHaveBeenCalled()
  })

  it('sincroniza equipos correctamente cuando el jugador existe en MKC por mkc_player_id', async () => {
    const upsertTeamsMock = vi.fn().mockResolvedValue({ error: null })
    const deleteMembersMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const insertMembersMock = vi.fn().mockResolvedValue({ error: null })
    const updateProfileMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'teams') return { upsert: upsertTeamsMock }
        if (table === 'team_members') return { delete: deleteMembersMock, insert: insertMembersMock }
        if (table === 'profiles') return { update: updateProfileMock }
        return {}
      }),
    } as any

    // Mock fetch a detalle de jugador MKC
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 75162,
        country_code: 'ES',
        rosters: [
          {
            team_id: 3505,
            team_name: 'Nebulosa',
            team_tag: 'NB',
            roster_tag: 'NB',
            team_color: 8,
            game: 'mkworld',
          },
          {
            team_id: 9999,
            team_name: 'Other Game Team',
            team_tag: 'OG',
            game: 'mk8dx',
          },
        ],
      }),
    }))

    const res = await syncPlayerRoster(adminMock, {
      id: 'user-1',
      discord_id: '123456',
      mkc_player_id: 75162,
    })

    expect(res.ok).toBe(true)
    expect(res.mkcPlayer).toBe(75162)
    expect(res.teams).toEqual(['NB'])
    expect(res.country).toBe('ES')

    // Verifica que solo el equipo de mkworld se haya enviado a teams
    expect(upsertTeamsMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 3505,
          name: 'Nebulosa',
          tag: 'NB',
        }),
      ],
      { onConflict: 'id' }
    )

    // Verifica que se hayan insertado las membresías
    expect(insertMembersMock).toHaveBeenCalledWith([{ team_id: 3505, profile_id: 'user-1' }])

    // Verifica que el perfil se haya actualizado con el país y timestamp
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mkc_player_id: 75162,
        country_code: 'ES',
      })
    )
  })

  it('busca por discord_id si mkc_player_id no está definido', async () => {
    const upsertTeamsMock = vi.fn().mockResolvedValue({ error: null })
    const deleteMembersMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const insertMembersMock = vi.fn().mockResolvedValue({ error: null })
    const updateProfileMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'teams') return { upsert: upsertTeamsMock }
        if (table === 'team_members') return { delete: deleteMembersMock, insert: insertMembersMock }
        if (table === 'profiles') return { update: updateProfileMock }
        return {}
      }),
    } as any

    // Mock fetch: primero búsqueda por discord_id, luego detalle de jugador
    let callCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        callCount++
        if (url.includes('discord_id=')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ player_list: [{ id: 1001, country_code: 'FR' }] }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 1001,
            country_code: 'FR',
            rosters: [
              {
                team_id: 200,
                team_name: 'Solar Storm',
                team_tag: 'SS',
                game: 'mkworld',
              },
            ],
          }),
        }
      })
    )

    const res = await syncPlayerRoster(adminMock, {
      id: 'user-2',
      discord_id: '998877',
      mkc_player_id: null,
    })

    expect(callCount).toBe(2)
    expect(res.ok).toBe(true)
    expect(res.mkcPlayer).toBe(1001)
    expect(res.teams).toEqual(['SS'])
    expect(res.country).toBe('FR')
  })
})

describe('syncAllRegisteredUsersMkc', () => {
  it('procesa usuarios desactualizados en lote', async () => {
    const mockUsers = [
      { id: 'u1', discord_id: 'd1', mkc_player_id: 1, mkc_synced_at: null },
      { id: 'u2', discord_id: 'd2', mkc_player_id: 2, mkc_synced_at: '2026-01-01' },
    ]

    const limitMock = vi.fn().mockResolvedValue({ data: mockUsers, error: null })
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock })
    const orMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ or: orMock })

    const updateProfileMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return { select: selectMock, update: updateProfileMock }
        if (table === 'teams') return { upsert: vi.fn().mockResolvedValue({ error: null }) }
        if (table === 'team_members') {
          return {
            delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    } as any

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 1, country_code: 'ES', rosters: [] }),
      })
    )

    const result = await syncAllRegisteredUsersMkc(adminMock, { olderThanHours: 24, maxUsers: 10, delayMs: 0 })

    expect(result.checked).toBe(2)
    expect(result.updated).toBe(2)
    expect(result.errors).toBe(0)
  })
})
