import { describe, expect, it } from 'vitest'
import { recurringRenewalFrom } from './recurringRenewal'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-15T15:00:00Z')
const at = (days: number) => new Date(now.getTime() + days * DAY).toISOString()
const plan = { id: 'mensual', durationDays: 30 }
const member = (endsAt: string, extra: Partial<{ planId: string; status: 'active' | 'cancelled' }> = {}) => ({
  planId: 'mensual',
  status: 'active' as const,
  endsAt,
  ...extra,
})

describe('recurringRenewalFrom', () => {
  it('plan vencido ayer (en gracia): cuenta desde el fin anterior', () => {
    expect(recurringRenewalFrom([member(at(-1))], plan, now).toISOString()).toBe(at(-1))
  })

  it('gracia vencida (día 34): sigue contando desde el fin anterior', () => {
    expect(recurringRenewalFrom([member(at(-4))], plan, now).toISOString()).toBe(at(-4))
  })

  it('plan vigente: cuenta desde hoy (la base ya suma desde el fin)', () => {
    expect(recurringRenewalFrom([member(at(5))], plan, now)).toBe(now)
  })

  it('más de un mes de atraso: cuenta desde hoy para que el plan quede activo', () => {
    expect(recurringRenewalFrom([member(at(-30))], plan, now)).toBe(now)
    expect(recurringRenewalFrom([member(at(-45))], plan, now)).toBe(now)
  })

  it('usa el último fin del mismo plan e ignora otros planes y cancelados', () => {
    const memberships = [
      member(at(-40)),
      member(at(-2)),
      member(at(-1), { planId: 'trimestral' }),
      member(at(-0.5), { status: 'cancelled' }),
    ]
    expect(recurringRenewalFrom(memberships, plan, now).toISOString()).toBe(at(-2))
  })

  it('sin membresía previa: cuenta desde hoy', () => {
    expect(recurringRenewalFrom([], plan, now)).toBe(now)
  })
})
