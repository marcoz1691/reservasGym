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

  it('el admin ve los cuatro interruptores con su explicación', async () => {
    await repo.signIn({ email: 'admin@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    expect(await screen.findByRole('heading', { name: 'Funciones de la app' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Pago en línea' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: 'Lista de espera' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Medidas corporales' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Pases diarios en la app' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/solo verán efectivo y transferencia/)).toBeInTheDocument()
    expect(screen.getByText(/Recepción siempre puede venderlos en Cobros/)).toBeInTheDocument()
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
    expect(screen.getByText('Pagomedios no está configurado en este ambiente')).toBeInTheDocument()
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

  it('el staff no puede cambiar la configuración del gym', async () => {
    await repo.signIn({ email: 'staff@gym.local', password: DEMO_PASSWORD })
    renderBranding()

    expect(await screen.findByText(/Acceso restringido/i)).toBeInTheDocument()
    expect(screen.getByText(/solo las puede cambiar un administrador/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
