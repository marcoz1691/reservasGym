import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymState, User } from '@/domain/models'

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

describe('Primer ingreso — ficha técnica', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('socio sin ficha aterriza en la ficha técnica inicial', async () => {
    renderApp(memberSinFicha)

    expect(
      await screen.findByText('Ficha Técnica Inicial de Ingreso'),
    ).toBeInTheDocument()
  })

  it('socio con ficha completa entra directo a Inicio', async () => {
    renderApp(memberConFicha)

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Ficha Técnica Inicial de Ingreso'),
    ).not.toBeInTheDocument()
  })

  it('"Completarla después" deja entrar a la app en esta sesión', async () => {
    renderApp(memberSinFicha)

    await screen.findByText('Ficha Técnica Inicial de Ingreso')
    await userEvent.click(
      screen.getByRole('button', { name: /Completarla después/i }),
    )

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i),
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
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/i }))
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
