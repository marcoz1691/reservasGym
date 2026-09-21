import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { DEMO_PASSWORD, createSeedState } from '@/data/seed'
import {
  GRACE_PERIOD_DAYS,
  canBookMembership,
  computeMembershipStatus,
} from '@/domain/rules/membership'
import type { GymRepository } from '@/data/types'
import type {
  GymState,
  Membership,
  MembershipPlan,
  Session,
  User,
  Zone,
} from '@/domain/models'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

const STORAGE_KEY = 'reservasgym.intermedia.v2'
const DAY_MS = 24 * 60 * 60 * 1000

function seedState(mutate: (state: GymState) => void): void {
  const state = createSeedState()
  mutate(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function buildMembership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'mem_qa',
    userId: 'user_member_1',
    planId: 'plan-standard',
    status: 'active',
    startsAt: '2026-08-01T00:00:00.000Z',
    endsAt: '2026-09-01T00:00:00.000Z',
    graceEndsAt: '2026-09-04T00:00:00.000Z',
    visitsLeft: null,
    ...overrides,
  }
}

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
    updatePassword: vi.fn(),
    deleteAccount: vi.fn(),
    listBookingsForUser: vi.fn().mockResolvedValue([]),
    createBooking: vi.fn().mockResolvedValue({ id: 'bk_new', status: 'confirmed' }),
    cancelBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
    checkIn: vi.fn(),
    listMeasurements: vi.fn().mockResolvedValue([]),
    createMeasurement: vi.fn(),
    updateMeasurement: vi.fn(),
    deleteMeasurement: vi.fn(),
    getBodyGoal: vi.fn().mockResolvedValue(null),
    upsertBodyGoal: vi.fn(),
    updateSettings: vi.fn(),
    listZones: vi.fn().mockResolvedValue(fullState.zones),
    upsertZone: vi.fn(),
    deleteZone: vi.fn(),
    listTemplates: vi.fn().mockResolvedValue([]),
    upsertTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    listSessions: vi.fn().mockResolvedValue(fullState.sessions),
    upsertSession: vi.fn(),
    deleteSession: vi.fn(),
    getMembershipPlans: vi.fn().mockResolvedValue(fullState.membershipPlans),
    upsertMembershipPlan: vi.fn(),
    deleteMembershipPlan: vi.fn(),
    getMemberMembership: vi.fn().mockResolvedValue(fullState.memberships[0] ?? null),
    getMemberPayments: vi.fn().mockResolvedValue([]),
    listMemberships: vi.fn().mockResolvedValue(fullState.memberships),
    listPayments: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([]),
    registerManualPayment: vi.fn(),
  }
}

// La agenda pinta la semana de lunes a domingo; anclar el reloj a un miércoles
// evita que la sesión "mañana" caiga fuera de la semana visible.
vi.useFakeTimers({ shouldAdvanceTime: true })
vi.setSystemTime(new Date('2026-09-09T10:00:00'))

/**
 * QA ZCAPP-19 — Gate de Reservas (vencimiento + gracia de 3 días)
 * DoD: socio vencido bloqueado para nuevas reservas; reservas previas válidas.
 */
