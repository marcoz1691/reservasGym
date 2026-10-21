import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionsPage } from '@/features/admin/SessionsPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import type { GymState, User, Session, Zone, Trainer } from '@/domain/models'

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
    upsertSession: vi.fn().mockImplementation(async (s: Session) => s),
    deleteSession: vi.fn().mockResolvedValue(undefined),
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

describe('Admin Sessions Management — SessionsPage', () => {
  const adminUser: User = {
    id: 'user_admin_1',
    email: 'admin@zonacero.local',
    fullName: 'Admin Zona Cero',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  const gymZone: Zone = {
    id: 'zone-gimnasio',
    name: 'Gimnasio Funcional',
    type: 'gimnasio',
    description: 'Área funcional',
    defaultCapacity: 30,
    imageHint: 'gym',
  }

  const hyroxZone: Zone = {
    id: 'zone-hyrox',
    name: 'Hyrox Box',
    type: 'hyrox',
    description: 'Hyrox',
    defaultCapacity: 16,
    imageHint: 'hyrox',
  }

  const trainerDiego: Trainer = {
    id: 'tr_1',
    fullName: 'Diego Coach',
    specialties: ['crossfit', 'hyrox'],
  }

  const testSession: Session = {
    id: 'ses_hyrox_1',
    templateId: 'tpl_hyrox',
    zoneId: 'zone-hyrox',
    title: 'Hyrox Race Prep',
    kind: 'preparation',
    startsAt: '2026-09-01T11:00:00.000Z',
    endsAt: '2026-09-01T12:00:00.000Z',
    capacity: 16,
    trainerId: 'tr_1',
    bookedCount: 6,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sessions list with details for admin', async () => {
    const mockRepo = createMockRepo(adminUser, {
      zones: [gymZone, hyroxZone],
      trainers: [trainerDiego],
      sessions: [testSession],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <SessionsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Sesiones' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Hyrox Race Prep')).toBeInTheDocument()
    expect(screen.getByText('Diego Coach')).toBeInTheDocument()
    expect(screen.getByText(/6 \/ 16 inscritos/i)).toBeInTheDocument()
  })

  it('allows creating a new scheduled session through modal form', async () => {
    const gymOpenTemplate = {
      id: 'tpl-gym-open',
      zoneId: gymZone.id,
      title: 'Acceso libre gimnasio',
      kind: 'open' as const,
      durationMinutes: 60,
      capacity: 40,
      trainerId: null,
    }
    const mockRepo = createMockRepo(adminUser, {
      zones: [gymZone, hyroxZone],
      trainers: [trainerDiego],
      sessions: [testSession],
      templates: [gymOpenTemplate],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <SessionsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const createBtn = await screen.findByRole('button', {
      name: /programar nueva clase/i,
    })
    await userEvent.click(createBtn)

    expect(screen.getByText('Nueva Clase / Sesión')).toBeInTheDocument()

    const titleInput = screen.getByLabelText(/título de la clase/i)
    await userEvent.type(titleInput, 'Dragon Fit Matutino')

    const submitBtn = screen.getByRole('button', {
      name: /programar clase/i,
    })
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockRepo.upsertSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Dragon Fit Matutino',
          zoneId: gymZone.id,
          templateId: 'tpl-gym-open',
        }),
      )
    })
  })

  it('programa la misma clase en varios días con fecha final y días elegidos', async () => {
    const mockRepo = createMockRepo(adminUser, {
      zones: [gymZone, hyroxZone],
      trainers: [trainerDiego],
      sessions: [testSession],
      templates: [
        {
          id: 'tpl-gym-open',
          zoneId: gymZone.id,
          title: 'Acceso libre gimnasio',
          kind: 'open' as const,
          durationMinutes: 60,
          capacity: 40,
          trainerId: null,
        },
      ],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <SessionsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: /programar nueva clase/i }),
    )
    await userEvent.type(screen.getByLabelText(/título de la clase/i), 'WOD 7am')
    // 19 oct 2026 es lunes; por defecto se marcan lunes a viernes
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-19' } })
    fireEvent.change(screen.getByLabelText(/repetir hasta/i), { target: { value: '2026-10-25' } })

    expect(screen.getByText('Se programarán 5 clases.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sáb' }))
    expect(screen.getByText('Se programarán 6 clases.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /programar clase/i }))

    await waitFor(() => {
      expect(mockRepo.upsertSession).toHaveBeenCalledTimes(6)
    })
    const calls = (mockRepo.upsertSession as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as Session,
    )
    // 07:00 en Ecuador (UTC-5) = 12:00 UTC
    expect(calls.map((c) => c.startsAt.slice(0, 13))).toEqual([
      '2026-10-19T12',
      '2026-10-20T12',
      '2026-10-21T12',
      '2026-10-22T12',
      '2026-10-23T12',
      '2026-10-24T12',
    ])
    expect(new Set(calls.map((c) => c.id)).size).toBe(6)
    expect(await screen.findByText('Se programaron 6 clases.')).toBeInTheDocument()
  })

  it('al repetir un rango omite la clase que ya existe aunque la base devuelva la hora con +00:00', async () => {
    const existing: Session = {
      ...testSession,
      id: 'ses_existente',
      zoneId: gymZone.id,
      title: 'WOD 7am',
      startsAt: '2026-10-20T12:00:00+00:00',
      endsAt: '2026-10-20T13:00:00+00:00',
    }
    const mockRepo = createMockRepo(adminUser, {
      zones: [gymZone, hyroxZone],
      trainers: [trainerDiego],
      sessions: [existing],
      templates: [
        {
          id: 'tpl-gym-open',
          zoneId: gymZone.id,
          title: 'Acceso libre gimnasio',
          kind: 'open' as const,
          durationMinutes: 60,
          capacity: 40,
          trainerId: null,
        },
      ],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <SessionsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: /programar nueva clase/i }),
    )
    await userEvent.type(screen.getByLabelText(/título de la clase/i), 'WOD 7am')
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-10-19' } })
    fireEvent.change(screen.getByLabelText(/repetir hasta/i), { target: { value: '2026-10-23' } })
    await userEvent.click(screen.getByRole('button', { name: /programar clase/i }))

    await waitFor(() => {
      expect(mockRepo.upsertSession).toHaveBeenCalledTimes(4)
    })
    const calls = (mockRepo.upsertSession as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as Session).startsAt.slice(0, 10),
    )
    expect(calls).not.toContain('2026-10-20')
    expect(await screen.findByText(/Se programaron 4 clases \(1 ya existían/)).toBeInTheDocument()
  })

  it('allows deleting a session with confirmation modal', async () => {
    const mockRepo = createMockRepo(adminUser, {
      zones: [gymZone, hyroxZone],
      trainers: [trainerDiego],
      sessions: [testSession],
    })
    resetRepositoryForTests(mockRepo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <SessionsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    const deleteBtn = await screen.findByTitle('Eliminar sesión')
    await userEvent.click(deleteBtn)

    expect(
      screen.getByText(/¿Eliminar Clase Programada\?/i),
    ).toBeInTheDocument()

    const confirmDeleteBtn = screen.getByRole('button', {
      name: /sí, eliminar clase/i,
    })
    await userEvent.click(confirmDeleteBtn)

    await waitFor(() => {
      expect(mockRepo.deleteSession).toHaveBeenCalledWith(testSession.id)
    })
  })
})
