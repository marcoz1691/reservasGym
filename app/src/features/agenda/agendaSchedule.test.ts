import { describe, expect, it } from 'vitest'
import { ecuadorTodayYmd } from '@/lib/format'
import {
  nextOpenDayYmd,
  rescheduleChoices,
  sessionStillOpen,
  weekYmds,
} from './agendaSchedule'

describe('agendaSchedule', () => {
  it('arma la semana de lunes a domingo en calendario', () => {
    expect(weekYmds('2026-09-22')).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ])
  })

  it('no ofrece una clase que ya terminó y apunta al siguiente día con cupo', () => {
    const now = new Date('2026-09-22T06:45:00.000Z')
    const ended = {
      startsAt: '2026-09-22T00:00:00.000Z',
      endsAt: '2026-09-22T01:00:00.000Z',
    }
    const tomorrow = {
      startsAt: '2026-09-23T12:00:00.000Z',
      endsAt: '2026-09-23T13:00:00.000Z',
    }
    expect(sessionStillOpen(ended.endsAt, now)).toBe(false)
    expect(ecuadorTodayYmd(ended.startsAt)).toBe('2026-09-21')
    expect(nextOpenDayYmd([ended, tomorrow], '2026-09-22', now)).toBe('2026-09-23')
  })

  it('el desplegable de reagendar solo lista la misma área que aún no empieza', () => {
    const now = new Date('2026-09-22T06:45:00.000Z')
    const choices = rescheduleChoices(
      [
        {
          id: 'past',
          zoneId: 'zone-gimnasio',
          startsAt: '2026-09-22T00:00:00.000Z',
        },
        {
          id: 'current',
          zoneId: 'zone-gimnasio',
          startsAt: '2026-09-22T18:00:00.000Z',
        },
        {
          id: 'gym-next',
          zoneId: 'zone-gimnasio',
          startsAt: '2026-09-23T12:00:00.000Z',
        },
        {
          id: 'hyrox',
          zoneId: 'zone-hyrox',
          startsAt: '2026-09-23T12:00:00.000Z',
        },
      ],
      'current',
      'zone-gimnasio',
      now,
    )
    expect(choices.map((session) => session.id)).toEqual(['gym-next'])
  })
})