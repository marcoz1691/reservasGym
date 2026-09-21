import { describe, expect, it } from 'vitest'
import {
  ecuadorLocalDateTimeIso,
  ecuadorTodayYmd,
  formatEcuadorSessionWhen,
} from './format'

describe('ecuadorLocalDateTimeIso', () => {
  it('interprets wall clock as America/Guayaquil, not UTC midnight', () => {
    const iso = ecuadorLocalDateTimeIso('2026-09-21', '19:00')
    expect(iso).toBe('2026-09-22T00:00:00.000Z')
    expect(formatEcuadorSessionWhen(iso)).toMatch(/21 sept/i)
    expect(formatEcuadorSessionWhen(iso)).toMatch(/19:00/)
  })
})

describe('ecuadorTodayYmd', () => {
  it('returns YYYY-MM-DD in Ecuador even when UTC already rolled to next day', () => {
    const utcSep21Dawn = new Date('2026-09-21T04:30:00.000Z') // 23:30 Ecuador Sep 20
    expect(ecuadorTodayYmd(utcSep21Dawn)).toBe('2026-09-20')
  })
})
