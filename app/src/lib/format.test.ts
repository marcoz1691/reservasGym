import { describe, expect, it } from 'vitest'
import {
  ecuadorDateTimeLocalToIso,
  ecuadorLocalDateTimeIso,
  toEcuadorDateTimeLocal,
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

describe('datetime-local en hora de Ecuador (ZCAPP-62)', () => {
  it('21:42 en Ecuador (02:42 UTC del día siguiente) se muestra como 21:42 del mismo día', () => {
    expect(toEcuadorDateTimeLocal('2026-09-28T02:42:00.000Z')).toBe('2026-09-27T21:42')
  })

  it('lo que el socio ve en el campo vuelve al mismo instante al guardar', () => {
    expect(ecuadorDateTimeLocalToIso('2026-09-27T21:42')).toBe('2026-09-28T02:42:00.000Z')
  })

  it('editar sin tocar la fecha no la mueve (ida y vuelta)', () => {
    const iso = '2026-03-15T23:59:00.000Z'
    expect(ecuadorDateTimeLocalToIso(toEcuadorDateTimeLocal(iso))).toBe(iso)
  })

  it('la medianoche se muestra como 00:00, no 24:00', () => {
    expect(toEcuadorDateTimeLocal('2026-09-28T05:00:00.000Z')).toBe('2026-09-28T00:00')
  })
})
