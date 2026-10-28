import { describe, expect, it } from 'vitest'
import type { Membership, MembershipPlan } from '../models'
import {
  QUEUED_PLAN_LIMIT_MESSAGE,
  activeDayPasses,
  currentMembership,
  endOfGymDay,
  memberMembership,
  planChangeCredit,
  planPurchaseDates,
  planPurchaseOutcome,
  queuedMembership,
} from './memberships'

const DAY_MS = 24 * 60 * 60 * 1000

function plan(partial: Partial<MembershipPlan> & Pick<MembershipPlan, 'id'>): MembershipPlan {
  return {
    name: partial.id,
    priceCents: 3000,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
    kind: 'membership',
    ...partial,
  }
}

function membership(
  partial: Partial<Membership> & Pick<Membership, 'id' | 'planId' | 'startsAt' | 'endsAt'>,
): Membership {
  const graceEndsAt = new Date(new Date(partial.endsAt).getTime() + 3 * DAY_MS).toISOString()
  return {
    userId: 'u1',
    status: 'active',
    visitsLeft: null,
    graceEndsAt,
    ...partial,
  }
}

const start = plan({ id: 'start', name: 'Zero Start Mensual', priceCents: 3000 })
const pro = plan({ id: 'pro', name: 'Zero Pro Mensual', priceCents: 5000 })
const elite = plan({ id: 'elite', name: 'Zero Elite Mensual', priceCents: 7500 })
const day = plan({
  id: 'day-full',
  name: 'Zona Day Full',
  priceCents: 1000,
  durationDays: 1,
  kind: 'day_pass',
})
const plans = [start, pro, elite, day]

const now = new Date('2026-10-15T15:00:00.000Z')

const current = membership({
  id: 'cur',
  planId: 'start',
  startsAt: '2026-10-01T05:00:00.000Z',
  endsAt: '2026-10-31T05:00:00.000Z',
})
const queued = membership({
  id: 'next',
  planId: 'pro',
  startsAt: '2026-10-31T05:00:00.000Z',
  endsAt: '2026-11-30T05:00:00.000Z',
})
const pass = membership({
  id: 'pass',
  planId: 'day-full',
  startsAt: '2026-10-15T14:00:00.000Z',
  endsAt: '2026-10-16T04:59:59.000Z',
  graceEndsAt: '2026-10-16T04:59:59.000Z',
})

describe('currentMembership', () => {
  it('ignora el plan en espera y los pases del día', () => {
    expect(currentMembership([queued, pass, current], plans, now)?.id).toBe('cur')
  })

  it('sin membresía iniciada devuelve null aunque haya un pase activo', () => {
    expect(currentMembership([pass], plans, now)).toBeNull()
  })

  it('si dos filas están vigentes elige la que termina más tarde', () => {
    const later = membership({
      id: 'later',
      planId: 'pro',
      startsAt: '2026-10-10T05:00:00.000Z',
      endsAt: '2026-11-09T05:00:00.000Z',
    })
    expect(currentMembership([current, later], plans, now)?.id).toBe('later')
  })

  it('una membresía cancelada no es vigente', () => {
    expect(currentMembership([{ ...current, status: 'cancelled' }], plans, now)).toBeNull()
  })
})

describe('queuedMembership y activeDayPasses', () => {
  it('el plan en espera es la fila que todavía no empieza', () => {
    expect(queuedMembership([current, queued, pass], plans, now)?.id).toBe('next')
  })

  it('el pase del día solo está activo ese día', () => {
    expect(activeDayPasses([current, pass], plans, now).map((m) => m.id)).toEqual(['pass'])
    const tomorrow = new Date('2026-10-16T12:00:00.000Z')
    expect(activeDayPasses([pass], plans, tomorrow)).toEqual([])
  })
})

describe('memberMembership', () => {
  it('sin plan vigente devuelve la última membresía para mostrar su estado', () => {
    const expired = membership({
      id: 'old',
      planId: 'start',
      startsAt: '2026-08-01T05:00:00.000Z',
      endsAt: '2026-08-31T05:00:00.000Z',
    })
    const shown = memberMembership([expired, pass], plans, now)
    expect(shown?.id).toBe('old')
    expect(shown?.status).toBe('expired')
  })

  it('nunca muestra un pase del día como membresía', () => {
    expect(memberMembership([pass], plans, now)).toBeNull()
  })
})

describe('endOfGymDay', () => {
  it('termina a las 23:59:59 de Guayaquil', () => {
    expect(endOfGymDay(new Date('2026-10-15T15:00:00.000Z')).toISOString()).toBe(
      '2026-10-16T04:59:59.000Z',
    )
    // 21:00 en Guayaquil sigue siendo el mismo día local
    expect(endOfGymDay(new Date('2026-10-16T02:00:00.000Z')).toISOString()).toBe(
      '2026-10-16T04:59:59.000Z',
    )
  })
})

