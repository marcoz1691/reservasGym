import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryProvider } from '../data/RepositoryProvider'
import { LocalRepository } from '../data/localRepository'
import { resetRepositoryForTests } from '../data/repository'
import { SupabaseRepository } from '../data/supabaseRepository'
import { DEMO_PASSWORD } from '../data/seed'
import {
  RECOVERY_CODE_INVALID,
  RECOVERY_CODE_TTL_MS,
} from '../domain/rules/password'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'

/**
 * Flujo OTP de recuperación de contraseña: vencimiento del código, reenvío,
 * intentos fallidos, formato del código y contrato con Supabase.
 * El recorrido feliz completo vive en passwordRecoveryFlow.test.tsx.
 */

const SOCIO = 'socio@gym.local'
const LUIS = 'luis@gym.local'
const NUEVA = 'ZonaCero2026'
const HOUR = RECOVERY_CODE_TTL_MS

async function requestCode(repo: LocalRepository, email = SOCIO): Promise<string> {
  await repo.resetPassword(email)
  return repo.peekRecoveryCode()!
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  try {
    await new LocalRepository().signIn({ email, password })
    return true
  } catch {
    return false
  }
}

function otherCode(code: string): string {
  return code === '000000' ? '111111' : '000000'
}

/**
 * Timers simulados para la cuenta regresiva de "Reenviar código". Testing
 * Library solo avanza sus esperas (findBy/waitFor) con timers simulados si ve
 * un `jest` global; con Vitest se le presta `advanceTimersByTime`.
 */
function useFakeTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
}

/**
 * La cuenta regresiva agenda cada segundo después de repintar, así que el
 * reloj se avanza de a un segundo, como lo vive el usuario.
 */
async function passSeconds(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
}

/** Congela Date.now() y permite adelantarlo sin tocar los timers. */
function freezeClock() {
  let now = Date.parse('2026-10-01T10:00:00.000Z')
  const spy = vi.spyOn(Date, 'now').mockImplementation(() => now)
  return {
    advance: (ms: number) => {
      now += ms
    },
    restore: () => spy.mockRestore(),
  }
}

