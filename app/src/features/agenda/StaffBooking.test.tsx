import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { StaffBookingModal } from '@/features/agenda/StaffBookingModal'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import type { GymState, User, Session, Zone, Membership, MembershipPlan } from '@/domain/models'

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
      name: 'Zona Cero Performance Center',
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
    completePasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    deleteAccount: vi.fn(),
    listBookingsForUser: vi.fn().mockResolvedValue([]),
    createBooking: vi.fn().mockResolvedValue({
      id: 'bk_created',
      sessionId: 'ses_crossfit_1',
      userId: 'user_member_carlos',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      checkInCode: 'QR-TEST-9988',
    }),
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
    listMembers: vi.fn().mockResolvedValue(fullState.users.filter((u) => u.role === 'member')),
    requestPlanPayment: vi.fn(),
    registerManualPayment: vi.fn(),
  }
}

describe('Staff Booking Feature — Reception Booking on Behalf of Members', () => {
  const staffUser: User = {
    id: 'user_staff_1',
    email: 'recepcion@zonacero.local',
    fullName: 'Carlos Recepción',
    role: 'staff',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  const memberCarlos: User = {
    id: 'user_member_carlos',
    email: 'carlos.socio@gmail.com',
    fullName: 'Carlos Socio Pérez',
    role: 'member',
    createdAt: '2026-01-01T00:00:00.000Z',
    residence: 'Quito, Cumbayá',
  }

  const memberExpired: User = {
    id: 'user_member_expired',
    email: 'vencido@gmail.com',
    fullName: 'Roberto Vencido',
    role: 'member',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  const crossfitZone: Zone = {
    id: 'zone-crossfit',
    name: 'CrossFit Box',
    type: 'crossfit',
    description: 'Box CrossFit',
    defaultCapacity: 18,
    imageHint: 'crossfit',
  }

  const planFull: MembershipPlan = {
    id: 'plan-full-1',
    name: 'Plan Mensual Ilimitado',
    priceCents: 4500,
    durationDays: 30,
    visitQuota: null,
    allowedZoneIds: [],
    active: true,
  }

  const membershipActive: Membership = {
    id: 'mem_carlos_act',
    userId: memberCarlos.id,
    planId: planFull.id,
    status: 'active',
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 25).toISOString(),
    graceEndsAt: new Date(Date.now() + 86400000 * 28).toISOString(),
    visitsLeft: null,
  }

  const membershipExpired: Membership = {
    id: 'mem_roberto_exp',
    userId: memberExpired.id,
    planId: planFull.id,
    status: 'expired',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-02-01T00:00:00.000Z',
    graceEndsAt: '2026-02-04T00:00:00.000Z',
    visitsLeft: null,
  }

  const todayIso = new Date().toISOString()
  const testSession: Session = {
    id: 'ses_crossfit_1',
    templateId: 'tpl_cf',
    zoneId: 'zone-crossfit',
    title: 'CrossFit WOD Elite',
    kind: 'class',
    startsAt: todayIso,
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    capacity: 18,
    trainerId: null,
    bookedCount: 4,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays "Reservar por un Socio" action for staff in AgendaPage', async () => {
    const mockRepo = createMockRepo(staffUser, {
      users: [staffUser, memberCarlos],
      zones: [crossfitZone],
      sessions: [testSession],
      membershipPlans: [planFull],
      memberships: [membershipActive],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <AgendaPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('button', { name: /por socio/i }),
    ).toBeInTheDocument()
  })

  it('completes staff booking for an active member and generates check-in code', async () => {
    const mockRepo = createMockRepo(staffUser, {
      users: [staffUser, memberCarlos],
      zones: [crossfitZone],
      sessions: [testSession],
      membershipPlans: [planFull],
      memberships: [membershipActive],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <StaffBookingModal
            isOpen={true}
            onClose={vi.fn()}
            session={testSession}
          />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Modal title & session info
    expect(await screen.findByText(/Reserva por Recepción/i)).toBeInTheDocument()
    expect(screen.getByText('CrossFit WOD Elite')).toBeInTheDocument()

    // Search and select member
    const searchInput = screen.getByPlaceholderText(/buscar socio por nombre/i)
    await userEvent.type(searchInput, 'Carlos Socio')

    const memberRow = await screen.findByText('Carlos Socio Pérez')
    await userEvent.click(memberRow)

    // Verify membership status badge
    expect(screen.getByText('Membresía Activa')).toBeInTheDocument()
    expect(screen.getByText('Plan Mensual Ilimitado')).toBeInTheDocument()

    // Confirm booking
    const confirmBtn = screen.getByRole('button', {
      name: /confirmar reserva en recepción/i,
    })
    await userEvent.click(confirmBtn)

    // Verify repo.createBooking called with member ID
    await waitFor(() => {
      expect(mockRepo.createBooking).toHaveBeenCalledWith(
        testSession.id,
        memberCarlos.id,
      )
    })

    // Verify confirmation view with check-in code
    expect(
      await screen.findByText(/¡Reserva Confirmada Exitosamente!/i),
    ).toBeInTheDocument()
    expect(screen.getByText('QR-TEST-9988')).toBeInTheDocument()
  })

  it('displays warning and requires reception authorization for expired member', async () => {
    const mockRepo = createMockRepo(staffUser, {
      users: [staffUser, memberExpired],
      zones: [crossfitZone],
      sessions: [testSession],
      membershipPlans: [planFull],
      memberships: [membershipExpired],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <StaffBookingModal
            isOpen={true}
            onClose={vi.fn()}
            session={testSession}
          />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const memberRow = await screen.findByText('Roberto Vencido')
    await userEvent.click(memberRow)

    // Verify warning is displayed
    expect(screen.getByText('Membresía Vencida')).toBeInTheDocument()
    expect(
      screen.getByText(/La membresía del socio se encuentra vencida\./i),
    ).toBeInTheDocument()

    // Confirm button is disabled until override checkbox is checked
    const confirmBtn = screen.getByRole('button', {
      name: /confirmar reserva en recepción/i,
    })
    expect(confirmBtn).toBeDisabled()

    // Check override authorization checkbox
    const overrideCheckbox = screen.getByRole('checkbox')
    await userEvent.click(overrideCheckbox)

    // Now button is enabled
    expect(confirmBtn).toBeEnabled()
    await userEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockRepo.createBooking).toHaveBeenCalledWith(
        testSession.id,
        memberExpired.id,
      )
    })
  })

  describe('con la lista de espera apagada', () => {
    const fullSession: Session = { ...testSession, bookedCount: testSession.capacity }
    const settings = {
      name: 'Zona Cero Performance Center',
      logoUrl: null,
      primaryColor: '#000',
      accentColor: '#c9ff3d',
      bookingWindowHours: 72,
      cancelWindowHours: 2,
      checkInWindowMinutes: 20,
    }

    function repoFor(user: User, waitlistEnabled: boolean) {
      return createMockRepo(user, {
        settings: { ...settings, waitlistEnabled },
        users: [staffUser, memberCarlos],
        zones: [crossfitZone],
        sessions: [fullSession],
        membershipPlans: [planFull],
        memberships: [membershipActive],
      })
    }

    it('la agenda del socio muestra "Clase llena" sin opción de espera', async () => {
      resetRepositoryForTests(repoFor(memberCarlos, false))
      render(
        <MemoryRouter>
          <RepositoryProvider>
            <AgendaPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      const button = await screen.findByRole('button', { name: /Clase llena/ })
      expect(button).toBeDisabled()
      expect(screen.queryByRole('button', { name: /Lista de espera/ })).toBeNull()
    })

    it('encendida, la agenda sigue ofreciendo la lista de espera', async () => {
      resetRepositoryForTests(repoFor(memberCarlos, true))
      render(
        <MemoryRouter>
          <RepositoryProvider>
            <AgendaPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      expect(await screen.findByRole('button', { name: /Lista de espera/ })).toBeEnabled()
    })

    it('recepción no puede registrar en lista de espera', async () => {
      const mockRepo = repoFor(staffUser, false)
      resetRepositoryForTests(mockRepo)
      render(
        <MemoryRouter>
          <RepositoryProvider>
            <StaffBookingModal isOpen={true} onClose={vi.fn()} session={fullSession} />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      await userEvent.type(
        await screen.findByPlaceholderText(/buscar socio por nombre/i),
        'Carlos Socio',
      )
      await userEvent.click(await screen.findByText('Carlos Socio Pérez'))

      expect(screen.getByRole('button', { name: /Clase llena/ })).toBeDisabled()
      expect(screen.queryByRole('button', { name: /Lista de Espera/i })).toBeNull()
      expect(mockRepo.createBooking).not.toHaveBeenCalled()
    })
  })
})
