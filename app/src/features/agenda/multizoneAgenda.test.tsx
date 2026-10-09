import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { ExplorePage } from '@/features/catalog/ExplorePage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import type { GymState, User, Session, Zone } from '@/domain/models'
import { ZONA_CERO_DISCIPLINES } from '@/domain/disciplines'

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
    createBooking: vi.fn().mockResolvedValue({ id: 'bk_1', status: 'confirmed' }),
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
    getMemberMembership: vi.fn().mockResolvedValue(null),
    getMemberPayments: vi.fn().mockResolvedValue([]),
    listMemberships: vi.fn().mockResolvedValue([]),
    listPayments: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue(fullState.users.filter((u) => u.role === 'member')),
    requestPlanPayment: vi.fn(),
    registerManualPayment: vi.fn(),
  }
}

describe('Multizone Agenda — 9 Disciplines in Zona Cero', () => {
  const memberUser: User = {
    id: 'user_member_1',
    email: 'socio@gym.local',
    fullName: 'Ana Socio',
    role: 'member',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  const all9Zones: Zone[] = [
    { id: 'zone-gimnasio', name: 'Gimnasio', type: 'gimnasio', description: 'Gimnasio', defaultCapacity: 30, imageHint: 'floor' },
    { id: 'zone-fisio', name: 'Fisioterapia', type: 'fisioterapia', description: 'Fisio', defaultCapacity: 2, imageHint: 'physio' },
    { id: 'zone-nutri', name: 'Nutrición', type: 'nutricion', description: 'Nutri', defaultCapacity: 2, imageHint: 'nutrition' },
    { id: 'zone-bailo', name: 'Bailoterapia', type: 'bailoterapia', description: 'Bailoterapia', defaultCapacity: 20, imageHint: 'dance' },
    { id: 'zone-dragon-fit', name: 'Dragon Fit', type: 'dragon_fit', description: 'Dragon Fit', defaultCapacity: 20, imageHint: 'dragon-fit' },
    { id: 'zone-comunes', name: 'Áreas comunes', type: 'comunes', description: 'Comunes', defaultCapacity: 15, imageHint: 'common' },
    { id: 'zone-hyrox', name: 'Hyrox', type: 'hyrox', description: 'Hyrox', defaultCapacity: 16, imageHint: 'hyrox' },
    { id: 'zone-muscu', name: 'Musculación', type: 'musculacion', description: 'Musculación', defaultCapacity: 25, imageHint: 'weights' },
    { id: 'zone-crossfit', name: 'CrossFit', type: 'crossfit', description: 'CrossFit', defaultCapacity: 18, imageHint: 'crossfit' },
  ]

  const todayIso = new Date().toISOString()
  const sessionsList: Session[] = [
    {
      id: 'ses_gym',
      templateId: 'tpl_1',
      zoneId: 'zone-gimnasio',
      title: 'Acceso Gimnasio Matutino',
      kind: 'open',
      startsAt: todayIso,
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      capacity: 30,
      trainerId: null,
      bookedCount: 5,
    },
    {
      id: 'ses_dragon',
      templateId: 'tpl_df',
      zoneId: 'zone-dragon-fit',
      title: 'Dragon Fit Hardcore',
      kind: 'class',
      startsAt: todayIso,
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      capacity: 20,
      trainerId: null,
      bookedCount: 2,
    },
    {
      id: 'ses_cf',
      templateId: 'tpl_cf',
      zoneId: 'zone-crossfit',
      title: 'CrossFit WOD Power',
      kind: 'class',
      startsAt: todayIso,
      endsAt: new Date(Date.now() + 3600000).toISOString(),
      capacity: 18,
      trainerId: null,
      bookedCount: 0,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies all 9 official disciplines exist in domain definition', () => {
    const keys = Object.keys(ZONA_CERO_DISCIPLINES)
    expect(keys).toHaveLength(9)
    expect(keys).toContain('gimnasio')
    expect(keys).toContain('fisioterapia')
    expect(keys).toContain('nutricion')
    expect(keys).toContain('bailoterapia')
    expect(keys).toContain('dragon_fit')
    expect(keys).toContain('comunes')
    expect(keys).toContain('hyrox')
    expect(keys).toContain('musculacion')
    expect(keys).toContain('crossfit')
  })

  it('renders 9 discipline filter pills in AgendaPage', async () => {
    const mockRepo = createMockRepo(memberUser, {
      zones: all9Zones,
      sessions: sessionsList,
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <AgendaPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Verify main header and subtitle
    expect(await screen.findByRole('heading', { name: 'Reservar clase' })).toBeInTheDocument()
    expect(
      screen.getByText(/Aquí apartas el cupo. Lo que ya tomaste está en Mis clases/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Aquí apartas el cupo. Lo que ya tomaste está en Mis clases/i),
    ).toBeInTheDocument()

    // Verify filter pills are present
    expect(screen.getByRole('button', { name: /todas/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dragon fit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crossfit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /fisioterapia/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nutrición/i })).toBeInTheDocument()
  })

  it('filters sessions by discipline when clicking filter chip in AgendaPage', async () => {
    const mockRepo = createMockRepo(memberUser, {
      zones: all9Zones,
      sessions: sessionsList,
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <AgendaPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Initially all sessions for today are shown
    expect(await screen.findByText('Dragon Fit Hardcore')).toBeInTheDocument()
    expect(screen.getByText('Acceso Gimnasio Matutino')).toBeInTheDocument()
    expect(screen.getByText('CrossFit WOD Power')).toBeInTheDocument()

    // Click on Dragon Fit filter
    const dragonFilterBtn = screen.getByRole('button', { name: /dragon fit/i })
    await userEvent.click(dragonFilterBtn)

    // Only Dragon Fit session remains
    expect(screen.getByText('Dragon Fit Hardcore')).toBeInTheDocument()
    expect(screen.queryByText('Acceso Gimnasio Matutino')).not.toBeInTheDocument()
    expect(screen.queryByText('CrossFit WOD Power')).not.toBeInTheDocument()
  })

  it('renders all 9 disciplines showcase cards in ExplorePage', async () => {
    const mockRepo = createMockRepo(memberUser, {
      zones: all9Zones,
      sessions: sessionsList,
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExplorePage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Explorar áreas/i)).toBeInTheDocument()
    expect(screen.getByText(/disciplinas incluidas en tu plan/i)).toBeInTheDocument()

    // Verify all 9 disciplines are present in zone list
    for (const z of all9Zones) {
      expect(screen.getAllByText(z.name).length).toBeGreaterThan(0)
    }
  })
})
