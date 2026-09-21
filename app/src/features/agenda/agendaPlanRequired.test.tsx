import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymState, Membership, MembershipPlan, Session, User, Zone } from '@/domain/models'

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
  {
    id: 'zone-muscu',
    name: 'Musculación',
    type: 'musculacion',
    description: 'Pesas',
    defaultCapacity: 30,
    imageHint: 'weights',
  },
  {
    id: 'zone-hyrox',
    name: 'Hyrox',
    type: 'hyrox',
    description: 'Hyrox',
    defaultCapacity: 16,
    imageHint: 'hyrox',
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
  {
    id: 'ses_muscu',
    templateId: 'tpl_muscu',
    zoneId: 'zone-muscu',
    title: 'Acceso libre QA',
    kind: 'open',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    capacity: 40,
    trainerId: null,
    bookedCount: 0,
  },
  {
    id: 'ses_hyrox',
    templateId: 'tpl_hyrox',
    zoneId: 'zone-hyrox',
    title: 'Hyrox QA',
    kind: 'class',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    capacity: 16,
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

  it('socio sin plan ve el botón "Activar plan" en vez de "Reservar"', async () => {
    renderAgenda(memberUser, { memberships: [] })

    expect(
      await screen.findByRole('link', {
        name: /Activar plan para reservar CrossFit WOD Power/i,
      }),
    ).toHaveAttribute('href', '/membresia')
    expect(
      screen.queryByRole('button', { name: /^Reservar$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
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
    renderAgenda(memberUser, {
      memberships: [activeMembership],
      membershipPlans: [
        {
          id: 'plan_1',
          name: 'Plan Full',
          priceCents: 7500,
          durationDays: 30,
          visitQuota: null,
          allowedZoneIds: [],
          active: true,
        },
      ],
    })

    expect(
      (await screen.findAllByRole('button', { name: /Reservar/i })).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })

  it('Zero Active solo reserva musculación; Hyrox queda no incluido', async () => {
    const zeroActive: MembershipPlan = {
      id: 'plan_za',
      name: 'Zero Active Mensual',
      priceCents: 3500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: ['zone-gimnasio', 'zone-muscu', 'zone-bailo'],
      active: true,
    }
    renderAgenda(memberUser, {
      memberships: [{ ...activeMembership, planId: zeroActive.id }],
      membershipPlans: [zeroActive],
    })

    expect(
      await screen.findByRole('button', {
        name: /Reservar Acceso libre QA/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /No incluido en tu plan: Hyrox QA/i,
      }),
    ).toHaveAttribute('href', '/membresia')
    expect(
      screen.queryByRole('button', { name: /Reservar Hyrox QA/i }),
    ).not.toBeInTheDocument()
  })

  it('staff no ve el aviso ni pierde su botón de reserva', async () => {
    renderAgenda(staffUser, { memberships: [] })

    expect(
      (await screen.findAllByRole('button', { name: /Reservar/i })).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })
})
