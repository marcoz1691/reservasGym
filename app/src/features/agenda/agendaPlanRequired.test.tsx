import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymState, Membership, Session, User, Zone } from '@/domain/models'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

const memberUser: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const staffUser: User = {
  id: 'user_staff_1',
  email: 'staff@gym.local',
  fullName: 'Staff Zona Cero',
  role: 'staff',
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

const DAY_MS = 24 * 60 * 60 * 1000

const activeMembership: Membership = {
  id: 'mem_1',
  userId: memberUser.id,
  planId: 'plan_1',
  status: 'active',
  startsAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
  endsAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
  graceEndsAt: new Date(Date.now() + 23 * DAY_MS).toISOString(),
  visitsLeft: null,
}

const expiredMembership: Membership = {
  ...activeMembership,
  id: 'mem_old',
  startsAt: new Date(Date.now() - 60 * DAY_MS).toISOString(),
  endsAt: new Date(Date.now() - 20 * DAY_MS).toISOString(),
  graceEndsAt: new Date(Date.now() - 17 * DAY_MS).toISOString(),
}

function renderAgenda(user: User, state: Partial<GymState>) {
  resetRepositoryForTests(
    createMockRepo(user, { zones, sessions, ...state }),
  )

  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <AgendaPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('AgendaPage — socio sin plan puede explorar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('socio sin plan ve el aviso y el botón "Activar plan" en vez de "Reservar"', async () => {
    renderAgenda(memberUser, { memberships: [] })

    expect(
      await screen.findByTestId('plan-required-notice'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Activar plan para reservar CrossFit WOD Power/i,
      }),
    ).toHaveAttribute('href', '/membresia')
    expect(
      screen.queryByRole('button', { name: /^Reservar$/i }),
    ).not.toBeInTheDocument()
  })

  it('socio vencido ve "Renovar plan" y no ve el aviso de exploración', async () => {
    renderAgenda(memberUser, { memberships: [expiredMembership] })

    expect(
      await screen.findByRole('link', {
        name: /Renovar plan para reservar CrossFit WOD Power/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })

  it('socio con plan activo conserva el botón "Reservar"', async () => {
    renderAgenda(memberUser, { memberships: [activeMembership] })

    expect(
      await screen.findByRole('button', { name: /^Reservar$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })

  it('staff no ve el aviso ni pierde su botón de reserva', async () => {
    renderAgenda(staffUser, { memberships: [] })

    expect(
      await screen.findByRole('button', { name: /^Reservar$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })
})