describe('planPurchaseOutcome', () => {
  it('sin plan vigente crea una membresía nueva desde hoy', () => {
    expect(planPurchaseOutcome({ memberships: [], plans, plan: start, now })).toEqual({
      kind: 'new',
      startsAt: now.toISOString(),
    })
  })

  it('el mismo plan suma días al vigente', () => {
    const outcome = planPurchaseOutcome({ memberships: [current], plans, plan: start, now })
    expect(outcome.kind).toBe('extend')
    if (outcome.kind === 'extend') expect(outcome.target.id).toBe('cur')
  })

  it('el mismo plan suma días y conserva la fecha de inicio', () => {
    const outcome = planPurchaseOutcome({ memberships: [current], plans, plan: start, now })
    const dates = planPurchaseDates(outcome, start, now)
    expect(dates.startsAt).toBe(current.startsAt)
    expect(dates.endsAt).toBe('2026-11-30T05:00:00.000Z')
  })

  it('otro plan queda en espera desde el fin del vigente', () => {
    expect(planPurchaseOutcome({ memberships: [current], plans, plan: pro, now })).toEqual({
      kind: 'queue',
      startsAt: current.endsAt,
    })
  })

  it('un segundo plan distinto se rechaza', () => {
    expect(
      planPurchaseOutcome({ memberships: [current, queued], plans, plan: elite, now }),
    ).toEqual({ kind: 'reject', reason: QUEUED_PLAN_LIMIT_MESSAGE })
  })

  it('el mismo plan que está en espera le suma días', () => {
    const outcome = planPurchaseOutcome({ memberships: [current, queued], plans, plan: pro, now })
    expect(outcome.kind).toBe('extend')
    if (outcome.kind === 'extend') expect(outcome.target.id).toBe('next')
    const dates = planPurchaseDates(outcome, pro, now)
    expect(dates.startsAt).toBe(queued.startsAt)
    expect(dates.endsAt).toBe('2026-12-30T05:00:00.000Z')
  })

  it('renovar el vigente con un plan en espera corre ese plan', () => {
    const outcome = planPurchaseOutcome({ memberships: [current, queued], plans, plan: start, now })
    expect(outcome.kind).toBe('extend')
    if (outcome.kind === 'extend') expect(outcome.queued?.id).toBe('next')
  })

  it('en gracia, otro plan empieza hoy y no desde la fecha vencida', () => {
    const grace = membership({
      id: 'grace',
      planId: 'start',
      startsAt: '2026-09-14T05:00:00.000Z',
      endsAt: '2026-10-14T05:00:00.000Z',
    })
    expect(planPurchaseOutcome({ memberships: [grace], plans, plan: pro, now })).toEqual({
      kind: 'new',
      startsAt: now.toISOString(),
    })
  })

  it('Zona Day con plan es un pase aparte que no toca la membresía', () => {
    expect(
      planPurchaseOutcome({ memberships: [current, queued], plans, plan: day, now }),
    ).toEqual({
      kind: 'day_pass',
      startsAt: now.toISOString(),
      endsAt: '2026-10-16T04:59:59.000Z',
    })
  })

  it('Zona Day sin plan también es un pase del día', () => {
    expect(planPurchaseOutcome({ memberships: [], plans, plan: day, now }).kind).toBe('day_pass')
  })

  it('reconoce un Zona Day sin kind por su nombre (datos viejos)', () => {
    const legacy = { ...day, kind: undefined }
    expect(
      planPurchaseOutcome({ memberships: [current], plans: [start, legacy], plan: legacy, now })
        .kind,
    ).toBe('day_pass')
  })
})

describe('planChangeCredit', () => {
  // Zero Start $30 del 1 al 31 de octubre; el 15 se pasa a otro plan
  const october = membership({
    id: 'oct',
    planId: 'start',
    startsAt: '2026-10-01T05:00:00.000Z',
    endsAt: '2026-10-31T05:00:00.000Z',
  })

  it('acredita los días no usados en proporción al precio', () => {
    expect(planChangeCredit(october, start, new Date('2026-10-15T15:00:00.000Z'))).toBe(1600)
  })

  it('el mismo día de la compra da el crédito completo', () => {
    expect(planChangeCredit(october, start, new Date('2026-10-01T15:00:00.000Z'))).toBe(3000)
  })

  it('nunca es negativo', () => {
    expect(planChangeCredit(october, start, new Date('2026-11-02T15:00:00.000Z'))).toBe(0)
  })

  it('sin plan no hay crédito', () => {
    expect(planChangeCredit(october, null, now)).toBe(0)
  })
})
