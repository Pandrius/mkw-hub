import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventDetail, EventPlayer, EventRace, GameEvent } from '../events'
import type { BotStore, TeamRef } from './bot.js'

/**
 * BotStore sobre Supabase con la clave secreta (service_role).
 * Toda la escritura de eventos pasa por las funciones bot_* de la migración 0012, que fijan
 * el perfil de quien ejecuta el comando y llaman a las mismas funciones que usa la web.
 */
export function supabaseBotStore(db: SupabaseClient): BotStore {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data as T
  }
  const check = <T>(res: { data: T; error: { message: string } | null }): T => {
    if (res.error) throw new Error(res.error.message)
    return res.data
  }

  return {
    profileForDiscord: (discordUserId) =>
      rpc<string | null>('bot_profile_for_discord', { discord_user_id: discordUserId }),

    async getActive(channelId) {
      const row = check(
        await db.from('discord_channel_events').select('event_id, lineup').eq('channel_id', channelId).maybeSingle(),
      ) as { event_id: string; lineup: (number | string)[] | null } | null
      return row ? { eventId: row.event_id, lineup: (row.lineup ?? []).map(Number) } : null
    },

    async setActive(channelId, active, startedBy) {
      check(
        await db.from('discord_channel_events').upsert({
          channel_id: channelId,
          event_id: active.eventId,
          lineup: active.lineup,
          started_by: startedBy,
          updated_at: new Date().toISOString(),
        }),
      )
    },

    async setLineup(channelId, lineup) {
      check(
        await db
          .from('discord_channel_events')
          .update({ lineup, updated_at: new Date().toISOString() })
          .eq('channel_id', channelId),
      )
    },

    // Mismas consultas que getEvent() de src/lib/events.ts (que usa el cliente del navegador)
    async getEvent(eventId) {
      const [ev, players, races] = await Promise.all([
        db.from('events').select('*').eq('id', eventId).maybeSingle(),
        db.from('event_players').select('id, event_id, name, profile_id').eq('event_id', eventId).order('id'),
        db
          .from('event_races')
          .select('id, race_no, track_id, missing_home, missing_away, opponent_results, race_results(player_id, position)')
          .eq('event_id', eventId)
          .order('race_no'),
      ])
      const event = check(ev) as GameEvent | null
      if (!event) return null
      return { event, players: check(players) as EventPlayer[], races: check(races) as EventRace[] } satisfies EventDetail
    },

    async teamsOf(profileId) {
      const rows = check(
        await db.from('team_members').select('teams(id, name, tag)').eq('profile_id', profileId),
      ) as unknown as { teams: TeamRef | TeamRef[] | null }[]
      return rows.flatMap((r) => (Array.isArray(r.teams) ? r.teams : r.teams ? [r.teams] : []))
    },

    async teamsByTag(tag) {
      // ilike sin comodines = igual sin distinguir mayúsculas (se escapan % y _)
      const pattern = tag.replace(/[\\%_]/g, (c) => `\\${c}`)
      return check(await db.from('teams').select('id, name, tag').ilike('tag', pattern).limit(5)) as TeamRef[]
    },

    canEdit: (actor, eventId) => rpc<boolean>('bot_can_edit_event', { actor, target: eventId }),

    createEvent: (actor, a) =>
      rpc<string>('bot_create_event', {
        actor,
        kind: a.kind,
        team_tag: a.teamTag,
        opponent_tag: a.opponentTag,
        players: a.players,
        team_id: a.teamId,
        team_name: a.teamName,
        opponent_team_id: a.opponentTeamId,
        opponent_name: a.opponentName,
      }),

    addPlayer: (actor, eventId, entry) => rpc<number>('bot_add_event_player', { actor, target: eventId, entry }),

    saveRace: (actor, eventId, raceNo, trackId, results, missingHome, missingAway) =>
      rpc<void>('bot_save_race', {
        actor,
        target: eventId,
        race_no: raceNo,
        track_id: trackId,
        results,
        missing_home: missingHome,
        missing_away: missingAway,
      }),

    finishEvent: (actor, eventId) => rpc<void>('bot_finish_event', { actor, target: eventId }),
  }
}
