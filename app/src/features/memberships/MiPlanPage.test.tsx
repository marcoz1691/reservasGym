import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MiPlanPage } from './MiPlanPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'

// El ambiente tiene pasarela; lo que decide es el interruptor del admin.
vi.mock('./onlinePay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./onlinePay')>()),
  isOnlinePayEnabled: (settings?: { onlinePaymentsEnabled?: boolean }) =>
    settings?.onlinePaymentsEnabled === true,
}))

async function adminSettings(patch: Parameters<LocalRepository['updateSettings']>[0]) {
  const admin = new LocalRepository()
  await admin.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
  await admin.updateSettings(patch)
}

function renderMiPlan() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <MiPlanPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

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

    // Lo primero es la información del plan propio, no el aviso de recepción
    const membershipCard = screen.getByRole('region', { name: 'Tu membresía' })
    expect(within(membershipCard).getByText('Inicio')).toBeInTheDocument()
    expect(within(membershipCard).getByText('Fecha de vencimiento')).toBeInTheDocument()
    expect(within(membershipCard).getByText('Inversión')).toBeInTheDocument()
    expect(within(membershipCard).getByText('Tu plan incluye')).toBeInTheDocument()

    // Con membresía activa no se ofrecen formas de pago hasta elegir un plan
    expect(screen.queryByText(/Renueva tu plan en recepción/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /Cómo vas a pagar/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Efectivo' })).not.toBeInTheDocument()

    // Check Plans Showcase
    expect(screen.getByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.getByText('Plan Trimestral')).toBeInTheDocument()
    expect(screen.getByText('Pase 10 Visitas')).toBeInTheDocument()
    expect(screen.getAllByText('Dragon Fit Mensual').length).toBeGreaterThan(0)

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
      await screen.findByRole('heading', { name: /Elige tu plan y empieza a entrenar/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin membresía activa')).toBeInTheDocument()
    expect(screen.queryByText(/1\. Elige tu plan/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/2\. Visita recepción/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/3\. Reserva y entrena/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Pagas en recepción. En cuanto registramos el pago, tu acceso queda activo y reservas clase.',
      ),
    ).toBeInTheDocument()
    // Las formas de pago llegan recién al elegir un plan
    expect(
      screen.queryByRole('heading', { name: /Cómo vas a pagar/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Efectivo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver planes' })).toBeInTheDocument()

    // Should still showcase plans and renewal instructions
    expect(screen.getByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.getByText(/Sin registros de pago/i)).toBeInTheDocument()
  })

  it('agrupa el catálogo por familia y muestra el badge de 2 meses gratis', async () => {
    const user = userEvent.setup()
    const adminRepo = new LocalRepository()
    await adminRepo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    await adminRepo.upsertMembershipPlan({
      id: 'plan-elite-anual',
      name: 'Zero Elite Anual',
      priceCents: 42000,
      durationDays: 420,
      active: true,
    })

    const memberRepo = new LocalRepository()
    await memberRepo.signUp({
      email: 'vitrina@gym.local',
      fullName: 'Socio Vitrina',
      password: 'password123',
    })

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MiPlanPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('tablist', { name: 'Familias de plan' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Zero Elite' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Otros planes' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Zero Elite' }))
    expect(await screen.findByText(/2 meses gratis/i)).toBeInTheDocument()
    expect(screen.getByText(/Más ahorro/i)).toBeInTheDocument()
    expect(screen.queryByText(/1. Elige tu plan/i)).not.toBeInTheDocument()
  })

  it('Ver planes desplaza al catálogo', async () => {
    const user = userEvent.setup()
    const repo = new LocalRepository()
    await repo.signUp({
      email: 'catalogo@gym.local',
      fullName: 'Nuevo Catalogo',
      password: 'password123',
    })
    const scrollIntoView = vi.fn()
    const originalScroll = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoView

    try {
      render(
        <MemoryRouter>
          <RepositoryProvider>
            <MiPlanPage />
          </RepositoryProvider>
        </MemoryRouter>,
      )

      await user.click(await screen.findByRole('button', { name: 'Ver planes' }))
      expect(document.getElementById('planes-catalogo')).toBeTruthy()
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScroll
    }
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

  it('con plan activo las formas de pago solo aparecen al elegir otro plan', async () => {
    const user = userEvent.setup()
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter>
        <RepositoryProvider>
          <MiPlanPage />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('region', { name: 'Tu membresía' })
    expect(screen.queryByRole('button', { name: 'Efectivo' })).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Elegir este plan' })[0]!)

    expect(
      screen.getByRole('heading', { name: /Cómo vas a pagar/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Efectivo' })).toBeInTheDocument()
    expect(screen.queryByText('Planes disponibles')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(await screen.findByText('Planes disponibles')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Efectivo' })).not.toBeInTheDocument()
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

  describe('interruptores del admin', () => {
    it('con el pago en línea encendido ofrece pagar desde la tarjeta del plan', async () => {
      await adminSettings({ onlinePaymentsEnabled: true })
      const repo = new LocalRepository()
      await repo.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
      renderMiPlan()

      expect((await screen.findAllByRole('button', { name: 'Elegir plan' })).length).toBeGreaterThan(0)
      expect(screen.queryByRole('button', { name: 'Elegir este plan' })).not.toBeInTheDocument()
    })

    it('con el pago en línea apagado el socio elige plan y paga en recepción', async () => {
      const user = userEvent.setup()
      await adminSettings({ onlinePaymentsEnabled: false })
      const repo = new LocalRepository()
      await repo.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
      renderMiPlan()

      await user.click((await screen.findAllByRole('button', { name: 'Elegir este plan' }))[0]!)
      expect(screen.queryByRole('button', { name: 'Elegir plan' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Efectivo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Transferencia' })).toBeInTheDocument()
    })

    it('con los pases diarios apagados no aparecen en el catálogo', async () => {
      const admin = new LocalRepository()
      await admin.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
      await admin.upsertMembershipPlan({
        id: 'plan-zona-day',
        name: 'Zona Day',
        priceCents: 500,
        durationDays: 1,
        kind: 'day_pass',
        active: true,
      })
      await admin.updateSettings({ dayPassesEnabled: false })
      const repo = new LocalRepository()
      await repo.signIn({ email: 'luis@gym.local', password: DEMO_PASSWORD })
      renderMiPlan()

      expect(await screen.findByText('Planes disponibles')).toBeInTheDocument()
      expect(screen.queryByText('Zona Day')).not.toBeInTheDocument()
    })
  })
})
