import { beforeEach, describe, expect, it } from 'vitest'
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
  isCheckInWindow,
} from '../domain/rules'
import { getDisciplineMeta, ZONA_CERO_DISCIPLINES } from '../domain/disciplines'
import { getMemberMembershipChip } from '../features/bookings/CheckInPage'
import type { Session } from '../domain/models'

describe('Zona Cero Performance Center - Comprehensive End-to-End Flow', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('completes the entire 8-phase customer lifecycle with zero regressions', async () => {
    // -------------------------------------------------------------------------
    // Phase 1: Member Registration with Expanded Profile & Health Data
    // -------------------------------------------------------------------------
    const memberRepo = new LocalRepository()
    const memberEmail = 'atleta.zonacero@performance.ec'
    const memberPassword = 'AtletaSeguro2026!'

    const registeredMember = await memberRepo.signUp({
      fullName: 'Mateo Morales',
      email: memberEmail,
      password: memberPassword,
      birthDate: '1995-04-12',
      residence: 'Cumbayá, Quito',
      heightCm: 180,
      initialWeightKg: 80.0,
      goals: 'Preparación Hyrox Pro y rendimiento en Dragon Fit',
      healthNotes: 'Sin cirugías previas, apto para alta intensidad',
    })

    expect(registeredMember.id).toBeDefined()
    expect(registeredMember.fullName).toBe('Mateo Morales')
    expect(registeredMember.email).toBe(memberEmail)
    expect(registeredMember.birthDate).toBe('1995-04-12')
    expect(registeredMember.residence).toBe('Cumbayá, Quito')
    expect(registeredMember.heightCm).toBe(180)
    expect(registeredMember.initialWeightKg).toBe(80.0)
    expect(registeredMember.goals).toContain('Hyrox Pro')
    expect(registeredMember.healthNotes).toContain('alta intensidad')

    // -------------------------------------------------------------------------
    // Phase 2: Initial BMI Calculation, Body Measurements & Goal Tracking
    // -------------------------------------------------------------------------
    // Initial weight was automatically logged upon sign up
    const initialMeasurements = await memberRepo.listMeasurements(registeredMember.id)
    expect(initialMeasurements.length).toBe(1)
    expect(initialMeasurements[0]!.weightKg).toBe(80.0)

    // Calculate BMI: 80 / (1.80^2) = 24.69 => 24.7 (Normal)
    const initialBmi = calculateBmi(80.0, 180)
    expect(initialBmi).toBe(24.7)
    const initialCategory = getBmiCategory(initialBmi)
    expect(initialCategory?.key).toBe('normal')
    expect(initialCategory?.label).toBe('Normal')

    // Member adds a comprehensive anthropometric check-in (circumferences)
    const followUpMeasurement = await memberRepo.createMeasurement({
      userId: registeredMember.id,
      recordedBy: registeredMember.id,
      weightKg: 78.5,
      heightCm: 180,
      waistCm: 82.0,
      hipCm: 98.0,
      chestCm: 104.0,
      armCm: 37.5,
      thighCm: 58.0,
      measuredAt: new Date().toISOString(),
      notes: 'Evaluación inicial en cabina antropométrica Zona Cero',
    })

    expect(followUpMeasurement.bmi).toBe(24.2)
    expect(followUpMeasurement.waistCm).toBe(82.0)
    expect(followUpMeasurement.armCm).toBe(37.5)

    // Member sets a body target goal
    const goal = await memberRepo.upsertBodyGoal({
      userId: registeredMember.id,
      targetWeightKg: 76.0,
      targetDate: '2026-12-31',
      status: 'active',
    })
    expect(goal.targetWeightKg).toBe(76.0)
    expect(goal.targetBmi).toBe(23.5)

    const progress = calculateGoalProgress(80.0, 78.5, 76.0)
    expect(progress.progressPercent).toBe(38) // (1.5 / 4.0) = 37.5% -> 38%
    expect(progress.remainingKg).toBe(2.5)
    expect(progress.isLossGoal).toBe(true)

    // -------------------------------------------------------------------------
    // Phase 3: Active Membership Assignment via Datafast POS Manual Payment
    // -------------------------------------------------------------------------
    // Staff/Admin logs in to register POS payment
    const staffRepo = new LocalRepository()
    await staffRepo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

    const plans = await staffRepo.getMembershipPlans()
    const fullPlan = plans.find((p) => p.id === 'plan-mensual-full') ?? plans[0]!
    expect(fullPlan).toBeDefined()

    const paymentResult = await staffRepo.registerManualPayment({
      userId: registeredMember.id,
      planId: fullPlan.id,
      amountCents: fullPlan.priceCents,
      manualMethod: 'card_pos',
      reference: 'DATAFAST-POS-TX-99482',
    })

    expect(paymentResult.payment.status).toBe('approved')
    expect(paymentResult.payment.manualMethod).toBe('card_pos')
    expect(paymentResult.payment.reference).toBe('DATAFAST-POS-TX-99482')
    expect(paymentResult.membership.status).toBe('active')
    expect(paymentResult.membership.userId).toBe(registeredMember.id)

    // Create a scheduled Dragon Fit session for testing
    const now = new Date()
    const sessionStart = new Date(now.getTime() + 5 * 60 * 1000) // in 5 minutes (within check-in window)
    const sessionEnd = new Date(now.getTime() + 65 * 60 * 1000)

    const dragonSession: Session = await staffRepo.upsertSession({
      id: 'session-dragon-test-01',
      templateId: 'tpl-dragon-01',
      zoneId: 'zone-dragon-fit',
      title: 'Dragon Fit WOD Matutino',
      kind: 'class',
      startsAt: sessionStart.toISOString(),
      endsAt: sessionEnd.toISOString(),
      capacity: 15,
      trainerId: 'trainer_1',
      bookedCount: 0,
    })

    // Member signs in to view their active membership and book
    const activeMemberRepo = new LocalRepository()
    await activeMemberRepo.signIn({ email: memberEmail, password: memberPassword })

    const memberMembership = await activeMemberRepo.getMemberMembership(registeredMember.id)
    expect(memberMembership).not.toBeNull()
    expect(memberMembership?.status).toBe('active')
    const membershipValidation = canBookMembership(memberMembership)
    expect(membershipValidation.allowed).toBe(true)
    expect(membershipValidation.status).toBe('active')

    // -------------------------------------------------------------------------
    // Phase 4: Booking a Session across Zona Cero Disciplines (e.g. Dragon Fit)
    // -------------------------------------------------------------------------
    // Verify Zona Cero has 9 distinct disciplines configured
    const disciplineKeys = Object.keys(ZONA_CERO_DISCIPLINES)
    expect(disciplineKeys).toContain('dragon_fit')
    expect(disciplineKeys).toContain('crossfit')
    expect(disciplineKeys).toContain('hyrox')
    expect(disciplineKeys).toContain('musculacion')
    expect(disciplineKeys).toContain('fisioterapia')
    expect(disciplineKeys).toContain('nutricion')
    expect(disciplineKeys).toContain('bailoterapia')
    expect(disciplineKeys).toContain('comunes')
    expect(disciplineKeys).toContain('gimnasio')
    expect(disciplineKeys.length).toBe(9)

    const dragonMeta = getDisciplineMeta('zone-dragon-fit')
    expect(dragonMeta.name).toBe('Dragon Fit')

    // Member books Dragon Fit session
    const bookingResult = await activeMemberRepo.createBooking(dragonSession.id, registeredMember.id)
    expect('status' in bookingResult).toBe(true)
    if ('status' in bookingResult) {
      expect(bookingResult.status).toBe('confirmed')
      expect(bookingResult.checkInCode).toBeDefined()
      expect(bookingResult.checkInCode.length).toBeGreaterThan(3)

      // -----------------------------------------------------------------------
      // Phase 5: Check-in Validation with QR Code and Status Chip
      // -----------------------------------------------------------------------
      // Validate CheckIn status chip
      const chip = getMemberMembershipChip(memberMembership)
      expect(chip.label).toBe('Vigente')
      expect(chip.tone).toBe('ok')

      // Validate check-in window open
      const isWindowOpen = isCheckInWindow(
        dragonSession.startsAt,
        now,
        15, // 15 mins before
        10, // 10 mins after
      )
      expect(isWindowOpen).toBe(true)

      // Execute Check-in
      const checkIn = await activeMemberRepo.checkIn(bookingResult.id, bookingResult.checkInCode)
      expect(checkIn.id).toBeDefined()
      expect(checkIn.bookingId).toBe(bookingResult.id)
      expect(checkIn.userId).toBe(registeredMember.id)

      // Booking status updated to 'attended'
      const updatedBookings = await activeMemberRepo.listBookingsForUser(registeredMember.id)
      const myBooking = updatedBookings.find((b) => b.id === bookingResult.id)
      expect(myBooking?.status).toBe('attended')
    }

    // -------------------------------------------------------------------------
    // Phase 6: Expiration & Grace Period Handling
    // -------------------------------------------------------------------------
    // Case A: Membership in Grace Period (e.g. expired 1 day ago, 2 days of grace left)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const graceEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

    const graceMembership = {
      id: 'mem-grace-test',
      userId: registeredMember.id,
      planId: fullPlan.id,
      status: 'active' as const,
      startsAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      endsAt: yesterday.toISOString(),
      graceEndsAt: graceEnd.toISOString(),
      visitsLeft: null,
    }

    const graceStatus = computeMembershipStatus(graceMembership, now)
    expect(graceStatus).toBe('grace')

    const graceValidation = canBookMembership(graceMembership, now)
    expect(graceValidation.allowed).toBe(true)
    expect(graceValidation.status).toBe('grace')

    const graceChip = getMemberMembershipChip(graceMembership, now)
    expect(graceChip.tone).toBe('warn')
    expect(graceChip.label).toContain('En Gracia')

    // Case B: Fully Expired Membership (past grace period)
    const expiredMembership = {
      id: 'mem-expired-test',
      userId: registeredMember.id,
      planId: fullPlan.id,
      status: 'active' as const,
      startsAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      graceEndsAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      visitsLeft: null,
    }

    const expiredStatus = computeMembershipStatus(expiredMembership, now)
    expect(expiredStatus).toBe('expired')

    const expiredValidation = canBookMembership(expiredMembership, now)
    expect(expiredValidation.allowed).toBe(false)
    expect(expiredValidation.status).toBe('expired')
    expect(expiredValidation.reason).toContain('Membresía vencida')

    const expiredChip = getMemberMembershipChip(expiredMembership, now)
    expect(expiredChip.tone).toBe('danger')
    expect(expiredChip.label).toBe('Vencido')

    // -------------------------------------------------------------------------
    // Phase 7: Multi-Zone Access Restrictions (Single-Discipline Plan Enforcement)
    // -------------------------------------------------------------------------
    // Plan restricted only to Dragon Fit zone
    const singleDisciplinePlan = {
      id: 'plan-dragon-only',
      name: 'Pase Dragon Fit Exclusivo',
      priceCents: 3500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: ['zone-dragon-fit'],
      active: true,
    }

    // Access to Dragon Fit is allowed
    const allowedZoneCheck = canBookZone(singleDisciplinePlan, 'zone-dragon-fit')
    expect(allowedZoneCheck.allowed).toBe(true)

    // Access to CrossFit or Hyrox is blocked
    const restrictedCrossFitCheck = canBookZone(singleDisciplinePlan, 'zone-crossfit')
    expect(restrictedCrossFitCheck.allowed).toBe(false)
    expect(restrictedCrossFitCheck.reason).toContain('no incluye acceso a esta zona')

    const restrictedHyroxCheck = canBookZone(singleDisciplinePlan, 'zone-hyrox')
    expect(restrictedHyroxCheck.allowed).toBe(false)
    expect(restrictedHyroxCheck.reason).toContain('Pase Dragon Fit Exclusivo')

    // Universal plan allows all zones
    const universalPlan = {
      id: 'plan-black-vip',
      name: 'Plan Black VIP Todo Incluido',
      priceCents: 6500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
    }
    expect(canBookZone(universalPlan, 'zone-crossfit').allowed).toBe(true)
    expect(canBookZone(universalPlan, 'zone-hyrox').allowed).toBe(true)
    expect(canBookZone(universalPlan, 'zone-dragon-fit').allowed).toBe(true)

    // -------------------------------------------------------------------------
    // Phase 8: Account Deletion (Apple Guideline 5.1.1(v) & Google Data Safety)
    // -------------------------------------------------------------------------
    // Member initiates full GDPR / Apple data purge
    await activeMemberRepo.deleteAccount()

    // 1. Session is completely cleared
    const postDeletionUser = await activeMemberRepo.getCurrentUser()
    expect(postDeletionUser).toBeNull()

    // 2. Member cannot sign in with old credentials
    await expect(
      activeMemberRepo.signIn({ email: memberEmail, password: memberPassword }),
    ).rejects.toThrow(/no encontrado/i)

    // 3. Member profile and all records purged from database
    const adminRepo = new LocalRepository()
    await adminRepo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

    const allMembers = await adminRepo.listMembers()
    expect(allMembers.some((m) => m.id === registeredMember.id)).toBe(false)

    const allBookings = await adminRepo.listBookingsForUser(registeredMember.id)
    expect(allBookings.length).toBe(0)

    const allMeasurements = await adminRepo.listMeasurements(registeredMember.id)
    expect(allMeasurements.length).toBe(0)

    const allPayments = await adminRepo.getMemberPayments(registeredMember.id)
    expect(allPayments.length).toBe(0)
  })
})
