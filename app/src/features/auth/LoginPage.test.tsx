import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/biometricAccess', () => ({
  isBiometricAccessEnabled: () => true,
}))
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { DEMO_PASSWORD } from '@/data/seed'
import { resetRepositoryForTests } from '@/data/repository'
import { LoginPage } from './LoginPage'
import { saveBiometricSession } from '@/lib/biometrics'

function renderPage() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <LoginPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('Login · ojo para ver la contraseña', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
    vi.unstubAllGlobals()
  })

  it('muestra y oculta la contraseña al iniciar sesión', async () => {
    const user = userEvent.setup()
    renderPage()

    const password = await screen.findByLabelText(/^contraseña$/i)
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /mostrar contraseña/i }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /ocultar contraseña/i }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('al crear cuenta cada campo tiene su propio ojo', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    const password = await screen.findByLabelText(/contraseña \(mínimo 8/i)
    const confirmation = screen.getByLabelText(/confirmar contraseña/i)
    expect(password).toHaveAttribute('type', 'password')
    expect(confirmation).toHaveAttribute('type', 'password')

    const ojos = screen.getAllByRole('button', { name: /mostrar contraseña/i })
    expect(ojos).toHaveLength(2)

    await user.click(ojos[0]!)
    expect(password).toHaveAttribute('type', 'text')
    expect(confirmation).toHaveAttribute('type', 'password')

    await user.click(
      screen.getByRole('button', { name: /mostrar contraseña/i }),
    )
    expect(confirmation).toHaveAttribute('type', 'text')
  })
})

describe('Login · cuentas de prueba', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function renderBuild(env: { MODE: string; DEV: boolean }) {
    vi.stubEnv('MODE', env.MODE)
    vi.stubEnv('DEV', env.DEV)
    const { LoginPage: Page } = await import('./LoginPage')
    const { RepositoryProvider: Provider } = await import('@/data/RepositoryProvider')
    return render(
      <MemoryRouter>
        <Provider>
          <Page />
        </Provider>
      </MemoryRouter>,
    )
  }

  it('QA (staging) no precarga usuarios ni muestra el acceso rápido', async () => {
    await renderBuild({ MODE: 'staging', DEV: true })

    expect(await screen.findByLabelText(/correo electrónico/i)).toHaveValue('')
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveValue('')
    expect(screen.queryByText(/acceso rápido/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^admin$/i })).not.toBeInTheDocument()
  })

  it('el desarrollo local con datos demo conserva el acceso rápido', async () => {
    await renderBuild({ MODE: 'development', DEV: true })

    expect(await screen.findByText(/acceso rápido demo/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('socio@gym.local')
  })
})

describe('Login · acceso biométrico', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
    vi.unstubAllGlobals()
  })

  async function enableQuickAccess() {
    const repo = new LocalRepository()
    const user = await repo.signIn({
      email: 'socio@gym.local',
      password: DEMO_PASSWORD,
    })
    await repo.rememberBiometricSession()
    await repo.signOut()
    localStorage.setItem(
      'reservasgym_biometric_user',
      JSON.stringify({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        savedAt: new Date().toISOString(),
      }),
    )
    localStorage.setItem('reservasgym_biometric_enabled', 'true')
    vi.stubGlobal(
      'PublicKeyCredential',
      class {
        static async isUserVerifyingPlatformAuthenticatorAvailable() {
          return true
        }
      },
    )
    vi.stubGlobal('navigator', {
      ...navigator,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      credentials: {
        get: vi.fn().mockResolvedValue({ type: 'public-key' }),
        create: vi.fn().mockResolvedValue({ type: 'public-key' }),
      },
    })
  }

  it('entra con Face ID sin pedir la contraseña', async () => {
    await enableQuickAccess()
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument()
    expect(screen.getByText('socio@gym.local')).toBeInTheDocument()
    const faceId = screen.getByRole('button', { name: /entrar con face id/i })

    await user.click(faceId)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /entrar con face id/i })).not.toBeInTheDocument()
    })
  })

  it('no muestra el acceso rápido al crear cuenta', async () => {
    await enableQuickAccess()
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /crear cuenta/i }))
    expect(screen.queryByRole('button', { name: /entrar con face id/i })).not.toBeInTheDocument()
  })

  it('avisa y deja la contraseña si la sesión rápida venció', async () => {
    await enableQuickAccess()
    saveBiometricSession({ kind: 'local', userId: 'user_missing' })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /entrar con face id/i }))

    expect(await screen.findByText(/acceso rápido venció/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue('socio@gym.local')
    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument()
  })
})
