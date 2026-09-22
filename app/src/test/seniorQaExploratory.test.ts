import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalRepository } from '../data/localRepository'
import { resetRepositoryForTests } from '../data/repository'
import { DEMO_PASSWORD } from '../data/seed'
import {
  calculateBmi,
  getBmiCategory,
  calculateGoalProgress,
  computeMembershipStatus,
  canBookMembership,
  canBookZone,
  hasOverlappingBooking,
} from '../domain/rules'
import {
  registerBiometrics,
  authenticateWithBiometrics,
  disableBiometrics,
  isBiometricsEnabled,
  getSavedBiometricUser,
} from '../lib/biometrics'
import type { Booking, Membership, MembershipPlan, Session } from '../domain/models'

describe('Senior QA Engineer - Full Exploratory & Edge-Case Testing Cycle', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  // ===========================================================================
  // 1. AUTHENTICATION, REGISTRATION & PASSWORD RECOVERY (Positive & Negative)
  // ===========================================================================
  describe('Module 1: Authentication & Account Lifecycle', () => {
    it('[NEG-AUTH-01] Rejects registration with empty or whitespace-only name', async () => {
      const repo = new LocalRepository()
      await expect(
        repo.signUp({
          fullName: '   ',
          email: 'qa.test1@zonacero.ec',
          password: 'Password123!',
        }),
      ).rejects.toThrow(/Nombre requerido/i)
    })

    it('[NEG-AUTH-02] Rejects registration with password under 8 characters', async () => {
      const repo = new LocalRepository()
      await expect(
        repo.signUp({
          fullName: 'QA User',
          email: 'qa.test2@zonacero.ec',
          password: '1234567', // 7 chars
        }),
      ).rejects.toThrow(/al menos 8 caracteres/i)
    })

    it('[NEG-AUTH-03] Rejects duplicate account creation with same email (case-insensitive)', async () => {
      const repo = new LocalRepository()
      await repo.signUp({
        fullName: 'Original User',
        email: 'atleta@zonacero.ec',
        password: 'Password123!',
      })

      // Attempt second registration with uppercase email
      await expect(
        repo.signUp({
          fullName: 'Clone User',
          email: 'ATLETA@ZONACERO.EC',
          password: 'AnotherPassword123!',
        }),
      ).rejects.toThrow(/ya está registrado/i)
    })

    it('[NEG-AUTH-04] Rejects sign in with wrong password or non-existent user', async () => {
      const repo = new LocalRepository()
      await expect(
        repo.signIn({ email: 'noexiste@gym.local', password: 'demo' }),
      ).rejects.toThrow(/Usuario no encontrado/i)

      await expect(
        repo.signIn({ email: 'socio@gym.local', password: 'WRONG_PASSWORD' }),
      ).rejects.toThrow(/Contraseña incorrecta/i)
    })

    it('[POS-AUTH-05] Password recovery resolves safely without leaking user existence', async () => {
      const repo = new LocalRepository()
      // Valid user
      await expect(repo.resetPassword('socio@gym.local')).resolves.toBeUndefined()
      // Non-existent user (security protection against account enumeration)
      await expect(repo.resetPassword('phantom@ghost.com')).resolves.toBeUndefined()
    })

    it('[BIOM-06] Biometrics flow: setup, biometric login, and safe revocation', async () => {
      const mockUser = {
        id: 'usr_qa_bio',
        email: 'bio.qa@zonacero.ec',
        fullName: 'Roberta Silva',
      }

      expect(isBiometricsEnabled()).toBe(false)
      expect(getSavedBiometricUser()).toBeNull()

      vi.stubGlobal(
        'PublicKeyCredential',
        class {
          static async isUserVerifyingPlatformAuthenticatorAvailable() {
            return true
          }
        },
      )
      Object.defineProperty(navigator, 'credentials', {
        configurable: true,
        value: {
          get: vi.fn().mockResolvedValue({ type: 'public-key' }),
          create: vi.fn().mockResolvedValue({ type: 'public-key' }),
        },
      })

      const paired = await registerBiometrics(mockUser)
      expect(paired).toBe(true)
      expect(isBiometricsEnabled()).toBe(true)

      const auth = await authenticateWithBiometrics()
      expect(auth.userId).toBe('usr_qa_bio')
      expect(auth.email).toBe('bio.qa@zonacero.ec')

      // Revoke / disable
      disableBiometrics()
      expect(isBiometricsEnabled()).toBe(false)
      await expect(authenticateWithBiometrics()).rejects.toThrow(/No hay una cuenta asociada/i)
      vi.unstubAllGlobals()
    })
  })

  // ===========================================================================
  // 2. FICHA TÉCNICA, ANTHROPOMETRICS & BMI (Boundary, Negative & Side-Effects)
  // ===========================================================================
  describe('Module 2: Ficha Técnica & Anthropometrics Engine', () => {
    it('[POS-BMI-01] Computes accurate BMI and classification across all WHO categories', () => {
      // Underweight (< 18.5)
      const underBmi = calculateBmi(50, 175) // 16.3
      expect(underBmi).toBe(16.3)
      expect(getBmiCategory(underBmi!)?.key).toBe('underweight')

      // Normal (18.5 - 24.9)
      const normalBmi = calculateBmi(70, 175) // 22.9
      expect(normalBmi).toBe(22.9)
      expect(getBmiCategory(normalBmi!)?.key).toBe('normal')

      // Overweight (25.0 - 29.9)
      const overBmi = calculateBmi(85, 175) // 27.8
      expect(overBmi).toBe(27.8)
      expect(getBmiCategory(overBmi!)?.key).toBe('overweight')

      // Obese (>= 30.0)
      const obeseBmi = calculateBmi(105, 175) // 34.3
      expect(obeseBmi).toBe(34.3)
      expect(getBmiCategory(obeseBmi!)?.key).toBe('obese')
    })

    it('[NEG-BMI-02] Handles invalid / zero / negative values gracefully returning null', () => {
      expect(calculateBmi(0, 175)).toBeNull()
      expect(calculateBmi(70, 0)).toBeNull()
      expect(calculateBmi(-70, 175)).toBeNull()
      expect(calculateBmi(70, -175)).toBeNull()
    })

    it('[SIDE-EFFECT-03] Profile update with initial weight creates automatic baseline measurement record', async () => {
      const repo = new LocalRepository()
      const user = await repo.signUp({
        fullName: 'Ficha Tecnica Tester',
        email: 'ficha.tester@zonacero.ec',
        password: 'Password123!',
      })

      // Measurements should initially be empty
      let measurements = await repo.listMeasurements(user.id)
      expect(measurements.length).toBe(0)

      // Member completes Ficha Técnica with weight & height
      await repo.updateProfile({
        heightCm: 182,
        initialWeightKg: 84.5,
        residence: 'Pomasqui, Quito',
        birthDate: '1992-11-20',
        goals: 'Hipertrofia y fuerza funcional',
        healthNotes: 'Tendinitis rotuliana leve en rodilla izquierda',
      })

      measurements = await repo.listMeasurements(user.id)
      expect(measurements.length).toBe(1)
      expect(measurements[0]!.weightKg).toBe(84.5)
      expect(measurements[0]!.heightCm).toBe(182)
      expect(measurements[0]!.notes).toContain('ficha técnica')
    })

    it('[POS-GOAL-04] Calculates goal progress accurately for weight loss and muscle gain', () => {
      // Weight loss goal: Initial 90kg -> Current 85kg -> Target 80kg (50% progress)
      const lossProgress = calculateGoalProgress(90, 85, 80)
      expect(lossProgress.progressPercent).toBe(50)
      expect(lossProgress.remainingKg).toBe(5)
      expect(lossProgress.isAchieved).toBe(false)

      // Completed loss goal
      const lossComplete = calculateGoalProgress(90, 79.5, 80)
      expect(lossComplete.progressPercent).toBe(100)
      expect(lossComplete.isAchieved).toBe(true)

      // Muscle gain goal: Initial 70kg -> Current 73kg -> Target 76kg (50% progress)
      const gainProgress = calculateGoalProgress(70, 73, 76)
      expect(gainProgress.progressPercent).toBe(50)
      expect(gainProgress.remainingKg).toBe(3)
    })
  })

  // ===========================================================================
  // 3. BOOKINGS, CAPACITY, WAITLIST & OVERLAPS (Functional & Collateral)
  // ===========================================================================
  describe('Module 3: Bookings, Overlaps, Waitlist & Attendance Flow', () => {
    it('[NEG-BOOK-01] Prevents double-booking the exact same session by the same user', async () => {
      const repo = new LocalRepository()
      const member = await repo.signIn({
        email: 'socio@gym.local',
        password: DEMO_PASSWORD,
      })

      const sessions = await repo.listSessions()
      const targetSession = sessions.find((s) => s.bookedCount < s.capacity)!

      // First booking succeeds
      const first = await repo.createBooking(targetSession.id, member.id)
      expect(first).toHaveProperty('id')

      // Second booking attempt on same session must be rejected
      await expect(
        repo.createBooking(targetSession.id, member.id),
      ).rejects.toThrow(/Ya tienes reserva/i)
    })

    it('[NEG-OVERLAP-02] Prevents overlapping bookings at the same time window', () => {
      const sessionA: Session = {
        id: 'sess_a',
        templateId: 'tmpl_1',
        zoneId: 'zone_box',
        title: 'Box Tarde',
        kind: 'class',
        startsAt: '2030-01-01T18:00:00.000Z',
        endsAt: '2030-01-01T19:00:00.000Z',
        capacity: 15,
        trainerId: null,
        bookedCount: 5,
      }

      const overlappingSession: Session = {
        id: 'sess_b',
        templateId: 'tmpl_2',
        zoneId: 'zone_crossfit',
        title: 'CrossFit WOD',
        kind: 'class',
        startsAt: '2030-01-01T18:30:00.000Z', // Starts inside Session A's window
        endsAt: '2030-01-01T19:30:00.000Z',
        capacity: 15,
        trainerId: null,
        bookedCount: 2,
      }

      const existingBooking: Booking = {
        id: 'bk_existing',
        sessionId: sessionA.id,
        userId: 'usr_socio',
        status: 'confirmed',
        createdAt: '2030-01-01T10:00:00.000Z',
        cancelledAt: null,
        checkInCode: 'QR123',
      }

      const hasConflict = hasOverlappingBooking(
        'usr_socio',
        overlappingSession,
        [existingBooking],
        [sessionA, overlappingSession],
      )
      expect(hasConflict).toBe(true)
    })

    it('[COLLATERAL-WAITLIST-03] Full session sends user to Waitlist and promotes upon cancellation', async () => {
      const repo = new LocalRepository()
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      // Create a test session with capacity = 1
      const microSession = await repo.upsertSession({
        id: 'sess_micro_cap',
        templateId: 'tmpl-funcional-hiit',
        zoneId: 'zone-crossfit',
        title: 'Micro Cap Session',
        kind: 'class',
        startsAt: '2030-05-01T10:00:00.000Z',
        endsAt: '2030-05-01T11:00:00.000Z',
        capacity: 1,
        trainerId: null,
        bookedCount: 0,
      })

      // User 1 books the only slot
      const user1 = await repo.signUp({
        fullName: 'Primer Atleta',
        email: 'atleta1@zonacero.ec',
        password: 'Password123!',
      })
      const b1 = await repo.createBooking(microSession.id, user1.id)
      expect((b1 as Booking).status).toBe('confirmed')

      // User 2 tries to book the full session -> Should receive Waitlist position #1
      const user2 = await repo.signUp({
        fullName: 'Segundo Atleta',
        email: 'atleta2@zonacero.ec',
        password: 'Password123!',
      })
      const w2 = await repo.createBooking(microSession.id, user2.id)
      expect(w2).toHaveProperty('position', 1)

      // User 1 signs back in and cancels booking -> User 2 should be automatically promoted
      await repo.signIn({ email: 'atleta1@zonacero.ec', password: 'Password123!' })
      await repo.cancelBooking((b1 as Booking).id)

      const user2Bookings = await repo.listBookingsForUser(user2.id)
      const promoted = user2Bookings.find((b) => b.sessionId === microSession.id)
      expect(promoted).toBeDefined()
      expect(promoted?.status).toBe('confirmed')
      expect(promoted?.checkInCode).toBeDefined()
    })
  })

  // ===========================================================================
  // 4. MEMBERSHIP RULES, 3-DAY GRACE PERIOD & ZONE ACCESS GATES
  // ===========================================================================
  describe('Module 4: Membership Rules, Grace Period & Security Gate', () => {
    it('[MEM-STATUS-01] Computes active, grace period and expired statuses with gate validation', () => {
      // Case 1: Active membership
      const activeMembership: Membership = {
        id: 'mem_1',
        userId: 'usr_1',
        planId: 'plan_monthly',
        status: 'active',
        startsAt: '2026-08-01T00:00:00Z',
        endsAt: '2026-09-10T00:00:00Z',
        visitsLeft: null,
        graceEndsAt: '2026-09-13T00:00:00Z',
        createdAt: '2026-08-01T00:00:00Z',
      }
      const activeStatus = computeMembershipStatus(activeMembership, new Date('2026-08-31'))
      expect(activeStatus).toBe('active')
      expect(canBookMembership(activeMembership, new Date('2026-08-31')).allowed).toBe(true)

      // Case 2: In 3-day Grace Period (Expired 2 days ago, booking allowed)
      const graceMembership: Membership = {
        id: 'mem_2',
        userId: 'usr_2',
        planId: 'plan_monthly',
        status: 'active',
        startsAt: '2026-07-29T00:00:00Z',
        endsAt: '2026-08-29T00:00:00Z',
        visitsLeft: null,
        graceEndsAt: '2026-09-01T00:00:00Z',
        createdAt: '2026-07-29T00:00:00Z',
      }
      const graceStatus = computeMembershipStatus(graceMembership, new Date('2026-08-31'))
      expect(graceStatus).toBe('grace')
      expect(canBookMembership(graceMembership, new Date('2026-08-31')).allowed).toBe(true)

      // Case 3: Expired beyond 3-day grace period (Booking hard blocked)
      const expiredMembership: Membership = {
        id: 'mem_3',
        userId: 'usr_3',
        planId: 'plan_monthly',
        status: 'active',
        startsAt: '2026-07-01T00:00:00Z',
        endsAt: '2026-08-20T00:00:00Z',
        visitsLeft: null,
        graceEndsAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-07-01T00:00:00Z',
      }
      const expiredStatus = computeMembershipStatus(expiredMembership, new Date('2026-08-31'))
      expect(expiredStatus).toBe('expired')
      expect(canBookMembership(expiredMembership, new Date('2026-08-31')).allowed).toBe(false)
    })

    it('[ZONE-GATE-02] Restricts access to unauthorized zones (e.g. Dragon Fit only vs CrossFit only)', () => {
      const dragonFitOnlyPlan: MembershipPlan = {
        id: 'plan_dragon_only',
        name: 'Dragon Fit Especial',
        priceCents: 5000,
        durationDays: 30,
        visitQuota: null,
        active: true,
        allowedZoneIds: ['zone-dragon-fit'],
      }

      // Can book Dragon Fit zone
      expect(canBookZone(dragonFitOnlyPlan, 'zone-dragon-fit').allowed).toBe(true)

      // Cannot book CrossFit or Hyrox zone
      expect(canBookZone(dragonFitOnlyPlan, 'zone-crossfit').allowed).toBe(false)
      expect(canBookZone(dragonFitOnlyPlan, 'zone-hyrox').allowed).toBe(false)

      // Multi-zone plan
      const multiPlan: MembershipPlan = {
        id: 'plan_multi',
        name: 'CrossFit + Box',
        priceCents: 7500,
        durationDays: 30,
        visitQuota: null,
        active: true,
        allowedZoneIds: ['zone-crossfit', 'zone-box'],
      }
      expect(canBookZone(multiPlan, 'zone-crossfit').allowed).toBe(true)
      expect(canBookZone(multiPlan, 'zone-box').allowed).toBe(true)
      expect(canBookZone(multiPlan, 'zone-dragon-fit').allowed).toBe(false)
    })
  })

  // ===========================================================================
  // 5. MANUAL PAYMENT BILLING (DATAFAST POS, CASH, TRANSFER) & AUDIT
  // ===========================================================================
  describe('Module 5: Admin Billing & Manual Payment Registration', () => {
    it('[POS-BILL-01] Staff registers manual payment via Datafast POS and activates membership', async () => {
      const repo = new LocalRepository()

      // 1. Create a new member
      const newMember = await repo.signUp({
        fullName: 'Juan Cobros',
        email: 'juan.cobros@zonacero.ec',
        password: 'Password123!',
      })

      // 2. Admin signs in to register physical payment
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      const plans = await repo.getMembershipPlans()
      const quarterlyPlan = plans.find((p) => p.durationDays === 90)!

      // Admin registers physical Datafast POS payment with voucher reference
      const { payment, membership } = await repo.registerManualPayment({
        userId: newMember.id,
        planId: quarterlyPlan.id,
        amountCents: quarterlyPlan.priceCents,
        manualMethod: 'card_pos',
        reference: 'VOUCHER-DATAFAST-89214',
      })

      expect(payment.id).toBeDefined()
      expect(payment.userId).toBe(newMember.id)
      expect(payment.status).toBe('approved')
      expect(payment.manualMethod).toBe('card_pos')
      expect(payment.reference).toBe('VOUCHER-DATAFAST-89214')

      expect(membership.status).toBe('active')
      expect(membership.userId).toBe(newMember.id)
      expect(membership.planId).toBe(quarterlyPlan.id)

      // Verify payment appears in member payments audit ledger
      const memberPayments = await repo.getMemberPayments(newMember.id)
      expect(memberPayments.some((p) => p.reference === 'VOUCHER-DATAFAST-89214')).toBe(true)
    })
  })

  // ===========================================================================
  // 6. PRIVACY, APPLE 5.1.1(v) & CASCADING ACCOUNT DELETION
  // ===========================================================================
  describe('Module 6: Privacy, Data Safety & Apple 5.1.1(v) Purge', () => {
    it('[APPLE-PURGE-01] Completely deletes user and cascades all associated data', async () => {
      const repo = new LocalRepository()
      const user = await repo.signUp({
        fullName: 'Usuario Para Borrar',
        email: 'borrar.cuenta@zonacero.ec',
        password: 'Password123!',
      })

      // Add a measurement and a body goal
      await repo.createMeasurement({
        userId: user.id,
        recordedBy: user.id,
        weightKg: 77.0,
        measuredAt: new Date().toISOString(),
        notes: 'Prueba de medicion',
      })

      await repo.upsertBodyGoal({
        userId: user.id,
        targetWeightKg: 72.0,
        targetDate: '2026-12-31',
        status: 'active',
      })

      // Ensure data exists in user context
      expect((await repo.listMeasurements(user.id)).length).toBe(1)
      expect(await repo.getBodyGoal(user.id)).not.toBeNull()

      // Execute permanent account deletion
      await repo.deleteAccount()

      // Verify credentials & session destroyed
      await expect(
        repo.signIn({ email: 'borrar.cuenta@zonacero.ec', password: 'Password123!' }),
      ).rejects.toThrow(/Usuario no encontrado/i)

      // Admin signs in to verify cascade purge from database
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
      const allMembers = await repo.listMembers()
      expect(allMembers.some((m) => m.id === user.id)).toBe(false)
    })
  })
})
