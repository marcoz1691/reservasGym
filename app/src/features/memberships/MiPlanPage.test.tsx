import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MiPlanPage } from './MiPlanPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'

describe('MiPlanPage (Member UI for Memberships)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('renders active membership details, renewal info, plans and payment history for member', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MiPlanPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Wait for header
    expect(await screen.findByText('Mi Plan')).toBeInTheDocument()

    // Check Plan name and Active status
    expect(
      screen.getByRole('heading', { level: 2, name: 'Plan Mensual Ilimitado' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Membresía activa')).toBeInTheDocument()

    // Check Renewal Card
    expect(screen.getByText(/Renueva tu plan en recepción/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Próximamente: Pago online con tarjeta desde la app/i),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Efectivo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Transferencia').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Tarjeta Datafast').length).toBeGreaterThan(0)

    // Check Plans Showcase
    expect(screen.getByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.getByText('Plan Trimestral')).toBeInTheDocument()
    expect(screen.getByText('Pase 10 Visitas')).toBeInTheDocument()
    expect(screen.getByText('Dragon Fit Mensual')).toBeInTheDocument()

    // Check Payment History
    expect(screen.getByText('Historial de pagos')).toBeInTheDocument()
    expect(screen.getAllByText('$45.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aprobado').length).toBeGreaterThan(0)
  })

  it('renders empty state when user has no membership', async () => {
    const repo = new LocalRepository()
    // Sign up a fresh member with no membership
    await repo.signUp({
      email: 'nuevo@gym.local',
      fullName: 'Nuevo Socio',
      password: 'password123',
    })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MiPlanPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    // Wait for empty state message
    expect(
      await screen.findByText(/Activa tu plan en recepción para empezar a entrenar/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin membresía activa')).toBeInTheDocument()
    expect(screen.getByText(/1. Elige tu plan/i)).toBeInTheDocument()

    // Should still showcase plans and renewal instructions
    expect(screen.getByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.getByText(/Sin registros de pago/i)).toBeInTheDocument()
  })
})
