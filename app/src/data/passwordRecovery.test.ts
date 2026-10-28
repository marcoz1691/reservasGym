import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'

const DEMO_PASSWORD = 'demo1234'
const SOCIO = 'socio@gym.local'
const NUEVA = 'ZonaCero2026'

/** Pide el código y lo devuelve, como si el socio lo leyera en su correo. */
async function requestCode(repo: LocalRepository, email = SOCIO): Promise<string> {
  await repo.resetPassword(email)
  const code = repo.peekRecoveryCode()
  if (!code) throw new Error('no se generó código')
  return code
}

describe('Recuperación de contraseña con código (LocalRepository)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('no hay código antes de pedirlo', async () => {
    const repo = new LocalRepository()
    await repo.load()
    expect(repo.peekRecoveryCode()).toBeNull()
  })

  it('genera un código de 6 dígitos para un correo existente', async () => {
    const code = await requestCode(new LocalRepository())
    expect(code).toMatch(/^\d{6}$/)
  })

  it('no revela si el correo existe: resuelve igual con uno inexistente', async () => {
    const repo = new LocalRepository()
    await expect(repo.resetPassword('nadie@ejemplo.com')).resolves.toBeUndefined()
    // pero no genera código
    expect(repo.peekRecoveryCode()).toBeNull()
  })

  it('normaliza mayúsculas y espacios en el correo', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo, '  SOCIO@GYM.LOCAL  ')
    await repo.completePasswordReset(' Socio@Gym.Local ', code, NUEVA)
    const user = await new LocalRepository().signIn({ email: SOCIO, password: NUEVA })
    expect(user.email).toBe(SOCIO)
  })

  it('con el código correcto la contraseña nueva sirve y la anterior no', async () => {
    const repo = new LocalRepository()
    await repo.completePasswordReset(SOCIO, await requestCode(repo), NUEVA)

    const socio = await new LocalRepository().signIn({ email: SOCIO, password: NUEVA })
    expect(socio.email).toBe(SOCIO)
    await expect(
      new LocalRepository().signIn({ email: SOCIO, password: DEMO_PASSWORD }),
    ).rejects.toThrow(/incorrecta/i)
  })

  it('con un código incorrecto no cambia nada', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo)
    const wrong = code === '000000' ? '111111' : '000000'

    await expect(repo.completePasswordReset(SOCIO, wrong, NUEVA)).rejects.toThrow(
      /código no es válido/i,
    )
    const socio = await new LocalRepository().signIn({ email: SOCIO, password: DEMO_PASSWORD })
    expect(socio.email).toBe(SOCIO)
  })

  it('el código de un socio no sirve para la cuenta de otro', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo)
    await expect(
      repo.completePasswordReset('luis@gym.local', code, NUEVA),
    ).rejects.toThrow(/código no es válido/i)
  })

  it('el código es de un solo uso', async () => {
    const repo = new LocalRepository()
    const code = await requestCode(repo)
    await repo.completePasswordReset(SOCIO, code, NUEVA)
    await expect(
      repo.completePasswordReset(SOCIO, code, 'OtraClave2026'),
    ).rejects.toThrow(/código no es válido/i)
  })

  it('pedir un código nuevo invalida el anterior', async () => {
    const repo = new LocalRepository()
    const first = await requestCode(repo)
    let second = await requestCode(repo)
    while (second === first) second = await requestCode(repo)

    await expect(repo.completePasswordReset(SOCIO, first, NUEVA)).rejects.toThrow()
    await expect(repo.completePasswordReset(SOCIO, second, NUEVA)).resolves.toBeUndefined()
  })

  it('deja la sesión cerrada: el socio entra luego desde el login', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    await repo.completePasswordReset(SOCIO, await requestCode(repo), NUEVA)
    expect(await repo.getCurrentUser()).toBeNull()
  })

  it('permite cambiar la contraseña desde una sesión normal, sin código', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: SOCIO, password: DEMO_PASSWORD })
    await repo.updatePassword('OtraClave2026')

    const user = await new LocalRepository().signIn({ email: SOCIO, password: 'OtraClave2026' })
    expect(user.email).toBe(SOCIO)
  })

  it('updatePassword falla si no hay sesión activa', async () => {
    const repo = new LocalRepository()
    await repo.load()
    await expect(repo.updatePassword(NUEVA)).rejects.toThrow(/sesión activa/i)
  })

  it('cada cambio genera un hash distinto aunque la contraseña sea la misma', async () => {
    const repo = new LocalRepository()
    await repo.completePasswordReset(SOCIO, await requestCode(repo), NUEVA)
    const first = localStorage.getItem('reservasgym.creds.v1')

    await repo.completePasswordReset(SOCIO, await requestCode(repo), NUEVA)
    const second = localStorage.getItem('reservasgym.creds.v1')

    // Distinto salt ⇒ distinto hash: no se puede correlacionar por el valor.
    expect(first).not.toBe(second)
  })
})
