import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CobrosPage } from '@/features/admin/CobrosPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { DEMO_PASSWORD, createSeedState } from '@/data/seed'
import type { Payment } from '@/domain/models'

/**
 * Pago en línea (Pagomedios) visto por administración en Cobros:
 * filtro y métrica "En línea", código de autorización y estados en español.
 * Los totales solo suman pagos aprobados.
 */
const STORAGE_KEY = 'reservasgym.intermedia.v2'

const base = {
  userId: 'user_member',
  planId: 'plan-mensual-full',
  membershipId: null,
  manualMethod: null,
  createdAt: '2026-09-20T15:00:00.000Z',
} as const

const payments: Payment[] = [
  {
    ...base,
    id: 'pay_cash',
    amountCents: 4500,
    status: 'approved',
    provider: 'manual',
    manualMethod: 'cash',
    reference: 'CAJA-7',
    approvedAt: base.createdAt,
  },
  {
    ...base,
    id: 'pay_pm_ok',
    amountCents: 1500,
    status: 'approved',
    provider: 'pagomedios',
    reference: 'pm-token-ok',
    authorizationCode: '254848',
    approvedAt: base.createdAt,
  },
  {
    ...base,
    id: 'pay_pm_pending',
    amountCents: 1500,
    status: 'pending',
    provider: 'pagomedios',
    reference: 'pm-token-pending',
    approvedAt: null,
  },
  {
    ...base,
    id: 'pay_pm_rejected',
    amountCents: 200,
    status: 'rejected',
    provider: 'pagomedios',
    reference: 'pm-token-rejected',
    approvedAt: null,
  },
]

async function renderHistory() {
  const state = createSeedState()
  state.payments = payments
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  const repo = new LocalRepository()
  resetRepositoryForTests(repo)
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
  const user = userEvent.setup()
  await user.click(await screen.findByText(/Historial General de Cobros/i))
  await screen.findByText('pm-token-ok')
  return user
}

function metric(label: string) {
  return screen.getByText(label, { selector: 'div' }).parentElement!
}

describe('Cobros · pagos en línea (Pagomedios)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('los totales solo cuentan pagos aprobados y separan "En línea"', async () => {
    await renderHistory()
    expect(metric('Total Recaudado')).toHaveTextContent('$60.00 USD')
    expect(metric('Total Recaudado')).toHaveTextContent('2 cobros aprobados')
    expect(metric('En línea')).toHaveTextContent('$15.00 USD')
    expect(metric('Efectivo')).toHaveTextContent('$45.00 USD')
  })

  it('muestra método, código de autorización y estados en español', async () => {
    await renderHistory()
    const row = screen.getByText('pm-token-ok').closest('tr')!
    expect(within(row).getByText('Tarjeta en línea')).toBeInTheDocument()
    expect(within(row).getByText('Aut. 254848')).toBeInTheDocument()
    expect(within(row).getByText('Aprobado')).toBeInTheDocument()
    expect(
      within(screen.getByText('pm-token-pending').closest('tr')!).getByText('Pendiente'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('pm-token-rejected').closest('tr')!).getByText('Rechazado'),
    ).toBeInTheDocument()
    for (const raw of ['pending', 'rejected', 'approved']) {
      expect(screen.queryByText(raw, { exact: true })).toBeNull()
    }
  })

  it('el filtro "En línea (Pagomedios)" deja solo los pagos en línea', async () => {
    const user = await renderHistory()
    await user.click(screen.getByRole('button', { name: 'En línea (Pagomedios)' }))
    expect(screen.queryByText('CAJA-7')).toBeNull()
    expect(screen.getByText('pm-token-ok')).toBeInTheDocument()
    expect(screen.getByText('pm-token-pending')).toBeInTheDocument()
    expect(screen.getByText('pm-token-rejected')).toBeInTheDocument()
  })

  it('se puede buscar por el código de autorización', async () => {
    const user = await renderHistory()
    await user.type(screen.getByPlaceholderText(/Buscar por socio/i), '254848')
    expect(screen.getByText('pm-token-ok')).toBeInTheDocument()
    expect(screen.queryByText('pm-token-pending')).toBeNull()
    expect(screen.queryByText('CAJA-7')).toBeNull()
  })
})
