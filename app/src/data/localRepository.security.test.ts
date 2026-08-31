import { beforeEach, describe, expect, it } from 'vitest'
import { LocalRepository } from './localRepository'
import { DEMO_PASSWORD } from './seed'
import { resetRepositoryForTests } from './repository'

describe('LocalRepository auth and scoping', () => {
  beforeEach(() => {
    localStorage.clear()
    resetRepositoryForTests()
  })

  it('rejects wrong password', async () => {
    const repo = new LocalRepository()
    await expect(
      repo.signIn({ email: 'socio@gym.local', password: 'wrong' }),
    ).rejects.toThrow(/contraseña/i)
  })

  it('accepts demo password and scopes member load', async () => {
    const repo = new LocalRepository()
    const user = await repo.signIn({
      email: 'socio@gym.local',
      password: DEMO_PASSWORD,
    })
    expect(user.role).toBe('member')
    const state = await repo.load()
    expect(state.users.every((u) => u.id === user.id)).toBe(true)
    expect(state.bookings.every((b) => b.userId === user.id)).toBe(true)
    expect(state.measurements.every((m) => m.userId === user.id)).toBe(true)
  })

  it('ignores forged session user id without matching token', async () => {
    const repo = new LocalRepository()
    await repo.signIn({ email: 'socio@gym.local', password: DEMO_PASSWORD })
    localStorage.setItem(
      'reservasgym.session.v2',
      JSON.stringify({ userId: 'user_admin', token: 'forged' }),
    )
    const forged = new LocalRepository()
    expect(await forged.getCurrentUser()).toBeNull()
  })
})
