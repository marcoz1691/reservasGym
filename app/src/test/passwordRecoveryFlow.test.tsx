import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryProvider } from '../data/RepositoryProvider'
import { LocalRepository } from '../data/localRepository'
import { resetRepositoryForTests } from '../data/repository'
import { SupabaseRepository } from '../data/supabaseRepository'
import { DEMO_PASSWORD } from '../data/seed'
import { RECOVERY_CODE_INVALID } from '../domain/rules/password'
import { LoginPage } from '../features/auth/LoginPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'

/**
 * Recuperación de contraseña con código (OTP) — pruebas de integración.
 *
 *  1. El recorrido completo por la UI: login → olvidé → correo → contraseña
 *     → código → listo → login con la clave nueva.
 *  2. Que el cambio corta las sesiones abiertas.
 *  3. El contrato real contra Supabase (cliente inyectado, sin red).
 */

const SOCIO = 'socio@gym.local'
const NUEVA = 'ZonaCero2026'

function renderApp(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RepositoryProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          <Route path="/" element={<div>Inicio</div>} />
          <Route path="/admin" element={<div>Admin</div>} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('Recuperación con código · recorrido completo por la UI', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('login → olvidé → correo → contraseña → código → listo → entra con la nueva', async () => {
    const user = userEvent.setup()
    renderApp('/login')

    // Correo escrito en el login: viaja prellenado a la recuperación.
    const loginCorreo = await screen.findByLabelText(/correo electrónico/i)
    await user.clear(loginCorreo)
    await user.type(loginCorreo, SOCIO)
    await user.click(screen.getByRole('button', { name: /olvidaste tu contraseña/i }))

    // 1. Correo
    expect(await screen.findByLabelText(/correo electrónico/i)).toHaveValue(SOCIO)
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    // 2. Nueva contraseña + confirmación
    await user.type(await screen.findByLabelText(/nueva contraseña/i), NUEVA)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    // 3. Código (en demo se muestra en pantalla; en prod llega al correo)
    const aviso = await screen.findByText(/modo demo/i)
    const code = aviso.textContent!.match(/\d{6}/)![0]
    await user.type(screen.getByLabelText(/código/i), code)
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))

    // 4. Confirmación
    expect(await screen.findByText(/contraseña actualizada/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ir a iniciar sesión/i }))

    // 5. Login con el correo prellenado, aviso de éxito y la clave nueva
    expect(await screen.findByText(/entra con la nueva/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electrónico/i)).toHaveValue(SOCIO)
    await user.type(screen.getByLabelText(/^contraseña$/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /^entrar$/i }))

    expect(await screen.findByText('Inicio')).toBeInTheDocument()

    // La anterior ya no sirve
    await expect(
      new LocalRepository().signIn({ email: SOCIO, password: DEMO_PASSWORD }),
    ).rejects.toThrow(/incorrecta/i)
  })

  it('un correo no registrado se ve igual y no habilita ningún cambio', async () => {
    const user = userEvent.setup()
    renderApp('/recuperar')

    await user.type(await screen.findByLabelText(/correo electrónico/i), 'desconocido@ejemplo.com')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.type(await screen.findByLabelText(/nueva contraseña/i), NUEVA)
    await user.type(screen.getByLabelText(/confirmar contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    // Misma pantalla de código: no se puede deducir si el correo existe
    expect(await screen.findByText(/enviamos un código/i)).toBeInTheDocument()
    expect(screen.queryByText(/modo demo/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/código/i), '123456')
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    expect(await screen.findByText(RECOVERY_CODE_INVALID)).toBeInTheDocument()
  })
})

describe('Recuperación con código · sesiones abiertas', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('cambiar la contraseña cierra las sesiones abiertas en otros dispositivos', async () => {
    const otroDispositivo = new LocalRepository()
    await otroDispositivo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    expect(await otroDispositivo.getCurrentUser()).not.toBeNull()

    const esteDispositivo = new LocalRepository()
    await esteDispositivo.resetPassword(SOCIO)
    await esteDispositivo.completePasswordReset(
      SOCIO,
      esteDispositivo.peekRecoveryCode()!,
      NUEVA,
    )

    expect(await otroDispositivo.getCurrentUser()).toBeNull()
    await expect(otroDispositivo.deleteAccount()).rejects.toThrow()
  })
})

/* ──────────────────────────────────────────────────────────────────────
 * Contrato contra Supabase: se verifica exactamente lo que la app le pide
 * al SDK. El correo debe llevar código (sin redirectTo, que en la app
 * nativa apuntaba a localhost) y el cambio sigue verifyOtp → updateUser →
 * signOut.
 * ────────────────────────────────────────────────────────────────────── */
describe('Recuperación con código · contrato con Supabase', () => {
  function fakeClient(overrides: Record<string, unknown> = {}) {
    const calls: string[] = []
    const track =
      (name: string, result: unknown) =>
      (...args: unknown[]) => {
        calls.push(name)
        void args
        return Promise.resolve(result)
      }
    const auth = {
      resetPasswordForEmail: vi.fn(track('resetPasswordForEmail', { error: null })),
      verifyOtp: vi.fn(track('verifyOtp', { data: {}, error: null })),
      updateUser: vi.fn(track('updateUser', { error: null })),
      signOut: vi.fn(track('signOut', { error: null })),
      ...overrides,
    }
    return { client: { auth } as unknown as SupabaseClient & { auth: typeof auth }, calls }
  }

  it('pide el código sin redirectTo y con el correo recortado', async () => {
    const { client } = fakeClient()
    await new SupabaseRepository(client).resetPassword('  socio@gym.local  ')
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(SOCIO)
  })

  it('propaga el error de Supabase al pedir el código', async () => {
    const { client } = fakeClient({
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: { message: 'rate limit exceeded' } }),
    })
    await expect(new SupabaseRepository(client).resetPassword(SOCIO)).rejects.toThrow(/rate limit/i)
  })

  it('valida el código (recovery), fija la contraseña y cierra la sesión, en ese orden', async () => {
    const { client, calls } = fakeClient()
    await new SupabaseRepository(client).completePasswordReset(` ${SOCIO} `, ' 123456 ', NUEVA)

    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: SOCIO,
      token: '123456',
      type: 'recovery',
    })
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: NUEVA })
    expect(calls).toEqual(['verifyOtp', 'updateUser', 'signOut'])
  })

  it('con un código inválido o vencido no toca la contraseña', async () => {
    const { client } = fakeClient({
      verifyOtp: vi.fn().mockResolvedValue({
        data: {},
        error: { code: 'otp_expired', message: 'Token has expired or is invalid' },
      }),
    })

    await expect(
      new SupabaseRepository(client).completePasswordReset(SOCIO, '000000', NUEVA),
    ).rejects.toThrow(RECOVERY_CODE_INVALID)
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('si la contraseña es igual a la anterior, avisa en español y cierra la sesión igual', async () => {
    const { client } = fakeClient({
      updateUser: vi.fn().mockResolvedValue({
        error: { code: 'same_password', message: 'New password should be different from the old password.' },
      }),
    })

    await expect(
      new SupabaseRepository(client).completePasswordReset(SOCIO, '123456', NUEVA),
    ).rejects.toThrow(/distinta a la anterior/i)
    expect(client.auth.signOut).toHaveBeenCalled()
  })

  it('updatePassword (con sesión normal) pide a Supabase actualizar la contraseña', async () => {
    const { client } = fakeClient()
    await new SupabaseRepository(client).updatePassword(NUEVA)
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: NUEVA })
  })
})
