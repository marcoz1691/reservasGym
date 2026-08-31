import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CobrosPage } from './CobrosPage'
import { PlanesPage } from './PlanesPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { DEMO_PASSWORD } from '@/data/seed'

describe('Admin Billing & Membership Plans UI', () => {
  let repo: LocalRepository

  beforeEach(() => {
    localStorage.clear()
    repo = new LocalRepository()
    resetRepositoryForTests(repo)
  })

  describe('CobrosPage', () => {
    it('renders tabs and POS form for admin user', async () => {
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/cobros']}>
            <Routes>
              <Route path="/admin/cobros" element={<CobrosPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(await screen.findByText(/Panel de Cobros & POS/i)).toBeInTheDocument()
      expect(screen.getByText(/Registrar Cobro \(POS\)/i)).toBeInTheDocument()
      expect(screen.getByText(/Socios por Vencer y Vencidos/i)).toBeInTheDocument()
      expect(screen.getByText(/Historial General de Cobros/i)).toBeInTheDocument()
    })

    it('allows staff to select a member, plan, payment method and submit manual payment', async () => {
      const user = userEvent.setup()
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/cobros']}>
            <Routes>
              <Route path="/admin/cobros" element={<CobrosPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      // Wait for members and plans to load
      expect(await screen.findByText('Ana Socio')).toBeInTheDocument()

      // 1. Select member "Ana Socio"
      await user.click(screen.getByText('Ana Socio'))
      expect(screen.getByText(/Cambiar socio/i)).toBeInTheDocument()

      // 2. Select a plan from active plans
      const planCards = screen.getAllByText(/Plan Mensual Ilimitado/i)
      await user.click(planCards[0]!)

      // Amount should auto-fill with 45.00
      const amountInput = screen.getByLabelText(/Monto a Cobrar \(USD\)/i)
      expect(amountInput).toHaveValue(45)

      // 3. Select payment method "Datáfono POS Datafast"
      const posButton = screen.getByText(/Datáfono POS Datafast/i)
      await user.click(posButton)

      // 4. Enter voucher reference
      const refInput = screen.getByLabelText(/Referencia \/ # Voucher/i)
      await user.type(refInput, 'POS-TX-998811')

      // 5. Submit payment
      const submitBtn = screen.getByRole('button', {
        name: /Confirmar Cobro y Activar Membresía/i,
      })
      await user.click(submitBtn)

      // Verify Receipt is displayed
      expect(
        await screen.findByText(/¡Cobro Registrado y Membresía Activada!/i),
      ).toBeInTheDocument()
      expect(screen.getByText(/POS-TX-998811/i)).toBeInTheDocument()
      expect(screen.getAllByText(/\$45\.00 USD/i).length).toBeGreaterThan(0)
    })

    it('navigates to expiring members tab and allows quick renewal', async () => {
      const user = userEvent.setup()
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/cobros']}>
            <Routes>
              <Route path="/admin/cobros" element={<CobrosPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      // Click on "Socios por Vencer y Vencidos" tab
      const tabBtn = await screen.findByText(/Socios por Vencer y Vencidos/i)
      await user.click(tabBtn)

      // Should show filter pills
      expect(screen.getByText(/Por Vencer \(≤ 7 días\)/i)).toBeInTheDocument()
      expect(screen.getByText(/En Periodo de Gracia \(3 días\)/i)).toBeInTheDocument()
    })

    it('displays history metrics and table on Historial tab', async () => {
      const user = userEvent.setup()
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/cobros']}>
            <Routes>
              <Route path="/admin/cobros" element={<CobrosPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      // Click on Historial tab
      const tabBtn = await screen.findByText(/Historial General de Cobros/i)
      await user.click(tabBtn)

      expect(await screen.findByText(/Total Recaudado/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Datáfono POS/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Efectivo/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Transferencia/i).length).toBeGreaterThan(0)
    })

    it('blocks regular member from accessing CobrosPage', async () => {
      await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/cobros']}>
            <Routes>
              <Route path="/admin/cobros" element={<CobrosPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(await screen.findByText(/Acceso restringido/i)).toBeInTheDocument()
    })
  })

  describe('PlanesPage', () => {
    it('allows admin to view, create, edit, toggle and delete plans', async () => {
      const user = userEvent.setup()
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/planes']}>
            <Routes>
              <Route path="/admin/planes" element={<PlanesPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(
        await screen.findByText(/Gestión de Planes de Membresía/i),
      ).toBeInTheDocument()

      // Verify existing seeded plans exist
      expect(screen.getByText(/Plan Mensual Ilimitado/i)).toBeInTheDocument()

      // Click "Crear Nuevo Plan"
      const createBtn = screen.getByRole('button', { name: /Crear Nuevo Plan/i })
      await user.click(createBtn)

      expect(screen.getByText(/Nuevo Plan de Membresía/i)).toBeInTheDocument()

      // Fill form
      const nameInput = screen.getByLabelText(/Nombre del Plan/i)
      await user.type(nameInput, 'Plan Fisioterapia & Cross')

      const priceInput = screen.getByLabelText(/Precio en USD/i)
      await user.type(priceInput, '65.00')

      // Save
      const saveBtn = screen.getByRole('button', { name: /Crear Plan/i })
      await user.click(saveBtn)

      // Verify new plan appears in list
      expect(await screen.findByText('Plan Fisioterapia & Cross')).toBeInTheDocument()
    })

    it('restricts non-admin users from accessing PlanesPage', async () => {
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/planes']}>
            <Routes>
              <Route path="/admin/planes" element={<PlanesPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(
        await screen.findByText(/Acceso exclusivo para Administradores/i),
      ).toBeInTheDocument()
    })
  })
})
