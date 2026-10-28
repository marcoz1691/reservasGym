import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { MyBookingsPage } from './MyBookingsPage'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymRepository } from '@/data/types'
import type { Booking, GymState, Membership, MembershipPlan, Session, User, Zone } from '@/domain/models'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

const DAY_MS = 24 * 60 * 60 * 1000

const memberUser: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const zones: Zone[] = [
  {
    id: 'zone-crossfit',
    name: 'CrossFit',
    type: 'crossfit',
    description: 'CrossFit',
    defaultCapacity: 18,
    imageHint: 'crossfit',
  },
]

const sessions: Session[] = [
  {
    id: 'ses_cf',
    templateId: 'tpl_cf',
    zoneId: 'zone-crossfit',
    title: 'CrossFit WOD Power',
    kind: 'class',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    capacity: 18,
    trainerId: null,
    bookedCount: 0,
  },
]

const plan: MembershipPlan = {
  id: 'plan_1',
  name: 'Plan Full',
  priceCents: 7500,
  durationDays: 30,
  visitQuota: null,
  allowedZoneIds: [],
  active: true,
}

const membership: Membership = {
  id: 'mem_1',
  userId: memberUser.id,
  planId: plan.id,
  status: 'active',
  startsAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
  endsAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
  graceEndsAt: new Date(Date.now() + 23 * DAY_MS).toISOString(),
  visitsLeft: null,
}

function booking(status: Booking['status']): Booking {
  return {
    id: 'bk_1',
    sessionId: 'ses_cf',
    userId: memberUser.id,
    status,
    createdAt: new Date().toISOString(),
    cancelledAt: status === 'cancelled' ? new Date().toISOString() : null,
    checkInCode: 'QA1234',
  }
}

/** Repo cuyo `load()` lee el arreglo `bookings` en cada llamada (refleja lo que cambió). */
async function repoWithBookings(bookings: Booking[]): Promise<GymRepository> {
  const repo = createMockRepo(memberUser, {
    zones,
    sessions,
    memberships: [membership],
    membershipPlans: [plan],
  })
  const base: GymState = await repo.load()
  repo.load = vi.fn(async () => ({ ...base, bookings: [...bookings] }))
  return repo
}

describe('Caché de reservas (TanStack Query)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('al reservar desde la agenda vuelve a cargar el estado y muestra Reservado', async () => {
    const user = userEvent.setup()
    const bookings: Booking[] = []
    const repo = await repoWithBookings(bookings)
    vi.mocked(repo.createBooking).mockImplementation(async () => {
      const created = booking('confirmed')
      bookings.push(created)
      return created
    })
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <AgendaPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await user.click(
      await screen.findByRole('button', { name: /Reservar CrossFit WOD Power/i }),
    )

    expect(
      await screen.findByRole('button', { name: /Reservado CrossFit WOD Power/i }),
    ).toBeDisabled()
    expect(repo.createBooking).toHaveBeenCalledWith('ses_cf', memberUser.id)
    expect(repo.load).toHaveBeenCalledTimes(2)
  })

  it('al cancelar en Mis clases invalida la caché y la clase sale de la lista', async () => {
    const user = userEvent.setup()
    const bookings: Booking[] = [booking('confirmed')]
    const repo = await repoWithBookings(bookings)
    vi.mocked(repo.cancelBooking).mockImplementation(async () => {
      bookings.splice(0, 1, booking('cancelled'))
      return bookings[0]!
    })
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MyBookingsPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('CrossFit WOD Power')).toBeInTheDocument()
    expect(repo.load).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('Reserva cancelada')).toBeInTheDocument()
    expect(repo.cancelBooking).toHaveBeenCalledWith('bk_1')
    expect(repo.load).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Todavía no apartaste ninguna clase/i)).toBeInTheDocument()
  })

  it('volver a la pantalla con datos frescos no vuelve a pedir el estado', async () => {
    const repo = await repoWithBookings([booking('confirmed')])
    resetRepositoryForTests(repo)

    const view = (show: boolean) => (
      <MemoryRouter>
        <RepositoryProvider>{show ? <MyBookingsPage /> : null}</RepositoryProvider>
      </MemoryRouter>
    )
    const { rerender } = render(view(true))
    expect(await screen.findByText('CrossFit WOD Power')).toBeInTheDocument()

    rerender(view(false))
    rerender(view(true))

    expect(await screen.findByText('CrossFit WOD Power')).toBeInTheDocument()
    expect(repo.load).toHaveBeenCalledTimes(1)
  })

  it('con datos vencidos, entrar a la pantalla los refresca en segundo plano', async () => {
    const repo = await repoWithBookings([booking('confirmed')])
    resetRepositoryForTests(repo)
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 0, retry: false } },
    })

    const view = (show: boolean) => (
      <MemoryRouter>
        <RepositoryProvider queryClient={client}>
          {show ? <MyBookingsPage /> : null}
        </RepositoryProvider>
      </MemoryRouter>
    )
    const { rerender } = render(view(true))
    expect(await screen.findByText('CrossFit WOD Power')).toBeInTheDocument()
    const callsAfterMount = vi.mocked(repo.load).mock.calls.length

    rerender(view(false))
    rerender(view(true))

    await waitFor(() =>
      expect(vi.mocked(repo.load).mock.calls.length).toBe(callsAfterMount + 1),
    )
    // Sin esqueleto: el refresco en segundo plano no oculta la lista.
    expect(screen.getByText('CrossFit WOD Power')).toBeInTheDocument()
  })
})
