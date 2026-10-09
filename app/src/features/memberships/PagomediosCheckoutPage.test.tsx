import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { MembershipPlan, User } from '@/domain/models'
import { PAYMENT_VALIDATION_NOTICE } from '@/domain/rules/planRequest'
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
  await userEvent.click(screen.getByRole('checkbox', { name: /Acepto los términos y condiciones/ }))
}

const repo = {
  createPagomediosPayment: vi.fn(),
  verifyPagomediosPayment: vi.fn(),
  requestPlanPayment: vi.fn(),
}
const refresh = vi.fn().mockResolvedValue(undefined)

const dayPass = {
  id: 'plan_day',
  name: 'Zona Day',
  priceCents: 500,
  durationDays: 1,
  active: true,
} as MembershipPlan

const app = vi.hoisted(() => ({
  settings: { onlinePaymentsEnabled: true, dayPassesEnabled: true } as Record<string, unknown>,
}))

vi.mock('@/data/RepositoryProvider', () => ({
  useCurrentUser: () => user,
  useAppData: () => ({ membershipPlans: [plan, dayPass], settings: app.settings }),
  useGym: () => ({ repo, refresh }),
}))

// El ambiente tiene pasarela; lo que decide es el interruptor del admin.
vi.mock('./onlinePay', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./onlinePay')>()),
  isOnlinePayEnvEnabled: () => true,
  isOnlinePayEnabled: (settings?: { onlinePaymentsEnabled?: boolean }) =>
    settings?.onlinePaymentsEnabled === true,
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
    app.settings = { onlinePaymentsEnabled: true, dayPassesEnabled: true }
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

  it('sin aceptar los términos no deja pagar; se leen sin perder lo escrito', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    await fillBilling()
    const pay = screen.getByRole('button', { name: /Pagar\s*\$35\.00/ })
    expect(pay).toBeEnabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
    expect(pay).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'términos y condiciones' }))
    expect(screen.getByRole('dialog', { name: 'Términos y condiciones' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Dirección')).toHaveValue(ADDRESS)
    expect(repo.createPagomediosPayment).not.toHaveBeenCalled()
  })

  it('los datos del pagador se colapsan con un resumen y se vuelven a abrir', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    const toggle = screen.getByRole('button', { name: /Socio Demo/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Completa tu identificación, celular y dirección')
    expect(screen.queryByText(/factura/i)).toBeNull()

    await fillBilling()
    expect(toggle).toHaveTextContent('Cédula 1710034065 · 0987569852')

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Número de identificación')).toBeNull()
    // colapsado no pierde lo escrito ni bloquea el pago
    expect(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ })).toBeEnabled()

    await userEvent.click(toggle)
    expect(screen.getByLabelText('Número de identificación')).toHaveValue('1710034065')
  })

  it('muestra los logos de las tarjetas aceptadas', () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    const brands = screen.getByRole('group', { name: 'Tarjetas aceptadas' })
    for (const name of ['Visa', 'Mastercard', 'Diners Club', 'Discover', 'American Express']) {
      expect(within(brands).getByRole('img', { name })).toBeInTheDocument()
    }
  })

  it('pagar en efectivo deja la solicitud a recepción sin pedir datos del pagador', async () => {
    repo.requestPlanPayment.mockResolvedValue({ id: 'req_1' })
    renderAt('/membresia/pago?planId=plan_mensual')

    await userEvent.click(screen.getByRole('radio', { name: /Efectivo en recepción/ }))
    expect(screen.getByRole('radio', { name: /Efectivo en recepción/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('Datos del pagador')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Tarjetas aceptadas' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Datos para pagar' })).toBeNull()

    const confirm = screen.getByRole('button', { name: /Confirmar solicitud\s*\$35\.00/ })
    expect(confirm).toBeDisabled() // falta aceptar términos
    await userEvent.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
    await userEvent.click(confirm)

    expect(repo.requestPlanPayment).toHaveBeenCalledWith({ planId: 'plan_mensual', manualMethod: 'cash' })
    expect(repo.createPagomediosPayment).not.toHaveBeenCalled()
    expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument()
    expect(screen.getByText(/paga \$35\.00 en efectivo/)).toBeInTheDocument()
    expect(screen.getByText('Tu plan se activa cuando recepción registre el pago.')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it('transferencia sin cuenta configurada: recepción da los datos, con referencia y aviso de 24 horas', async () => {
    repo.requestPlanPayment.mockResolvedValue({ id: 'req_1' })
    renderAt('/membresia/pago?planId=plan_mensual')

    await userEvent.click(screen.getByRole('radio', { name: /Transferencia bancaria/ }))
    const block = screen.getByRole('region', { name: 'Datos para pagar' })
    expect(block).toHaveTextContent(/datos de la cuenta para transferir \$35\.00/)
    expect(block).toHaveTextContent(PAYMENT_VALIDATION_NOTICE)
    const reference = within(block).getByText(/^ZC-[0-9A-F]{6}$/).textContent!

    await userEvent.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
    await userEvent.click(screen.getByRole('button', { name: /Confirmar solicitud/ }))

    expect(repo.requestPlanPayment).toHaveBeenCalledWith({
      planId: 'plan_mensual',
      manualMethod: 'transfer',
      reference,
    })
    expect(await screen.findByRole('heading', { name: 'Solicitud enviada' })).toBeInTheDocument()
    const sent = screen.getByRole('region', { name: 'Datos para pagar' })
    expect(sent).toHaveTextContent(reference)
    expect(sent).toHaveTextContent(PAYMENT_VALIDATION_NOTICE)
    // sin WhatsApp configurado no hay botón
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
    expect(screen.getByText(/muestra tu comprobante en recepción/)).toBeInTheDocument()
  })

  describe('Deuna y datos de pago configurados por el admin', () => {
    const paymentSettings = {
      onlinePaymentsEnabled: true,
      dayPassesEnabled: true,
      whatsappPayments: '0991234567',
      bankName: 'Banco Pichincha',
      bankAccountType: 'Ahorros',
      bankAccountNumber: '2201234567',
      bankAccountHolder: 'Zona Cero S.A.',
      deunaCode: 'ZONACERO01',
    }

    it('sin código ni QR de Deuna no se ofrece Deuna', () => {
      renderAt('/membresia/pago?planId=plan_mensual')
      expect(screen.queryByRole('radio', { name: /Deuna/ })).toBeNull()
    })

    it('con el código configurado aparece Deuna con el código, el monto, la referencia y el aviso', async () => {
      app.settings = paymentSettings
      renderAt('/membresia/pago?planId=plan_mensual')

      await userEvent.click(screen.getByRole('radio', { name: /Deuna \(Banco Pichincha\)/ }))
      const block = screen.getByRole('region', { name: 'Datos para pagar' })
      expect(block).toHaveTextContent('ZONACERO01')
      expect(within(block).getByRole('button', { name: 'Copiar código deuna' })).toBeInTheDocument()
      expect(block).toHaveTextContent('Monto exacto$35.00')
      expect(within(block).getByText(/^ZC-[0-9A-F]{6}$/)).toBeInTheDocument()
      expect(block).toHaveTextContent(PAYMENT_VALIDATION_NOTICE)
      expect(within(block).queryByRole('link')).toBeNull() // WhatsApp recién al confirmar
    })

    it('con el QR configurado muestra la imagen', async () => {
      app.settings = { ...paymentSettings, deunaCode: null, deunaQrUrl: 'https://cdn.example/qr.png' }
      renderAt('/membresia/pago?planId=plan_mensual')

      await userEvent.click(screen.getByRole('radio', { name: /Deuna/ }))
      expect(screen.getByRole('img', { name: 'QR de Deuna del gym' })).toHaveAttribute(
        'src',
        'https://cdn.example/qr.png',
      )
    })

    it('transferencia muestra la cuenta del gym con botón para copiar el número', async () => {
      app.settings = paymentSettings
      renderAt('/membresia/pago?planId=plan_mensual')

      await userEvent.click(screen.getByRole('radio', { name: /Transferencia bancaria/ }))
      const block = screen.getByRole('region', { name: 'Datos para pagar' })
      expect(block).toHaveTextContent('BancoBanco Pichincha')
      expect(block).toHaveTextContent('Tipo de cuentaAhorros')
      expect(block).toHaveTextContent('Titular' + 'Zona Cero S.A.')
      expect(block).not.toHaveTextContent('RUC o cédula')
      expect(within(block).getByRole('button', { name: 'Copiar número de cuenta' })).toBeInTheDocument()
    })

    it('al confirmar con Deuna ofrece enviar el comprobante por WhatsApp con el mensaje correcto', async () => {
      app.settings = paymentSettings
      repo.requestPlanPayment.mockImplementation(async (params: { reference: string }) => ({
        id: 'req_1',
        reference: params.reference,
      }))
      renderAt('/membresia/pago?planId=plan_mensual')

      await userEvent.click(screen.getByRole('radio', { name: /Deuna/ }))
      const reference = within(screen.getByRole('region', { name: 'Datos para pagar' }))
        .getByText(/^ZC-[0-9A-F]{6}$/).textContent!
      await userEvent.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
      await userEvent.click(screen.getByRole('button', { name: /Confirmar solicitud/ }))

      expect(repo.requestPlanPayment).toHaveBeenCalledWith({
        planId: 'plan_mensual',
        manualMethod: 'deuna',
        reference,
      })
      const link = await screen.findByRole('link', { name: 'Enviar comprobante por WhatsApp' })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      const url = new URL(link.getAttribute('href')!)
      expect(url.origin + url.pathname).toBe('https://wa.me/593991234567')
      const text = url.searchParams.get('text')!
      for (const part of ['Socio Demo', 'Plan Mensual', '$35.00', 'Deuna', reference]) {
        expect(text).toContain(part)
      }
      expect(screen.getByRole('region', { name: 'Datos para pagar' })).toHaveTextContent(
        PAYMENT_VALIDATION_NOTICE,
      )
    })

    it('si el admin apaga el pago en línea, el aviso menciona Deuna', async () => {
      app.settings = paymentSettings
      repo.createPagomediosPayment.mockRejectedValue(new Error('Pago en línea desactivado'))
      renderAt('/membresia/pago?planId=plan_mensual')

      await fillBilling()
      await userEvent.click(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Puedes pagar en efectivo, por transferencia o con Deuna.',
      )
    })
  })

  it('la tarjeta es el método por defecto y vuelve a pedir los datos del pagador', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    expect(screen.getByRole('radio', { name: /Tarjeta de crédito o débito/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: /Efectivo en recepción/ }))
    await userEvent.click(screen.getByRole('radio', { name: /Tarjeta de crédito o débito/ }))
    expect(screen.getByLabelText('Número de identificación')).toBeInTheDocument()
  })

  it('salir con la X o "volver" pregunta antes; "Continuar con el pago" conserva lo escrito', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    await userEvent.type(screen.getByLabelText('Celular'), '0987569852')

    for (const name of ['Salir del pago', 'Volver']) {
      await userEvent.click(screen.getByRole('button', { name }))
      const sheet = screen.getByRole('alertdialog', { name: '¿Quieres salir del pago?' })
      expect(sheet).toHaveTextContent('tu plan no cambia')
      await userEvent.click(within(sheet).getByRole('button', { name: 'Continuar con el pago' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
    }
    expect(screen.getByLabelText('Celular')).toHaveValue('0987569852')
    expect(screen.getByTestId('url')).toHaveTextContent('planId=plan_mensual')
  })

  it('confirmar "Salir del pago" vuelve a Mi Plan sin crear ningún pago', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    await userEvent.click(screen.getByRole('button', { name: 'Salir del pago' }))
    const sheet = screen.getByRole('alertdialog')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Salir del pago' }))
    await waitFor(() => expect(screen.getByTestId('url')).toHaveTextContent(/^\/membresia$/))
    expect(repo.createPagomediosPayment).not.toHaveBeenCalled()
    expect(repo.requestPlanPayment).not.toHaveBeenCalled()
  })

  it('el botón atrás del teléfono también pregunta; Escape o tocar fuera mantiene el pago', async () => {
    renderAt('/membresia/pago?planId=plan_mensual')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    await userEvent.click(screen.getByRole('alertdialog').parentElement!)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('url')).toHaveTextContent('planId=plan_mensual')
  })

  it('al volver de Pagomedios con "atrás" (página restaurada del caché) el formulario vuelve a funcionar', async () => {
    repo.createPagomediosPayment.mockResolvedValue({ url: 'https://payurl.link/X', paymentId: 'pay_bf' })
    renderAt('/membresia/pago?planId=plan_mensual')
    await fillBilling()
    await userEvent.click(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ }))
    expect(assign).toHaveBeenCalledWith('https://payurl.link/X')
    // mientras se abre Pagomedios el botón queda "procesando"
    expect(screen.getByRole('button', { name: /Abriendo pago seguro/ })).toBeDisabled()

    // el socio pulsa "atrás": el navegador restaura la página desde el bfcache
    const pageshow = new Event('pageshow')
    Object.defineProperty(pageshow, 'persisted', { value: true })
    window.dispatchEvent(pageshow)

    const pay = await screen.findByRole('button', { name: /Pagar\s*\$35\.00/ })
    expect(pay).toBeEnabled()
    await userEvent.click(screen.getByRole('radio', { name: /Efectivo en recepción/ }))
    expect(screen.getByRole('radio', { name: /Efectivo en recepción/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: /Confirmar solicitud/ })).toBeEnabled()
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
    expect(screen.queryByRole('link', { name: 'Volver a Mi Plan' })).toBeNull() // un solo botón para salir
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

  it('con el pago en línea apagado solo ofrece pagar en recepción', async () => {
    app.settings = { onlinePaymentsEnabled: false, dayPassesEnabled: true }
    repo.requestPlanPayment.mockResolvedValue({ id: 'req_1' })
    renderAt('/membresia/pago?planId=plan_mensual')

    expect(screen.queryByRole('radio', { name: /Tarjeta/ })).toBeNull()
    expect(screen.getByRole('radio', { name: /Efectivo en recepción/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText('Datos del pagador')).toBeNull()

    await userEvent.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
    await userEvent.click(screen.getByRole('button', { name: /Confirmar solicitud/ }))
    expect(repo.requestPlanPayment).toHaveBeenCalledWith({ planId: 'plan_mensual', manualMethod: 'cash' })
    expect(repo.createPagomediosPayment).not.toHaveBeenCalled()
  })

  it('si el admin apaga el pago en línea a mitad del pago, avisa y recarga la configuración', async () => {
    repo.createPagomediosPayment.mockRejectedValue(new Error('Pago en línea desactivado'))
    renderAt('/membresia/pago?planId=plan_mensual')

    await fillBilling()
    await userEvent.click(screen.getByRole('button', { name: /Pagar\s*\$35\.00/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El pago en línea no está disponible en este momento. Puedes pagar en efectivo o por transferencia.',
    )
    expect(refresh).toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it('con el pago en línea apagado igual verifica un pago que ya estaba en curso', async () => {
    app.settings = { onlinePaymentsEnabled: false, dayPassesEnabled: true }
    repo.verifyPagomediosPayment.mockResolvedValue({ status: 'approved' })
    renderAt('/membresia/pago?provider=pagomedios&paymentId=pay_1')

    expect(await screen.findByText(/Tu membresía ya está activa/)).toBeInTheDocument()
    expect(repo.verifyPagomediosPayment).toHaveBeenCalledWith({ paymentId: 'pay_1' })
  })

  it('con los pases diarios apagados no deja comprar un pase diario', () => {
    app.settings = { onlinePaymentsEnabled: true, dayPassesEnabled: false }
    renderAt('/membresia/pago?planId=plan_day')

    expect(screen.getByText('Los pases diarios se venden en recepción.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pagar/ })).toBeNull()
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
