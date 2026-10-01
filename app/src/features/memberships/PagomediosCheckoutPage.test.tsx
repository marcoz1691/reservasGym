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
  durationDays: 30,
  active: true,
} as MembershipPlan

const ADDRESS = 'Av. Amazonas N34-120, Quito'

/** Datos de facturación válidos (cédula con dígito verificador correcto). */
async function fillBilling() {
  await userEvent.type(screen.getByLabelText('Número de identificación'), '1710034065')
  await userEvent.type(screen.getByLabelText('Celular'), '0987569852')
  await userEvent.type(screen.getByLabelText('Dirección'), ADDRESS)
}

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

// Pantalla de pago dentro de la app: guarda los listeners para simular la navegación.
const browser = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  listeners: {} as Record<string, (e: { url: string }) => void>,
}))
vi.mock('@capgo/inappbrowser', () => ({
  ToolBarType: { COMPACT: 'compact' },
  InAppBrowser: {
    openWebView: browser.open,
    close: browser.close,
    addListener: vi.fn(async (event: string, cb: (e: { url: string }) => void) => {
      browser.listeners[event] = cb
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
    browser.listeners = {}
    localStorage.clear()
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

    expect(screen.getByText('Plan Mensual')).toBeInTheDocument()
    expect(screen.getByLabelText('Dirección')).toHaveValue('') // sin datos precargados

    await fillBilling()
    await userEvent.click(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ }))

    expect(repo.createPagomediosPayment).toHaveBeenCalledWith({
      planId: 'plan_mensual',
      document: '1710034065',
      documentType: '05',
      phone: '0987569852',
      address: ADDRESS,
      native: false,
    })
    expect(assign).toHaveBeenCalledWith('https://payurl.link/ZTR3638000')
    expect(browser.open).not.toHaveBeenCalled()
  })

  async function startNativePayment() {
    native.value = true
    repo.createPagomediosPayment.mockResolvedValue({
      url: 'https://payurl.link/ZTR3638000',
      paymentId: 'pay_9',
    })
    repo.verifyPagomediosPayment.mockResolvedValue({ status: 'approved' })
    renderAt('/membresia/pago?planId=plan_mensual')

    await fillBilling()
    await userEvent.click(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ }))

    await waitFor(() =>
      expect(browser.open).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://payurl.link/ZTR3638000',
          title: 'Pago seguro · Pagomedios',
        }),
      ),
    )
    expect(repo.createPagomediosPayment).toHaveBeenCalledWith(
      expect.objectContaining({ native: true }),
    )
    expect(assign).not.toHaveBeenCalled()
  }

  it('en la app nativa abre el pago dentro de la app y se cierra sola al terminar', async () => {
    await startNativePayment()

    // navegación dentro del formulario: sigue abierta
    browser.listeners.urlChangeEvent?.({ url: 'https://payurl.link/payments/?link_id=x' })
    expect(browser.close).not.toHaveBeenCalled()
    expect(repo.verifyPagomediosPayment).not.toHaveBeenCalled()

    // Pagomedios devuelve al socio: se cierra y se verifica una sola vez
    browser.listeners.urlChangeEvent?.({
      url: 'http://10.0.2.2:8000/?action=notify&paymentId=pay_9&native=1',
    })
    browser.listeners.closeEvent?.({ url: '' })

    expect(await screen.findByText(/Tu membresía ya está activa/)).toBeInTheDocument()
    expect(browser.close).toHaveBeenCalledTimes(1)
    expect(repo.verifyPagomediosPayment).toHaveBeenCalledTimes(1)
    expect(repo.verifyPagomediosPayment).toHaveBeenCalledWith({ paymentId: 'pay_9' })
    expect(browser.remove).toHaveBeenCalled()
  })

  it('si el socio cierra la pantalla antes de terminar, igual verifica el pago', async () => {
    await startNativePayment()
    repo.verifyPagomediosPayment.mockResolvedValue({
      status: 'pending',
      description: 'Pago pendiente de confirmación.',
    })

    browser.listeners.closeEvent?.({ url: '' })

    expect(await screen.findByText('Pago pendiente de confirmación.')).toBeInTheDocument()
    expect(repo.verifyPagomediosPayment).toHaveBeenCalledWith({ paymentId: 'pay_9' })
  })

  it('si la app se recarga mientras el socio paga, retoma la verificación al cerrar la pantalla', async () => {
    native.value = true
    localStorage.setItem(
      'zonacero.pendingOnlinePayment',
      JSON.stringify({ paymentId: 'pay_7', at: Date.now() }),
    )
    repo.verifyPagomediosPayment
      .mockResolvedValueOnce({ status: 'pending', description: 'Pago pendiente de confirmación.' })
      .mockResolvedValueOnce({ status: 'approved' })

    // la recarga deja al socio otra vez en el formulario del plan
    renderAt('/membresia/pago?planId=plan_mensual')

    expect(await screen.findByText('Pago pendiente de confirmación.')).toBeInTheDocument()
    expect(screen.getByTestId('url')).toHaveTextContent('paymentId=pay_7')
    expect(localStorage.getItem('zonacero.pendingOnlinePayment')).toBeNull()

    // el socio termina de pagar y la pantalla se cierra
    await waitFor(() => expect(browser.listeners.closeEvent).toBeDefined())
    browser.listeners.closeEvent?.({ url: '' })
    expect(await screen.findByText(/Tu membresía ya está activa/)).toBeInTheDocument()
    expect(repo.verifyPagomediosPayment).toHaveBeenLastCalledWith({ paymentId: 'pay_7' })
  })

  it('un pago pendiente de hace más de una hora no se retoma', async () => {
    localStorage.setItem(
      'zonacero.pendingOnlinePayment',
      JSON.stringify({ paymentId: 'pay_old', at: Date.now() - 2 * 60 * 60 * 1000 }),
    )
    renderAt('/membresia/pago?planId=plan_mensual')
    expect(await screen.findByLabelText('Número de identificación')).toBeInTheDocument()
    expect(repo.verifyPagomediosPayment).not.toHaveBeenCalled()
  })

  it('el formulario no acepta letras en cédula y celular, y no deja pagar con datos inválidos', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    const pay = screen.getByRole('button', { name: /Pagar\s*\$35\.00/ })
    expect(pay).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Número de identificación'), 'fddfg34344')
    expect(screen.getByLabelText('Número de identificación')).toHaveValue('34344')
    await userEvent.type(screen.getByLabelText('Celular'), 'kjhb09875x69852')
    expect(screen.getByLabelText('Celular')).toHaveValue('0987569852')
    await userEvent.click(screen.getByLabelText('Dirección'))
    await userEvent.tab()

    expect(screen.getByText('La cédula tiene 10 dígitos.')).toBeInTheDocument()
    expect(screen.getByText('Ingresa tu dirección.')).toBeInTheDocument()
    expect(pay).toBeDisabled()
    expect(repo.createPagomediosPayment).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Número de identificación'))
    await userEvent.type(screen.getByLabelText('Número de identificación'), '1723358400')
    await userEvent.tab()
    expect(screen.getByText('La cédula no es válida.')).toBeInTheDocument()
  })

  it('muestra el resumen con subtotal, IVA 15% y total', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    const summary = screen.getByRole('region', { name: 'Resumen del pago' })
    expect(summary).toHaveTextContent('Subtotal$30.44')
    expect(summary).toHaveTextContent('IVA 15%$4.56')
    expect(summary).toHaveTextContent('Total$35.00')
  })

  it('muestra el error de la pasarela y no redirige', async () => {
    repo.createPagomediosPayment.mockRejectedValue(
      new Error('Pagomedios no configurado. Falta el secret PAGOMEDIOS_TOKEN.'),
    )
    renderAt('/membresia/pago?planId=plan_mensual')

    await fillBilling()
    await userEvent.click(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ }))

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

  it('el comprobante queda en pantalla con plan, monto, autorización y vigencia', async () => {
    repo.verifyPagomediosPayment.mockResolvedValue({
      status: 'approved',
      receipt: {
        planName: 'Zero Active Mensual',
        amountCents: 3500,
        authorizationCode: '077949',
        membershipEndsAt: '2026-11-18T12:00:00.000Z',
      },
    })
    renderAt('/membresia/pago?provider=pagomedios&paymentId=pay_1')

    const receipt = (await screen.findByText('¡Pago aprobado!')).closest('[role="status"]')!
    expect(receipt).toHaveTextContent('¡Pago aprobado!')
    expect(receipt).toHaveTextContent('Zero Active Mensual')
    expect(receipt).toHaveTextContent('$35.00')
    expect(receipt).toHaveTextContent('077949')
    expect(receipt).toHaveTextContent(/18 de noviembre de 2026/)

    // no salta solo a Mi Plan: el socio decide cuándo salir
    await new Promise((r) => setTimeout(r, 2500))
    expect(screen.getByTestId('url')).toHaveTextContent('paymentId=pay_1')
    await userEvent.click(screen.getByRole('link', { name: 'Ir a Mi Plan' }))
    expect(screen.getByTestId('url')).toHaveTextContent(/^\/membresia$/)
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
