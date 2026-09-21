import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/features/catalog/HomePage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { Booking, Membership, Session, User } from '@/domain/models'

const memberUser: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

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

function renderHome() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <HomePage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('HomePage — hero del socio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('socio sin plan ve la bienvenida en lugar de "Sin reservas próximas"', async () => {
    resetRepositoryForTests(createMockRepo(memberUser, { memberships: [] }))

    renderHome()

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Sin reservas próximas/i),
    ).not.toBeInTheDocument()
  })

  it('socio con plan activo y sin reservas ve "Sin reservas próximas"', async () => {
    resetRepositoryForTests(
      createMockRepo(memberUser, { memberships: [activeMembership] }),
    )

    renderHome()

    expect(
      await screen.findByText(/Sin reservas próximas/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Activa tu plan y empieza a entrenar/i),
    ).not.toBeInTheDocument()
  })

  it('socio con reserva próxima ve su próxima clase', async () => {
    const session: Session = {
      id: 'ses_1',
      templateId: 'tpl_1',
      zoneId: 'zone-crossfit',
      title: 'CrossFit WOD Power',
      kind: 'class',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      capacity: 18,
      trainerId: null,
      bookedCount: 1,
    }
    const booking: Booking = {
      id: 'bk_1',
      sessionId: session.id,
      userId: memberUser.id,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      checkInCode: 'ZC0001',
    }

    resetRepositoryForTests(
      createMockRepo(memberUser, {
        memberships: [activeMembership],
        sessions: [session],
        bookings: [booking],
      }),
    )

    renderHome()

    const heroLabel = await screen.findByText(/Tu próxima clase/i)
    // La sesión también sale en «Próximas sesiones»: el título se busca en el hero.
    expect(
      within(heroLabel.parentElement!).getByText('CrossFit WOD Power'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Activa tu plan y empieza a entrenar/i),
    ).not.toBeInTheDocument()
  })

  it('no saluda "Socio" cuando el nombre de cuenta empieza por el rol', async () => {
    resetRepositoryForTests(
      createMockRepo(
        { ...memberUser, fullName: 'Socio Demo Staging' },
        { memberships: [activeMembership] },
      ),
    )
    renderHome()
    expect(await screen.findByRole('heading', { level: 1 })).not.toHaveTextContent(
      /Socio/,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Demo/)
  })

  it('socio sin plan no ve atajos de agenda ni reservas', async () => {
    resetRepositoryForTests(createMockRepo(memberUser, { memberships: [] }))
    renderHome()
    await screen.findByText(/Activa tu plan y empieza a entrenar/i)
    expect(screen.queryByRole('link', { name: /Reservar clase/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver agenda/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Explorar áreas/i }).length).toBeGreaterThan(0)
  })
})