describe('QA ZCAPP-19 — Gate de Reservas', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('Regla de negocio: bordes de vigencia y gracia', () => {
    it('[ZC19-01] La gracia configurada es de 3 días', () => {
      expect(GRACE_PERIOD_DAYS).toBe(3)
    })

    it('[ZC19-02] Socio vigente puede reservar', () => {
      const membership = buildMembership()
      const now = new Date('2026-08-20T00:00:00.000Z')

      expect(computeMembershipStatus(membership, now)).toBe('active')
      expect(canBookMembership(membership, now).allowed).toBe(true)
    })

    it('[ZC19-03] En el instante exacto de vencimiento todavía puede reservar', () => {
      const membership = buildMembership()
      const now = new Date('2026-09-01T00:00:00.000Z')

      expect(computeMembershipStatus(membership, now)).toBe('active')
      expect(canBookMembership(membership, now).allowed).toBe(true)
    })

    it('[ZC19-04] Durante los 3 días de gracia sigue pudiendo reservar', () => {
      const membership = buildMembership()

      for (const day of [1, 2, 3]) {
        const now = new Date(new Date(membership.endsAt).getTime() + day * DAY_MS - 1000)
        const result = canBookMembership(membership, now)
        expect(computeMembershipStatus(membership, now)).toBe('grace')
        expect(result.allowed).toBe(true)
      }
    })

    it('[ZC19-05] Al terminar la gracia queda bloqueado con el motivo de renovación', () => {
      const membership = buildMembership()
      const now = new Date(new Date(membership.graceEndsAt!).getTime() + 1)

      expect(computeMembershipStatus(membership, now)).toBe('expired')
      const result = canBookMembership(membership, now)
      expect(result.allowed).toBe(false)
      expect(result.status).toBe('expired')
      expect(result.reason).toMatch(/Membresía vencida/i)
    })

    it('[ZC19-06] Sin membresía no puede reservar', () => {
      const result = canBookMembership(null)
      expect(result.allowed).toBe(false)
      expect(result.status).toBe('none')
      expect(result.reason).toMatch(/No cuenta con una membresía activa/i)
    })

    it('[ZC19-07] Membresía cancelada bloquea aunque la fecha siga vigente', () => {
      const membership = buildMembership({ status: 'cancelled' })
      const now = new Date('2026-08-20T00:00:00.000Z')

      const result = canBookMembership(membership, now)
      expect(result.allowed).toBe(false)
      expect(result.status).toBe('cancelled')
    })

    it('[ZC19-08] Sin visitas disponibles bloquea incluso durante la gracia', () => {
      const membership = buildMembership({ visitsLeft: 0 })
      const now = new Date('2026-09-02T00:00:00.000Z')

      const result = canBookMembership(membership, now)
      expect(computeMembershipStatus(membership, now)).toBe('grace')
      expect(result.allowed).toBe(false)
      expect(result.reason).toMatch(/No quedan visitas disponibles/i)
    })
  })

  describe('Gate en la agenda del socio', () => {
    const memberUser: User = {
      id: 'user_member_1',
      email: 'socio@gym.local',
      fullName: 'Ana Gomez',
      role: 'member',
      createdAt: '2026-01-01T00:00:00.000Z',
    }

    const gymZone: Zone = {
      id: 'zone-gimnasio',
      name: 'Gimnasio Funcional',
      type: 'gimnasio',
      description: 'Área funcional',
      defaultCapacity: 20,
      imageHint: 'gym',
    }

    const standardPlan: MembershipPlan = {
      id: 'plan-standard',
      name: 'Plan Estándar',
      priceCents: 4500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: ['zone-gimnasio'],
      active: true,
    }

    const sessionTomorrow: Session = {
      id: 'sess_1',
      templateId: 'tmpl_1',
      zoneId: 'zone-gimnasio',
      title: 'Functional Training',
      kind: 'class',
      startsAt: new Date(Date.now() + DAY_MS).toISOString(),
      endsAt: new Date(Date.now() + DAY_MS + 3600000).toISOString(),
      capacity: 10,
      trainerId: null,
      bookedCount: 0,
    }

    function renderAgendaWith(memberships: Membership[]): GymRepository {
      const mockRepo = createMockRepo(memberUser, {
        zones: [gymZone],
        sessions: [sessionTomorrow],
        membershipPlans: [standardPlan],
        memberships,
      })
      resetRepositoryForTests(mockRepo)

      render(
        <MemoryRouter>
          <RepositoryProvider>
            <AgendaPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      return mockRepo
    }

    it('[ZC19-09] Agenda bloquea al socio vencido y lo dirige a renovar plan', async () => {
      const mockRepo = renderAgendaWith([
        buildMembership({
          status: 'expired',
          startsAt: '2026-06-01T00:00:00.000Z',
          endsAt: '2026-07-01T00:00:00.000Z',
          graceEndsAt: '2026-07-04T00:00:00.000Z',
        }),
      ])

      const renew = await screen.findByRole('link', {
        name: /Renovar plan para reservar Functional Training/i,
      })
      expect(renew).toHaveAttribute('href', '/membresia')
      expect(
        screen.queryByRole('button', { name: /^reservar$/i }),
      ).not.toBeInTheDocument()
      expect(mockRepo.createBooking).not.toHaveBeenCalled()
      expect(screen.queryByTestId('booking-gate-modal')).toBeNull()
    })

    it('[ZC19-10] Agenda bloquea al socio sin membresía y lo dirige a activar plan', async () => {
      const mockRepo = renderAgendaWith([])

      const activate = await screen.findByRole('link', {
        name: /Activar plan para reservar Functional Training/i,
      })
      expect(activate).toHaveAttribute('href', '/membresia')
      expect(
        screen.queryByRole('button', { name: /^reservar$/i }),
      ).not.toBeInTheDocument()
      expect(mockRepo.createBooking).not.toHaveBeenCalled()
      expect(screen.queryByTestId('booking-gate-modal')).toBeNull()
    })

    it('[ZC19-11] Agenda permite reservar durante el período de gracia', async () => {
      const mockRepo = renderAgendaWith([
        buildMembership({
          endsAt: new Date(Date.now() - DAY_MS).toISOString(),
          graceEndsAt: new Date(Date.now() + 2 * DAY_MS).toISOString(),
        }),
      ])

      await userEvent.click(await screen.findByRole('button', { name: /reservar/i }))

      await waitFor(() => {
        expect(mockRepo.createBooking).toHaveBeenCalledWith(
          sessionTomorrow.id,
          memberUser.id,
        )
      })
      expect(screen.queryByTestId('booking-gate-modal')).toBeNull()
    })
  })

  describe('Reservas previas al vencimiento', () => {
    it('[ZC19-12] Una reserva creada estando vigente sigue confirmada tras vencer la membresía', async () => {
      vi.useRealTimers()
      resetRepositoryForTests()

      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      const member = await repo.signIn({
        email: 'socio@gym.local',
        password: DEMO_PASSWORD,
      })

      const sessions = await repo.listSessions(new Date().toISOString())
      const futureSession = sessions[0]!
      const booking = await repo.createBooking(futureSession.id, member.id)
      expect('status' in booking && booking.status).toBe('confirmed')

      // La recepción no renueva: la membresía vence y sale de gracia
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as GymState
      raw.memberships[0]!.endsAt = new Date(Date.now() - 10 * DAY_MS).toISOString()
      raw.memberships[0]!.graceEndsAt = new Date(Date.now() - 7 * DAY_MS).toISOString()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

      const reloaded = new LocalRepository()
      await reloaded.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

      const membership = await reloaded.getMemberMembership(member.id)
      expect(membership?.status).toBe('expired')

      const bookings = await reloaded.listBookingsForUser(member.id)
      const preserved = bookings.find((b) => b.id === (booking as { id: string }).id)
      expect(preserved).toBeDefined()
      expect(preserved!.status).toBe('confirmed')

      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(new Date('2026-09-09T10:00:00'))
    })

    it('[ZC19-13] El socio vencido conserva su código de check-in de la reserva previa', async () => {
      vi.useRealTimers()
      seedState((state) => {
        state.memberships[0]!.endsAt = new Date(Date.now() - 10 * DAY_MS).toISOString()
        state.memberships[0]!.graceEndsAt = new Date(Date.now() - 7 * DAY_MS).toISOString()
        state.bookings.push({
          id: 'bk_previa_qa',
          sessionId: state.sessions[0]!.id,
          userId: 'user_member',
          status: 'confirmed',
          createdAt: new Date(Date.now() - 20 * DAY_MS).toISOString(),
          cancelledAt: null,
          checkInCode: 'QRQA0001',
        })
      })

      const repo = new LocalRepository()
      resetRepositoryForTests(repo)
      await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

      const bookings = await repo.listBookingsForUser('user_member')
      const previa = bookings.find((b) => b.id === 'bk_previa_qa')

      expect(previa?.status).toBe('confirmed')
      expect(previa?.checkInCode).toBe('QRQA0001')

      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.setSystemTime(new Date('2026-09-09T10:00:00'))
    })
  })
})
