import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryProvider } from '../data/RepositoryProvider'
import { LocalRepository } from '../data/localRepository'
import { resetRepositoryForTests } from '../data/repository'
import { SupabaseRepository } from '../data/supabaseRepository'
import { DEMO_PASSWORD } from '../data/seed'
import { LoginPage } from '../features/auth/LoginPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'

/**
 * ZCAPP-46 — pruebas de integración de la recuperación de contraseña.
 *
 * Las pruebas unitarias ya cubren las reglas (`domain/rules/password`) y el
 * repositorio en aislamiento (`data/passwordRecovery`). Aquí se prueba lo que
 * solo falla cuando las piezas se juntan:
 *
 *  1. El recorrido completo por la UI, cruzando router y componentes.
 *  2. El contrato real contra Supabase (con cliente inyectado, sin red).
 *  3. Que el cambio de contraseña realmente corta las sesiones abiertas.
 */

const SOCIO = 'socio@gym.local'
const NUEVA = 'ZonaCero2026'

function renderApp(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RepositoryProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar" element={<ResetPasswordPage />} />
          <Route path="/" element={<div>Inicio</div>} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('ZCAPP-46 · integración · recorrido completo por la UI', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('recorre pedir enlace → fijar contraseña → entrar con la nueva', async () => {
    const user = userEvent.setup()

    // ── 1. El socio pide el enlace desde el login ──────────────────────
    const { unmount } = renderApp('/login')

    await user.click(
      await screen.findByRole('button', { name: /olvidaste tu contraseña/i }),
    )

    // El login también tiene un campo de correo, así que se busca dentro
    // del diálogo para no confundirlos.
    const modal = await screen.findByRole('dialog')
    const campoCorreo = within(modal).getByLabelText(/correo electrónico/i)
    await user.clear(campoCorreo)
    await user.type(campoCorreo, SOCIO)
    await user.click(within(modal).getByRole('button', { name: /enviar enlace/i }))

    expect(await screen.findByText(/enlace enviado/i)).toBeInTheDocument()
    unmount()

    // ── 2. Abre el enlace del correo, que lo lleva a /recuperar ────────
    renderApp('/recuperar')

    await user.type(
      await screen.findByLabelText(/nueva contraseña/i),
      NUEVA,
    )
    await user.type(screen.getByLabelText(/repite la contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    expect(await screen.findByText(/quedó actualizada/i)).toBeInTheDocument()

    // ── 3. La contraseña nueva sirve y la anterior ya no ───────────────
    const verificador = new LocalRepository()
    const socio = await verificador.signIn({ email: SOCIO, password: NUEVA })
    expect(socio.email).toBe(SOCIO)

    const otro = new LocalRepository()
    await expect(
      otro.signIn({ email: SOCIO, password: DEMO_PASSWORD }),
    ).rejects.toThrow(/incorrecta/i)
  })

  it('el enlace es de un solo uso: al volver a /recuperar ya no sirve', async () => {
    const user = userEvent.setup()

    await new LocalRepository().resetPassword(SOCIO)

    const { unmount } = renderApp('/recuperar')
    await user.type(await screen.findByLabelText(/nueva contraseña/i), NUEVA)
    await user.type(screen.getByLabelText(/repite la contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))
    await screen.findByText(/quedó actualizada/i)
    unmount()

    // Reabrir el mismo enlace del correo
    renderApp('/recuperar')
    expect(
      await screen.findByText(/enlace vencido o inválido/i),
    ).toBeInTheDocument()
  })

  it('entrar a /recuperar sin haber pedido el enlace no deja cambiar nada', async () => {
    renderApp('/recuperar')

    expect(
      await screen.findByText(/enlace vencido o inválido/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/nueva contraseña/i),
    ).not.toBeInTheDocument()

    // Y la contraseña original sigue intacta
    const repo = new LocalRepository()
    const socio = await repo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    expect(socio.email).toBe(SOCIO)
  })

  it('pedir el enlace de un correo no registrado se ve igual, y no habilita nada', async () => {
    const user = userEvent.setup()
    renderApp('/login')

    await user.click(
      await screen.findByRole('button', { name: /olvidaste tu contraseña/i }),
    )
    const modal = await screen.findByRole('dialog')
    const campoCorreo = within(modal).getByLabelText(/correo electrónico/i)
    await user.clear(campoCorreo)
    await user.type(campoCorreo, 'desconocido@ejemplo.com')
    await user.click(within(modal).getByRole('button', { name: /enviar enlace/i }))

    // Misma confirmación: no se puede deducir si el correo existe
    expect(await screen.findByText(/enlace enviado/i)).toBeInTheDocument()

    // pero no abrió ninguna ventana de recuperación
    expect(await new LocalRepository().hasRecoverySession()).toBe(false)
  })

  it('no guarda si la confirmación no coincide, ni siquiera tocando dos veces', async () => {
    const user = userEvent.setup()
    await new LocalRepository().resetPassword(SOCIO)
    renderApp('/recuperar')

    await user.type(await screen.findByLabelText(/nueva contraseña/i), NUEVA)
    await user.type(screen.getByLabelText(/repite la contraseña/i), 'OtraCosa2026')

    const guardar = screen.getByRole('button', { name: /guardar contraseña/i })
    await user.click(guardar)
    await user.click(guardar)

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument()

    // La contraseña original sigue funcionando
    const repo = new LocalRepository()
    const socio = await repo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    expect(socio.email).toBe(SOCIO)
  })
})

describe('ZCAPP-46 · integración · sesiones abiertas', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('cambiar la contraseña cierra las otras sesiones del socio', async () => {
    // El socio tiene sesión abierta en otro dispositivo
    const otroDispositivo = new LocalRepository()
    await otroDispositivo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    expect(await otroDispositivo.getCurrentUser()).not.toBeNull()

    // Recupera la contraseña desde este
    const esteDispositivo = new LocalRepository()
    await esteDispositivo.resetPassword(SOCIO)
    await esteDispositivo.updatePassword(NUEVA)

    // Queda dentro en el dispositivo donde hizo el cambio
    expect((await esteDispositivo.getCurrentUser())?.email).toBe(SOCIO)

    // Y la sesión del otro dispositivo quedó invalidada
    expect(await otroDispositivo.getCurrentUser()).toBeNull()
  })

  it('la sesión anterior no puede seguir operando con su token viejo', async () => {
    const otroDispositivo = new LocalRepository()
    await otroDispositivo.signIn({ email: SOCIO, password: DEMO_PASSWORD })

    const esteDispositivo = new LocalRepository()
    await esteDispositivo.resetPassword(SOCIO)
    await esteDispositivo.updatePassword(NUEVA)

    // Cualquier operación que exija usuario debe fallar en el dispositivo viejo
    await expect(otroDispositivo.deleteAccount()).rejects.toThrow()
  })
})

/* ──────────────────────────────────────────────────────────────────────
 * Contrato contra Supabase. Se inyecta un cliente falso: no hay red, pero
 * se verifica exactamente lo que la app le pide al SDK. Sin esto, un
 * cambio en el redirectTo rompería el correo en producción sin que
 * ninguna prueba lo notara — que es justo el bug que ZCAPP-46 corrigió.
 * ────────────────────────────────────────────────────────────────────── */
describe('ZCAPP-46 · integración · contrato con Supabase', () => {
  function fakeClient(overrides: Record<string, unknown> = {}) {
    const auth = {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      ...overrides,
    }
    return { auth } as unknown as SupabaseClient & {
      auth: typeof auth
    }
  }

  it('el enlace del correo apunta a /recuperar, no al login', async () => {
    const client = fakeClient()
    await new SupabaseRepository(client).resetPassword(SOCIO)

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      SOCIO,
      expect.objectContaining({
        redirectTo: expect.stringMatching(/\/recuperar$/),
      }),
    )
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        redirectTo: expect.stringMatching(/\/login/),
      }),
    )
  })

  it('recorta espacios del correo antes de enviarlo', async () => {
    const client = fakeClient()
    await new SupabaseRepository(client).resetPassword('  socio@gym.local  ')

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      SOCIO,
      expect.anything(),
    )
  })

  it('propaga el error de Supabase al pedir el enlace', async () => {
    const client = fakeClient({
      resetPasswordForEmail: vi
        .fn()
        .mockResolvedValue({ error: { message: 'rate limit exceeded' } }),
    })

    await expect(
      new SupabaseRepository(client).resetPassword(SOCIO),
    ).rejects.toThrow(/rate limit/i)
  })

  it('al guardar, pide a Supabase actualizar la contraseña del usuario', async () => {
    const client = fakeClient()
    await new SupabaseRepository(client).updatePassword(NUEVA)

    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: NUEVA })
  })

  it('propaga el error de Supabase al guardar la contraseña', async () => {
    const client = fakeClient({
      updateUser: vi
        .fn()
        .mockResolvedValue({ error: { message: 'New password should be different' } }),
    })

    await expect(
      new SupabaseRepository(client).updatePassword(NUEVA),
    ).rejects.toThrow(/should be different/i)
  })

  it('reconoce el enlace como válido cuando Supabase abrió sesión con el token', async () => {
    const client = fakeClient({
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { access_token: 'token-de-recuperacion' } } }),
    })

    expect(await new SupabaseRepository(client).hasRecoverySession()).toBe(true)
  })

  it('reconoce el enlace como inválido cuando no hay sesión', async () => {
    const client = fakeClient()
    expect(await new SupabaseRepository(client).hasRecoverySession()).toBe(false)
  })
})

describe('ZCAPP-46 · integración · la pantalla usa el repositorio activo', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('muestra al socio el error que devuelve el backend, sin inventar texto', async () => {
    const user = userEvent.setup()

    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    vi.spyOn(repo, 'updatePassword').mockRejectedValue(
      new Error('New password should be different from the old password'),
    )
    resetRepositoryForTests(repo)

    render(
      <MemoryRouter initialEntries={['/recuperar']}>
        <RepositoryProvider>
          <Routes>
            <Route path="/recuperar" element={<ResetPasswordPage />} />
          </Routes>
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await user.type(await screen.findByLabelText(/nueva contraseña/i), NUEVA)
    await user.type(screen.getByLabelText(/repite la contraseña/i), NUEVA)
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/should be different from the old password/i),
      ).toBeInTheDocument()
    })
  })
})