beforeEach(() => {
  localStorage.clear()
  resetRepositoryForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// ─────────────────────────────────────────────────────────────────────────
describe('OTP · vencimiento del código (repositorio)', () => {
  it('sirve justo antes de cumplir la hora', async () => {
    const clock = freezeClock()
    const repo = new LocalRepository()
    const code = await requestCode(repo)

    clock.advance(HOUR - 1)
    await repo.completePasswordReset(SOCIO, code, NUEVA)

    clock.restore()
    expect(await canSignIn(SOCIO, NUEVA)).toBe(true)
  })

  it('pasada la hora ya no sirve y la contraseña no cambia', async () => {
    const clock = freezeClock()
    const repo = new LocalRepository()
    const code = await requestCode(repo)

    clock.advance(HOUR + 1)
    await expect(repo.completePasswordReset(SOCIO, code, NUEVA)).rejects.toThrow(
      RECOVERY_CODE_INVALID,
    )

    clock.restore()
    expect(await canSignIn(SOCIO, DEMO_PASSWORD)).toBe(true)
    expect(await canSignIn(SOCIO, NUEVA)).toBe(false)
  })

  it('con el código vencido, pedir uno nuevo vuelve a dar una hora completa', async () => {
    const clock = freezeClock()
    const repo = new LocalRepository()
    await requestCode(repo)
    clock.advance(HOUR + 1)

    const fresh = await requestCode(repo)
    clock.advance(HOUR - 1)
    await expect(repo.completePasswordReset(SOCIO, fresh, NUEVA)).resolves.toBeUndefined()
    clock.restore()
  })

  it('reenviar reinicia el plazo: cuenta desde el último envío', async () => {
    const clock = freezeClock()
    const repo = new LocalRepository()
    await requestCode(repo)
    clock.advance(50 * 60 * 1000) // 50 min después reenvía

    const second = await requestCode(repo)
    clock.advance(30 * 60 * 1000) // 80 min desde el primero, 30 desde el segundo
    await expect(repo.completePasswordReset(SOCIO, second, NUEVA)).resolves.toBeUndefined()
    clock.restore()
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('OTP · reenvío e intentos (repositorio)', () => {
  it('tras reenviar, el código anterior deja de servir', async () => {
    const repo = new LocalRepository()
    const first = await requestCode(repo)
    let second = await requestCode(repo)
    while (second === first) second = await requestCode(repo)

    await expect(repo.completePasswordReset(SOCIO, first, NUEVA)).rejects.toThrow(
      RECOVERY_CODE_INVALID,
    )
    await expect(repo.completePasswordReset(SOCIO, second, NUEVA)).resolves.toBeUndefined()
  })

  it('un intento fallido no gasta el código correcto', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo)

    await expect(
      repo.completePasswordReset(SOCIO, otherCode(code), NUEVA),
    ).rejects.toThrow(RECOVERY_CODE_INVALID)
    await expect(repo.completePasswordReset(SOCIO, code, NUEVA)).resolves.toBeUndefined()
  })

  it('varios intentos fallidos no cambian la contraseña ni cierran sesiones', async () => {
    const otroDispositivo = new LocalRepository()
    await otroDispositivo.signIn({ email: SOCIO, password: DEMO_PASSWORD })

    const repo = new LocalRepository()
    const code = await requestCode(repo)
    for (let i = 0; i < 5; i++) {
      await expect(
        repo.completePasswordReset(SOCIO, otherCode(code), NUEVA),
      ).rejects.toThrow()
    }

    // Primero la sesión del otro dispositivo: en demo cada socio tiene una sola
    // sesión, y el login de canSignIn la reemplazaría.
    expect(await otroDispositivo.getCurrentUser()).not.toBeNull()
    expect(await canSignIn(SOCIO, DEMO_PASSWORD)).toBe(true)
  })

  it('acepta el código con espacios alrededor', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo)
    await expect(
      repo.completePasswordReset(SOCIO, `  ${code} `, NUEVA),
    ).resolves.toBeUndefined()
  })

  it('un código vacío se rechaza', async () => {
    const repo = new LocalRepository()
    await requestCode(repo)
    await expect(repo.completePasswordReset(SOCIO, '', NUEVA)).rejects.toThrow(
      RECOVERY_CODE_INVALID,
    )
  })

  it('pedir el código de otra cuenta reemplaza el anterior en este dispositivo', async () => {
    const repo = new LocalRepository()
    const socioCode = await requestCode(repo, SOCIO)
    const luisCode = await requestCode(repo, LUIS)

    await expect(
      repo.completePasswordReset(SOCIO, socioCode, NUEVA),
    ).rejects.toThrow(RECOVERY_CODE_INVALID)
    await expect(repo.completePasswordReset(LUIS, luisCode, NUEVA)).resolves.toBeUndefined()
    expect(await canSignIn(SOCIO, DEMO_PASSWORD)).toBe(true)
  })

  it('pedir código para un correo inexistente no borra el pendiente de otro', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo, SOCIO)
    await repo.resetPassword('nadie@ejemplo.com')
    await expect(repo.completePasswordReset(SOCIO, code, NUEVA)).resolves.toBeUndefined()
  })

  it('el código siempre tiene 6 dígitos, incluso con ceros a la izquierda', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr) => {
      ;(arr as Uint32Array)[0] = 42
      return arr
    })
    const code = await requestCode(new LocalRepository())
    expect(code).toBe('000042')
  })

  it('los códigos no se repiten en serie (aleatorios)', async () => {
    const repo = new LocalRepository()
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) codes.add(await requestCode(repo))
    expect(codes.size).toBeGreaterThan(15)
  })
})

// ─────────────────────────────────────────────────────────────────────────
function renderFlow(repo = new LocalRepository()) {
  resetRepositoryForTests(repo)
  render(
    <MemoryRouter initialEntries={[{ pathname: '/recuperar', state: { email: SOCIO } }]}>
      <RepositoryProvider>
        <Routes>
          <Route path="/recuperar" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Pantalla de login</div>} />
        </Routes>
      </RepositoryProvider>
    </MemoryRouter>,
  )
  return repo
}

/** Avanza hasta el paso del código y devuelve el código mostrado en demo. */
async function reachCodeStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /continuar/i }))
  await user.type(await screen.findByLabelText(/nueva contraseña/i), NUEVA)
  await user.type(screen.getByLabelText(/confirmar contraseña/i), NUEVA)
  await user.click(screen.getByRole('button', { name: /enviar código/i }))
  return shownCode()
}

async function shownCode(): Promise<string> {
  const aviso = await screen.findByText(/modo demo/i)
  return aviso.textContent!.match(/\d{6}/)![0]
}

