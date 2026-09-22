import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ExpiryBanner } from './ExpiryBanner'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import type { GymState, User, Membership } from '@/domain/models'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function createMockRepo(user: User | null, state: Partial<GymState>): GymRepository {
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
    users: user ? [user] : [],
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
    createBooking: vi.fn(),
    cancelBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
    checkIn: vi.fn(),
    listMeasurements: vi.fn().mockResolvedValue([]),
    createMeasurement: vi.fn(),
    updateMeasurement: vi.fn(),
    deleteMeasurement: vi.fn(),
    getBodyGoal: vi.fn().mockResolvedValue(null),
    upsertBodyGoal: vi.fn().mockResolvedValue({ id: 'bg_1', userId: user?.id ?? 'u_1', targetWeightKg: 70, targetDate: '2026-12-31', status: 'active' }),
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
    requestPlanPayment: vi.fn(),
    registerManualPayment: vi.fn(),
  }
}

describe('ExpiryBanner Component', () => {
  const now = new Date('2026-09-01T12:00:00.000Z')

  const memberUser: User = {
    id: 'user_1',
    email: 'member@gym.local',
    fullName: 'Carlos Socio',
    role: 'member',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  const staffUser: User = {
    id: 'user_staff',
    email: 'staff@gym.local',
    fullName: 'Laura Staff',
    role: 'staff',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Warning Banner when membership expires in <= 7 days', async () => {
    const membership: Membership = {
      id: 'mem_1',
      userId: 'user_1',
      planId: 'plan_1',
      status: 'active',
      startsAt: '2026-08-05T00:00:00.000Z',
      endsAt: '2026-09-06T12:00:00.000Z', // 5 days remaining from 2026-09-01
      graceEndsAt: '2026-09-09T12:00:00.000Z',
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      memberships: [membership],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const banner = await screen.findByTestId('expiry-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('data-banner-type', 'warning')
    expect(
      screen.getByText(/Tu membresía vence en 5 días\. Renueva en recepción para evitar interrupciones\./i),
    ).toBeInTheDocument()

    const button = screen.getByRole('button', { name: /ver mi plan/i })
    expect(button).toBeInTheDocument()
    await userEvent.click(button)
    expect(mockNavigate).toHaveBeenCalledWith('/membresia')
  })

  it('renders Urgent Grace Banner when membership is in grace period (within 3 days)', async () => {
    const membership: Membership = {
      id: 'mem_2',
      userId: 'user_1',
      planId: 'plan_1',
      status: 'active',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-31T12:00:00.000Z', // Expired 1 day ago
      graceEndsAt: '2026-09-03T12:00:00.000Z', // 2 days of grace left from 2026-09-01
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      memberships: [membership],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const banner = await screen.findByTestId('expiry-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('data-banner-type', 'grace')
    expect(screen.getByText(/Período de gracia:/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Te quedan 2 días de gracia para renovar en recepción antes de que se bloqueen tus reservas\./i),
    ).toBeInTheDocument()

    const button = screen.getByRole('button', { name: /renovar ahora/i })
    expect(button).toBeInTheDocument()
    await userEvent.click(button)
    expect(mockNavigate).toHaveBeenCalledWith('/membresia')
  })

  it('renders Expired / No Membership Banner when membership is expired past grace', async () => {
    const membership: Membership = {
      id: 'mem_3',
      userId: 'user_1',
      planId: 'plan_1',
      status: 'expired',
      startsAt: '2026-07-01T00:00:00.000Z',
      endsAt: '2026-08-01T00:00:00.000Z',
      graceEndsAt: '2026-08-04T00:00:00.000Z',
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      memberships: [membership],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const banner = await screen.findByTestId('expiry-banner')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('data-banner-type', 'expired')
    expect(
      screen.getByText(
        /Membresía vencida\. Tus reservas están pausadas\. Acércate a recepción para renovar tu plan\./i,
      ),
    ).toBeInTheDocument()

    const button = screen.getByRole('button', { name: /ver planes/i })
    expect(button).toBeInTheDocument()
    await userEvent.click(button)
    expect(mockNavigate).toHaveBeenCalledWith('/membresia')
  })

  it('does not render banner when member has no membership (bienvenida en Inicio)', async () => {
    const mockRepo = createMockRepo(memberUser, {
      memberships: [],
    })
    resetRepositoryForTests(mockRepo)

    const { container } = render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('expiry-banner')).not.toBeInTheDocument()
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('does not render banner when membership is active with > 7 days remaining', async () => {
    const membership: Membership = {
      id: 'mem_4',
      userId: 'user_1',
      planId: 'plan_1',
      status: 'active',
      startsAt: '2026-08-20T00:00:00.000Z',
      endsAt: '2026-09-20T00:00:00.000Z', // 19 days left from 2026-09-01
      graceEndsAt: '2026-09-23T00:00:00.000Z',
      visitsLeft: null,
    }

    const mockRepo = createMockRepo(memberUser, {
      memberships: [membership],
    })
    resetRepositoryForTests(mockRepo)

    const { container } = render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Wait for context to load
    await new Promise((r) => setTimeout(r, 50))
    expect(container.querySelector('[data-testid="expiry-banner"]')).toBeNull()
  })

  it('does not render banner for staff users', async () => {
    const mockRepo = createMockRepo(staffUser, {
      memberships: [],
    })
    resetRepositoryForTests(mockRepo)

    const { container } = render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(container.querySelector('[data-testid="expiry-banner"]')).toBeNull()
  })
})
