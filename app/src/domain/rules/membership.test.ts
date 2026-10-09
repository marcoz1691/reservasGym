import { describe, expect, it, vi } from 'vitest'
import type { Membership, MembershipPlan } from '../models'
import {
  EXPIRATION_WARNING_DAYS,
  GRACE_PERIOD_DAYS,
  canBookMembership,
  canUseBookingNav,
  computeMembershipStatus,
  daysRemaining,
  extendMembership,
  isInGracePeriod,
  isMembershipValid,
  isNearExpiration,
} from './membership'

describe('domain/rules/membership', () => {
  const baseMembership: Membership = {
    id: 'mem-1',
    userId: 'usr-1',
    planId: 'plan-monthly',
    status: 'active',
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-10-01T00:00:00.000Z',
    visitsLeft: null,
    graceEndsAt: '2026-10-04T00:00:00.000Z',
  }

  const basePlan: MembershipPlan = {
    id: 'plan-monthly',
    name: 'Plan Mensual Premium',
    priceCents: 5000,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
  }

  describe('constants', () => {
    it('has correct default grace period and expiration warning days', () => {
      expect(GRACE_PERIOD_DAYS).toBe(3)
      expect(EXPIRATION_WARNING_DAYS).toBe(7)
    })
  })

  describe('computeMembershipStatus', () => {
    it('returns cancelled if status is cancelled even if endsAt is in future', () => {
      const status = computeMembershipStatus(
        { ...baseMembership, status: 'cancelled' },
        new Date('2026-09-15T00:00:00.000Z'),
      )
      expect(status).toBe('cancelled')
    })

    it('returns active when now is before endsAt', () => {
      const status = computeMembershipStatus(
        baseMembership,
        new Date('2026-09-15T00:00:00.000Z'),
      )
      expect(status).toBe('active')
    })

    it('returns active when now is exactly at endsAt', () => {
      const status = computeMembershipStatus(
        baseMembership,
        new Date('2026-10-01T00:00:00.000Z'),
      )
      expect(status).toBe('active')
    })

    it('returns grace when now is after endsAt but within graceEndsAt', () => {
      const status = computeMembershipStatus(
        baseMembership,
        new Date('2026-10-02T12:00:00.000Z'),
      )
      expect(status).toBe('grace')
    })

    it('returns grace when now is exactly at graceEndsAt', () => {
      const status = computeMembershipStatus(
        baseMembership,
        new Date('2026-10-04T00:00:00.000Z'),
      )
      expect(status).toBe('grace')
    })

    it('computes graceEndsAt dynamically if graceEndsAt is null', () => {
      const membershipWithoutGrace: Pick<Membership, 'endsAt' | 'graceEndsAt' | 'status'> = {
        endsAt: '2026-10-01T00:00:00.000Z',
        graceEndsAt: null,
        status: 'active',
      }
      // 2 days after endsAt -> within 3 days default grace
      expect(
        computeMembershipStatus(membershipWithoutGrace, new Date('2026-10-03T00:00:00.000Z')),
      ).toBe('grace')

      // 4 days after endsAt -> expired
      expect(
        computeMembershipStatus(membershipWithoutGrace, new Date('2026-10-05T00:00:00.000Z')),
      ).toBe('expired')
    })

    it('returns expired when now is past graceEndsAt', () => {
      const status = computeMembershipStatus(
        baseMembership,
        new Date('2026-10-04T00:00:01.000Z'),
      )
      expect(status).toBe('expired')
    })
  })

  describe('isMembershipValid', () => {
    it('returns false for null or undefined membership', () => {
      expect(isMembershipValid(null)).toBe(false)
      expect(isMembershipValid(undefined)).toBe(false)
    })

    it('returns true when active', () => {
      expect(
        isMembershipValid(baseMembership, new Date('2026-09-15T00:00:00.000Z')),
      ).toBe(true)
    })

    it('returns true when in grace period', () => {
      expect(
        isMembershipValid(baseMembership, new Date('2026-10-02T00:00:00.000Z')),
      ).toBe(true)
    })

    it('returns false when expired', () => {
      expect(
        isMembershipValid(baseMembership, new Date('2026-10-10T00:00:00.000Z')),
      ).toBe(false)
    })

    it('returns false when cancelled', () => {
      expect(
        isMembershipValid(
          { ...baseMembership, status: 'cancelled' },
          new Date('2026-09-15T00:00:00.000Z'),
        ),
      ).toBe(false)
    })
  })

  describe('canBookMembership', () => {
    it('blocks booking when membership is null or undefined', () => {
      const res = canBookMembership(null)
      expect(res.allowed).toBe(false)
      expect(res.status).toBe('none')
      expect(res.reason).toBeDefined()
    })

    it('blocks booking when membership is cancelled', () => {
      const res = canBookMembership(
        { ...baseMembership, status: 'cancelled' },
        new Date('2026-09-15T00:00:00.000Z'),
      )
      expect(res.allowed).toBe(false)
      expect(res.status).toBe('cancelled')
      expect(res.reason).toContain('cancelada')
    })

    it('blocks booking when membership is expired', () => {
      const res = canBookMembership(
        baseMembership,
        new Date('2026-10-10T00:00:00.000Z'),
      )
      expect(res.allowed).toBe(false)
      expect(res.status).toBe('expired')
      expect(res.reason).toContain('vencida')
    })

    it('allows booking when active with unlimited visits (visitsLeft = null)', () => {
      const res = canBookMembership(
        baseMembership,
        new Date('2026-09-15T00:00:00.000Z'),
      )
      expect(res.allowed).toBe(true)
      expect(res.status).toBe('active')
    })

    it('allows booking when in grace period', () => {
      const res = canBookMembership(
        baseMembership,
        new Date('2026-10-02T00:00:00.000Z'),
      )
      expect(res.allowed).toBe(true)
      expect(res.status).toBe('grace')
    })

    it('allows booking when active with visits left > 0', () => {
      const res = canBookMembership(
        { ...baseMembership, visitsLeft: 5 },
        new Date('2026-09-15T00:00:00.000Z'),
      )
      expect(res.allowed).toBe(true)
      expect(res.status).toBe('active')
    })

    it('blocks booking when visitsLeft is 0', () => {
      const res = canBookMembership(
        { ...baseMembership, visitsLeft: 0 },
        new Date('2026-09-15T00:00:00.000Z'),
      )
      expect(res.allowed).toBe(false)
      expect(res.status).toBe('active')
      expect(res.reason).toContain('visitas')
    })
  })

  describe('daysRemaining', () => {
    // endsAt 2026-10-01T00:00:00.000Z = 2026-09-30 19:00 America/Guayaquil
    it('usa días de calendario America/Guayaquil (ZC18-O2)', () => {
      const now = new Date('2026-09-24T00:00:00.000Z') // 23 sep 19:00 Guayaquil
      expect(daysRemaining(baseMembership, now)).toBe(7)
    })

    it('cuenta el día calendario actual hacia el vencimiento', () => {
      const now = new Date('2026-09-24T12:00:00.000Z') // 24 sep Guayaquil
      expect(daysRemaining(baseMembership, now)).toBe(6)
    })

    it('mismo día calendario que endsAt → 1 (último día)', () => {
      const now = new Date('2026-10-01T00:00:00.000Z')
      expect(daysRemaining(baseMembership, now)).toBe(1)
    })

    it('returns 0 when now is past endsAt calendar day', () => {
      const now = new Date('2026-10-05T00:00:00.000Z')
      expect(daysRemaining(baseMembership, now)).toBe(0)
    })

    it('alinea medianoche Guayaquil con la fecha mostrada', () => {
      // 1 oct 00:30 Guayaquil = 1 oct 05:30 UTC — ya pasó endsAt absoluto,
      // pero comprobamos solo días entre claves de fecha locales.
      const mem = {
        ...baseMembership,
        endsAt: '2026-10-01T05:00:00.000Z', // 1 oct 00:00 Guayaquil
      }
      const sameLocalMorning = new Date('2026-10-01T05:30:00.000Z')
      expect(daysRemaining(mem, sameLocalMorning)).toBe(1)
      const nextLocalDay = new Date('2026-10-02T05:00:00.000Z')
      expect(daysRemaining(mem, nextLocalDay)).toBe(0)
    })
  })

  describe('isNearExpiration', () => {
    it('returns true when remaining days <= 7 and > 0', () => {
      const now = new Date('2026-09-25T00:00:00.000Z') // 6 days left
      expect(isNearExpiration(baseMembership, 7, now)).toBe(true)
    })

    it('returns true exactly on warning boundary (7 days)', () => {
      const now = new Date('2026-09-24T00:00:00.000Z') // 7 days left
      expect(isNearExpiration(baseMembership, 7, now)).toBe(true)
    })

    it('returns false when remaining days > 7', () => {
      const now = new Date('2026-09-20T00:00:00.000Z') // 11 days left
      expect(isNearExpiration(baseMembership, 7, now)).toBe(false)
    })

    it('returns false when already expired (0 days left)', () => {
      const now = new Date('2026-10-02T00:00:00.000Z')
      expect(isNearExpiration(baseMembership, 7, now)).toBe(false)
    })

    it('returns false when cancelled regardless of days', () => {
      const now = new Date('2026-09-25T00:00:00.000Z')
      expect(isNearExpiration({ ...baseMembership, status: 'cancelled' }, 7, now)).toBe(false)
    })

    it('uses custom warningDays when provided', () => {
      const now = new Date('2026-09-20T00:00:00.000Z') // 11 days left
      expect(isNearExpiration(baseMembership, 15, now)).toBe(true)
      expect(isNearExpiration(baseMembership, 10, now)).toBe(false)
    })
  })

  describe('isInGracePeriod', () => {
    it('returns false when still active', () => {
      expect(isInGracePeriod(baseMembership, new Date('2026-09-20T00:00:00.000Z'))).toBe(false)
    })

    it('returns true when past endsAt but within graceEndsAt', () => {
      expect(isInGracePeriod(baseMembership, new Date('2026-10-02T00:00:00.000Z'))).toBe(true)
    })

    it('returns false when past graceEndsAt', () => {
      expect(isInGracePeriod(baseMembership, new Date('2026-10-05T00:00:00.000Z'))).toBe(false)
    })

    it('returns false if cancelled', () => {
      expect(
        isInGracePeriod(
          { ...baseMembership, status: 'cancelled' },
          new Date('2026-10-02T00:00:00.000Z'),
        ),
      ).toBe(false)
    })
  })

  describe('extendMembership', () => {
    it('creates new membership from scratch (no current membership)', () => {
      const paidAt = '2026-09-01T10:00:00.000Z'
      const res = extendMembership(null, basePlan, paidAt)

      expect(res.startsAt).toBe('2026-09-01T10:00:00.000Z')
      expect(res.endsAt).toBe('2026-10-01T10:00:00.000Z')
      expect(res.graceEndsAt).toBe('2026-10-04T10:00:00.000Z')
      expect(res.status).toBe('active')
      expect(res.visitsLeft).toBeNull()
    })

    it('starts extension from current.endsAt when current membership is active', () => {
      const currentActive: Membership = {
        ...baseMembership,
        endsAt: '2026-10-01T00:00:00.000Z',
      }
      const paidAt = '2026-09-20T10:00:00.000Z' // Paid 10 days before expiration

      const res = extendMembership(currentActive, basePlan, paidAt)

      // Suma días al plan vigente: conserva la fecha de inicio original
      expect(res.startsAt).toBe('2026-09-01T00:00:00.000Z')
      expect(res.endsAt).toBe('2026-10-31T00:00:00.000Z')
      expect(res.graceEndsAt).toBe('2026-11-03T00:00:00.000Z')
      expect(res.status).toBe('active')
    })

    it('en gracia suma desde el pago y conserva la fecha de inicio', () => {
      const currentGrace: Membership = {
        ...baseMembership,
        endsAt: '2026-09-09T00:00:00.000Z',
        graceEndsAt: '2026-09-12T00:00:00.000Z',
      }
      const res = extendMembership(currentGrace, basePlan, '2026-09-10T12:00:00.000Z')

      expect(res.startsAt).toBe('2026-09-01T00:00:00.000Z')
      expect(res.endsAt).toBe('2026-10-10T12:00:00.000Z')
    })

    it('starts from paidAt when current membership is expired or in grace', () => {
      const currentExpired: Membership = {
        ...baseMembership,
        endsAt: '2026-09-01T00:00:00.000Z',
        graceEndsAt: '2026-09-04T00:00:00.000Z',
        status: 'expired',
      }
      const paidAt = '2026-09-10T12:00:00.000Z'

      const res = extendMembership(currentExpired, basePlan, paidAt)

      expect(res.startsAt).toBe('2026-09-10T12:00:00.000Z')
      expect(res.endsAt).toBe('2026-10-10T12:00:00.000Z')
      expect(res.graceEndsAt).toBe('2026-10-13T12:00:00.000Z')
      expect(res.status).toBe('active')
    })

    it('starts from paidAt when current membership was cancelled', () => {
      const currentCancelled: Membership = {
        ...baseMembership,
        endsAt: '2026-10-01T00:00:00.000Z',
        status: 'cancelled',
      }
      const paidAt = '2026-09-15T00:00:00.000Z'

      const res = extendMembership(currentCancelled, basePlan, paidAt)

      expect(res.startsAt).toBe('2026-09-15T00:00:00.000Z')
      expect(res.endsAt).toBe('2026-10-15T00:00:00.000Z')
      expect(res.graceEndsAt).toBe('2026-10-18T00:00:00.000Z')
    })

    it('accumulates visitQuota when active membership has quota', () => {
      const punchPlan: MembershipPlan = {
        ...basePlan,
        visitQuota: 10,
      }
      const currentPunch: Membership = {
        ...baseMembership,
        endsAt: '2026-10-01T00:00:00.000Z',
        visitsLeft: 3,
      }
      const paidAt = '2026-09-20T00:00:00.000Z'

      const res = extendMembership(currentPunch, punchPlan, paidAt)
      expect(res.visitsLeft).toBe(13)
    })

    it('sets initial visitQuota on new punch card membership', () => {
      const punchPlan: MembershipPlan = {
        ...basePlan,
        visitQuota: 12,
      }
      const res = extendMembership(null, punchPlan, '2026-09-01T00:00:00.000Z')
      expect(res.visitsLeft).toBe(12)
    })
  })

  describe('plan en espera (scheduled)', () => {
    const scheduled: Membership = {
      ...baseMembership,
      startsAt: '2026-10-01T00:00:00.000Z',
      endsAt: '2026-10-31T00:00:00.000Z',
      graceEndsAt: '2026-11-03T00:00:00.000Z',
    }
    const before = new Date('2026-09-20T00:00:00.000Z')

    it('se calcula como scheduled antes de su inicio', () => {
      expect(computeMembershipStatus(scheduled, before)).toBe('scheduled')
      expect(computeMembershipStatus(scheduled, new Date('2026-10-02T00:00:00.000Z'))).toBe(
        'active',
      )
    })

    it('no da acceso a reservar mientras no empieza', () => {
      const res = canBookMembership(scheduled, before)
      expect(res.allowed).toBe(false)
      expect(res.status).toBe('scheduled')
    })
  })

  describe('canUseBookingNav', () => {
    it('oculta agenda y reservas al socio sin plan activo', () => {
      expect(canUseBookingNav('member', null)).toBe(false)
    })

    it('muestra agenda al socio sin plan con un pase del día activo', () => {
      expect(canUseBookingNav('member', null, true)).toBe(true)
    })

    it('muestra agenda al socio con plan vigente', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'))
      try {
        expect(canUseBookingNav('member', baseMembership)).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('staff y admin siempre ven agenda', () => {
      expect(canUseBookingNav('staff', null)).toBe(true)
      expect(canUseBookingNav('admin', null)).toBe(true)
    })
  })
})
