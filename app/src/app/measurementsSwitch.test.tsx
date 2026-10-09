import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymSettings, Membership, User } from '@/domain/models'

const member: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
  heightCm: 170,
  initialWeightKg: 68,
}

const staff: User = { ...member, id: 'user_staff_1', role: 'staff' }

const activeMembership: Membership = {
  id: 'mem_1',
  userId: member.id,
  planId: 'plan_1',
  status: 'active',
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2099-12-31T00:00:00.000Z',
  graceEndsAt: '2100-01-03T00:00:00.000Z',
  visitsLeft: null,
}

const settings: GymSettings = {
  name: 'Zona Cero',
  logoUrl: null,
  primaryColor: '#000',
  accentColor: '#F26D17',
  bookingWindowHours: 72,
  cancelWindowHours: 2,
  checkInWindowMinutes: 20,
}

function renderApp(user: User, path: string, measurementsEnabled: boolean) {
  resetRepositoryForTests(
    createMockRepo(user, {
      settings: { ...settings, measurementsEnabled },
      memberships: [activeMembership],
    }),
  )
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RepositoryProvider>
        <AppRouter />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

const lazy = { timeout: 8000 }
const weightLinks = () => document.querySelectorAll('a[href="/peso"]')

describe('Interruptor de medidas corporales', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('encendido, el socio ve Medidas en el menú y en Inicio', async () => {
    renderApp(member, '/', true)

    await screen.findByText(/Sin clases próximas/i, undefined, lazy)
    expect(screen.getAllByRole('link', { name: /Medidas/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('Último peso')).toBeInTheDocument()
  })

  it('apagado, el socio no ve Medidas ni accesos al peso en Inicio', async () => {
    renderApp(member, '/', false)

    await screen.findByText(/Sin clases próximas/i, undefined, lazy)
    expect(screen.queryByRole('link', { name: /Medidas/ })).toBeNull()
    expect(screen.queryByText('Último peso')).toBeNull()
    expect(screen.queryByText('Registrar peso')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Progreso' })).toBeNull()
    expect(weightLinks()).toHaveLength(0)
  })

  it('apagado, entrar a /peso lleva al socio a Inicio', async () => {
    renderApp(member, '/peso', false)

    await screen.findByText(/Sin clases próximas/i, undefined, lazy)
    expect(screen.queryByText('Control Antropométrico & Progreso')).toBeNull()
  })

  it('apagado, el staff tampoco ve Medidas y /peso lo lleva al panel', async () => {
    renderApp(staff, '/peso', false)

    await screen.findByRole('heading', { name: 'Dashboard' }, lazy)
    expect(screen.queryByText('Control Antropométrico & Progreso')).toBeNull()
    expect(screen.queryByRole('link', { name: /Medidas/ })).toBeNull()
  })
})
