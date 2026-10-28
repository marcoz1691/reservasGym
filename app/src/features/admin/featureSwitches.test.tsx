import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BrandingPage } from './BrandingPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import { DEMO_PASSWORD } from '@/data/seed'

function renderBranding() {
  return render(
    <RepositoryProvider>
      <MemoryRouter>
        <BrandingPage />
      </MemoryRouter>
    </RepositoryProvider>,
  )
}

describe('Funciones de la app (interruptores del admin)', () => {
  let repo: LocalRepository

  beforeEach(() => {
    localStorage.clear()
    repo = new LocalRepository()
    resetRepositoryForTests(repo)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('el admin ve los interruptores con su explicación', async () => {
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    expect(await screen.findByRole('heading', { name: 'Funciones de la app' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Pago en línea' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Pago recurrente mensual' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText(/Requiere la recurrencia contratada con Pagomedios/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Lista de espera' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Medidas corporales' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Pases diarios en la app' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/solo verán efectivo, transferencia y Deuna/)).toBeInTheDocument()
    expect(screen.getByText(/Recepción siempre puede venderlos en Cobros/)).toBeInTheDocument()
  })

  it('el admin publica un PDF con versión y puede volver al documento incluido', async () => {
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()
    const pdf = new File(['%PDF-1.7\ncontenido'], 'terminos.pdf', { type: 'application/pdf' })
    await userEvent.upload(await screen.findByLabelText('PDF de términos y condiciones'), pdf)
    await userEvent.type(screen.getByLabelText('Versión del documento'), '1.1')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar PDF' }))
    expect(await screen.findByText('Términos y condiciones publicados')).toBeInTheDocument()
    const settings = (await repo.load()).settings
    expect(settings.termsVersion).toBe('1.1')
    expect(settings.termsPdfUrl).toMatch(/^data:application\/pdf;base64,/)
    expect(screen.getByRole('link', { name: 'Abrir PDF publicado' })).toHaveAttribute('href', settings.termsPdfUrl)
    await userEvent.click(screen.getByRole('button', { name: 'Usar documento incluido' }))
    expect(await screen.findByText('Se usa el documento incluido de Zona Cero')).toBeInTheDocument()
    expect((await repo.load()).settings.termsPdfUrl).toBeNull()
  })

  it('rechaza un archivo que solo fue renombrado a PDF y conserva el documento actual', async () => {
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()
    await userEvent.upload(await screen.findByLabelText('PDF de términos y condiciones'), new File(['texto'], 'falso.pdf', { type: 'application/pdf' }))
    await userEvent.type(screen.getByLabelText('Versión del documento'), '1.1')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar PDF' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF válido')
    expect((await repo.load()).settings.termsPdfUrl).toBeUndefined()
  })

  it('staff y socio no pueden publicar un PDF mediante el repositorio', async () => {
    const pdf = new File(['%PDF-1.7'], 'terminos.pdf', { type: 'application/pdf' })
    for (const email of ['staff@gym.local', 'socio@gym.local']) {
      await repo.signIn({ email, password: DEMO_PASSWORD })
      await expect(repo.publishTermsPdf(pdf, '1.1')).rejects.toThrow('Solo admin')
    }
  })

  it('apagar la lista de espera queda guardado', async () => {
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    await userEvent.click(await screen.findByRole('switch', { name: 'Lista de espera' }))

    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Lista de espera' })).toHaveAttribute('aria-checked', 'false'),
    )
    expect((await repo.load()).settings.waitlistEnabled).toBe(false)
  })

  it('sin Pagomedios en el ambiente, el pago en línea no se puede encender', async () => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', '0')
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    expect(await screen.findByRole('switch', { name: 'Pago en línea' })).toBeDisabled()
    // Uno por cada cobro: pago en línea y pago recurrente.
    expect(screen.getAllByText('Pagomedios no está configurado en este ambiente')).toHaveLength(2)
  })

  it('con Pagomedios en el ambiente, el admin enciende el pago en línea', async () => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', '1')
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    const online = await screen.findByRole('switch', { name: 'Pago en línea' })
    expect(online).toBeEnabled()
    expect(screen.queryByText('Pagomedios no está configurado en este ambiente')).toBeNull()
    await userEvent.click(online)

    await waitFor(() => expect(online).toHaveAttribute('aria-checked', 'true'))
    expect((await repo.load()).settings.onlinePaymentsEnabled).toBe(true)
  })

  it('el admin enciende el pago recurrente; con el pago en línea apagado avisa que no se ofrece', async () => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', '1')
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    const recurring = await screen.findByRole('switch', { name: 'Pago recurrente mensual' })
    expect(recurring).toBeEnabled()
    await userEvent.click(recurring)
    await waitFor(() => expect(recurring).toHaveAttribute('aria-checked', 'true'))
    expect((await repo.load()).settings.recurringPaymentsEnabled).toBe(true)
    expect(screen.getByText('No se ofrece mientras el pago en línea esté apagado')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Pago en línea' }))
    await waitFor(() =>
      expect(screen.queryByText('No se ofrece mientras el pago en línea esté apagado')).toBeNull(),
    )
  })

  it('sin Pagomedios en el ambiente, el pago recurrente tampoco se puede encender', async () => {
    vi.stubEnv('VITE_ONLINE_PAYMENTS', '0')
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    expect(await screen.findByRole('switch', { name: 'Pago recurrente mensual' })).toBeDisabled()
  })

  it('el staff no puede cambiar la configuración del gym', async () => {
    await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    expect(await screen.findByText(/Acceso restringido/i)).toBeInTheDocument()
    expect(screen.getByText(/solo las puede cambiar un administrador/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
  })
})

describe('Datos de pago (transferencia, Deuna y WhatsApp)', () => {
  let repo: LocalRepository

  beforeEach(async () => {
    localStorage.clear()
    repo = new LocalRepository()
    resetRepositoryForTests(repo)
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
  })

  it('nacen vacíos y el admin los guarda', async () => {
    renderBranding()

    expect(await screen.findByRole('heading', { name: 'Datos de pago' })).toBeInTheDocument()
    const whatsapp = screen.getByLabelText('WhatsApp para comprobantes')
    expect(whatsapp).toHaveValue('')
    expect(screen.getByLabelText('Número de cuenta')).toHaveValue('')
    expect(screen.getByLabelText('Código de Deuna')).toHaveValue('')

    await userEvent.type(whatsapp, '0991234567')
    await userEvent.type(screen.getByLabelText('Banco'), 'Banco Pichincha')
    await userEvent.type(screen.getByLabelText('Número de cuenta'), '2201234567')
    await userEvent.type(screen.getByLabelText('Código de Deuna'), 'ZONACERO')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos de pago' }))

    expect(await screen.findByText('Datos de pago actualizados')).toBeInTheDocument()
    const { settings } = await repo.load()
    expect(settings).toMatchObject({
      whatsappPayments: '0991234567',
      bankName: 'Banco Pichincha',
      bankAccountNumber: '2201234567',
      deunaCode: 'ZONACERO',
      deunaQrUrl: null,
      bankAccountHolder: null,
    })
  })

  it('no guarda un WhatsApp que no es celular ni un QR sin https', async () => {
    renderBranding()

    await userEvent.type(await screen.findByLabelText('WhatsApp para comprobantes'), '123')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos de pago' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa el número de WhatsApp')

    await userEvent.clear(screen.getByLabelText('WhatsApp para comprobantes'))
    await userEvent.type(screen.getByLabelText('URL de la imagen del QR de Deuna'), 'http://qr.png')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar datos de pago' }))
    expect(screen.getByRole('alert')).toHaveTextContent('https://')
    expect((await repo.load()).settings.deunaQrUrl).toBeUndefined()
  })
})
