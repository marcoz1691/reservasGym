import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminPage } from './AdminPage'
import { BrandingPage } from './BrandingPage'
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

  describe('AdminPage — accesos rápidos en móvil', () => {
    function renderDashboard() {
      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )
    }

    it('el admin llega a Planes, Sesiones y Personalización desde el Dashboard', async () => {
      await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
      renderDashboard()

      expect(await screen.findByRole('link', { name: /Personalización/i })).toHaveAttribute(
        'href',
        '/admin/marca',
      )
      expect(screen.getByRole('link', { name: /^Planes$/i })).toHaveAttribute('href', '/admin/planes')
      expect(screen.getByRole('link', { name: /^Sesiones$/i })).toHaveAttribute(
        'href',
        '/admin/sesiones',
      )
    })

    it('el staff no ve Personalización', async () => {
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
      renderDashboard()

      expect(await screen.findByRole('link', { name: /^Planes$/i })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /Personalización/i })).not.toBeInTheDocument()
    })
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

      expect(await screen.findByRole('heading', { name: 'Cobros' })).toBeInTheDocument()
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
      expect(amountInput).toHaveValue('45.00')

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
        await screen.findByRole('heading', { name: 'Planes' }),
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

    it('allows admin to edit a plan and delete a plan from the UI', async () => {
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

      expect(await screen.findByText(/Plan Trimestral/i)).toBeInTheDocument()

      const editButtons = screen.getAllByRole('button', { name: /Editar/i })
      await user.click(editButtons[0]!)

      const priceInput = screen.getByLabelText(/Precio en USD/i)
      await user.clear(priceInput)
      await user.type(priceInput, '99.00')

      await user.click(screen.getByRole('button', { name: /Guardar Cambios/i }))
      expect(await screen.findByText('$99.00')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /Crear Nuevo Plan/i }))
      await user.type(screen.getByLabelText(/Nombre del Plan/i), 'Plan Temp Delete')
      await user.type(screen.getByLabelText(/Precio en USD/i), '10')
      await user.click(screen.getByRole('button', { name: /Crear Plan/i }))
      expect(await screen.findByText('Plan Temp Delete')).toBeInTheDocument()

      const card = screen.getByText('Plan Temp Delete').closest('[class*="rounded"]')!
      const deleteBtn = card.querySelector('button[class*="danger"]') as HTMLButtonElement
      await user.click(deleteBtn)

      expect(
        screen.getByText(/¿Eliminar Plan de Membresía\?/i),
      ).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /Sí, Eliminar Plan/i }))

      expect(screen.queryByText('Plan Temp Delete')).not.toBeInTheDocument()
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

    it('restricts members from accessing PlanesPage', async () => {
      await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

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

  describe('Admin y marca', () => {
    it('bloquea al socio en el panel y en la marca', async () => {
      await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })

      const { unmount } = render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(await screen.findByText(/Acceso restringido/i)).toBeInTheDocument()
      expect(screen.queryByText('Panel de Administración')).not.toBeInTheDocument()
      unmount()

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin/marca']}>
            <Routes>
              <Route path="/admin/marca" element={<BrandingPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(await screen.findByText(/Acceso restringido/i)).toBeInTheDocument()
      expect(screen.queryByText('Personalización')).not.toBeInTheDocument()
    })

    it('deja entrar a staff al panel de administración', async () => {
      await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })

      render(
        <RepositoryProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </MemoryRouter>
        </RepositoryProvider>,
      )

      expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })
  })
})
