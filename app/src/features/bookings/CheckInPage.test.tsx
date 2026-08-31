import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CheckInPage, getMemberMembershipChip } from './CheckInPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import type { GymState, User, Membership, Session, Booking } from '@/domain/models'

function createMockRepo(user: User, state: Partial<GymState>): GymRepository {
  const fullState: GymState = {
    settings: {
      name: 'Zona Cero',
      logoUrl: null,
      primaryColor: '#000',
      accentColor: '#c9ff3d',
      bookingWindowHours: 72,
      cancelWindowHours: 2,
      checkInWindowMinutes: 20,
    },
    users: [user],
    trainers: [],
    zones: [],
    templates: [],
    sessions: [],
    bookings: [],
    waitlist: [],
    checkIns: [],
    measurements: [],
    membershipPlans: [],
    memberships: [],
    payments: [],
    ...state,
  }

  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    load: vi.fn().mockResolvedValue(fullState),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    deleteAccount: vi.fn(),
    listBookingsForUser: vi.fn().mockResolvedValue([]),
    createBooking: vi.fn(),
    cancelBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
    checkIn: vi.fn().mockResolvedValue({ id: 'ci_1', bookingId: 'bk_1', checkedInAt: new Date().toISOString() }),
    listMeasurements: vi.fn().mockResolvedValue([]),
    createMeasurement: vi.fn(),
    updateMeasurement: vi.fn(),
    deleteMeasurement: vi.fn(),
    getBodyGoal: vi.fn().mockResolvedValue(null),
    upsertBodyGoal: vi.fn().mockResolvedValue({ id: 'bg_1', userId: user.id, targetWeightKg: 70, targetDate: '2026-12-31', status: 'active' }),
    updateSettings: vi.fn(),
    listZones: vi.fn().mockResolvedValue([]),
    upsertZone: vi.fn(),
    deleteZone: vi.fn(),
    listTemplates: vi.fn().mockResolvedValue([]),
    upsertTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
    upsertSession: vi.fn(),
    deleteSession: vi.fn(),
    getMembershipPlans: vi.fn().mockResolvedValue([]),
    upsertMembershipPlan: vi.fn(),
    deleteMembershipPlan: vi.fn(),
    getMemberMembership: vi.fn().mockResolvedValue(null),
    getMemberPayments: vi.fn().mockResolvedValue([]),
    listMemberships: vi.fn().mockResolvedValue([]),
    listPayments: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([]),
    registerManualPayment: vi.fn(),
  }
}

