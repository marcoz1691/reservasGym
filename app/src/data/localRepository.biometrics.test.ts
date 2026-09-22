import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'
import { DEMO_PASSWORD } from './seed'
import { resetRepositoryForTests } from './repository'
import { disableBiometrics, readBiometricSession } from '@/lib/biometrics'

describe('LocalRepository biometric session', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('restores the signed-out account after the device confirms biometrics', async () => {
    const repo = new LocalRepository()
    const signedIn = await repo.signIn({
      email: 'socio@gym.local',
      password: DEMO_PASSWORD,
    })
    await repo.rememberBiometricSession()
    await repo.signOut()

    expect(await repo.getCurrentUser()).toBeNull()
    expect(readBiometricSession()).toEqual({ kind: 'local', userId: signedIn.id })

    const restored = await repo.restoreBiometricSession()
    expect(restored.email).toBe('socio@gym.local')
    expect((await repo.getCurrentUser())?.id).toBe(signedIn.id)
  })

  it('asks for the password when there is no saved session', async () => {
    const repo = new LocalRepository()
    await expect(repo.restoreBiometricSession()).rejects.toThrow(
      /acceso rápido venció/i,
    )
  })

  it('drops the saved session when biometrics is turned off', async () => {
    const repo = new LocalRepository()
    await repo.signIn({
      email: 'socio@gym.local',
      password: DEMO_PASSWORD,
    })
    await repo.rememberBiometricSession()
    disableBiometrics()
    await repo.signOut()

    await expect(repo.restoreBiometricSession()).rejects.toThrow(
      /acceso rápido venció/i,
    )
  })
})