describe('OTP · pantalla del código', () => {
  it('con menos de 6 dígitos avisa y no intenta validar', async () => {
    const user = userEvent.setup()
    const repo = renderFlow()
    const complete = vi.spyOn(repo, 'completePasswordReset')
    await reachCodeStep(user)

    await user.type(screen.getByLabelText(/código/i), '1234')
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))

    expect(await screen.findByText(/escribe los 6 dígitos/i)).toBeInTheDocument()
    expect(complete).not.toHaveBeenCalled()
  })

  it('al pegar un código con espacios o guiones deja solo los dígitos', async () => {
    const user = userEvent.setup()
    renderFlow()
    await reachCodeStep(user)

    const campo = screen.getByLabelText(/código/i)
    fireEvent.change(campo, { target: { value: '12 34-56' } })
    expect(campo).toHaveValue('123456')
  })

  it('no permite más de 6 dígitos', async () => {
    const user = userEvent.setup()
    renderFlow()
    await reachCodeStep(user)

    const campo = screen.getByLabelText(/código/i)
    await user.type(campo, '123456789')
    expect(campo).toHaveValue('123456')
  })

  it('un código vencido avisa; reenviar da uno nuevo que sí funciona', async () => {
    useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const clock = freezeClock()
    const repo = renderFlow()
    const vencido = await reachCodeStep(user)

    // Pasa más de una hora: el código venció y el reenvío ya está libre
    clock.advance(HOUR + 1)
    await passSeconds(60)
    const campo = screen.getByLabelText(/código/i)
    await user.type(campo, vencido)
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    expect(await screen.findByText(RECOVERY_CODE_INVALID)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^reenviar código$/i }))
    const nuevo = repo.peekRecoveryCode()!
    await user.clear(campo)
    await user.type(campo, nuevo)
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    expect(await screen.findByText(/contraseña actualizada/i)).toBeInTheDocument()
    clock.restore()
  })

  it('el error se limpia al reenviar y el código nuevo reemplaza al mostrado', async () => {
    useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const repo = renderFlow()
    const primero = await reachCodeStep(user)

    await user.type(screen.getByLabelText(/código/i), otherCode(primero))
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    expect(await screen.findByText(RECOVERY_CODE_INVALID)).toBeInTheDocument()

    await passSeconds(60)
    const send = vi.spyOn(repo, 'resetPassword')
    await user.click(screen.getByRole('button', { name: /^reenviar código$/i }))

    expect(send).toHaveBeenCalledWith(SOCIO)
    expect(screen.queryByText(RECOVERY_CODE_INVALID)).not.toBeInTheDocument()
    // La pantalla pasa a mostrar el código recién enviado
    expect(await screen.findByText(repo.peekRecoveryCode()!)).toBeInTheDocument()
  })

  it('reenviar queda bloqueado 60 s con cuenta regresiva y luego se habilita', async () => {
    useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()
    await reachCodeStep(user)

    expect(screen.getByRole('button', { name: /reenviar código \(60 s\)/i })).toBeDisabled()

    await passSeconds(1)
    expect(screen.getByRole('button', { name: /reenviar código \(59 s\)/i })).toBeDisabled()

    await passSeconds(58)
    expect(screen.getByRole('button', { name: /reenviar código \(1 s\)/i })).toBeDisabled()

    await passSeconds(1)
    expect(screen.getByRole('button', { name: /^reenviar código$/i })).toBeEnabled()
  })

  it('después de reenviar vuelve a esperar 60 s', async () => {
    useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderFlow()
    await reachCodeStep(user)

    await passSeconds(60)
    await user.click(screen.getByRole('button', { name: /^reenviar código$/i }))
    expect(
      await screen.findByRole('button', { name: /reenviar código \(60 s\)/i }),
    ).toBeDisabled()
  })

  it('tras reenviar, el código anterior falla y el nuevo cambia la contraseña', async () => {
    useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const repo = renderFlow()
    const primero = await reachCodeStep(user)

    await passSeconds(60)
    await user.click(screen.getByRole('button', { name: /^reenviar código$/i }))
    let segundo = repo.peekRecoveryCode()!
    // Probabilidad ínfima de repetir; si pasa, se reenvía otra vez.
    while (segundo === primero) {
      await passSeconds(60)
      await user.click(screen.getByRole('button', { name: /^reenviar código$/i }))
      segundo = repo.peekRecoveryCode()!
    }

    const campo = screen.getByLabelText(/código/i)
    await user.type(campo, primero)
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    expect(await screen.findByText(RECOVERY_CODE_INVALID)).toBeInTheDocument()

    await user.clear(campo)
    await user.type(campo, segundo)
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    expect(await screen.findByText(/contraseña actualizada/i)).toBeInTheDocument()
  })

  it('si falla el reenvío avisa, se queda en el código y permite reintentar', async () => {
    useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const repo = renderFlow()
    await reachCodeStep(user)

    await passSeconds(60)
    vi.spyOn(repo, 'resetPassword').mockRejectedValueOnce(
      new Error('email rate limit exceeded'),
    )
    await user.click(screen.getByRole('button', { name: /^reenviar código$/i }))

    expect(await screen.findByText(/demasiados correos/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/código/i)).toBeInTheDocument()
    // No arrancó la espera: el envío no salió
    expect(screen.getByRole('button', { name: /^reenviar código$/i })).toBeEnabled()
  })

  it('mientras valida, el botón queda deshabilitado: un doble toque valida una sola vez', async () => {
    const user = userEvent.setup()
    const repo = renderFlow()
    const code = await reachCodeStep(user)

    let release!: () => void
    const complete = vi
      .spyOn(repo, 'completePasswordReset')
      .mockImplementation(() => new Promise<void>((res) => (release = res)))

    await user.type(screen.getByLabelText(/código/i), code)
    const boton = screen.getByRole('button', { name: /cambiar contraseña/i })
    await user.click(boton)
    expect(await screen.findByRole('button', { name: /verificando/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /verificando/i }))
    expect(complete).toHaveBeenCalledTimes(1)

    await act(async () => release())
    expect(await screen.findByText(/contraseña actualizada/i)).toBeInTheDocument()
  })

  it('"Cambiar correo" permite corregirlo y el código va al correo nuevo', async () => {
    const user = userEvent.setup()
    const repo = renderFlow()
    await reachCodeStep(user)
    const send = vi.spyOn(repo, 'resetPassword')

    await user.click(screen.getByRole('button', { name: /cambiar correo/i }))
    const correo = await screen.findByLabelText(/correo electrónico/i)
    await user.clear(correo)
    await user.type(correo, LUIS)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    // La contraseña escrita se conserva
    expect(screen.getByLabelText(/nueva contraseña/i)).toHaveValue(NUEVA)
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    expect(send).toHaveBeenCalledWith(LUIS)
    expect(await screen.findByText(LUIS)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/código/i), await shownCode())
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))
    await screen.findByText(/contraseña actualizada/i)

    expect(await canSignIn(LUIS, NUEVA)).toBe(true)
    expect(await canSignIn(SOCIO, DEMO_PASSWORD)).toBe(true)
  })

  it('"Volver al inicio de sesión" sale del flujo sin cambiar nada', async () => {
    const user = userEvent.setup()
    renderFlow()
    await reachCodeStep(user)

    await user.click(screen.getByRole('link', { name: /volver al inicio de sesión/i }))
    expect(await screen.findByText('Pantalla de login')).toBeInTheDocument()
    expect(await canSignIn(SOCIO, DEMO_PASSWORD)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('OTP · contrato con Supabase (vencimiento, reenvío y fallos)', () => {
  function fakeClient(overrides: Record<string, unknown> = {}) {
    const auth = {
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      ...overrides,
    }
    return { auth } as unknown as SupabaseClient & { auth: typeof auth }
  }

  it('cada reenvío vuelve a pedir el correo a Supabase', async () => {
    const client = fakeClient()
    const repo = new SupabaseRepository(client)
    await repo.resetPassword(SOCIO)
    await repo.resetPassword(SOCIO)
    await repo.resetPassword(SOCIO)
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledTimes(3)
  })

  it('el límite de envíos de Supabase (429) llega como error al reenviar', async () => {
    const client = fakeClient({
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        error: { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
      }),
    })
    await expect(new SupabaseRepository(client).resetPassword(SOCIO)).rejects.toThrow(
      /rate limit/i,
    )
  })

  it.each([
    ['vencido', { code: 'otp_expired', message: 'Token has expired or is invalid' }],
    ['inválido', { code: 'otp_disabled', message: 'Invalid token' }],
    ['demasiados intentos', { status: 429, code: 'over_request_rate_limit', message: 'Too many requests' }],
  ])('código %s → mensaje único en español y sin tocar la contraseña', async (_caso, error) => {
    const client = fakeClient({
      verifyOtp: vi.fn().mockResolvedValue({ data: {}, error }),
    })
    await expect(
      new SupabaseRepository(client).completePasswordReset(SOCIO, '123456', NUEVA),
    ).rejects.toThrow(RECOVERY_CODE_INVALID)
    expect(client.auth.updateUser).not.toHaveBeenCalled()
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })

  it('si la red falla al validar, no toca la contraseña', async () => {
    const client = fakeClient({
      verifyOtp: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    })
    await expect(
      new SupabaseRepository(client).completePasswordReset(SOCIO, '123456', NUEVA),
    ).rejects.toThrow(/failed to fetch/i)
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('si falla fijar la contraseña, igual cierra la sesión abierta por el código', async () => {
    const client = fakeClient({
      updateUser: vi.fn().mockResolvedValue({
        error: { code: 'weak_password', message: 'Password should be at least 8 characters.' },
      }),
    })
    await expect(
      new SupabaseRepository(client).completePasswordReset(SOCIO, '123456', 'abc'),
    ).rejects.toThrow(/at least 8/i)
    expect(client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('manda el código recortado y el tipo recovery', async () => {
    const client = fakeClient()
    await new SupabaseRepository(client).completePasswordReset(SOCIO, ' 012345 ', NUEVA)
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: SOCIO,
      token: '012345',
      type: 'recovery',
    })
  })
})