describe('CheckInPage & Membership Chips', () => {
  const now = new Date('2026-09-01T12:00:00.000Z')

  describe('getMemberMembershipChip helper', () => {
    it('returns Sin Plan with neutral tone when membership is null or undefined', () => {
      const chip = getMemberMembershipChip(null, now)
      expect(chip.label).toBe('Sin Plan')
      expect(chip.tone).toBe('neutral')
    })

    it('returns Vigente with ok tone when membership is active', () => {
      const membership: Membership = {
        id: 'mem_1',
        userId: 'u1',
        planId: 'p1',
        status: 'active',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-09-15T00:00:00.000Z',
        graceEndsAt: '2026-09-18T00:00:00.000Z',
        visitsLeft: null,
      }
      const chip = getMemberMembershipChip(membership, now)
      expect(chip.label).toBe('Vigente')
      expect(chip.tone).toBe('ok')
    })

    it('returns En Gracia (X d) with warn tone when in grace period', () => {
      const membership: Membership = {
        id: 'mem_2',
        userId: 'u2',
        planId: 'p1',
        status: 'active',
        startsAt: '2026-08-01T00:00:00.000Z',
        endsAt: '2026-08-31T00:00:00.000Z', // Ended yesterday
        graceEndsAt: '2026-09-03T12:00:00.000Z', // 2 days grace remaining
        visitsLeft: null,
      }
      const chip = getMemberMembershipChip(membership, now)
      expect(chip.label).toBe('En Gracia (2 d)')
      expect(chip.tone).toBe('warn')
    })

    it('returns Vencido with danger tone when membership is expired past grace', () => {
      const membership: Membership = {
        id: 'mem_3',
        userId: 'u3',
        planId: 'p1',
        status: 'expired',
        startsAt: '2026-07-01T00:00:00.000Z',
        endsAt: '2026-08-01T00:00:00.000Z',
        graceEndsAt: '2026-08-04T00:00:00.000Z',
        visitsLeft: null,
      }
      const chip = getMemberMembershipChip(membership, now)
      expect(chip.label).toBe('Vencido')
      expect(chip.tone).toBe('danger')
    })
  })

  describe('Staff View in CheckInPage', () => {
    const staffUser: User = {
      id: 'user_staff',
      email: 'recepcion@gym.local',
      fullName: 'Recepcionista',
      role: 'staff',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const memberActive: User = {
      id: 'user_active',
      email: 'activo@gym.local',
      fullName: 'Juan Activo',
      role: 'member',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const memberGrace: User = {
      id: 'user_grace',
      email: 'gracia@gym.local',
      fullName: 'Maria Gracia',
      role: 'member',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const memberExpired: User = {
      id: 'user_expired',
      email: 'vencido@gym.local',
      fullName: 'Pedro Vencido',
      role: 'member',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const memberNoPlan: User = {
      id: 'user_noplan',
      email: 'sinplan@gym.local',
      fullName: 'Sofia SinPlan',
      role: 'member',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const session: Session = {
      id: 'sess_today',
      templateId: 'tmpl_1',
      zoneId: 'zone-gimnasio',
      title: 'Musculación y Fuerza',
      kind: 'open',
      startsAt: new Date(Date.now() + 3600000).toISOString(),
      endsAt: new Date(Date.now() + 7200000).toISOString(),
      capacity: 20,
      trainerId: null,
      bookedCount: 4,
    }

    const bookingActive: Booking = {
      id: 'bk_active',
      sessionId: session.id,
      userId: memberActive.id,
      status: 'confirmed',
      createdAt: '2026-08-20T00:00:00.000Z',
      cancelledAt: null,
      checkInCode: 'QR-ACT123',
    }

    const bookingGrace: Booking = {
      id: 'bk_grace',
      sessionId: session.id,
      userId: memberGrace.id,
      status: 'confirmed',
      createdAt: '2026-08-20T00:00:00.000Z',
      cancelledAt: null,
      checkInCode: 'QR-GRA456',
    }

    const bookingExpired: Booking = {
      id: 'bk_expired',
      sessionId: session.id,
      userId: memberExpired.id,
      status: 'confirmed',
      createdAt: '2026-08-20T00:00:00.000Z',
      cancelledAt: null,
      checkInCode: 'QR-EXP789',
    }

    const bookingNoPlan: Booking = {
      id: 'bk_noplan',
      sessionId: session.id,
      userId: memberNoPlan.id,
      status: 'confirmed',
      createdAt: '2026-08-20T00:00:00.000Z',
      cancelledAt: null,
      checkInCode: 'QR-NOP000',
    }

    const memberships: Membership[] = [
      {
        id: 'mem_act',
        userId: memberActive.id,
        planId: 'plan_1',
        status: 'active',
        startsAt: new Date(Date.now() - 86400000 * 10).toISOString(),
        endsAt: new Date(Date.now() + 86400000 * 20).toISOString(),
        graceEndsAt: new Date(Date.now() + 86400000 * 23).toISOString(),
        visitsLeft: null,
      },
      {
        id: 'mem_gra',
        userId: memberGrace.id,
        planId: 'plan_1',
        status: 'active',
        startsAt: new Date(Date.now() - 86400000 * 31).toISOString(),
        endsAt: new Date(Date.now() - 86400000).toISOString(),
        graceEndsAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        visitsLeft: null,
      },
      {
        id: 'mem_exp',
        userId: memberExpired.id,
        planId: 'plan_1',
        status: 'expired',
        startsAt: new Date(Date.now() - 86400000 * 60).toISOString(),
        endsAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        graceEndsAt: new Date(Date.now() - 86400000 * 27).toISOString(),
        visitsLeft: null,
      },
    ]

    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('renders candidate chips: Vigente, En Gracia, Vencido, Sin Plan', async () => {
      const mockRepo = createMockRepo(staffUser, {
        users: [staffUser, memberActive, memberGrace, memberExpired, memberNoPlan],
        sessions: [session],
        bookings: [bookingActive, bookingGrace, bookingExpired, bookingNoPlan],
        memberships,
      })
      resetRepositoryForTests(mockRepo)

      render(
        <MemoryRouter>
          <RepositoryProvider>
            <CheckInPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      expect(await screen.findByText('Juan Activo')).toBeInTheDocument()
      expect(screen.getByText('Maria Gracia')).toBeInTheDocument()
      expect(screen.getByText('Pedro Vencido')).toBeInTheDocument()
      expect(screen.getByText('Sofia SinPlan')).toBeInTheDocument()

      // Check membership chips
      const chipActive = screen.getByTestId('membership-chip-bk_active')
      expect(chipActive).toHaveTextContent('Vigente')

      const chipGrace = screen.getByTestId('membership-chip-bk_grace')
      expect(chipGrace.textContent).toMatch(/En Gracia \(\d+ d\)/)

      const chipExpired = screen.getByTestId('membership-chip-bk_expired')
      expect(chipExpired).toHaveTextContent('Vencido')

      const chipNoPlan = screen.getByTestId('membership-chip-bk_noplan')
      expect(chipNoPlan).toHaveTextContent('Sin Plan')
    })

    it('allows staff to validate check-in for member in grace or expired (existing booking remains valid)', async () => {
      const mockRepo = createMockRepo(staffUser, {
        users: [staffUser, memberGrace],
        sessions: [session],
        bookings: [bookingGrace],
        memberships,
      })
      resetRepositoryForTests(mockRepo)

      render(
        <MemoryRouter>
          <RepositoryProvider>
            <CheckInPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      // Click the candidate card to select it
      const candidateText = await screen.findByText('Maria Gracia')
      const card = candidateText.closest('.cursor-pointer') ?? candidateText
      await userEvent.click(card)

      // Validate check-in button is enabled
      const validateButton = screen.getByRole('button', { name: /validar check-in/i })
      await waitFor(() => expect(validateButton).not.toBeDisabled())

      await userEvent.click(validateButton)

      await waitFor(() => {
        expect(mockRepo.checkIn).toHaveBeenCalledWith('bk_grace', 'QR-GRA456')
      })
      expect(await screen.findByText(/Check-in registrado con éxito/i)).toBeInTheDocument()
    })
  })
})
