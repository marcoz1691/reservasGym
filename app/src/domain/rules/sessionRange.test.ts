import { describe, expect, it } from 'vitest'
import { DEFAULT_WEEKDAYS, MAX_RANGE_DAYS, expandSessionDates, rangeDays } from './sessionRange'

describe('expandSessionDates', () => {
  it('sin fecha final devuelve solo el inicio', () => {
    expect(expandSessionDates('2026-10-19', '', [1])).toEqual(['2026-10-19'])
    expect(expandSessionDates('2026-10-19', null, [1])).toEqual(['2026-10-19'])
  })

  it('una semana de lunes a viernes', () => {
    // 19 oct 2026 es lunes
    expect(expandSessionDates('2026-10-19', '2026-10-25', DEFAULT_WEEKDAYS)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ])
  })

  it('incluye sábado y domingo si se eligen', () => {
    expect(expandSessionDates('2026-10-19', '2026-10-25', [0, 1, 2, 3, 4, 5, 6])).toHaveLength(7)
    expect(expandSessionDates('2026-10-19', '2026-10-25', [6, 0])).toEqual([
      '2026-10-24',
      '2026-10-25',
    ])
  })

  it('un mes completo cruza el cambio de mes', () => {
    const dates = expandSessionDates('2026-10-26', '2026-11-08', [1])
    expect(dates).toEqual(['2026-10-26', '2026-11-02'])
  })

  it('rechaza rangos invertidos o fechas inválidas', () => {
    expect(expandSessionDates('2026-10-25', '2026-10-19', [1])).toEqual([])
    expect(expandSessionDates('no-fecha', '2026-10-19', [1])).toEqual([])
  })

  it('no pasa del máximo de días', () => {
    const dates = expandSessionDates('2026-01-01', '2027-12-31', [0, 1, 2, 3, 4, 5, 6])
    expect(dates.length).toBeLessThanOrEqual(MAX_RANGE_DAYS + 1)
  })
})

describe('rangeDays', () => {
  it('cuenta ambos extremos', () => {
    expect(rangeDays('2026-10-19', '2026-10-19')).toBe(1)
    expect(rangeDays('2026-10-19', '2026-10-25')).toBe(7)
    expect(rangeDays('2026-10-25', '2026-10-19')).toBe(0)
  })
})
