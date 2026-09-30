import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { MembershipPlan, User } from '@/domain/models'
import { splitTax } from '../../../supabase/functions/pagomedios-payment/tax'
import { PagomediosCheckoutPage } from './PagomediosCheckoutPage'

const user: User = {
  id: 'u1',
  email: 'socio@gym.local',
  fullName: 'Socio Demo',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
  residence: 'Quito',
}

const plan = {
  id: 'plan_mensual',
  name: 'Plan Mensual',
  priceCents: 3500,
  active: true,
} as MembershipPlan

const repo = {
  createPagomediosPayment: vi.fn(),
  verifyPagomediosPayment: vi.fn(),
}
const refresh = vi.fn().mockResolvedValue(undefined)

vi.mock('@/data/RepositoryProvider', () => ({
  useCurrentUser: () => user,
  useAppData: () => ({ membershipPlans: [plan] }),
  useGym: () => ({ repo, refresh }),
}))

vi.mock('./onlinePay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./onlinePay')>()),
  isOnlinePayEnabled: () => true,
}))

const native = vi.hoisted(() => ({ value: false }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value },
}))

// Navegador dentro de la app: guarda el listener para simular que el socio lo cierra.
const browser = vi.hoisted(() => ({
  open: vi.fn(),
  onFinished: null as null | (() => void),
  remove: vi.fn(),
}))
vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: browser.open,
    addListener: vi.fn(async (_event: string, cb: () => void) => {
      browser.onFinished = cb
      return { remove: browser.remove }
    }),
  },
}))

function CurrentUrl() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<><PagomediosCheckoutPage /><CurrentUrl /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PagomediosCheckoutPage — pago único', () => {
  const assign = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    native.value = false
    browser.onFinished = null
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    })
  })

  it('crea la solicitud con los datos de facturación y redirige a Pagomedios', async () => {
    repo.createPagomediosPayment.mockResolvedValue({
      url: 'https://payurl.link/ZTR3638000',
      paymentId: 'pay_1',
    })
    renderAt('/membresia/pago?planId=plan_mensual')

    expect(screen.getByText(/Plan Mensual · \$35\.00 · pago único/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Número de identificación'), '1723358400')
    await userEvent.type(screen.getByLabelText('Celular'), '0987569852')
    await userEvent.click(screen.getByRole('button', { name: /Pagar \$35\.00 en Pagomedios/ }))

    expect(repo.createPagomediosPayment).toHaveBeenCalledWith({
      planId: 'plan_mensual',
      document: '1723358400',
      documentType: '05',
      phone: '0987569852',
      address: 'Quito',
      native: false,
    })
    expect(assign).toHaveBeenCalledWith('https://payurl.link/ZTR3638000')
    expect(browser.open).not.toHaveBeenCalled()
  })

  it('en la app nativa abre el pago dentro de la app y verifica al cerrarlo', async () => {
    native.value = true
    repo.createPagomediosPayment.mockResolvedValue({
      url: 'https://payurl.link/ZTR3638000',
      paymentId: 'pay_9',
    })
    repo.verifyPagomediosPayment.mockResolvedValue({ status: 'approved' })
    renderAt('/membresia/pago?planId=plan_mensual')

    await userEvent.type(screen.getByLabelText('Número de identificación'), '1723358400')
    await userEvent.type(screen.getByLabelText('Celular'), '0987569852')
    await userEvent.click(screen.getByRole('button', { name: /en Pagomedios/ }))

    await waitFor(() =>
      expect(browser.open).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://payurl.link/ZTR3638000' }),
      ),
    )
    expect(repo.createPagomediosPayment).toHaveBeenCalledWith(
      expect.objectContaining({ native: true }),
    )
    expect(assign).not.toHaveBeenCalled()
    expect(repo.verifyPagomediosPayment).not.toHaveBeenCalled()

    browser.onFinished?.() // el socio cierra el navegador

    expect(await screen.findByText(/Tu membresía ya está activa/)).toBeInTheDocument()
    expect(repo.verifyPagomediosPayment).toHaveBeenCalledWith({ paymentId: 'pay_9' })
    expect(browser.remove).toHaveBeenCalled()
  })

  it('muestra el error de la pasarela y no redirige', async () => {
    repo.createPagomediosPayment.mockRejectedValue(
      new Error('Pagomedios no configurado. Falta el secret PAGOMEDIOS_TOKEN.'),
    )
    renderAt('/membresia/pago?planId=plan_mensual')

    await userEvent.type(screen.getByLabelText('Número de identificación'), '1723358400')
    await userEvent.type(screen.getByLabelText('Celular'), '0987569852')
    await userEvent.click(screen.getByRole('button', { name: /en Pagomedios/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('PAGOMEDIOS_TOKEN')
    expect(assign).not.toHaveBeenCalled()
  })

  it('al volver de Pagomedios verifica el pago y confirma la membresía activa', async () => {
    repo.verifyPagomediosPayment.mockResolvedValue({ status: 'approved' })
    renderAt('/membresia/pago?provider=pagomedios&paymentId=pay_1')

    expect(await screen.findByText(/Tu membresía ya está activa/)).toBeInTheDocument()
    expect(repo.verifyPagomediosPayment).toHaveBeenCalledWith({ paymentId: 'pay_1' })
    expect(refresh).toHaveBeenCalled()
  })

  it('si el pago sigue pendiente permite volver a verificar', async () => {
    repo.verifyPagomediosPayment
      .mockResolvedValueOnce({ status: 'pending', description: 'Pago pendiente de confirmación.' })
      .mockResolvedValueOnce({ status: 'approved' })
    renderAt('/membresia/pago?provider=pagomedios&paymentId=pay_1')

    expect(await screen.findByText('Pago pendiente de confirmación.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a verificar' }))
    expect(await screen.findByText(/Tu membresía ya está activa/)).toBeInTheDocument()
  })

  it('muestra el rechazo sin activar la membresía', async () => {
    repo.verifyPagomediosPayment.mockResolvedValue({
      status: 'rejected',
      description: 'El pago fue rechazado.',
    })
    renderAt('/membresia/pago?provider=pagomedios&paymentId=pay_1')

    expect(await screen.findByRole('alert')).toHaveTextContent('El pago fue rechazado.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('splitTax — desglose de IVA para Pagomedios', () => {
  it.each([3500, 2500, 4000, 9999, 100, 12345])(
    'con IVA 15%% el total de %i centavos cuadra al centavo',
    (totalCents) => {
      const r = splitTax(totalCents, 0.15)
      const cents = (n: number) => Math.round(n * 100)
      expect(cents(r.amount)).toBe(totalCents)
      expect(cents(r.amount_with_tax) + cents(r.amount_without_tax) + cents(r.tax_value)).toBe(
        totalCents,
      )
      expect(cents(r.tax_value)).toBe(Math.round(cents(r.amount_with_tax) * 0.15))
    },
  )

  it('sin IVA todo va a amount_without_tax', () => {
    expect(splitTax(3500, 0)).toEqual({
      amount: 35,
      amount_with_tax: 0,
      amount_without_tax: 35,
      tax_value: 0,
    })
  })
})
