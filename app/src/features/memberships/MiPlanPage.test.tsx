import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('does not show inactive plans in PlansShowcase for members', async () => {
    const adminRepo = new LocalRepository()
    await adminRepo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    await adminRepo.upsertMembershipPlan({
      id: 'plan-trimestral',
      name: 'Plan Trimestral',
      priceCents: 12000,
      durationDays: 90,
      active: false,
    })

    const memberRepo = new LocalRepository()
    await memberRepo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MiPlanPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.queryByText('Plan Trimestral')).not.toBeInTheDocument()
    expect(screen.getAllByText('Plan Mensual Ilimitado').length).toBeGreaterThan(0)
  })

  it('el socio elige un plan y deja pendiente la forma de pago', async () => {
    const user = userEvent.setup()
    const repo = new LocalRepository()
    await repo.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MiPlanPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await user.click((await screen.findAllByRole('button', { name: 'Elegir este plan' }))[0]!)

    expect(screen.getByRole('heading', { name: /Cómo vas a pagar/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elegir este plan' })).not.toBeInTheDocument()
    expect(screen.queryByText('Planes disponibles')).not.toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Enviar solicitud' })
    expect(send).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(await screen.findByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Elegir este plan' }).length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Elegir este plan' })[0]!)
    await user.click(screen.getByRole('button', { name: 'Efectivo' }))
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }))

    expect(await screen.findByText('Solicitud enviada')).toBeInTheDocument()
    expect(screen.getByText(/Pendiente de pago en recepción/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Elegir este plan' })).not.toBeInTheDocument()
    expect(await repo.getMemberMembership('user_member_2')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(await screen.findByText('Planes disponibles')).toBeInTheDocument()
  })
})
