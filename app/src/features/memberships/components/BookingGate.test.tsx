import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ExplorePage } from '@/features/catalog/ExplorePage'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import type { GymState, User, Membership, MembershipPlan, Session, Zone } from '@/domain/models'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

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
    getMembershipPlans: vi.fn().mockResolvedValue(fullState.membershipPlans),
    upsertMembershipPlan: vi.fn(),
    deleteMembershipPlan: vi.fn(),
    getMemberMembership: vi.fn().mockResolvedValue(fullState.memberships[0] ?? null),
    getMemberPayments: vi.fn().mockResolvedValue([]),
    listMemberships: vi.fn().mockResolvedValue(fullState.memberships),
    listPayments: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([]),
    requestPlanPayment: vi.fn(),
    registerManualPayment: vi.fn(),
  }
}

/**
 * AgendaPage pinta la semana de lunes a domingo (weekStartsOn: 1) y los
 * fixtures de abajo crean la sesión "mañana". Corriendo un domingo, ese mañana
 * cae en la semana siguiente: la agenda no lo muestra y no aparece el botón
 * Reservar. El reloj se ancla a un miércoles para que la prueba no dependa del
 * día en que se ejecute.
 *
 * Va antes del describe a propósito: los fixtures se evalúan al construirse el
 * describe, así que congelarlo en un beforeEach llegaría tarde.
 */
vi.useFakeTimers({ shouldAdvanceTime: true })
vi.setSystemTime(new Date('2026-09-09T10:00:00'))

describe('Booking Gate in ExplorePage & AgendaPage', () => {
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

  const crossfitZone: Zone = {
    id: 'zone-crossfit',
    name: 'CrossFit Box',
    type: 'crossfit',
    description: 'Box de crossfit',
    defaultCapacity: 15,
    imageHint: 'crossfit',
  }

  const standardPlan: MembershipPlan = {
    id: 'plan-standard',
    name: 'Plan Estándar',
    priceCents: 4500,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: ['zone-gimnasio', 'zone-dragon-fit'],
    active: true,
  }

  const sessionTomorrow: Session = {
    id: 'sess_1',
    templateId: 'tmpl_1',
    zoneId: 'zone-gimnasio',
    title: 'Functional Training',
    kind: 'class',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    capacity: 10,
    trainerId: null,
    bookedCount: 0,
  }

  const restrictedZoneSession: Session = {
    id: 'sess_crossfit',
    templateId: 'tmpl_cf',
    zoneId: 'zone-crossfit',
    title: 'CrossFit WOD',
    kind: 'class',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    capacity: 10,
    trainerId: null,
    bookedCount: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ExplorePage sin plan muestra Activar plan y no reserva', async () => {
    const mockRepo = createMockRepo(memberUser, {
      zones: [gymZone],
      sessions: [sessionTomorrow],
      membershipPlans: [standardPlan],
      memberships: [],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExplorePage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const cta = await screen.findByRole('link', { name: /activar plan/i })
    expect(cta).toHaveAttribute('href', '/membresia')
    expect(screen.queryByRole('button', { name: /reservar/i })).not.toBeInTheDocument()
    expect(mockRepo.createBooking).not.toHaveBeenCalled()
    expect(screen.queryByTestId('booking-gate-modal')).not.toBeInTheDocument()
  })

  it('ExplorePage con membresía vencida muestra Renovar plan', async () => {
    const expiredMembership: Membership = {
      id: 'mem_exp',
      userId: memberUser.id,
      planId: standardPlan.id,
      status: 'expired',
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: '2026-02-01T00:00:00.000Z',
      graceEndsAt: '2026-02-04T00:00:00.000Z',
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      zones: [gymZone],
      sessions: [sessionTomorrow],
      membershipPlans: [standardPlan],
      memberships: [expiredMembership],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExplorePage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const cta = await screen.findByRole('link', { name: /renovar plan/i })
    expect(cta).toHaveAttribute('href', '/membresia')
    expect(screen.queryByRole('button', { name: /reservar/i })).not.toBeInTheDocument()
    expect(mockRepo.createBooking).not.toHaveBeenCalled()
  })

  it('ExplorePage no deja reservar una zona fuera del plan', async () => {
    const activeMembership: Membership = {
      id: 'mem_act',
      userId: memberUser.id,
      planId: standardPlan.id,
      status: 'active',
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 20).toISOString(),
      graceEndsAt: new Date(Date.now() + 86400000 * 23).toISOString(),
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      zones: [gymZone, crossfitZone],
      sessions: [restrictedZoneSession],
      membershipPlans: [standardPlan],
      memberships: [activeMembership],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExplorePage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('No incluida')).toBeInTheDocument()
    const blocked = await screen.findByRole('link', {
      name: /No incluido en tu plan: CrossFit WOD/i,
    })
    expect(blocked).toHaveAttribute('href', '/membresia')
    expect(
      screen.queryByRole('button', { name: /reservar/i }),
    ).not.toBeInTheDocument()
    expect(mockRepo.createBooking).not.toHaveBeenCalled()
  })

  it('allows booking in AgendaPage when active and zone is allowed', async () => {
    const activeMembership: Membership = {
      id: 'mem_act',
      userId: memberUser.id,
      planId: standardPlan.id,
      status: 'active',
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 20).toISOString(),
      graceEndsAt: new Date(Date.now() + 86400000 * 23).toISOString(),
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      zones: [gymZone],
      sessions: [sessionTomorrow],
      membershipPlans: [standardPlan],
      memberships: [activeMembership],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <AgendaPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const reserveButton = await screen.findByRole('button', { name: /reservar/i })
    await userEvent.click(reserveButton)

    await waitFor(() => {
      expect(mockRepo.createBooking).toHaveBeenCalledWith(sessionTomorrow.id, memberUser.id)
    })
  })
})
