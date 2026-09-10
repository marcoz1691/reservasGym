import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'

const DEMO_PASSWORD = 'demo1234'
const SOCIO = 'socio@gym.local'

describe('ZCAPP-46 · recuperación de contraseña (LocalRepository)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('no marca sesión de recuperación antes de pedirla', async () => {
    const repo = new LocalRepository()
    await repo.load()
    expect(await repo.hasRecoverySession()).toBe(false)
  })

  it('resetPassword abre la sesión de recuperación para un correo existente', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    expect(await repo.hasRecoverySession()).toBe(true)
  })

  it('no revela si el correo existe: resuelve igual con uno inexistente', async () => {
    const repo = new LocalRepository()
    await expect(repo.resetPassword('nadie@ejemplo.com')).resolves.toBeUndefined()
    // pero no habilita el flujo
    expect(await repo.hasRecoverySession()).toBe(false)
  })

  it('normaliza mayúsculas y espacios en el correo', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword('  SOCIO@GYM.LOCAL  ')
    expect(await repo.hasRecoverySession()).toBe(true)
  })

  it('tras fijar la contraseña, la nueva sirve para entrar', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    await repo.updatePassword('ZonaCero2026')

    const check = new LocalRepository()
    const user = await check.signIn({ email: SOCIO, password: 'ZonaCero2026' })
    expect(user.email).toBe(SOCIO)
  })

  it('la contraseña anterior deja de servir', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    await repo.updatePassword('ZonaCero2026')

    const check = new LocalRepository()
    await expect(
      check.signIn({ email: SOCIO, password: DEMO_PASSWORD }),
    ).rejects.toThrow(/incorrecta/i)
  })

  it('consume la sesión de recuperación: no se puede reutilizar el enlace', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    await repo.updatePassword('ZonaCero2026')
    expect(await repo.hasRecoverySession()).toBe(false)
  })

  it('deja al socio con la sesión iniciada tras fijar la contraseña', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    await repo.updatePassword('ZonaCero2026')

    const current = await repo.getCurrentUser()
    expect(current?.email).toBe(SOCIO)
  })

  it('permite cambiar la contraseña desde una sesión normal, sin recuperación', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    await repo.updatePassword('OtraClave2026')

    const check = new LocalRepository()
    const user = await check.signIn({ email: SOCIO, password: 'OtraClave2026' })
    expect(user.email).toBe(SOCIO)
  })

  it('falla si no hay sesión ni recuperación activa', async () => {
    const repo = new LocalRepository()
    await repo.load()
    await expect(repo.updatePassword('ZonaCero2026')).rejects.toThrow(
      /sesión activa/i,
    )
  })

  it('cada reset genera un hash distinto aunque la contraseña sea la misma', async () => {
    const repo = new LocalRepository()
    await repo.resetPassword(SOCIO)
    await repo.updatePassword('ZonaCero2026')
    const first = localStorage.getItem('reservasgym.creds.v1')

    await repo.resetPassword(SOCIO)
    await repo.updatePassword('ZonaCero2026')
    const second = localStorage.getItem('reservasgym.creds.v1')

    // Distinto salt ⇒ distinto hash: no se puede correlacionar por el valor.
    expect(first).not.toBe(second)
  })
})
