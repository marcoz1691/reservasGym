import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymState, Membership, User } from '@/domain/models'

const memberSinFicha: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const memberConFicha: User = {
  ...memberSinFicha,
  heightCm: 170,
  initialWeightKg: 68,
}

const staffSinFicha: User = {
  ...memberSinFicha,
  id: 'user_staff_1',
  role: 'staff',
}

const activeMembership: Membership = {
  id: 'mem_1',
  userId: memberConFicha.id,
  planId: 'plan_1',
  status: 'active',
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2026-12-31T00:00:00.000Z',
  graceEndsAt: '2027-01-03T00:00:00.000Z',
  visitsLeft: null,
}

function renderApp(user: User, state: Partial<GymState> = {}) {
  resetRepositoryForTests(createMockRepo(user, state))

  return render(
    <MemoryRouter initialEntries={['/']}>
      <RepositoryProvider>
        <AppRouter />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

const lazy = { timeout: 8000 }

describe('Primer ingreso — ficha técnica', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('socio sin ficha aterriza en la ficha técnica inicial', async () => {
    renderApp(memberSinFicha)

    expect(
      await screen.findByText('Ficha Técnica Inicial de Ingreso', undefined, lazy),
    ).toBeInTheDocument()
  })

  it('socio con ficha completa entra directo a Inicio', async () => {
    renderApp(memberConFicha)

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i, undefined, lazy),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Ficha Técnica Inicial de Ingreso'),
    ).not.toBeInTheDocument()
  })

  it('socio sin plan no ve Reservar ni Mis clases en la navegación', async () => {
    renderApp(memberConFicha)

    await screen.findByText(/Activa tu plan y empieza a entrenar/i, undefined, lazy)
    expect(screen.queryByRole('link', { name: /^Reservar$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Reservas$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /mis clases/i })).not.toBeInTheDocument()
  })

  it('socio con plan ve Reservar y Mis clases, no Reservas ni Agenda', async () => {
    renderApp(memberConFicha, { memberships: [activeMembership] })

    expect(
      await screen.findByText(/Sin clases próximas/i, undefined, lazy),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^Reservar$/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /^Mis clases$/i }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /^Agenda$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Reservas$/i })).not.toBeInTheDocument()
  })

  it('staff ve Reservar y Reservar clases, no Agenda', async () => {
    renderApp(staffSinFicha)

    expect(
      await screen.findByText(/Áreas disponibles/i, undefined, lazy),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^Reservar$/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Reservar clases/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Agenda$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Agenda General/i })).not.toBeInTheDocument()
  })

  it('socio sin plan ve un popup de recordatorio, no un banner de error', async () => {
    renderApp(memberConFicha)

    const reminder = await screen.findByTestId('plan-required-notice')
    expect(reminder).toHaveAttribute('role', 'dialog')
    expect(screen.queryByTestId('expiry-banner')).not.toBeInTheDocument()
    expect(screen.queryByText(/pausadas/i)).not.toBeInTheDocument()
    expect(reminder.className).not.toMatch(/danger/)
  })

  it('ver planes cierra el recordatorio y muestra Mi Plan', async () => {
    renderApp(memberConFicha)

    const reminder = await screen.findByTestId('plan-required-notice')
    await userEvent.click(within(reminder).getByRole('link', { name: /ver planes/i }))

    expect(screen.queryByTestId('plan-required-notice')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Mi Plan' }, lazy),
    ).toBeInTheDocument()
  })

  it('"Completarla después" deja entrar a la app en esta sesión', async () => {
    renderApp(memberSinFicha)

    await screen.findByText('Ficha Técnica Inicial de Ingreso', undefined, lazy)
    await userEvent.click(
      screen.getByRole('button', { name: /Completarla después/i }),
    )

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i, undefined, lazy),
    ).toBeInTheDocument()
  })

  it('staff nunca es desviado a la ficha', async () => {
    renderApp(staffSinFicha)

    // Espera a que Inicio termine de cargar antes de negar la ficha.
    expect(await screen.findByText(/Áreas disponibles/i)).toBeInTheDocument()
    expect(
      screen.queryByText('Ficha Técnica Inicial de Ingreso'),
    ).not.toBeInTheDocument()
  })

  it('socio sin ficha guarda la ficha y aterriza en Inicio', async () => {
    const user = { ...memberSinFicha }
    const repo = createMockRepo(user)
    repo.updateProfile = vi.fn(async (patch) => Object.assign(user, patch))
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter initialEntries={['/']}>
        <RepositoryProvider>
          <AppRouter />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Ficha Técnica Inicial de Ingreso')
    await userEvent.type(
      screen.getByLabelText(/Fecha de Nacimiento/i),
      '1992-03-10',
    )
    await userEvent.type(
      screen.getByLabelText(/Sector \/ Ciudad de Residencia/i),
      'Tumbaco',
    )
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.type(screen.getByLabelText(/Estatura/i), '180')
    await userEvent.type(screen.getByLabelText(/Masa corporal/i), '72')
    await userEvent.click(
      screen.getByRole('button', { name: /Guardar Ficha Técnica/i }),
    )

    expect(
      await screen.findByText('¡Ficha Técnica Guardada!'),
    ).toBeInTheDocument()

    await waitFor(
      () => {
        expect(
          screen.getByText(/Activa tu plan y empieza a entrenar/i),
        ).toBeInTheDocument()
      },
      { timeout: 8000 },
    )
    expect(
      screen.queryByText('Ficha Técnica Inicial de Ingreso'),
    ).not.toBeInTheDocument()
  })
})
