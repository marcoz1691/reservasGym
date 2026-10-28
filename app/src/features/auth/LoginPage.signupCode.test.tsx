import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { LocalRepository } from '@/data/localRepository'
import { resetRepositoryForTests } from '@/data/repository'
import type { GymRepository } from '@/data/types'
import { DEMO_PASSWORD } from '@/data/seed'
import { RECOVERY_CODE_INVALID } from '@/domain/rules/password'
import { LoginPage } from './LoginPage'

const EMAIL = 'nuevo@example.com'

/**
 * Supabase con confirmación de correo: signUp deja la cuenta sin sesión y la
 * app pide el código. El repo local hace de Supabase: confirmar abre sesión
 * con el socio demo.
 */
function setup() {
  const repo = new LocalRepository() as LocalRepository &
    Required<Pick<GymRepository, 'confirmSignUp' | 'resendSignUpCode'>>
  vi.spyOn(repo, 'signUp').mockRejectedValue(
    new Error('PENDING_EMAIL_CONFIRMATION:Cuenta creada. Te enviamos un código a tu correo para confirmarla.'),
  )
  repo.confirmSignUp = vi.fn(async (_email: string, code: string) => {
    if (code !== '123456') throw new Error(RECOVERY_CODE_INVALID)
    return repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
  })
  repo.resendSignUpCode = vi.fn().mockResolvedValue(undefined)
  resetRepositoryForTests(repo)
  render(
    <MemoryRouter initialEntries={['/login']}>
      <RepositoryProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Ficha técnica</p>} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
  return repo
}

async function register(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /crear cuenta/i }))
  await user.type(screen.getByLabelText('Nombre completo'), 'Socio Nuevo')
  await user.type(screen.getByLabelText('Correo electrónico'), EMAIL)
  await user.type(screen.getByLabelText('Contraseña (mínimo 8 caracteres)'), 'password123')
  await user.type(screen.getByLabelText('Confirmar contraseña'), 'password123')
  await user.click(screen.getByRole('checkbox', { name: /Acepto los términos/ }))
  await user.click(screen.getByRole('checkbox', { name: /Autorizo el tratamiento/ }))
  await user.click(screen.getAllByRole('button', { name: /crear cuenta/i }).at(-1)!)
  await screen.findByRole('heading', { name: 'Confirma tu cuenta' })
}

describe('Registro · confirmación con código', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('pide el código del correo y entra a la app sin salir al navegador', async () => {
    const repo = setup()
    const user = userEvent.setup()
    await register(user)

    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Código'), '123456')
    await user.click(screen.getByRole('button', { name: 'Confirmar y entrar' }))

    expect(repo.confirmSignUp).toHaveBeenCalledWith(EMAIL, '123456')
    expect(await screen.findByText('Ficha técnica')).toBeInTheDocument()
  })

  it('avisa si el código no es válido y deja intentarlo otra vez', async () => {
    setup()
    const user = userEvent.setup()
    await register(user)

    await user.type(screen.getByLabelText('Código'), '000000')
    await user.click(screen.getByRole('button', { name: 'Confirmar y entrar' }))

    expect(await screen.findByText(RECOVERY_CODE_INVALID)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar y entrar' })).toBeEnabled()
  })

  it('exige los 6 dígitos antes de verificar', async () => {
    const repo = setup()
    const user = userEvent.setup()
    await register(user)

    await user.type(screen.getByLabelText('Código'), '12a3')
    expect(screen.getByLabelText('Código')).toHaveValue('123')
    await user.click(screen.getByRole('button', { name: 'Confirmar y entrar' }))

    expect(screen.getByText('Escribe los 6 dígitos del código')).toBeInTheDocument()
    expect(repo.confirmSignUp).not.toHaveBeenCalled()
  })

  it('el reenvío espera 60 s porque el correo acaba de salir', async () => {
    setup()
    const user = userEvent.setup()
    await register(user)

    expect(screen.getByRole('button', { name: /Reenviar código \(\d+ s\)/ })).toBeDisabled()
  })

  it('volver regresa al formulario de registro', async () => {
    setup()
    const user = userEvent.setup()
    await register(user)

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Nombre completo')).toHaveValue('Socio Nuevo'),
    )
  })
})
